const express = require("express");
const cors = require("cors");
require("dotenv").config();

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

const serviceAccount = require("./firebase-service-account.json");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

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

const db = getFirestore();
const DEEZER_API_BASE = "https://api.deezer.com";

async function fetchDeezer(path) {
  const url = `${DEEZER_API_BASE}${path}`;

  console.log(`[DEEZER] GET ${url}`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TrebleRelaunch/1.0",
    },
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Deezer returned HTTP ${response.status}: ${responseText}`
    );
  }

  const data = await response.json();

  if (data?.error) {
    throw new Error(
      `Deezer API error: ${data.error.message || "Unknown Deezer error"}`
    );
  }

  return data;
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

function createFeedItem(track, source) {
  const normalized = normalizeDeezerTrack(track);

  return {
    record_id: `deezer-${source}-${normalized.id}`,
    id: normalized.id,
    listenable_id: normalized.id,
    type: "track",
    liked: false,
    source,

    item_info: normalized,

    // Compatibility with older Treble components.
    title: normalized.title,
    name: normalized.name,
    artist: normalized.artist,
    album: normalized.album,
    image: normalized.image,
    coverArt: normalized.coverArt,
    preview: normalized.preview,
  };
}

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

    const chart = await fetchDeezer(
      `/chart/0/tracks?limit=${limit}&index=${offset}`
    );

    const timeline = (chart.data || []).map((track) =>
      createFeedItem(track, "timeline")
    );

    return res.json({
      ok: true,
      timeline,
      limit,
      offset,
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

    // Start farther down the chart so these differ from timeline items.
    const recommendationOffset = offset + 20;

    const chart = await fetchDeezer(
      `/chart/0/tracks?limit=${limit}&index=${recommendationOffset}`
    );

    const recommendations = (chart.data || []).map((track) =>
      createFeedItem(track, "recommendation")
    );

    return res.json({
      ok: true,
      recommendations,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /users/recommendations error:", error);

    return res.status(502).json({
      ok: false,
      recommendations: [],
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

    const track = await fetchDeezer(
      `/track/${encodeURIComponent(trackId)}`
    );

    return res.json(normalizeDeezerTrack(track));
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
    const { user_id, music_id, type = "track" } = req.body || {};

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
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(201).json({
      ok: true,
      liked: true,
      musicId: String(music_id),
      type,
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

    return res.json({
      ok: true,
      liked: false,
      musicId: String(music_id),
      type,
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
    const { user_id, music_id, type = "track" } = req.query;

    if (!user_id || !music_id) {
      return res.status(400).json({
        ok: false,
        error: "user_id and music_id are required.",
      });
    }

    const likeId = `${user_id}_${type}_${music_id}`;

    const snapshot = await db
      .collection("likes")
      .doc(likeId)
      .get();

    return res.json({
      ok: true,
      liked: snapshot.exists,
      musicId: String(music_id),
      type,
    });
  } catch (error) {
    console.error("GET /users/like error:", error);

    return res.status(500).json({
      ok: false,
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
    const reviews = await getUserReviews(
      req.params.uid,
      req.params.uid
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
    const reviews = await getUserReviews(
      req.params.uid,
      req.params.uid
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
    const reviews = await getUserReviews(
      req.params.uid,
      req.params.uid
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
    const reviews = await getUserReviews(
      req.params.uid,
      req.params.uid
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
      const track = await fetchDeezer(
        `/track/${encodeURIComponent(listenableId)}`
      );

      return res.json(normalizeDeezerTrack(track));
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

app.get("/users/:uid/followRequests", (req, res) => {
  res.json([]);
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Treble backend running at http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("Treble backend server error:", error);
});

process.on("SIGINT", () => {
  console.log("Stopping Treble backend...");

  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("Stopping Treble backend...");

  server.close(() => {
    process.exit(0);
  });
});