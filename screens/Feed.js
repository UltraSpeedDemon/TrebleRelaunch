import React, {
  useCallback,
  useEffect,
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
} from "../providers/rest";

const PAGE_SIZE = 10;
const DOUBLE_TAP_DELAY = 300;

/*
 * While the Feed remains open, quietly request a new mix every
 * two minutes. It does not refresh immediately on first render.
 */
const FEED_AUTO_REFRESH_MS =
  60 * 1000;

const FEED_CACHE_KEY = "treble_feed_cache_v3";
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

export default function Feed({ navigation }) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";

  /*
  * Sidebar stays permanently open for tablets, laptops,
  * desktops and all web screens 768px or wider.
  */
  const isDesktopWeb = isWeb && width >= 768;
  const isMobileWeb = isWeb && width < 768;

  const isTablet = width >= 768 && width < 1100;
  const isCompact = width < 768;

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [combinedFeed, setCombinedFeed] = useState([]);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [recommendationsOffset, setRecommendationsOffset] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  const [likeLoading, setLikeLoading] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comment, setComment] = useState("");
  const [currentShareItem, setCurrentShareItem] = useState(null);

  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreview, setCurrentPreview] = useState(null);

  // Preloaded Expo Audio.Sound instances, keyed by preview URL.
  // Feed cards prepare these before the user presses Play.
  const preloadedSoundsRef = useRef(new Map());
  const preloadInFlightRef = useRef(new Set());

  const fetchedInitial = useRef(false);
  const initialRequestInFlight = useRef(false);
  const loadMoreRequestInFlight = useRef(false);
  const paginationCursorRef = useRef(0);

  /*
   * The first Feed focus should restore the existing feed.
   * A later focus means the user left the Feed and came back,
   * so that is when a new feed should be requested.
   */
  const hasFocusedFeedOnce = useRef(false);
  const feedWasBlurred = useRef(false);
  const latestFeedRef = useRef([]);
  const tapTimerRef = useRef(null);
  const viewedRecommendationIds = useRef(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isFocused = useIsFocused();
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
    const itemInfo = getItemInfo(item);

    return (
      itemInfo?.image ||
      itemInfo?.coverArt ||
      itemInfo?.album?.cover_medium ||
      itemInfo?.album?.cover_big ||
      PLACEHOLDER_IMAGE
    );
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

  const stopCurrentPreview = useCallback(async () => {
    if (sound) {
      try {
        await sound.pauseAsync();
        await sound.setPositionAsync(0);
      } catch (error) {
        console.warn("[Feed] Could not stop preview:", error);
      }
    }

    setSound(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentPreview(null);
  }, [sound]);

  const handlePlayPreview = useCallback(
    async (previewUrl) => {
      if (!previewUrl) {
        return false;
      }

      try {
        if (
          currentPreview === previewUrl &&
          sound
        ) {
          await stopCurrentPreview();
          return true;
        }

        await stopCurrentPreview();

        const savedVolume =
          await AsyncStorage.getItem(
            "treble_preview_volume"
          );

        const parsedVolume =
          savedVolume !== null
            ? Number(savedVolume)
            : 0.65;

        const previewVolume =
          Number.isFinite(
            parsedVolume
          )
            ? Math.min(
                1,
                Math.max(
                  0,
                  parsedVolume
                )
              )
            : 0.65;

        let loadedSound =
          preloadedSoundsRef.current.get(previewUrl);

        if (!loadedSound) {
          const created = await Audio.Sound.createAsync(
            { uri: previewUrl },
            {
              shouldPlay: false,
              volume: previewVolume,
            },
            undefined,
            true
          );

          loadedSound = created.sound;
          preloadedSoundsRef.current.set(
            previewUrl,
            loadedSound
          );
        }

        await loadedSound.setVolumeAsync(previewVolume);
        await loadedSound.setPositionAsync(0);
        await loadedSound.playAsync();

        setSound(loadedSound);
        setCurrentPreview(
          previewUrl
        );
        setIsPlaying(true);
        setProgress(0);

        loadedSound.setOnPlaybackStatusUpdate(
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
              status.positionMillis !==
                undefined
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
              Boolean(
                status.isPlaying
              )
            );

            if (
              status.didJustFinish
            ) {
              setProgress(0);
              setIsPlaying(false);
              setCurrentPreview(null);
              setSound(null);

              loadedSound
                .unloadAsync()
                .catch(() => {});
            }
          }
        );

        return true;
      } catch (error) {
        console.warn(
          "[Feed] Preview URL failed:",
          error
        );

        await stopCurrentPreview();
        return false;
      }
    },
    [
      currentPreview,
      sound,
      stopCurrentPreview,
    ]
  );

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }

      for (const preloadedSound of
        preloadedSoundsRef.current.values()) {
        preloadedSound.unloadAsync().catch(() => {});
      }

      preloadedSoundsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      stopCurrentPreview();
    }
  }, [isFocused, stopCurrentPreview]);

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

  const preloadPreviewUrl = useCallback(
    async (previewUrl) => {
      if (
        !previewUrl ||
        preloadedSoundsRef.current.has(previewUrl) ||
        preloadInFlightRef.current.has(previewUrl)
      ) {
        return;
      }

      preloadInFlightRef.current.add(previewUrl);

      try {
        const savedVolume =
          await AsyncStorage.getItem(
            "treble_preview_volume"
          );

        const parsedVolume =
          savedVolume !== null
            ? Number(savedVolume)
            : 0.65;

        const previewVolume =
          Number.isFinite(parsedVolume)
            ? Math.min(1, Math.max(0, parsedVolume))
            : 0.65;

        const { sound: preloadedSound } =
          await Audio.Sound.createAsync(
            { uri: previewUrl },
            {
              shouldPlay: false,
              volume: previewVolume,
              progressUpdateIntervalMillis: 250,
            },
            undefined,
            true
          );

        preloadedSoundsRef.current.set(
          previewUrl,
          preloadedSound
        );
      } catch (error) {
        console.warn(
          "[Feed] Could not preload preview:",
          error
        );
      } finally {
        preloadInFlightRef.current.delete(previewUrl);
      }
    },
    []
  );

  const prepareFeedPreviews = useCallback(
    async (items) => {
      const trackItems = items.filter(
        (item) =>
          getItemType(item) === "track" &&
          getItemId(item)
      );

      // Refresh preview URLs in small batches, then preload the audio.
      const batchSize = 4;

      for (let index = 0; index < trackItems.length; index += batchSize) {
        const batch = trackItems.slice(index, index + batchSize);

        await Promise.all(
          batch.map(async (item) => {
            const itemId = String(getItemId(item));
            let previewUrl = getPreviewUrl(item);

            try {
              const response = await getSongFromDeezer(
                itemId,
                { refresh: true }
              );

              if (response?.ok) {
                const deezerData = await response.json();
                previewUrl =
                  deezerData?.preview ||
                  deezerData?.previewUrl ||
                  deezerData?.playbackUrl ||
                  previewUrl;
              }
            } catch (error) {
              console.warn(
                `[Feed] Could not refresh preview ${itemId}:`,
                error
              );
            }

            if (!previewUrl) return;

            setCombinedFeed((currentItems) =>
              currentItems.map((feedItem) => {
                if (String(getItemId(feedItem)) !== itemId) {
                  return feedItem;
                }

                const previewFields = {
                  preview: previewUrl,
                  previewUrl,
                  playbackUrl: previewUrl,
                };

                return feedItem.item_info
                  ? {
                      ...feedItem,
                      ...previewFields,
                      item_info: {
                        ...feedItem.item_info,
                        ...previewFields,
                      },
                    }
                  : {
                      ...feedItem,
                      ...previewFields,
                    };
              })
            );

            await preloadPreviewUrl(previewUrl);
          })
        );
      }
    },
    [
      getItemId,
      getItemType,
      getPreviewUrl,
      preloadPreviewUrl,
    ]
  );

  useEffect(() => {
    if (!isFocused || combinedFeed.length === 0) {
      return;
    }

    prepareFeedPreviews(combinedFeed);
  }, [
    combinedFeed.length,
    isFocused,
    prepareFeedPreviews,
  ]);

  const fetchPreviewForItem = useCallback(
    async (item) => {
      const itemType = getItemType(item);
      const itemId = getItemId(item);
      const existingPreview = getPreviewUrl(item);

      if (
        itemType !== "track" ||
        !itemId ||
        existingPreview
      ) {
        return item;
      }

      try {
        const response = await getSongFromDeezer(itemId);

        if (!response?.ok) {
          return item;
        }

        const deezerData = await response.json();

        if (!deezerData?.preview) {
          return item;
        }

        if (item.item_info) {
          return {
            ...item,
            item_info: {
              ...item.item_info,
              preview: deezerData.preview,
            },
          };
        }

        return {
          ...item,
          preview: deezerData.preview,
        };
      } catch (error) {
        console.warn(
          `[Feed] Could not fetch preview for ${itemId}:`,
          error
        );

        return item;
      }
    },
    [
      getItemId,
      getItemType,
      getPreviewUrl,
    ]
  );

  const handlePlayItem = useCallback(
    async (item) => {
      const itemId = String(getItemId(item) || "");

      if (getItemType(item) !== "track" || !itemId) {
        Alert.alert(
          "Preview unavailable",
          "This item does not have a valid Deezer track ID."
        );
        return;
      }

      try {
        // The normal path is instant because prepareFeedPreviews already
        // refreshed and loaded this URL when the Feed appeared.
        let preview = getPreviewUrl(item);
        let played = preview
          ? await handlePlayPreview(preview)
          : false;

        // Safety fallback for a missing or rotated Deezer URL.
        if (!played) {
          const response = await getSongFromDeezer(
            itemId,
            { refresh: true }
          );

          if (!response?.ok) {
            throw new Error(
              `Preview request failed with status ${response?.status}`
            );
          }

          const deezerData = await response.json();
          preview =
            deezerData?.preview ||
            deezerData?.previewUrl ||
            deezerData?.playbackUrl ||
            "";

          if (!preview) {
            throw new Error(
              "Deezer did not return a playable preview."
            );
          }

          await preloadPreviewUrl(preview);
          played = await handlePlayPreview(preview);
        }

        if (!played) {
          throw new Error(
            "The Deezer preview could not be played."
          );
        }
      } catch (error) {
        console.error(
          "[Feed] Deezer playback error:",
          error
        );

        Alert.alert(
          "Preview error",
          "This track does not currently have a playable Deezer preview."
        );
      }
    },
    [
      getItemId,
      getItemType,
      getPreviewUrl,
      handlePlayPreview,
      preloadPreviewUrl,
    ]
  );



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

  const mergeFeedItems = useCallback(
    (timelineItems, recommendationItems) => {
      const result = [];
      const usedIds = new Set();

      const addItem = (item) => {
        const itemId =
          getRecordId(item) ||
          getItemId(item) ||
          JSON.stringify(item);

        if (usedIds.has(itemId)) {
          return;
        }

        usedIds.add(itemId);
        result.push(item);
      };

      const maximumLength = Math.max(
        timelineItems.length,
        recommendationItems.length
      );

      for (let index = 0; index < maximumLength; index += 1) {
        if (timelineItems[index]) {
          addItem(timelineItems[index]);
        }

        if (recommendationItems[index]) {
          addItem(recommendationItems[index]);
        }
      }

      return result;
    },
    [
      getItemId,
      getRecordId,
    ]
  );

  const saveFeedCache = useCallback(
    async (items) => {
      try {
        await AsyncStorage.setItem(
          FEED_CACHE_KEY,
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
    []
  );

  const restoreFeedCache = useCallback(
    async () => {
      try {
        const raw =
          await AsyncStorage.getItem(
            FEED_CACHE_KEY
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
         * Once restored, this feed remains active while the user
         * stays on this page. It refreshes after they leave and return,
         * or when they explicitly press Refresh Feed.
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
    []
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
        const timelineItems =
          await fetchTimelineItems(
            0,
            refresh
          );

        if (timelineItems.length > 0) {
          setCombinedFeed(
            timelineItems
          );

          setTimelineOffset(
            timelineItems.length
          );

          paginationCursorRef.current =
            timelineItems.length;

          setRecommendationsOffset(0);

          setHasMore(
            timelineItems.length >=
            PAGE_SIZE
          );

          await saveFeedCache(
            timelineItems
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
      fetchTimelineItems,
      saveFeedCache,
    ]
  );


  const loadMoreFeed = useCallback(async () => {
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
            .map(
              (item) =>
                String(
                  getItemId(item) ||
                  ""
                )
            )
            .filter(Boolean)
        );

      const uniqueNewItems = [];

      /*
       * Try multiple recommendation windows before giving up.
       * This prevents one duplicate-heavy page from ending the feed.
       */
      for (
        let attempt = 0;
        attempt < 4;
        attempt += 1
      ) {
        const requestOffset =
          paginationCursorRef.current;

        const timelineItems =
          await fetchTimelineItems(
            requestOffset,
            attempt > 1
          );

        paginationCursorRef.current +=
          Math.max(
            timelineItems.length,
            PAGE_SIZE
          );

        for (
          const item of
            timelineItems
        ) {
          const itemId =
            String(
              getItemId(item) ||
              ""
            );

          if (
            !itemId ||
            existingIds.has(
              itemId
            )
          ) {
            continue;
          }

          existingIds.add(itemId);
          uniqueNewItems.push(item);
        }

        if (
          uniqueNewItems.length >=
          PAGE_SIZE
        ) {
          break;
        }
      }

      if (
        uniqueNewItems.length === 0
      ) {
        /*
         * Keep infinite scrolling available. Manual refresh can also
         * generate a completely new mix.
         */
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
        paginationCursorRef.current
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

      /*
       * A temporary request error must not permanently end the feed.
       */
      setHasMore(true);
    } finally {
      loadMoreRequestInFlight.current =
        false;

      setLoadingMore(false);
    }
  }, [
    fetchTimelineItems,
    getItemId,
    isLoading,
    loadingMore,
    saveFeedCache,
  ]);


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
    /*
     * Do not refresh while the user is sitting on the Feed.
     *
     * Refresh only after:
     * 1. the Feed has already been focused once,
     * 2. the user navigates to another page, and
     * 3. the user comes back to the Feed.
     */
    if (!isFocused) {
      if (hasFocusedFeedOnce.current) {
        feedWasBlurred.current = true;
      }

      return;
    }

    if (!hasFocusedFeedOnce.current) {
      hasFocusedFeedOnce.current = true;
      return;
    }

    if (!feedWasBlurred.current) {
      return;
    }

    feedWasBlurred.current = false;

    /*
     * Keep the old cards visible while the new mix loads.
     * This is the same safe refresh used by the Refresh Feed button.
     */
    handleRefresh();
  }, [
    handleRefresh,
    isFocused,
  ]);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    /*
     * The first automatic refresh waits the full interval.
     * Friend/share cards therefore remain readable instead of
     * disappearing immediately when Feed opens.
     */
    const intervalId =
      setInterval(() => {
        if (
          !refreshing &&
          !initialRequestInFlight.current
        ) {
          handleRefresh();
        }
      }, FEED_AUTO_REFRESH_MS);

    return () => {
      clearInterval(
        intervalId
      );
    };
  }, [
    handleRefresh,
    isFocused,
    refreshing,
  ]);

  useEffect(() => {
    if (fetchedInitial.current) {
      return;
    }

    fetchedInitial.current = true;

    let cancelled = false;

    const startFeed = async () => {
      const restoredFeed =
        await restoreFeedCache();

      if (cancelled) {
        return;
      }

      /*
       * Do not silently replace an already-visible feed.
       * Fetch a new one only when no cached feed exists.
       */
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
    fetchInitialFeed,
    restoreFeedCache,
  ]);

  useEffect(() => {
    const fetchNotifications = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
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

        const requests =
          await response.json();

        setNotificationsCount(
          Array.isArray(requests)
            ? requests.length
            : 0
        );
      } catch (error) {
        console.error(
          "[Feed] Notification error:",
          error
        );
      }
    };

    fetchNotifications();
  }, []);

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

  const renderFeedItem = useCallback(
    ({ item }) => {
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

                {getItemType(item) === "track" ? (
                  <TouchableOpacity
                    onPress={(event) => {
                      event?.stopPropagation?.();

                      handlePlayItem(
                        item
                      );
                    }}
                    style={styles.playButton}
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
                      {() => (
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
                      )}
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
            onPress={() => navigation.navigate("Notifications")}
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
        {!isDesktopWeb ? (
          <View style={styles.mobileHeaderSection}>
            <View style={styles.mobileTitleRow}>
              <View style={styles.headerTextContainer}>
                <Text
                  style={[
                    styles.header,
                    styles.mobileHeader,
                  ]}
                >
                  Recent Feed
                </Text>

                <Text
                  style={[
                    styles.headerDescription,
                    styles.mobileHeaderDescription,
                  ]}
                >
                  Music selected for you and activity from your friends.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.notificationsButton}
                onPress={() => navigation.navigate("Notifications")}
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
          </View>
        ) : (
          <View
            style={[
              styles.titleRow,
              isWeb && styles.webTitleRow,
            ]}
          >
            <View style={styles.feedTitleLine}>
              <Text style={styles.header}>
                Recent Feed
              </Text>

              <View style={styles.forYouBadge}>
                <Icon
                  name="auto-awesome"
                  size={14}
                  color={
                    colours.lightblue ||
                    "#35afe5"
                  }
                />

                <Text style={styles.forYouBadgeText}>
                  FOR YOU
                </Text>
              </View>
            </View>

            <Text style={styles.headerDescription}>
              Music selected for you and activity from your friends.
            </Text>

            <Text style={styles.refreshHint}>
              This mix stays while you are here and refreshes when you return.
            </Text>
          </View>
        )}

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
            data={combinedFeed}
            renderItem={renderFeedItem}
            keyExtractor={keyExtractor}

            /*
            * The FlatList is the dedicated scroll container.
            * Mouse wheel, trackpad and touch scrolling all work here.
            */
            style={[
              styles.feedList,
              isWeb && styles.webFeedList,
            ]}

            contentContainerStyle={[
              styles.feedContent,
              isWeb && styles.webFeedContent,
              combinedFeed.length === 0 &&
                styles.emptyFeedContent,
            ]}

            ListEmptyComponent={renderEmptyFeed}
            ListFooterComponent={renderListFooter}

            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#ffffff"
                colors={["#ffffff"]}
                progressBackgroundColor={colours.foreground}
              />
            }

            onEndReached={loadMoreFeed}
            onEndReachedThreshold={0.6}

            initialNumToRender={4}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={50}
            windowSize={7}

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
            removeClippedSubviews={
              Platform.OS !== "web"
            }
          />
        )}
      </View>

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
    paddingLeft: 32,
    paddingRight: 32,

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
    paddingBottom: 75,
    paddingHorizontal: 14,

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
    marginTop: 4,
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
    paddingBottom: 120,
  },

  webFeedContent: {
    width: "100%",
    paddingTop: 2,
    paddingBottom: 80,
  },

  emptyFeedContent: {
    flexGrow: 1,
  },

  /* =========================================================
     FEED CARDS
  ========================================================= */

  card: {
    width: "100%",
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor:
      colours.foreground,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },

  webCard: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 22,
    borderRadius: 20,
  },

  tabletCard: {
    maxWidth: 700,
  },

  compactCard: {
    padding: 14,
    borderRadius: 14,
  },

  cardHeader: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
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
    alignItems: "flex-start",
    gap: 17,
  },

  actionButton: {
    minWidth: 42,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  actionIcon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },

  actionLoader: {
    width: 28,
    height: 28,
  },

  actionText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },

  musicLayout: {
    width: "100%",
    alignItems: "center",
  },

  compactMusicLayout: {
    alignItems: "center",
  },

  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  postImage: {
    width: 280,
    height: 280,
    maxWidth: "100%",
    borderRadius: 14,
    resizeMode: "cover",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  compactPostImage: {
    width: 230,
    height: 230,
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
    alignItems: "center",
    paddingTop: 14,
    paddingHorizontal: 10,
  },

  postTitle: {
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    textAlign: "center",
  },

  postAlbum: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 3,
  },

  postArtist: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 2,
  },

  /* =========================================================
     REVIEWS
  ========================================================= */

  reviewContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    padding: 13,
    borderRadius: 12,
    backgroundColor: colours.foreground2,
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