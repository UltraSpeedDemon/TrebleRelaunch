import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  ActivityIndicator
} from "react-native";
import Toast from 'react-native-toast-message';
import { TapGestureHandler, GestureHandlerRootView, State } from "react-native-gesture-handler";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import SearchBar from "../components/SearchBar";
import { auth } from "../utils/firebase";
import { Audio } from "expo-av";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";

// Import your API calls
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
  getFollowRequests
} from "../providers/rest";

export default function Feed({ navigation, route }) {
  // -------------------------------------------------------------------------
  //  State
  // -------------------------------------------------------------------------
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [combinedFeed, setCombinedFeed] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // Pagination
  const [onEndReachedCalledDuringMomentum, setOnEndReachedCalledDuringMomentum] = useState(true);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const fetchedInitial = useRef(false);

  // Share modal
  const [modalVisible, setModalVisible] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comment, setComment] = useState("");
  const [currentShareItem, setCurrentShareItem] = useState(null);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [recsOffset, setRecsOffset] = useState(0);
  const [hasMoreTimeline, setHasMoreTimeline] = useState(true);

  // Animated value for sliding the modal up when the keyboard is active.
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [sound, setSound] = useState(null); // State for managing the sound instance
  const [isPlaying, setIsPlaying] = useState(false); // State for playback status
  const [progress, setProgress] = useState(0); // State for playback progress
  const [currentPreview, setCurrentPreview] = useState(null); // Track currently playing preview

  const handlePlayPreview = async (previewUrl) => {
    try {
      if (currentPreview === previewUrl && sound) {
        // Stop playback if the same preview is clicked again
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setProgress(0);
        setCurrentPreview(null);
        return;
      }

      // Stop any currently playing sound
      if (sound) {
        await sound.unloadAsync();
      }

      // Load and play the new preview
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      setCurrentPreview(previewUrl);

      // Update progress
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.isPlaying) {
          setProgress((status.positionMillis / status.durationMillis) * 100);
        }
        if (status.didJustFinish) {
          setProgress(0);
          setIsPlaying(false);
          setCurrentPreview(null);
        }
      });
    } catch (error) {
      console.error("[ERROR] handlePlayPreview ->", error);
      Alert.alert("Error", "Unable to play the song preview.");
    }
  };

  useEffect(() => {
    // Cleanup the sound instance when the component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused && sound) {
      sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setProgress(0);
      setCurrentPreview(null);
    }
  }, [isFocused]);

  useEffect(() => {
    const keyboardShowEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const keyboardHideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(keyboardShowEvent, (event) => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    });

    const keyboardHideListener = Keyboard.addListener(keyboardHideEvent, (event) => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: event.duration || 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, [slideAnim]);

  // -------------------------------------------------------------------------
  //  useEffect: Fetch data once on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!fetchedInitial.current) {
      fetchedInitial.current = true;
      fetchInitialFeed(false);
    }
  }, []);


// -------------------------------------------------------------------------
//  fetchInitialFeed
// -------------------------------------------------------------------------
const fetchInitialFeed = async (refresh) => {
  try {
    setIsLoading(true);
    // Fetch timeline items and recommendations
    const timelineItems = await fetchTimeline(0, refresh);
    const recs = await fetchRecommendations(0, refresh);

    // Debug log to inspect the feed data
    console.log("[DEBUG] Timeline Items:", timelineItems);
    console.log("[DEBUG] Recommendations:", recs);

    // Fetch missing preview URLs for tracks
    const fetchPreviewPromises = [...timelineItems, ...recs].map(async (item) => {
      const trackId = item.item_info?.id || item.id;

      // Log the item structure and conditions
      console.log("[DEBUG] Conditions - type:", item.type || item.item_info?.type, "preview:", item.preview || item.item_info?.preview, "trackId:", trackId);

      if ((item.type === "track" || item.item_info?.type === "track") && !item.preview && !(item.item_info?.preview) && trackId) {
        console.log("[DEBUG] Fetching preview for track ID:", trackId);
        try {
          const response = await getSongFromDeezer(trackId);
          const deezerData = await response.json(); // Parse the JSON response
          if (deezerData && deezerData.preview) {
            if (item.item_info) {
              item.item_info.preview = deezerData.preview;
            } else {
              item.preview = deezerData.preview;
            }
            console.log("[DEBUG] Preview set for track:", trackId, deezerData.preview);
          } else {
            console.warn("[WARNING] No preview available for track ID:", trackId);
          }
        } catch (error) {
          console.warn("[WARNING] Failed to fetch preview for track ID:", trackId, error);
        }
      } else {
        console.log("[DEBUG] Skipping preview fetch for item:", item);
      }
      return item;
    });

    const updatedItems = await Promise.all(fetchPreviewPromises);

    // Merge the two lists using your random insertion logic.
    let combinedItems = [...updatedItems.slice(0, timelineItems.length)];
    updatedItems.slice(timelineItems.length).forEach((rec) => {
      // Only insert if this recommendation isn't already in the timeline.
      const alreadyExists = combinedItems.some(
        (item) => item.record_id === rec.record_id
      );
      if (!alreadyExists) {
        const randomIndex = Math.floor(Math.random() * (combinedItems.length + 1));
        combinedItems.splice(randomIndex, 0, rec);
      }
    });

    // Update offsets for timeline and recommendations
    setTimelineOffset(timelineItems.length);
    setRecsOffset(recs.length);
    setCombinedFeed(combinedItems);
  } catch (err) {
    console.error("[ERROR] fetchInitialFeed ->", err);
  } finally {
    setIsLoading(false);
  }
};

//notifications
useEffect(() => {
  async function fetchNotificationsCount() {
    if (!auth.currentUser?.uid) return; // Wait until auth is ready
    try {
      const resp = await getFollowRequests(auth.currentUser.uid);
      if (resp.ok) {
        const requests = await resp.json();
        setNotificationsCount(requests.length);
      }
    } catch (error) {
      console.error("Error fetching notifications count:", error);
    }
  }
  fetchNotificationsCount();
}, [auth.currentUser]);  

// -------------------------------------------------------------------------
//  loadMoreTimeline: Load additional timeline items and recommendations
// -------------------------------------------------------------------------
const loadMoreTimeline = async () => {
  if (loadingMore) return;
  setLoadingMore(true);

  try {
    // Fetch the next page of timeline items and recommendations
    const newTimelineItems = await fetchTimeline(timelineOffset, false);
    const newRecs = await fetchRecommendations(recsOffset, false);

    // Fetch missing preview URLs for tracks in the new items
    const fetchPreviewPromises = [...newTimelineItems, ...newRecs].map(async (item) => {
      const trackId = item.item_info?.id || item.id;

      if ((item.type === "track" || item.item_info?.type === "track") && !item.preview && !(item.item_info?.preview) && trackId) {
        try {
          const response = await getSongFromDeezer(trackId);
          const deezerData = await response.json();
          if (deezerData && deezerData.preview) {
            if (item.item_info) {
              item.item_info.preview = deezerData.preview;
            } else {
              item.preview = deezerData.preview;
            }
          }
        } catch (error) {
          console.warn("[WARNING] Failed to fetch preview for track ID:", trackId, error);
        }
      }
      return item;
    });

    const updatedItems = await Promise.all(fetchPreviewPromises);

    // Merge the new timeline items and recommendations
    let newCombined = [...updatedItems.slice(0, newTimelineItems.length)];
    updatedItems.slice(newTimelineItems.length).forEach((rec) => {
      const alreadyExists = newCombined.some((item) => item.record_id === rec.record_id);
      if (!alreadyExists) {
        const randomIndex = Math.floor(Math.random() * (newCombined.length + 1));
        newCombined.splice(randomIndex, 0, rec);
      }
    });

    // Append the new combined batch to the existing feed
    setCombinedFeed((prevFeed) => [...prevFeed, ...newCombined]);

    // Update the pagination offsets
    setTimelineOffset((prev) => prev + newTimelineItems.length);
    setRecsOffset((prev) => prev + newRecs.length);
  } catch (error) {
    console.error("[ERROR] loadMoreTimeline ->", error);
  } finally {
    setLoadingMore(false);
  }
};


  // -------------------------------------------------------------------------
  //  fetchTimeline: Get timeline items from your new timeline endpoint
  // -------------------------------------------------------------------------
  const fetchTimeline = async (currentOffset, refresh) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("[WARNING] fetchTimeline: No current user found");
        return [];
      }
      // Assume getTimeline is imported similarly to getRecommendations
      const response = await getTimeline(currentUser.uid, { limit, offset: currentOffset, refresh });
      if (response && response.ok) {
        const data = await response.json();
        return data.timeline || [];
      } else {
        console.warn("[WARNING] fetchTimeline: Response not ok", response?.status);
      }
    } catch (error) {
      console.error("[ERROR] fetchTimeline ->", error);
    }
    return [];
  };

  // -------------------------------------------------------------------------
  //  fetchRecommendations
  // -------------------------------------------------------------------------
  const fetchRecommendations = async (currentOffset, refresh) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("[WARNING] fetchRecommendations: No current user found");
        return [];
      }
      const response = await getRecommendations(currentUser.uid, { limit, offset: currentOffset, refresh });
      if (response && response.ok) {
        const data = await response.json();
        return data.recommendations || [];
      } else {
        console.warn("[WARNING] fetchRecommendations: Response not ok:", response?.status);
      }
    } catch (error) {
      console.error("[ERROR] fetchRecommendations ->", error);
    }
    return [];
  };
  
  // -------------------------------------------------------------------------
  //  Pull-to-refresh
  // -------------------------------------------------------------------------
  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await fetchInitialFeed(true);
    } finally {
      setRefreshing(false);
    }
  };

  const [likeLoading, setLikeLoading] = useState({}); // keys are song IDs

  // Helper: Extract the ID from the item or its nested item_info.
const getItemId = (item) => {
  return item.id || (item.item_info && item.item_info.id);
};

// Helper to get the liked status consistently
const getLikedStatus = (item) => {
  if (typeof item.liked !== "undefined") {
    return item.liked;
  } else if (item.item_info && typeof item.item_info.liked !== "undefined") {
    return item.item_info.liked;
  }
  return false;
};

const getItemType = (item) => {
  if (item.item_info && typeof item.item_info.type !== "undefined") {
    return item.item_info.type;
  }
  return item.type;
};

const handleLikeSong = (item, isDoubleTap = false) => {
  console.debug("[DEBUG] handleLikeSong called", { item, isDoubleTap });
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.debug("[DEBUG] No current user found");
    Alert.alert("Error", "User not logged in");
    return;
  }

  // Use helper to get the unique ID.
  const itemId = getItemId(item);
  if (!itemId) {
    console.error("[ERROR] Item id not found", { item });
    return;
  }

  // Find the current item in the combined feed (source of truth)
  const currentItem = combinedFeed.find(
    (feedItem) => getItemId(feedItem) === itemId
  );
  if (!currentItem) {
    console.debug("[DEBUG] Item not found in combinedFeed", { itemId });
    return;
  }
  console.debug("[DEBUG] Found currentItem", currentItem);

  // Prevent duplicate requests for this item
  if (likeLoading[itemId]) {
    console.debug("[DEBUG] Request already in progress for item", { itemId });
    return;
  }

  // For a double tap, only trigger a like if the song is not already liked.
  if (isDoubleTap && getLikedStatus(currentItem)) {
    console.debug("[DEBUG] Double tap ignored because item is already liked", { itemId });
    return;
  }

  // Mark the item as loading
  setLikeLoading((prev) => {
    const newState = { ...prev, [itemId]: true };
    console.debug("[DEBUG] Updated likeLoading state", newState);
    return newState;
  });

  // For optimistic UI update:
  // For double tap, force liked=true.
  // Otherwise, toggle the liked status.
  const currentLiked = getLikedStatus(currentItem);
  const newLiked = isDoubleTap ? true : !currentLiked;
  console.debug("[DEBUG] newLiked value computed", { currentLiked, newLiked });

  setCombinedFeed((prevFeed) =>
    prevFeed.map((feedItem) => {
      if (getItemId(feedItem) === itemId) {
        console.debug("[DEBUG] Optimistically updating item", { itemId, newLiked });
        // Update both top level and nested property if present.
        return {
          ...feedItem,
          liked: newLiked,
          ...(feedItem.item_info
            ? { item_info: { ...feedItem.item_info, liked: newLiked } }
            : {}),
        };
      }
      return feedItem;
    })
  );

  // Decide which API to call:
  // If the song was not previously liked (or if it's a double tap), call like.
  // Otherwise, toggle from liked to unliked.
  console.debug("[DEBUG] wasLiked value", currentLiked);

  if (!currentLiked || isDoubleTap) {
    console.debug("[DEBUG] Calling like API", { itemId });
    like(currentUser.uid, itemId, getItemType(item))
      .then((response) => {
        console.debug("[DEBUG] Like API response", response);
        if (!response.ok) {
          throw new Error("Failed to like the item");
        }
        return postRecommendations(
          currentUser.uid,
          itemId,
          item.type,
          item.name || "",
          item.artist?.name || item.name
        );
      })
      .catch((error) => {
        console.error("[ERROR] handleLikeSong ->", error);
        // Rollback UI update on error
        setCombinedFeed((prevFeed) =>
          prevFeed.map((feedItem) => {
            if (getItemId(feedItem) === itemId) {
              console.debug("[DEBUG] Rolling back optimistic update", { itemId });
              return {
                ...feedItem,
                liked: currentLiked, // revert back
                ...(feedItem.item_info
                  ? { item_info: { ...feedItem.item_info, liked: currentLiked } }
                  : {}),
              };
            }
            return feedItem;
          })
        );
        Alert.alert("Error", "Unable to toggle like status");
      })
      .finally(() => {
        setLikeLoading((prev) => {
          const newState = { ...prev };
          delete newState[itemId];
          console.debug("[DEBUG] Clearing likeLoading for item", { itemId, newState });
          return newState;
        });
      });
  } else {
    console.debug("[DEBUG] Calling unlike API", { itemId });
    unlike(currentUser.uid, itemId, getItemType(item))
      .catch((error) => {
        console.error("[ERROR] handleLikeSong ->", error);
        // Rollback UI update on error
        setCombinedFeed((prevFeed) =>
          prevFeed.map((feedItem) => {
            if (getItemId(feedItem) === itemId) {
              console.debug("[DEBUG] Rolling back optimistic update after unlike error", { itemId });
              return {
                ...feedItem,
                liked: currentLiked, // revert
                ...(feedItem.item_info
                  ? { item_info: { ...feedItem.item_info, liked: currentLiked } }
                  : {}),
              };
            }
            return feedItem;
          })
        );
        Alert.alert("Error", "Unable to toggle like status");
      })
      .finally(() => {
        setLikeLoading((prev) => {
          const newState = { ...prev };
          delete newState[itemId];
          console.debug("[DEBUG] Clearing likeLoading after unlike", { itemId, newState });
          return newState;
        });
      });
  }
};


  

  // -------------------------------------------------------------------------
  //  handleModal (open share modal)
  // -------------------------------------------------------------------------
  const handleModal = async (item) => {
    try {
      const response = await getFriends(auth.currentUser.uid);
      const json = await response.json();
      setFriendsList(json);
      setCurrentShareItem(item);
      setModalVisible(true);
    } catch (error) {
      console.error("[ERROR] handleModal ->", error);
      Alert.alert("Error", "Could not load friends list");
    }
  };

  // -------------------------------------------------------------------------
  //  closeModal
  // -------------------------------------------------------------------------
  const closeModal = () => {
    setModalVisible(false);
    setSelectedUser(null);
    setComment("");
    setCurrentShareItem(null);
  };

  // -------------------------------------------------------------------------
  //  handleSelectUser
  // -------------------------------------------------------------------------
  const handleSelectUser = (user) => {
    setSelectedUser((prevUser) =>
      prevUser && prevUser.userId === user.userId ? null : user
    );
  };

  // -------------------------------------------------------------------------
  //  handleShareComment
  // -------------------------------------------------------------------------
  const handleShareComment = () => {
    if (!selectedUser) {
      Alert.alert("Error", "Please select a friend to share with");
      return;
    }
    try {
      share(
        selectedUser.userId,
        currentShareItem.record_id,
        currentShareItem.id,
        comment,
        currentShareItem.type
      );
      Toast.show({
        type: 'success',
        text1: 'Sent'
      });
    } catch (error) {
      console.error("[ERROR] handleShareComment ->", error);
    }
    closeModal();
  };

  const getCardBorderStyle = (item) => {

    // If the review is a friend review, border green.

    if (item.class === "friend_review" || (item.author && item.author.is_friend)) {

      return { borderColor: "green", borderWidth: 2 };

    }

    // If it's a following review.

    if (item.class === "following_review") {

      return { borderColor: "lightblue", borderWidth: 2 };

    }

    // If it's a shared item (indicated by a shared_by field).

    if (item.shared_by) {

      return { borderColor: "yellow", borderWidth: 2 };

    }

    // Otherwise, treat it as a recommendation.

    return { borderColor: "red", borderWidth: 2 };

  };

  const DOUBLE_TAP_DELAY = 300;
  const tapTimerRef = useRef(null);

  // This function is called on every tap
  const handleTap = (item) => {
    if (tapTimerRef.current) {
      // Second tap detected within the delay: it's a double tap.
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      handleDoubleTap(item);
    } else {
      // First tap: start a timer that will trigger single tap if no second tap occurs.
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        handleSingleTap(item);
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Action for a single tap (e.g., play/pause video)
  const handleSingleTap = (item) => {

    const itemInfo = item.item_info || item;
    if (item.class == "friend_review" || itemInfo) {
      if (itemInfo.type === "track") {
        navigation.navigate("SongPage", { track: itemInfo });
      } else if (itemInfo.type === "artist") {
        navigation.navigate("ArtistPage", { artist: itemInfo });
      } else if (itemInfo.type === "album") {
        navigation.navigate("AlbumPage", { album: itemInfo });
      } 
    }
    else
    {
      if (item.type === "track") {
        navigation.navigate("SongPage", { track: item });
      } else if (item.type === "artist") {
        navigation.navigate("ArtistPage", { artist: item });
      } else if (item.type === "album") {
        navigation.navigate("AlbumPage", { album: item });
      } 
    }
  };

  // Action for a double tap (e.g., like video)
  const handleDoubleTap = (item) => {
    handleLikeSong(item);
  };

  // -------------------------------------------------------------------------
  //  View Tracking for Recommendation Cards
  // -------------------------------------------------------------------------
  // We'll use onViewableItemsChanged on the FlatList to detect when a recommendation card is viewed.
  // We'll assume that if an item does not have a "class" property (i.e. not a friend_review)
  // and has an "item_info" property, it's a recommendation card.
  // When such an item becomes visible, we call setRecommendationServed with served:false.
  const viewedRecIdsRef = useRef(new Set());
const onViewableItemsChanged = useRef(({ viewableItems, changed }) => {
  viewableItems.forEach(({ item }) => {
    // Log the item to confirm its structure.
    // Check if this is a recommendation card (adjust condition if needed)
    if (!item.class && !item.item_info) {
      const recId = item.record_id || (item.item_info && item.item_info.record_id);
      if (recId && !viewedRecIdsRef.current.has(recId)) {
        viewedRecIdsRef.current.add(recId);
        // Call your API function (make sure setRecommendationServed returns a promise)
         setRecommendationServed(auth.currentUser.uid, recId)
           .then((res) => console.log(`[DEBUG] Marked rec ${recId} as served:true`))
           .catch((err) =>
             console.error(`[ERROR] setRecommendationServed failed for rec ${recId}:`, err)
           );
      }
    }
  });
}).current;


  // -------------------------------------------------------------------------
  //  renderFriendItem
  // -------------------------------------------------------------------------
  const renderFriendItem = ({ item }) => {
    const isSelected = selectedUser && selectedUser.userId === item.userId;
    return (
      <TouchableOpacity
        onPress={() => handleSelectUser(item)}
        style={[styles.friendItem, isSelected && styles.selectedFriendItem]}
      >
        <Image
          source={{ uri: item.avatar ? item.avatar : "https://via.placeholder.com/50" }}
          style={styles.avatar}
        />
        <Text style={styles.username}>{item.username}</Text>
        {isSelected && (
          <Image
            source={require("../images/checkmarkIcon.png")}
            style={styles.checkmarkIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  // Helper: Get time ago string
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
  

    const secondsInMinute = 60;
    const secondsInHour = 3600;
    const secondsInDay = 86400;
  
    if (diffInSeconds < secondsInMinute) {
      return "Just now";
    } else if (diffInSeconds < secondsInHour) {
      const minutes = Math.floor(diffInSeconds / secondsInMinute);
      return `${minutes}min ago`;
    } else if (diffInSeconds < secondsInDay) {
      const hours = Math.floor(diffInSeconds / secondsInHour);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / secondsInDay);
      return `${days}d ago`;
    }
  };

  // -------------------------------------------------------------------------
  //  renderFeedItem
  // -------------------------------------------------------------------------
  const renderFeedItem = ({ item }) => {
    const handlePreview = () => {
      const previewUrl = item.preview || item.item_info?.preview;
      if (previewUrl) {
        handlePlayPreview(previewUrl);
      } else {
        Alert.alert("Preview not available", "This item does not have a preview.");
      }
    };
  
    // Debug log to verify item structure
    console.log("[DEBUG] Rendering feed item:", item);
  
    // Add debug logs for the condition
    console.log("[DEBUG] item.type:", item.type);
    console.log("[DEBUG] item.item_info?.type", item.item_info?.type);
    console.log("[DEBUG] item.preview:", item.preview);
    console.log("[DEBUG] item.item_info?.preview:", item.item_info?.preview);
  
    // Branch 1: Friend or following reviews
    if (item.class === "friend_review" || item.class === "following_review") {
      const itemInfo = item.item_info || {};
      const displayName = itemInfo.name || itemInfo.title || "Unknown Title";
      const imageUri = itemInfo.image || itemInfo.coverArt || "https://via.placeholder.com/250";
      if(itemInfo.type == "track")
      {
        console.log("Album Title for friend review: ", itemInfo.album.title)
      }
      return (
        <TouchableWithoutFeedback onPress={() => handleTap(item)}>
          <View style={[styles.card, getCardBorderStyle(item)]}>
            <View style={styles.cardInformation}>
              <View style={styles.postContextContainer}>
                <Text style={styles.postContext}>
                <Text style={styles.boldPostContext}>
                  {item.class === "friend_review" ? "Friend Review" : "Following Review"} {getTimeAgo(item.createdAt)}:
                </Text>
                  {"\n"}
                  {item.author?.username}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleLikeSong(item.item_info)} style={styles.actionButton}>
                  <Image
                    source={
                      item.item_info.liked
                        ? require("../images/whiteFullHeart.png")
                        : require("../images/whiteOpenHeart.png")
                    }
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionText}>
                    {item.item_info.liked ? "Liked" : "Like"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleModal(item.item_info)} style={styles.actionButton}>
                  <Image
                    source={require("../images/shareIcon.png")}
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri || "https://via.placeholder.com/250" }} style={styles.postImage} />
              {item.item_info?.type === "track" && (item.preview || item.item_info?.preview) && (
                <TouchableOpacity
                  onPress={handlePreview}
                  style={styles.playButton}
                >
                  <AnimatedCircularProgress
                    size={50}
                    width={5}
                    fill={currentPreview === (item.preview || item.item_info?.preview) ? progress : 0}
                    tintColor={colours.secondaryblue}
                    backgroundColor={colours.bluegrey}
                    rotation={0}
                  >
                    {() => (
                      <Icon
                        name={currentPreview === (item.preview || item.item_info?.preview) && isPlaying ? "stop" : "play-arrow"}
                        size={30}
                        color="#fff"
                      />
                    )}
                  </AnimatedCircularProgress>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.postTitle}>{displayName}</Text>
              {itemInfo.album && itemInfo.album.title && (
                <Text style={styles.postAlbum}>{itemInfo.album.title}</Text>
              )}
              {itemInfo.artist && itemInfo.artist.name && (
                <Text style={styles.postArtist}>{itemInfo.artist.name}</Text>
              )}
            </View>
            <View style={styles.reviewContainer}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{ uri: item.author?.avatar || "https://via.placeholder.com/250" }}
                  style={styles.avatar}
                />
              </View>
              <View style={styles.reviewContent}>
                <Text style={styles.username}>{item.author?.username} {item.emoji && (
  <Text style={styles.reviewEmoji}>
    {typeof item.emoji === "string"
      ? item.emoji.replace(/^\[|\]$/g, "") // Remove leading/trailing brackets
      : item.emoji}
  </Text>
)} {item.hearted && <Image source={require("../images/whiteFullHeart.png")} style={styles.heartEmoji} />}</Text>
                
                <Text style={styles.reviewText}>{item.message}</Text>
                <View style={styles.ratingContainer}>
                  {[...Array(5)].map((_, i) => (
                    <Image
                      key={i}
                      source={
                        i < item.rating
                          ? require("../images/starFullIcon.png")
                          : require("../images/starEmptyIcon.png")
                      }
                      style={styles.starIcon}
                    />
                  ))}
                </View>
                <Text style={styles.upvotes}>{item.upvotes || 0} Likes</Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      );
    }
  
    // Branch 2: Share or enriched timeline items
    if (item.class === "share") {
      const itemInfo = item.item_info || {};
      if(itemInfo.type == "track")
      {
        console.log("Album Title for share: ", itemInfo.album.title)
      }
      const topReview = itemInfo.topReview || {};
      const displayName = itemInfo.name || itemInfo.title || "Unknown Title";
      const imageUri = itemInfo.image || itemInfo.coverArt || "https://via.placeholder.com/250";

      return (
        <TouchableWithoutFeedback onPress={() => handleTap(item)}>
          <View style={[styles.card, getCardBorderStyle(item)]}>
            <View style={styles.cardInformation}>
              <View style={styles.postContextContainer}>
                <Text style={styles.postContext}>
                  <Text style={styles.boldPostContext}>
                    {item.shared_by.username} shared {getTimeAgo(item.createdAt)}
                  </Text>{" "}
                  {item.comment ? `\n"${item.comment}"` : ""}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleLikeSong(item.item_info)} style={styles.actionButton}>
                  <Image
                    source={
                      item.item_info.liked
                        ? require("../images/whiteFullHeart.png")
                        : require("../images/whiteOpenHeart.png")
                    }
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionText}>
                    {item.item_info.liked ? "Liked" : "Like"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleModal(item.item_info)} style={styles.actionButton}>
                  <Image
                    source={require("../images/shareIcon.png")}
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.postImage} />
              {item.item_info?.type === "track" && (item.preview || item.item_info?.preview) && (
                <TouchableOpacity
                  onPress={handlePreview}
                  style={styles.playButton}
                >
                  <AnimatedCircularProgress
                    size={50}
                    width={5}
                    fill={currentPreview === (item.preview || item.item_info?.preview) ? progress : 0}
                    tintColor={colours.secondaryblue}
                    backgroundColor={colours.bluegrey}
                    rotation={0}
                  >
                    {() => (
                      <Icon
                        name={currentPreview === (item.preview || item.item_info?.preview) && isPlaying ? "stop" : "play-arrow"}
                        size={30}
                        color="#fff"
                      />
                    )}
                  </AnimatedCircularProgress>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.postTitle}>{displayName}</Text>
              {itemInfo.album && itemInfo.album.title && (
                <Text style={styles.postAlbum}>{itemInfo.album.title}</Text>
              )}
              {itemInfo.artist && itemInfo.artist.name && (
                <Text style={styles.postArtist}>{itemInfo.artist.name}</Text>
              )}
            </View>
            {topReview && Object.keys(topReview).length > 0 && (
              <View style={styles.reviewContainer}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ uri: topReview.author?.avatarLong || "https://via.placeholder.com/250" }}
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.reviewContent}>
                  <Text style={styles.username}>{topReview.author?.username}</Text>
                  <Text style={styles.reviewText}>{topReview.review}</Text>
                  <View style={styles.ratingContainer}>
                    {[...Array(5)].map((_, i) => (
                      <Image
                        key={i}
                        source={
                          i < topReview.rating
                            ? require("../images/starFullIcon.png")
                            : require("../images/starEmptyIcon.png")
                        }
                        style={styles.starIcon}
                      />
                    ))}
                  </View>
                  <Text style={styles.upvotes}>{topReview.upvotes || 0} Likes</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      );
    }
  
    // Branch 3: Normal recommendation items
    const isSong = item.type === "track";
    const isArtist = item.type === "artist";
    const displayName = item.name || "Unknown Title";
    const topReview = item.topReview || {};
    const albumName = isArtist
      ? ''
      : item.album.title
    const subText = isArtist
      ? item.artistId
        ? `ID: ${item.artistId}`
        : ""
      : item.artist?.name || "Unknown Artist";
    const imageUri = item.image || item.coverArt || "https://via.placeholder.com/250";
    let postContext = "";
    if (item.origin && typeof item.origin === "object") {
      if (isSong) {
        postContext = `${item.origin.title} by ${item.origin.artist}`;
      } else if (isArtist) {
        postContext = `Because you like ${item.origin.name}`;
      }
    }
  
    return (
      <TouchableWithoutFeedback onPress={() => handleTap(item)}>
        <View style={[styles.card, getCardBorderStyle(item)]}>
          <View style={styles.cardInformation}>
            <View style={styles.postContextContainer}>
              <Text style={styles.postContext}>
                <Text style={styles.boldPostContext}>{`Because you like:\n`}</Text>
                {postContext}
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => handleLikeSong(item)} style={styles.actionButton}>
                <Image
                  source={
                    item.liked
                      ? require("../images/whiteFullHeart.png")
                      : require("../images/whiteOpenHeart.png")
                  }
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>
                  {item.liked ? "Liked" : "Like"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleModal(item)} style={styles.actionButton}>
                <Image
                  source={require("../images/shareIcon.png")}
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.postImage} />
            {(item.type === "track" || item.item_info?.type === "track") && (item.preview || item.item_info?.preview) && (
              <TouchableOpacity
                onPress={handlePreview}
                style={styles.playButton}
              >
                <AnimatedCircularProgress
                  size={50}
                  width={5}
                  fill={currentPreview === (item.preview || item.item_info?.preview) ? progress : 0}
                  tintColor={colours.secondaryblue}
                  backgroundColor={colours.bluegrey}
                  rotation={0}
                >
                  {() => (
                    <Icon
                      name={currentPreview === (item.preview || item.item_info?.preview) && isPlaying ? "stop" : "play-arrow"}
                      size={30}
                      color="#fff"
                    />
                  )}
                </AnimatedCircularProgress>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.postTitle}>{displayName}</Text>
            {albumName ? <Text style={styles.postAlbum}>{albumName}</Text> : null}
            {subText ? <Text style={styles.postArtist}>{subText}</Text> : null}
            {topReview && Object.keys(topReview).length > 0 && (
              <View style={styles.reviewContainer}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ uri: topReview.author?.avatarLong || "https://via.placeholder.com/250" }}
                    style={styles.avatar}
                  />
                </View>
                <View style={styles.reviewContent}>
                  <Text style={styles.username}>{topReview.author?.username} {topReview.emoji} {topReview.hearted && <Image source={require("../images/whiteFullHeart.png")} style={styles.heartEmoji} />}</Text>
                  <Text style={styles.reviewText}>{topReview.review}</Text>
                  <View style={styles.ratingContainer}>
                    {[...Array(5)].map((_, i) => (
                      <Image
                        key={i}
                        source={
                          i < topReview.rating
                            ? require("../images/starFullIcon.png")
                            : require("../images/starEmptyIcon.png")
                        }
                        style={styles.starIcon}
                      />
                    ))}
                  </View>
                  <Text style={styles.upvotes}>{topReview.upvotes || 0} Likes</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  };
  

  // -------------------------------------------------------------------------
  //  Return component UI
  // -------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* SHARE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View
                  style={[
                    styles.modalContent,
                    { transform: [{ translateY: slideAnim }] },
                  ]}
                >
                  <Text style={styles.modalText}>
                    Share "{currentShareItem?.name || "Item"}"
                  </Text>
                  <FlatList
                    data={friendsList}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item.userId}
                    numColumns={3}
                    contentContainerStyle={styles.gridContainer}
                  />
                  {selectedUser && (
                    <View style={styles.commentSection}>
                      <Text style={styles.commentPrompt}>
                        Leave a message for {selectedUser.username}:
                      </Text>
                      <TextInput
                        style={styles.commentInput}
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Write your comment here..."
                        maxLength={40}
                        multiline={false}
                      />
                    </View>
                  )}
                  <View style={styles.modalButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.shareButton,
                        !selectedUser && styles.disabledButton,
                      ]}
                      onPress={handleShareComment}
                      disabled={!selectedUser}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          !selectedUser && styles.disabledButtonText,
                        ]}
                      >
                        Share
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* SIDEBAR */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>
      {/* SEARCH BAR */}
      <SearchBar />
      {/* NOTIFICATIONS ICON */}
      <TouchableOpacity
        style={styles.notificationsIcon}
        onPress={() => navigation.navigate("Notifications")}
      >
        <Image
          source={require("../images/notificationsIcon2.png")}
          style={styles.notifIcon}
        />
        {notificationsCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{notificationsCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      {/* MAIN CONTENT: FEED */}
      <View style={styles.content}>
        <Text style={styles.header}>Recent Feed</Text>
        {isLoading ? (
            <ActivityIndicator size="large" color="white" />
        ) : (
        <FlatList
          data={combinedFeed}
          renderItem={renderFeedItem}
          keyExtractor={(item, index) => {
            let baseKey;
            if (item.type === "friend_review") {
              baseKey = `friend_review-${item.rid}`;
            } else if (item.sharedItems) {
              baseKey = `shared-${item.sharedItems[0]?.rid}`;
            } else {
              baseKey = `item-${item.record_id || item.rid}`;
            }
            return `${baseKey}-${index}`;
          }}
          contentContainerStyle={styles.feedList}
          refreshControl={
          <RefreshControl 
          tintColor="#FFFFFF" 
          colors={['#FFFFFF']}
          progressBackgroundColor="#FFFFFF"
          refreshing={refreshing} 
          onRefresh={onRefresh} 
          />}
          onMomentumScrollBegin={() => setOnEndReachedCalledDuringMomentum(false)}
          onEndReached={() => {
            if (!onEndReachedCalledDuringMomentum) {
              loadMoreTimeline();
              setOnEndReachedCalledDuringMomentum(true);
            }
          }}
          onEndReachedThreshold={2}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 100,
          }}
        />
        )}
      </View>
      {/* CREATE POST BUTTON */}
      {/* <TouchableOpacity
        style={styles.addPostButton}
        onPress={() => navigation.navigate("CreatePost")}
      >
        <Image source={require("../images/addPost.png")} style={styles.addPostIcon} />
      </TouchableOpacity> */}
      {/* BOTTOM NAV BAR */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: colours.background,

  },

  sideMenu: {

    position: "absolute",

    top: 40,

    right: 525,

    bottom: 0,

    shadowColor: "#000",

    shadowOffset: { width: 2, height: 0 },

    shadowOpacity: 0.25,

    shadowRadius: 4,

    elevation: 5,

    zIndex: 10,

  },

  notificationsIcon: {

    width: 40,

    height: 40,

    position: "absolute",

    top: 70,

    right: 20,

  },

  notifIcon: {

    width: "90%",

    height: "90%",

    resizeMode: "contain",

    left: 10,

    top: 2,

  },

  notificationBadge: {

    position: "absolute",

    top: -5,

    right: -5,

    backgroundColor: "red",

    width: 20,

    height: 20,

    borderRadius: 10,

    alignItems: "center",

    justifyContent: "center",

    zIndex: 10,

  },

  notificationBadgeText: {

    color: "black",

    fontSize: 12,

    fontWeight: "bold",

  },

  content: {

    flex: 1,

    marginTop: 130,

    paddingHorizontal: 20,

  },

  header: {

    fontSize: 24,

    fontWeight: "bold",

    color: colours.white,

    marginBottom: 10,

  },

  feedList: {

    paddingBottom: 100,

  },

  card: {

    backgroundColor: colours.foreground,

    marginBottom: 20,

    borderRadius: 10,

    padding: 15,

    shadowColor: "#000",

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.1,

    shadowRadius: 4,

    elevation: 2,

    alignItems: "center",

    textAlign: "center",

  },

  cardInformation: {

    display: "flex",

    flex: 1,

    flexDirection: "row",

    marginBottom: 10

  },

  postImage: {

    width: 250,

    height: 250,

    borderRadius: 10,

    marginBottom: 10,

  },

  cardContent: {

    flex: 1,

    textAlign: "center",

    alignItems: "center",

    display: "flex",

    flexDirection: "column",

  },

  postTitle: {

    fontSize: 20,

    fontWeight: "bold",

    textAlign: "center",

    color: "#fff",

    marginBottom: 2,

  },

  postArtist: {

    fontSize: 16,

    color: "#aaa",

    marginBottom: 0,

  },

  postAlbum: {

    textAlign: "center" ,

    fontSize: 16,

    color: "#aaa",

    marginBottom: 10,

  },

  postContext: {

    fontSize: 16,

    color: "#fff",

    width: "100%",

    marginBottom: 10,

    alignSelf: "left",

  },

  boldPostContext: {

    fontSize: 16,

    color: "#fff",

    width: "100%",

    marginBottom: 10,

    alignSelf: "left",

    fontWeight: "bold",

    textTransform: "capitalize",

  },

  reviewContainer: {

    marginTop: 10,

    padding: 8,

    backgroundColor: colours.foreground2,

    borderRadius: 5,

    width: "100%",

    alignSelf: "stretch",

    flexDirection: "row",

    alignItems: "left",

  },

  reviewContent: {

    flex: 1,

    flexDirection: "column",

    alignItems: "left",

    textAlign: "left",

  },

  avatarContainer: {

    marginRight: 10,

  },

  commentCard: {

    backgroundColor: colours.foreground,

    flexDirection: "row",

    marginBottom: 20,

    borderRadius: 10,

    padding: 15,

    alignItems: "center",

  },

  albumImage: {

    width: 60,

    height: 60,

    borderRadius: 10,

    marginRight: 15,

  },

  commentContent: {

    flex: 1,

  },

  username: {

    fontSize: 16,

    fontWeight: "bold",

    color: "white",

    marginBottom: 5,

    textTransform: "capitalize",

  },

  reviewText: {

    fontSize: 14,

    color: "#fff",

    marginBottom: 5,

  },

  ratingContainer: {

    flexDirection: "row",

    marginTop: 5,

  },

  starIcon: {

    width: 16,

    height: 16,

    marginRight: 2,

  },

  overallRating: {

    width: 24,

    height: 24,

    marginRight: 2,

  },

  upvotes: {

    fontSize: 14,

    color: "#fff",

    marginTop: 5,

  },

  bottomNavBar: {

    position: "absolute",

    bottom: 0,

    width: "100%",

    flexDirection: "row",

  },

  addPostButton: {

    position: "absolute",

    bottom: 120,

    right: 20,

    width: 60,

    height: 60,

    backgroundColor: colours.lightblue,

    borderRadius: 30,

    justifyContent: "center",

    alignItems: "center",

    shadowColor: "#000",

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.3,

    shadowRadius: 4,

    elevation: 5,

  },

  postContextContainer: {

    flex: 1,

  },

  addPostIcon: {

    width: 30,

    height: 30,

    tintColor: "#fff",

  },

  actionButtons: {

    flexDirection: "row",

    justifyContent: "flex-start",

    gap: 20,

    marginTop: 0,

  },

  actionButton: {

    alignItems: "center",

  },

  actionIcon: {

    width: 30,

    height: 30,

  },

  actionText: {

    fontSize: 14,

    color: "#fff",

    marginTop: 5,

  },

  modalOverlay: {

    flex: 1,

    justifyContent: "flex-end",

    alignItems: "center",

  },
  
  modalContent: {

    height: "50%",

    margin: 0,

    backgroundColor: colours.background,

    borderRadius: 20,

    padding: 0,

    alignItems: "center",

    shadowColor: "#000",

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.25,

    shadowRadius: 4,

    elevation: 5,

  },

  modalText: {

    marginVertical: 15,

    textAlign: "center",

    fontSize: 20,

    fontWeight: "bold",

    color: colours.white,

  },

  gridContainer: {

    flex: 1,

    flexDirection: "row",

    flexWrap: "wrap",

    justifyContent: "space-evenly",

  },

  friendItem: {

    paddingTop: 8,

    alignItems: "center",

    marginBottom: 20,

    marginHorizontal: 10,

    width: 100,

  },

  selectedFriendItem: {

    backgroundColor: "rgba(33, 150, 243, 0.2)",

    borderRadius: 20,

  },

  checkmarkIcon: {

    position: "absolute",

    top: 40,

    right: 15,

    width: 20,

    height: 20,

  },

  avatar: {

    width: 50,

    height: 50,

    borderRadius: 25,

    marginBottom: 5,

  },

  commentSection: {

    width: "100%",

    paddingHorizontal: 20,

    marginTop: 15,

  },

  commentPrompt: {

    fontSize: 16,

    marginBottom: 10,

    textAlign: "center",

    color: colours.white,

  },

  commentInput: {

    width: 220,

    padding: 10,

    borderWidth: 1,

    borderColor: colours.white,

    borderRadius: 5,

    marginBottom: 0,

    textAlign: "center",

    color: colours.white,

  },

  modalButtonContainer: {

    flexDirection: "row",

    justifyContent: "space-between",

    width: "100%",

    paddingHorizontal: 20,

    marginBottom: 20,

  },

  button: {

    borderRadius: 20,

    padding: 10,

    elevation: 2,

    marginTop: 20,

  },

  shareButton: {

    backgroundColor: "#2196F3",

    flex: 1,

    marginRight: 0,

    width: "100%",

  },

  disabledButton: {

    backgroundColor: "#cccccc",

    opacity: 0.5,

  },

  buttonText: {

    color: "white",

    fontWeight: "bold",

    textAlign: "center",

  },

  disabledButtonText: {

    color: "#666666",

  },

  refreshSpinner: {

    backgroundColor: colours.white,

  },

  heartEmoji: {
    width: 16,
    height: 16
  },
  reviewEmoji: {
    fontSize: 16,
    marginRight: 4,
    color: "#FFF",
  },
  previewButton: {
    backgroundColor: colours.lightblue,
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  previewButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Darker semi-transparent background
    borderRadius: 25,
    width: 50,
    height: 50,
    shadowColor: "#000", // Add shadow for better visibility
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 5, // For Android shadow
  },

});