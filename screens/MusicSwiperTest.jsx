import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { onAuthStateChanged } from "firebase/auth";

import { MusicSwiper } from "./MusicSwiper";
import {
  getRecommendations,
  getSongFromDeezer,
} from "../providers/rest";
import { auth } from "../utils/firebase";
import colours from "../styles/colours";

const PAGE_SIZE = 12;
const MAX_LOAD_ATTEMPTS = 4;
const MINIMUM_DECK_SIZE = 6;

const MusicSwiperTest = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [deckVersion, setDeckVersion] = useState(0);
  const [loadError, setLoadError] = useState("");

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const usedIdsRef = useRef(new Set());

  const parseResponse = useCallback(async (response) => {
    if (!response) {
      throw new Error("The recommendation server returned no response.");
    }

    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        responseText ||
          "The recommendation server returned invalid JSON."
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Recommendation request failed with HTTP ${response.status}`
      );
    }

    return data;
  }, []);

  const fetchFreshTrack = useCallback(async (id) => {
    try {
      const response = await getSongFromDeezer(String(id), {
        refresh: true,
      });

      if (!response?.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn(
        `[MusicSwiperTest] Unable to hydrate track ${id}:`,
        error
      );
      return null;
    }
  }, []);

  const normalizeRecommendation = useCallback(
    async (item) => {
      let itemInfo = item?.item_info || item || {};

      const id =
        itemInfo?.id ||
        itemInfo?.listenableId ||
        itemInfo?.listenable_id ||
        item?.id;

      if (!id) return null;

      let previewUrl =
        itemInfo?.preview ||
        itemInfo?.audioUrl ||
        itemInfo?.previewUrl ||
        itemInfo?.playbackUrl ||
        "";

      if (!previewUrl) {
        const hydrated = await fetchFreshTrack(id);

        if (hydrated) {
          itemInfo = {
            ...itemInfo,
            ...hydrated,
            album: hydrated.album || itemInfo.album,
            artist: hydrated.artist || itemInfo.artist,
          };

          previewUrl =
            hydrated.preview ||
            hydrated.previewUrl ||
            hydrated.playbackUrl ||
            "";
        }
      }

      // Music Swipe only displays cards that can actually play audio.
      if (!previewUrl) return null;

      const rawArtist = itemInfo?.artist || item?.artist || null;
      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            itemInfo?.artistName ||
            "Unknown Artist";

      const imageUrl =
        itemInfo?.image ||
        itemInfo?.coverArt ||
        itemInfo?.album?.cover_xl ||
        itemInfo?.album?.cover_big ||
        itemInfo?.album?.cover_medium ||
        itemInfo?.album?.cover ||
        "";

      return {
        id: String(id),
        recommendationId:
          item?.record_id ||
          itemInfo?.record_id ||
          String(id),
        title:
          itemInfo?.title ||
          itemInfo?.name ||
          "Unknown Title",
        artist: artistName,
        album:
          itemInfo?.album?.title ||
          itemInfo?.albumTitle ||
          "",
        audioUrl: previewUrl,
        imageUrl,
        albumArt: imageUrl
          ? { uri: imageUrl }
          : require("../images/albumImage.jpg"),
        original: item,
      };
    },
    [fetchFreshTrack]
  );

  const requestRecommendationPage = useCallback(
    async ({ userId, reset, attempt }) => {
      const baseOffset = reset ? 0 : offsetRef.current;
      const attemptOffset =
        attempt === 0
          ? baseOffset
          : baseOffset + attempt * PAGE_SIZE * 7;

      const response = await getRecommendations(userId, {
        limit: PAGE_SIZE,
        offset: attemptOffset,
        refresh: reset || attempt > 0,
      });

      const data = await parseResponse(response);
      const recommendations = Array.isArray(data?.recommendations)
        ? data.recommendations
        : Array.isArray(data)
          ? data
          : [];

      const normalized = (
        await Promise.all(
          recommendations.map(normalizeRecommendation)
        )
      ).filter(Boolean);

      return {
        recommendations,
        normalized,
        requestedOffset: attemptOffset,
      };
    },
    [normalizeRecommendation, parseResponse]
  );

  const loadRecommendations = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current) return 0;

      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        setLoading(false);
        setLoadingMore(false);
        return 0;
      }

      loadingRef.current = true;
      setLoadError("");

      if (reset) {
        setLoading(true);
        setHasMore(true);
        offsetRef.current = 0;
        usedIdsRef.current = new Set();
      } else {
        setLoadingMore(true);
      }

      try {
        const collected = [];
        let latestRawCount = 0;
        let latestOffset = reset ? 0 : offsetRef.current;

        for (
          let attempt = 0;
          attempt < MAX_LOAD_ATTEMPTS;
          attempt += 1
        ) {
          const result = await requestRecommendationPage({
            userId: currentUser.uid,
            reset,
            attempt,
          });

          latestRawCount = result.recommendations.length;
          latestOffset = result.requestedOffset;

          for (const song of result.normalized) {
            if (
              usedIdsRef.current.has(song.id) ||
              collected.some((entry) => entry.id === song.id)
            ) {
              continue;
            }

            collected.push(song);
          }

          if (
            collected.length >=
            (reset ? MINIMUM_DECK_SIZE : PAGE_SIZE / 2)
          ) {
            break;
          }
        }

        collected.forEach((song) => {
          usedIdsRef.current.add(song.id);
        });

        if (reset) {
          setSongs(collected);
          setDeckVersion((value) => value + 1);
        } else if (collected.length > 0) {
          setSongs((currentSongs) => [
            ...currentSongs,
            ...collected,
          ]);
        }

        offsetRef.current =
          latestOffset + Math.max(latestRawCount, PAGE_SIZE);

        // Keep pagination available. The backend rotates discovery
        // windows and can safely return older unliked tracks again.
        setHasMore(true);

        if (reset && collected.length === 0) {
          throw new Error(
            "No playable songs were returned after several attempts."
          );
        }

        return collected.length;
      } catch (error) {
        console.error(
          "[MusicSwiperTest] Recommendation error:",
          error
        );

        setLoadError(error.message || "Unable to load music.");

        if (reset && songs.length === 0) {
          const message =
            `Unable to load recommendations: ${error.message}`;

          if (Platform.OS === "web") {
            console.warn(message);
          } else {
            Alert.alert("Unable to load recommendations", error.message);
          }
        }

        return 0;
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [requestRecommendationPage, songs.length]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!auth.currentUser?.uid) {
      setLoading(false);
      setLoadError("You must be signed in to use Music Swipe.");
      return;
    }

    loadRecommendations({ reset: true });
  }, [authReady, loadRecommendations]);

  if (loading && songs.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator
          size="large"
          color={colours.lightblue || "#35afe5"}
        />
        <Text style={styles.loadingText}>
          Building your music deck...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MusicSwiper
        key={deckVersion}
        songs={songs}
        onLoadMore={() =>
          loadRecommendations({ reset: false })
        }
        onRetry={() =>
          loadRecommendations({ reset: true })
        }
        loadingMore={loadingMore}
        hasMore={hasMore}
      />

      {loadError && songs.length > 0 ? (
        <Text style={styles.nonBlockingError}>{loadError}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colours.background || "#101010",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colours.background || "#101010",
  },
  loadingText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 14,
    marginTop: 13,
  },
  nonBlockingError: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 8,
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    textAlign: "center",
  },
});

export default MusicSwiperTest;
