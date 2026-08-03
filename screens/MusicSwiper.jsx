import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { Audio } from "expo-av";
import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";

import {
  like,
  postRecommendations,
  setRecommendationServed,
  getSongFromDeezer,
} from "../providers/rest";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";
import { SongCardSwipe } from "./SongCardSwipe";

const SWIPE_THRESHOLD = 105;
const SWIPE_DISTANCE = 520;

/*
 * Start loading another page while several cards still remain.
 * This prevents the user from reaching the end of the current deck.
 */
const LOAD_MORE_THRESHOLD = 6;

/*
 * Wait briefly after a card changes before starting its audio.
 * This prevents fast state changes from creating and destroying
 * multiple sounds in rapid succession.
 */
const AUTOPLAY_SETTLE_MS = 180;
const LOAD_MORE_WAIT_MS = 5000;

const sleep = (milliseconds) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

export function MusicSwiper({
  songs = [],
  onLoadMore,
  loadingMore = false,
  hasMore = true,
  onRetry,
}) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isCompact = width < 700;
  const isMobileWeb = isWeb && isCompact;

  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [isDragging, setIsDragging] =
    useState(false);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [previewPlaying, setPreviewPlaying] =
    useState(false);
  const [loadingSound, setLoadingSound] =
    useState(false);
  const [audioError, setAudioError] =
    useState("");


  const translateX =
    useRef(new Animated.Value(0)).current;
  const leftOpacity =
    useRef(new Animated.Value(0)).current;
  const rightOpacity =
    useRef(new Animated.Value(0)).current;

  const soundRef = useRef(null);
  const playRequestRef = useRef(0);
  const loadMorePromiseRef = useRef(null);
  const songsRef = useRef(songs);
  const currentIndexRef = useRef(currentIndex);
  const mountedRef = useRef(true);

  songsRef.current = songs;
  currentIndexRef.current = currentIndex;

  const currentSong =
    songs[currentIndex] || null;
  const nextSong =
    songs[currentIndex + 1] || null;

  const getPreviewUrl = useCallback((song) => {
    return (
      song?.audioUrl ||
      song?.preview ||
      song?.previewUrl ||
      song?.playbackUrl ||
      song?.item_info?.preview ||
      song?.item_info?.previewUrl ||
      song?.item_info?.playbackUrl ||
      ""
    );
  }, []);

  const cardWidth =
    Math.min(
      isCompact
        ? width - 28
        : Math.max(430, width * 0.42),
      620
    );

  const cardHeight =
    Math.min(
      isCompact
        ? height * 0.64
        : height * 0.72,
      760
    );

  const rotation =
    translateX.interpolate({
      inputRange: [-300, 0, 300],
      outputRange: [
        "-11deg",
        "0deg",
        "11deg",
      ],
      extrapolate: "clamp",
    });

  const likeOpacity =
    translateX.interpolate({
      inputRange: [0, 80, 220],
      outputRange: [0, 0.35, 1],
      extrapolate: "clamp",
    });

  const skipOpacity =
    translateX.interpolate({
      inputRange: [-220, -80, 0],
      outputRange: [1, 0.35, 0],
      extrapolate: "clamp",
    });

  const cardScale =
    translateX.interpolate({
      inputRange: [-300, 0, 300],
      outputRange: [0.97, 1, 0.97],
      extrapolate: "clamp",
    });

  const unloadSound = useCallback(async () => {
    playRequestRef.current += 1;

    const activeSound = soundRef.current;
    soundRef.current = null;

    if (mountedRef.current) {
      setPreviewPlaying(false);
    }

    if (!activeSound) {
      return;
    }

    try {
      activeSound.setOnPlaybackStatusUpdate(null);
      await activeSound.unloadAsync();
    } catch (error) {
      console.warn(
        "[MusicSwiper] Could not unload preview:",
        error
      );
    }
  }, []);

  const refreshSongPreview = useCallback(
    async (
      song,
      {
        forceRefresh = false,
      } = {}
    ) => {
      const trackId =
        song?.id ||
        song?.listenableId ||
        song?.listenable_id;

      if (!trackId) {
        return null;
      }

      try {
        const response =
          await getSongFromDeezer(
            String(trackId),
            {
              refresh: true,
              forceRefresh,
            }
          );

        if (!response?.ok) {
          return null;
        }

        const deezerTrack =
          await response.json();

        const previewUrl =
          deezerTrack?.preview ||
          deezerTrack?.previewUrl ||
          deezerTrack?.playbackUrl ||
          "";

        if (!previewUrl) {
          return null;
        }

        return {
          ...song,
          ...deezerTrack,
          id: String(
            deezerTrack?.id ||
            trackId
          ),
          audioUrl: previewUrl,
          preview: previewUrl,
          previewUrl,
          playbackUrl: previewUrl,
        };
      } catch (error) {
        console.warn(
          `[MusicSwiper] Could not refresh track ${trackId}:`,
          error
        );

        return null;
      }
    },
    []
  );

  const playSong = useCallback(
    async (
      song,
      {
        restart = true,
      } = {}
    ) => {
      if (!song?.id) {
        setAudioError(
          "This recommendation does not contain a valid track ID."
        );
        return false;
      }

      /*
       * Match Feed: use a normal cache-friendly refresh before play.
       * If that fails, fall back to the preview already on the card.
       */
      const refreshedSong =
        await refreshSongPreview(
          song,
          {
            forceRefresh: false,
          }
        );

      const playableSong =
        refreshedSong || song;

      const previewUrl =
        getPreviewUrl(playableSong);

      if (!previewUrl) {
        setAudioError(
          "This recommendation does not contain a playable preview."
        );
        return false;
      }


      setLoadingSound(true);
      setAudioError("");

      try {
        /*
         * Stop the old card first. unloadSound increments the request
         * token, so the new token must be created after unloading.
         */
        await unloadSound();

        const requestId =
          playRequestRef.current + 1;
        playRequestRef.current = requestId;

        /*
         * Configure native audio once before creating the sound.
         * No microphone permission is requested.
         */
        if (!isWeb) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        }

        /*
         * Play Deezer's URL exactly as returned. Appending custom
         * parameters can invalidate signed preview URLs.
         */
        const created =
          await Audio.Sound.createAsync(
            {
              uri: previewUrl,
            },
            {
              shouldPlay: true,
              isLooping: true,
              volume: 0.68,
              positionMillis: restart ? 0 : undefined,
              progressUpdateIntervalMillis: 250,
            },
            undefined,
            true
          );

        if (
          !mountedRef.current ||
          requestId !== playRequestRef.current
        ) {
          await created.sound
            .unloadAsync()
            .catch(() => {});
          return false;
        }

        soundRef.current = created.sound;

        created.sound.setOnPlaybackStatusUpdate(
          (status) => {
            if (!mountedRef.current) {
              return;
            }

            if (!status.isLoaded) {
              if (status?.error) {
                console.warn(
                  "[MusicSwiper] Playback status error:",
                  status.error
                );
              }
              return;
            }

            setPreviewPlaying(
              Boolean(status.isPlaying)
            );
          }
        );

        setPreviewPlaying(true);
        return true;
      } catch (error) {
        console.warn(
          "[MusicSwiper] First preview failed. Force-refreshing:",
          error
        );

        await unloadSound();

        /*
         * Match Feed: only bypass every cache after a real playback
         * failure, then retry with Deezer's newly returned URL.
         */
        try {
          const forcedSong =
            await refreshSongPreview(
              song,
              {
                forceRefresh: true,
              }
            );

          const forcedPreview =
            getPreviewUrl(forcedSong);

          if (!forcedSong || !forcedPreview) {
            throw error;
          }

          const retryRequestId =
            playRequestRef.current + 1;

          playRequestRef.current =
            retryRequestId;

          const retried =
            await Audio.Sound.createAsync(
              {
                uri: forcedPreview,
              },
              {
                shouldPlay: true,
                isLooping: true,
                volume: 0.68,
                positionMillis: 0,
                progressUpdateIntervalMillis: 250,
              },
              undefined,
              true
            );

          if (
            !mountedRef.current ||
            retryRequestId !==
              playRequestRef.current
          ) {
            await retried.sound
              .unloadAsync()
              .catch(() => {});

            return false;
          }

          soundRef.current =
            retried.sound;

          retried.sound.setOnPlaybackStatusUpdate(
            (status) => {
              if (!status.isLoaded) {
                return;
              }

              setPreviewPlaying(
                Boolean(status.isPlaying)
              );
            }
          );

          setPreviewPlaying(true);
          setAudioError("");
          return true;
        } catch (retryError) {
          console.error(
            "[MusicSwiper] Forced preview retry failed:",
            retryError
          );

          setAudioError(
            "This preview could not start. Swipe to continue or press Play to retry."
          );

          return false;
        }
      } finally {
        if (mountedRef.current) {
          setLoadingSound(false);
        }
      }
    },
    [
      getPreviewUrl,
      isWeb,
      refreshSongPreview,
      unloadSound,
    ]
  );

  const playCurrentSong = useCallback(async () => {
    await playSong(
      currentSong,
      {
        restart: true,
      }
    );
  }, [
    currentSong,
    playSong,
  ]);

  const stopCurrentPreview =
    useCallback(async () => {
      await unloadSound();
      setAudioError("");
    }, [unloadSound]);

  const loadAndPlayPreview =
    useCallback(async () => {
      if (previewPlaying) {
        await stopCurrentPreview();
        return;
      }

      await playCurrentSong();
    }, [
      previewPlaying,
      stopCurrentPreview,
      playCurrentSong,
    ]);

  /*
   * Start the new card only after React has settled on that card.
   * This removes the rapid load/unload loop that made some songs
   * appear to regenerate immediately.
   */
  useEffect(() => {
    if (!currentSong) {
      return undefined;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      if (!cancelled) {
        playSong(currentSong, {
          restart: true,
        });
      }
    }, AUTOPLAY_SETTLE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    currentSong?.id,
    getPreviewUrl(currentSong),
    playSong,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        unloadSound();
      };
    }, [unloadSound])
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      unloadSound();
    };
  }, [unloadSound]);

  /*
   * Never reset the deck back to song zero merely because another
   * page is still loading. The old implementation did that and made
   * cards appear to regenerate too quickly.
   */
  useEffect(() => {
    if (
      songs.length > 0 &&
      currentIndex >= songs.length
    ) {
      setCurrentIndex(
        Math.max(0, songs.length - 1)
      );
    }
  }, [
    currentIndex,
    songs.length,
  ]);

  const requestMoreSongs =
    useCallback(async () => {
      if (
        !hasMore ||
        typeof onLoadMore !== "function"
      ) {
        return false;
      }

      if (loadMorePromiseRef.current) {
        return loadMorePromiseRef.current;
      }

      const startingLength =
        songsRef.current.length;

      const requestPromise =
        Promise.resolve(onLoadMore())
          .catch((error) => {
            console.warn(
              "[MusicSwiper] Could not load more songs:",
              error
            );
            return false;
          })
          .then(async () => {
            const startedAt = Date.now();

            while (
              mountedRef.current &&
              Date.now() - startedAt <
                LOAD_MORE_WAIT_MS
            ) {
              if (
                songsRef.current.length >
                startingLength
              ) {
                return true;
              }

              await sleep(100);
            }

            return (
              songsRef.current.length >
              startingLength
            );
          })
          .finally(() => {
            loadMorePromiseRef.current =
              null;
          });

      loadMorePromiseRef.current =
        requestPromise;

      return requestPromise;
    }, [
      hasMore,
      onLoadMore,
    ]);

  /*
   * Quietly prefetch before the visible deck is close to empty.
   * The promise guard ensures only one page request is active.
   */
  useEffect(() => {
    const remaining =
      songs.length - currentIndex - 1;

    if (
      remaining <= LOAD_MORE_THRESHOLD &&
      hasMore &&
      !loadingMore
    ) {
      requestMoreSongs();
    }
  }, [
    currentIndex,
    hasMore,
    loadingMore,
    requestMoreSongs,
    songs.length,
  ]);

  const markSongHandled =
    useCallback(
      async (song, direction) => {
        const user = auth.currentUser;

        if (
          !user?.uid ||
          !song?.id
        ) {
          return;
        }

        try {
          await setRecommendationServed(
            user.uid,
            song.recommendationId ||
              song.recordId ||
              song.id
          );
        } catch (error) {
          console.warn(
            "[MusicSwiper] Could not mark recommendation served:",
            error
          );
        }

        if (direction !== "right") {
          return;
        }

        try {
          const likeResponse =
            await like(
              user.uid,
              String(song.id),
              "track"
            );

          if (
            likeResponse &&
            likeResponse.ok === false
          ) {
            throw new Error(
              `Like failed with HTTP ${likeResponse.status}`
            );
          }

          await postRecommendations(
            user.uid,
            String(song.id),
            "track",
            song.title || "",
            typeof song.artist === "string"
              ? song.artist
              : song.artist?.name || "",
            "like"
          );
        } catch (error) {
          console.error(
            "[MusicSwiper] Like error:",
            error
          );
        }
      },
      []
    );

  const resetPosition =
    useCallback(() => {
      Animated.spring(
        translateX,
        {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 75,
        }
      ).start();

      leftOpacity.setValue(0);
      rightOpacity.setValue(0);
    }, [
      leftOpacity,
      rightOpacity,
      translateX,
    ]);

  const moveToNext =
    useCallback(() => {
      setCurrentIndex((index) => {
        const latestLength =
          songsRef.current.length;

        if (index + 1 < latestLength) {
          return index + 1;
        }

        return index;
      });

      translateX.setValue(0);
      leftOpacity.setValue(0);
      rightOpacity.setValue(0);
    }, [
      leftOpacity,
      rightOpacity,
      translateX,
    ]);

  const ensureNextSong =
    useCallback(async () => {
      const index =
        currentIndexRef.current;

      if (
        index + 1 <
        songsRef.current.length
      ) {
        return true;
      }

      const loaded =
        await requestMoreSongs();

      return (
        loaded &&
        currentIndexRef.current + 1 <
          songsRef.current.length
      );
    }, [requestMoreSongs]);

  const handleSwipe =
    useCallback(
      async (direction) => {
        if (
          actionLoading ||
          !currentSong
        ) {
          return;
        }

        setActionLoading(true);
        setIsDragging(false);

        /*
         * Do not throw the visible card away until the following
         * card is ready. This produces an endless, smooth deck
         * instead of briefly showing an empty/loading screen.
         */
        const hasNextSong =
          await ensureNextSong();

        if (!hasNextSong) {
          setActionLoading(false);
          resetPosition();
          return;
        }

        const handledSong = currentSong;

        await unloadSound();

        markSongHandled(
          handledSong,
          direction
        );

        const target =
          direction === "left"
            ? -SWIPE_DISTANCE
            : SWIPE_DISTANCE;

        const actionOpacity =
          direction === "left"
            ? leftOpacity
            : rightOpacity;

        Animated.parallel([
          Animated.timing(
            translateX,
            {
              toValue: target,
              duration: 285,
              useNativeDriver: true,
            }
          ),

          Animated.sequence([
            Animated.timing(
              actionOpacity,
              {
                toValue: 1,
                duration: 120,
                useNativeDriver: true,
              }
            ),

            Animated.timing(
              actionOpacity,
              {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
              }
            ),
          ]),
        ]).start(() => {
          const nextIndex =
            currentIndexRef.current + 1;

          moveToNext();

          requestAnimationFrame(() => {
            if (mountedRef.current) {
              setActionLoading(false);

              const next =
                songsRef.current[nextIndex];

              if (next) {
                playSong(next, {
                  restart: true,
                });
              }
            }
          });
        });
      },
      [
        actionLoading,
        currentSong,
        ensureNextSong,
        leftOpacity,
        markSongHandled,
        moveToNext,
        playSong,
        resetPosition,
        rightOpacity,
        translateX,
        unloadSound,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => !actionLoading,

          onMoveShouldSetPanResponder:
            (_, gestureState) =>
              !actionLoading &&
              Math.abs(gestureState.dx) > 4,

          onPanResponderGrant: () => {
            setIsDragging(true);
            translateX.stopAnimation();
          },

          onPanResponderMove:
            Animated.event(
              [
                null,
                {
                  dx: translateX,
                },
              ],
              {
                useNativeDriver: false,
              }
            ),

          onPanResponderRelease:
            (_, gestureState) => {
              setIsDragging(false);

              if (
                gestureState.dx >
                SWIPE_THRESHOLD
              ) {
                handleSwipe("right");
                return;
              }

              if (
                gestureState.dx <
                -SWIPE_THRESHOLD
              ) {
                handleSwipe("left");
                return;
              }

              resetPosition();
            },

          onPanResponderTerminate: () => {
            setIsDragging(false);
            resetPosition();
          },
        }),
      [
        actionLoading,
        handleSwipe,
        resetPosition,
        translateX,
      ]
    );

  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      const tagName =
        event?.target?.tagName;

      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA"
      ) {
        return;
      }

      const key =
        String(event.key || "")
          .toLowerCase();

      if (
        event.key === "ArrowLeft" ||
        key === "a"
      ) {
        event.preventDefault();
        handleSwipe("left");
      }

      if (
        event.key === "ArrowRight" ||
        key === "d"
      ) {
        event.preventDefault();
        handleSwipe("right");
      }

      if (key === "m") {
        event.preventDefault();
        loadAndPlayPreview();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    handleSwipe,
    isWeb,
    loadAndPlayPreview,
  ]);

  if (!currentSong) {
    return (
      <View style={styles.emptyContainer}>
        {loadingMore ? (
          <ActivityIndicator
            size="large"
            color={
              colours.lightblue ||
              "#35afe5"
            }
          />
        ) : (
          <>
            <FontAwesome
              name="music"
              size={50}
              color="rgba(255,255,255,0.45)"
            />

            <Text style={styles.emptyTitle}>
              No recommendations available
            </Text>

            <Text style={styles.emptyText}>
              We could not build the deck right now.
              Check the connection and try again.
            </Text>

            {typeof onRetry === "function" ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <FontAwesome
                  name="refresh"
                  size={16}
                  color="#ffffff"
                />
                <Text style={styles.retryButtonText}>
                  Reload songs
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          colours.background ||
            "#101010",
          "#111925",
          colours.background ||
            "#101010",
        ]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>
            MUSIC SWIPE
          </Text>

          <Text style={styles.mainTitle}>
            Swipe to Discover
          </Text>

          <Text style={styles.subtitle}>
            Swipe right to like. Swipe left
            to skip.
          </Text>
        </View>

        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            {currentIndex + 1}
          </Text>
        </View>
      </View>

      {isWeb && !isCompact ? (
        <View style={styles.keyboardHint}>
          <Text style={styles.keyboardHintText}>
            Drag with your mouse • ← / A skip
            • → / D like • M mute
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.deckContainer,
          {
            width: cardWidth,
            height: cardHeight,
          },
        ]}
      >

        {nextSong ? (
          <View
            style={[
              styles.nextCard,
              {
                width: cardWidth,
                height: cardHeight,
              },
            ]}
          >
            <SongCardSwipe
              song={nextSong}
              compact={isCompact}
            />
          </View>
        ) : null}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.swipeCard,
            {
              width: cardWidth,
              height: cardHeight,
              cursor: isWeb
                ? isDragging
                  ? "grabbing"
                  : "grab"
                : undefined,

              transform: [
                {
                  translateX,
                },
                {
                  rotate: rotation,
                },
                {
                  scale: cardScale,
                },
              ],
            },
          ]}
        >
          <SongCardSwipe
            song={currentSong}
            compact={isCompact}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.actionStamp,
              styles.skipStamp,
              {
                opacity: skipOpacity,
              },
            ]}
          >
            <Text style={styles.skipStampText}>
              SKIP
            </Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.actionStamp,
              styles.likeStamp,
              {
                opacity: likeOpacity,
              },
            ]}
          >
            <Text style={styles.likeStampText}>
              LIKE
            </Text>
          </Animated.View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.directionGlow,
            styles.leftGlow,
            {
              opacity: leftOpacity,
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.directionGlow,
            styles.rightGlow,
            {
              opacity: rightOpacity,
            },
          ]}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.skipButton,
          ]}
          onPress={() =>
            handleSwipe("left")
          }
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          <FontAwesome
            name="times"
            size={29}
            color="#ff5a67"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.muteButton,
          ]}
          onPress={async () => {
            if (previewPlaying) {
              await stopCurrentPreview();
            } else {
              await loadAndPlayPreview();
            }
          }}
          activeOpacity={0.8}
        >
          {loadingSound ? (
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />
          ) : (
            <FontAwesome
              name={
                previewPlaying
                  ? "volume-up"
                  : "play"
              }
              size={24}
              color="#ffffff"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.likeButton,
          ]}
          onPress={() =>
            handleSwipe("right")
          }
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          <FontAwesome
            name="heart"
            size={26}
            color={
              colours.lightblue ||
              "#35afe5"
            }
          />
        </TouchableOpacity>
      </View>

      {audioError ? (
        <Text style={styles.audioStatusText}>
          {audioError}
        </Text>
      ) : null}

      {isCompact ? (
        <View style={styles.mobileFooter}>
          <TouchableOpacity
            style={styles.mobileBackButton}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.8}
          >
            <FontAwesome
              name="arrow-left"
              size={16}
              color="#ffffff"
            />

            <Text style={styles.backButtonText}>
              Back
            </Text>
          </TouchableOpacity>

          {loadingMore ? (
            <View style={styles.mobileLoadingMoreRow}>
              <ActivityIndicator
                size="small"
                color={
                  colours.lightblue ||
                  "#35afe5"
                }
              />

              <Text style={styles.loadingMoreText}>
                Loading more songs...
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.8}
          >
            <FontAwesome
              name="arrow-left"
              size={16}
              color="#ffffff"
            />

            <Text style={styles.backButtonText}>
              Back
            </Text>
          </TouchableOpacity>

          {loadingMore ? (
            <View style={styles.loadingMoreRow}>
              <ActivityIndicator
                size="small"
                color={
                  colours.lightblue ||
                  "#35afe5"
                }
              />

              <Text style={styles.loadingMoreText}>
                Loading more songs...
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,

      alignItems: "center",

      paddingTop: 26,
      paddingHorizontal: 16,
      paddingBottom: 18,

      backgroundColor:
        colours.background ||
        "#101010",

      overflow: "hidden",
    },

    header: {
      width: "100%",
      maxWidth: 920,

      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent:
        "space-between",

      marginBottom: 8,
    },

    eyebrow: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 2,
    },

    mainTitle: {
      color: "#ffffff",

      fontSize: 28,
      lineHeight: 34,
      fontWeight: "900",

      marginTop: 4,
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.62)",

      fontSize: 14,
      lineHeight: 20,

      marginTop: 4,
    },

    counterBadge: {
      minWidth: 42,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 10,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.35)",

      borderRadius: 21,

      backgroundColor:
        "rgba(53,175,229,0.1)",
    },

    counterText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "800",
    },

    keyboardHint: {
      maxWidth: 920,

      paddingHorizontal: 13,
      paddingVertical: 7,

      marginBottom: 9,

      borderRadius: 12,

      backgroundColor:
        "rgba(255,255,255,0.055)",
    },

    keyboardHintText: {
      color:
        "rgba(255,255,255,0.58)",

      fontSize: 12,
      textAlign: "center",
    },

    deckContainer: {
      position: "relative",

      alignItems: "center",
      justifyContent: "center",

      marginTop: 4,
    },

    swipeCard: {
      position: "absolute",

      borderRadius: 25,

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 12,
      },
      shadowOpacity: 0.4,
      shadowRadius: 20,

      elevation: 12,

      overflow: "visible",
    },

    nextCard: {
      position: "absolute",

      transform: [
        {
          scale: 0.96,
        },
        {
          translateY: 11,
        },
      ],

      opacity: 0.54,
    },

    actionStamp: {
      position: "absolute",

      top: 42,

      paddingHorizontal: 17,
      paddingVertical: 8,

      borderWidth: 3,
      borderRadius: 12,

      transform: [
        {
          rotate: "-8deg",
        },
      ],
    },

    skipStamp: {
      left: 22,

      borderColor: "#ff5a67",
      backgroundColor:
        "rgba(255,90,103,0.12)",
    },

    likeStamp: {
      right: 22,

      borderColor:
        colours.lightblue ||
        "#35afe5",

      backgroundColor:
        "rgba(53,175,229,0.12)",

      transform: [
        {
          rotate: "8deg",
        },
      ],
    },

    skipStampText: {
      color: "#ff5a67",

      fontSize: 25,
      fontWeight: "900",
      letterSpacing: 2,
    },

    likeStampText: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 25,
      fontWeight: "900",
      letterSpacing: 2,
    },

    directionGlow: {
      position: "absolute",

      top: 0,
      bottom: 0,

      width: 70,

      borderRadius: 28,
    },

    leftGlow: {
      left: -25,

      backgroundColor:
        "rgba(255,90,103,0.16)",
    },

    rightGlow: {
      right: -25,

      backgroundColor:
        "rgba(53,175,229,0.18)",
    },

    controls: {
      width: "100%",
      maxWidth: 420,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-around",

      marginTop: 18,
    },

    controlButton: {
      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.28,
      shadowRadius: 9,

      elevation: 6,
    },

    skipButton: {
      width: 58,
      height: 58,

      borderRadius: 29,

      borderColor:
        "rgba(255,90,103,0.36)",

      backgroundColor:
        "rgba(255,90,103,0.1)",
    },

    muteButton: {
      width: 50,
      height: 50,

      borderRadius: 25,

      borderColor:
        "rgba(255,255,255,0.1)",

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    likeButton: {
      width: 66,
      height: 66,

      borderRadius: 33,

      borderColor:
        "rgba(53,175,229,0.4)",

      backgroundColor:
        "rgba(53,175,229,0.12)",
    },

    footerRow: {
      position: "absolute",
      top: 24,
      left: 24,
      right: 24,

      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",

      zIndex: 100,
    },

    mobileFooter: {
      width: "100%",

      alignItems: "center",
      justifyContent: "center",

      marginTop: 10,
      paddingBottom: 8,
    },

    mobileBackButton: {
      minWidth: 132,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 20,
      paddingVertical: 11,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.3)",

      borderRadius: 16,

      backgroundColor:
        "rgba(18,24,35,0.9)",
    },

    mobileLoadingMoreRow: {
      flexDirection: "row",
      alignItems: "center",

      marginTop: 9,
    },

    backButton: {
      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 14,
      paddingVertical: 10,

      borderRadius: 14,

      backgroundColor: "rgba(18,24,35,0.88)",
      borderWidth: 1,
      borderColor: "rgba(53,175,229,0.28)",
    },

    backButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "700",

      marginLeft: 8,
    },

    loadingMoreRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    loadingMoreText: {
      color:
        "rgba(255,255,255,0.58)",

      fontSize: 12,

      marginLeft: 8,
    },

    audioStatusText: {
      color: "rgba(255,255,255,0.62)",
      fontSize: 12,
      textAlign: "center",
      marginTop: 9,
      paddingHorizontal: 18,
    },






    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: colours.lightblue || "#35afe5",
    },

    retryButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "800",
      marginLeft: 8,
    },

    emptyContainer: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 24,

      backgroundColor:
        colours.background ||
        "#101010",
    },

    emptyTitle: {
      color: "#ffffff",

      fontSize: 22,
      fontWeight: "800",

      marginTop: 16,
    },

    emptyText: {
      maxWidth: 400,

      color:
        "rgba(255,255,255,0.58)",

      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",

      marginTop: 7,
    },
  });

export default MusicSwiper;
