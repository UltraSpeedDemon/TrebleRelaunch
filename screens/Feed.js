import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";

import Toast from "react-native-toast-message";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import SearchBar from "../components/SearchBar";

import colours from "../styles/colours";
import { auth } from "../utils/firebase";
import { onAuthStateChanged } from "firebase/auth";

import {
  getRecommendations,
  postRecommendations,
  like,
  unlike,
  getFriends,
  share,
  setRecommendationServed,
  getTimeline,
  getSongFromDeezer,
  getFollowRequests,
  getFeedPosts,
} from "../providers/rest";

const PAGE_SIZE = 16;
const DOUBLE_TAP_DELAY = 300;

const FEED_CACHE_KEY_PREFIX =
  "treble_feed_cache_v4";

const getFeedCacheKey = (userId) =>
  `${FEED_CACHE_KEY_PREFIX}:${String(
    userId || "anonymous"
  )}`;
/*
 * The visible feed stays in place until the user manually refreshes.
 * Friend shares and friend-liked cards must not disappear while the
 * user is still reading them.
 */
const FEED_CACHE_MAX_AGE_MS = null;

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/500";
const PLACEHOLDER_AVATAR = "https://via.placeholder.com/100";

export default function Feed({
  navigation,
  route,
}) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";

  /*
  * Sidebar stays permanently open for tablets, laptops,
  * desktops and all web screens 768px or wider.
  */
  const isDesktopWeb = isWeb && width >= 768;
  const isMobileWeb = isWeb && width < 768;

  const isTablet =
    width >= 768 &&
    width < 1100;


  const isCompact = width < 768;

  const [isLoading, setIsLoading] = useState(true);

  /*
   * Firebase restores the signed-in user asynchronously after a hard reload.
   * The feed must wait for that restoration before requesting cards.
   */
  const [authReady, setAuthReady] =
    useState(false);

  const [activeUserId, setActiveUserId] =
    useState(
      auth.currentUser?.uid || ""
    );

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [combinedFeed, setCombinedFeed] = useState([]);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [recommendationsOffset, setRecommendationsOffset] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  /*
   * Home Feed filters. These only change what is visible;
   * they do not request or discard feed data.
   */
  const [feedFilter, setFeedFilter] =
    useState("all");

  const [likeLoading, setLikeLoading] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comment, setComment] = useState("");
  const [currentShareItem, setCurrentShareItem] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreview, setCurrentPreview] = useState(null);
  const [playLoadingId, setPlayLoadingId] = useState(null);

  /*
   * Keep the active sound in a ref. This matches SongPage's simple
   * one-preview-at-a-time behavior and avoids stale React state
   * closures while playback is starting or stopping.
   */
  const soundRef = useRef(null);
  const playbackRequestRef = useRef(0);

  const fetchedInitial = useRef(false);
  const initialRequestInFlight = useRef(false);
  const loadMoreRequestInFlight = useRef(false);
  const paginationCursorRef = useRef(0);

  const feedMixGenerationRef =
    useRef(0);

  const lastInsertedPostIdRef =
    useRef(null);

  const latestFeedRef = useRef([]);
  const tapTimerRef = useRef(null);
  const feedScrollOffsetRef = useRef(0);
  const pullStartYRef = useRef(null);
  const viewedRecommendationIds = useRef(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isFocused = useIsFocused();

  const openCreatePost =
    useCallback(() => {
      navigation.navigate("CreatePost");
    }, [navigation]);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {
          const nextUserId =
            firebaseUser?.uid || "";

          setActiveUserId(
            nextUserId
          );

          setAuthReady(true);

          /*
           * A login/account change requires a fresh initialization.
           */
          fetchedInitial.current =
            false;

          initialRequestInFlight.current =
            false;
        }
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else if (isMobileWeb) {
      setMenuOpen(false);
    }
  }, [isDesktopWeb, isMobileWeb]);

  const getItemInfo = useCallback((item) => {
    return item?.item_info || item || {};
  }, []);

  useEffect(() => {
    latestFeedRef.current = combinedFeed;
  }, [combinedFeed]);

  const getItemId = useCallback((item) => {
    return (
      item?.id ||
      item?.item_info?.id ||
      item?.record_id ||
      item?.rid ||
      null
    );
  }, []);

  const getRecordId = useCallback((item) => {
    return (
      item?.record_id ||
      item?.item_info?.record_id ||
      item?.rid ||
      null
    );
  }, []);

  const getItemType = useCallback((item) => {
    return item?.item_info?.type || item?.type || "track";
  }, []);

  const getLikedStatus = useCallback((item) => {
    if (typeof item?.liked === "boolean") {
      return item.liked;
    }

    if (typeof item?.item_info?.liked === "boolean") {
      return item.item_info.liked;
    }

    return false;
  }, []);

  const getPreviewUrl = useCallback((item) => {
    const itemInfo =
      item?.item_info ||
      item ||
      {};

    return (
      itemInfo?.preview ||
      itemInfo?.previewUrl ||
      itemInfo?.playbackUrl ||
      item?.preview ||
      item?.previewUrl ||
      item?.playbackUrl ||
      null
    );
  }, []);

  const getImageUrl = useCallback((item) => {
    const itemInfo =
      getItemInfo(item);

    const candidate =
      itemInfo?.image ||
      itemInfo?.coverArt ||
      itemInfo?.albumCover ||
      itemInfo?.album?.cover_medium ||
      itemInfo?.album?.cover_big ||
      item?.albumCover ||
      PLACEHOLDER_IMAGE;

    if (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.uri === "string"
    ) {
      return candidate.uri;
    }

    return typeof candidate === "string"
      ? candidate
      : PLACEHOLDER_IMAGE;
  }, [getItemInfo]);

  const getDisplayName = useCallback((item) => {
    const itemInfo = getItemInfo(item);

    return (
      itemInfo?.name ||
      itemInfo?.title ||
      "Unknown Title"
    );
  }, [getItemInfo]);

  const getArtistName = useCallback((item) => {
    const itemInfo = getItemInfo(item);

    return (
      itemInfo?.artist?.name ||
      itemInfo?.artistName ||
      ""
    );
  }, [getItemInfo]);

  const getAlbumName = useCallback((item) => {
    const itemInfo = getItemInfo(item);

    return (
      itemInfo?.album?.title ||
      itemInfo?.albumTitle ||
      ""
    );
  }, [getItemInfo]);

  const getTimeAgo = useCallback((timestamp) => {
    if (!timestamp) {
      return "";
    }

    const currentTime = new Date();
    const postTime = new Date(timestamp);

    if (Number.isNaN(postTime.getTime())) {
      return "";
    }

    const differenceSeconds = Math.max(
      0,
      Math.floor((currentTime - postTime) / 1000)
    );

    if (differenceSeconds < 60) {
      return "Just now";
    }

    if (differenceSeconds < 3600) {
      return `${Math.floor(differenceSeconds / 60)}m ago`;
    }

    if (differenceSeconds < 86400) {
      return `${Math.floor(differenceSeconds / 3600)}h ago`;
    }

    return `${Math.floor(differenceSeconds / 86400)}d ago`;
  }, []);

  const unloadCurrentSound = useCallback(async () => {
    /*
     * Invalidate any playback attempt that is still loading.
     */
    playbackRequestRef.current += 1;

    const activeSound = soundRef.current;
    soundRef.current = null;

    if (activeSound) {
      try {
        activeSound.setOnPlaybackStatusUpdate(null);
        await activeSound.unloadAsync();
      } catch (error) {
        console.warn(
          "[Feed] Could not unload preview:",
          error
        );
      }
    }

    setCurrentPreview(null);
    setProgress(0);
    setIsPlaying(false);
  }, []);

  const getPreviewVolume = useCallback(async () => {
    const savedVolume =
      await AsyncStorage.getItem(
        "treble_preview_volume"
      );

    const parsedVolume =
      savedVolume !== null
        ? Number(savedVolume)
        : 0.65;

    return Number.isFinite(parsedVolume)
      ? Math.min(1, Math.max(0, parsedVolume))
      : 0.65;
  }, []);

  const updateFeedItemPreview = useCallback(
    (itemId, previewUrl, deezerTrack = null) => {
      if (!itemId || !previewUrl) {
        return;
      }

      setCombinedFeed((currentItems) =>
        currentItems.map((feedItem) => {
          if (
            String(getItemId(feedItem)) !==
            String(itemId)
          ) {
            return feedItem;
          }

          const previewFields = {
            preview: previewUrl,
            previewUrl,
            playbackUrl: previewUrl,
          };

          if (feedItem?.item_info) {
            return {
              ...feedItem,
              ...previewFields,
              item_info: {
                ...feedItem.item_info,
                ...(deezerTrack || {}),
                ...previewFields,
              },
            };
          }

          return {
            ...feedItem,
            ...(deezerTrack || {}),
            ...previewFields,
          };
        })
      );
    },
    [getItemId]
  );

  const requestTrackPreview = useCallback(
    async (
      itemId,
      {
        forceRefresh = false,
      } = {}
    ) => {
      const response =
        await getSongFromDeezer(
          String(itemId),
          {
            refresh: true,
            forceRefresh,
          }
        );

      if (!response?.ok) {
        throw new Error(
          `Deezer request failed with HTTP ${response?.status}`
        );
      }

      const deezerTrack =
        await response.json();

      const previewUrl =
        deezerTrack?.preview ||
        deezerTrack?.previewUrl ||
        deezerTrack?.playbackUrl ||
        "";

      if (!previewUrl) {
        throw new Error(
          "Deezer did not return a playable preview."
        );
      }

      updateFeedItemPreview(
        itemId,
        previewUrl,
        deezerTrack
      );

      return {
        previewUrl,
        deezerTrack,
      };
    },
    [updateFeedItemPreview]
  );

  const playPreviewUrl = useCallback(
    async (
      previewUrl,
      itemId,
      requestId
    ) => {
      const previewVolume =
        await getPreviewVolume();

      /*
       * Configure native audio in the same way as SongPage.
       * This does not request microphone permission.
       */
      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }

      /*
       * Play the Deezer URL exactly as returned. Do not append query
       * parameters because preview URLs may be signed.
       */
      const created =
        await Audio.Sound.createAsync(
          {
            uri: previewUrl,
          },
          {
            shouldPlay: true,
            volume: previewVolume,
            progressUpdateIntervalMillis: 200,
          },
          undefined,
          true
        );

      if (
        requestId !== playbackRequestRef.current
      ) {
        await created.sound
          .unloadAsync()
          .catch(() => {});

        return false;
      }

      soundRef.current = created.sound;
      setCurrentPreview(previewUrl);
      setProgress(0);
      setIsPlaying(true);

      created.sound.setOnPlaybackStatusUpdate(
        (status) => {
          if (!status.isLoaded) {
            if (status?.error) {
              console.warn(
                "[Feed] Playback status error:",
                status.error
              );
            }

            return;
          }

          if (
            status.durationMillis &&
            status.positionMillis !== undefined
          ) {
            setProgress(
              Math.min(
                100,
                (
                  status.positionMillis /
                  status.durationMillis
                ) * 100
              )
            );
          }

          setIsPlaying(
            Boolean(status.isPlaying)
          );

          if (status.didJustFinish) {
            setProgress(0);
            setIsPlaying(false);
            setCurrentPreview(null);
            soundRef.current = null;

            created.sound
              .unloadAsync()
              .catch(() => {});
          }
        }
      );

      return true;
    },
    [getPreviewVolume]
  );

  const handlePlayItem = useCallback(
    async (item) => {
      const itemId =
        String(getItemId(item) || "");

      if (
        getItemType(item) !== "track" ||
        !itemId
      ) {
        Alert.alert(
          "Preview unavailable",
          "This item does not have a valid Deezer track ID."
        );

        return;
      }

      const existingPreview =
        getPreviewUrl(item);

      /*
       * Pressing the active card again stops it, exactly like SongPage.
       */
      if (
        soundRef.current &&
        currentPreview &&
        existingPreview === currentPreview
      ) {
        await unloadCurrentSound();
        return;
      }

      if (playLoadingId) {
        return;
      }

      setPlayLoadingId(itemId);

      try {
        await unloadCurrentSound();

        const requestId =
          playbackRequestRef.current + 1;

        playbackRequestRef.current =
          requestId;

        let previewUrl =
          existingPreview;

        /*
         * SongPage always checks the track endpoint before playing.
         * Use the normal cache-friendly refresh first.
         */
        try {
          const fresh =
            await requestTrackPreview(
              itemId,
              {
                forceRefresh: false,
              }
            );

          previewUrl =
            fresh.previewUrl;
        } catch (normalRefreshError) {
          console.warn(
            "[Feed] Normal preview refresh failed; trying the card URL:",
            normalRefreshError
          );
        }

        if (!previewUrl) {
          throw new Error(
            "No preview URL is available for this track."
          );
        }

        try {
          await playPreviewUrl(
            previewUrl,
            itemId,
            requestId
          );
        } catch (firstPlaybackError) {
          console.warn(
            "[Feed] First preview failed. Force-refreshing:",
            firstPlaybackError
          );

          await unloadCurrentSound();

          const retryRequestId =
            playbackRequestRef.current + 1;

          playbackRequestRef.current =
            retryRequestId;

          const forced =
            await requestTrackPreview(
              itemId,
              {
                forceRefresh: true,
              }
            );

          await playPreviewUrl(
            forced.previewUrl,
            itemId,
            retryRequestId
          );
        }
      } catch (error) {
        console.error(
          "[Feed] Preview playback error:",
          error
        );

        await unloadCurrentSound();

        Alert.alert(
          "Preview unavailable",
          "Treble could not start this song preview. Please try again."
        );
      } finally {
        setPlayLoadingId(null);
      }
    },
    [
      currentPreview,
      getItemId,
      getItemType,
      getPreviewUrl,
      playLoadingId,
      playPreviewUrl,
      requestTrackPreview,
      unloadCurrentSound,
    ]
  );

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }

      unloadCurrentSound();
    };
  }, [unloadCurrentSound]);

  useEffect(() => {
    if (!isFocused) {
      unloadCurrentSound();
    }
  }, [
    isFocused,
    unloadCurrentSound,
  ]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios"
        ? "keyboardWillShow"
        : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios"
        ? "keyboardWillHide"
        : "keyboardDidHide";

    const keyboardShowListener =
      Keyboard.addListener(showEvent, () => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });

    const keyboardHideListener =
      Keyboard.addListener(hideEvent, () => {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [slideAnim]);

  const fetchTimelineItems = useCallback(
    async (offset, refresh = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        return [];
      }

      try {
        const response = await getTimeline(
          currentUser.uid,
          {
            limit: PAGE_SIZE,
            offset,
            refresh,
          }
        );

        if (!response?.ok) {
          console.warn(
            "[Feed] Timeline request failed:",
            response?.status
          );

          return [];
        }

        const data = await response.json();

        return Array.isArray(data?.timeline)
          ? data.timeline
          : [];
      } catch (error) {
        console.error("[Feed] Timeline error:", error);
        return [];
      }
    },
    []
  );

  const fetchRecommendationItems = useCallback(
    async (offset, refresh = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        return [];
      }

      try {
        const response = await getRecommendations(
          currentUser.uid,
          {
            limit: PAGE_SIZE,
            offset,
            refresh,
          }
        );

        if (!response?.ok) {
          console.warn(
            "[Feed] Recommendation request failed:",
            response?.status
          );

          return [];
        }

        const data = await response.json();

        return Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];
      } catch (error) {
        console.error(
          "[Feed] Recommendation error:",
          error
        );

        return [];
      }
    },
    []
  );

  const getFeedMixCategory =
    useCallback((item) => {
      const originType =
        String(
          item?.origin?.type ||
          item?.item_info?.origin?.type ||
          item?.source ||
          item?.item_info?.source ||
          item?.activityType ||
          item?.type ||
          "music"
        ).toLowerCase();

      if (
        originType.includes("post") ||
        originType.includes("created")
      ) {
        return "post";
      }

      if (
        originType.includes("friend") ||
        originType.includes("share")
      ) {
        return "friend";
      }

      if (
        originType.includes("like") ||
        originType.includes("favourite") ||
        originType.includes("favorite")
      ) {
        return "liked";
      }

      if (
        originType.includes("genre")
      ) {
        return "genre";
      }

      if (
        originType.includes("review")
      ) {
        return "review";
      }

      if (
        originType.includes("recommend")
      ) {
        return "recommendation";
      }

      return "music";
    }, []);

  const shuffleFeedItems =
    useCallback((items) => {
      const result =
        [...items];

      for (
        let index =
          result.length - 1;
        index > 0;
        index -= 1
      ) {
        const swapIndex =
          Math.floor(
            Math.random() *
            (index + 1)
          );

        [
          result[index],
          result[swapIndex],
        ] = [
          result[swapIndex],
          result[index],
        ];
      }

      return result;
    }, []);

  const diversifyFeedItems =
    useCallback((items) => {
      const uniqueItems = [];
      const usedIds =
        new Set();

      items.forEach((item) => {
        const itemId =
          String(
            getRecordId(item) ||
            getItemId(item) ||
            ""
          );

        if (
          !itemId ||
          usedIds.has(itemId)
        ) {
          return;
        }

        usedIds.add(itemId);
        uniqueItems.push(item);
      });

      const buckets =
        new Map();

      shuffleFeedItems(
        uniqueItems
      ).forEach((item) => {
        const category =
          getFeedMixCategory(item);

        if (!buckets.has(category)) {
          buckets.set(category, []);
        }

        buckets
          .get(category)
          .push(item);
      });

      const result = [];
      let previousCategory = "";

      while (
        [...buckets.values()].some(
          (bucket) =>
            bucket.length > 0
        )
      ) {
        const candidates =
          [...buckets.entries()]
            .filter(
              ([, bucket]) =>
                bucket.length > 0
            )
            .sort(
              (first, second) =>
                second[1].length -
                first[1].length
            );

        const choice =
          candidates.find(
            ([category]) =>
              category !==
              previousCategory
          ) ||
          candidates[0];

        if (!choice) {
          break;
        }

        const [
          category,
          bucket,
        ] = choice;

        result.push(
          bucket.shift()
        );

        previousCategory =
          category;
      }

      return result;
    }, [
      getFeedMixCategory,
      getItemId,
      getRecordId,
      shuffleFeedItems,
    ]);

  const fetchCreatedPostItems =
    useCallback(
      async (
        offset,
        limit = PAGE_SIZE
      ) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          return [];
        }

        try {
          const response =
            await getFeedPosts(
              currentUser.uid,
              {
                limit,
                offset,
              }
            );

          if (!response?.ok) {
            console.warn(
              "[Feed] Created posts request failed:",
              response?.status
            );

            return [];
          }

          const data =
            await response.json();

          const rawPosts =
            Array.isArray(
              data?.posts
            )
              ? data.posts
              : [];

          return rawPosts
            .map((post) => {
              const itemInfo =
                post?.item_info ||
                post ||
                {};

              const postId =
                String(
                  post?.id ||
                  post?.postId ||
                  post?.record_id ||
                  ""
                );

              const songId =
                String(
                  itemInfo?.listenableId ||
                  itemInfo?.listenable_id ||
                  itemInfo?.songId ||
                  post?.listenableId ||
                  post?.listenable_id ||
                  post?.songId ||
                  ""
                );

              if (!postId) {
                return null;
              }

              return {
                ...post,

                id:
                  postId,

                record_id:
                  String(
                    post?.record_id ||
                    `feed-post-${postId}`
                  ),

                type: "track",
                source:
                  "created-post",

                origin: {
                  ...(post?.origin || {}),
                  type: "post",
                  title:
                    post?.origin?.title ||
                    "Created a post",
                  description:
                    itemInfo?.comment ||
                    post?.comment ||
                    post?.origin?.description ||
                    "",
                },

                item_info: {
                  ...itemInfo,

                  id:
                    songId,
                  listenableId:
                    songId,
                  listenable_id:
                    songId,
                  songId,

                  type: "track",
                  source:
                    "created-post",

                  title:
                    itemInfo?.title ||
                    itemInfo?.name ||
                    post?.title ||
                    post?.name ||
                    "Shared Song",

                  name:
                    itemInfo?.name ||
                    itemInfo?.title ||
                    post?.name ||
                    post?.title ||
                    "Shared Song",

                  artist:
                    typeof itemInfo?.artist ===
                    "string"
                      ? {
                          name:
                            itemInfo.artist,
                        }
                      : itemInfo?.artist || {
                          name:
                            itemInfo?.artistName ||
                            post?.artistName ||
                            "",
                        },

                  artistName:
                    itemInfo?.artistName ||
                    itemInfo?.artist?.name ||
                    post?.artistName ||
                    "",

                  image:
                    itemInfo?.image ||
                    itemInfo?.coverArt ||
                    post?.image ||
                    post?.coverArt ||
                    "",

                  coverArt:
                    itemInfo?.coverArt ||
                    itemInfo?.image ||
                    post?.coverArt ||
                    post?.image ||
                    "",

                  comment:
                    itemInfo?.comment ||
                    post?.comment ||
                    post?.origin?.description ||
                    "",

                  rating:
                    Number(
                      itemInfo?.rating ||
                      post?.rating ||
                      0
                    ),

                  username:
                    itemInfo?.username ||
                    post?.username ||
                    "Treble User",

                  authorId:
                    itemInfo?.authorId ||
                    post?.authorId ||
                    "",

                  preview:
                    itemInfo?.preview ||
                    post?.preview ||
                    "",

                  previewUrl:
                    itemInfo?.previewUrl ||
                    itemInfo?.preview ||
                    post?.preview ||
                    "",

                  playbackUrl:
                    itemInfo?.playbackUrl ||
                    itemInfo?.preview ||
                    post?.preview ||
                    "",
                },
              };
            })
            .filter(Boolean);
        } catch (error) {
          console.error(
            "[Feed] Created posts error:",
            error
          );

          return [];
        }
      },
      []
    );

  const mergeFeedItems = useCallback(
    (
      timelineItems,
      recommendationItems
    ) => {
      return diversifyFeedItems([
        ...timelineItems,
        ...recommendationItems,
      ]);
    },
    [diversifyFeedItems]
  );

  const saveFeedCache = useCallback(
    async (items) => {
      try {
        await AsyncStorage.setItem(
          getFeedCacheKey(
            activeUserId
          ),
          JSON.stringify({
            savedAt: Date.now(),
            items,
          })
        );
      } catch (error) {
        console.warn(
          "[Feed] Could not save feed cache:",
          error
        );
      }
    },
    [activeUserId]
  );

  const restoreFeedCache = useCallback(
    async () => {
      try {
        if (!activeUserId) {
          return false;
        }

        const raw =
          await AsyncStorage.getItem(
            getFeedCacheKey(
              activeUserId
            )
          );

        if (!raw) {
          return false;
        }

        const cached =
          JSON.parse(raw);

        if (
          !Array.isArray(
            cached?.items
          ) ||
          cached.items.length === 0
        ) {
          return false;
        }

        /*
         * Keep liked cards in the current cached feed.
         * They should not disappear immediately after being liked.
         */
        const safeCachedItems = cached.items;

        setCombinedFeed(safeCachedItems);

        setTimelineOffset(
          safeCachedItems.length
        );

        paginationCursorRef.current =
          safeCachedItems.length;

        setHasMore(true);
        setIsLoading(false);

        /*
         * Once restored, this feed remains active until the user explicitly
         * pulls to refresh or presses the New Mix / Refresh Feed button.
         */
        return true;
      } catch (error) {
        console.warn(
          "[Feed] Could not restore feed cache:",
          error
        );
        return false;
      }
    },
    [activeUserId]
  );

  const fetchInitialFeed = useCallback(
    async (
      refresh = false,
      showFullLoader = true
    ) => {
      if (
        initialRequestInFlight.current
      ) {
        return;
      }

      if (
        !authReady ||
        !activeUserId
      ) {
        return;
      }

      initialRequestInFlight.current =
        true;

      if (
        showFullLoader &&
        latestFeedRef.current.length === 0
      ) {
        setIsLoading(true);
      }

      try {
        /*
         * The optimized backend timeline already contains:
         * - new shared music
         * - recommended music
         * - duplicate filtering
         *
         * Calling /users/recommendations here as well doubled
         * backend work and made the first page wait twice.
         */
        const [
          timelineItems,
          recommendationItems,
          createdPostItems,
        ] = await Promise.all([
          fetchTimelineItems(
            0,
            refresh
          ),
          fetchRecommendationItems(
            0,
            refresh
          ),
          fetchCreatedPostItems(
            0,
            PAGE_SIZE
          ),
        ]);

        const currentUserId =
          String(activeUserId);

        const ownCreatedPosts =
          createdPostItems
            .filter(
              (item) =>
                String(
                  item?.authorId ||
                  item?.item_info?.authorId ||
                  ""
                ) ===
                currentUserId
            )
            .sort(
              (first, second) =>
                new Date(
                  second?.createdAt ||
                  0
                ) -
                new Date(
                  first?.createdAt ||
                  0
                )
            );

        const otherCreatedPosts =
          createdPostItems.filter(
            (item) =>
              String(
                item?.authorId ||
                item?.item_info?.authorId ||
                ""
              ) !==
              currentUserId
          );

        /*
         * The creator always sees their latest posts at the top.
         * Other people's posts remain mixed with normal feed content.
         */
        const mixedItems = [
          ...ownCreatedPosts,
          ...diversifyFeedItems([
            ...otherCreatedPosts,
            ...timelineItems,
            ...recommendationItems,
          ]),
        ];

        if (mixedItems.length > 0) {
          setCombinedFeed(
            mixedItems
          );

          setTimelineOffset(
            timelineItems.length
          );

          setRecommendationsOffset(
            recommendationItems.length
          );

          paginationCursorRef.current =
            Math.max(
              timelineItems.length,
              recommendationItems.length,
              PAGE_SIZE
            );

          feedMixGenerationRef.current +=
            1;

          setHasMore(
            mixedItems.length >=
            PAGE_SIZE
          );

          await saveFeedCache(
            mixedItems
          );
        } else if (
          latestFeedRef.current.length > 0
        ) {
          /*
           * Never blank the feed because of an empty, failed, or
           * temporarily incomplete refresh response.
           */
          console.warn(
            "[Feed] Refresh returned no cards; keeping the current feed."
          );

          setHasMore(true);
        } else {
          setCombinedFeed([]);
          setTimelineOffset(0);
          setHasMore(false);
        }
      } catch (error) {
        console.error(
          "[Feed] Initial feed error:",
          error
        );
      } finally {
        initialRequestInFlight.current =
          false;

        setIsLoading(false);
      }
    },
    [
      activeUserId,
      authReady,
      diversifyFeedItems,
      fetchCreatedPostItems,
      fetchRecommendationItems,
      fetchTimelineItems,
      saveFeedCache,
    ]
  );


  const loadMoreFeed =
    useCallback(async () => {
      if (
        loadMoreRequestInFlight.current ||
        loadingMore ||
        isLoading
      ) {
        return;
      }

      loadMoreRequestInFlight.current =
        true;

      setLoadingMore(true);
      setHasMore(true);

      try {
        const existingIds =
          new Set(
            latestFeedRef.current
              .map((item) =>
                String(
                  getRecordId(item) ||
                  getItemId(item) ||
                  ""
                )
              )
              .filter(Boolean)
          );

        const requestOffset =
          paginationCursorRef.current;

        const [
          timelineItems,
          recommendationItems,
          createdPostItems,
        ] = await Promise.all([
          fetchTimelineItems(
            requestOffset,
            false
          ),
          fetchRecommendationItems(
            requestOffset,
            false
          ),
          fetchCreatedPostItems(
            requestOffset,
            PAGE_SIZE
          ),
        ]);

        paginationCursorRef.current +=
          PAGE_SIZE;

        const mixedCandidates =
          diversifyFeedItems([
            ...createdPostItems,
            ...timelineItems,
            ...recommendationItems,
          ]);

        const uniqueNewItems =
          mixedCandidates.filter(
            (item) => {
              const itemId =
                String(
                  getRecordId(item) ||
                  getItemId(item) ||
                  ""
                );

              if (
                !itemId ||
                existingIds.has(itemId)
              ) {
                return false;
              }

              existingIds.add(itemId);
              return true;
            }
          );

        if (
          uniqueNewItems.length === 0
        ) {
          /*
           * Jump forward and try a refreshed window next time instead of
           * repeatedly requesting the same duplicate-heavy page.
           */
          paginationCursorRef.current +=
            PAGE_SIZE;

          setHasMore(true);
          return;
        }

        let updatedFeed = [];

        setCombinedFeed(
          (currentItems) => {
            updatedFeed = [
              ...currentItems,
              ...uniqueNewItems,
            ];

            return updatedFeed;
          }
        );

        setTimelineOffset(
          requestOffset +
          timelineItems.length
        );

        setRecommendationsOffset(
          requestOffset +
          recommendationItems.length
        );

        setHasMore(true);

        if (
          updatedFeed.length > 0
        ) {
          await saveFeedCache(
            updatedFeed
          );
        }
      } catch (error) {
        console.error(
          "[Feed] Load-more error:",
          error
        );

        setHasMore(true);
      } finally {
        loadMoreRequestInFlight.current =
          false;

        setLoadingMore(false);
      }
    }, [
      diversifyFeedItems,
      fetchCreatedPostItems,
      fetchRecommendationItems,
      fetchTimelineItems,
      getItemId,
      getRecordId,
      isLoading,
      loadingMore,
      saveFeedCache,
    ]);


  /*
   * This is the only feed-refresh path after initial setup.
   * It is called by pull-to-refresh and the New Mix / Refresh Feed button.
   */
  const handleRefresh = useCallback(async () => {
    if (initialRequestInFlight.current) {
      return;
    }

    setRefreshing(true);
    setHasMore(true);
    setTimelineOffset(0);
    paginationCursorRef.current = 0;
    setRecommendationsOffset(0);

    try {
      /*
       * Both the Refresh Feed button and pull-to-refresh call this
       * same function. refresh=true asks the backend for a new mix.
       */
      await fetchInitialFeed(
        true,
        false
      );
    } finally {
      setRefreshing(false);
    }
  }, [fetchInitialFeed]);

  useEffect(() => {
    if (
      !authReady ||
      !activeUserId ||
      fetchedInitial.current
    ) {
      return undefined;
    }

    fetchedInitial.current = true;

    let cancelled = false;

    const startFeed = async () => {
      /*
       * Restore the saved feed and leave it in place.
       *
       * Do not automatically request a new mix in the background. A backend
       * request is made only when there is no saved feed yet. After that, the
       * user controls refreshes through pull-to-refresh or the New Mix button.
       */
      const restoredFeed =
        await restoreFeedCache();

      if (cancelled) {
        return;
      }

      if (!restoredFeed) {
        await fetchInitialFeed(
          false,
          true
        );
      }
    };

    startFeed();

    return () => {
      cancelled = true;
    };
  }, [
    activeUserId,
    authReady,
    fetchInitialFeed,
    restoreFeedCache,
  ]);

  useEffect(() => {
    const newPost =
      route?.params?.newPost;

    if (!newPost?.id) {
      return;
    }

    const postId =
      String(newPost.id);

    const rawItemInfo =
      newPost?.item_info ||
      newPost;

    const newPostSongId =
      String(
        rawItemInfo?.listenableId ||
        rawItemInfo?.listenable_id ||
        rawItemInfo?.songId ||
        newPost?.listenableId ||
        newPost?.listenable_id ||
        newPost?.songId ||
        ""
      );

    const normalizedNewPost = {
      ...newPost,

      record_id:
        String(
          newPost?.record_id ||
          `feed-post-${postId}`
        ),

      type: "track",
      source: "created-post",

      origin: {
        ...(newPost?.origin || {}),
        type: "post",
        title:
          newPost?.origin?.title ||
          "Created a post",
        description:
          rawItemInfo?.comment ||
          newPost?.comment ||
          newPost?.origin?.description ||
          "",
      },

      item_info: {
        ...rawItemInfo,

        id:
          newPostSongId,
        listenableId:
          newPostSongId,
        listenable_id:
          newPostSongId,
        songId:
          newPostSongId,

        type: "track",
        source:
          "created-post",
      },
    };

    if (
      lastInsertedPostIdRef.current ===
      postId
    ) {
      return;
    }

    lastInsertedPostIdRef.current =
      postId;

    let updatedFeed = [];

    setCombinedFeed(
      (currentItems) => {
        updatedFeed = [
          normalizedNewPost,
          ...currentItems.filter(
            (item) =>
              String(
                getRecordId(item) ||
                getItemId(item) ||
                ""
              ) !==
              String(
                normalizedNewPost.record_id ||
                normalizedNewPost.id
              )
          ),
        ];

        return updatedFeed;
      }
    );

    setTimeout(() => {
      if (
        updatedFeed.length > 0
      ) {
        saveFeedCache(
          updatedFeed
        );
      }
    }, 0);

    navigation.setParams?.({
      newPost: undefined,
    });
  }, [
    getItemId,
    getRecordId,
    navigation,
    route?.params?.newPost,
    saveFeedCache,
  ]);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    let cancelled = false;

    const fetchNotifications =
      async () => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          if (!cancelled) {
            setNotificationsCount(0);
          }

          return;
        }

        try {
          const response =
            await getFollowRequests(
              currentUser.uid
            );

          if (!response?.ok) {
            return;
          }

          const result =
            await response.json();

          const requests =
            Array.isArray(result)
              ? result
              : Array.isArray(
                    result?.requests
                  )
                ? result.requests
                : Array.isArray(
                      result?.followRequests
                    )
                  ? result.followRequests
                  : [];

          const unreadRequests =
            requests.filter(
              (request) =>
                request?.read !== true &&
                request?.seen !== true &&
                String(
                  request?.status ||
                  "pending"
                ).toLowerCase() !==
                  "accepted"
            );

          if (!cancelled) {
            setNotificationsCount(
              unreadRequests.length
            );
          }
        } catch (error) {
          console.error(
            "[Feed] Notification error:",
            error
          );
        }
      };

    /*
     * Check once when Feed becomes active. Do not poll every 30 seconds,
     * because repeated notification reads increase backend/Firestore usage.
     */
    fetchNotifications();

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  const updateLikedState = useCallback(
    (itemId, liked) => {
      setCombinedFeed((items) =>
        items.map((feedItem) => {
          if (
            getItemId(feedItem) !== itemId
          ) {
            return feedItem;
          }

          return {
            ...feedItem,
            liked,
            ...(feedItem.item_info
              ? {
                  item_info: {
                    ...feedItem.item_info,
                    liked,
                  },
                }
              : {}),
          };
        })
      );
    },
    [getItemId]
  );

  const handleLikeSong = useCallback(
    async (item, forceLike = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        Alert.alert(
          "Sign in required",
          "You must be signed in to like music."
        );
        return;
      }

      const itemId = getItemId(item);

      if (!itemId || likeLoading[itemId]) {
        return;
      }

      const currentLiked =
        getLikedStatus(item);

      const nextLiked = forceLike
        ? true
        : !currentLiked;

      if (forceLike && currentLiked) {
        return;
      }

      setLikeLoading((current) => ({
        ...current,
        [itemId]: true,
      }));

      updateLikedState(
        itemId,
        nextLiked
      );

      try {
        let response;

        if (nextLiked) {
          response = await like(
            currentUser.uid,
            itemId,
            getItemType(item)
          );
        } else {
          response = await unlike(
            currentUser.uid,
            itemId,
            getItemType(item)
          );
        }

        if (!response?.ok) {
          throw new Error(
            `Like request failed with status ${response?.status}`
          );
        }

        if (nextLiked) {
          setCombinedFeed((items) => {
            const updated = items.map((feedItem) => {
              if (
                String(getItemId(feedItem)) !==
                String(itemId)
              ) {
                return feedItem;
              }

              return {
                ...feedItem,
                liked: true,
                ...(feedItem.item_info
                  ? {
                      item_info: {
                        ...feedItem.item_info,
                        liked: true,
                      },
                    }
                  : {}),
              };
            });

            saveFeedCache(updated).catch(() => {});
            return updated;
          });
          /*
           * The like is already complete. Saving a recommendation
           * seed should not keep the heart button loading.
           */
          postRecommendations(
            currentUser.uid,
            itemId,
            getItemType(item),
            getDisplayName(item),
            getArtistName(item) ||
              getDisplayName(item)
          ).catch((error) => {
            console.warn(
              "[Feed] Could not save recommendation seed:",
              error
            );
          });
        }
      } catch (error) {
        console.error(
          "[Feed] Like error:",
          error
        );

        updateLikedState(
          itemId,
          currentLiked
        );

        Alert.alert(
          "Unable to update like",
          "Please try again."
        );
      } finally {
        setLikeLoading((current) => {
          const updated = {
            ...current,
          };

          delete updated[itemId];

          return updated;
        });
      }
    },
    [
      getArtistName,
      getDisplayName,
      getItemId,
      getItemType,
      getLikedStatus,
      likeLoading,
      saveFeedCache,
      updateLikedState,
    ]
  );

  const handleSingleTap = useCallback(
    (item) => {
      const itemInfo = getItemInfo(item);
      const itemType = getItemType(item);

      if (itemType === "track") {
        navigation.navigate(
          "SongPage",
          {
            track: itemInfo,
          }
        );
        return;
      }

      if (itemType === "artist") {
        navigation.navigate(
          "ArtistPage",
          {
            artist: itemInfo,
          }
        );
        return;
      }

      if (itemType === "album") {
        navigation.navigate(
          "AlbumPage",
          {
            album: itemInfo,
          }
        );
      }
    },
    [
      getItemInfo,
      getItemType,
      navigation,
    ]
  );

  const handleItemTap = useCallback(
    (item) => {
      if (tapTimerRef.current) {
        clearTimeout(
          tapTimerRef.current
        );

        tapTimerRef.current = null;

        handleLikeSong(item, true);
        return;
      }

      tapTimerRef.current =
        setTimeout(() => {
          tapTimerRef.current = null;
          handleSingleTap(item);
        }, DOUBLE_TAP_DELAY);
    },
    [
      handleLikeSong,
      handleSingleTap,
    ]
  );

  const openShareModal = useCallback(
    async (item) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        Alert.alert(
          "Sign in required",
          "You must be signed in to share music."
        );
        return;
      }

      try {
        const response =
          await getFriends(
            currentUser.uid
          );

        if (!response?.ok) {
          throw new Error(
            `Friends request failed with status ${response?.status}`
          );
        }

        const json = await response.json();

        const friends = Array.isArray(json)
          ? json
          : Array.isArray(json?.friends)
            ? json.friends
            : [];

        console.log(
          "[Feed] Friends response:",
          json
        );

        setFriendsList(friends);

        setCurrentShareItem(item);
        setSelectedUser(null);
        setComment("");
        setModalVisible(true);
      } catch (error) {
        console.error(
          "[Feed] Friends error:",
          error
        );

        Alert.alert(
          "Unable to load friends",
          "Please try again."
        );
      }
    },
    []
  );

  const closeShareModal = useCallback(() => {
    setModalVisible(false);
    setSelectedUser(null);
    setComment("");
    setCurrentShareItem(null);
  }, []);

  const submitShare = useCallback(async () => {
    if (
      !selectedUser ||
      !currentShareItem
    ) {
      return;
    }

    try {
      const response = await share(
        selectedUser.userId,
        getRecordId(currentShareItem),
        getItemId(currentShareItem),
        comment.trim(),
        getItemType(currentShareItem),
        getItemInfo(currentShareItem)
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          `Share failed with status ${response.status}`
        );
      }

      Toast.show({
        type: "success",
        text1: "Sent",
        text2: `Shared with ${selectedUser.username}`,
      });

      closeShareModal();
    } catch (error) {
      console.error(
        "[Feed] Share error:",
        error
      );

      Alert.alert(
        "Unable to share",
        "Please try again."
      );
    }
  }, [
    closeShareModal,
    comment,
    currentShareItem,
    getItemId,
    getItemInfo,
    getItemType,
    getRecordId,
    selectedUser,
  ]);

  const getRecommendationContext =
    useCallback((item) => {
      if (
        item?.class === "friend_review"
      ) {
        return {
          heading: "Friend Review",
          description: `${
            item?.author?.username || "Friend"
          } ${
            getTimeAgo(item?.createdAt)
          }`,
        };
      }

      if (
        item?.class ===
        "following_review"
      ) {
        return {
          heading: "Following Review",
          description: `${
            item?.author?.username ||
            "User"
          } ${
            getTimeAgo(item?.createdAt)
          }`,
        };
      }

      if (item?.class === "share") {
        return {
          heading: `${
            item?.shared_by?.username ||
            "A friend"
          } shared this`,
          description:
            item?.comment ||
            getTimeAgo(item?.createdAt),
        };
      }

      const origin =
        item?.origin ||
        item?.item_info?.origin;

      if (origin?.type === "friends") {
        const friendNames = Array.isArray(origin?.friendNames)
          ? origin.friendNames.filter(Boolean)
          : [];

        const singleFriendName =
          origin?.friendName ||
          friendNames[0] ||
          "A friend";

        return {
          heading:
            origin?.friendCount > 1
              ? `Liked By ${friendNames.length > 0
                  ? friendNames.join(", ")
                  : `${origin.friendCount} Friends`}`
              : `Liked By ${singleFriendName}`,
          description:
            "Recommended from your music circle",
        };
      }

      if (origin?.type === "similar") {
        return {
          heading: "Similar To Music You Like",
          description: [
            origin?.title,
            origin?.artist,
          ]
            .filter(Boolean)
            .join(" by "),
        };
      }

      if (origin?.type === "genre") {
        return {
          heading: "From A Genre You Enjoy",
          description:
            origin?.title ||
            "Based on your listening taste",
        };
      }

      if (origin?.type === "like") {
        return {
          heading: "Because You Like",
          description: [
            origin?.title ||
              origin?.name,
            origin?.artist ||
              origin?.artistName,
          ]
            .filter(Boolean)
            .join(" by "),
        };
      }

      if (
        origin?.type === "favourite"
      ) {
        return {
          heading:
            "Because You Favourited",
          description: [
            origin?.title ||
              origin?.name,
            origin?.artist ||
              origin?.artistName,
          ]
            .filter(Boolean)
            .join(" by "),
        };
      }

      if (
        origin?.type === "high-rating"
      ) {
        return {
          heading:
            "Because You Rated Highly",
          description: [
            origin?.title ||
              origin?.name,
            origin?.artist ||
              origin?.artistName,
          ]
            .filter(Boolean)
            .join(" by "),
        };
      }

      if (
        origin?.type === "discovery"
      ) {
        return {
          heading:
            "Fresh Discovery",
          description:
            "Recommended for your taste",
        };
      }

      return {
        heading:
          "Recommended For You",
        description:
          "New music for your feed",
      };
    }, [getTimeAgo]);

  const getCardAccent = useCallback(
    (item) => {
      if (
        item?.class === "friend_review" ||
        item?.author?.is_friend
      ) {
        return "#31c46c";
      }

      if (item?.class === "following_review") {
        return "#3ca8ff";
      }

      if (
        item?.class === "share" ||
        item?.shared_by
      ) {
        return "#f0c419";
      }

      const origin =
        item?.origin ||
        item?.item_info?.origin;

      return ({
        friends: "#f0c419",
        similar: "#a970ff",
        genre: "#ff8a3d",
        favourite: "#ff334f",
        "high-rating": "#ff5fa2",
        like: "#31c46c",
        discovery: "#35afe5",
        feed: "#35afe5",
      })[origin?.type] || "#35afe5";
    },
    []
  );

  const getSourceIcon = useCallback(
    (item) => {
      if (
        item?.class === "share" ||
        item?.shared_by
      ) {
        return "people";
      }

      const origin =
        item?.origin ||
        item?.item_info?.origin;

      return ({
        friends: "people",
        similar: "hub",
        genre: "graphic-eq",
        favourite: "favorite",
        "high-rating": "star",
        like: "favorite-border",
        discovery: "explore",
        feed: "auto-awesome",
      })[origin?.type] || "auto-awesome";
    },
    []
  );


  const renderStars = useCallback(
    (rating = 0) => {
      return (
        <View style={styles.ratingContainer}>
          {[0, 1, 2, 3, 4].map(
            (index) => (
              <Image
                key={index}
                source={
                  index < Number(rating || 0)
                    ? require("../images/starFullIcon.png")
                    : require("../images/starEmptyIcon.png")
                }
                style={styles.starIcon}
              />
            )
          )}
        </View>
      );
    },
    []
  );

  const renderReview = useCallback(
    (item) => {
      let review = null;

      if (
        item?.class === "friend_review" ||
        item?.class ===
          "following_review"
      ) {
        review = {
          username:
            item?.author?.username,
          avatar:
            item?.author?.avatar,
          message:
            item?.message,
          rating:
            item?.rating,
          likes:
            item?.upvotes,
          emoji:
            item?.emoji,
          hearted:
            item?.hearted,
        };
      } else {
        const itemInfo =
          getItemInfo(item);

        const topReview =
          itemInfo?.topReview ||
          item?.topReview;

        if (
          topReview &&
          Object.keys(topReview).length > 0
        ) {
          review = {
            username:
              topReview?.author
                ?.username,
            avatar:
              topReview?.author
                ?.avatarLong ||
              topReview?.author?.avatar,
            message:
              topReview?.review ||
              topReview?.message,
            rating:
              topReview?.rating,
            likes:
              topReview?.upvotes,
            emoji:
              topReview?.emoji,
            hearted:
              topReview?.hearted,
          };
        }
      }

      if (!review) {
        return null;
      }

      return (
        <View style={styles.reviewContainer}>
          <Image
            source={{
              uri:
                review.avatar ||
                PLACEHOLDER_AVATAR,
            }}
            style={styles.reviewAvatar}
          />

          <View style={styles.reviewContent}>
            <View style={styles.reviewUsernameRow}>
              <Text style={styles.reviewUsername}>
                {review.username ||
                  "Treble User"}
              </Text>

              {review.emoji ? (
                <Text style={styles.reviewEmoji}>
                  {typeof review.emoji ===
                  "string"
                    ? review.emoji.replace(
                        /^\[|\]$/g,
                        ""
                      )
                    : review.emoji}
                </Text>
              ) : null}

              {review.hearted ? (
                <Image
                  source={require("../images/whiteFullHeart.png")}
                  style={styles.reviewHeart}
                />
              ) : null}
            </View>

            {review.message ? (
              <Text style={styles.reviewText}>
                {review.message}
              </Text>
            ) : null}

            {renderStars(review.rating)}

            <Text style={styles.reviewLikes}>
              {review.likes || 0} Likes
            </Text>
          </View>
        </View>
      );
    },
    [
      getItemInfo,
      renderStars,
    ]
  );

  const isCreatePostItem =
    useCallback((item) => {
      const source =
        String(
          item?.source ||
          item?.item_info?.source ||
          item?.origin?.type ||
          item?.item_info?.origin?.type ||
          ""
        ).toLowerCase();

      const hasPostSongId =
        Boolean(
          item?.songId ||
          item?.listenableId ||
          item?.listenable_id ||
          item?.item_info?.songId ||
          item?.item_info?.listenableId ||
          item?.item_info?.listenable_id
        );

      const hasPostContent =
        Boolean(
          item?.comment ||
          item?.item_info?.comment
        );

      return (
        source.includes("created-post") ||
        source === "post" ||
        source.includes("post") ||
        String(item?.record_id || "")
          .startsWith("feed-post-") ||
        (
          hasPostSongId &&
          hasPostContent &&
          Boolean(
            item?.authorId ||
            item?.item_info?.authorId
          )
        )
      );
    }, []);

  const openPostPage =
    useCallback(
      (post) => {
        navigation.navigate(
          "Posts",
          {
            post,
          }
        );
      },
      [navigation]
    );

  const renderCreatePostCard =
    useCallback(
      (item) => {
        const itemInfo =
          getItemInfo(item);

        const imageUrl =
          getImageUrl(item);

        const title =
          getDisplayName(item);

        const artist =
          getArtistName(item);

        const comment =
          itemInfo?.comment ||
          item?.origin?.description ||
          "";

        const rating =
          Math.max(
            0,
            Math.min(
              5,
              Number(
                itemInfo?.rating ||
                item?.rating ||
                0
              )
            )
          );

        const username =
          itemInfo?.username ||
          item?.username ||
          "Treble User";

        return (
          <TouchableOpacity
            style={[
              styles.createPostFeedCard,
              isCompact &&
                styles.createPostFeedCardCompact,
            ]}
            activeOpacity={0.84}
            onPress={() =>
              openPostPage(item)
            }
          >
            <View
              style={
                styles.createPostBadgeRow
              }
            >
              <View
                style={
                  styles.createPostBadge
                }
              >
                <Icon
                  name="edit"
                  size={14}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.createPostBadgeText
                  }
                >
                  POST
                </Text>
              </View>

              <Text
                style={
                  styles.createPostAuthor
                }
                numberOfLines={1}
              >
                {username}
              </Text>

              <Text
                style={
                  styles.createPostTime
                }
              >
                {getTimeAgo(
                  item?.createdAt
                )}
              </Text>
            </View>

            <View
              style={
                styles.createPostBody
              }
            >
              <Image
                source={{
                  uri: imageUrl,
                }}
                style={
                  styles.createPostArtwork
                }
              />

              <View
                style={
                  styles.createPostDetails
                }
              >
                <Text
                  style={
                    styles.createPostSongTitle
                  }
                  numberOfLines={1}
                >
                  {title}
                </Text>

                <Text
                  style={
                    styles.createPostArtist
                  }
                  numberOfLines={1}
                >
                  {artist}
                </Text>

                <Text
                  style={
                    styles.createPostComment
                  }
                  numberOfLines={3}
                >
                  {comment}
                </Text>

                <View
                  style={
                    styles.createPostFooter
                  }
                >
                  <View
                    style={
                      styles.createPostStars
                    }
                  >
                    {[1, 2, 3, 4, 5].map(
                      (value) => (
                        <Icon
                          key={value}
                          name={
                            value <= rating
                              ? "star"
                              : "star-border"
                          }
                          size={16}
                          color={
                            value <= rating
                              ? "#ffb400"
                              : "rgba(255,255,255,0.34)"
                          }
                        />
                      )
                    )}
                  </View>

                  <View
                    style={
                      styles.createPostOpenHint
                    }
                  >
                    <Text
                      style={
                        styles.createPostOpenText
                      }
                    >
                      View post
                    </Text>

                    <Icon
                      name="chevron-right"
                      size={18}
                      color="rgba(255,255,255,0.64)"
                    />
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      },
      [
        getArtistName,
        getDisplayName,
        getImageUrl,
        getItemInfo,
        getTimeAgo,
        isCompact,
        openPostPage,
      ]
    );

  const renderFeedItem = useCallback(
    ({ item }) => {
      if (isCreatePostItem(item)) {
        return renderCreatePostCard(item);
      }

      const context =
        getRecommendationContext(item);

      const itemInfo =
        getItemInfo(item);

      const itemId =
        getItemId(item);

      const previewUrl =
        getPreviewUrl(item);

      const liked =
        getLikedStatus(item);

      const imageUrl =
        getImageUrl(item);

      const displayName =
        getDisplayName(item);

      const albumName =
        getAlbumName(item);

      const artistName =
        getArtistName(item);

      const cardAccent =
        getCardAccent(item);

      const isCurrentPreview =
        currentPreview === previewUrl;

      const isPreviewLoading =
        playLoadingId === String(itemId);

      return (
        <TouchableWithoutFeedback
          onPress={() =>
            handleItemTap(item)
          }
        >
          <View
            style={[
              styles.card,
              isWeb && styles.webCard,
              isTablet &&
                styles.tabletCard,
              isCompact &&
                styles.compactCard,
              {
                borderColor: cardAccent,
                shadowColor: cardAccent,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.contextContainer}>
                <View style={styles.contextHeadingRow}>
                  <View
                    style={[
                      styles.sourceIconCircle,
                      {
                        borderColor: cardAccent,
                        backgroundColor: `${cardAccent}20`,
                      },
                    ]}
                  >
                    <Icon
                      name={getSourceIcon(item)}
                      size={15}
                      color={cardAccent}
                    />
                  </View>

                  <Text style={styles.contextHeading}>
                    {context.heading}
                  </Text>
                </View>

                {context.description ? (
                  <Text
                    style={styles.contextDescription}
                    numberOfLines={2}
                  >
                    {context.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={(event) => {
                    event?.stopPropagation?.();

                    handleLikeSong(item);
                  }}
                  disabled={
                    Boolean(
                      likeLoading[itemId]
                    )
                  }
                  style={styles.actionButton}
                >
                  {likeLoading[itemId] ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                      style={styles.actionLoader}
                    />
                  ) : (
                    <Image
                      source={
                        liked
                          ? require("../images/whiteFullHeart.png")
                          : require("../images/whiteOpenHeart.png")
                      }
                      style={styles.actionIcon}
                    />
                  )}

                  <Text style={styles.actionText}>
                    {liked ? "Liked" : "Like"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(event) => {
                    event?.stopPropagation?.();

                    openShareModal(item);
                  }}
                  style={styles.actionButton}
                >
                  <Image
                    source={require("../images/shareIcon.png")}
                    style={styles.actionIcon}
                  />

                  <Text style={styles.actionText}>
                    Share
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.musicLayout,
                isCompact &&
                  styles.compactMusicLayout,
              ]}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{
                    uri: imageUrl,
                  }}
                  style={[
                    styles.postImage,
                    isCompact &&
                      styles.compactPostImage,
                  ]}
                />

                <View style={styles.mediaTypeBadge}>
                  <Text style={styles.mediaTypeText}>
                    {String(
                      getItemType(item)
                    ).toUpperCase()}
                  </Text>
                </View>

                {getItemType(item) === "track" ? (
                  <TouchableOpacity
                    onPress={(event) => {
                      event?.stopPropagation?.();

                      handlePlayItem(
                        item
                      );
                    }}
                    style={styles.playButton}
                    disabled={
                      Boolean(playLoadingId) &&
                      !isPreviewLoading
                    }
                  >
                    <AnimatedCircularProgress
                      size={58}
                      width={4}
                      fill={
                        isCurrentPreview
                          ? progress
                          : 0
                      }
                      tintColor={
                        colours.secondaryblue
                      }
                      backgroundColor="rgba(255,255,255,0.20)"
                      rotation={0}
                    >
                      {() =>
                        isPreviewLoading ? (
                          <ActivityIndicator
                            size="small"
                            color="#ffffff"
                          />
                        ) : (
                          <Icon
                            name={
                              isCurrentPreview &&
                              isPlaying
                                ? "stop"
                                : "play-arrow"
                            }
                            size={34}
                            color="#ffffff"
                          />
                        )
                      }
                    </AnimatedCircularProgress>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.songInformation}>
                <Text
                  style={styles.postTitle}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>

                {albumName ? (
                  <Text
                    style={styles.postAlbum}
                    numberOfLines={1}
                  >
                    {albumName}
                  </Text>
                ) : null}

                {artistName ? (
                  <Text
                    style={styles.postArtist}
                    numberOfLines={1}
                  >
                    {artistName}
                  </Text>
                ) : null}
              </View>
            </View>

            {renderReview(item)}
          </View>
        </TouchableWithoutFeedback>
      );
    },
    [
      currentPreview,
      getAlbumName,
      getArtistName,
      getCardAccent,
      getDisplayName,
      getImageUrl,
      getItemId,
      getItemInfo,
      getLikedStatus,
      getPreviewUrl,
      getRecommendationContext,
      getSourceIcon,
      handleItemTap,
      handleLikeSong,
      handlePlayItem,
      isCompact,
      isPlaying,
      isTablet,
      isWeb,
      likeLoading,
      openShareModal,
      progress,
      playLoadingId,
      renderReview,
    ]
  );

  const renderFriendItem = useCallback(
    ({ item }) => {
      const selected =
        selectedUser?.userId ===
        item?.userId;

      return (
        <TouchableOpacity
          onPress={() =>
            setSelectedUser(
              selected ? null : item
            )
          }
          style={[
            styles.friendItem,
            selected &&
              styles.selectedFriendItem,
          ]}
        >
          <View style={styles.friendAvatarContainer}>
            <Image
              source={{
                uri:
                  item?.avatar ||
                  PLACEHOLDER_AVATAR,
              }}
              style={styles.friendAvatar}
            />

            {selected ? (
              <View style={styles.selectedCheck}>
                <Icon
                  name="check"
                  size={17}
                  color="#ffffff"
                />
              </View>
            ) : null}
          </View>

          <Text
            style={styles.friendUsername}
            numberOfLines={1}
          >
            {item?.username ||
              "Treble User"}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedUser]
  );

  const handleViewableItemsChanged =
    useRef(({ viewableItems }) => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        return;
      }

      viewableItems.forEach(
        ({ item }) => {
          const isRecommendation =
            !item?.class;

          const recommendationId =
            item?.record_id ||
            item?.item_info?.record_id;

          if (
            !isRecommendation ||
            !recommendationId ||
            viewedRecommendationIds.current.has(
              recommendationId
            )
          ) {
            return;
          }

          viewedRecommendationIds.current.add(
            recommendationId
          );

          setRecommendationServed(
            currentUser.uid,
            recommendationId
          ).catch((error) => {
            console.warn(
              "[Feed] Could not mark recommendation as served:",
              error
            );
          });
        }
      );
    }).current;

  const keyExtractor = useCallback(
    (item, index) => {
      const itemId =
        getRecordId(item) ||
        getItemId(item) ||
        index;

      return itemId
        ? `feed-${itemId}`
        : `feed-fallback-${index}`;
    },
    [
      getItemId,
      getRecordId,
    ]
  );

  const renderListFooter =
    useCallback(() => {
      if (loadingMore) {
        return (
          <View style={styles.listFooter}>
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />

            <Text style={styles.loadingText}>
              Loading more music...
            </Text>
          </View>
        );
      }

      if (
        !hasMore &&
        combinedFeed.length > 0
      ) {
        return (
          <Text style={styles.endOfFeedText}>
            You’re all caught up.
          </Text>
        );
      }

      return <View style={styles.footerSpace} />;
    }, [
      combinedFeed.length,
      hasMore,
      loadingMore,
    ]);

  const renderEmptyFeed =
    useCallback(() => {
      return (
        <View style={styles.emptyContainer}>
          <Icon
            name="music-note"
            size={54}
            color="rgba(255,255,255,0.5)"
          />

          <Text style={styles.emptyTitle}>
            Your feed is empty
          </Text>

          <Text style={styles.emptyDescription}>
            Like, rate, and favourite music to receive recommendations.
          </Text>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>
              Refresh Feed
            </Text>
          </TouchableOpacity>
        </View>
      );
    }, [handleRefresh]);

  const filteredFeed =
    useMemo(() => {
      if (feedFilter === "all") {
        return combinedFeed;
      }

      return combinedFeed.filter(
        (item) => {
          const origin =
            item?.origin ||
            item?.item_info?.origin;

          const isFriendActivity =
            item?.class ===
              "friend_review" ||
            item?.class ===
              "following_review" ||
            item?.class === "share" ||
            Boolean(item?.shared_by) ||
            origin?.type === "friends";

          if (
            feedFilter === "friends"
          ) {
            return isFriendActivity;
          }

          return !isFriendActivity;
        }
      );
    }, [
      combinedFeed,
      feedFilter,
    ]);

  const feedStats =
    useMemo(() => {
      let friendActivity = 0;
      let recommendations = 0;
      let liked = 0;

      combinedFeed.forEach((item) => {
        const origin =
          item?.origin ||
          item?.item_info?.origin;

        const isFriendActivity =
          item?.class ===
            "friend_review" ||
          item?.class ===
            "following_review" ||
          item?.class === "share" ||
          Boolean(item?.shared_by) ||
          origin?.type === "friends";

        if (isFriendActivity) {
          friendActivity += 1;
        } else {
          recommendations += 1;
        }

        if (getLikedStatus(item)) {
          liked += 1;
        }
      });

      return {
        friendActivity,
        recommendations,
        liked,
      };
    }, [
      combinedFeed,
      getLikedStatus,
    ]);

  const renderFeedHeader =
    useCallback(() => {
      return (
        <View style={styles.feedHeaderBlock}>
          <View style={styles.homeHero}>
            <View style={styles.homeHeroText}>
              <View style={styles.homeKickerRow}>
                <Icon
                  name="home"
                  size={16}
                  color={
                    colours.lightblue ||
                    "#35afe5"
                  }
                />

                <Text style={styles.homeKicker}>
                  YOUR MUSIC HOME
                </Text>
              </View>

              <Text style={styles.homeTitle}>
                Home Feed
              </Text>

              <Text style={styles.homeSubtitle}>
                Music picked for you,
                reviews from your circle,
                and songs your friends are
                sharing right now.
              </Text>
            </View>

            {isDesktopWeb ? (
              <TouchableOpacity
                style={styles.refreshFeedButton}
                onPress={handleRefresh}
                disabled={refreshing}
                activeOpacity={0.82}
              >
                {refreshing ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Icon
                    name="refresh"
                    size={19}
                    color="#ffffff"
                  />
                )}

                <Text
                  style={
                    styles.refreshFeedButtonText
                  }
                >
                  New Mix
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={
                  styles.mobileNotificationsButton
                }
                onPress={() =>
                  navigation.navigate(
                    "Notifications"
                  )
                }
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  notificationsCount > 0
                    ? `${notificationsCount} unread notifications`
                    : "Notifications"
                }
                hitSlop={8}
              >
                <Icon
                  name="notifications-none"
                  size={25}
                  color="#ffffff"
                />

                {notificationsCount > 0 ? (
                  <View
                    style={
                      styles.mobileNotificationBadge
                    }
                  >
                    <Text
                      style={
                        styles.mobileNotificationBadgeText
                      }
                    >
                      {notificationsCount > 99
                        ? "99+"
                        : notificationsCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.feedFilterBar}>
            {[
              {
                key: "all",
                label: "All",
                icon: "view-stream",
              },
              {
                key: "friends",
                label: "Friends",
                icon: "people-outline",
              },
              {
                key: "for-you",
                label: "For You",
                icon: "auto-awesome",
              },
            ].map((option) => {
              const active =
                feedFilter === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() =>
                    setFeedFilter(
                      option.key
                    )
                  }
                  style={[
                    styles.feedFilterButton,

                    active &&
                      styles.feedFilterButtonActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Icon
                    name={option.icon}
                    size={17}
                    color={
                      active
                        ? "#ffffff"
                        : "rgba(255,255,255,0.48)"
                    }
                  />

                  <Text
                    style={[
                      styles.feedFilterText,

                      active &&
                        styles.feedFilterTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filteredFeed.length === 0 &&
          combinedFeed.length > 0 ? (
            <View style={styles.filterEmptyCard}>
              <Icon
                name="filter-list-off"
                size={24}
                color="rgba(255,255,255,0.36)"
              />

              <Text
                style={styles.filterEmptyText}
              >
                Nothing in this section yet.
                Try another feed filter.
              </Text>
            </View>
          ) : null}
        </View>
      );
    }, [
      combinedFeed.length,
      feedFilter,
      filteredFeed.length,
      handleRefresh,
      isDesktopWeb,
      navigation,
      notificationsCount,
      refreshing,
    ]);

  const handleFeedScroll =
    useCallback((event) => {
      const offset =
        Number(
          event?.nativeEvent
            ?.contentOffset?.y ||
          0
        );

      feedScrollOffsetRef.current =
        Math.max(0, offset);

      if (offset > 0) {
        setPullDistance(0);
      }
    }, []);

  const handlePullStart =
    useCallback((event) => {
      if (
        feedScrollOffsetRef.current >
        0
      ) {
        pullStartYRef.current = null;
        return;
      }

      pullStartYRef.current =
        event?.nativeEvent
          ?.pageY ??
        event?.nativeEvent
          ?.touches?.[0]
          ?.pageY ??
        null;
    }, []);

  const handlePullMove =
    useCallback((event) => {
      if (
        pullStartYRef.current ===
          null ||
        feedScrollOffsetRef.current >
          0 ||
        refreshing
      ) {
        return;
      }

      const currentY =
        event?.nativeEvent
          ?.pageY ??
        event?.nativeEvent
          ?.touches?.[0]
          ?.pageY ??
        pullStartYRef.current;

      const distance =
        Math.max(
          0,
          Math.min(
            110,
            (
              currentY -
              pullStartYRef.current
            ) * 0.55
          )
        );

      setPullDistance(distance);
    }, [refreshing]);

  const handlePullEnd =
    useCallback(() => {
      const shouldRefresh =
        pullDistance >= 64 &&
        !refreshing;

      pullStartYRef.current = null;
      setPullDistance(0);

      if (shouldRefresh) {
        handleRefresh();
      }
    }, [
      handleRefresh,
      pullDistance,
      refreshing,
    ]);

  return (
    <View
      style={[
        styles.container,
        isWeb && styles.webContainer,
      ]}
    >
      {/* Desktop keeps the compact search bar across the top. */}
      {isDesktopWeb ? (
        <View
          style={[
            styles.pageHeader,
            styles.desktopPageHeader,
          ]}
        >
          <View style={styles.searchContainer}>
            <SearchBar />
          </View>

          <TouchableOpacity
            style={styles.notificationsButton}
            onPress={() =>
              navigation.navigate(
                "Notifications"
              )
            }
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={
              notificationsCount > 0
                ? `${notificationsCount} unread notifications`
                : "Notifications"
            }
            hitSlop={8}
          >
            <Image
              source={require("../images/notificationsIcon2.png")}
              style={styles.notificationIcon}
            />

            {notificationsCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationsCount > 99
                    ? "99+"
                    : notificationsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* =========================================================
          LEFT SIDEBAR
      ========================================================= */}
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb && styles.desktopSideMenu,
          isMobileWeb && styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={isDesktopWeb ? true : menuOpen}
          setMenuOpen={
            isDesktopWeb
              ? () => {}
              : setMenuOpen
          }
          isDesktop={isDesktopWeb}
        />
      </View>

      {/* Mobile search sits beside the hamburger with its own gap. */}
      {!isDesktopWeb ? (
        <View style={styles.mobileTopSearchRow}>
          <View style={styles.mobileHamburgerSpace} />

          <View style={styles.mobileTopSearchContainer}>
            <SearchBar />
          </View>
        </View>
      ) : null}

      {/* =========================================================
          MAIN FEED
      ========================================================= */}
      <View
        style={[
          styles.content,
          isDesktopWeb && styles.desktopContent,
          isMobileWeb && styles.mobileWebContent,
        ]}
      >
        {pullDistance > 0 ||
        refreshing ? (
          <View
            style={[
              styles.pullRefreshContainer,
              {
                height:
                  refreshing
                    ? 58
                    : pullDistance,
                opacity:
                  refreshing
                    ? 1
                    : Math.min(
                        1,
                        pullDistance / 48
                      ),
              },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.pullRefreshWheel,
                pullDistance >= 64 &&
                  styles.pullRefreshWheelReady,
              ]}
            >
              <ActivityIndicator
                size="small"
                color="#ffffff"
                animating={
                  refreshing ||
                  pullDistance >= 64
                }
              />
            </View>

            <Text
              style={
                styles.pullRefreshText
              }
            >
              {refreshing
                ? "Refreshing..."
                : pullDistance >= 64
                  ? "Release to refresh"
                  : "Pull to refresh"}
            </Text>
          </View>
        ) : null}

        {isLoading ? (

          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#ffffff"
            />

            <Text style={styles.loadingTitle}>
              Building your mix
            </Text>

            <Text style={styles.loadingText}>
              Loading music and friend activity...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFeed}
            renderItem={renderFeedItem}
            ListHeaderComponent={renderFeedHeader}
            keyExtractor={keyExtractor}

            /*
            * The FlatList is the dedicated scroll container.
            * Mouse wheel, trackpad and touch scrolling all work here.
            */
            style={[
              styles.feedList,
              isWeb && styles.webFeedList,
            ]}
            onScroll={
              handleFeedScroll
            }
            scrollEventThrottle={16}
            onTouchStart={
              handlePullStart
            }
            onTouchMove={
              handlePullMove
            }
            onTouchEnd={
              handlePullEnd
            }
            onTouchCancel={
              handlePullEnd
            }
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"

            contentContainerStyle={[
              styles.feedContent,
              isWeb && styles.webFeedContent,
              filteredFeed.length === 0 &&
                combinedFeed.length === 0 &&
                styles.emptyFeedContent,
            ]}

            ListEmptyComponent={
              combinedFeed.length === 0 &&
              authReady &&
              !isLoading
                ? renderEmptyFeed
                : null
            }
            ListFooterComponent={renderListFooter}

            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#ffffff"
                colors={["#ffffff"]}
                progressBackgroundColor={
                  colours.foreground
                }
                progressViewOffset={
                  isCompact ? 86 : 24
                }
              />
            }

            onEndReached={loadMoreFeed}
            onEndReachedThreshold={0.85}

            initialNumToRender={6}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={32}
            windowSize={9}

            showsVerticalScrollIndicator={false}

            onViewableItemsChanged={handleViewableItemsChanged}

            viewabilityConfig={{
              itemVisiblePercentThreshold: 60,
              minimumViewTime: 350,
            }}

            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled={true}
            scrollEnabled={true}
            removeClippedSubviews={false}
          />
        )}
      </View>

      {/* =========================================================
          CREATE POST BUTTON
      ========================================================= */}
      <TouchableOpacity
        style={[
          styles.createPostButton,
          isDesktopWeb &&
            styles.desktopCreatePostButton,
          isMobileWeb &&
            styles.mobileWebCreatePostButton,
        ]}
        onPress={openCreatePost}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Create a new post"
        accessibilityHint="Opens the Treble post composer"
      >
        <Icon
          name="add"
          size={
            isDesktopWeb
              ? 40
              : 34
          }
          color="#ffffff"
        />
      </TouchableOpacity>

      {/* =========================================================
          MOBILE BOTTOM NAVIGATION
      ========================================================= */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb && styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>

      {/* =========================================================
          SHARE MODAL
      ========================================================= */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={closeShareModal}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
          style={styles.modalKeyboardView}
        >
          <TouchableWithoutFeedback
            onPress={closeShareModal}
          >
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback
                onPress={() => {}}
              >
                <Animated.View
                  style={[
                    styles.modalContent,
                    isDesktopWeb && styles.webModalContent,
                    {
                      transform: [
                        {
                          translateY: slideAnim,
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTitleContainer}>
                      <Text style={styles.modalTitle}>
                        Share Music
                      </Text>

                      <Text
                        style={styles.modalSubtitle}
                        numberOfLines={1}
                      >
                        {getDisplayName(currentShareItem)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={closeShareModal}
                      style={styles.closeModalButton}
                    >
                      <Icon
                        name="close"
                        size={25}
                        color="#ffffff"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.friendPrompt}>
                    Select a friend
                  </Text>

                  <FlatList
                    data={friendsList}
                    renderItem={renderFriendItem}
                    keyExtractor={(item, index) =>
                      String(
                        item?.userId ||
                        item?.uid ||
                        item?.id ||
                        index
                      )
                    }
                    numColumns={
                      width < 390
                        ? 2
                        : isCompact
                          ? 3
                          : 4
                    }
                    key={
                      width < 390
                        ? "small-mobile-friends"
                        : isCompact
                          ? "compact-friends"
                          : "large-friends"
                    }
                    style={styles.friendsFlatList}
                    contentContainerStyle={
                      styles.friendList
                    }
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <Text
                        style={styles.noFriendsText}
                      >
                        No friends were found.
                      </Text>
                    }
                  />

                  {selectedUser ? (
                    <View style={styles.commentSection}>
                      <Text style={styles.commentPrompt}>
                        Message for {selectedUser.username}
                      </Text>

                      <TextInput
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Add an optional message..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        style={styles.commentInput}
                        maxLength={100}
                        multiline
                      />

                      <Text style={styles.characterCount}>
                        {comment.length}/100
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    onPress={submitShare}
                    disabled={!selectedUser}
                    style={[
                      styles.shareButton,
                      !selectedUser &&
                        styles.disabledShareButton,
                    ]}
                  >
                    <Icon
                      name="send"
                      size={20}
                      color="#ffffff"
                    />

                    <Text style={styles.shareButtonText}>
                      Share
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
desktopBottomNavBar: {
  left: DESKTOP_SIDEBAR_WIDTH,
  right: 0,
},
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colours.background,
  },

  webContainer: {
    width: "100%",
    height: "100vh",
    minHeight: 0,
    overflow: "hidden",
  },

  /* =========================================================
     TOP HEADER
  ========================================================= */

  pageHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,

    flexDirection: "row",
    alignItems: "center",

    paddingTop: 50,
    paddingHorizontal: 20,
  },

  desktopPageHeader: {
    top: 0,
    left: 280,
    right: 0,

    height: 58,

    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 32,
    paddingRight: 32,

    alignItems: "center",

    backgroundColor:
      colours.background,
  },
  mobileWebPageHeader: {
    left: 0,
    right: 0,

    paddingTop: 20,
    paddingHorizontal: 18,
  },

  searchContainer: {
    flex: 1,
    minWidth: 0,
  },

  notificationsButton: {
    position: "relative",
    width: 48,
    height: 48,
    marginLeft: 14,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 80,
  },

  notificationIcon: {
    width: 29,
    height: 29,
    resizeMode: "contain",
  },

  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff334f",
    borderWidth: 2,
    borderColor: colours.background,
  },

  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },

  /* =========================================================
     LEFT SIDEBAR
  ========================================================= */

  sideMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 20,
  },

  desktopSideMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    right: undefined,
    bottom: 0,

    width: 280,
    height: "100vh",

    zIndex: 100,
    elevation: 20,

    overflow: "hidden",
  },

  mobileSideMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    right: undefined,
    bottom: 0,
    zIndex: 100,
},

  /* =========================================================
     MAIN CONTENT
  ========================================================= */

  content: {
    flex: 1,
    minHeight: 0,

    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 80,
  },

  desktopContent: {
    position: "absolute",

    /*
    * Starts directly below the 58px search header.
    */
    top: 58,
    left: 280,
    right: 0,
    bottom: 0,

    width: "auto",
    maxWidth: undefined,

    minHeight: 0,

    paddingTop: 18,
    paddingBottom: 0,
    paddingLeft: 24,
    paddingRight: 24,

    alignItems: "center",

    overflow: "hidden",
  },


  mobileWebContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    minHeight: 0,

    paddingTop: 80,
    paddingBottom: 88,
    paddingHorizontal: 10,

    overflow: "hidden",
  },

  feedTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  forYouBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.35)",
    backgroundColor: "rgba(53,175,229,0.10)",
  },

  forYouBadgeText: {
    color:
      colours.lightblue ||
      "#35afe5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  titleRow: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    marginBottom: 14,
  },

  webTitleRow: {
    marginBottom: 14,
  },

  mobileHeaderSection: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    marginBottom: 5,
  },

  mobileTitleRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  headerTextContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },

  mobileTopSearchRow: {
    position: "absolute",
    top: 16,
    left: 12,
    right: 12,

    minHeight: 52,

    flexDirection: "row",
    alignItems: "center",

    zIndex: 70,
    elevation: 15,
  },

  /*
   * Reserve a fixed area for the Sidebar hamburger so the
   * search bar can never slide underneath or overlap it.
   */
  mobileHamburgerSpace: {
    width: 58,
    flexShrink: 0,
  },

  mobileTopSearchContainer: {
    flex: 1,
    minWidth: 0,

    marginLeft: 12,

    position: "relative",
    zIndex: 20,
  },

  header: {
    color:
        colours.lightblue ||
        "#35afe5",
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800",
  },

  headerDescription: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },

  refreshHint: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 0,
  },

  mobileHeader: {
    fontSize: 23,
    lineHeight: 28,
  },

  mobileHeaderDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },

  loadingContainer: {
    flex: 1,
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 16,
  },

  loadingText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    marginTop: 10,
  },

  /*
   * This is the scrollable element.
   */
  feedList: {
    flex: 1,
    minHeight: 0,

    width: "100%",
    maxWidth: 780,

    alignSelf: "center",
  },

  webFeedList: {
    flex: 1,
    minHeight: 0,
    height: "100%",

    /*
    * Scrolling remains enabled.
    */
    overflowY: "auto",
    overflowX: "hidden",

    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",

    /*
    * Hide the scrollbar in Firefox and older Microsoft browsers.
    */
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  feedContent: {
    flexGrow: 0,
    paddingBottom: 140,
  },

  webFeedContent: {
    width: "100%",
    maxWidth: 780,

    alignSelf: "center",

    paddingTop: 2,
    paddingBottom: 80,
  },

  emptyFeedContent: {
    flexGrow: 1,
  },

  feedHeaderBlock: {
    width: "100%",
    maxWidth: 780,

    alignSelf: "center",

    marginBottom: 16,
  },

  homeHero: {
    width: "100%",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 18,
  },

  homeHeroText: {
    flex: 1,
    minWidth: 0,

    paddingRight: 14,
  },

  homeKickerRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 6,

    marginBottom: 5,
  },

  homeKicker: {
    color:
      colours.lightblue ||
      "#35afe5",

    fontSize: 9,
    fontWeight: "900",

    letterSpacing: 1.5,
  },

  homeTitle: {
    color: "#ffffff",

    fontSize: 32,
    lineHeight: 39,

    fontWeight: "900",
  },

  homeSubtitle: {
    maxWidth: 560,

    color:
      "rgba(255,255,255,0.56)",

    fontSize: 13,
    lineHeight: 20,

    marginTop: 5,
  },

  /*
   * Mobile notification button matches the Explore page:
   * same size, shape, right-side header position and live badge.
   */
  mobileNotificationsButton: {
    position: "relative",
    width: 46,
    height: 46,

    flexShrink: 0,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 15,

    backgroundColor:
      "rgba(255,255,255,0.055)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.09)",
  },

  mobileNotificationBadge: {
    position: "absolute",

    top: -5,
    right: -5,

    minWidth: 21,
    height: 21,

    paddingHorizontal: 5,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 11,

    backgroundColor: "#ff405f",

    borderWidth: 2,
    borderColor:
      colours.background ||
      "#101010",
  },

  mobileNotificationBadgeText: {
    color: "#ffffff",

    fontSize: 9,
    fontWeight: "900",
  },

  refreshFeedButton: {
    minHeight: 40,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 7,

    paddingHorizontal: 14,

    borderRadius: 13,

    backgroundColor:
      colours.lightblue ||
      "#35afe5",
  },

  refreshFeedButtonText: {
    color: "#ffffff",

    fontSize: 11,
    fontWeight: "900",
  },

  feedFilterBar: {
    width: "100%",

    flexDirection: "row",

    padding: 5,
    marginBottom: 16,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.035)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.065)",
  },

  feedFilterButton: {
    flex: 1,

    minHeight: 40,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,

    borderRadius: 12,
  },

  feedFilterButtonActive: {
    backgroundColor:
      "rgba(53,175,229,0.17)",
  },

  feedFilterText: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 11,
    fontWeight: "800",
  },

  feedFilterTextActive: {
    color: "#ffffff",
  },

  filterEmptyCard: {
    minHeight: 110,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  filterEmptyText: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 12,
    lineHeight: 18,

    textAlign: "center",

    marginTop: 7,
  },

  pullRefreshContainer: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    gap: 5,

    overflow: "hidden",
  },

  pullRefreshWheel: {
    width: 30,
    height: 30,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 15,

    backgroundColor:
      "rgba(255,255,255,0.08)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.10)",
  },

  pullRefreshWheelReady: {
    backgroundColor:
      "rgba(53,175,229,0.22)",

    borderColor:
      "rgba(53,175,229,0.42)",
  },

  pullRefreshText: {
    color:
      "rgba(255,255,255,0.68)",

    fontSize: 11,
    fontWeight: "700",
  },

  createPostFeedCard: {
    width: "100%",
    maxWidth: 720,

    alignSelf: "center",

    padding: 14,
    marginBottom: 14,

    borderRadius: 18,

    backgroundColor:
      "rgba(27,27,30,0.99)",

    borderWidth: 1,
    borderColor:
      "rgba(255,180,0,0.24)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,

    elevation: 4,
  },

  createPostFeedCardCompact: {
    width: "100%",
    maxWidth: "100%",

    padding: 12,
    borderRadius: 16,
  },

  createPostBadgeRow: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 11,
  },

  createPostBadge: {
    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    paddingHorizontal: 8,
    paddingVertical: 4,

    borderRadius: 10,

    backgroundColor:
      "rgba(255,180,0,0.16)",

    borderWidth: 1,
    borderColor:
      "rgba(255,180,0,0.30)",
  },

  createPostBadgeText: {
    color: "#ffffff",

    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  createPostAuthor: {
    flex: 1,

    color: "#ffffff",

    fontSize: 12,
    fontWeight: "800",

    marginLeft: 9,
  },

  createPostTime: {
    color:
      "rgba(255,255,255,0.44)",

    fontSize: 10,
  },

  createPostBody: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  createPostArtwork: {
    width: 92,
    height: 92,

    borderRadius: 13,

    backgroundColor:
      "rgba(255,255,255,0.06)",

    marginRight: 13,
  },

  createPostDetails: {
    flex: 1,
    minWidth: 0,

    justifyContent: "center",
  },

  createPostSongTitle: {
    color: "#ffffff",

    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },

  createPostArtist: {
    color:
      "rgba(255,255,255,0.56)",

    fontSize: 12,

    marginTop: 2,
  },

  createPostComment: {
    color:
      "rgba(255,255,255,0.84)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 8,
  },

  createPostFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginTop: 8,
  },

  createPostStars: {
    flexDirection: "row",
    alignItems: "center",
  },

  createPostOpenHint: {
    flexDirection: "row",
    alignItems: "center",
  },

  createPostOpenText: {
    color:
      "rgba(255,255,255,0.56)",

    fontSize: 10,
    fontWeight: "700",
  },

  card: {
    width: "100%",

    marginBottom: 18,
    padding: 0,

    overflow: "hidden",

    borderRadius: 22,

    backgroundColor:
      "rgba(255,255,255,0.045)",

    borderWidth: 1,

    shadowColor: "#000000",

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.18,
    shadowRadius: 16,

    elevation: 4,
  },

  webCard: {
    width: "100%",
    maxWidth: 720,

    alignSelf: "center",

    borderRadius: 22,
  },

  tabletCard: {
    maxWidth: 700,
  },

  compactCard: {
    borderRadius: 16,
  },

  compactMusicLayout: {
    alignItems: "stretch",
  },

  cardHeader: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 0,

    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,

    backgroundColor:
      "rgba(0,0,0,0.16)",
  },

  contextHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 4,
  },

  sourceIconCircle: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  contextContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },

  contextHeading: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  contextDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",

    gap: 8,
  },

  actionButton: {
    minWidth: 42,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 5,

    paddingHorizontal: 9,
    paddingVertical: 7,

    borderRadius: 11,

    backgroundColor:
      "rgba(255,255,255,0.055)",
  },

  actionIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },

  actionLoader: {
    width: 20,
    height: 20,
  },

  actionText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },

  musicLayout: {
    width: "100%",

    alignItems: "stretch",
  },

  imageContainer: {
    position: "relative",

    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  postImage: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1,

    borderRadius: 0,

    resizeMode: "cover",

    backgroundColor:
      "rgba(255,255,255,0.05)",
  },

  compactPostImage: {
    width: "100%",
    maxWidth: "100%",
  },

  playButton: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 7,
  },

  songInformation: {
    width: "100%",

    alignItems: "flex-start",

    paddingHorizontal: 17,
    paddingTop: 15,
    paddingBottom: 16,
  },

  postTitle: {
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    textAlign: "left",
  },

  postAlbum: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "left",
    marginTop: 3,
  },

  postArtist: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "left",
    marginTop: 2,
  },

  /* =========================================================
     REVIEWS
  ========================================================= */

  reviewContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 0,

    paddingHorizontal: 16,
    paddingVertical: 14,

    borderTopWidth: 1,
    borderTopColor:
      "rgba(255,255,255,0.07)",

    borderRadius: 0,

    backgroundColor:
      "rgba(0,0,0,0.12)",
  },

  reviewAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  reviewContent: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },

  reviewUsernameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },

  reviewUsername: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  reviewEmoji: {
    color: "#ffffff",
    fontSize: 16,
    marginLeft: 5,
  },

  reviewHeart: {
    width: 16,
    height: 16,
    marginLeft: 5,
  },

  reviewText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  starIcon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },

  reviewLikes: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    marginTop: 5,
  },

  /* =========================================================
     LIST STATES
  ========================================================= */

  listFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
  },

  footerSpace: {
    height: 20,
  },

  endOfFeedText: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },

  emptyContainer: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyDescription: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 7,
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: colours.lightblue,
  },

  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  bottomNavBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },

  /* =========================================================
     CREATE POST BUTTON
  ========================================================= */

  createPostButton: {
    position: "absolute",

    right: 18,
    bottom: 104,

    zIndex: 160,
    elevation: 16,

    width: 62,
    height: 62,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.78)",

    borderRadius: 31,

    backgroundColor: "#149fd3",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.38,
    shadowRadius: 14,
  },

  desktopCreatePostButton: {
    position: "fixed",

    right: 38,
    bottom: 38,

    width: 78,
    height: 78,

    borderRadius: 39,
  },

  mobileWebCreatePostButton: {
    position: "fixed",

    right: 18,
    bottom: 108,
  },

/* =========================================================
     SHARE MODAL
  ========================================================= */

  modalKeyboardView: {
  flex: 1,
  width: "100%",
},

modalOverlay: {
  flex: 1,
  width: "100%",
  alignItems: "center",
  justifyContent: "center",

  paddingHorizontal: 14,
  paddingVertical: 18,

  backgroundColor:
    "rgba(0,0,0,0.76)",
},

modalContent: {
  width: "100%",
  maxWidth: 430,
  maxHeight: "85%",

  paddingHorizontal: 16,
  paddingTop: 17,
  paddingBottom: 16,

  borderRadius: 20,

  backgroundColor:
    colours.background,

  borderWidth: 1,
  borderColor:
    "rgba(255,255,255,0.1)",

  shadowColor: "#000000",
  shadowOffset: {
    width: 0,
    height: 8,
  },
  shadowOpacity: 0.45,
  shadowRadius: 18,

  elevation: 12,
},

webModalContent: {
  width: 520,
  maxWidth: 520,
  maxHeight: 650,
  padding: 22,
},

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  modalTitleContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 15,
  },

  modalTitle: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    marginTop: 3,
  },

  closeModalButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  friendPrompt: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },

  friendsFlatList: {
  width: "100%",
  maxHeight: 230,
},

friendList: {
  width: "100%",
  paddingBottom: 10,
},

    friendItem: {
      flex: 1,
      minWidth: 0,
      maxWidth: 110,

      alignItems: "center",
      justifyContent: "center",

      paddingVertical: 8,
      paddingHorizontal: 4,
      margin: 3,

      borderRadius: 13,
    },

  selectedFriendItem: {
    backgroundColor: "rgba(33,150,243,0.2)",
  },

  friendAvatarContainer: {
    position: "relative",
  },

  friendAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  selectedCheck: {
    position: "absolute",
    right: -3,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2196f3",
    borderWidth: 2,
    borderColor: colours.background,
  },

  friendUsername: {
    color: "#ffffff",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },

  noFriendsText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 25,
  },

  commentSection: {
    marginTop: 10,
  },

  commentPrompt: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },

  commentInput: {
    minHeight: 80,
    maxHeight: 120,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    color: "#ffffff",
    backgroundColor: colours.foreground,  
    textAlignVertical: "top",
  },

  characterCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },

  shareButton: {
    minHeight: 48,
    marginTop: 16,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2196f3",
  },

  disabledShareButton: {
    opacity: 0.4,
  },

  shareButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});