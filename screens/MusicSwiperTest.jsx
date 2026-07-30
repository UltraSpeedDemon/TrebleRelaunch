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

import { MusicSwiper } from "./MusicSwiper";

import {
  getRecommendations,
  getSongFromDeezer,
} from "../providers/rest";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";

const PAGE_SIZE = 10;

const isUsablePreviewUrl = (value) => {
  return (
    typeof value === "string" &&
    /^https?:\/\//i.test(
      value.trim()
    )
  );
};

const MusicSwiperTest = () => {
  const [songs, setSongs] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] =
    useState(true);

  const offsetRef =
    useRef(0);

  const loadingRef =
    useRef(false);

  const usedIdsRef =
    useRef(new Set());

  const parseResponse =
    useCallback(
      async (response) => {
        if (!response) {
          throw new Error(
            "The recommendation server returned no response."
          );
        }

        const responseText =
          await response.text();

        let data = {};

        try {
          data =
            responseText
              ? JSON.parse(responseText)
              : {};
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
      },
      []
    );

  const normalizeRecommendation =
    useCallback(
      async (item) => {
        const itemInfo =
          item?.item_info ||
          item ||
          {};

        const id =
          itemInfo?.id ||
          itemInfo?.listenableId ||
          itemInfo?.listenable_id ||
          item?.id;

        if (!id) {
          return null;
        }

        let previewUrl =
          itemInfo?.preview ||
          itemInfo?.audioUrl ||
          itemInfo?.previewUrl ||
          "";

        if (
          !isUsablePreviewUrl(
            previewUrl
          )
        ) {
          previewUrl = "";

          try {
            const deezerResponse =
              await getSongFromDeezer(
                String(id)
              );

            if (deezerResponse?.ok) {
              const deezerData =
                await deezerResponse.json();

              const deezerPreview =
                deezerData?.preview ||
                deezerData?.data?.preview ||
                "";

              previewUrl =
                isUsablePreviewUrl(
                  deezerPreview
                )
                  ? deezerPreview.trim()
                  : "";
            }
          } catch (error) {
            console.warn(
              `[MusicSwiperTest] Preview unavailable for ${id}:`,
              error
            );
          }
        }

        const rawArtist =
          itemInfo?.artist ||
          item?.artist ||
          null;

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

          artist:
            artistName,

          album:
            itemInfo?.album?.title ||
            itemInfo?.albumTitle ||
            "",

          audioUrl:
            previewUrl,

          imageUrl,

          albumArt:
            imageUrl
              ? {
                  uri: imageUrl,
                }
              : require(
                  "../images/albumImage.jpg"
                ),

          original:
            item,
        };
      },
      []
    );

  const loadRecommendations =
    useCallback(
      async ({
        reset = false,
      } = {}) => {
        if (loadingRef.current) {
          return;
        }

        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          Alert.alert(
            "Sign in required",
            "You must be signed in to use Music Swipe."
          );

          setLoading(false);
          return;
        }

        loadingRef.current = true;

        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        try {
          const offset =
            reset
              ? 0
              : offsetRef.current;

          const response =
            await getRecommendations(
              currentUser.uid,
              {
                limit:
                  PAGE_SIZE,
                offset,
                refresh:
                  reset,
              }
            );

          const data =
            await parseResponse(
              response
            );

          const recommendations =
            Array.isArray(
              data?.recommendations
            )
              ? data.recommendations
              : Array.isArray(data)
                ? data
                : [];

          const normalized =
            (
              await Promise.all(
                recommendations.map(
                  normalizeRecommendation
                )
              )
            ).filter(Boolean);

          const uniqueSongs =
            normalized.filter(
              (song) => {
                if (
                  usedIdsRef.current.has(
                    song.id
                  )
                ) {
                  return false;
                }

                usedIdsRef.current.add(
                  song.id
                );

                return true;
              }
            );

          if (reset) {
            usedIdsRef.current =
              new Set(
                uniqueSongs.map(
                  (song) => song.id
                )
              );

            setSongs(
              uniqueSongs
            );
          } else {
            setSongs(
              (currentSongs) => [
                ...currentSongs,
                ...uniqueSongs,
              ]
            );
          }

          offsetRef.current =
            offset +
            recommendations.length;

          setHasMore(
            recommendations.length ===
              PAGE_SIZE
          );
        } catch (error) {
          console.error(
            "[MusicSwiperTest] Recommendation error:",
            error
          );

          if (
            Platform.OS === "web"
          ) {
            window.alert(
              `Unable to load recommendations: ${error.message}`
            );
          } else {
            Alert.alert(
              "Unable to load recommendations",
              error.message
            );
          }
        } finally {
          loadingRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      },
      [
        normalizeRecommendation,
        parseResponse,
      ]
    );

  useEffect(() => {
    loadRecommendations({
      reset: true,
    });
  }, [loadRecommendations]);

  if (
    loading &&
    songs.length === 0
  ) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator
          size="large"
          color={
            colours.lightblue ||
            "#35afe5"
          }
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
        songs={songs}
        onLoadMore={() =>
          loadRecommendations({
            reset: false,
          })
        }
        loadingMore={
          loadingMore
        }
        hasMore={hasMore}
      />
    </View>
  );
};

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,

      backgroundColor:
        colours.background ||
        "#101010",
    },

    loader: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        colours.background ||
        "#101010",
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.66)",

      fontSize: 14,

      marginTop: 13,
    },
  });

export default MusicSwiperTest;
