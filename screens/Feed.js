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

const PAGE_SIZE = 5;
const DOUBLE_TAP_DELAY = 300;

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/500";
const PLACEHOLDER_AVATAR = "https://via.placeholder.com/100";

export default function Feed({ navigation }) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isDesktopWeb = isWeb && width >= 900;
  const isTablet = width >= 700 && width < 1100;
  const isCompact = width < 700;

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

  const fetchedInitial = useRef(false);
  const tapTimerRef = useRef(null);
  const viewedRecommendationIds = useRef(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isFocused = useIsFocused();

  const getItemInfo = useCallback((item) => {
    return item?.item_info || item || {};
  }, []);

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
    return item?.preview || item?.item_info?.preview || null;
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
        await sound.unloadAsync();
      } catch (error) {
        console.warn("[Feed] Could not unload preview:", error);
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
        Alert.alert(
          "Preview unavailable",
          "This item does not have a music preview."
        );
        return;
      }

      try {
        if (currentPreview === previewUrl && sound) {
          await stopCurrentPreview();
          return;
        }

        await stopCurrentPreview();

        const { sound: loadedSound } =
          await Audio.Sound.createAsync(
            {
              uri: previewUrl,
            },
            {
              shouldPlay: true,
            }
          );

        setSound(loadedSound);
        setCurrentPreview(previewUrl);
        setIsPlaying(true);
        setProgress(0);

        loadedSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }

          if (
            status.durationMillis &&
            status.positionMillis !== undefined
          ) {
            setProgress(
              Math.min(
                100,
                (status.positionMillis / status.durationMillis) * 100
              )
            );
          }

          setIsPlaying(Boolean(status.isPlaying));

          if (status.didJustFinish) {
            setProgress(0);
            setIsPlaying(false);
            setCurrentPreview(null);

            loadedSound
              .unloadAsync()
              .catch(() => {});
          }
        });
      } catch (error) {
        console.error("[Feed] Preview error:", error);

        Alert.alert(
          "Preview error",
          "The music preview could not be played."
        );
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

      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

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

  const fetchInitialFeed = useCallback(
    async (refresh = false) => {
      setIsLoading(true);

      try {
        const [
          timelineItems,
          recommendationItems,
        ] = await Promise.all([
          fetchTimelineItems(0, refresh),
          fetchRecommendationItems(0, refresh),
        ]);

        const itemsWithPreviews =
          await Promise.all(
            [
              ...timelineItems,
              ...recommendationItems,
            ].map(fetchPreviewForItem)
          );

        const updatedTimeline =
          itemsWithPreviews.slice(
            0,
            timelineItems.length
          );

        const updatedRecommendations =
          itemsWithPreviews.slice(
            timelineItems.length
          );

        const mergedItems = mergeFeedItems(
          updatedTimeline,
          updatedRecommendations
        );

        setCombinedFeed(mergedItems);
        setTimelineOffset(timelineItems.length);
        setRecommendationsOffset(
          recommendationItems.length
        );

        setHasMore(
          timelineItems.length > 0 ||
          recommendationItems.length > 0
        );
      } catch (error) {
        console.error(
          "[Feed] Initial feed error:",
          error
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetchPreviewForItem,
      fetchRecommendationItems,
      fetchTimelineItems,
      mergeFeedItems,
    ]
  );

  const loadMoreFeed = useCallback(async () => {
    if (
      loadingMore ||
      isLoading ||
      !hasMore
    ) {
      return;
    }

    setLoadingMore(true);

    try {
      const [
        timelineItems,
        recommendationItems,
      ] = await Promise.all([
        fetchTimelineItems(
          timelineOffset,
          false
        ),
        fetchRecommendationItems(
          recommendationsOffset,
          false
        ),
      ]);

      if (
        timelineItems.length === 0 &&
        recommendationItems.length === 0
      ) {
        setHasMore(false);
        return;
      }

      const itemsWithPreviews =
        await Promise.all(
          [
            ...timelineItems,
            ...recommendationItems,
          ].map(fetchPreviewForItem)
        );

      const updatedTimeline =
        itemsWithPreviews.slice(
          0,
          timelineItems.length
        );

      const updatedRecommendations =
        itemsWithPreviews.slice(
          timelineItems.length
        );

      const newItems = mergeFeedItems(
        updatedTimeline,
        updatedRecommendations
      );

      setCombinedFeed((currentItems) => {
        const existingIds = new Set(
          currentItems.map(
            (item) =>
              getRecordId(item) ||
              getItemId(item)
          )
        );

        const uniqueNewItems =
          newItems.filter((item) => {
            const itemId =
              getRecordId(item) ||
              getItemId(item);

            return !existingIds.has(itemId);
          });

        return [
          ...currentItems,
          ...uniqueNewItems,
        ];
      });

      setTimelineOffset(
        (currentOffset) =>
          currentOffset + timelineItems.length
      );

      setRecommendationsOffset(
        (currentOffset) =>
          currentOffset +
          recommendationItems.length
      );
    } catch (error) {
      console.error(
        "[Feed] Load-more error:",
        error
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    fetchPreviewForItem,
    fetchRecommendationItems,
    fetchTimelineItems,
    getItemId,
    getRecordId,
    hasMore,
    isLoading,
    loadingMore,
    mergeFeedItems,
    recommendationsOffset,
    timelineOffset,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);

    try {
      await fetchInitialFeed(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInitialFeed]);

  useEffect(() => {
    if (!fetchedInitial.current) {
      fetchedInitial.current = true;
      fetchInitialFeed(false);
    }
  }, [fetchInitialFeed]);

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
          await postRecommendations(
            currentUser.uid,
            itemId,
            getItemType(item),
            getDisplayName(item),
            getArtistName(item) ||
              getDisplayName(item)
          );
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

        const friends =
          await response.json();

        setFriendsList(
          Array.isArray(friends)
            ? friends
            : []
        );

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
        getItemType(currentShareItem)
      );

      if (
        response &&
        response.ok === false
      ) {
        throw new Error(
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
            "Discover Something New",
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

      if (
        item?.class ===
        "following_review"
      ) {
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

      if (
        origin?.type === "like" ||
        origin?.type === "favourite" ||
        origin?.type === "high-rating"
      ) {
        return "#ff334f";
      }

      return "#31c46c";
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
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.contextContainer}>
                <Text style={styles.contextHeading}>
                  {context.heading}
                </Text>

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

                {previewUrl ? (
                  <TouchableOpacity
                    onPress={(event) => {
                      event?.stopPropagation?.();

                      handlePlayPreview(
                        previewUrl
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
                      backgroundColor="rgba(255,255,255,0.25)"
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
      handleItemTap,
      handleLikeSong,
      handlePlayPreview,
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

      return `feed-${itemId}-${index}`;
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
      <View
        style={[
          styles.pageHeader,
          isWeb && styles.webPageHeader,
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
        >
          <Image
            source={require("../images/notificationsIcon2.png")}
            style={styles.notificationIcon}
          />

          {notificationsCount > 0 ? (
            <View style={styles.notificationBadge}>
              <Text
                style={styles.notificationBadgeText}
              >
                {notificationsCount > 99
                  ? "99+"
                  : notificationsCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.sideMenu,
          isWeb && styles.sideMenuWeb,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      </View>

      <View
        style={[
          styles.content,
          isWeb && styles.webContent,
        ]}
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.header}>
              Recent Feed
            </Text>

            <Text style={styles.headerDescription}>
              Music selected for you and activity from your friends.
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#ffffff"
            />

            <Text style={styles.loadingText}>
              Loading your feed...
            </Text>
          </View>
        ) : (
          <FlatList
            data={combinedFeed}
            renderItem={renderFeedItem}
            keyExtractor={keyExtractor}
            style={styles.feedList}
            contentContainerStyle={[
              styles.feedContent,
              isWeb &&
                styles.webFeedContent,
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
                progressBackgroundColor={
                  colours.foreground
                }
              />
            }
            onEndReached={loadMoreFeed}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={
              isWeb
            }
            onViewableItemsChanged={
              handleViewableItemsChanged
            }
            viewabilityConfig={{
              itemVisiblePercentThreshold: 60,
            }}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={
              Platform.OS !== "web"
            }
          />
        )}
      </View>

      {!isDesktopWeb ? (
        <View style={styles.bottomNavBar}>
          <BottomNavbar />
        </View>
      ) : null}

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
                    isWeb &&
                      styles.webModalContent,
                    {
                      transform: [
                        {
                          translateY:
                            slideAnim,
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
                        {getDisplayName(
                          currentShareItem
                        )}
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
                          index
                      )
                    }
                    numColumns={
                      isCompact ? 3 : 4
                    }
                    key={
                      isCompact
                        ? "compact-friends"
                        : "large-friends"
                    }
                    contentContainerStyle={
                      styles.friendList
                    }
                    ListEmptyComponent={
                      <Text
                        style={
                          styles.noFriendsText
                        }
                      >
                        No friends were found.
                      </Text>
                    }
                  />

                  {selectedUser ? (
                    <View style={styles.commentSection}>
                      <Text style={styles.commentPrompt}>
                        Message for{" "}
                        {selectedUser.username}
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
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colours.background,
  },

  webContainer: {
    height: "100vh",
    minHeight: 0,
    overflow: "hidden",
  },

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

  webPageHeader: {
    paddingTop: 24,
    paddingHorizontal: 32,
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

  sideMenu: {
    position: "absolute",
    top: 40,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 20,
  },

  sideMenuWeb: {
    top: 0,
    right: 0,
    bottom: undefined,
    height: "100vh",
    zIndex: 100,
  },

  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 125,
    paddingBottom: 80,
  },

  webContent: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    minHeight: 0,
    paddingTop: 105,
    paddingBottom: 0,
    paddingHorizontal: 28,
  },

  titleRow: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    marginBottom: 16,
  },

  header: {
    color: "#ffffff",
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

  loadingContainer: {
    flex: 1,
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 10,
  },

  feedList: {
    flex: 1,
    minHeight: 0,
  },

  feedContent: {
    paddingBottom: 120,
  },

  webFeedContent: {
    paddingBottom: 50,
  },

  emptyFeedContent: {
    flexGrow: 1,
  },

  card: {
    width: "100%",
    marginBottom: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colours.foreground,
    borderWidth: 2,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 4,
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

  modalKeyboardView: {
    flex: 1,
  },

  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(0,0,0,0.76)",
  },

  modalContent: {
    width: "100%",
    maxHeight: "82%",
    padding: 18,
    borderRadius: 20,
    backgroundColor: colours.background,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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

  friendList: {
    paddingBottom: 10,
  },

  friendItem: {
    flex: 1,
    minWidth: 75,
    maxWidth: 110,
    alignItems: "center",
    padding: 8,
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