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
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { Audio } from "expo-av";

import {
  like,
  postRecommendations,
  setRecommendationServed,
} from "../providers/rest";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";
import { SongCardSwipe } from "./SongCardSwipe";

const SWIPE_THRESHOLD = 105;
const SWIPE_DISTANCE = 520;
const LOAD_MORE_THRESHOLD = 3;

export function MusicSwiper({
  songs = [],
  onLoadMore,
  loadingMore = false,
  hasMore = true,
}) {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isCompact = width < 700;

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [isMuted, setIsMuted] =
    useState(false);

  const [loadingSound, setLoadingSound] =
    useState(false);

  const [sound, setSound] =
    useState(null);

  const [isDragging, setIsDragging] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const translateX =
    useRef(new Animated.Value(0)).current;

  const leftOpacity =
    useRef(new Animated.Value(0)).current;

  const rightOpacity =
    useRef(new Animated.Value(0)).current;

  const currentSong =
    songs[currentIndex] || null;

  const nextSong =
    songs[currentIndex + 1] || null;

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

  const stopSound =
    useCallback(async () => {
      if (!sound) {
        return;
      }

      try {
        await sound.unloadAsync();
      } catch (error) {
        console.warn(
          "[MusicSwiper] Unable to unload sound:",
          error
        );
      } finally {
        setSound(null);
      }
    }, [sound]);

  useEffect(() => {
    let cancelled = false;

    const playPreview = async () => {
      await stopSound();

      if (
        !currentSong?.audioUrl ||
        cancelled
      ) {
        return;
      }

      setLoadingSound(true);

      try {
        const {
          sound: loadedSound,
        } =
          await Audio.Sound.createAsync(
            {
              uri: currentSong.audioUrl,
            },
            {
              shouldPlay: true,
              isLooping: true,
              isMuted,
              volume: 0.68,
            }
          );

        if (cancelled) {
          await loadedSound.unloadAsync();
          return;
        }

        setSound(loadedSound);
      } catch (error) {
        console.error(
          "[MusicSwiper] Preview error:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoadingSound(false);
        }
      }
    };

    playPreview();

    return () => {
      cancelled = true;
    };
  }, [
    currentSong?.audioUrl,
    currentSong?.id,
  ]);

  useEffect(() => {
    if (!sound) {
      return;
    }

    sound
      .setIsMutedAsync(isMuted)
      .catch((error) => {
        console.warn(
          "[MusicSwiper] Mute error:",
          error
        );
      });
  }, [isMuted, sound]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopSound();
      };
    }, [stopSound])
  );

  useEffect(() => {
    const remaining =
      songs.length - currentIndex - 1;

    if (
      remaining <= LOAD_MORE_THRESHOLD &&
      hasMore &&
      !loadingMore &&
      typeof onLoadMore === "function"
    ) {
      onLoadMore();
    }
  }, [
    currentIndex,
    hasMore,
    loadingMore,
    onLoadMore,
    songs.length,
  ]);

  const markSongHandled =
    useCallback(
      async (direction) => {
        const user = auth.currentUser;

        if (
          !user?.uid ||
          !currentSong?.id
        ) {
          return;
        }

        try {
          await setRecommendationServed(
            user.uid,
            currentSong.recommendationId ||
              currentSong.recordId ||
              currentSong.id
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
              String(currentSong.id),
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
            String(currentSong.id),
            "track",
            currentSong.title || "",
            currentSong.artist || "",
            "like"
          );
        } catch (error) {
          console.error(
            "[MusicSwiper] Like error:",
            error
          );
        }
      },
      [currentSong]
    );

  const resetPosition =
    useCallback(() => {
      Animated.spring(
        translateX,
        {
          toValue: 0,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
        }
      ).start();
    }, [translateX]);

  const moveToNext =
    useCallback(() => {
      setCurrentIndex((index) => {
        const nextIndex = index + 1;

        if (nextIndex < songs.length) {
          return nextIndex;
        }

        return index;
      });

      translateX.setValue(0);
      leftOpacity.setValue(0);
      rightOpacity.setValue(0);
    }, [
      leftOpacity,
      rightOpacity,
      songs.length,
      translateX,
    ]);

  const handleSwipe =
    useCallback(
      async (direction) => {
        if (
          actionLoading ||
          !currentSong
        ) {
          return;
        }

        const hasNextSong =
          currentIndex + 1 <
          songs.length;

        if (
          !hasNextSong &&
          hasMore &&
          typeof onLoadMore === "function"
        ) {
          await onLoadMore();

          if (
            currentIndex + 1 >=
            songs.length
          ) {
            resetPosition();
            return;
          }
        }

        setActionLoading(true);
        setIsDragging(false);

        markSongHandled(direction);

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
              duration: 240,
              useNativeDriver: true,
            }
          ),

          Animated.sequence([
            Animated.timing(
              actionOpacity,
              {
                toValue: 1,
                duration: 110,
                useNativeDriver: true,
              }
            ),

            Animated.timing(
              actionOpacity,
              {
                toValue: 0,
                duration: 210,
                useNativeDriver: true,
              }
            ),
          ]),
        ]).start(() => {
          moveToNext();
          setActionLoading(false);
        });
      },
      [
        actionLoading,
        currentIndex,
        currentSong,
        hasMore,
        leftOpacity,
        markSongHandled,
        moveToNext,
        onLoadMore,
        resetPosition,
        rightOpacity,
        songs.length,
        translateX,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => true,

          onMoveShouldSetPanResponder:
            (_, gestureState) =>
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

      if (
        event.key === "ArrowLeft" ||
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        handleSwipe("left");
      }

      if (
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        handleSwipe("right");
      }

      if (
        event.key.toLowerCase() === "m"
      ) {
        event.preventDefault();
        setIsMuted((value) => !value);
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
  }, [handleSwipe, isWeb]);

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
              Like and review more music to
              improve your recommendations.
            </Text>
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

      {isWeb ? (
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
          onPress={() =>
            setIsMuted((value) => !value)
          }
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
                isMuted
                  ? "volume-off"
                  : "volume-up"
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

      marginTop: 14,
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
