const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  verifyNeo4jConnection,
  closeNeo4j,
} = require("./providers/neo4j");

const {
  syncGraphToNeo4j,
} = require("./services/neo4jSync");

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const { getAuth } = require("firebase-admin/auth");

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n"
);

const missingFirebaseVariables = [];

if (!firebaseProjectId) {
  missingFirebaseVariables.push("FIREBASE_PROJECT_ID");
}

if (!firebaseClientEmail) {
  missingFirebaseVariables.push("FIREBASE_CLIENT_EMAIL");
}

if (!firebasePrivateKey) {
  missingFirebaseVariables.push("FIREBASE_PRIVATE_KEY");
}

if (missingFirebaseVariables.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingFirebaseVariables.join(
      ", "
    )}`
  );
}

const serviceAccount = {
  projectId: firebaseProjectId,
  clientEmail: firebaseClientEmail,
  privateKey: firebasePrivateKey,
};

const app = express();
const port = Number(process.env.PORT || 5000);

// API responses must always include fresh JSON.
// Prevent Express from replying with 304 and an empty response body.
app.disable("etag");

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });

  next();
});

app.use((req, res, next) => {
  console.log(`\n==========================`);
  console.log(`${req.method} ${req.originalUrl}`);
  console.log(req.body);
  console.log(`==========================\n`);
  next();
});

// Initialize Firebase Admin only once.
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const crypto = require("crypto");

const db = getFirestore();
const DEEZER_API_BASE = "https://api.deezer.com";

/*
 * =========================================================
 * DEEZER HYBRID CACHE
 * =========================================================
 *
 * Request order:
 *
 * 1. Check memory cache.
 * 2. Check persistent Firestore cache.
 * 3. Call Deezer only when no valid cache exists.
 * 4. Save successful Deezer data to memory and Firestore.
 * 5. Use expired cached data if Deezer is unavailable.
 *
 * This automatically works across the whole site because
 * all Deezer requests use fetchDeezer().
 */

const deezerMemoryCache = new Map();

const deezerRequestsInFlight = new Map();

const DEEZER_CACHE_COLLECTION =
  "deezerApiCache";

const DEEZER_MEMORY_CACHE_MAX_ITEMS =
  1500;

/*
 * Cache expiration times.
 *
 * Tracks, albums, and artists rarely change, so they can
 * remain cached for seven days.
 *
 * Charts and search results change more frequently.
 */
const DEEZER_CACHE_TTL = {
  track:
    6 * 60 * 60 * 1000,

  album:
    7 * 24 * 60 * 60 * 1000,

  artist:
    7 * 24 * 60 * 60 * 1000,

  artistTop:
    6 * 60 * 60 * 1000,

  chart:
    15 * 60 * 1000,

  search:
    60 * 60 * 1000,

  default:
    60 * 60 * 1000,
};

/*
 * Determine how long each Deezer request should remain
 * fresh in the cache.
 */
function getDeezerCacheTtl(path) {
  if (
    /^\/track\/[^/?]+/i.test(path)
  ) {
    return DEEZER_CACHE_TTL.track;
  }

  if (
    /^\/album\/[^/?]+/i.test(path)
  ) {
    return DEEZER_CACHE_TTL.album;
  }

  if (
    /^\/artist\/[^/?]+\/top/i.test(
      path
    )
  ) {
    return DEEZER_CACHE_TTL.artistTop;
  }

  if (
    /^\/artist\/[^/?]+/i.test(path)
  ) {
    return DEEZER_CACHE_TTL.artist;
  }

  if (
    /^\/chart\//i.test(path)
  ) {
    return DEEZER_CACHE_TTL.chart;
  }

  if (
    /^\/search/i.test(path)
  ) {
    return DEEZER_CACHE_TTL.search;
  }

  return DEEZER_CACHE_TTL.default;
}

/*
 * Firestore document IDs cannot contain forward slashes.
 * Convert each Deezer path into a safe SHA-256 document ID.
 */
function getDeezerCacheDocumentId(
  path
) {
  return crypto
    .createHash("sha256")
    .update(path)
    .digest("hex");
}

/*
 * Convert Firestore timestamps, JavaScript Dates, or date
 * strings into milliseconds.
 */
function getTimestampMilliseconds(
  value
) {
  if (!value) {
    return 0;
  }

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

/*
 * Save data to the fast in-memory cache.
 *
 * A maximum item count prevents the cache from growing
 * forever while the server stays online.
 */
function saveToDeezerMemoryCache(
  cacheKey,
  data,
  expiresAt
) {
  deezerMemoryCache.set(
    cacheKey,
    {
      data,
      expiresAt,
      lastAccessedAt:
        Date.now(),
    }
  );

  if (
    deezerMemoryCache.size >
    DEEZER_MEMORY_CACHE_MAX_ITEMS
  ) {
    const oldestEntry = [
      ...deezerMemoryCache.entries(),
    ].sort(
      (first, second) =>
        first[1].lastAccessedAt -
        second[1].lastAccessedAt
    )[0];

    if (oldestEntry) {
      deezerMemoryCache.delete(
        oldestEntry[0]
      );
    }
  }
}

/*
 * Fetch Deezer data with:
 *
 * - Memory caching
 * - Firestore caching
 * - Duplicate-request prevention
 * - Expiration times
 * - Stale-cache fallback
 */

/* =========================================================
   TREBLE PERMANENT MUSIC CATALOG + KNOWLEDGE GRAPH
========================================================= */

const MUSIC_TRACKS_COLLECTION = "musicTracks";
const MUSIC_ALBUMS_COLLECTION = "musicAlbums";
const MUSIC_ARTISTS_COLLECTION = "musicArtists";
const MUSIC_GRAPH_EDGES_COLLECTION = "musicGraphEdges";

function cleanCatalogText(value) {
  const text = String(value || "").trim();

  if (
    !text ||
    text.toLowerCase() === "unknown" ||
    text.toLowerCase() === "unknown artist"
  ) {
    return "";
  }

  return text;
}

function catalogTimestampToIso(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function buildGraphEdgeId({
  fromType,
  fromId,
  relationship,
  toType,
  toId,
}) {
  return crypto
    .createHash("sha256")
    .update(
      [
        String(fromType || ""),
        String(fromId || ""),
        String(relationship || ""),
        String(toType || ""),
        String(toId || ""),
      ].join("|")
    )
    .digest("hex");
}

function runGraphWrite(
  promise,
  description
) {
  Promise.resolve(promise).catch(
    (error) => {
      console.warn(
        `[GRAPH] ${description} failed:`,
        error.message
      );
    }
  );
}

async function upsertGraphEdge({
  fromType,
  fromId,
  relationship,
  toType,
  toId,
  weight = 1,
  metadata = {},
}) {
  const cleanFromId = String(fromId || "").trim();
  const cleanToId = String(toId || "").trim();
  const cleanRelationship =
    String(relationship || "").trim().toUpperCase();

  if (
    !fromType ||
    !cleanFromId ||
    !cleanRelationship ||
    !toType ||
    !cleanToId
  ) {
    return null;
  }

  const edgeId = buildGraphEdgeId({
    fromType,
    fromId: cleanFromId,
    relationship: cleanRelationship,
    toType,
    toId: cleanToId,
  });

  const edgeRef = db
    .collection(MUSIC_GRAPH_EDGES_COLLECTION)
    .doc(edgeId);

  await edgeRef.set(
    {
      id: edgeId,
      fromType: String(fromType),
      fromId: cleanFromId,
      relationship: cleanRelationship,
      toType: String(toType),
      toId: cleanToId,
      weight: Number(weight) || 1,
      metadata: metadata || {},
      firstSeenAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return edgeId;
}

async function deleteGraphEdge({
  fromType,
  fromId,
  relationship,
  toType,
  toId,
}) {
  if (!fromId || !toId) {
    return;
  }

  const edgeId = buildGraphEdgeId({
    fromType,
    fromId,
    relationship:
      String(relationship || "").toUpperCase(),
    toType,
    toId,
  });

  await db
    .collection(MUSIC_GRAPH_EDGES_COLLECTION)
    .doc(edgeId)
    .delete()
    .catch(() => {});
}

function normalizeCatalogArtist(rawArtist) {
  if (!rawArtist || typeof rawArtist !== "object") {
    return null;
  }

  const id = String(rawArtist.id || "").trim();
  if (!id) return null;

  const name = cleanCatalogText(
    rawArtist.name ||
    rawArtist.title
  );

  return {
    id,
    type: "artist",
    name,
    title: name,
    picture:
      rawArtist.picture_xl ||
      rawArtist.picture_big ||
      rawArtist.picture_medium ||
      rawArtist.picture ||
      rawArtist.image ||
      "",
    link: rawArtist.link || "",
    source: "deezer",
    raw: rawArtist,
  };
}

function normalizeCatalogAlbum(rawAlbum, fallbackArtist = null) {
  if (!rawAlbum || typeof rawAlbum !== "object") {
    return null;
  }

  const id = String(rawAlbum.id || "").trim();
  if (!id) return null;

  const artist =
    normalizeCatalogArtist(rawAlbum.artist) ||
    normalizeCatalogArtist(fallbackArtist);

  const coverArt =
    rawAlbum.cover_xl ||
    rawAlbum.cover_big ||
    rawAlbum.cover_medium ||
    rawAlbum.cover ||
    rawAlbum.image ||
    rawAlbum.coverArt ||
    "";

  return {
    id,
    listenableId: id,
    type: "album",
    title:
      rawAlbum.title ||
      rawAlbum.name ||
      "Unknown Album",
    name:
      rawAlbum.name ||
      rawAlbum.title ||
      "Unknown Album",
    artistId: artist?.id || "",
    artistName: artist?.name || "",
    artist: artist
      ? {
          id: artist.id,
          name: artist.name,
          picture: artist.picture,
        }
      : null,
    image: coverArt,
    coverArt,
    releaseDate:
      rawAlbum.release_date ||
      rawAlbum.releaseDate ||
      "",
    trackCount:
      Number(
        rawAlbum.nb_tracks ||
        rawAlbum.trackCount ||
        0
      ),
    duration:
      Number(rawAlbum.duration || 0),
    link: rawAlbum.link || "",
    source: "deezer",
    raw: rawAlbum,
  };
}

function normalizeCatalogTrack(rawTrack) {
  if (!rawTrack || typeof rawTrack !== "object") {
    return null;
  }

  const id = String(rawTrack.id || "").trim();
  if (!id) return null;

  const artist =
    normalizeCatalogArtist(rawTrack.artist);

  const album =
    normalizeCatalogAlbum(
      rawTrack.album,
      rawTrack.artist
    );

  const coverArt =
    album?.coverArt ||
    rawTrack.image ||
    rawTrack.coverArt ||
    "";

  const preview =
    rawTrack.preview ||
    rawTrack.previewUrl ||
    rawTrack.playbackUrl ||
    "";

  return {
    id,
    listenableId: id,
    listenable_id: id,
    type: "track",
    title:
      rawTrack.title ||
      rawTrack.title_short ||
      rawTrack.name ||
      "Unknown Track",
    name:
      rawTrack.name ||
      rawTrack.title ||
      rawTrack.title_short ||
      "Unknown Track",
    artistId: artist?.id || "",
    artistName: artist?.name || "",
    artist: artist
      ? {
          id: artist.id,
          name: artist.name,
          picture: artist.picture,
        }
      : null,
    albumId: album?.id || "",
    albumTitle: album?.title || "",
    album: album
      ? {
          id: album.id,
          title: album.title,
          cover: album.coverArt,
          coverArt: album.coverArt,
          cover_small:
            rawTrack.album?.cover_small ||
            album.coverArt,
          cover_medium:
            rawTrack.album?.cover_medium ||
            album.coverArt,
          cover_big:
            rawTrack.album?.cover_big ||
            album.coverArt,
          cover_xl:
            rawTrack.album?.cover_xl ||
            album.coverArt,
        }
      : null,
    image: coverArt,
    coverArt,
    preview,
    previewUrl: preview,
    playbackUrl: preview,
    duration:
      Number(rawTrack.duration || 0),
    rank:
      Number(rawTrack.rank || 0),
    explicit:
      Boolean(
        rawTrack.explicit_lyrics ||
        rawTrack.explicit
      ),
    link: rawTrack.link || "",
    source: "deezer",
    raw: rawTrack,
  };
}

async function savePermanentArtist(rawArtist) {
  const artist =
    normalizeCatalogArtist(rawArtist);

  if (!artist?.id) {
    return null;
  }

  await db
    .collection(MUSIC_ARTISTS_COLLECTION)
    .doc(artist.id)
    .set(
      {
        ...artist,
        firstSeenAt:
          FieldValue.serverTimestamp(),
        lastSeenAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

  return artist;
}

async function savePermanentAlbum(
  rawAlbum,
  fallbackArtist = null
) {
  const album =
    normalizeCatalogAlbum(
      rawAlbum,
      fallbackArtist
    );

  if (!album?.id) {
    return null;
  }

  if (rawAlbum?.artist || fallbackArtist) {
    await savePermanentArtist(
      rawAlbum?.artist || fallbackArtist
    );
  }

  await db
    .collection(MUSIC_ALBUMS_COLLECTION)
    .doc(album.id)
    .set(
      {
        ...album,
        firstSeenAt:
          FieldValue.serverTimestamp(),
        lastSeenAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

  if (album.artistId) {
    runGraphWrite(upsertGraphEdge({
      fromType: "artist",
      fromId: album.artistId,
      relationship: "CREATED",
      toType: "album",
      toId: album.id,
      metadata: {
        artistName: album.artistName,
        albumTitle: album.title,
      },
    }), "artist-created-album");
  }

  return album;
}

async function savePermanentTrack(rawTrack) {
  const track =
    normalizeCatalogTrack(rawTrack);

  if (!track?.id) {
    return null;
  }

  if (rawTrack?.artist) {
    await savePermanentArtist(
      rawTrack.artist
    );
  }

  if (rawTrack?.album) {
    await savePermanentAlbum(
      rawTrack.album,
      rawTrack.artist
    );
  }

  await db
    .collection(MUSIC_TRACKS_COLLECTION)
    .doc(track.id)
    .set(
      {
        ...track,
        firstSeenAt:
          FieldValue.serverTimestamp(),
        lastSeenAt:
          FieldValue.serverTimestamp(),
        ...(track.preview
          ? {
              previewUpdatedAt:
                FieldValue.serverTimestamp(),
            }
          : {}),
      },
      {
        merge: true,
      }
    );

  if (track.artistId) {
    runGraphWrite(upsertGraphEdge({
      fromType: "artist",
      fromId: track.artistId,
      relationship: "PERFORMED",
      toType: "track",
      toId: track.id,
      metadata: {
        artistName: track.artistName,
        trackTitle: track.title,
      },
    }), "artist-performed-track");
  }

  if (track.albumId) {
    runGraphWrite(upsertGraphEdge({
      fromType: "album",
      fromId: track.albumId,
      relationship: "CONTAINS",
      toType: "track",
      toId: track.id,
      metadata: {
        albumTitle: track.albumTitle,
        trackTitle: track.title,
      },
    }), "album-contains-track");
  }

  return track;
}

function collectDeezerEntities(
  value,
  entities = {
    tracks: new Map(),
    albums: new Map(),
    artists: new Map(),
  },
  seen = new Set()
) {
  if (
    value === null ||
    value === undefined
  ) {
    return entities;
  }

  if (typeof value !== "object") {
    return entities;
  }

  if (seen.has(value)) {
    return entities;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectDeezerEntities(
        item,
        entities,
        seen
      )
    );

    return entities;
  }

  const looksLikeTrack =
    value.id &&
    (
      value.preview !== undefined ||
      value.duration !== undefined ||
      value.title_short !== undefined
    ) &&
    (
      value.artist ||
      value.album
    );

  const looksLikeAlbum =
    value.id &&
    (
      value.cover !== undefined ||
      value.cover_big !== undefined ||
      value.cover_xl !== undefined ||
      value.nb_tracks !== undefined
    ) &&
    !looksLikeTrack;

  const looksLikeArtist =
    value.id &&
    (
      value.picture !== undefined ||
      value.picture_big !== undefined ||
      value.picture_xl !== undefined
    ) &&
    !looksLikeTrack &&
    !looksLikeAlbum;

  if (looksLikeTrack) {
    entities.tracks.set(
      String(value.id),
      value
    );
  }

  if (looksLikeAlbum) {
    entities.albums.set(
      String(value.id),
      value
    );
  }

  if (looksLikeArtist) {
    entities.artists.set(
      String(value.id),
      value
    );
  }

  if (
    value.artist &&
    typeof value.artist === "object" &&
    value.artist.id
  ) {
    entities.artists.set(
      String(value.artist.id),
      value.artist
    );
  }

  if (
    value.album &&
    typeof value.album === "object" &&
    value.album.id
  ) {
    entities.albums.set(
      String(value.album.id),
      {
        ...value.album,
        artist:
          value.album.artist ||
          value.artist ||
          null,
      }
    );
  }

  Object.values(value).forEach((child) => {
    collectDeezerEntities(
      child,
      entities,
      seen
    );
  });

  return entities;
}

const catalogPersistenceQueue = [];
const catalogPersistenceQueuedPaths = new Set();
let catalogPersistenceWorkers = 0;
const CATALOG_PERSISTENCE_MAX_WORKERS = 2;

async function persistDeezerPayload(
  path,
  payload
) {
  try {
    const entities =
      collectDeezerEntities(payload);

    /*
     * Maps already remove duplicate IDs inside the same payload.
     * Firestore document IDs are the Deezer IDs, so loading the
     * same song again updates the existing document instead of
     * creating a duplicate.
     */
    await Promise.all(
      [
        ...entities.artists.values(),
      ].map((artist) =>
        savePermanentArtist(artist)
      )
    );

    await Promise.all(
      [
        ...entities.albums.values(),
      ].map((album) =>
        savePermanentAlbum(
          album,
          album.artist
        )
      )
    );

    await Promise.all(
      [
        ...entities.tracks.values(),
      ].map((track) =>
        savePermanentTrack(track)
      )
    );

    if (
      entities.tracks.size ||
      entities.albums.size ||
      entities.artists.size
    ) {
      console.log(
        `[CATALOG] ${path}: saved ${entities.tracks.size} tracks, ${entities.albums.size} albums, ${entities.artists.size} artists`
      );
    }
  } catch (error) {
    console.warn(
      `[CATALOG] Unable to persist ${path}:`,
      error.message
    );
  }
}

function runCatalogPersistenceQueue() {
  while (
    catalogPersistenceWorkers <
      CATALOG_PERSISTENCE_MAX_WORKERS &&
    catalogPersistenceQueue.length > 0
  ) {
    const job =
      catalogPersistenceQueue.shift();

    catalogPersistenceWorkers += 1;

    Promise.resolve()
      .then(() =>
        persistDeezerPayload(
          job.path,
          job.payload
        )
      )
      .catch((error) => {
        console.warn(
          `[CATALOG] Background save failed for ${job.path}:`,
          error.message
        );
      })
      .finally(() => {
        catalogPersistenceWorkers -= 1;
        catalogPersistenceQueuedPaths.delete(
          job.path
        );
        setImmediate(
          runCatalogPersistenceQueue
        );
      });
  }
}

function scheduleCatalogPersistence(
  path,
  payload
) {
  /*
   * Never make the app wait for catalog or graph writes.
   * The API response is returned first and Firestore is
   * updated safely in the background.
   */
  if (
    !payload ||
    catalogPersistenceQueuedPaths.has(path)
  ) {
    return;
  }

  catalogPersistenceQueuedPaths.add(path);

  catalogPersistenceQueue.push({
    path,
    payload,
  });

  setImmediate(
    runCatalogPersistenceQueue
  );
}

function getPermanentEntityRequest(path) {
  const trackMatch =
    path.match(/^\/track\/([^/?]+)/i);

  if (trackMatch) {
    return {
      collection:
        MUSIC_TRACKS_COLLECTION,
      id: decodeURIComponent(
        trackMatch[1]
      ),
      type: "track",
    };
  }

  const albumMatch =
    path.match(/^\/album\/([^/?]+)/i);

  if (albumMatch) {
    return {
      collection:
        MUSIC_ALBUMS_COLLECTION,
      id: decodeURIComponent(
        albumMatch[1]
      ),
      type: "album",
    };
  }

  const artistMatch =
    path.match(/^\/artist\/([^/?]+)$/i);

  if (artistMatch) {
    return {
      collection:
        MUSIC_ARTISTS_COLLECTION,
      id: decodeURIComponent(
        artistMatch[1]
      ),
      type: "artist",
    };
  }

  return null;
}

function permanentEntityToDeezerShape(
  type,
  data
) {
  if (!data) return null;

  if (data.raw) {
    const raw = {
      ...data.raw,
    };

    if (
      type === "track" &&
      data.preview &&
      !raw.preview
    ) {
      raw.preview = data.preview;
    }

    return raw;
  }

  if (type === "track") {
    return {
      id: data.id,
      title: data.title,
      title_short: data.title,
      duration: data.duration,
      preview:
        data.preview ||
        data.previewUrl ||
        data.playbackUrl ||
        "",
      link: data.link || "",
      artist: data.artist || null,
      album: data.album || null,
    };
  }

  return data;
}

function permanentTimestampMilliseconds(
  value
) {
  if (!value) return 0;

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function isPermanentEntityUsable(
  request,
  data
) {
  if (!request || !data) {
    return false;
  }

  if (request.type === "album") {
    const tracks =
      data.raw?.tracks?.data ||
      data.tracks?.data ||
      data.tracks ||
      [];

    /*
     * Album search results contain artwork and title but usually
     * do not include the album's track list. Do not treat those
     * partial records as a complete /album/:id response.
     */
    return (
      Array.isArray(tracks) &&
      tracks.length > 0
    );
  }

  if (request.type !== "track") {
    return true;
  }

  const preview =
    data.preview ||
    data.previewUrl ||
    data.playbackUrl ||
    data.raw?.preview ||
    "";

  if (!preview) {
    return false;
  }

  /*
   * Deezer preview links can expire. Use a stored track only
   * while its preview metadata is recent; otherwise continue
   * to the API cache/Deezer and refresh it.
   */
  const refreshedAt =
    permanentTimestampMilliseconds(
      data.previewUpdatedAt ||
      data.lastSeenAt
    );

  return (
    refreshedAt > 0 &&
    Date.now() - refreshedAt <
      DEEZER_CACHE_TTL.track
  );
}

async function getPermanentEntity(
  request
) {
  if (!request?.id) {
    return null;
  }

  const snapshot = await db
    .collection(request.collection)
    .doc(String(request.id))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data =
    snapshot.data() || {};

  if (
    !isPermanentEntityUsable(
      request,
      data
    )
  ) {
    return null;
  }

  return permanentEntityToDeezerShape(
    request.type,
    data
  );
}

async function getPermanentTrack(
  trackId
) {
  const snapshot = await db
    .collection(MUSIC_TRACKS_COLLECTION)
    .doc(String(trackId))
    .get();

  return snapshot.exists
    ? snapshot.data()
    : null;
}

async function getMutualFriendIds(userId) {
  if (!userId) return [];

  const [
    followingSnapshot,
    followersSnapshot,
  ] = await Promise.all([
    db
      .collection("follows")
      .where("followerId", "==", String(userId))
      .get(),
    db
      .collection("follows")
      .where("followedId", "==", String(userId))
      .get(),
  ]);

  const following = new Set(
    followingSnapshot.docs.map(
      (document) =>
        String(
          document.data()?.followedId ||
          ""
        )
    )
  );

  const followers = new Set(
    followersSnapshot.docs.map(
      (document) =>
        String(
          document.data()?.followerId ||
          ""
        )
    )
  );

  return [...following].filter(
    (id) =>
      id &&
      followers.has(id)
  );
}

async function getFriendCatalogRecommendations(
  userId,
  {
    limit = 20,
    excludedTrackIds = new Set(),
  } = {}
) {
  const friendIds =
    await getMutualFriendIds(userId);

  if (friendIds.length === 0) {
    return [];
  }

  const scores = new Map();

  const addScore = (
    trackId,
    score,
    friendId,
    reason
  ) => {
    const id = String(trackId || "");
    if (
      !id ||
      excludedTrackIds.has(id)
    ) {
      return;
    }

    const current =
      scores.get(id) || {
        trackId: id,
        score: 0,
        friendIds: new Set(),
        reasons: new Set(),
      };

    current.score += score;
    current.friendIds.add(friendId);
    current.reasons.add(reason);
    scores.set(id, current);
  };

  for (const friendId of friendIds) {
    const [
      likesSnapshot,
      reviewsSnapshot,
    ] = await Promise.all([
      db
        .collection("likes")
        .where("userId", "==", friendId)
        .get(),
      db
        .collection("reviews")
        .where("userId", "==", friendId)
        .get(),
    ]);

    likesSnapshot.docs.forEach(
      (document) => {
        const like =
          document.data() || {};

        if (
          String(like.type || "track")
            .toLowerCase() === "track"
        ) {
          addScore(
            like.musicId,
            3,
            friendId,
            "friend-like"
          );
        }
      }
    );

    reviewsSnapshot.docs.forEach(
      (document) => {
        const review =
          document.data() || {};

        if (
          String(review.type || "track")
            .toLowerCase() !== "track"
        ) {
          return;
        }

        const rating =
          Number(review.rating || 0);

        if (review.hearted === true) {
          addScore(
            review.listenableId,
            5,
            friendId,
            "friend-favourite"
          );
        } else if (rating >= 4) {
          addScore(
            review.listenableId,
            rating === 5 ? 4 : 2,
            friendId,
            "friend-review"
          );
        }
      }
    );
  }

  const ranked = [...scores.values()]
    .sort((a, b) =>
      b.score - a.score
    )
    .slice(0, limit * 3);

  // Resolve friend names once so each "Liked by a friend" card can
  // identify the friend instead of showing a generic label.
  const uniqueFriendIds = [
    ...new Set(
      ranked.flatMap((candidate) =>
        [...candidate.friendIds]
      )
    ),
  ];

  const friendNameEntries =
    await Promise.all(
      uniqueFriendIds.map(async (friendId) => {
        try {
          const friendDoc = await db
            .collection("users")
            .doc(String(friendId))
            .get();

          const friendData = friendDoc.data() || {};
          const friendName =
            friendData.username ||
            friendData.displayName ||
            friendData.name ||
            "Friend";

          return [String(friendId), friendName];
        } catch (error) {
          console.warn(
            `[Recommendations] Unable to load friend ${friendId}:`,
            error.message
          );
          return [String(friendId), "Friend"];
        }
      })
    );

  const friendNamesById = new Map(friendNameEntries);
  const results = [];

  for (const candidate of ranked) {
    const track =
      await getPermanentTrack(
        candidate.trackId
      );

    if (!track) {
      continue;
    }

    results.push({
      track:
        track.raw ||
        permanentEntityToDeezerShape(
          "track",
          track
        ),
      origin: {
        type: "friends",
        title:
          candidate.friendIds.size === 1
            ? "Liked by a friend"
            : `Liked by ${candidate.friendIds.size} friends`,
        artist:
          track.artistName || "",
        score: candidate.score,
        friendCount:
          candidate.friendIds.size,
        friendIds:
          [...candidate.friendIds].map(String),
        friendNames:
          [...candidate.friendIds].map(
            (friendId) =>
              friendNamesById.get(String(friendId)) ||
              "Friend"
          ),
        friendName:
          candidate.friendIds.size === 1
            ? friendNamesById.get(
                String([...candidate.friendIds][0])
              ) || "Friend"
            : "",
        reasons:
          [...candidate.reasons],
      },
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

async function fetchDeezer(
  path,
  options = {}
) {
  const normalizedPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  const cacheKey =
    normalizedPath;

  const cacheDocumentId =
    getDeezerCacheDocumentId(
      cacheKey
    );

  const ttl =
    Number(options.ttl) > 0
      ? Number(options.ttl)
      : getDeezerCacheTtl(
          normalizedPath
        );

  const forceRefresh =
    options.forceRefresh ===
    true;

  const now =
    Date.now();

  const memoryEntry =
    deezerMemoryCache.get(
      cacheKey
    );

  /*
   * Keep expired memory data available as an emergency
   * fallback if Deezer is down or quota-limited.
   */
  let staleData =
    memoryEntry?.data ||
    null;

  /*
   * MEMORY CACHE HIT
   *
   * Return instantly without Firestore or Deezer.
   */
  if (
    !forceRefresh &&
    memoryEntry &&
    memoryEntry.expiresAt > now
  ) {
    memoryEntry.lastAccessedAt =
      now;

    console.log(
      `[DEEZER CACHE] MEMORY HIT ${normalizedPath}`
    );

    return memoryEntry.data;
  }

  /*
   * PERMANENT CATALOG CHECK
   *
   * Memory is always checked first. The permanent catalog is
   * used only after a memory miss, and track previews must be
   * recent enough to play.
   */
  const permanentRequest =
    getPermanentEntityRequest(
      normalizedPath
    );

  if (
    !forceRefresh &&
    permanentRequest
  ) {
    try {
      const permanentEntity =
        await getPermanentEntity(
          permanentRequest
        );

      if (permanentEntity) {
        saveToDeezerMemoryCache(
          cacheKey,
          permanentEntity,
          Date.now() + ttl
        );

        console.log(
          `[CATALOG] PERMANENT HIT ${normalizedPath}`
        );

        return permanentEntity;
      }
    } catch (error) {
      console.warn(
        `[CATALOG] Permanent lookup failed for ${normalizedPath}:`,
        error.message
      );
    }
  }

  /*
   * DUPLICATE REQUEST PREVENTION
   *
   * If several parts of the page request the same track
   * simultaneously, only one request is performed.
   *
   * All other callers wait for the existing request.
   */
  if (
    !forceRefresh &&
    deezerRequestsInFlight.has(
      cacheKey
    )
  ) {
    console.log(
      `[DEEZER CACHE] WAITING FOR EXISTING REQUEST ${normalizedPath}`
    );

    return deezerRequestsInFlight.get(
      cacheKey
    );
  }

  const requestPromise =
    (async () => {
      const cacheRef = db
        .collection(
          DEEZER_CACHE_COLLECTION
        )
        .doc(cacheDocumentId);

      /*
       * FIRESTORE CACHE CHECK
       *
       * This allows cached data to survive DigitalOcean
       * restarts and deployments.
       */
      try {
        const cacheSnapshot =
          await cacheRef.get();

        if (
          cacheSnapshot.exists
        ) {
          const storedCache =
            cacheSnapshot.data() ||
            {};

          const storedExpiresAt =
            getTimestampMilliseconds(
              storedCache.expiresAt
            );

          if (
            storedCache.data
          ) {
            staleData =
              storedCache.data;
          }

          if (
            !forceRefresh &&
            storedCache.data &&
            storedExpiresAt >
              Date.now()
          ) {
            saveToDeezerMemoryCache(
              cacheKey,
              storedCache.data,
              storedExpiresAt
            );

            console.log(
              `[DEEZER CACHE] FIRESTORE HIT ${normalizedPath}`
            );

            scheduleCatalogPersistence(
              normalizedPath,
              storedCache.data
            );

            return storedCache.data;
          }
        }
      } catch (
        cacheReadError
      ) {
        /*
         * A Firestore cache failure should not prevent
         * Deezer from being used.
         */
        console.warn(
          `[DEEZER CACHE] Firestore read failed for ${normalizedPath}:`,
          cacheReadError.message
        );
      }

      const url =
        `${DEEZER_API_BASE}${normalizedPath}`;

      /*
       * No valid cache was found.
       * Call Deezer.
       */
      try {
        console.log(
          `[DEEZER] GET ${url}`
        );

        const response =
          await fetch(
            url,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                "User-Agent":
                  "TrebleRelaunch/1.0",

                "Accept-Language":
                  "en-US,en;q=0.9",
              },

              redirect:
                "follow",
            }
          );

        /*
         * Read the body as text first.
         *
         * Deezer sometimes returns an HTML error page
         * instead of JSON.
         */
        const responseText =
          await response.text();

        let data = {};

        try {
          data = responseText
            ? JSON.parse(
                responseText
              )
            : {};
        } catch {
          throw new Error(
            `Deezer returned invalid JSON: ${responseText.slice(
              0,
              500
            )}`
          );
        }

        if (!response.ok) {
          throw new Error(
            `Deezer returned HTTP ${response.status}: ${responseText.slice(
              0,
              500
            )}`
          );
        }

        if (data?.error) {
          throw new Error(
            `Deezer API error: ${
              data.error.message ||
              "Unknown Deezer error"
            }`
          );
        }

        const expiresAt =
          Date.now() + ttl;

        /*
         * Save immediately to memory.
         */
        saveToDeezerMemoryCache(
          cacheKey,
          data,
          expiresAt
        );

        /*
         * Save persistently to Firestore.
         */
        try {
          await cacheRef.set(
            {
              path:
                normalizedPath,

              data,

              cachedAt:
                new Date(),

              expiresAt:
                new Date(
                  expiresAt
                ),

              ttl,
            },
            {
              merge: true,
            }
          );

          console.log(
            `[DEEZER CACHE] SAVED ${normalizedPath}`
          );
        } catch (
          cacheWriteError
        ) {
          /*
           * The request should still succeed if the
           * Firestore cache write fails.
           */
          console.warn(
            `[DEEZER CACHE] Firestore write failed for ${normalizedPath}:`,
            cacheWriteError.message
          );
        }

        scheduleCatalogPersistence(
          normalizedPath,
          data
        );

        return data;
      } catch (
        deezerError
      ) {
        /*
         * STALE CACHE FALLBACK
         *
         * When Deezer returns:
         *
         * - Quota limit exceeded
         * - HTTP 403
         * - HTTP 429
         * - Temporary network failure
         *
         * use previously cached data instead of breaking
         * the page.
         */
        if (staleData) {
          const temporaryExpiresAt =
            Date.now() +
            5 * 60 * 1000;

          saveToDeezerMemoryCache(
            cacheKey,
            staleData,
            temporaryExpiresAt
          );

          console.warn(
            `[DEEZER CACHE] USING STALE DATA ${normalizedPath}:`,
            deezerError.message
          );

          return staleData;
        }

        throw deezerError;
      }
    })();

  /*
   * Store the active Promise so duplicate requests share
   * the same Deezer or Firestore operation.
   */
  deezerRequestsInFlight.set(
    cacheKey,
    requestPromise
  );

  try {
    return await requestPromise;
  } finally {
    deezerRequestsInFlight.delete(
      cacheKey
    );
  }
}

function normalizeDeezerTrack(track) {
  const artistName = track.artist?.name || "Unknown Artist";

  const coverArt =
    track.album?.cover_xl ||
    track.album?.cover_big ||
    track.album?.cover_medium ||
    track.album?.cover ||
    "";

  return {
    id: String(track.id),
    listenableId: String(track.id),
    type: "track",

    title: track.title || track.title_short || "Unknown Track",
    name: track.title || track.title_short || "Unknown Track",

    artist: {
      id: String(track.artist?.id || ""),
      name: artistName,
      picture:
        track.artist?.picture_big ||
        track.artist?.picture_medium ||
        track.artist?.picture ||
        "",
    },

    artistName,

    album: {
      id: String(track.album?.id || ""),
      title: track.album?.title || "",
      cover: coverArt,
      coverArt,
      cover_small: track.album?.cover_small || coverArt,
      cover_medium: track.album?.cover_medium || coverArt,
      cover_big: track.album?.cover_big || coverArt,
      cover_xl: track.album?.cover_xl || coverArt,
    },

    image: coverArt,
    coverArt,

    preview: track.preview || "",
    previewUrl: track.preview || "",
    playbackUrl: track.preview || "",

    duration: Number(track.duration || 0),
    link: track.link || "",
  };
}

async function createFeedItem(
  track,
  source,
  userId,
  origin = null,
  likedTrackIds = null
) {
  const normalized =
    normalizeDeezerTrack(track);

  let liked = false;

  if (
    likedTrackIds instanceof Set
  ) {
    liked =
      likedTrackIds.has(
        normalized.id
      );
  } else if (userId) {
    const likeDoc = await db
      .collection("likes")
      .doc(
        `${userId}_track_${normalized.id}`
      )
      .get();

    liked = likeDoc.exists;
  }

  return {
    record_id:
      `deezer-${source}-${normalized.id}`,
    id: normalized.id,
    listenable_id:
      normalized.id,
    type: "track",
    liked,
    source,
    origin,

    item_info: {
      ...normalized,
      liked,
      origin,
    },

    title: normalized.title,
    name: normalized.name,
    artist: normalized.artist,
    album: normalized.album,
    image: normalized.image,
    coverArt:
      normalized.coverArt,
    preview:
      normalized.preview,
  };
}


/* =========================================================
   MUSIC SWIPE PLAYABLE TRACK SAFETY
   ========================================================= */

async function getPlayableRecommendationTrack(track) {
  if (!track || !track.id) {
    return null;
  }

  const existingPreview =
    track.preview ||
    track.previewUrl ||
    track.playbackUrl ||
    "";

  if (existingPreview) {
    return {
      ...track,
      preview: existingPreview,
    };
  }

  const trackId = String(track.id);

  try {
    const refreshed = await fetchDeezer(
      `/track/${encodeURIComponent(trackId)}`,
      { forceRefresh: true }
    );

    const refreshedPreview =
      refreshed?.preview ||
      refreshed?.previewUrl ||
      refreshed?.playbackUrl ||
      "";

    if (refreshedPreview) {
      return {
        ...track,
        ...refreshed,
        preview: refreshedPreview,
      };
    }
  } catch (error) {
    console.warn(
      `[Music Swipe] Unable to refresh preview for ${trackId}:`,
      error.message
    );
  }

  try {
    const snapshot = await db
      .collection(MUSIC_TRACKS_COLLECTION)
      .doc(trackId)
      .get();

    if (snapshot.exists) {
      const stored = snapshot.data();
      const storedPreview =
        stored.preview ||
        stored.previewUrl ||
        stored.playbackUrl ||
        stored.raw?.preview ||
        "";

      if (storedPreview) {
        return {
          ...(stored.raw ||
            permanentEntityToDeezerShape("track", stored)),
          preview: storedPreview,
        };
      }
    }
  } catch (error) {
    console.warn(
      `[Music Swipe] Catalog fallback failed for ${trackId}:`,
      error.message
    );
  }

  return null;
}

async function getPlayableCatalogFallbackTracks({
  limit,
  excludedTrackIds,
  usedTrackIds,
}) {
  try {
    const snapshot = await db
      .collection(MUSIC_TRACKS_COLLECTION)
      .limit(Math.max(limit * 20, 200))
      .get();

    const tracks = [];

    for (const document of snapshot.docs) {
      const data = document.data() || {};
      const trackId = String(data.id || document.id || "");
      const preview =
        data.preview ||
        data.previewUrl ||
        data.playbackUrl ||
        data.raw?.preview ||
        "";

      if (
        !trackId ||
        !preview ||
        excludedTrackIds.has(trackId) ||
        usedTrackIds.has(trackId)
      ) {
        continue;
      }

      const rawTrack =
        data.raw ||
        permanentEntityToDeezerShape("track", data);

      if (!rawTrack) {
        continue;
      }

      usedTrackIds.add(trackId);
      tracks.push({
        ...rawTrack,
        id: trackId,
        preview,
      });

      if (tracks.length >= limit) {
        break;
      }
    }

    return tracks;
  } catch (error) {
    console.warn(
      "[Music Swipe] Permanent catalog fallback unavailable:",
      error.message
    );
    return [];
  }
}


/* =========================================================
   TREBLE MUSIC SHARING
   ========================================================= */

const MUSIC_SHARES_COLLECTION = "musicShares";

function shareTimestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeSharedItem(rawItem, itemId, type) {
  const raw = rawItem?.item_info || rawItem || {};
  const normalizedType = String(type || raw.type || "track").toLowerCase();
  const id = String(itemId || raw.id || raw.listenableId || raw.listenable_id || "");

  const artistName =
    typeof raw.artist === "string"
      ? raw.artist
      : raw.artist?.name || raw.artistName || "";

  const title = raw.title || raw.name ||
    (normalizedType === "artist" ? artistName : "Shared music");

  const image =
    raw.image || raw.coverArt || raw.picture_xl || raw.picture_big ||
    raw.picture || raw.cover_xl || raw.cover_big || raw.cover ||
    raw.album?.cover_xl || raw.album?.cover_big || raw.album?.cover_medium || "";

  return {
    ...raw,
    id,
    listenableId: id,
    listenable_id: id,
    type: normalizedType,
    title,
    name: raw.name || title,
    artist: raw.artist || (artistName ? { name: artistName } : null),
    artistName,
    image,
    coverArt: raw.coverArt || image,
    preview: raw.preview || raw.previewUrl || raw.playbackUrl || "",
    previewUrl: raw.previewUrl || raw.preview || raw.playbackUrl || "",
    playbackUrl: raw.playbackUrl || raw.preview || raw.previewUrl || "",
  };
}

async function hydrateSharedItem(itemData, itemId, type) {
  const normalizedType = String(type || "track").toLowerCase();

  if (itemData && typeof itemData === "object") {
    const normalized = normalizeSharedItem(itemData, itemId, normalizedType);
    if (normalized.id) return normalized;
  }

  if (normalizedType === "track") {
    const deezerTrack = await fetchDeezer(
      `/track/${encodeURIComponent(itemId)}`
    );
    return normalizeDeezerTrack(deezerTrack);
  }

  return normalizeSharedItem({}, itemId, normalizedType);
}

app.post("/users/share", async (req, res) => {
  try {
    const toUserId = String(req.body?.user_id || "").trim();
    const fromUserId = String(req.body?.share_by || "").trim();
    const itemId = String(req.body?.item_id || "").trim();
    const itemRid = req.body?.item_rid ? String(req.body.item_rid) : null;
    const type = String(req.body?.type || "track").trim().toLowerCase();
    const comment = String(req.body?.comment || "").trim().slice(0, 500);

    if (!toUserId || !fromUserId || !itemId) {
      return res.status(400).json({
        ok: false,
        error: "user_id, share_by, and item_id are required.",
      });
    }

    if (toUserId === fromUserId) {
      return res.status(400).json({
        ok: false,
        error: "You cannot share music with yourself.",
      });
    }

    const [senderSnapshot, receiverSnapshot] = await Promise.all([
      db.collection("users").doc(fromUserId).get(),
      db.collection("users").doc(toUserId).get(),
    ]);

    if (!senderSnapshot.exists || !receiverSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "The sender or receiving friend could not be found.",
      });
    }

    const item = await hydrateSharedItem(
      req.body?.item_data,
      itemId,
      type
    );

    const senderData = senderSnapshot.data() || {};
    const shareRef = db.collection(MUSIC_SHARES_COLLECTION).doc();

    const sender = {
      userId: fromUserId,
      uid: fromUserId,
      username:
        senderData.username || senderData.displayName ||
        senderData.email?.split("@")[0] || "Treble User",
      displayName: senderData.displayName || senderData.username || "",
      avatar:
        senderData.avatar || senderData.avatarLong ||
        senderData.profilePicture || senderData.photoURL || "None",
    };

    await shareRef.set({
      id: shareRef.id,
      shareId: shareRef.id,
      fromUserId,
      toUserId,
      itemId,
      itemRid,
      type,
      comment,
      item,
      sender,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createNotification({
      type: "music_share",
      fromUserId,
      toUserId,
      shareId: shareRef.id,
      targetId: itemId,
      itemId,
      itemType: type,
      itemData: item,
      songTitle: item.title || item.name || "Shared music",
      comment,
    });

    runGraphWrite(upsertGraphEdge({
      fromType: "user",
      fromId: fromUserId,
      relationship: "SHARED",
      toType: type === "track" ? "track" : type,
      toId: itemId,
      weight: 3,
      metadata: {
        toUserId,
        shareId: shareRef.id,
        comment,
      },
    }), "user-shared-track");

    runGraphWrite(upsertGraphEdge({
      fromType: "user",
      fromId: toUserId,
      relationship: "RECEIVED",
      toType: type === "track" ? "track" : type,
      toId: itemId,
      weight: 1,
      metadata: {
        fromUserId,
        shareId: shareRef.id,
      },
    }), "user-received-track");

    console.log(
      `[SHARE] ${fromUserId} shared ${type} ${itemId} with ${toUserId}`
    );

    return res.status(201).json({
      ok: true,
      shared: true,
      shareId: shareRef.id,
      item,
    });
  } catch (error) {
    console.error("POST /users/share error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unable to share this music.",
    });
  }
});

const SHARED_FEED_SEEN_COLLECTION =
  "sharedFeedSeen";

function getSharedSeenDocumentId(
  userId,
  shareId
) {
  return `${String(userId)}_${String(shareId)}`;
}

function markSharedItemsSeen(
  userId,
  items
) {
  if (
    !userId ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return;
  }

  setImmediate(async () => {
    try {
      const batch = db.batch();

      items.forEach((item) => {
        if (!item?.shareId) {
          return;
        }

        const seenRef = db
          .collection(
            SHARED_FEED_SEEN_COLLECTION
          )
          .doc(
            getSharedSeenDocumentId(
              userId,
              item.shareId
            )
          );

        batch.set(
          seenRef,
          {
            userId:
              String(userId),
            shareId:
              String(item.shareId),
            musicId:
              String(item.id || ""),
            seenAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      });

      await batch.commit();
    } catch (error) {
      console.warn(
        "[SHARE] Unable to mark shared feed items seen:",
        error.message
      );
    }
  });
}

async function getSharedFeedItems(
  userId,
  {
    limit = 20,
    offset = 0,
    likedTrackIds = null,
    excludeMusicIds = null,
    markSeen = true,
  } = {}
) {
  if (!userId) return [];

  /*
   * Fetch only the newest reasonable share window.
   * Previously every share ever received was downloaded,
   * sorted, hydrated, and checked on each feed load.
   */
  const snapshot = await db
    .collection(
      MUSIC_SHARES_COLLECTION
    )
    .where(
      "toUserId",
      "==",
      String(userId)
    )
    .orderBy(
      "createdAt",
      "desc"
    )
    .limit(
      Math.min(
        Math.max(
          limit + offset + 30,
          30
        ),
        100
      )
    )
    .get();

  const candidates =
    snapshot.docs.map(
      (document) => ({
        document,
        data:
          document.data() || {},
      })
    );

  if (
    candidates.length === 0
  ) {
    return [];
  }

  /*
   * Read all seen markers in one Firestore round trip.
   */
  const seenRefs =
    candidates.map(({ document }) =>
      db
        .collection(
          SHARED_FEED_SEEN_COLLECTION
        )
        .doc(
          getSharedSeenDocumentId(
            userId,
            document.id
          )
        )
    );

  const seenSnapshots =
    await db.getAll(...seenRefs);

  const seenShareIds =
    new Set(
      seenSnapshots
        .filter(
          (seenSnapshot) =>
            seenSnapshot.exists
        )
        .map(
          (seenSnapshot) =>
            String(
              seenSnapshot.data()
                ?.shareId || ""
            )
        )
    );

  const excludedIds =
    excludeMusicIds instanceof Set
      ? excludeMusicIds
      : new Set();

  const selected = [];
  const selectedMusicIds =
    new Set();

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const {
      document,
      data,
    } = candidates[index];

    const itemId =
      String(
        data.itemId ||
        data.item?.id ||
        ""
      );

    /*
     * Do not show:
     * - a share already returned before
     * - the same song twice in one response
     * - a song already selected elsewhere in this feed
     */
    if (
      seenShareIds.has(
        document.id
      ) ||
      !itemId ||
      selectedMusicIds.has(
        itemId
      ) ||
      excludedIds.has(
        itemId
      )
    ) {
      continue;
    }

    selected.push({
      document,
      data,
    });

    selectedMusicIds.add(
      itemId
    );

    if (
      selected.length >=
      offset + limit
    ) {
      break;
    }
  }

  const page =
    selected.slice(
      offset,
      offset + limit
    );

  const items =
    await Promise.all(
      page.map(
        async ({
          document,
          data,
        }) => {
          let item =
            data.item || null;

          if (
            !item &&
            data.itemId
          ) {
            try {
              item =
                await hydrateSharedItem(
                  null,
                  data.itemId,
                  data.type ||
                    "track"
                );
            } catch (error) {
              console.warn(
                `[SHARE] Unable to hydrate ${data.itemId}:`,
                error.message
              );
              return null;
            }
          }

          if (!item?.id) {
            return null;
          }

          const normalized =
            normalizeSharedItem(
              item,
              data.itemId,
              data.type ||
                item.type
            );

          const liked =
            likedTrackIds
              instanceof Set
              ? likedTrackIds.has(
                  normalized.id
                )
              : false;

          return {
            class: "share",
            source: "share",
            shareId:
              document.id,
            record_id:
              data.itemRid ||
              `shared-${document.id}`,
            id:
              normalized.id,
            listenable_id:
              normalized.id,
            type:
              normalized.type,
            liked,
            item_info: {
              ...normalized,
              liked,
            },
            title:
              normalized.title,
            name:
              normalized.name,
            artist:
              normalized.artist,
            album:
              normalized.album ||
              null,
            image:
              normalized.image,
            coverArt:
              normalized.coverArt,
            preview:
              normalized.preview,
            comment:
              data.comment || "",
            createdAt:
              shareTimestampToIso(
                data.createdAt
              ),
            shared_by:
              data.sender || {
                userId:
                  data.fromUserId,
                uid:
                  data.fromUserId,
                username:
                  "A friend",
                avatar:
                  "None",
              },
          };
        }
      )
    );

  const validItems =
    items.filter(Boolean);

  if (markSeen) {
    markSharedItemsSeen(
      userId,
      validItems
    );
  }

  return validItems;
}

app.get("/users/share", async (req, res) => {
  try {
    const userId =
      String(
        req.query.user_id ||
        ""
      ).trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        sharedItems: [],
        error:
          "user_id is required.",
      });
    }

    const {
      limit,
      offset,
    } = getPagination(req);

    const likedTrackIds =
      new Set(
        await getUserLikedTrackIds(
          userId
        )
      );

    const sharedItems =
      await getSharedFeedItems(
        userId,
        {
          limit,
          offset,
          likedTrackIds,
          markSeen: true,
        }
      );

    return res.json({
      ok: true,
      sharedItems,
    });
  } catch (error) {
    console.error(
      "GET /users/share error:",
      error
    );

    return res.status(500).json({
      ok: false,
      sharedItems: [],
      error:
        error.message,
    });
  }
});

function getPagination(req, defaultLimit = 20) {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const parsedOffset = Number.parseInt(req.query.offset, 10);

  return {
    limit: Math.min(
      Math.max(Number.isNaN(parsedLimit) ? defaultLimit : parsedLimit, 1),
      50
    ),
    offset: Math.max(
      Number.isNaN(parsedOffset) ? 0 : parsedOffset,
      0
    ),
  };
}

function shuffleArray(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

async function getUserLikedTrackIds(userId) {
  const snapshot = await db
    .collection("likes")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map((document) => document.data())
    .filter((item) => {
      return (
        String(item.type || "track") === "track" &&
        item.musicId
      );
    })
    .sort((a, b) => {
      const firstTime =
        a.createdAt?.toMillis?.() || 0;

      const secondTime =
        b.createdAt?.toMillis?.() || 0;

      return secondTime - firstTime;
    })
    .map((item) => String(item.musicId));
}

const FEED_COOLDOWN_HOURS = 6;

async function getRecentlyServedTrackIds(userId) {
  if (!userId) {
    return new Set();
  }

  const cooldownStart = new Date(
    Date.now() -
      FEED_COOLDOWN_HOURS *
        60 *
        60 *
        1000
  );

  const snapshot = await db
    .collection("feedServed")
    .where("userId", "==", userId)
    .get();

  const recentlyServedIds = new Set();

  snapshot.docs.forEach((document) => {
    const data = document.data();

    const servedDate =
      data.servedAt?.toDate?.() ||
      null;

    if (
      data.musicId &&
      servedDate &&
      servedDate >= cooldownStart
    ) {
      recentlyServedIds.add(
        String(data.musicId)
      );
    }
  });

  return recentlyServedIds;
}

async function markFeedItemsServed(
  userId,
  items,
  source
) {
  if (
    !userId ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return;
  }

  const batch = db.batch();

  items.forEach((item) => {
    const musicId = String(
      item.id ||
      item.listenableId ||
      item.listenable_id ||
      item.item_info?.id ||
      ""
    );

    if (!musicId) {
      return;
    }

    const documentId =
      `${userId}_track_${musicId}`;

    const documentRef = db
      .collection("feedServed")
      .doc(documentId);

    batch.set(
      documentRef,
      {
        userId,
        musicId,
        type: "track",
        source,
        servedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  });

  await batch.commit();
}

async function getUserReviewSeeds(userId) {
  const snapshot = await db
    .collection("reviews")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map((document) => document.data())
    .filter((review) => {
      const rating = Number(review.rating || 0);

      return (
        String(review.type || "track") === "track" &&
        review.listenableId &&
        (
          review.hearted === true ||
          rating >= 4
        )
      );
    })
    .sort((a, b) => {
      /*
       * Favourite reviews first, then highest rating,
       * then newest review.
       */
      if (Boolean(b.hearted) !== Boolean(a.hearted)) {
        return Number(Boolean(b.hearted)) -
          Number(Boolean(a.hearted));
      }

      if (
        Number(b.rating || 0) !==
        Number(a.rating || 0)
      ) {
        return Number(b.rating || 0) -
          Number(a.rating || 0);
      }

      const firstTime =
        a.updatedAt?.toMillis?.() ||
        a.createdAt?.toMillis?.() ||
        0;

      const secondTime =
        b.updatedAt?.toMillis?.() ||
        b.createdAt?.toMillis?.() ||
        0;

      return secondTime - firstTime;
    })
    .map((review) => ({
      trackId: String(review.listenableId),
      reason: review.hearted
        ? "favourite"
        : "high-rating",
      rating: Number(review.rating || 0),
    }));
}

async function getStoredRecommendationSeeds(userId) {
  const snapshot = await db
    .collection("recommendationSeeds")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map((document) => document.data())
    .filter((seed) => seed.musicId)
    .sort((a, b) => {
      const firstTime =
        a.updatedAt?.toMillis?.() ||
        a.createdAt?.toMillis?.() ||
        0;

      const secondTime =
        b.updatedAt?.toMillis?.() ||
        b.createdAt?.toMillis?.() ||
        0;

      return secondTime - firstTime;
    });
}

async function getTrackSafely(trackId) {
  try {
    return await fetchDeezer(
      `/track/${encodeURIComponent(trackId)}`
    );
  } catch (error) {
    console.warn(
      `[Recommendations] Unable to load seed track ${trackId}:`,
      error.message
    );

    return null;
  }
}

async function getRecommendationSeedTracks(userId) {
  const [
    likedTrackIds,
    reviewSeeds,
    storedSeeds,
  ] = await Promise.all([
    getUserLikedTrackIds(userId),
    getUserReviewSeeds(userId),
    getStoredRecommendationSeeds(userId),
  ]);

  const combinedSeeds = [];

  /*
   * Explicit recommendation seeds are added whenever the
   * frontend calls POST /users/recommendations.
   */
  storedSeeds.forEach((seed) => {
    combinedSeeds.push({
      trackId: String(seed.musicId),
      reason: seed.reason || "like",
      savedName: seed.name || "",
      savedArtistName: seed.artistName || "",
    });
  });

  /*
   * Favourites and 4/5-star reviews get extra influence.
   */
  reviewSeeds.forEach((seed) => {
    combinedSeeds.push(seed);

    if (seed.reason === "favourite") {
      combinedSeeds.push(seed);
    }

    if (seed.rating === 5) {
      combinedSeeds.push(seed);
    }
  });

  likedTrackIds.forEach((trackId) => {
    combinedSeeds.push({
      trackId,
      reason: "like",
    });
  });

  const uniqueSeeds = [];
  const usedTrackIds = new Set();

  for (const seed of combinedSeeds) {
    if (
      !seed.trackId ||
      usedTrackIds.has(seed.trackId)
    ) {
      continue;
    }

    usedTrackIds.add(seed.trackId);
    uniqueSeeds.push(seed);
  }

  const selectedSeeds = uniqueSeeds.slice(0, 8);

  const seedTracks = await Promise.all(
    selectedSeeds.map(async (seed) => {
      const track = await getTrackSafely(
        seed.trackId
      );

      if (!track) {
        return null;
      }

      return {
        ...seed,
        track,
      };
    })
  );

  return seedTracks.filter(Boolean);
}

async function getTracksFromSeed(seed, limit = 12) {
  const seedTrack = seed.track;
  const artistId = seedTrack.artist?.id;

  if (!artistId) {
    return [];
  }

  try {
    /*
     * Deezer's artist top tracks provide songs related
     * to the user's liked/favourited/rated artist.
     */
    const result = await fetchDeezer(
      `/artist/${encodeURIComponent(
        artistId
      )}/top?limit=${limit}`
    );

    return (result.data || []).map((track) => ({
      track,
      origin: {
        type: seed.reason || "like",
        id: String(seedTrack.id),
        title:
          seedTrack.title ||
          seedTrack.title_short ||
          seed.savedName ||
          "a song you liked",
        artist:
          seedTrack.artist?.name ||
          seed.savedArtistName ||
          "an artist you like",
      },
    }));
  } catch (error) {
    console.warn(
      `[Recommendations] Unable to load tracks for artist ${artistId}:`,
      error.message
    );

    return [];
  }
}

async function getRadioTracksFromSeed(seed, limit = 12) {
  const seedTrack = seed.track || {};
  const artistId = seedTrack.artist?.id;

  if (!artistId) return [];

  try {
    const result = await fetchDeezer(
      `/artist/${encodeURIComponent(artistId)}/radio?limit=${limit}`
    );

    return (result.data || []).map((track) => ({
      track,
      score: 6,
      origin: {
        type: "similar",
        id: String(seedTrack.id || ""),
        title:
          seedTrack.title ||
          seedTrack.title_short ||
          seed.savedName ||
          "music you enjoy",
        artist:
          seedTrack.artist?.name ||
          seed.savedArtistName ||
          "",
      },
    }));
  } catch (error) {
    console.warn(
      `[Recommendations] Unable to load artist radio for ${artistId}:`,
      error.message
    );
    return [];
  }
}

function recommendationOriginPriority(origin) {
  return ({
    friends: 100,
    favourite: 90,
    "high-rating": 85,
    similar: 75,
    like: 70,
    genre: 65,
    discovery: 30,
  })[String(origin?.type || "discovery")] || 20;
}

function diversifyRecommendationCandidates(
  candidates,
  { limit, excludedTrackIds }
) {
  const buckets = new Map();
  const uniqueIds = new Set();

  for (const candidate of candidates) {
    const trackId = String(candidate?.track?.id || "");

    if (
      !trackId ||
      excludedTrackIds.has(trackId) ||
      uniqueIds.has(trackId)
    ) {
      continue;
    }

    uniqueIds.add(trackId);

    const type = String(candidate.origin?.type || "discovery");

    if (!buckets.has(type)) buckets.set(type, []);

    buckets.get(type).push({
      ...candidate,
      score:
        Number(candidate.score || candidate.origin?.score || 0) +
        recommendationOriginPriority(candidate.origin),
    });
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => b.score - a.score);
  }

  const order = [
    "friends",
    "similar",
    "favourite",
    "high-rating",
    "like",
    "genre",
    "discovery",
  ];

  const output = [];
  const artistCounts = new Map();
  const albumCounts = new Map();
  let madeProgress = true;

  while (output.length < limit && madeProgress) {
    madeProgress = false;

    for (const type of order) {
      const bucket = buckets.get(type) || [];

      while (bucket.length > 0) {
        const candidate = bucket.shift();
        const artistId = String(
          candidate.track?.artist?.id ||
          candidate.track?.artist?.name ||
          ""
        );
        const albumId = String(candidate.track?.album?.id || "");

        if (
          (artistId && (artistCounts.get(artistId) || 0) >= 2) ||
          (albumId && (albumCounts.get(albumId) || 0) >= 1)
        ) {
          continue;
        }

        output.push(candidate);

        if (artistId) {
          artistCounts.set(
            artistId,
            (artistCounts.get(artistId) || 0) + 1
          );
        }

        if (albumId) {
          albumCounts.set(
            albumId,
            (albumCounts.get(albumId) || 0) + 1
          );
        }

        madeProgress = true;
        break;
      }

      if (output.length >= limit) break;
    }
  }

  return output;
}


async function buildPersonalizedRecommendations({
  userId,
  limit,
  offset,
  refresh,
}) {
  const [
    likedTrackIdList,
    recentlyServedTrackIds,
    seedTracks,
  ] = await Promise.all([
    getUserLikedTrackIds(userId),
    getRecentlyServedTrackIds(userId),
    getRecommendationSeedTracks(userId),
  ]);

  const likedTrackIds =
    new Set(
      likedTrackIdList.map(String)
    );

  /*
   * Songs already served are excluded from normal recommendations.
   * Liked songs are always excluded and can never be returned.
   */
  const excludedTrackIds =
    new Set([
      ...likedTrackIds,
      ...recentlyServedTrackIds,
    ]);

  /*
   * Rotate through different taste seeds as the user scrolls.
   * The old code always used the same first six seeds.
   */
  const orderedSeeds =
    refresh
      ? shuffleArray(seedTracks)
      : seedTracks;

  const seedWindowSize =
    Math.min(
      6,
      orderedSeeds.length
    );

  const seedStart =
    orderedSeeds.length > 0
      ? Math.floor(
          offset /
          Math.max(limit, 1)
        ) %
        orderedSeeds.length
      : 0;

  const selectedSeeds = [];

  for (
    let index = 0;
    index < seedWindowSize;
    index += 1
  ) {
    selectedSeeds.push(
      orderedSeeds[
        (seedStart + index) %
          orderedSeeds.length
      ]
    );
  }

  const [
    friendCandidates,
    topTrackGroups,
    radioTrackGroups,
  ] = await Promise.all([
    getFriendCatalogRecommendations(
      userId,
      {
        limit:
          Math.max(
            limit * 3,
            30
          ),
        excludedTrackIds,
      }
    ),

    Promise.all(
      selectedSeeds.map(
        (seed) =>
          getTracksFromSeed(
            seed,
            15
          )
      )
    ),

    Promise.all(
      selectedSeeds.map(
        (seed) =>
          getRadioTracksFromSeed(
            seed,
            15
          )
      )
    ),
  ]);

  /*
   * Rotate discovery windows as pagination continues.
   * This avoids repeatedly requesting the same chart slice.
   */
  const pageNumber =
    Math.floor(
      offset /
      Math.max(limit, 1)
    );

  const discoveryIndex =
    refresh
      ? Math.floor(
          Math.random() * 700
        )
      : (
          25 +
          pageNumber * 67
        ) %
        850;

  const discovery =
    await fetchDeezer(
      `/chart/0/tracks?limit=${Math.max(
        limit * 8,
        80
      )}&index=${discoveryIndex}`
    );

  const allCandidates = [
    ...friendCandidates.map(
      (candidate) => ({
        ...candidate,
        score:
          Number(
            candidate.origin?.score ||
            0
          ) + 10,
      })
    ),

    ...radioTrackGroups.flat(),

    ...topTrackGroups
      .flat()
      .map((candidate) => ({
        ...candidate,
        score:
          candidate.origin?.type ===
          "favourite"
            ? 9
            : candidate.origin?.type ===
                "high-rating"
              ? 8
              : 6,
      })),

    ...(discovery.data || []).map(
      (track) => ({
        track,
        score: 1,
        origin: {
          type: "discovery",
          title:
            "Fresh discovery for your mix",
          artist: "",
        },
      })
    ),
  ];

  /*
   * IMPORTANT:
   * Do not slice by offset here. recentlyServedTrackIds already
   * removes previous pages. Slicing by offset a second time was
   * causing later pages to become empty.
   */
  let page =
    diversifyRecommendationCandidates(
      refresh
        ? shuffleArray(
            allCandidates
          )
        : allCandidates,
      {
        limit,
        excludedTrackIds,
      }
    ).slice(0, limit);

  /*
   * Keep searching different chart windows until the page is full.
   */
  const usedIds =
    new Set(
      page.map(
        (candidate) =>
          String(
            candidate.track?.id ||
            ""
          )
      )
    );

  const fallbackOffsets = [
    (
      discoveryIndex + 113
    ) % 900,
    (
      discoveryIndex + 277
    ) % 900,
    (
      discoveryIndex + 431
    ) % 900,
    Math.floor(
      Math.random() * 900
    ),
  ];

  for (
    const fallbackIndex of
      fallbackOffsets
  ) {
    if (page.length >= limit) {
      break;
    }

    const fill =
      await fetchDeezer(
        `/chart/0/tracks?limit=100&index=${fallbackIndex}`
      );

    for (
      const track of
        fill.data || []
    ) {
      const trackId =
        String(
          track.id || ""
        );

      if (
        !trackId ||
        likedTrackIds.has(
          trackId
        ) ||
        recentlyServedTrackIds.has(
          trackId
        ) ||
        usedIds.has(trackId)
      ) {
        continue;
      }

      usedIds.add(trackId);

      page.push({
        track,
        origin: {
          type: "discovery",
          title:
            "More music for your taste",
          artist: "",
        },
      });

      if (
        page.length >= limit
      ) {
        break;
      }
    }
  }

  /*
   * Absolute safety fallback:
   * If the user's unseen pool is temporarily exhausted, permit an
   * older recommendation to return again, but NEVER a liked song.
   * Shared cards remain one-time only through sharedFeedSeen.
   */
  if (page.length < limit) {
    const relaxed =
      await fetchDeezer(
        `/chart/0/tracks?limit=100&index=${
          Math.floor(
            Math.random() * 900
          )
        }`
      );

    for (
      const track of
        relaxed.data || []
    ) {
      const trackId =
        String(
          track.id || ""
        );

      if (
        !trackId ||
        likedTrackIds.has(
          trackId
        ) ||
        usedIds.has(trackId)
      ) {
        continue;
      }

      usedIds.add(trackId);

      page.push({
        track,
        origin: {
          type: "genre",
          title:
            "Another pick from your music world",
          artist: "",
        },
      });

      if (
        page.length >= limit
      ) {
        break;
      }
    }
  }

  /*
   * Hydrate every card before returning it. Music Swipe should never
   * receive a card without a usable preview URL.
   */
  const playablePage = [];
  const playableIds = new Set();

  for (const candidate of page) {
    const playableTrack =
      await getPlayableRecommendationTrack(
        candidate.track
      );

    const trackId = String(
      playableTrack?.id || ""
    );

    if (
      !playableTrack ||
      !trackId ||
      likedTrackIds.has(trackId) ||
      playableIds.has(trackId)
    ) {
      continue;
    }

    playableIds.add(trackId);
    playablePage.push({
      ...candidate,
      track: playableTrack,
    });

    if (playablePage.length >= limit) {
      break;
    }
  }

  if (playablePage.length < limit) {
    const catalogTracks =
      await getPlayableCatalogFallbackTracks({
        limit: limit - playablePage.length,
        excludedTrackIds: likedTrackIds,
        usedTrackIds: playableIds,
      });

    catalogTracks.forEach((track) => {
      playablePage.push({
        track,
        origin: {
          type: "discovery",
          title: "A playable pick from the Treble catalog",
          artist: "",
        },
      });
    });
  }

  const recommendations =
    await Promise.all(
      playablePage.map(
        ({ track, origin }) =>
          createFeedItem(
            track,
            origin?.type === "friends"
              ? "friend-recommendation"
              : "recommendation",
            userId,
            origin,
            likedTrackIds
          )
      )
    );

  const safeRecommendations =
    recommendations.filter((item) => {
      const trackId = String(
        item.id ||
        item.listenable_id ||
        ""
      );

      const preview =
        item.preview ||
        item.item_info?.preview ||
        item.item_info?.previewUrl ||
        item.item_info?.playbackUrl ||
        "";

      return (
        trackId &&
        preview &&
        !likedTrackIds.has(trackId)
      );
    });

  /*
   * IMPORTANT: Do not mark these as served here. Merely opening or
   * refreshing Music Swipe must not consume the user's recommendations.
   * The frontend marks a card served only after the user swipes it.
   */
  return safeRecommendations;
}

app.get("/test", (req, res) => {
  res.json({
    ok: true,
    message: "Treble backend is running",
  });
});

app.post("/users", async (req, res) => {
  try {
    const userData = req.body;
    const uid = userData.uid || userData.user_id || userData.id;

    if (!uid) {
      return res.status(400).json({
        ok: false,
        error: "Firebase UID is required.",
      });
    }

    await db.collection("users").doc(uid).set(
      {
        ...userData,
        uid,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(201).json({
      ok: true,
      uid,
    });
  } catch (error) {
    console.error("POST /users error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/timeline", async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);
    const userId = String(req.query.user_id || "").trim();
    const refresh =
      String(req.query.refresh || "false") === "true";

    if (!userId) {
      return res.status(400).json({
        ok: false,
        timeline: [],
        error: "user_id is required.",
      });
    }

    const likedTrackIds = new Set(
      (await getUserLikedTrackIds(userId)).map(String)
    );

    const [
      sharedTimelineItems,
      personalizedItems,
    ] = await Promise.all([
      getSharedFeedItems(userId, {
        limit: Math.min(3, limit),
        offset: 0,
        likedTrackIds,
        excludeMusicIds: likedTrackIds,
        markSeen: true,
      }).catch((error) => {
        console.warn(
          "[Timeline] Shared activity unavailable; continuing with recommendations:",
          error.message
        );

        return [];
      }),

      buildPersonalizedRecommendations({
        userId,
        limit: limit + 6,
        offset,
        refresh,
      }),
    ]);

    const timeline = [];
    const usedIds = new Set();

    const addItem = (item) => {
      const trackId = String(
        item?.id ||
        item?.listenable_id ||
        item?.item_info?.id ||
        ""
      );

      if (
        !trackId ||
        likedTrackIds.has(trackId) ||
        usedIds.has(trackId)
      ) {
        return;
      }

      usedIds.add(trackId);
      timeline.push(item);
    };

    const maxLength = Math.max(
      sharedTimelineItems.length,
      personalizedItems.length
    );

    for (let index = 0; index < maxLength; index += 1) {
      if (personalizedItems[index]) {
        addItem(personalizedItems[index]);
      }

      if (index < 3 && sharedTimelineItems[index]) {
        addItem(sharedTimelineItems[index]);
      }

      if (timeline.length >= limit) break;
    }

    /*
     * Timeline should always return cards when music is available.
     */
    const finalTimeline =
      timeline.slice(0, limit);

    return res.status(200).json({
      ok: true,
      timeline: finalTimeline,
      limit,
      offset,
      refresh,
      personalized: true,
      hasMore: true,
    });
  } catch (error) {
    console.error("GET /users/timeline error:", error);

    return res.status(502).json({
      ok: false,
      timeline: [],
      error: error.message,
    });
  }
});

app.get("/users/recommendations", async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);

    const userId = String(
      req.query.user_id || ""
    ).trim();

    const refresh =
      String(req.query.refresh || "false") ===
      "true";

    if (!userId) {
      return res.status(400).json({
        ok: false,
        recommendations: [],
        error: "user_id is required.",
      });
    }

    const recommendations =
      await buildPersonalizedRecommendations({
        userId,
        limit,
        offset,
        refresh,
      });

    return res.json({
      ok: true,
      recommendations,
      limit,
      offset,
      personalized: true,
      hasMore: true,
    });
  } catch (error) {
    console.error(
      "GET /users/recommendations error:",
      error
    );

    return res.status(502).json({
      ok: false,
      recommendations: [],
      error: error.message,
    });
  }
});

app.post("/users/recommendations", async (req, res) => {
  try {
    const {
      user_id,
      music_id,
      type = "track",
      name = "",
      artist_name = "",
      reason = "like",
    } = req.body || {};

    const userId = String(user_id || "").trim();
    const musicId = String(music_id || "").trim();
    const musicType = String(type || "track");

    if (!userId || !musicId) {
      return res.status(400).json({
        ok: false,
        error:
          "user_id and music_id are required.",
      });
    }

    const seedId =
      `${userId}_${musicType}_${musicId}`;

    await db
      .collection("recommendationSeeds")
      .doc(seedId)
      .set(
        {
          userId,
          musicId,
          type: musicType,
          name: String(name || ""),
          artistName: String(
            artist_name || ""
          ),
          reason: String(reason || "like"),
          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

    return res.status(201).json({
      ok: true,
      saved: true,
      musicId,
      type: musicType,
    });
  } catch (error) {
    console.error(
      "POST /users/recommendations error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/search/getSongFromDeezer", async (req, res) => {
  try {
    const trackId =
      req.query.listenable_id ||
      req.query.track_id ||
      req.query.id;

    if (!trackId) {
      return res.status(400).json({
        ok: false,
        error: "A Deezer track ID is required.",
      });
    }

    const refreshRequested =
      String(
        req.query.refresh ||
        req.query.force_refresh ||
        ""
      ).toLowerCase() === "true";

    /*
     * Always try Treble's memory, permanent catalog, and Firestore
     * cache first. The mobile app previously sent refresh=true on
     * every playback request, which bypassed all caches and consumed
     * the Deezer quota.
     */
    let track = await fetchDeezer(
      `/track/${encodeURIComponent(trackId)}`,
      {
        forceRefresh: false,
        ttl: DEEZER_CACHE_TTL.track,
      }
    );

    let previewRefreshed = false;

    const cachedPreview =
      track?.preview ||
      track?.previewUrl ||
      track?.playbackUrl ||
      "";

    /*
     * Only perform a true Deezer refresh when the cached record has
     * no playable preview. A normal refresh=true request no longer
     * forces a network call when Treble already has a preview.
     */
    const forceRefreshRequested =
      String(req.query.force_refresh || "").toLowerCase() === "true";

    /*
     * A play failure usually means an existing Deezer preview URL has
     * expired. force_refresh=true must bypass every cache and obtain a
     * new preview URL. Normal refresh=true remains cache-friendly and
     * only refreshes records that have no preview.
     */
    if (forceRefreshRequested || (refreshRequested && !cachedPreview)) {
      track = await fetchDeezer(
        `/track/${encodeURIComponent(trackId)}`,
        {
          forceRefresh: true,
          ttl: DEEZER_CACHE_TTL.track,
        }
      );

      previewRefreshed = true;
    }

    return res.json({
      ...normalizeDeezerTrack(track),
      previewRefreshed,
      servedFromTrebleCache:
        !previewRefreshed,
    });
  } catch (error) {
    console.error("GET /search/getSongFromDeezer error:", error);

    return res.status(502).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/top-songs/reviews", async (req, res) => {
  try {
    const chart = await fetchDeezer("/chart/0/tracks?limit=10");

    const topSongsByReviews = (chart.data || []).map((track, index) => {
      const normalized = normalizeDeezerTrack(track);

      return {
        listenableId: normalized.id,
        title: normalized.title,
        reviewCount: Math.max(1, 10 - index),
        artist: normalized.artist.name,
        coverArt: normalized.coverArt,
        playbackUrl: normalized.preview,
        track: normalized,
      };
    });

    return res.json({
      ok: true,
      topSongsByReviews,
    });
  } catch (error) {
    console.error("GET /users/top-songs/reviews error:", error);

    return res.status(502).json({
      ok: false,
      topSongsByReviews: [],
      error: error.message,
    });
  }
});

app.get("/users/top-songs/likes", async (req, res) => {
  try {
    const chart = await fetchDeezer(
      "/chart/0/tracks?limit=10&index=10"
    );

    const topSongsByLikes = (chart.data || []).map((track, index) => {
      const normalized = normalizeDeezerTrack(track);

      return {
        listenableId: normalized.id,
        title: normalized.title,
        likes: Math.max(1, 20 - index),
        artist: normalized.artist.name,
        coverArt: normalized.coverArt,
        playbackUrl: normalized.preview,
        track: normalized,
      };
    });

    return res.json({
      ok: true,
      topSongsByLikes,
    });
  } catch (error) {
    console.error("GET /users/top-songs/likes error:", error);

    return res.status(502).json({
      ok: false,
      topSongsByLikes: [],
      error: error.message,
    });
  }
});

app.get("/users/recommended-songs", async (req, res) => {
  try {
    const chart = await fetchDeezer(
      "/chart/0/tracks?limit=10&index=30"
    );

    const recommendedSongs = (chart.data || []).map((track) => {
      const normalized = normalizeDeezerTrack(track);

      return {
        listenableId: normalized.id,
        title: normalized.title,
        artist: normalized.artist,
        coverArt: normalized.coverArt,
        playbackUrl: normalized.preview,
        track: normalized,
      };
    });

    return res.json({
      ok: true,
      recommendedSongs,
    });
  } catch (error) {
    console.error("GET /users/recommended-songs error:", error);

    return res.status(502).json({
      ok: false,
      recommendedSongs: [],
      error: error.message,
    });
  }
});

app.post("/users/like", async (req, res) => {
  try {
    const {
      user_id,
      music_id,
      type = "track",
      name = "",
      artist_name = "",
    } = req.body || {};

    if (!user_id || !music_id) {
      return res.status(400).json({
        ok: false,
        error: "user_id and music_id are required.",
      });
    }

    const likeId = `${user_id}_${type}_${music_id}`;

    await db.collection("likes").doc(likeId).set(
      {
        userId: user_id,
        musicId: String(music_id),
        type,
        name: String(name || ""),
        artistName: String(artist_name || ""),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    runGraphWrite(upsertGraphEdge({
      fromType: "user",
      fromId: String(user_id),
      relationship: "LIKED",
      toType:
        String(type || "track").toLowerCase() === "track"
          ? "track"
          : String(type || "track").toLowerCase(),
      toId: String(music_id),
      weight: 5,
      metadata: {
        name: String(name || ""),
        artistName:
          String(artist_name || ""),
      },
    }), "user-liked-track");

    return res.status(201).json({
      ok: true,
      liked: true,
      musicId: String(music_id),
      type,
      name: String(name || ""),
      artistName: String(artist_name || ""),
    });
  } catch (error) {
    console.error("POST /users/like error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/users/unlike", async (req, res) => {
  try {
    const { user_id, music_id, type = "track" } = req.body || {};

    if (!user_id || !music_id) {
      return res.status(400).json({
        ok: false,
        error: "user_id and music_id are required.",
      });
    }

    const likeId = `${user_id}_${type}_${music_id}`;

    await db.collection("likes").doc(likeId).delete();

    runGraphWrite(deleteGraphEdge({
      fromType: "user",
      fromId: String(user_id),
      relationship: "LIKED",
      toType:
        String(type || "track").toLowerCase() === "track"
          ? "track"
          : String(type || "track").toLowerCase(),
      toId: String(music_id),
    }), "user-liked-track");

    return res.status(200).json({
      ok: true,
      liked: false,
      musicId: String(music_id),
      type: String(type).toLowerCase(),
    });
  } catch (error) {
    console.error("POST /users/unlike error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/like", async (req, res) => {
  try {
    const userId = String(
      req.query.user_id || ""
    ).trim();

    const musicId = String(
      req.query.music_id || ""
    ).trim();

    const type = String(
      req.query.type || "track"
    )
      .trim()
      .toLowerCase();

    if (!userId || !musicId) {
      return res.status(400).json({
        ok: false,
        liked: false,
        error:
          "user_id and music_id are required.",
      });
    }

    const likeId =
      `${userId}_${type}_${musicId}`;

    const snapshot = await db
      .collection("likes")
      .doc(likeId)
      .get();

    return res.status(200).json({
      ok: true,
      liked: snapshot.exists,
      likeId: snapshot.exists
        ? snapshot.id
        : null,
      musicId,
      type,
    });
  } catch (error) {
    console.error(
      "GET /users/like error:",
      error
    );

    return res.status(500).json({
      ok: false,
      liked: false,
      error: error.message,
    });
  }
});

app.get("/search", async (req, res) => {
  try {
    const input = String(req.query.input || "").trim();

    const requestedTypes = String(
      req.query.type || "album,track,artist,user"
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const parsedLimit = Number.parseInt(req.query.limit, 10);

    const limit = Math.min(
      Math.max(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 1),
      25
    );

    const emptyResponse = {
      ok: true,
      tracks: [],
      albums: [],
      artists: [],
      users: [],
      searchResult: [],
      results: [],
    };

    if (!input) {
      return res.json(emptyResponse);
    }

    const encodedInput = encodeURIComponent(input);

    const [trackResult, albumResult, artistResult] = await Promise.all([
      requestedTypes.includes("track")
        ? fetchDeezer(
            `/search/track?q=${encodedInput}&limit=${limit}`
          )
        : Promise.resolve({ data: [] }),

      requestedTypes.includes("album")
        ? fetchDeezer(
            `/search/album?q=${encodedInput}&limit=${limit}`
          )
        : Promise.resolve({ data: [] }),

      requestedTypes.includes("artist")
        ? fetchDeezer(
            `/search/artist?q=${encodedInput}&limit=${limit}`
          )
        : Promise.resolve({ data: [] }),
    ]);

    const tracks = (trackResult.data || []).map((track) => {
      const normalized = normalizeDeezerTrack(track);

      return {
        ...normalized,
        type: "track",
        item_info: normalized,

        // Compatibility with older search components.
        image: normalized.coverArt,
        artist:
          normalized.artist?.name ||
          normalized.artistName ||
          "Unknown Artist",
        artistObject: normalized.artist,
        albumName: normalized.album?.title || "",
      };
    });

    const albums = (albumResult.data || []).map((album) => {
      const image =
        album.cover_xl ||
        album.cover_big ||
        album.cover_medium ||
        album.cover ||
        "";

      return {
        id: String(album.id),
        listenableId: String(album.id),
        type: "album",
        name: album.title || "",
        title: album.title || "",
        image,
        cover: image,
        coverArt: image,
        artist:
          album.artist?.name ||
          "Unknown Artist",
        artistObject: album.artist || null,
        album: album.title || "",
        record_type: album.record_type || "",
        link: album.link || "",
      };
    });

    const artists = (artistResult.data || []).map((artist) => {
      const image =
        artist.picture_xl ||
        artist.picture_big ||
        artist.picture_medium ||
        artist.picture ||
        "";

      return {
        id: String(artist.id),
        listenableId: String(artist.id),
        type: "artist",
        name: artist.name || "",
        title: artist.name || "",
        image,
        picture: image,
        coverArt: image,
        artist: artist.name || "",
        link: artist.link || "",
      };
    });

    let users = [];

    if (requestedTypes.includes("user")) {
      const normalizedInput = input.toLowerCase();

      const userSnapshot = await db
        .collection("users")
        .limit(100)
        .get();

      users = userSnapshot.docs
        .map((document) => {
          const data = document.data();

          return {
            uid: document.id,
            id: document.id,
            rid: data.rid || document.id,
            type: "user",
            username: data.username || "",
            displayName: data.displayName || "",
            email: data.email || "",
            avatar: data.avatar || "None",

            // Compatibility with MusicCard/Search rendering.
            name:
              data.username ||
              data.displayName ||
              data.email ||
              "Treble User",
            title:
              data.username ||
              data.displayName ||
              data.email ||
              "Treble User",
            image:
              data.avatar && data.avatar !== "None"
                ? data.avatar
                : "",
          };
        })
        .filter((user) => {
          const username = user.username.toLowerCase();
          const displayName = user.displayName.toLowerCase();
          const email = user.email.toLowerCase();

          return (
            username.includes(normalizedInput) ||
            displayName.includes(normalizedInput) ||
            email.includes(normalizedInput)
          );
        })
        .slice(0, limit);
    }

    /*
     * The old Search screen expects data.searchResult to be an array.
     * Keep separate arrays too, so newer screens can use categories.
     */
    const searchResult = [
      ...tracks,
      ...albums,
      ...artists,
      ...users,
    ];

    return res.json({
      ok: true,
      tracks,
      albums,
      artists,
      users,
      searchResult,
      results: searchResult,
    });
  } catch (error) {
    console.error("GET /search error:", error);

    return res.status(502).json({
      ok: false,
      tracks: [],
      albums: [],
      artists: [],
      users: [],
      searchResult: [],
      results: [],
      error: error.message,
    });
  }
});

async function verifyFirebaseUser(req) {
  const idToken =
    req.body?.id_token ||
    req.query?.id_token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!idToken) {
    throw new Error("Firebase ID token is required.");
  }

  return getAuth().verifyIdToken(idToken);
}

function serializeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return value;
}

function formatReview(document, currentUid = null) {
  const data = document.data();

  const upvotedBy = Array.isArray(data.upvotedBy)
    ? data.upvotedBy
    : [];

  return {
    id: document.id,

    userId: data.userId || "",
    username: data.username || "Treble User",

    listenable_id: String(data.listenableId || ""),
    listenableId: String(data.listenableId || ""),
    type: data.type || "track",

    text: data.message || "",
    message: data.message || "",

    rating: Number(data.rating || 0),
    hearted: Boolean(data.hearted),

    userSelectedEmojis: Array.isArray(data.emoji)
      ? data.emoji
      : [],

    emoji: Array.isArray(data.emoji)
      ? data.emoji
      : [],

    upvotes: upvotedBy.length,
    upvoted: currentUid
      ? upvotedBy.includes(currentUid)
      : false,

    isUser: currentUid
      ? data.userId === currentUid
      : false,

    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

app.post("/review", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const userId = decodedUser.uid;

    const {
      id,
      listenable_id,
      listenableId,
      type = "track",
      hearted = false,
      message = "",
      rating = 0,
      emoji = [],
    } = req.body || {};

    const musicId = listenable_id || listenableId;

    if (!musicId) {
      return res.status(400).json({
        ok: false,
        error: "listenable_id is required.",
      });
    }

    if (!String(message).trim()) {
      return res.status(400).json({
        ok: false,
        error: "Review message is required.",
      });
    }

    const userSnapshot = await db
      .collection("users")
      .doc(userId)
      .get();

    const userData = userSnapshot.exists
      ? userSnapshot.data()
      : {};

    const reviewId =
      String(id || "").trim() ||
      db.collection("reviews").doc().id;

    await db.collection("reviews").doc(reviewId).set({
      userId,
      username:
        userData.username ||
        decodedUser.name ||
        decodedUser.email?.split("@")[0] ||
        "Treble User",

      listenableId: String(musicId),
      type,

      message: String(message).trim(),
      rating: Math.min(Math.max(Number(rating) || 0, 0), 5),
      hearted: Boolean(hearted),
      emoji: Array.isArray(emoji) ? emoji : [],

      upvotedBy: [],

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    runGraphWrite(upsertGraphEdge({
      fromType: "user",
      fromId: userId,
      relationship: "REVIEWED",
      toType:
        String(type || "track").toLowerCase() === "track"
          ? "track"
          : String(type || "track").toLowerCase(),
      toId: String(musicId),
      weight:
        Boolean(hearted)
          ? 8
          : Math.max(
              1,
              Number(rating || 0)
            ),
      metadata: {
        reviewId,
        rating:
          Math.min(
            Math.max(
              Number(rating) || 0,
              0
            ),
            5
          ),
        hearted:
          Boolean(hearted),
      },
    }), "user-reviewed-track");

    return res.status(201).json({
      ok: true,
      id: reviewId,
    });
  } catch (error) {
    console.error("POST /review error:", error);

    return res.status(
      error.code?.startsWith("auth/") ? 401 : 500
    ).json({
      ok: false,
      error: error.message,
    });
  }
});

app.put("/review/update", async (req, res) => {
  try {
    const decodedUser =
      await verifyFirebaseUser(req);

    const userId = decodedUser.uid;

    const {
      rid,
      emoji = [],
      hearted = false,
      message = "",
      rating = 0,
    } = req.body || {};

    if (!rid) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    if (!String(message).trim()) {
      return res.status(400).json({
        ok: false,
        error: "Review message is required.",
      });
    }

    const reviewRef = db
      .collection("reviews")
      .doc(String(rid));

    const reviewSnapshot =
      await reviewRef.get();

    if (!reviewSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "Review not found.",
      });
    }

    const existingReview =
      reviewSnapshot.data();

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        ok: false,
        error:
          "You cannot update another user's review.",
      });
    }

    const updatedReview = {
      message: String(message).trim(),

      rating: Math.min(
        Math.max(
          Number(rating) || 0,
          0
        ),
        5
      ),

      hearted: Boolean(hearted),

      emoji: Array.isArray(emoji)
        ? emoji
        : [],

      updatedAt:
        FieldValue.serverTimestamp(),
    };

    await reviewRef.update(
      updatedReview
    );

    return res.status(200).json({
      ok: true,
      updated: true,
      id: reviewSnapshot.id,
      rid: reviewSnapshot.id,
    });
  } catch (error) {
    console.error(
      "PUT /review/update error:",
      error
    );

    return res.status(
      error.code?.startsWith("auth/")
        ? 401
        : 500
    ).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/review/reviews", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);

    const musicId =
      req.body?.listenable_id ||
      req.body?.listenableId;

    if (!musicId) {
      return res.status(400).json({
        ok: false,
        error: "listenable_id is required.",
      });
    }

    const snapshot = await db
      .collection("reviews")
      .where("listenableId", "==", String(musicId))
      .get();

    const reviews = snapshot.docs
      .map((document) =>
        formatReview(document, decodedUser.uid)
      )
      .sort((a, b) => {
        return new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0);
      });

    return res.json(reviews);
  } catch (error) {
    console.error("POST /review/reviews error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});


/* =========================================================
   REVIEW REPLIES
========================================================= */

function formatReviewReply(document, currentUserId) {
  const data = document.data() || {};

  return {
    id: document.id,
    reviewId: data.reviewId || "",
    userId: data.userId || "",
    username: data.username || "Treble User",
    avatar:
      data.avatar ||
      data.avatarLong ||
      data.profilePicture ||
      "",
    message: data.message || "",
    isUser:
      Boolean(currentUserId) &&
      data.userId === currentUserId,
    createdAt:
      data.createdAt?.toDate?.().toISOString?.() ||
      data.createdAt ||
      null,
    updatedAt:
      data.updatedAt?.toDate?.().toISOString?.() ||
      data.updatedAt ||
      null,
  };
}

async function getRepliesForReview(reviewId, currentUserId) {
  const snapshot = await db
    .collection("reviewReplies")
    .where("reviewId", "==", String(reviewId))
    .get();

  return snapshot.docs
    .map((document) =>
      formatReviewReply(document, currentUserId)
    )
    .sort((a, b) =>
      new Date(a.createdAt || 0) -
      new Date(b.createdAt || 0)
    );
}

app.post("/post/getPostsByReview", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const reviewId =
      req.body?.reviewId ||
      req.body?.review_id ||
      req.body?.rid;

    if (!reviewId) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    return res.json(
      await getRepliesForReview(
        reviewId,
        decodedUser.uid
      )
    );
  } catch (error) {
    console.error("POST /post/getPostsByReview error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

async function createReviewReply(req, res) {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const reviewId =
      req.body?.reviewId ||
      req.body?.review_id ||
      req.body?.rid;
    const message = String(
      req.body?.message ||
      req.body?.text ||
      ""
    ).trim();

    if (!reviewId || !message) {
      return res.status(400).json({
        ok: false,
        error: "Review ID and reply message are required.",
      });
    }

    const reviewSnapshot = await db
      .collection("reviews")
      .doc(String(reviewId))
      .get();

    if (!reviewSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "Review not found.",
      });
    }

    const userSnapshot = await db
      .collection("users")
      .doc(decodedUser.uid)
      .get();
    const userData = userSnapshot.exists
      ? userSnapshot.data()
      : {};

    const replyRef = db
      .collection("reviewReplies")
      .doc();

    await replyRef.set({
      reviewId: String(reviewId),
      userId: decodedUser.uid,
      username:
        userData.username ||
        decodedUser.name ||
        decodedUser.email?.split("@")[0] ||
        "Treble User",
      avatar:
        userData.avatar ||
        userData.avatarLong ||
        userData.profilePicture ||
        decodedUser.picture ||
        "",
      message,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      ok: true,
      id: replyRef.id,
    });
  } catch (error) {
    console.error("Create review reply error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

app.post("/post", createReviewReply);
app.post("/post/addPost", createReviewReply);
app.post("/review/reply", createReviewReply);

async function deleteReviewReply(req, res) {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const replyId =
      req.body?.id ||
      req.body?.postId ||
      req.body?.post_id ||
      req.body?.replyId ||
      req.query?.id;

    if (!replyId) {
      return res.status(400).json({
        ok: false,
        error: "Reply ID is required.",
      });
    }

    const replyRef = db
      .collection("reviewReplies")
      .doc(String(replyId));
    const snapshot = await replyRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "Reply not found.",
      });
    }

    if (snapshot.data().userId !== decodedUser.uid) {
      return res.status(403).json({
        ok: false,
        error: "You cannot delete another user's reply.",
      });
    }

    await replyRef.delete();

    return res.json({
      ok: true,
      deleted: true,
    });
  } catch (error) {
    console.error("Delete review reply error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

app.delete("/post", deleteReviewReply);
app.post("/post/deletePost", deleteReviewReply);
app.delete("/review/reply", deleteReviewReply);

app.post("/review/upvote", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const { rid } = req.body || {};

    if (!rid) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    const reviewRef = db.collection("reviews").doc(String(rid));

    await reviewRef.update({
      upvotedBy: FieldValue.arrayUnion(decodedUser.uid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true,
      upvoted: true,
    });
  } catch (error) {
    console.error("POST /review/upvote error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/review/removeUpvote", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const { rid } = req.body || {};

    if (!rid) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    const reviewRef = db.collection("reviews").doc(String(rid));

    await reviewRef.update({
      upvotedBy: FieldValue.arrayRemove(decodedUser.uid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      ok: true,
      upvoted: false,
    });
  } catch (error) {
    console.error("POST /review/removeUpvote error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.delete("/review", async (req, res) => {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const { rid } = req.body || {};

    if (!rid) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    const reviewRef = db.collection("reviews").doc(String(rid));
    const snapshot = await reviewRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "Review not found.",
      });
    }

    if (snapshot.data().userId !== decodedUser.uid) {
      return res.status(403).json({
        ok: false,
        error: "You cannot delete another user's review.",
      });
    }

    await reviewRef.delete();

    return res.json({
      ok: true,
      deleted: true,
    });
  } catch (error) {
    console.error("DELETE /review error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

async function getUserReviews(uid, currentUid) {
  const snapshot = await db
    .collection("reviews")
    .where("userId", "==", uid)
    .get();

  return snapshot.docs.map((document) =>
    formatReview(document, currentUid)
  );
}

app.get("/users/:uid/top-reviews", async (req, res) => {
  try {
    /*
     * These profile sections are readable profile data.
     * Do not require an Authorization header here because the
     * existing mobile/web REST helpers call these endpoints
     * without one.
     *
     * Ownership is calculated safely in Review.js using the
     * signed-in Firebase UID and the review's stored userId.
     */
    const reviews = await getUserReviews(
      req.params.uid,
      null
    );

    reviews.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      return b.upvotes - a.upvotes;
    });

    return res.json(reviews.slice(0, 10));
  } catch (error) {
    console.error("GET /users/:uid/top-reviews error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/favorites", async (req, res) => {
  try {
    /*
     * These profile sections are readable profile data.
     * Do not require an Authorization header here because the
     * existing mobile/web REST helpers call these endpoints
     * without one.
     *
     * Ownership is calculated safely in Review.js using the
     * signed-in Firebase UID and the review's stored userId.
     */
    const reviews = await getUserReviews(
      req.params.uid,
      null
    );

    const favorites = reviews
      .filter((review) => review.hearted)
      .sort((a, b) => {
        return new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0);
      });

    return res.json(favorites);
  } catch (error) {
    console.error("GET /users/:uid/favorites error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/most-upvoted", async (req, res) => {
  try {
    /*
     * These profile sections are readable profile data.
     * Do not require an Authorization header here because the
     * existing mobile/web REST helpers call these endpoints
     * without one.
     *
     * Ownership is calculated safely in Review.js using the
     * signed-in Firebase UID and the review's stored userId.
     */
    const reviews = await getUserReviews(
      req.params.uid,
      null
    );

    reviews.sort((a, b) => b.upvotes - a.upvotes);

    return res.json(
      reviews
        .filter((review) => review.upvotes > 0)
        .slice(0, 10)
    );
  } catch (error) {
    console.error("GET /users/:uid/most-upvoted error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/activity", async (req, res) => {
  try {
    /*
     * These profile sections are readable profile data.
     * Do not require an Authorization header here because the
     * existing mobile/web REST helpers call these endpoints
     * without one.
     *
     * Ownership is calculated safely in Review.js using the
     * signed-in Firebase UID and the review's stored userId.
     */
    const reviews = await getUserReviews(
      req.params.uid,
      null
    );

    reviews.sort((a, b) => {
      return new Date(b.createdAt || 0) -
        new Date(a.createdAt || 0);
    });

    return res.json(reviews);
  } catch (error) {
    console.error("GET /users/:uid/activity error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/review/reviewSong", async (req, res) => {
  try {
    const { rid } = req.query;

    if (!rid) {
      return res.status(400).json({
        ok: false,
        error: "Review ID is required.",
      });
    }

    const reviewSnapshot = await db
      .collection("reviews")
      .doc(String(rid))
      .get();

    if (!reviewSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "Review not found.",
      });
    }

    const review = reviewSnapshot.data();
    const listenableId = review.listenableId;
    const type = review.type || "track";

    if (type === "track") {
      let track = await fetchDeezer(
        `/track/${encodeURIComponent(listenableId)}`,
        {
          forceRefresh: false,
          ttl: DEEZER_CACHE_TTL.track,
        }
      );

      let preview =
        track?.preview ||
        track?.previewUrl ||
        track?.playbackUrl ||
        "";

      if (!preview) {
        track = await fetchDeezer(
          `/track/${encodeURIComponent(listenableId)}`,
          {
            forceRefresh: true,
            ttl: DEEZER_CACHE_TTL.track,
          }
        );

        preview =
          track?.preview ||
          track?.previewUrl ||
          track?.playbackUrl ||
          "";
      }

      return res.json({
        ...normalizeDeezerTrack(track),
        preview,
        previewUrl: preview,
        playbackUrl: preview,
      });
    }

    if (type === "album") {
      const album = await fetchDeezer(
        `/album/${encodeURIComponent(listenableId)}`
      );

      const image =
        album.cover_xl ||
        album.cover_big ||
        album.cover_medium ||
        album.cover ||
        "";

      return res.json({
        id: String(album.id),
        type: "album",
        name: album.title || "",
        title: album.title || "",
        artist: album.artist?.name || "",
        image,
        coverArt: image,
      });
    }

    if (type === "artist") {
      const artist = await fetchDeezer(
        `/artist/${encodeURIComponent(listenableId)}`
      );

      const image =
        artist.picture_xl ||
        artist.picture_big ||
        artist.picture_medium ||
        artist.picture ||
        "";

      return res.json({
        id: String(artist.id),
        type: "artist",
        name: artist.name || "",
        title: artist.name || "",
        artist: artist.name || "",
        image,
        coverArt: image,
      });
    }

    return res.status(400).json({
      ok: false,
      error: `Unsupported review type: ${type}`,
    });
  } catch (error) {
    console.error("GET /review/reviewSong error:", error);

    return res.status(502).json({
      ok: false,
      error: error.message,
    });
  }
});

// -------------------------------------------------------------------------
// Recently Viewed
// -------------------------------------------------------------------------

app.post("/users/recently-viewed", async (req, res) => {
  try {
    const {
      user_id,
      item_id,
      listenable_id,
      type = "track",
      name = "",
      title = "",
      artist = null,
      album = null,
      image = "",
      coverArt = "",
      preview = "",
    } = req.body || {};

    const userId = String(user_id || "").trim();
    const itemId = String(item_id || listenable_id || "").trim();
    const itemType = String(type || "track").toLowerCase();

    if (!userId || !itemId) {
      return res.status(400).json({
        ok: false,
        error: "user_id and item_id are required.",
      });
    }

    if (!["track", "album", "artist"].includes(itemType)) {
      return res.status(400).json({
        ok: false,
        error: "type must be track, album, or artist.",
      });
    }

    const recentlyViewedId = `${userId}_${itemType}_${itemId}`;

    await db
      .collection("recentlyViewed")
      .doc(recentlyViewedId)
      .set(
        {
          userId,
          itemId,
          listenableId: itemId,
          type: itemType,

          name: String(name || title || "Unknown Item"),
          title: String(title || name || "Unknown Item"),

          artist: artist || null,
          album: album || null,

          image: String(image || coverArt || ""),
          coverArt: String(coverArt || image || ""),
          preview: String(preview || ""),

          viewedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    const viewedItem = {
      id: itemId,
      type: itemType,
      name:
        String(name || title || "Unknown Item"),
      title:
        String(title || name || "Unknown Item"),
      artist: artist || null,
      album: album || null,
      image:
        String(image || coverArt || ""),
      coverArt:
        String(coverArt || image || ""),
      preview:
        String(preview || ""),
    };

    if (itemType === "track") {
      await savePermanentTrack(
        viewedItem
      );
    } else if (itemType === "album") {
      await savePermanentAlbum(
        viewedItem,
        viewedItem.artist
      );
    } else if (itemType === "artist") {
      await savePermanentArtist(
        viewedItem
      );
    }

    runGraphWrite(upsertGraphEdge({
      fromType: "user",
      fromId: userId,
      relationship: "VIEWED",
      toType: itemType,
      toId: itemId,
      weight: 1,
      metadata: {
        title:
          viewedItem.title,
      },
    }), "user-viewed-track");

    return res.status(201).json({
      ok: true,
      saved: true,
      itemId,
      type: itemType,
    });
  } catch (error) {
    console.error("POST /users/recently-viewed error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/recently-viewed", async (req, res) => {
  try {
    const userId = String(req.params.uid || "").trim();

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(
      Math.max(Number.isNaN(parsedLimit) ? 30 : parsedLimit, 1),
      100
    );

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "User ID is required.",
      });
    }

    const snapshot = await db
      .collection("recentlyViewed")
      .where("userId", "==", userId)
      .get();

    const recentlyViewed = snapshot.docs
      .map((document) => {
        const data = document.data();

        return {
          record_id: document.id,

          id: String(data.itemId || data.listenableId || ""),
          itemId: String(data.itemId || data.listenableId || ""),
          listenableId: String(data.listenableId || data.itemId || ""),

          type: data.type || "track",

          name: data.name || data.title || "Unknown Item",
          title: data.title || data.name || "Unknown Item",

          artist: data.artist || null,
          album: data.album || null,

          image: data.image || data.coverArt || "",
          coverArt: data.coverArt || data.image || "",
          preview: data.preview || "",

          viewedAt: serializeTimestamp(data.viewedAt),
        };
      })
      .sort((a, b) => {
        return (
          new Date(b.viewedAt || 0).getTime() -
          new Date(a.viewedAt || 0).getTime()
        );
      })
      .slice(0, limit);

    return res.json({
      ok: true,
      recentlyViewed,
    });
  } catch (error) {
    console.error("GET /users/:uid/recently-viewed error:", error);

    return res.status(500).json({
      ok: false,
      recentlyViewed: [],
      error: error.message,
    });
  }
});

app.delete("/users/:uid/recently-viewed", async (req, res) => {
  try {
    const userId = String(req.params.uid || "").trim();

    const snapshot = await db
      .collection("recentlyViewed")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();

    snapshot.docs.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();

    return res.json({
      ok: true,
      cleared: true,
      deletedCount: snapshot.size,
    });
  } catch (error) {
    console.error("DELETE /users/:uid/recently-viewed error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/likes", async (req, res) => {
  try {
    const userId = String(req.params.uid || "").trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        likes: [],
        error: "User ID is required.",
      });
    }

    const snapshot = await db
      .collection("likes")
      .where("userId", "==", userId)
      .get();

    const likedItems = await Promise.all(
      snapshot.docs.map(async (document) => {
        const likeData = document.data();

        const itemId = String(
          likeData.musicId || ""
        );

        const itemType = String(
          likeData.type || "track"
        ).toLowerCase();

        if (!itemId) {
          return null;
        }

        try {
          if (itemType === "track") {
            const track = await fetchDeezer(
              `/track/${encodeURIComponent(itemId)}`
            );

            return {
              likeId: document.id,
              likedAt: serializeTimestamp(
                likeData.createdAt
              ),
              ...normalizeDeezerTrack(track),
            };
          }

          if (itemType === "album") {
            const album = await fetchDeezer(
              `/album/${encodeURIComponent(itemId)}`
            );

            const image =
              album.cover_xl ||
              album.cover_big ||
              album.cover_medium ||
              album.cover ||
              "";

            return {
              likeId: document.id,
              likedAt: serializeTimestamp(
                likeData.createdAt
              ),

              id: String(album.id),
              listenableId: String(album.id),
              type: "album",

              title:
                album.title ||
                "Unknown Album",

              name:
                album.title ||
                "Unknown Album",

              artist:
                album.artist || {
                  name: "Unknown Artist",
                },

              artistName:
                album.artist?.name ||
                "Unknown Artist",

              image,
              coverArt: image,

              album: {
                id: String(album.id),
                title:
                  album.title ||
                  "Unknown Album",
                cover_xl: image,
                cover_big: image,
              },
            };
          }

          if (itemType === "artist") {
            const artist = await fetchDeezer(
              `/artist/${encodeURIComponent(itemId)}`
            );

            const image =
              artist.picture_xl ||
              artist.picture_big ||
              artist.picture_medium ||
              artist.picture ||
              "";

            return {
              likeId: document.id,
              likedAt: serializeTimestamp(
                likeData.createdAt
              ),

              id: String(artist.id),
              listenableId: String(artist.id),
              type: "artist",

              title:
                artist.name ||
                "Unknown Artist",

              name:
                artist.name ||
                "Unknown Artist",

              artist: {
                id: String(artist.id),
                name:
                  artist.name ||
                  "Unknown Artist",
                picture: image,
              },

              artistName:
                artist.name ||
                "Unknown Artist",

              image,
              coverArt: image,
            };
          }

          return null;
        } catch (metadataError) {
          console.warn(
            `[Likes] Unable to hydrate ${itemType} ${itemId}:`,
            metadataError.message
          );

          // Keep the like visible even if Deezer lookup fails.
          return {
            likeId: document.id,
            likedAt: serializeTimestamp(
              likeData.createdAt
            ),

            id: itemId,
            listenableId: itemId,
            type: itemType,

            title:
              likeData.name ||
              `Liked ${itemType}`,

            name:
              likeData.name ||
              `Liked ${itemType}`,

            artistName:
              likeData.artistName || "",

            image: "",
            coverArt: "",
          };
        }
      })
    );

    const likes = likedItems
      .filter(Boolean)
      .sort((first, second) => {
        return (
          new Date(second.likedAt || 0).getTime() -
          new Date(first.likedAt || 0).getTime()
        );
      });

    return res.json({
      ok: true,
      likes,
    });
  } catch (error) {
    console.error(
      "GET /users/:uid/likes error:",
      error
    );

    return res.status(500).json({
      ok: false,
      likes: [],
      error: error.message,
    });
  }
});


app.get("/artists/:artistId/tracks", async (req, res) => {
  try {
    const artistId = String(
      req.params.artistId || ""
    ).trim();

    const parsedLimit = Number.parseInt(
      req.query.limit,
      10
    );

    const limit = Math.min(
      Math.max(
        Number.isNaN(parsedLimit)
          ? 50
          : parsedLimit,
        1
      ),
      100
    );

    if (!artistId) {
      return res.status(400).json({
        ok: false,
        tracks: [],
        error: "Artist ID is required.",
      });
    }

    const result = await fetchDeezer(
      `/artist/${encodeURIComponent(
        artistId
      )}/top?limit=${limit}`
    );

    const tracks = (result.data || []).map(
      (track) => normalizeDeezerTrack(track)
    );

    console.log(
      `[Artist Tracks] ${artistId}: ${tracks.length}`
    );

    return res.status(200).json({
      ok: true,
      tracks,
    });
  } catch (error) {
    console.error(
      "GET /artists/:artistId/tracks error:",
      error
    );

    return res.status(502).json({
      ok: false,
      tracks: [],
      error: error.message,
    });
  }
});

app.get("/artists/:artistId/albums", async (req, res) => {
  try {
    const artistId = String(
      req.params.artistId || ""
    ).trim();

    const parsedLimit = Number.parseInt(
      req.query.limit,
      10
    );

    const limit = Math.min(
      Math.max(
        Number.isNaN(parsedLimit)
          ? 50
          : parsedLimit,
        1
      ),
      100
    );

    if (!artistId) {
      return res.status(400).json({
        ok: false,
        albums: [],
        error: "Artist ID is required.",
      });
    }

    const result = await fetchDeezer(
      `/artist/${encodeURIComponent(
        artistId
      )}/albums?limit=${limit}`
    );

    const albums = (result.data || []).map(
      (album) => {
        const image =
          album.cover_xl ||
          album.cover_big ||
          album.cover_medium ||
          album.cover ||
          "";

        return {
          id: String(album.id),
          listenableId: String(album.id),
          type: "album",

          title:
            album.title ||
            "Unknown Album",

          name:
            album.title ||
            "Unknown Album",

          artist:
            album.artist || {
              id: artistId,
              name: "Unknown Artist",
            },

          artistName:
            album.artist?.name ||
            "Unknown Artist",

          image,
          coverArt: image,
          cover: image,

          releaseDate:
            album.release_date || "",

          recordType:
            album.record_type || "",

          link: album.link || "",
        };
      }
    );

    console.log(
      `[Artist Albums] ${artistId}: ${albums.length}`
    );

    return res.status(200).json({
      ok: true,
      albums,
    });
  } catch (error) {
    console.error(
      "GET /artists/:artistId/albums error:",
      error
    );

    return res.status(502).json({
      ok: false,
      albums: [],
      error: error.message,
    });
  }
});

app.get("/album/songs", async (req, res) => {
  try {
    const albumId = String(
      req.query.listenable_id ||
      req.query.album_id ||
      ""
    ).trim();

    if (!albumId) {
      return res.status(400).json({
        ok: false,
        songs: [],
        error:
          "listenable_id is required.",
      });
    }

    /*
     * Force a complete album lookup. A catalog record originally
     * saved from a search result may only contain title/artwork.
     */
    let albumData =
      await fetchDeezer(
        `/album/${encodeURIComponent(
          albumId
        )}`,
        {
          forceRefresh: true,
        }
      );

    let tracks =
      albumData?.tracks?.data ||
      [];

    /*
     * Some album responses or stale cached records may not include
     * tracks. Deezer exposes a dedicated tracks endpoint, so use it
     * as the reliable fallback.
     */
    if (
      !Array.isArray(tracks) ||
      tracks.length === 0
    ) {
      const tracksData =
        await fetchDeezer(
          `/album/${encodeURIComponent(
            albumId
          )}/tracks?limit=100`,
          {
            forceRefresh: true,
          }
        );

      tracks =
        tracksData?.data ||
        tracksData?.tracks?.data ||
        [];
    }

    /*
     * Final database fallback for albums whose tracks were already
     * saved into Treble's permanent catalog.
     */
    if (
      (!Array.isArray(tracks) ||
        tracks.length === 0)
    ) {
      const catalogSnapshot =
        await db
          .collection(
            MUSIC_TRACKS_COLLECTION
          )
          .where(
            "albumId",
            "==",
            albumId
          )
          .limit(100)
          .get();

      tracks =
        catalogSnapshot.docs.map(
          (document) => {
            const data =
              document.data() || {};

            return (
              data.raw || {
                id:
                  document.id,
                title:
                  data.title ||
                  data.name ||
                  "Unknown Track",
                title_short:
                  data.title ||
                  data.name ||
                  "Unknown Track",
                artist:
                  data.artist ||
                  null,
                album:
                  data.album ||
                  null,
                preview:
                  data.preview ||
                  data.previewUrl ||
                  data.playbackUrl ||
                  "",
                duration:
                  Number(
                    data.duration || 0
                  ),
              }
            );
          }
        );
    }

    const albumImage =
      albumData?.cover_xl ||
      albumData?.cover_big ||
      albumData?.cover_medium ||
      albumData?.cover ||
      albumData?.image ||
      albumData?.coverArt ||
      "";

    const songs =
      (Array.isArray(tracks)
        ? tracks
        : []
      ).map((track) => {
        const trackWithAlbum = {
          ...track,
          album: {
            ...(track.album || {}),
            id:
              String(
                track.album?.id ||
                albumData?.id ||
                albumId
              ),
            title:
              track.album?.title ||
              albumData?.title ||
              "Unknown Album",
            cover:
              track.album?.cover ||
              albumImage,
            cover_medium:
              track.album
                ?.cover_medium ||
              albumImage,
            cover_big:
              track.album
                ?.cover_big ||
              albumImage,
            cover_xl:
              track.album
                ?.cover_xl ||
              albumImage,
          },
          artist:
            track.artist ||
            albumData?.artist ||
            null,
        };

        const normalized =
          normalizeDeezerTrack(
            trackWithAlbum
          );

        return {
          ...normalized,
          id:
            String(track.id),
          listenableId:
            String(track.id),
          listenable_id:
            String(track.id),
          type: "track",
          title:
            track.title ||
            track.title_short ||
            "Unknown Track",
          name:
            track.title ||
            track.title_short ||
            "Unknown Track",
          artist:
            track.artist ||
            albumData?.artist ||
            null,
          artistName:
            track.artist?.name ||
            albumData?.artist?.name ||
            "",
          album: {
            id:
              String(
                albumData?.id ||
                albumId
              ),
            title:
              albumData?.title ||
              track.album?.title ||
              "Unknown Album",
            cover:
              albumImage ||
              track.album?.cover ||
              "",
            coverArt:
              albumImage ||
              track.album?.cover ||
              "",
            cover_xl:
              albumImage ||
              track.album?.cover_xl ||
              "",
            cover_big:
              albumImage ||
              track.album?.cover_big ||
              "",
          },
          image:
            normalized.image ||
            albumImage,
          coverArt:
            normalized.coverArt ||
            albumImage,
          preview:
            track.preview || "",
          previewUrl:
            track.preview || "",
          playbackUrl:
            track.preview || "",
        };
      });

    /*
     * Save the now-complete album and its songs in the background.
     */
    scheduleCatalogPersistence(
      `/album/${albumId}`,
      {
        ...albumData,
        tracks: {
          data: tracks,
        },
      }
    );

    console.log(
      `[Album Songs] ${albumId}: ${songs.length}`
    );

    return res.status(200).json({
      ok: true,
      songs,
      count:
        songs.length,
    });
  } catch (error) {
    console.error(
      "GET /album/songs error:",
      error
    );

    return res.status(502).json({
      ok: false,
      songs: [],
      error:
        error.message,
    });
  }
});

app.get("/album/summary", async (req, res) => {
  try {
    const albumId = String(
      req.query.listenable_id ||
      req.query.album_id ||
      ""
    ).trim();

    if (!albumId) {
      return res.status(400).json({
        ok: false,
        summary: "",
        error: "listenable_id is required.",
      });
    }

    const albumData = await fetchDeezer(
      `/album/${encodeURIComponent(albumId)}`
    );

    const pieces = [];

    if (albumData.release_date) {
      pieces.push(
        `Released ${albumData.release_date}`
      );
    }

    if (albumData.nb_tracks) {
      pieces.push(
        `${albumData.nb_tracks} tracks`
      );
    }

    if (albumData.duration) {
      const totalMinutes = Math.round(
        Number(albumData.duration) / 60
      );

      pieces.push(
        `${totalMinutes} minutes`
      );
    }

    if (albumData.genres?.data?.length) {
      pieces.push(
        albumData.genres.data
          .map((genre) => genre.name)
          .filter(Boolean)
          .join(", ")
      );
    }

    return res.status(200).json({
      ok: true,
      summary: pieces.join(" • "),
      album: {
        id: String(albumData.id),
        title: albumData.title || "",
        artist:
          albumData.artist?.name || "",
        releaseDate:
          albumData.release_date || "",
        trackCount:
          Number(albumData.nb_tracks || 0),
      },
    });
  } catch (error) {
    console.error(
      "GET /album/summary error:",
      error
    );

    return res.status(502).json({
      ok: false,
      summary: "",
      error: error.message,
    });
  }
});

app.put("/users/:uid", async (req, res) => {
  try {
    const uid = String(
      req.params.uid || ""
    ).trim();

    if (!uid) {
      return res.status(400).json({
        ok: false,
        error: "User ID is required.",
      });
    }

    const {
      username,
      avatar,
      isPublic,
      darkMode,
    } = req.body || {};

    const userRef = db
      .collection("users")
      .doc(uid);

    const userSnapshot =
      await userRef.get();

    if (!userSnapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "User was not found.",
      });
    }

    const updates = {
      uid,
      updatedAt:
        FieldValue.serverTimestamp(),
    };

    /*
     * Preserve the exact capitalization entered
     * by the user.
     */
    if (typeof username === "string") {
      const cleanedUsername =
        username.trim();

      if (!cleanedUsername) {
        return res.status(400).json({
          ok: false,
          error:
            "Username cannot be empty.",
        });
      }

      if (cleanedUsername.length < 3) {
        return res.status(400).json({
          ok: false,
          error:
            "Username must contain at least three characters.",
        });
      }

      if (cleanedUsername.length > 30) {
        return res.status(400).json({
          ok: false,
          error:
            "Username must contain 30 characters or fewer.",
        });
      }

      if (
        !/^[a-z0-9._-]+$/i.test(
          cleanedUsername
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Username contains invalid characters.",
        });
      }

      updates.username =
        cleanedUsername;

      updates.displayName =
        cleanedUsername;
    }

    /*
     * Save the Firebase Storage avatar URL.
     *
     * Only change the avatar when the frontend
     * explicitly sends the avatar property.
     */
    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "avatar"
      )
    ) {
      updates.avatar =
        typeof avatar === "string" &&
        avatar.trim()
          ? avatar.trim()
          : null;
    }

    if (
      typeof isPublic === "boolean"
    ) {
      updates.isPublic =
        isPublic;
    }

    if (
      typeof darkMode === "boolean"
    ) {
      updates.darkMode =
        darkMode;
    }

    await userRef.set(
      updates,
      {
        merge: true,
      }
    );

    const updatedSnapshot =
      await userRef.get();

    return res.status(200).json({
      ok: true,
      uid,
      user: {
        id: updatedSnapshot.id,
        ...updatedSnapshot.data(),
      },
    });
  } catch (error) {
    console.error(
      "PUT /users/:uid error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Unable to update user.",
    });
  }
});

app.get("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const userRef = db.collection("users").doc(uid);
    const snapshot = await userRef.get();

    if (snapshot.exists) {
      const existingUser = snapshot.data();

      // Backfill compatibility fields for older Firestore users.
      if (
        existingUser.uid !== uid ||
        existingUser.userId !== uid ||
        existingUser.rid !== uid
      ) {
        await userRef.set(
          {
            uid,
            userId: uid,
            rid: uid,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return res.json({
        ...existingUser,

        // These values must always use the Firebase UID.
        uid,
        userId: uid,
        rid: uid,
      });
    }

    // Firebase Auth user exists, but no Firestore profile exists yet.
    const firebaseUser = await getAuth().getUser(uid);

    const newProfile = {
      uid,
      userId: uid,
      rid: uid,

      email: firebaseUser.email || "",
      username:
        firebaseUser.displayName ||
        firebaseUser.email?.split("@")[0] ||
        "Treble User",
      displayName: firebaseUser.displayName || "",
      avatar: firebaseUser.photoURL || "None",

      followersCount: 0,
      followingCount: 0,
      isPublic: true,
      isAdmin: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.set(newProfile);

    console.log(
      `[GET /users/${uid}] Created missing Firestore profile`
    );

    return res.status(201).json({
      uid,
      userId: uid,
      rid: uid,

      email: newProfile.email,
      username: newProfile.username,
      displayName: newProfile.displayName,
      avatar: newProfile.avatar,

      followersCount: 0,
      followingCount: 0,
      isPublic: true,
      isAdmin: false,
    });
  } catch (error) {
    console.error(`GET /users/${req.params.uid} error:`, error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({
        ok: false,
        error: "Firebase user account not found.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// ============================================================================
// FOLLOWERS, FOLLOWING, FRIENDS, FOLLOW REQUESTS, AND NOTIFICATIONS
// ============================================================================

function cleanUserId(value) {
  return String(value || "").trim();
}

function buildFollowId(followerId, followedId) {
  return `${followerId}_${followedId}`;
}

function buildFollowRequestId(followerId, followedId) {
  return `${followerId}_${followedId}`;
}

async function getSocialUserProfile(userId) {
  const cleanId = cleanUserId(userId);

  if (!cleanId) {
    return null;
  }

  const snapshot = await db
    .collection("users")
    .doc(cleanId)
    .get();

  if (!snapshot.exists) {
    return {
      uid: cleanId,
      userId: cleanId,
      id: cleanId,
      rid: cleanId,
      username: "Treble User",
      displayName: "",
      avatar: "None",
      isPublic: true,
    };
  }

  const data = snapshot.data() || {};

  return {
    ...data,

    uid: cleanId,
    userId: cleanId,
    id: cleanId,
    rid: cleanId,

    username:
      data.username ||
      data.displayName ||
      data.email?.split("@")[0] ||
      "Treble User",

    displayName:
      data.displayName ||
      data.username ||
      "",

    avatar:
      data.avatar ||
      data.photoURL ||
      "None",

    isPublic:
      data.isPublic !== false,
  };
}

async function createNotification({
  type,
  fromUserId,
  toUserId,

  targetId = null,
  shareId = null,

  itemId = null,
  itemType = "track",
  itemData = null,

  songTitle = "",
  comment = "",

  dedupeKey = null,
}) {
  const cleanFromUserId =
    cleanUserId(fromUserId);

  const cleanToUserId =
    cleanUserId(toUserId);

  if (
    !type ||
    !cleanFromUserId ||
    !cleanToUserId ||
    cleanFromUserId === cleanToUserId
  ) {
    return null;
  }

  const notificationRef =
    dedupeKey
      ? db
          .collection("notifications")
          .doc(dedupeKey)
      : db
          .collection("notifications")
          .doc();

  await notificationRef.set(
    {
      id: notificationRef.id,

      type: String(type)
        .trim()
        .toLowerCase(),

      fromUserId:
        cleanFromUserId,

      toUserId:
        cleanToUserId,

      targetId:
        targetId
          ? String(targetId)
          : null,

      shareId:
        shareId
          ? String(shareId)
          : null,

      itemId:
        itemId
          ? String(itemId)
          : null,

      itemType:
        String(itemType || "track")
          .trim()
          .toLowerCase(),

      itemData:
        itemData &&
        typeof itemData === "object"
          ? itemData
          : null,

      songTitle:
        String(songTitle || ""),

      comment:
        String(comment || "")
          .trim()
          .slice(0, 500),

      read: false,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return notificationRef.id;
}
async function deleteNotificationsMatching({
  type,
  fromUserId,
  toUserId,
}) {
  const cleanFromUserId =
    cleanUserId(fromUserId);

  const cleanToUserId =
    cleanUserId(toUserId);

  if (
    !type ||
    !cleanFromUserId ||
    !cleanToUserId
  ) {
    return;
  }

  const snapshot = await db
    .collection("notifications")
    .where(
      "toUserId",
      "==",
      cleanToUserId
    )
    .get();

  const batch = db.batch();

  snapshot.docs.forEach((document) => {
    const data =
      document.data() || {};

    if (
      data.type === type &&
      data.fromUserId ===
        cleanFromUserId
    ) {
      batch.delete(document.ref);
    }
  });

  await batch.commit();
}

async function updateSocialCounts(
  followerId,
  followedId
) {
  const cleanFollowerId =
    cleanUserId(followerId);

  const cleanFollowedId =
    cleanUserId(followedId);

  if (
    !cleanFollowerId ||
    !cleanFollowedId
  ) {
    return;
  }

  const [
    followingSnapshot,
    followersSnapshot,
  ] = await Promise.all([
    db
      .collection("follows")
      .where(
        "followerId",
        "==",
        cleanFollowerId
      )
      .get(),

    db
      .collection("follows")
      .where(
        "followedId",
        "==",
        cleanFollowedId
      )
      .get(),
  ]);

  const batch = db.batch();

  batch.set(
    db
      .collection("users")
      .doc(cleanFollowerId),
    {
      followingCount:
        followingSnapshot.size,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  batch.set(
    db
      .collection("users")
      .doc(cleanFollowedId),
    {
      followersCount:
        followersSnapshot.size,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  await batch.commit();
}

async function createFollowRelationship(
  followerId,
  followedId
) {
  const cleanFollowerId =
    cleanUserId(followerId);

  const cleanFollowedId =
    cleanUserId(followedId);

  if (
    !cleanFollowerId ||
    !cleanFollowedId
  ) {
    throw new Error(
      "Both follower_id and followed_id are required."
    );
  }

  if (
    cleanFollowerId ===
    cleanFollowedId
  ) {
    throw new Error(
      "You cannot follow yourself."
    );
  }

  const followId =
    buildFollowId(
      cleanFollowerId,
      cleanFollowedId
    );

  const followRef = db
    .collection("follows")
    .doc(followId);

  const existing =
    await followRef.get();

  if (existing.exists) {
    return {
      followId,
      alreadyFollowing: true,
    };
  }

  await followRef.set({
    id: followId,

    followerId:
      cleanFollowerId,

    followedId:
      cleanFollowedId,

    createdAt:
      FieldValue.serverTimestamp(),
  });

  await updateSocialCounts(
    cleanFollowerId,
    cleanFollowedId
  );

  return {
    followId,
    alreadyFollowing: false,
  };
}

// ============================================================================
// FOLLOW A PUBLIC ACCOUNT
// ============================================================================

app.post(
  "/users/follow",
  async (req, res) => {
    try {
      const followerId =
        cleanUserId(
          req.body?.follower_id ||
          req.body?.followerId
        );

      const followedId =
        cleanUserId(
          req.body?.followed_id ||
          req.body?.followedId
        );

      if (
        !followerId ||
        !followedId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "follower_id and followed_id are required.",
          });
      }

      if (
        followerId === followedId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "You cannot follow yourself.",
          });
      }

      const followedUser =
        await getSocialUserProfile(
          followedId
        );

      if (!followedUser) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "The account you are trying to follow was not found.",
          });
      }

      /*
       * Private accounts must be handled through
       * POST /users/requestFollow instead.
       */
      if (
        followedUser.isPublic ===
        false
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            requiresRequest: true,
            error:
              "This account is private. Send a follow request instead.",
          });
      }

      const result =
        await createFollowRelationship(
          followerId,
          followedId
        );

      /*
       * Only create one follow notification.
       */
      if (
        !result.alreadyFollowing
      ) {
        await createNotification({
          type: "music_share",

          fromUserId,
          toUserId,

          shareId: shareRef.id,

          // This must be the music ID, not the share document ID.
          targetId: itemId,
          itemId,

          itemType: type,
          itemData: item,

          songTitle:
            item.title ||
            item.name ||
            "Shared music",

          comment,
        });
      }

      return res
        .status(
          result.alreadyFollowing
            ? 200
            : 201
        )
        .json({
          ok: true,

          following: true,

          alreadyFollowing:
            result.alreadyFollowing,

          followerId,
          followedId,

          followId:
            result.followId,
        });
    } catch (error) {
      console.error(
        "POST /users/follow error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to follow user.",
        });
    }
  }
);

// ============================================================================
// UNFOLLOW
// ============================================================================

app.post(
  "/users/unfollow",
  async (req, res) => {
    try {
      const followerId =
        cleanUserId(
          req.body?.follower_id ||
          req.body?.followerId
        );

      const followedId =
        cleanUserId(
          req.body?.followed_id ||
          req.body?.followedId
        );

      if (
        !followerId ||
        !followedId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "follower_id and followed_id are required.",
          });
      }

      const followId =
        buildFollowId(
          followerId,
          followedId
        );

      const followRef = db
        .collection("follows")
        .doc(followId);

      const snapshot =
        await followRef.get();

      if (snapshot.exists) {
        await followRef.delete();

        await updateSocialCounts(
          followerId,
          followedId
        );
      }

      /*
       * Remove the old public follow notification.
       */
      await deleteNotificationsMatching({
        type: "follow",

        fromUserId:
          followerId,

        toUserId:
          followedId,
      });

      return res
        .status(200)
        .json({
          ok: true,
          following: false,

          removed:
            snapshot.exists,

          followerId,
          followedId,
        });
    } catch (error) {
      console.error(
        "POST /users/unfollow error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to unfollow user.",
        });
    }
  }
);

// ============================================================================
// GET FOLLOWERS
// ============================================================================

app.get(
  "/users/:uid/followers",
  async (req, res) => {
    try {
      const userId =
        cleanUserId(
          req.params.uid
        );

      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            followers: [],
            error:
              "User ID is required.",
          });
      }

      const snapshot =
        await db
          .collection("follows")
          .where(
            "followedId",
            "==",
            userId
          )
          .get();

      const followers =
        await Promise.all(
          snapshot.docs.map(
            async (document) => {
              const relationship =
                document.data() ||
                {};

              const followerId =
                cleanUserId(
                  relationship.followerId
                );

              const profile =
                await getSocialUserProfile(
                  followerId
                );

              /*
               * Does the viewed account also follow
               * this follower back?
               */
              const reverseFollow =
                await db
                  .collection("follows")
                  .doc(
                    buildFollowId(
                      userId,
                      followerId
                    )
                  )
                  .get();

              return {
                ...profile,

                userId:
                  followerId,

                uid:
                  followerId,

                id:
                  followerId,

                isFollowing:
                  reverseFollow.exists,

                followsYou: true,

                isFriend:
                  reverseFollow.exists,

                followedAt:
                  serializeTimestamp(
                    relationship.createdAt
                  ),
              };
            }
          )
        );

      followers.sort(
        (first, second) => {
          return (
            new Date(
              second.followedAt || 0
            ).getTime() -
            new Date(
              first.followedAt || 0
            ).getTime()
          );
        }
      );

      return res
        .status(200)
        .json({
          ok: true,
          followers,
          count:
            followers.length,
        });
    } catch (error) {
      console.error(
        "GET /users/:uid/followers error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          followers: [],
          error:
            error?.message ||
            "Unable to load followers.",
        });
    }
  }
);

// ============================================================================
// GET FOLLOWING
// ============================================================================

app.get(
  "/users/:uid/following",
  async (req, res) => {
    try {
      const userId =
        cleanUserId(
          req.params.uid
        );

      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            following: [],
            error:
              "User ID is required.",
          });
      }

      const snapshot =
        await db
          .collection("follows")
          .where(
            "followerId",
            "==",
            userId
          )
          .get();

      const following =
        await Promise.all(
          snapshot.docs.map(
            async (document) => {
              const relationship =
                document.data() ||
                {};

              const followedId =
                cleanUserId(
                  relationship.followedId
                );

              const profile =
                await getSocialUserProfile(
                  followedId
                );

              /*
               * Does this account also follow
               * the current user?
               */
              const reverseFollow =
                await db
                  .collection("follows")
                  .doc(
                    buildFollowId(
                      followedId,
                      userId
                    )
                  )
                  .get();

              return {
                ...profile,

                userId:
                  followedId,

                uid:
                  followedId,

                id:
                  followedId,

                isFollowing: true,

                followsYou:
                  reverseFollow.exists,

                isFriend:
                  reverseFollow.exists,

                followedAt:
                  serializeTimestamp(
                    relationship.createdAt
                  ),
              };
            }
          )
        );

      following.sort(
        (first, second) => {
          return (
            new Date(
              second.followedAt || 0
            ).getTime() -
            new Date(
              first.followedAt || 0
            ).getTime()
          );
        }
      );

      return res
        .status(200)
        .json({
          ok: true,
          following,
          count:
            following.length,
        });
    } catch (error) {
      console.error(
        "GET /users/:uid/following error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          following: [],
          error:
            error?.message ||
            "Unable to load following.",
        });
    }
  }
);

// ============================================================================
// GET FRIENDS
// A friend is someone where both follow relationships exist.
// ============================================================================

app.get(
  "/users/:uid/friends",
  async (req, res) => {
    try {
      const userId =
        cleanUserId(
          req.params.uid
        );

      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            friends: [],
            error:
              "User ID is required.",
          });
      }

      const followingSnapshot =
        await db
          .collection("follows")
          .where(
            "followerId",
            "==",
            userId
          )
          .get();

      const friends = [];

      for (
        const document of
        followingSnapshot.docs
      ) {
        const relationship =
          document.data() ||
          {};

        const followedId =
          cleanUserId(
            relationship.followedId
          );

        if (!followedId) {
          continue;
        }

        const reverseSnapshot =
          await db
            .collection("follows")
            .doc(
              buildFollowId(
                followedId,
                userId
              )
            )
            .get();

        if (!reverseSnapshot.exists) {
          continue;
        }

        const profile =
          await getSocialUserProfile(
            followedId
          );

        friends.push({
          ...profile,

          userId:
            followedId,

          uid:
            followedId,

          id:
            followedId,

          isFollowing: true,
          followsYou: true,
          isFriend: true,
        });
      }

      return res
        .status(200)
        .json({
          ok: true,
          friends,
          count:
            friends.length,
        });
    } catch (error) {
      console.error(
        "GET /users/:uid/friends error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          friends: [],
          error:
            error?.message ||
            "Unable to load friends.",
        });
    }
  }
);

// ============================================================================
// REQUEST TO FOLLOW A PRIVATE ACCOUNT
// ============================================================================

app.post(
  "/users/requestFollow",
  async (req, res) => {
    try {
      const followerId =
        cleanUserId(
          req.body?.follower_id ||
          req.body?.followerId
        );

      const followedId =
        cleanUserId(
          req.body?.followed_id ||
          req.body?.followedId
        );

      if (
        !followerId ||
        !followedId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "follower_id and followed_id are required.",
          });
      }

      if (
        followerId === followedId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "You cannot request to follow yourself.",
          });
      }

      const followedUser =
        await getSocialUserProfile(
          followedId
        );

      if (!followedUser) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "The requested account was not found.",
          });
      }

      /*
       * Public accounts should be followed immediately.
       */
      if (
        followedUser.isPublic !==
        false
      ) {
        const result =
          await createFollowRelationship(
            followerId,
            followedId
          );

        if (
          !result.alreadyFollowing
        ) {
          await createNotification({
            type: "follow",

            fromUserId:
              followerId,

            toUserId:
              followedId,

            dedupeKey:
              `follow_${followerId}_${followedId}`,
          });
        }

        return res
          .status(
            result.alreadyFollowing
              ? 200
              : 201
          )
          .json({
            ok: true,
            following: true,
            requestRequired: false,
          });
      }

      const existingFollow =
        await db
          .collection("follows")
          .doc(
            buildFollowId(
              followerId,
              followedId
            )
          )
          .get();

      if (existingFollow.exists) {
        return res
          .status(200)
          .json({
            ok: true,
            following: true,
            alreadyFollowing: true,
          });
      }

      const requestId =
        buildFollowRequestId(
          followerId,
          followedId
        );

      const requestRef = db
        .collection(
          "followRequests"
        )
        .doc(requestId);

      const existingRequest =
        await requestRef.get();

      if (!existingRequest.exists) {
        await requestRef.set({
          id: requestId,

          followerId,
          followedId,

          status: "pending",

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });

        await createNotification({
          type:
            "follow_request",

          fromUserId:
            followerId,

          toUserId:
            followedId,

          dedupeKey:
            `follow_request_${followerId}_${followedId}`,
        });
      }

      return res
        .status(
          existingRequest.exists
            ? 200
            : 201
        )
        .json({
          ok: true,

          requested: true,

          alreadyRequested:
            existingRequest.exists,

          requestId,
          followerId,
          followedId,
        });
    } catch (error) {
      console.error(
        "POST /users/requestFollow error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to send follow request.",
        });
    }
  }
);

// ============================================================================
// GET PENDING FOLLOW REQUESTS RECEIVED BY A USER
// ============================================================================

app.get(
  "/users/:uid/followRequests",
  async (req, res) => {
    try {
      const followedId =
        cleanUserId(
          req.params.uid
        );

      if (!followedId) {
        return res
          .status(400)
          .json({
            ok: false,
            requests: [],
            error:
              "User ID is required.",
          });
      }

      const snapshot =
        await db
          .collection(
            "followRequests"
          )
          .where(
            "followedId",
            "==",
            followedId
          )
          .get();

      const pendingDocuments =
        snapshot.docs.filter(
          (document) => {
            const data =
              document.data() ||
              {};

            return (
              !data.status ||
              data.status ===
                "pending"
            );
          }
        );

      const requests =
        await Promise.all(
          pendingDocuments.map(
            async (document) => {
              const request =
                document.data() ||
                {};

              const followerId =
                cleanUserId(
                  request.followerId
                );

              const profile =
                await getSocialUserProfile(
                  followerId
                );

              return {
                ...profile,

                id:
                  document.id,

                requestId:
                  document.id,

                userId:
                  followerId,

                uid:
                  followerId,

                requesterId:
                  followerId,

                fromUserId:
                  followerId,

                followedId,

                status:
                  request.status ||
                  "pending",

                createdAt:
                  serializeTimestamp(
                    request.createdAt
                  ),
              };
            }
          )
        );

      requests.sort(
        (first, second) => {
          return (
            new Date(
              second.createdAt || 0
            ).getTime() -
            new Date(
              first.createdAt || 0
            ).getTime()
          );
        }
      );

      return res
        .status(200)
        .json({
          ok: true,
          requests,
          followRequests:
            requests,
          count:
            requests.length,
        });
    } catch (error) {
      console.error(
        "GET /users/:uid/followRequests error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          requests: [],
          followRequests: [],
          error:
            error?.message ||
            "Unable to load follow requests.",
        });
    }
  }
);

// ============================================================================
// ACCEPT OR DENY A FOLLOW REQUEST
// ============================================================================

app.post(
  "/users/respondFollowRequest",
  async (req, res) => {
    try {
      const followedId =
        cleanUserId(
          req.body?.followed_id ||
          req.body?.followedId
        );

      const followerId =
        cleanUserId(
          req.body?.follower_id ||
          req.body?.followerId
        );

      const accept =
        req.body?.accept === true ||
        req.body?.accept ===
          "true" ||
        req.body?.accept === 1;

      if (
        !followedId ||
        !followerId
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "followed_id and follower_id are required.",
          });
      }

      const requestId =
        buildFollowRequestId(
          followerId,
          followedId
        );

      const requestRef = db
        .collection(
          "followRequests"
        )
        .doc(requestId);

      const requestSnapshot =
        await requestRef.get();

      if (
        !requestSnapshot.exists
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "Follow request was not found or was already handled.",
          });
      }

      if (accept) {
        await createFollowRelationship(
          followerId,
          followedId
        );
      }

      /*
       * Remove the pending request after either response.
       */
      await requestRef.delete();

      /*
       * Remove the receiver's request notification.
       */
      await deleteNotificationsMatching({
        type:
          "follow_request",

        fromUserId:
          followerId,

        toUserId:
          followedId,
      });

      if (accept) {
        /*
         * Notify the requester that their request
         * was accepted.
         */
        await createNotification({
          type:
            "follow_accepted",

          fromUserId:
            followedId,

          toUserId:
            followerId,

          dedupeKey:
            `follow_accepted_${followedId}_${followerId}`,
        });
      }

      return res
        .status(200)
        .json({
          ok: true,

          accepted:
            accept,

          denied:
            !accept,

          following:
            accept,

          followerId,
          followedId,
        });
    } catch (error) {
      console.error(
        "POST /users/respondFollowRequest error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to process follow request.",
        });
    }
  }
);

// ============================================================================
// GET NOTIFICATIONS
// ============================================================================

app.get(
  "/users/:uid/notifications",
  async (req, res) => {
    try {
      const userId =
        cleanUserId(
          req.params.uid
        );

      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            notifications: [],
            error:
              "User ID is required.",
          });
      }

      /*
       * Do not use orderBy here yet. Reading and sorting
       * in JavaScript avoids requiring a Firestore
       * composite index during initial setup.
       */
      const snapshot =
        await db
          .collection(
            "notifications"
          )
          .where(
            "toUserId",
            "==",
            userId
          )
          .get();

      const notifications =
        await Promise.all(
          snapshot.docs.map(
            async (document) => {
              const data =
                document.data() ||
                {};

              const fromUserId =
                cleanUserId(
                  data.fromUserId
                );

              const profile =
                fromUserId
                  ? await getSocialUserProfile(
                      fromUserId
                    )
                  : null;

              return {
                id:
                  document.id,

                notificationId:
                  document.id,

                type:
                  data.type ||
                  "follow",

                fromUserId,

                userId:
                  fromUserId,

                toUserId:
                  userId,

                username:
                  profile?.username ||
                  "Treble User",

                displayName:
                  profile?.displayName ||
                  "",

                avatar:
                  profile?.avatar ||
                  "None",

                targetId:
                  data.targetId ||
                  null,

                songTitle:
                  data.songTitle ||
                  "",

                read:
                  data.read === true,

                createdAt:
                  serializeTimestamp(
                    data.createdAt
                  ),

                updatedAt:
                  serializeTimestamp(
                    data.updatedAt
                  ),
              };
            }
          )
        );

      notifications.sort(
        (first, second) => {
          return (
            new Date(
              second.createdAt || 0
            ).getTime() -
            new Date(
              first.createdAt || 0
            ).getTime()
          );
        }
      );

      const unreadCount =
        notifications.filter(
          (notification) =>
            !notification.read
        ).length;

      return res
        .status(200)
        .json({
          ok: true,

          notifications,

          count:
            notifications.length,

          unreadCount,
        });
    } catch (error) {
      console.error(
        "GET /users/:uid/notifications error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          notifications: [],
          unreadCount: 0,
          error:
            error?.message ||
            "Unable to load notifications.",
        });
    }
  }
);

// ============================================================================
// MARK NOTIFICATIONS READ
// ============================================================================

app.post(
  "/users/markNotificationsRead",
  async (req, res) => {
    try {
      const userId =
        cleanUserId(
          req.body?.user_id ||
          req.body?.userId
        );

      const notificationIds =
        Array.isArray(
          req.body
            ?.notification_ids
        )
          ? req.body
              .notification_ids
              .map(cleanUserId)
              .filter(Boolean)
          : [];

      if (!userId) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "user_id is required.",
          });
      }

      let notificationDocuments =
        [];

      /*
       * Mark only the supplied notification IDs when
       * the frontend sends a list.
       */
      if (
        notificationIds.length >
        0
      ) {
        const snapshots =
          await Promise.all(
            notificationIds.map(
              (notificationId) =>
                db
                  .collection(
                    "notifications"
                  )
                  .doc(
                    notificationId
                  )
                  .get()
            )
          );

        notificationDocuments =
          snapshots.filter(
            (snapshot) =>
              snapshot.exists &&
              snapshot.data()
                ?.toUserId ===
                userId
          );
      } else {
        /*
         * An empty ID list means mark every notification
         * belonging to this user as read.
         */
        const snapshot =
          await db
            .collection(
              "notifications"
            )
            .where(
              "toUserId",
              "==",
              userId
            )
            .get();

        notificationDocuments =
          snapshot.docs;
      }

      if (
        notificationDocuments.length ===
        0
      ) {
        return res
          .status(200)
          .json({
            ok: true,
            updatedCount: 0,
          });
      }

      const batch = db.batch();

      notificationDocuments.forEach(
        (document) => {
          batch.update(
            document.ref,
            {
              read: true,

              readAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );
        }
      );

      await batch.commit();

      return res
        .status(200)
        .json({
          ok: true,

          updatedCount:
            notificationDocuments.length,
        });
    } catch (error) {
      console.error(
        "POST /users/markNotificationsRead error:",
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to mark notifications as read.",
        });
    }
  }
);

/* =========================================================
   MUSIC CATALOG + GRAPH API
========================================================= */

app.get("/catalog/stats", async (req, res) => {
  try {
    const [
      tracks,
      albums,
      artists,
      edges,
    ] = await Promise.all([
      db
        .collection(MUSIC_TRACKS_COLLECTION)
        .count()
        .get(),
      db
        .collection(MUSIC_ALBUMS_COLLECTION)
        .count()
        .get(),
      db
        .collection(MUSIC_ARTISTS_COLLECTION)
        .count()
        .get(),
      db
        .collection(MUSIC_GRAPH_EDGES_COLLECTION)
        .count()
        .get(),
    ]);

    return res.json({
      ok: true,
      tracks:
        tracks.data().count,
      albums:
        albums.data().count,
      artists:
        artists.data().count,
      edges:
        edges.data().count,
    });
  } catch (error) {
    console.error(
      "GET /catalog/stats error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/catalog/tracks/:id", async (req, res) => {
  try {
    const id =
      String(req.params.id || "").trim();

    const snapshot = await db
      .collection(MUSIC_TRACKS_COLLECTION)
      .doc(id)
      .get();

    if (!snapshot.exists) {
      return res.status(404).json({
        ok: false,
        error:
          "Track is not in the Treble catalog yet.",
      });
    }

    return res.json({
      ok: true,
      track: snapshot.data(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/friend-recommendations", async (req, res) => {
  try {
    const userId =
      String(req.params.uid || "").trim();

    const { limit } =
      getPagination(req);

    const likedTrackIds =
      new Set(
        await getUserLikedTrackIds(
          userId
        )
      );

    const candidates =
      await getFriendCatalogRecommendations(
        userId,
        {
          limit,
          excludedTrackIds:
            likedTrackIds,
        }
      );

    const recommendations =
      await Promise.all(
        candidates.map(
          ({ track, origin }) =>
            createFeedItem(
              track,
              "friend-recommendation",
              userId,
              origin
            )
        )
      );

    return res.json({
      ok: true,
      recommendations,
      friendBased: true,
    });
  } catch (error) {
    console.error(
      "GET friend recommendations error:",
      error
    );

    return res.status(500).json({
      ok: false,
      recommendations: [],
      error: error.message,
    });
  }
});


/* =========================================================
   FIRESTORE -> NEO4J AURA SYNCHRONIZATION
========================================================= */

const NEO4J_SYNC_INTERVAL_MS =
  Math.max(
    Number(
      process.env.NEO4J_SYNC_INTERVAL_MS ||
      15 * 60 * 1000
    ),
    60 * 1000
  );

const NEO4J_AUTO_SYNC_ENABLED =
  String(
    process.env.NEO4J_AUTO_SYNC_ENABLED ||
    "true"
  ).toLowerCase() !== "false";

let neo4jSyncRunning = false;
let lastNeo4jSyncResult = null;
let neo4jSyncInterval = null;

/*
 * Build the complete graph from the permanent Firestore
 * catalog and the graph-edge collection.
 *
 * Firestore remains the application's source of truth.
 * Neo4j is the synchronized visual and relationship layer.
 */
async function buildCompleteMusicGraph() {
  /*
   * Load every collection that contributes to the Treble
   * music/social graph. Missing optional collections simply
   * return an empty snapshot.
   */
  async function safeCollectionSnapshot(
    collectionName
  ) {
    try {
      return await db
        .collection(collectionName)
        .get();
    } catch (error) {
      console.warn(
        `[Neo4j] Unable to read optional collection ${collectionName}:`,
        error.message
      );

      return {
        docs: [],
        size: 0,
      };
    }
  }

  const [
    tracksSnapshot,
    albumsSnapshot,
    artistsSnapshot,
    usersSnapshot,
    storedEdgesSnapshot,
    likesSnapshot,
    reviewsSnapshot,
    reviewRepliesSnapshot,
    followsSnapshot,
    followRequestsSnapshot,
    recommendationSeedsSnapshot,
    feedServedSnapshot,
    recentlyViewedSnapshot,
    musicSharesSnapshot,
    postsSnapshot,
    feedPostsSnapshot,
  ] = await Promise.all([
    safeCollectionSnapshot(
      MUSIC_TRACKS_COLLECTION
    ),

    safeCollectionSnapshot(
      MUSIC_ALBUMS_COLLECTION
    ),

    safeCollectionSnapshot(
      MUSIC_ARTISTS_COLLECTION
    ),

    safeCollectionSnapshot("users"),

    safeCollectionSnapshot(
      MUSIC_GRAPH_EDGES_COLLECTION
    ),

    safeCollectionSnapshot("likes"),

    safeCollectionSnapshot("reviews"),

    safeCollectionSnapshot(
      "reviewReplies"
    ),

    safeCollectionSnapshot("follows"),

    safeCollectionSnapshot(
      "followRequests"
    ),

    safeCollectionSnapshot(
      "recommendationSeeds"
    ),

    safeCollectionSnapshot(
      "feedServed"
    ),

    safeCollectionSnapshot(
      "recentlyViewed"
    ),

    safeCollectionSnapshot(
      MUSIC_SHARES_COLLECTION
    ),

    /*
     * These are optional because the current Treble backend
     * may not yet store posts in either collection.
     */
    safeCollectionSnapshot("posts"),

    safeCollectionSnapshot("feedPosts"),
  ]);

  const nodesById = new Map();
  const edgesById = new Map();

  function cleanGraphText(value) {
    return String(
      value === null ||
      value === undefined
        ? ""
        : value
    ).trim();
  }

  function serializeGraphTimestamp(
    value
  ) {
    if (!value) {
      return "";
    }

    if (
      typeof value.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toISOString();
    }

    if (
      value instanceof Date
    ) {
      return value.toISOString();
    }

    const parsed =
      new Date(value);

    return Number.isNaN(
      parsed.getTime()
    )
      ? ""
      : parsed.toISOString();
  }

  function normalizeGraphType(
    value,
    fallback = "track"
  ) {
    const type =
      cleanGraphText(
        value || fallback
      ).toLowerCase();

    if (
      type === "song"
    ) {
      return "track";
    }

    return type || fallback;
  }

  function graphNodeId(
    type,
    rawId
  ) {
    const cleanType =
      normalizeGraphType(
        type,
        "entity"
      );

    const cleanId =
      cleanGraphText(rawId);

    return cleanId
      ? `${cleanType}:${cleanId}`
      : "";
  }

  function isPlaceholderGraphLabel({
    label,
    id = "",
    rawId = "",
    type = "entity",
  }) {
    const value =
      cleanGraphText(label);

    if (!value) {
      return true;
    }

    const normalizedValue =
      value.toLowerCase();

    const normalizedType =
      normalizeGraphType(
        type,
        "entity"
      );

    const normalizedRawId =
      cleanGraphText(
        rawId
      ).toLowerCase();

    const normalizedId =
      cleanGraphText(
        id
      ).toLowerCase();

    const genericLabels =
      new Set([
        "user",
        "artist",
        "album",
        "song",
        "track",
        "review",
        "reply",
        "post",
        "treble entity",
        "unknown",
        "unknown user",
        "unknown artist",
        "unknown album",
        "unknown song",
        "unknown track",
      ]);

    if (
      genericLabels.has(
        normalizedValue
      )
    ) {
      return true;
    }

    if (
      normalizedId &&
      normalizedValue ===
        normalizedId
    ) {
      return true;
    }

    if (
      normalizedRawId &&
      (
        normalizedValue ===
          normalizedRawId ||
        normalizedValue ===
          `${normalizedType} ${normalizedRawId}` ||
        normalizedValue ===
          `${normalizedType}:${normalizedRawId}`
      )
    ) {
      return true;
    }

    return false;
  }

  function graphLabelQuality({
    label,
    id = "",
    rawId = "",
    type = "entity",
  }) {
    const value =
      cleanGraphText(label);

    if (!value) {
      return 0;
    }

    if (
      isPlaceholderGraphLabel({
        label:
          value,
        id,
        rawId,
        type,
      })
    ) {
      return 1;
    }

    let score = 10;

    if (
      /[a-z]/i.test(value)
    ) {
      score += 5;
    }

    if (
      /\s/.test(value)
    ) {
      score += 3;
    }

    if (
      /[^a-z0-9_-]/i.test(value)
    ) {
      score += 2;
    }

    return score;
  }

  function chooseBetterGraphLabel({
    incomingLabel,
    existingLabel,
    id,
    rawId,
    type,
  }) {
    const incoming =
      cleanGraphText(
        incomingLabel
      );

    const existing =
      cleanGraphText(
        existingLabel
      );

    const incomingScore =
      graphLabelQuality({
        label:
          incoming,
        id,
        rawId,
        type,
      });

    const existingScore =
      graphLabelQuality({
        label:
          existing,
        id,
        rawId,
        type,
      });

    if (
      incomingScore >
      existingScore
    ) {
      return incoming;
    }

    if (
      existingScore >
      incomingScore
    ) {
      return existing;
    }

    return (
      existing ||
      incoming ||
      cleanGraphText(id)
    );
  }

  function addNode({
    id,
    rawId = "",
    type = "entity",
    label = "",
    image = "",
    properties = {},
  }) {
    const cleanId =
      cleanGraphText(id);

    if (!cleanId) {
      return null;
    }

    const cleanType =
      normalizeGraphType(
        type,
        "entity"
      );

    const existing =
      nodesById.get(cleanId) ||
      {};

    const finalRawId =
      cleanGraphText(
        rawId ||
        existing.rawId
      );

    const finalLabel =
      chooseBetterGraphLabel({
        incomingLabel:
          label,
        existingLabel:
          existing.label,
        id:
          cleanId,
        rawId:
          finalRawId,
        type:
          cleanType,
      });

    const incomingImage =
      cleanGraphText(image);

    const existingImage =
      cleanGraphText(
        existing.image
      );

    const finalImage =
      (
        incomingImage &&
        incomingImage.toLowerCase() !==
          "none"
      )
        ? incomingImage
        : existingImage;

    const node = {
      ...existing,

      id:
        cleanId,

      rawId:
        finalRawId,

      type:
        cleanType,

      label:
        finalLabel,

      image:
        finalImage,

      properties: {
        ...(existing.properties ||
          {}),
        ...(properties || {}),
      },
    };

    nodesById.set(
      cleanId,
      node
    );

    return node;
  }

  function ensureEntityNode({
    type,
    rawId,
    label = "",
    image = "",
    properties = {},
  }) {
    const id =
      graphNodeId(
        type,
        rawId
      );

    if (!id) {
      return null;
    }

    const normalizedType =
      normalizeGraphType(
        type,
        "entity"
      );

    const existing =
      nodesById.get(id);

    const fallbackLabel =
      `${normalizedType} ${rawId}`;

    return addNode({
      id,
      rawId,
      type:
        normalizedType,
      label:
        cleanGraphText(label) ||
        existing?.label ||
        fallbackLabel,
      image,
      properties,
    });
  }

  function getGraphMetadataLabel({
    type,
    metadata = {},
    fallback = "",
  }) {
    const normalizedType =
      normalizeGraphType(
        type,
        "entity"
      );

    if (
      normalizedType ===
      "track"
    ) {
      return (
        metadata.trackTitle ||
        metadata.songTitle ||
        metadata.title ||
        metadata.name ||
        fallback
      );
    }

    if (
      normalizedType ===
      "album"
    ) {
      return (
        metadata.albumTitle ||
        metadata.title ||
        metadata.name ||
        fallback
      );
    }

    if (
      normalizedType ===
      "artist"
    ) {
      return (
        metadata.artistName ||
        metadata.name ||
        fallback
      );
    }

    if (
      normalizedType ===
      "user"
    ) {
      return (
        metadata.username ||
        metadata.displayName ||
        metadata.userName ||
        fallback
      );
    }

    return (
      metadata.title ||
      metadata.name ||
      fallback
    );
  }

  function buildSyncEdgeId({
    source,
    relationship,
    target,
    suffix = "",
  }) {
    return crypto
      .createHash("sha256")
      .update(
        [
          source,
          relationship,
          target,
          suffix,
        ].join("|")
      )
      .digest("hex");
  }

  function addEdge({
    id = "",
    source,
    target,
    relationship,
    weight = 1,
    metadata = {},
  }) {
    const cleanSource =
      cleanGraphText(source);

    const cleanTarget =
      cleanGraphText(target);

    const cleanRelationship =
      cleanGraphText(
        relationship ||
        "RELATED"
      )
        .toUpperCase()
        .replace(
          /[^A-Z0-9_]/g,
          "_"
        );

    if (
      !cleanSource ||
      !cleanTarget ||
      !cleanRelationship
    ) {
      return null;
    }

    if (
      !nodesById.has(
        cleanSource
      ) ||
      !nodesById.has(
        cleanTarget
      )
    ) {
      return null;
    }

    const edgeId =
      cleanGraphText(id) ||
      buildSyncEdgeId({
        source:
          cleanSource,
        relationship:
          cleanRelationship,
        target:
          cleanTarget,
      });

    const edge = {
      id:
        edgeId,

      source:
        cleanSource,

      target:
        cleanTarget,

      relationship:
        cleanRelationship,

      weight:
        Number(weight) || 1,

      metadata:
        metadata || {},
    };

    edgesById.set(
      edgeId,
      edge
    );

    return edge;
  }

  /*
   * ======================================================
   * CORE CATALOG NODES
   * ======================================================
   */

  artistsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      addNode({
        id:
          `artist:${document.id}`,

        rawId:
          document.id,

        type:
          "artist",

        label:
          data.name ||
          data.title ||
          "Artist",

        image:
          data.picture ||
          data.image ||
          "",

        properties: {
          source:
            data.source ||
            "deezer",

          link:
            data.link ||
            "",
        },
      });
    }
  );

  albumsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      addNode({
        id:
          `album:${document.id}`,

        rawId:
          document.id,

        type:
          "album",

        label:
          data.title ||
          data.name ||
          "Album",

        image:
          data.image ||
          data.coverArt ||
          "",

        properties: {
          artistId:
            cleanGraphText(
              data.artistId ||
              data.artist?.id
            ),

          artistName:
            cleanGraphText(
              data.artistName ||
              data.artist?.name
            ),

          releaseDate:
            cleanGraphText(
              data.releaseDate ||
              data.release_date
            ),

          trackCount:
            Number(
              data.trackCount ||
              data.nb_tracks ||
              0
            ),
        },
      });
    }
  );

  tracksSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      addNode({
        id:
          `track:${document.id}`,

        rawId:
          document.id,

        type:
          "track",

        label:
          data.title ||
          data.name ||
          "Song",

        image:
          data.image ||
          data.coverArt ||
          "",

        properties: {
          artistId:
            cleanGraphText(
              data.artistId ||
              data.artist?.id
            ),

          artistName:
            cleanGraphText(
              data.artistName ||
              data.artist?.name
            ),

          albumId:
            cleanGraphText(
              data.albumId ||
              data.album?.id
            ),

          albumTitle:
            cleanGraphText(
              data.albumTitle ||
              data.album?.title
            ),

          preview:
            cleanGraphText(
              data.preview ||
              data.previewUrl ||
              data.playbackUrl
            ),

          duration:
            Number(
              data.duration || 0
            ),
        },
      });
    }
  );

  usersSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      addNode({
        id:
          `user:${document.id}`,

        rawId:
          document.id,

        type:
          "user",

        label:
          data.username ||
          data.displayName ||
          data.name ||
          data.email ||
          "User",

        image:
          data.avatar ||
          data.avatarLong ||
          data.profilePicture ||
          data.photoURL ||
          "",

        properties: {
          username:
            cleanGraphText(
              data.username
            ),

          displayName:
            cleanGraphText(
              data.displayName
            ),

          isPublic:
            data.isPublic !==
            false,

          followersCount:
            Number(
              data.followersCount ||
              0
            ),

          followingCount:
            Number(
              data.followingCount ||
              0
            ),
        },
      });
    }
  );

  /*
   * Ensure catalog hierarchy exists even when an older
   * Firestore graph-edge record has not been created yet.
   */
  albumsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const artistId =
        cleanGraphText(
          data.artistId ||
          data.artist?.id
        );

      if (artistId) {
        ensureEntityNode({
          type:
            "artist",
          rawId:
            artistId,
          label:
            data.artistName ||
            data.artist?.name ||
            "Artist",
        });

        addEdge({
          source:
            `artist:${artistId}`,
          target:
            `album:${document.id}`,
          relationship:
            "CREATED",
          metadata: {
            source:
              "catalog",
          },
        });
      }
    }
  );

  tracksSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const artistId =
        cleanGraphText(
          data.artistId ||
          data.artist?.id
        );

      const albumId =
        cleanGraphText(
          data.albumId ||
          data.album?.id
        );

      if (artistId) {
        ensureEntityNode({
          type:
            "artist",
          rawId:
            artistId,
          label:
            data.artistName ||
            data.artist?.name ||
            "Artist",
        });

        addEdge({
          source:
            `artist:${artistId}`,
          target:
            `track:${document.id}`,
          relationship:
            "PERFORMED",
          metadata: {
            source:
              "catalog",
          },
        });

        /*
         * Reverse direction for easy Song -> Artist browsing.
         */
        addEdge({
          source:
            `track:${document.id}`,
          target:
            `artist:${artistId}`,
          relationship:
            "BY_ARTIST",
          metadata: {
            source:
              "catalog",
          },
        });
      }

      if (albumId) {
        ensureEntityNode({
          type:
            "album",
          rawId:
            albumId,
          label:
            data.albumTitle ||
            data.album?.title ||
            "Album",
        });

        addEdge({
          source:
            `album:${albumId}`,
          target:
            `track:${document.id}`,
          relationship:
            "CONTAINS",
          metadata: {
            source:
              "catalog",
          },
        });

        /*
         * Reverse direction for easy Song -> Album browsing.
         */
        addEdge({
          source:
            `track:${document.id}`,
          target:
            `album:${albumId}`,
          relationship:
            "ON_ALBUM",
          metadata: {
            source:
              "catalog",
          },
        });
      }
    }
  );

  /*
   * ======================================================
   * EXISTING GRAPH EDGES
   * ======================================================
   */

  storedEdgesSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const source =
        graphNodeId(
          data.fromType,
          data.fromId
        );

      const target =
        graphNodeId(
          data.toType,
          data.toId
        );

      if (
        !source ||
        !target
      ) {
        return;
      }

      const edgeMetadata =
        data.metadata || {};

      ensureEntityNode({
        type:
          data.fromType,
        rawId:
          data.fromId,
        label:
          getGraphMetadataLabel({
            type:
              data.fromType,
            metadata:
              edgeMetadata,
          }),
        image:
          edgeMetadata.fromImage ||
          edgeMetadata.artistImage ||
          edgeMetadata.image ||
          "",
      });

      ensureEntityNode({
        type:
          data.toType,
        rawId:
          data.toId,
        label:
          getGraphMetadataLabel({
            type:
              data.toType,
            metadata:
              edgeMetadata,
          }),
        image:
          edgeMetadata.toImage ||
          edgeMetadata.trackImage ||
          edgeMetadata.albumImage ||
          edgeMetadata.image ||
          "",
      });

      addEdge({
        id:
          document.id,

        source,
        target,

        relationship:
          data.relationship ||
          "RELATED",

        weight:
          data.weight || 1,

        metadata: {
          ...(data.metadata ||
            {}),

          sourceCollection:
            MUSIC_GRAPH_EDGES_COLLECTION,
        },
      });
    }
  );

  /*
   * ======================================================
   * LIKES
   * User -> Song / Album / Artist
   * ======================================================
   */

  const likedMusicByUser =
    new Map();

  likesSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const musicId =
        cleanGraphText(
          data.musicId ||
          data.listenableId
        );

      const musicType =
        normalizeGraphType(
          data.type,
          "track"
        );

      if (
        !userId ||
        !musicId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          userId,
      });

      ensureEntityNode({
        type:
          musicType,
        rawId:
          musicId,
        label:
          data.name ||
          `${musicType} ${musicId}`,
        properties: {
          artistName:
            cleanGraphText(
              data.artistName
            ),
        },
      });

      addEdge({
        id:
          `like:${document.id}`,

        source:
          `user:${userId}`,

        target:
          graphNodeId(
            musicType,
            musicId
          ),

        relationship:
          "LIKED",

        weight:
          5,

        metadata: {
          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),

          name:
            cleanGraphText(
              data.name
            ),

          artistName:
            cleanGraphText(
              data.artistName
            ),
        },
      });

      if (
        musicType === "track"
      ) {
        if (
          !likedMusicByUser.has(
            userId
          )
        ) {
          likedMusicByUser.set(
            userId,
            new Set()
          );
        }

        likedMusicByUser
          .get(userId)
          .add(musicId);
      }
    }
  );

  /*
   * ======================================================
   * REVIEWS
   * User -> Review -> Song/Album/Artist
   * User -> REVIEWED -> music
   * ======================================================
   */

  reviewsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const musicId =
        cleanGraphText(
          data.listenableId ||
          data.musicId
        );

      const musicType =
        normalizeGraphType(
          data.type,
          "track"
        );

      const reviewNodeId =
        `review:${document.id}`;

      addNode({
        id:
          reviewNodeId,

        rawId:
          document.id,

        type:
          "review",

        label:
          cleanGraphText(
            data.message
          ).slice(
            0,
            80
          ) ||
          `Review ${document.id}`,

        properties: {
          message:
            cleanGraphText(
              data.message
            ),

          rating:
            Number(
              data.rating || 0
            ),

          hearted:
            data.hearted === true,

          emojiJson:
            JSON.stringify(
              Array.isArray(
                data.emoji
              )
                ? data.emoji
                : []
            ),

          upvoteCount:
            Array.isArray(
              data.upvotedBy
            )
              ? data.upvotedBy.length
              : 0,

          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),

          updatedAt:
            serializeGraphTimestamp(
              data.updatedAt
            ),
        },
      });

      if (userId) {
        ensureEntityNode({
          type:
            "user",
          rawId:
            userId,
          label:
            data.username ||
            "User",
        });

        addEdge({
          source:
            `user:${userId}`,
          target:
            reviewNodeId,
          relationship:
            "AUTHORED",
          metadata: {
            contentType:
              "review",
          },
        });
      }

      if (musicId) {
        ensureEntityNode({
          type:
            musicType,
          rawId:
            musicId,
        });

        const musicNodeId =
          graphNodeId(
            musicType,
            musicId
          );

        addEdge({
          source:
            reviewNodeId,
          target:
            musicNodeId,
          relationship:
            "REVIEWS",
          metadata: {
            rating:
              Number(
                data.rating || 0
              ),
            hearted:
              data.hearted ===
              true,
          },
        });

        if (userId) {
          addEdge({
            id:
              `reviewed:${document.id}`,

            source:
              `user:${userId}`,

            target:
              musicNodeId,

            relationship:
              "REVIEWED",

            weight:
              Math.max(
                Number(
                  data.rating || 0
                ),
                data.hearted ===
                  true
                  ? 5
                  : 1
              ),

            metadata: {
              reviewId:
                document.id,

              rating:
                Number(
                  data.rating || 0
                ),

              hearted:
                data.hearted ===
                true,
            },
          });
        }
      }

      /*
       * Upvoters also connect to the review.
       */
      if (
        Array.isArray(
          data.upvotedBy
        )
      ) {
        data.upvotedBy.forEach(
          (upvoterId) => {
            const cleanUpvoterId =
              cleanGraphText(
                upvoterId
              );

            if (!cleanUpvoterId) {
              return;
            }

            ensureEntityNode({
              type:
                "user",
              rawId:
                cleanUpvoterId,
            });

            addEdge({
              source:
                `user:${cleanUpvoterId}`,
              target:
                reviewNodeId,
              relationship:
                "UPVOTED",
            });
          }
        );
      }
    }
  );

  reviewRepliesSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const reviewId =
        cleanGraphText(
          data.reviewId ||
          data.rid
        );

      const replyNodeId =
        `reply:${document.id}`;

      addNode({
        id:
          replyNodeId,

        rawId:
          document.id,

        type:
          "reply",

        label:
          cleanGraphText(
            data.message ||
            data.text
          ).slice(
            0,
            80
          ) ||
          `Reply ${document.id}`,

        properties: {
          message:
            cleanGraphText(
              data.message ||
              data.text
            ),

          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),
        },
      });

      if (userId) {
        ensureEntityNode({
          type:
            "user",
          rawId:
            userId,
          label:
            data.username ||
            "User",
        });

        addEdge({
          source:
            `user:${userId}`,
          target:
            replyNodeId,
          relationship:
            "AUTHORED",
          metadata: {
            contentType:
              "reply",
          },
        });
      }

      if (reviewId) {
        ensureEntityNode({
          type:
            "review",
          rawId:
            reviewId,
          label:
            `Review ${reviewId}`,
        });

        addEdge({
          source:
            replyNodeId,
          target:
            `review:${reviewId}`,
          relationship:
            "REPLIES_TO",
        });
      }
    }
  );

  /*
   * ======================================================
   * FOLLOWING + MUTUAL FRIENDS
   * ======================================================
   */

  const followPairs =
    new Set();

  followsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const followerId =
        cleanGraphText(
          data.followerId
        );

      const followedId =
        cleanGraphText(
          data.followedId
        );

      if (
        !followerId ||
        !followedId ||
        followerId ===
          followedId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          followerId,
      });

      ensureEntityNode({
        type:
          "user",
        rawId:
          followedId,
      });

      followPairs.add(
        `${followerId}|${followedId}`
      );

      addEdge({
        id:
          `follow:${document.id}`,

        source:
          `user:${followerId}`,

        target:
          `user:${followedId}`,

        relationship:
          "FOLLOWS",

        metadata: {
          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),
        },
      });
    }
  );

  const friendPairs =
    new Set();

  followPairs.forEach(
    (pair) => {
      const [
        firstUserId,
        secondUserId,
      ] = pair.split("|");

      if (
        !followPairs.has(
          `${secondUserId}|${firstUserId}`
        )
      ) {
        return;
      }

      const pairKey =
        [
          firstUserId,
          secondUserId,
        ]
          .sort()
          .join("|");

      if (
        friendPairs.has(
          pairKey
        )
      ) {
        return;
      }

      friendPairs.add(
        pairKey
      );

      addEdge({
        source:
          `user:${firstUserId}`,
        target:
          `user:${secondUserId}`,
        relationship:
          "FRIENDS_WITH",
        metadata: {
          mutual:
            true,
        },
      });

      addEdge({
        source:
          `user:${secondUserId}`,
        target:
          `user:${firstUserId}`,
        relationship:
          "FRIENDS_WITH",
        metadata: {
          mutual:
            true,
        },
      });
    }
  );

  /*
   * Pending requests are useful graph connections.
   * We intentionally do NOT create NOT_FOLLOWING edges:
   * absence of FOLLOWS already means not following, and
   * generating every missing pair would grow O(users²).
   */
  followRequestsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const followerId =
        cleanGraphText(
          data.followerId ||
          data.fromUserId ||
          data.requesterId
        );

      const followedId =
        cleanGraphText(
          data.followedId ||
          data.toUserId ||
          data.requestedUserId
        );

      if (
        !followerId ||
        !followedId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          followerId,
      });

      ensureEntityNode({
        type:
          "user",
        rawId:
          followedId,
      });

      addEdge({
        id:
          `follow-request:${document.id}`,

        source:
          `user:${followerId}`,

        target:
          `user:${followedId}`,

        relationship:
          "REQUESTED_TO_FOLLOW",

        metadata: {
          status:
            cleanGraphText(
              data.status ||
              "pending"
            ),

          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),
        },
      });
    }
  );

  /*
   * ======================================================
   * SHARING
   * User -> music
   * User -> User
   * ======================================================
   */

  musicSharesSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const fromUserId =
        cleanGraphText(
          data.fromUserId
        );

      const toUserId =
        cleanGraphText(
          data.toUserId
        );

      const itemId =
        cleanGraphText(
          data.itemId
        );

      const itemType =
        normalizeGraphType(
          data.type,
          "track"
        );

      if (fromUserId) {
        ensureEntityNode({
          type:
            "user",
          rawId:
            fromUserId,
          label:
            data.sender?.username ||
            "User",
        });
      }

      if (toUserId) {
        ensureEntityNode({
          type:
            "user",
          rawId:
            toUserId,
        });
      }

      if (itemId) {
        ensureEntityNode({
          type:
            itemType,
          rawId:
            itemId,
          label:
            data.item?.title ||
            data.item?.name ||
            `${itemType} ${itemId}`,
          image:
            data.item?.image ||
            data.item?.coverArt ||
            "",
        });
      }

      if (
        fromUserId &&
        toUserId
      ) {
        addEdge({
          id:
            `shared-with:${document.id}`,

          source:
            `user:${fromUserId}`,

          target:
            `user:${toUserId}`,

          relationship:
            "SHARED_WITH",

          metadata: {
            shareId:
              document.id,

            itemId,

            itemType,

            comment:
              cleanGraphText(
                data.comment
              ),

            createdAt:
              serializeGraphTimestamp(
                data.createdAt
              ),
          },
        });
      }

      if (
        fromUserId &&
        itemId
      ) {
        addEdge({
          id:
            `shared-item:${document.id}`,

          source:
            `user:${fromUserId}`,

          target:
            graphNodeId(
              itemType,
              itemId
            ),

          relationship:
            "SHARED",

          weight:
            3,

          metadata: {
            toUserId,
            shareId:
              document.id,
          },
        });
      }

      if (
        toUserId &&
        itemId
      ) {
        addEdge({
          id:
            `received-item:${document.id}`,

          source:
            `user:${toUserId}`,

          target:
            graphNodeId(
              itemType,
              itemId
            ),

          relationship:
            "RECEIVED",

          metadata: {
            fromUserId,
            shareId:
              document.id,
          },
        });
      }
    }
  );

  /*
   * ======================================================
   * RECENTLY VIEWED
   * ======================================================
   */

  recentlyViewedSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const itemId =
        cleanGraphText(
          data.itemId ||
          data.listenableId
        );

      const itemType =
        normalizeGraphType(
          data.type,
          "track"
        );

      if (
        !userId ||
        !itemId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          userId,
      });

      ensureEntityNode({
        type:
          itemType,
        rawId:
          itemId,
        label:
          data.title ||
          data.name ||
          `${itemType} ${itemId}`,
        image:
          data.image ||
          data.coverArt ||
          "",
      });

      addEdge({
        id:
          `viewed:${document.id}`,

        source:
          `user:${userId}`,

        target:
          graphNodeId(
            itemType,
            itemId
          ),

        relationship:
          "VIEWED",

        metadata: {
          viewedAt:
            serializeGraphTimestamp(
              data.viewedAt
            ),
        },
      });
    }
  );

  /*
   * ======================================================
   * RECOMMENDATION SEEDS
   * User -> music used to build taste profile
   * ======================================================
   */

  recommendationSeedsSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const musicId =
        cleanGraphText(
          data.musicId
        );

      const musicType =
        normalizeGraphType(
          data.type,
          "track"
        );

      if (
        !userId ||
        !musicId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          userId,
      });

      ensureEntityNode({
        type:
          musicType,
        rawId:
          musicId,
        label:
          data.name ||
          `${musicType} ${musicId}`,
        properties: {
          artistName:
            cleanGraphText(
              data.artistName
            ),
        },
      });

      addEdge({
        id:
          `seed:${document.id}`,

        source:
          `user:${userId}`,

        target:
          graphNodeId(
            musicType,
            musicId
          ),

        relationship:
          "TASTE_SEED",

        weight:
          data.reason ===
          "favourite"
            ? 5
            : 3,

        metadata: {
          reason:
            cleanGraphText(
              data.reason ||
              "like"
            ),

          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),

          updatedAt:
            serializeGraphTimestamp(
              data.updatedAt
            ),
        },
      });
    }
  );

  /*
   * ======================================================
   * RECOMMENDATIONS ACTUALLY SERVED
   * User -> Song
   * ======================================================
   */

  feedServedSnapshot.docs.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId
        );

      const musicId =
        cleanGraphText(
          data.musicId
        );

      const musicType =
        normalizeGraphType(
          data.type,
          "track"
        );

      if (
        !userId ||
        !musicId
      ) {
        return;
      }

      ensureEntityNode({
        type:
          "user",
        rawId:
          userId,
      });

      ensureEntityNode({
        type:
          musicType,
        rawId:
          musicId,
      });

      const source =
        cleanGraphText(
          data.source ||
          "recommendation"
        ).toLowerCase();

      const relationship =
        source.includes(
          "friend"
        )
          ? "FRIEND_RECOMMENDED"
          : "RECOMMENDED";

      addEdge({
        id:
          `served:${document.id}`,

        source:
          `user:${userId}`,

        target:
          graphNodeId(
            musicType,
            musicId
          ),

        relationship,

        metadata: {
          source,

          servedAt:
            serializeGraphTimestamp(
              data.servedAt
            ),
        },
      });
    }
  );

  /*
   * ======================================================
   * DERIVED SIMILAR TASTE
   *
   * Users become related when they share liked songs.
   * This is stored only when at least one common like exists.
   * ======================================================
   */

  const likedUsers =
    [
      ...likedMusicByUser.keys(),
    ];

  for (
    let firstIndex = 0;
    firstIndex <
      likedUsers.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
        likedUsers.length;
      secondIndex += 1
    ) {
      const firstUserId =
        likedUsers[
          firstIndex
        ];

      const secondUserId =
        likedUsers[
          secondIndex
        ];

      const firstLikes =
        likedMusicByUser.get(
          firstUserId
        ) ||
        new Set();

      const secondLikes =
        likedMusicByUser.get(
          secondUserId
        ) ||
        new Set();

      const sharedTrackIds =
        [
          ...firstLikes,
        ].filter(
          (trackId) =>
            secondLikes.has(
              trackId
            )
        );

      if (
        sharedTrackIds.length ===
        0
      ) {
        continue;
      }

      const similarityWeight =
        sharedTrackIds.length;

      addEdge({
        source:
          `user:${firstUserId}`,
        target:
          `user:${secondUserId}`,
        relationship:
          "SIMILAR_TASTE",
        weight:
          similarityWeight,
        metadata: {
          sharedLikeCount:
            sharedTrackIds.length,

          sharedTrackIds:
            sharedTrackIds.slice(
              0,
              50
            ),
        },
      });

      addEdge({
        source:
          `user:${secondUserId}`,
        target:
          `user:${firstUserId}`,
        relationship:
          "SIMILAR_TASTE",
        weight:
          similarityWeight,
        metadata: {
          sharedLikeCount:
            sharedTrackIds.length,

          sharedTrackIds:
            sharedTrackIds.slice(
              0,
              50
            ),
        },
      });
    }
  }

  /*
   * ======================================================
   * OPTIONAL POSTS
   *
   * Supports either posts or feedPosts without breaking when
   * those collections are empty or use slightly different
   * field names.
   * ======================================================
   */

  const allPostDocuments = [
    ...postsSnapshot.docs,
    ...feedPostsSnapshot.docs,
  ];

  allPostDocuments.forEach(
    (document) => {
      const data =
        document.data() || {};

      const userId =
        cleanGraphText(
          data.userId ||
          data.uid ||
          data.authorId ||
          data.createdBy
        );

      const musicId =
        cleanGraphText(
          data.musicId ||
          data.listenableId ||
          data.itemId ||
          data.targetId
        );

      const musicType =
        normalizeGraphType(
          data.type ||
          data.itemType,
          "track"
        );

      const postNodeId =
        `post:${document.id}`;

      addNode({
        id:
          postNodeId,

        rawId:
          document.id,

        type:
          "post",

        label:
          cleanGraphText(
            data.message ||
            data.text ||
            data.caption ||
            data.content
          ).slice(
            0,
            80
          ) ||
          `Post ${document.id}`,

        properties: {
          message:
            cleanGraphText(
              data.message ||
              data.text ||
              data.caption ||
              data.content
            ),

          createdAt:
            serializeGraphTimestamp(
              data.createdAt
            ),
        },
      });

      if (userId) {
        ensureEntityNode({
          type:
            "user",
          rawId:
            userId,
        });

        addEdge({
          source:
            `user:${userId}`,
          target:
            postNodeId,
          relationship:
            "AUTHORED",
          metadata: {
            contentType:
              "post",
          },
        });
      }

      if (musicId) {
        ensureEntityNode({
          type:
            musicType,
          rawId:
            musicId,
        });

        addEdge({
          source:
            postNodeId,
          target:
            graphNodeId(
              musicType,
              musicId
            ),
          relationship:
            "ABOUT",
        });

        if (userId) {
          addEdge({
            source:
              `user:${userId}`,
            target:
              graphNodeId(
                musicType,
                musicId
              ),
            relationship:
              "POSTED_ABOUT",
            metadata: {
              postId:
                document.id,
            },
          });
        }
      }
    }
  );

  /*
   * Never call Deezer while rebuilding Neo4j.
   *
   * Neo4j synchronization must use only Firestore catalog data
   * and metadata already stored by Treble. Calling Deezer for
   * thousands of graph nodes consumed the shared Deezer quota and
   * caused normal feed and playback requests to fail.
   */
  const unresolvedAfterHydration =
    [
      ...nodesById.values(),
    ].filter((node) => {
      return (
        [
          "track",
          "album",
          "artist",
        ].includes(
          node.type
        ) &&
        isPlaceholderGraphLabel({
          label:
            node.label,
          id:
            node.id,
          rawId:
            node.rawId,
          type:
            node.type,
        })
      );
    }).length;

  console.log(
    `[Neo4j] Placeholder music names remaining from Firestore: ${unresolvedAfterHydration}. No Deezer requests were made by the graph sync.`
  );

  const nodes =
    [
      ...nodesById.values(),
    ];

  const edges =
    [
      ...edgesById.values(),
    ];

  return {
    nodes,
    edges,

    counts: {
      nodes:
        nodes.length,

      edges:
        edges.length,

      tracks:
        tracksSnapshot.size,

      albums:
        albumsSnapshot.size,

      artists:
        artistsSnapshot.size,

      users:
        usersSnapshot.size,

      likes:
        likesSnapshot.size,

      reviews:
        reviewsSnapshot.size,

      reviewReplies:
        reviewRepliesSnapshot.size,

      follows:
        followsSnapshot.size,

      mutualFriendPairs:
        friendPairs.size,

      followRequests:
        followRequestsSnapshot.size,

      shares:
        musicSharesSnapshot.size,

      recentlyViewed:
        recentlyViewedSnapshot.size,

      recommendationSeeds:
        recommendationSeedsSnapshot.size,

      recommendationsServed:
        feedServedSnapshot.size,

      posts:
        allPostDocuments.length,

      storedGraphEdges:
        storedEdgesSnapshot.size,

      unresolvedMusicNames:
        unresolvedAfterHydration,
    },
  };
}

async function runNeo4jSync(
  reason = "manual"
) {
  if (neo4jSyncRunning) {
    console.log(
      `[Neo4j] Sync skipped because another sync is already running. Reason: ${reason}`
    );

    return {
      ok: true,
      skipped: true,
      reason:
        "Another synchronization is already running.",
      running:
        true,
      lastResult:
        lastNeo4jSyncResult,
    };
  }

  neo4jSyncRunning = true;

  const startedAt =
    new Date().toISOString();

  try {
    console.log(
      `[Neo4j] Building complete Firestore graph. Reason: ${reason}`
    );

    const graph =
      await buildCompleteMusicGraph();

    console.log(
      `[Neo4j] Firestore graph ready: ${graph.counts.nodes} nodes, ${graph.counts.edges} valid relationships, ${graph.counts.skippedEdges} skipped relationships`
    );

    const syncResult =
      await syncGraphToNeo4j(
        graph
      );

    lastNeo4jSyncResult = {
      ok: true,
      reason,
      startedAt,
      completedAt:
        new Date().toISOString(),
      sourceCounts:
        graph.counts,
      ...syncResult,
    };

    return lastNeo4jSyncResult;
  } catch (error) {
    console.error(
      "[Neo4j] Synchronization failed:",
      error
    );

    lastNeo4jSyncResult = {
      ok: false,
      reason,
      startedAt,
      completedAt:
        new Date().toISOString(),
      error:
        error?.message ||
        "Neo4j synchronization failed.",
    };

    throw error;
  } finally {
    neo4jSyncRunning = false;
  }
}


app.get("/admin/music-graph", async (req, res) => {
  try {
    const parsedLimit =
      Number.parseInt(
        req.query.limit,
        10
      );

    const limit =
      Math.min(
        Math.max(
          Number.isNaN(parsedLimit)
            ? 1000
            : parsedLimit,
          1
        ),
        5000
      );

    const includeUsers =
      String(
        req.query.includeUsers ||
        "true"
      ) !== "false";

    const [
      tracksSnapshot,
      albumsSnapshot,
      artistsSnapshot,
      usersSnapshot,
      edgesSnapshot,
    ] = await Promise.all([
      db
        .collection(MUSIC_TRACKS_COLLECTION)
        .limit(limit)
        .get(),
      db
        .collection(MUSIC_ALBUMS_COLLECTION)
        .limit(limit)
        .get(),
      db
        .collection(MUSIC_ARTISTS_COLLECTION)
        .limit(limit)
        .get(),
      includeUsers
        ? db
            .collection("users")
            .limit(limit)
            .get()
        : Promise.resolve({
            docs: [],
          }),
      db
        .collection(MUSIC_GRAPH_EDGES_COLLECTION)
        .limit(limit * 5)
        .get(),
    ]);

    const nodes = [];

    artistsSnapshot.docs.forEach(
      (document) => {
        const data =
          document.data() || {};

        nodes.push({
          id:
            `artist:${document.id}`,
          rawId:
            document.id,
          type:
            "artist",
          label:
            data.name ||
            "Artist",
          image:
            data.picture || "",
        });
      }
    );

    albumsSnapshot.docs.forEach(
      (document) => {
        const data =
          document.data() || {};

        nodes.push({
          id:
            `album:${document.id}`,
          rawId:
            document.id,
          type:
            "album",
          label:
            data.title ||
            "Album",
          image:
            data.image || "",
        });
      }
    );

    tracksSnapshot.docs.forEach(
      (document) => {
        const data =
          document.data() || {};

        nodes.push({
          id:
            `track:${document.id}`,
          rawId:
            document.id,
          type:
            "track",
          label:
            data.title ||
            "Song",
          image:
            data.image || "",
        });
      }
    );

    usersSnapshot.docs.forEach(
      (document) => {
        const data =
          document.data() || {};

        nodes.push({
          id:
            `user:${document.id}`,
          rawId:
            document.id,
          type:
            "user",
          label:
            data.username ||
            data.displayName ||
            "User",
          image:
            data.avatar ||
            data.profilePicture ||
            "",
        });
      }
    );

    const nodeIds =
      new Set(
        nodes.map(
          (node) => node.id
        )
      );

    const edges =
      edgesSnapshot.docs
        .map((document) => {
          const data =
            document.data() || {};

          return {
            id:
              document.id,
            source:
              `${data.fromType}:${data.fromId}`,
            target:
              `${data.toType}:${data.toId}`,
            relationship:
              data.relationship ||
              "RELATED",
            weight:
              Number(
                data.weight || 1
              ),
            metadata:
              data.metadata || {},
          };
        })
        .filter(
          (edge) =>
            nodeIds.has(
              edge.source
            ) &&
            nodeIds.has(
              edge.target
            )
        );

    return res.json({
      ok: true,
      nodes,
      edges,
      counts: {
        nodes:
          nodes.length,
        edges:
          edges.length,
      },
    });
  } catch (error) {
    console.error(
      "GET /admin/music-graph error:",
      error
    );

    return res.status(500).json({
      ok: false,
      nodes: [],
      edges: [],
      error: error.message,
    });
  }
});

/*
 * Manually trigger a complete Firestore -> Neo4j sync.
 *
 * Header required:
 * x-admin-sync-key: value of NEO4J_SYNC_SECRET
 */
app.post(
  "/admin/neo4j-sync",
  async (req, res) => {
    try {
      const configuredSecret =
        String(
          process.env
            .NEO4J_SYNC_SECRET ||
          ""
        );

      const receivedSecret =
        String(
          req.get(
            "x-admin-sync-key"
          ) ||
          ""
        );

      if (!configuredSecret) {
        return res
          .status(503)
          .json({
            ok: false,
            error:
              "NEO4J_SYNC_SECRET is not configured.",
          });
      }

      if (
        !receivedSecret ||
        receivedSecret !==
          configuredSecret
      ) {
        return res
          .status(401)
          .json({
            ok: false,
            error:
              "Unauthorized.",
          });
      }

      const result =
        await runNeo4jSync(
          "manual-api"
        );

      return res.json(
        result
      );
    } catch (error) {
      return res
        .status(500)
        .json({
          ok: false,
          error:
            error?.message ||
            "Unable to synchronize Neo4j.",
        });
    }
  }
);

/*
 * Safe status endpoint. It does not expose credentials.
 */
app.get(
  "/admin/neo4j-sync-status",
  (req, res) => {
    return res.json({
      ok: true,
      enabled:
        NEO4J_AUTO_SYNC_ENABLED,
      running:
        neo4jSyncRunning,
      intervalMilliseconds:
        NEO4J_SYNC_INTERVAL_MS,
      lastResult:
        lastNeo4jSyncResult,
    });
  }
);






app.post("/users/share/reset-seen", async (req, res) => {
  try {
    const userId =
      String(
        req.body?.user_id ||
        ""
      ).trim();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error:
          "user_id is required.",
      });
    }

    const snapshot = await db
      .collection(
        SHARED_FEED_SEEN_COLLECTION
      )
      .where(
        "userId",
        "==",
        userId
      )
      .get();

    const batch = db.batch();

    snapshot.docs.forEach(
      (document) => {
        batch.delete(
          document.ref
        );
      }
    );

    await batch.commit();

    return res.json({
      ok: true,
      reset:
        snapshot.size,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error:
        error.message,
    });
  }
});


// ============================================================================
// ACHIEVEMENTS
// ============================================================================

const ACHIEVEMENT_EVENTS_COLLECTION =
  "achievementEvents";

function buildAchievementEventId(
  userId,
  eventType,
  itemId
) {
  return crypto
    .createHash("sha256")
    .update(
      [
        String(userId || ""),
        String(eventType || ""),
        String(itemId || ""),
      ].join("|")
    )
    .digest("hex");
}

/*
 * Record unique activity that cannot be derived from an existing collection.
 *
 * Currently used for unique song listens. Replaying the same song updates the
 * existing event instead of creating a second achievement count.
 */
app.post(
  "/users/achievements/event",
  async (req, res) => {
    try {
      const userId = String(
        req.body?.user_id || ""
      ).trim();

      const eventType = String(
        req.body?.event_type || ""
      )
        .trim()
        .toLowerCase();

      const itemId = String(
        req.body?.item_id || ""
      ).trim();

      const metadata =
        req.body?.metadata &&
        typeof req.body.metadata ===
          "object"
          ? req.body.metadata
          : {};

      if (!userId || !eventType) {
        return res.status(400).json({
          ok: false,
          error:
            "user_id and event_type are required.",
        });
      }

      if (
        eventType ===
          "song_listened" &&
        !itemId
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "item_id is required for song_listened.",
        });
      }

      const eventId =
        buildAchievementEventId(
          userId,
          eventType,
          itemId || "single"
        );

      const eventRef = db
        .collection(
          ACHIEVEMENT_EVENTS_COLLECTION
        )
        .doc(eventId);

      const existing =
        await eventRef.get();

      await eventRef.set(
        {
          id: eventId,
          userId,
          eventType,
          itemId: itemId || null,
          metadata,
          firstRecordedAt:
            existing.exists
              ? existing.data()
                  ?.firstRecordedAt ||
                FieldValue.serverTimestamp()
              : FieldValue.serverTimestamp(),
          lastRecordedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return res.status(
        existing.exists ? 200 : 201
      ).json({
        ok: true,
        recorded: !existing.exists,
        duplicate: existing.exists,
        eventId,
      });
    } catch (error) {
      console.error(
        "POST /users/achievements/event error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          "Unable to record achievement activity.",
      });
    }
  }
);

/*
 * Return live achievement totals.
 *
 * Existing collections are the source of truth:
 * - likes
 * - reviews
 * - reviewReplies
 * - follows (mutual friends)
 * - musicShares
 *
 * Song listens come from achievementEvents because playback previously had
 * no permanent server-side activity record.
 */
app.get(
  "/users/:uid/achievements",
  async (req, res) => {
    try {
      const userId = String(
        req.params?.uid || ""
      ).trim();

      if (!userId) {
        return res.status(400).json({
          ok: false,
          error: "User ID is required.",
        });
      }

      const [
        likesSnapshot,
        reviewsSnapshot,
        repliesSnapshot,
        sharesSnapshot,
        listensSnapshot,
        friendIds,
      ] = await Promise.all([
        db
          .collection("likes")
          .where(
            "userId",
            "==",
            userId
          )
          .get(),

        db
          .collection("reviews")
          .where(
            "userId",
            "==",
            userId
          )
          .get(),

        db
          .collection("reviewReplies")
          .where(
            "userId",
            "==",
            userId
          )
          .get(),

        db
          .collection(
            MUSIC_SHARES_COLLECTION
          )
          .where(
            "fromUserId",
            "==",
            userId
          )
          .get(),

        db
          .collection(
            ACHIEVEMENT_EVENTS_COLLECTION
          )
          .where(
            "userId",
            "==",
            userId
          )
          .where(
            "eventType",
            "==",
            "song_listened"
          )
          .get(),

        getMutualFriendIds(userId),
      ]);

      const stats = {
        songsListened:
          listensSnapshot.size,
        reviewsPosted:
          reviewsSnapshot.size,
        repliesPosted:
          repliesSnapshot.size,
        songsLiked:
          likesSnapshot.size,
        friendsConnected:
          friendIds.length,
        songsShared:
          sharesSnapshot.size,
      };

      return res.json({
        ok: true,
        userId,
        stats,
        updatedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "GET /users/:uid/achievements error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          "Unable to load achievements.",
      });
    }
  }
);


const server = app.listen(
  port,
  "0.0.0.0",
  async () => {
    console.log(
      `Treble backend running at http://localhost:${port}`
    );

    try {
      await verifyNeo4jConnection();

      if (
        NEO4J_AUTO_SYNC_ENABLED
      ) {
        /*
         * Perform the first complete import immediately after
         * DigitalOcean starts. The API stays available while
         * the synchronization runs in the background.
         */
        setImmediate(() => {
          runNeo4jSync(
            "server-startup"
          ).catch((error) => {
            console.error(
              "[Neo4j] Startup sync failed:",
              error
            );
          });
        });

        /*
         * Keep Aura refreshed automatically.
         */
        neo4jSyncInterval =
          setInterval(() => {
            runNeo4jSync(
              "automatic-interval"
            ).catch((error) => {
              console.error(
                "[Neo4j] Automatic sync failed:",
                error
              );
            });
          }, NEO4J_SYNC_INTERVAL_MS);

        console.log(
          `[Neo4j] Automatic synchronization enabled every ${Math.round(
            NEO4J_SYNC_INTERVAL_MS /
            60000
          )} minute(s).`
        );
      } else {
        console.log(
          "[Neo4j] Automatic synchronization is disabled."
        );
      }
    } catch (error) {
      /*
       * Keep the API online if Neo4j is temporarily unavailable.
       */
      console.error(
        "[Neo4j] Startup connection failed:",
        error
      );
    }
  }
);

server.on("error", (error) => {
  console.error(
    "Treble backend server error:",
    error
  );
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `[Server] ${signal} received. Stopping Treble backend...`
  );

  if (neo4jSyncInterval) {
    clearInterval(
      neo4jSyncInterval
    );

    neo4jSyncInterval = null;
  }

  try {
    await closeNeo4j();

    console.log(
      "[Neo4j] Driver closed."
    );
  } catch (error) {
    console.error(
      "[Neo4j] Driver close failed:",
      error
    );
  }

  server.close((error) => {
    if (error) {
      console.error(
        "[Server] Shutdown error:",
        error
      );

      process.exit(1);
      return;
    }

    console.log(
      "[Server] Treble backend stopped."
    );

    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "[Server] Forced shutdown after timeout."
    );

    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);
