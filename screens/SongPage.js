import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import Toast from 'react-native-toast-message';
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import {
  getUser,
  populateMetadata,
  like,
  getLike,
  unlike,
  postRecommendations,
  createReview,
  getReviews,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
  updateReview,
  getSongFromDeezer,
  getFriends,
  share,
  saveRecentlyViewed,
} from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";

import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Icon from "react-native-vector-icons/MaterialIcons";

 const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;

export default function SongPage({ route, navigation }) {
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === "web";
    const isDesktopWeb = isWeb && width >= 768;
    const isMobileWeb = isWeb && width < 768;
    const isCompact = width < 768;

    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
      if (isDesktopWeb) {
        setMenuOpen(true);
      } else {
        setMenuOpen(false);
      }
    }, [isDesktopWeb]);
  const [username, setUsername] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Reviews state
  const [review, setReview] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);
  const [existingReviewId, setExistingReviewId] = useState(null);

  // Share modal
  const [modalVisible, setModalVisible] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comment, setComment] = useState("");
  const [currentShareItem, setCurrentShareItem] = useState(null);

  // In-app confirmation modal used on native and web.
  const [confirmation, setConfirmation] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "Post",
    onConfirm: null,
  });

  const openConfirmation = ({ title, message, confirmText, onConfirm }) => {
    setConfirmation({
      visible: true,
      title,
      message,
      confirmText: confirmText || "Confirm",
      onConfirm,
    });
  };

  const closeConfirmation = () => {
    setConfirmation((current) => ({ ...current, visible: false, onConfirm: null }));
  };

  const confirmAction = async () => {
    const action = confirmation.onConfirm;
    closeConfirmation();
    if (typeof action === "function") {
      await action();
    }
  };

  // -------------------------------------------------------------------------
  //  handleModal (open share modal)
  // -------------------------------------------------------------------------
  const handleModal = async (track) => {
    try {
      const response = await getFriends(auth.currentUser.uid);
      const json = await response.json();
      setFriendsList(json);
      setCurrentShareItem(track);
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

  // Animated value for sliding the modal up when the keyboard is active.
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  // -------------------------------------------------------------------------
  //  handleSelectUser
  // -------------------------------------------------------------------------
  const handleSelectUser = (user) => {
    setSelectedUser((prevUser) =>
      prevUser && prevUser.userId === user.userId ? null : user
    );
  };

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For the emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const isFocused = useIsFocused();

  // For progress of song preview
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [trackName, setTrackName] = useState("");
  const [track, setTrack] = useState(route.params.track);
    useEffect(() => {
      const recordRecentlyViewed = async () => {
        const currentUser = auth.currentUser;

        if (!currentUser || !track?.id) {
          return;
        }

        try {
          const response = await saveRecentlyViewed(
            currentUser.uid,
            {
              ...track,
              type: "track",
            }
          );

          if (!response?.ok) {
            const data = await response?.json();

            console.warn(
              "[SongPage] Failed to save recently viewed:",
              data
            );
          }
        } catch (error) {
          console.error(
            "[SongPage] Recently viewed error:",
            error
          );
        }
      };

      recordRecentlyViewed();
    }, [track?.id]);

  // Fetch current user data
  useEffect(() => {
    console.log("SongPage mounted with track:", track);
    if(!track.preview) {
        getSongFromDeezer(track.id).then((res) => {
            if(res.ok) {
                res.json().then((data) => {
                    console.log("Data from Deezer:", data);
                    setTrack({...track, preview: data.preview});
                });
            }
        }
    )}
    setArtistName(track.artist?.name || track.artist);
    setAlbumName(typeof track.album === "object" ? track.album.title || "Unknown Album" : track.album);
    setTrackName(track.title || track.name);
    
    try {
      populateMetadata(track.type, track.id);
    } catch (error) {
      console.error("Error populating metadata:", error);
    }
    async function fetchUserData() {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigation.navigate("Home");
          return;
        }
        const resp = await getUser(currentUser.uid);
        if (!resp.ok) throw new Error("Failed to fetch user data");
        const userData = await resp.json();
        setUsername(userData.username || currentUser.displayName || "Anonymous");
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Unable to fetch user data.");
      } finally {
        setLoadingUser(false);
      }
    }
    populateReviews();
    fetchUserData();
  }, [navigation, isFocused]);

  const enrichReviewUsers = async (reviewItems) => {
    return Promise.all(
      reviewItems.map(async (reviewItem) => {
        const reviewUserId =
          reviewItem?.userId ||
          reviewItem?.user_id ||
          reviewItem?.uid ||
          reviewItem?.user?.userId ||
          reviewItem?.user?.uid;

        if (
          !reviewUserId ||
          reviewItem?.avatar ||
          reviewItem?.avatarLong ||
          reviewItem?.userAvatar
        ) {
          return reviewItem;
        }

        try {
          const userResponse =
            await getUser(reviewUserId);

          if (!userResponse?.ok) {
            return reviewItem;
          }

          const userData =
            await userResponse.json();

          return {
            ...reviewItem,
            userId: String(reviewUserId),
            username:
              reviewItem?.username ||
              reviewItem?.userName ||
              userData?.username ||
              userData?.displayName ||
              "Treble User",
            avatar:
              userData?.avatar ||
              userData?.avatarLong ||
              userData?.profilePicture ||
              "",
          };
        } catch (error) {
          console.warn(
            "[SongPage] Could not load review user:",
            error
          );

          return reviewItem;
        }
      })
    );
  };


  async function populateReviews() {
  try {
    const response = await getReviews(track.id);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "Failed to load reviews."
      );
    }

    const loadedReviews = Array.isArray(data)
      ? data
      : data.reviews || [];

    const enrichedReviews =
      await enrichReviewUsers(
        loadedReviews
      );

    setReviews(enrichedReviews);

    const myExistingReview = enrichedReviews.find(
      (item) => item.isUser === true
    );

    if (myExistingReview) {
      setExistingReviewId(myExistingReview.id);
      setFavourite(Boolean(myExistingReview.hearted));
      setReviewRating(Number(myExistingReview.rating || 0));
      setSelectedEmojis(
        Array.isArray(myExistingReview.emoji)
          ? myExistingReview.emoji
          : []
      );
      setReview(myExistingReview.message || "");
    } else {
      setExistingReviewId(null);
      setFavourite(false);
      setReviewRating(0);
      setSelectedEmojis([]);
      setReview("");
    }
  } catch (error) {
    console.error(
      "[SongPage] Error loading reviews:",
      error
    );

    setReviews([]);
    setUsers([]);
  }
}

  useEffect(() => {
    async function checkLikeStatus() {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const response = await getLike(currentUser.uid, track.id, track.type);
        if (!response.ok) {
          setLiked(false);
          return;
        }
        const data = await response.json();
        setLiked(data.liked);
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    }
    checkLikeStatus();
  }, [track.id]);

  // Sort reviews by upvotes descending
  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => b.upvotes - a.upvotes);
  };

  const tapTimerRef = useRef(null);
    const DOUBLE_TAP_DELAY = 300; // ms
  
    // This function is called on every tap
    const handleTap = () => {
      if (tapTimerRef.current) {
        // Second tap detected
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
        handleDoubleTap();
      } else {
        // First tap detected
        tapTimerRef.current = setTimeout(() => {
          tapTimerRef.current = null;
          // single tap would go here, if you needed it
          // e.g. open details, etc.
        }, DOUBLE_TAP_DELAY);
      }
    };
  
    // 2) Action for a double tap
    const handleDoubleTap = () => {
      handleLikeSong(); // Use your existing like function
    };

  // Handler logic
  const handleLikeSong = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      if (!liked) {
        const response = await like(currentUser.uid, track.id, track.type);
        if (!response.ok) {
          throw new Error("Failed to like the song");
        }
        const data = await response.json();
        console.log("Song liked successfully:", data);
        setLiked(true);
        
        // After liking, call the recommendations endpoint
        try {
          const recResponse = await postRecommendations(
            currentUser.uid,    // user_id
            track.id,           // music_id
            track.type,         // type 
            trackName,         // name
            artistName       // artist_name
          );
          if (recResponse.ok) {
            const recData = await recResponse.json();
            console.log("Recommendations result:", recData);
          } else {
            console.error("Failed to create recommendations:", recResponse.status);
          }
        } catch (err) {
          console.error("Error calling postRecommendations:", err);
        }
      } else {
        const response = await unlike(currentUser.uid, track.id, track.type);
        if (!response.ok) {
          throw new Error("Failed to unlike the song");
        }
        const data = await response.json();
        console.log("Song unliked successfully:", data);
        setLiked(false);
      }
    } catch (error) {
      console.error("Error toggling like status:", error);
      Alert.alert("Error", "Unable to toggle like status");
    }
  };

  const openArtistPage = () => {
  const rawArtist =
    track?.artist;

  const normalizedArtist =
    typeof rawArtist === "object" &&
    rawArtist !== null
      ? {
          ...rawArtist,

          id:
            rawArtist.id ||
            rawArtist.artistId ||
            rawArtist.artist_id ||
            track?.artistId ||
            track?.artist_id ||
            "",

          name:
            rawArtist.name ||
            artistName ||
            "Unknown Artist",

          picture:
            rawArtist.picture_xl ||
            rawArtist.picture_big ||
            rawArtist.picture_medium ||
            rawArtist.picture ||
            "",
        }
      : {
          id:
            track?.artistId ||
            track?.artist_id ||
            "",

          name:
            artistName ||
            String(rawArtist || "") ||
            "Unknown Artist",

          picture:
            "",
        };

  if (
    !normalizedArtist.name ||
    normalizedArtist.name ===
      "Unknown Artist"
  ) {
    Alert.alert(
      "Artist unavailable",
      "This song does not contain valid artist information."
    );

    return;
  }

  navigation.navigate(
    "ArtistListenables",
    {
      artist:
        normalizedArtist,

      artistId:
        normalizedArtist.id,

      artistName:
        normalizedArtist.name,
    }
  );
};

  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => {
    setFavourite((currentValue) => !currentValue);
  };
  const handleShare = () => console.log("Song shared!");

  const handleSelectEmoji = (emoji) => {
    setSelectedEmojis((prev) =>
      prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );
  };

 const handleAddReview = () => {
  if (!review.trim()) {
    Alert.alert(
      "Review required",
      "Please enter a review before posting."
    );
    return;
  }

  const isUpdating = Boolean(existingReviewId);

  openConfirmation({
    title: isUpdating ? "Update Review?" : "Post Review?",
    message: isUpdating
      ? "Are you sure you want to update this review?"
      : "Are you sure you want to post this review?",
    confirmText: isUpdating ? "Update" : "Post",
    onConfirm: actuallyAddReview,
  });
};

  async function actuallyAddReview() {
    try {
      const reviewText = review.trim();

      if (!reviewText) {
        return;
      }

      const reviewPayload = {
        listenable_id: String(track.id),
        type: "track",
        hearted: Boolean(favourite),
        message: reviewText,
        rating: Number(reviewRating),
        emoji: [...selectedEmojis],
      };

      console.log(
        "[SongPage] Sending review:",
        reviewPayload
      );

      const response = existingReviewId
        ? await updateReview(
            existingReviewId,
            [...selectedEmojis],
            Boolean(favourite),
            reviewText,
            Number(reviewRating)
          )
        : await createReview(reviewPayload);

      if (!response) {
        throw new Error(
          "The backend did not return a response."
        );
      }

      const responseText = await response.text();

      let data = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        data = {
          error:
            responseText ||
            "Invalid backend response.",
        };
      }

      console.log(
        "[SongPage] Review response:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Backend returned HTTP ${response.status}`
        );
      }

      /*
      * Store the generated ID after the first post.
      * Later posts update this same document.
      */
      setExistingReviewId(
        data.id || existingReviewId
      );

      if (
        favourite ||
        Number(reviewRating) >= 4
      ) {
        try {
          await postRecommendations(
            auth.currentUser.uid,
            String(track.id),
            "track",
            track.title ||
              track.name ||
              "",
            typeof track.artist === "string"
              ? track.artist
              : track.artist?.name || "",
            favourite
              ? "favourite"
              : "high-rating"
          );
        } catch (recommendationError) {
          console.warn(
            "[SongPage] Review saved, but recommendation seed failed:",
            recommendationError
          );
        }
      }

      await populateReviews();

      /*
      * Do NOT clear favourite, rating, emojis, or review.
      * These remain populated with the saved values.
      */

      Toast.show({
        type: "success",
        text1: existingReviewId
          ? "Review updated"
          : "Review posted",
      });
    } catch (error) {
      console.error(
        "[SongPage] Error posting review:",
        error
      );

      Alert.alert(
        "Unable to save review",
        error.message
      );
    }
  }

  const handleUpvote = async (id) => {
    const existingReview = reviews.find(
      (item) => item.id === id
    );

    if (!existingReview) {
      return;
    }

    try {
      const response = existingReview.upvoted
        ? await removeUpvoteFromReview(id)
        : await upvoteReview(id);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to update upvote."
        );
      }

      setReviews((previousReviews) =>
        previousReviews.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return {
            ...item,
            upvoted: !item.upvoted,
            upvotes: item.upvoted
              ? Math.max(0, item.upvotes - 1)
              : item.upvotes + 1,
          };
        })
      );
    } catch (error) {
      console.error(
        "[SongPage] Upvote error:",
        error
      );

      Alert.alert(
        "Unable to update review",
        error.message
      );
    }
  };

  // Handle song preview playback
  // Handle song preview playback
const [sound, setSound] = useState(null);

const handlePlayPreview = async () => {
  if (!track?.preview) {
    Alert.alert(
      "No Preview",
      "This song does not have a preview available."
    );

    return;
  }

  try {
    /*
     * If the preview is already playing,
     * clicking the button stops it.
     */
    if (sound) {
      await sound.unloadAsync();

      setSound(null);
      setProgress(0);
      setIsPlaying(false);

      return;
    }

    /*
     * Read the volume saved on the Settings page.
     */
    const savedVolume = await AsyncStorage.getItem(
      "treble_preview_volume"
    );

    const parsedVolume =
      savedVolume !== null
        ? Number(savedVolume)
        : 0.65;

    /*
     * Keep the volume between 0 and 1.
     */
    const previewVolume = Number.isFinite(parsedVolume)
      ? Math.min(1, Math.max(0, parsedVolume))
      : 0.65;

    console.log(
      "[SongPage] Preview volume:",
      previewVolume
    );

    /*
     * Start the preview using the saved volume.
     */
    const { sound: newSound } =
      await Audio.Sound.createAsync(
        {
          uri: track.preview,
        },
        {
          shouldPlay: true,
          volume: previewVolume,
        }
      );

    setSound(newSound);
    setProgress(0);
    setIsPlaying(true);

    newSound.setOnPlaybackStatusUpdate((status) => {
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
            (status.positionMillis /
              status.durationMillis) *
              100
          )
        );
      }

      setIsPlaying(Boolean(status.isPlaying));

      if (status.didJustFinish) {
        setProgress(0);
        setIsPlaying(false);
        setSound(null);

        newSound
          .unloadAsync()
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error(
      "[SongPage] Error playing preview:",
      error
    );

    setSound(null);
    setProgress(0);
    setIsPlaying(false);

    Alert.alert(
      "Error",
      "Unable to play the song preview."
    );
  }
};

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    // Cleanup the sound instance when the component unmounts or view changes
    if (!isFocused && sound) {
      sound.unloadAsync();
      setSound(null);
      setProgress(0);
      setIsPlaying(false);
    }
  }, [isFocused, sound]);

  const handleDelete = async (id) => {
    const existingReview = reviews.find(
      (item) => item.id === id
    );

    if (!existingReview?.isUser) {
      Alert.alert(
        "Unable to delete",
        "You can only delete your own reviews."
      );

      return;
    }

    try {
      const response = await deleteReview(id);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to delete review."
        );
      }

      setReviews((previousReviews) =>
        previousReviews.filter(
          (item) => item.id !== id
        )
      );
    } catch (error) {
      console.error(
        "[SongPage] Delete review error:",
        error
      );

      Alert.alert(
        "Unable to delete review",
        error.message
      );
    }
  };

  if (!track) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.errorText}>No track data found.</Text>
      </View>
    );
  }

  const trackImage = track.image
    ? { uri: track.image }
    : require("../images/albumImage.jpg");

    return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        isWeb && styles.webContainer,
      ]}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
      keyboardVerticalOffset={10}
    >
      {/* =========================================================
          APP CONFIRMATION MODAL
      ========================================================= */}
      <Modal
        animationType="fade"
        transparent
        visible={confirmation.visible}
        onRequestClose={closeConfirmation}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{confirmation.title}</Text>
            <Text style={styles.confirmMessage}>{confirmation.message}</Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={closeConfirmation}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmSubmitButton]}
                onPress={confirmAction}
              >
                <Text style={styles.confirmSubmitText}>
                  {confirmation.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================
          SHARE MODAL
      ========================================================= */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
          style={styles.modalKeyboardView}
        >
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View
                  style={[
                    styles.modalContent,
                    isDesktopWeb && styles.desktopModalContent,
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
                      <Text style={styles.modalText}>
                        Share
                      </Text>

                      <Text
                        style={styles.modalSongName}
                        numberOfLines={1}
                      >
                        {currentShareItem?.name ||
                          currentShareItem?.title ||
                          trackName ||
                          "Song"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={closeModal}
                      style={styles.modalCloseButton}
                    >
                      <Icon
                        name="close"
                        size={25}
                        color="#ffffff"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSectionTitle}>
                    Select a friend
                  </Text>

                  <FlatList
                    data={friendsList}
                    renderItem={renderFriendItem}
                    keyExtractor={(item, index) =>
                      String(item?.userId || index)
                    }
                    numColumns={isCompact ? 3 : 4}
                    key={
                      isCompact
                        ? "compact-share-grid"
                        : "desktop-share-grid"
                    }
                    contentContainerStyle={styles.gridContainer}
                    ListEmptyComponent={
                      <Text style={styles.emptyFriendsText}>
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
                        style={styles.commentInput}
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Add an optional message..."
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        maxLength={100}
                        multiline
                      />

                      <Text style={styles.commentLength}>
                        {comment.length}/100
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.shareButton,
                      !selectedUser &&
                        styles.disabledButton,
                    ]}
                    onPress={handleShareComment}
                    disabled={!selectedUser}
                  >
                    <Icon
                      name="send"
                      size={20}
                      color="#ffffff"
                    />

                    <Text style={styles.buttonText}>
                      Share
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================
          SIDEBAR
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

      {/* =========================================================
          PAGE CONTENT
      ========================================================= */}
      <View
        style={[
          styles.pageContent,
          isDesktopWeb && styles.desktopPageContent,
          isMobileWeb && styles.mobilePageContent,
        ]}
      >
        <FlatList
          data={getSortedReviews()}
          keyExtractor={(item, index) =>
            String(item?.id || index)
          }
          style={[
            styles.reviewsList,
            isWeb && styles.webReviewsList,
          ]}
          contentContainerStyle={[
            styles.reviewsContainer,
            isDesktopWeb && styles.desktopReviewsContainer,
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
          ListHeaderComponent={
            <TouchableWithoutFeedback onPress={handleTap}>
              <View
                style={[
                  styles.card,
                  isDesktopWeb && styles.desktopCard,
                  isCompact && styles.compactCard,
                ]}
              >
                {/* CARD HEADER */}
                <View style={styles.cardInformation}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.boldTitle}>
                      Song
                    </Text>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleLikeSong();
                      }}
                      style={styles.actionButton}
                    >
                      <Image
                        source={
                          liked
                            ? require("../images/whiteFullHeart.png")
                            : require("../images/whiteOpenHeart.png")
                        }
                        style={styles.actionIcon}
                      />

                      <Text style={styles.actionText}>
                        {liked ? "Liked" : "Like"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleModal(track);
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

                {/* SONG IMAGE */}
                <View style={styles.imageContainer}>
                  <Image
                    source={trackImage}
                    style={[
                      styles.image,
                      isCompact && styles.compactImage,
                    ]}
                  />

                  <TouchableOpacity
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      handlePlayPreview();
                    }}
                    style={styles.playButton}
                    disabled={!track.preview}
                  >
                    <AnimatedCircularProgress
                      size={58}
                      width={4}
                      fill={progress}
                      tintColor={colours.secondaryblue}
                      backgroundColor="rgba(255,255,255,0.25)"
                      rotation={0}
                    >
                      {() => (
                        <Icon
                          name={
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
                </View>

                {/* SONG DETAILS */}
                <View style={styles.songDetails}>
                  <Text
                    style={styles.title}
                    numberOfLines={2}
                  >
                    {trackName || "Unknown Track"}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={(event) => {
                      event?.stopPropagation?.();

                      navigation.navigate("ArtistPage", {
                        artistId:
                          track.artist?.id ||
                          track.artistId,

                        artistName:
                          artistName,

                        artist:
                          track.artist,
                      });
                    }}
                  >
                    <Text
                      style={styles.artist}
                      numberOfLines={1}
                    >
                      {artistName}
                    </Text>
                  </TouchableOpacity>

                  {albumName ? (
                    <Text
                      style={styles.album}
                      numberOfLines={1}
                    >
                      {albumName}
                    </Text>
                  ) : null}
                </View>

                {/* REVIEW OPTIONS */}
                <View style={styles.reviewControls}>
                  <View style={styles.favouriteContainer}>
                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleToggleFavourite();
                      }}
                    >
                      <Image
                        source={
                          favourite
                            ? require("../images/whiteFullHeart.png")
                            : require("../images/whiteOpenHeart.png")
                        }
                        style={styles.smallFavIcon}
                      />
                    </TouchableOpacity>

                    <Text style={styles.favLabel}>
                      Favourite
                    </Text>
                  </View>

                  <View style={styles.starRatingContainer}>
                    {[0, 1, 2, 3, 4].map((index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={(event) => {
                          event?.stopPropagation?.();
                          setReviewRating(index + 1);
                        }}
                      >
                        <Image
                          source={
                            index < reviewRating
                              ? require("../images/starFullIcon.png")
                              : require("../images/starEmptyIcon.png")
                          }
                          style={styles.starIcon}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.selectEmojiTab}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      setShowEmojiDropdown(
                        !showEmojiDropdown
                      );
                    }}
                  >
                    <Image
                      source={require("../images/selectEmojiIcon.png")}
                      style={styles.selectEmojiIcon}
                    />
                  </TouchableOpacity>
                </View>

                {/* EMOJI CHOICES */}
                {showEmojiDropdown ? (
                  <View style={styles.emojiDropdownRow}>
                    {["❤️", "🔥", "👏"].map((emoji) => {
                      const selected =
                        selectedEmojis.includes(emoji);

                      return (
                        <TouchableOpacity
                          key={emoji}
                          onPress={(event) => {
                            event?.stopPropagation?.();
                            handleSelectEmoji(emoji);
                          }}
                          style={[
                            styles.emojiChoice,
                            selected &&
                              styles.selectedEmojiChoice,
                          ]}
                        >
                          <Text style={styles.reviewEmoji}>
                            {emoji}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {/* REVIEW INPUT */}
                <View style={styles.reviewInputRow}>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Add a review..."
                    placeholderTextColor="#888888"
                    value={review}
                    onChangeText={setReview}
                    multiline
                    maxLength={500}
                  />

                  <TouchableOpacity
                    style={[
                      styles.reviewButton,
                      !review.trim() &&
                        styles.disabledReviewButton,
                    ]}
                    onPress={handleAddReview}
                    disabled={!review.trim()}
                  >
                    <Text style={styles.reviewButtonText}>
                      {existingReviewId
                        ? "Update"
                        : "Post"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* SELECTED EMOJIS */}
                {selectedEmojis.length > 0 ? (
                  <View style={styles.selectedEmojisSection}>
                    <Text style={styles.selectedEmojisTitle}>
                      Selected:
                    </Text>

                    <View style={styles.selectedEmojisContainer}>
                      {selectedEmojis.map((emoji) => (
                        <Text
                          key={emoji}
                          style={styles.selectedEmoji}
                        >
                          {emoji}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          }
          ListHeaderComponentStyle={styles.listHeader}
          ListEmptyComponent={
            <View style={styles.noReviewsContainer}>
              <Text style={styles.noReviewsTitle}>
                No reviews yet
              </Text>

              <Text style={styles.noReviewsText}>
                Be the first person to review this song.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const user = users.find(
              (userItem) =>
                userItem.userId === item.userId
            );

            const reviewAvatar =
              item.avatarLong ||
              item.avatar ||
              item.userAvatar ||
              item.user_avatar ||
              item.profilePicture ||
              item.profile_picture ||
              item.photoURL ||
              item.photoUrl ||
              item.user?.avatarLong ||
              item.user?.avatar ||
              item.user?.profilePicture ||
              user?.avatarLong ||
              user?.avatar ||
              null;

            const openReviewUser = () => {
              const reviewUserId =
                item.userId ||
                item.user_id ||
                item.uid ||
                item.user?.userId ||
                item.user?.uid ||
                item.user?.id;

              if (!reviewUserId) {
                Alert.alert(
                  "Profile unavailable",
                  "This review does not contain a user ID."
                );
                return;
              }

              navigation.navigate("UserProfiles", {
                userId: reviewUserId,
                username: item.username || item.userName || "",
              });
            };

            return (
              <View style={styles.reviewCardWrapper}>
                <ReviewCard
                  item={item}
                  avatar={reviewAvatar}
                  handleUpvote={handleUpvote}
                  handleDelete={handleDelete}
                  navigation={navigation}
                  showComments={true}
                  showReplyInput={!item.isUser}
                  onUserPress={openReviewUser}
                  onReviewPress={openReviewUser}
                  compactMode
                  onReplyConfirmation={({ message, onConfirm }) =>
                    openConfirmation({
                      title: "Post Reply?",
                      message:
                        message ||
                        "Are you sure you want to post this reply?",
                      confirmText: "Reply",
                      onConfirm,
                    })
                  }
                />
              </View>
            );
          }}
        />
      </View>

      {/* MOBILE NAVIGATION ONLY */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb && styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </KeyboardAvoidingView>
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

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colours.background,
  },

  errorText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 10,
  },

  /* =========================================================
     SIDEBAR
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
     CONTENT AND SCROLLING
  ========================================================= */

  pageContent: {
    flex: 1,
    minHeight: 0,

    paddingBottom: 0,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",
    top: 0,
    left: 280,
    right: 0,
    bottom: 0,

    minHeight: 0,

    paddingTop: 24,
    paddingLeft: 28,
    paddingRight: 28,
    paddingBottom: 0,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    minHeight: 0,

    paddingTop: 69,
    paddingBottom: BOTTOM_NAV_HEIGHT,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  reviewsList: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },

  webReviewsList: {
    height: "100%",

    overflowY: "auto",
    overflowX: "hidden",

    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  reviewsContainer: {
    width: "100%",
    paddingBottom: 120,
  },

  desktopReviewsContainer: {
    paddingBottom: 70,
  },

  listHeader: {
    width: "100%",
  },

  /* =========================================================
     SONG CARD
  ========================================================= */

  card: {
    width: "100%",

    alignSelf: "center",

    backgroundColor: colours.darkblue,

    padding: 18,
    marginBottom: 22,

    borderRadius: 18,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 14,

    elevation: 6,
  },

  desktopCard: {
    width: "100%",
    maxWidth: 900,

    padding: 24,

    borderRadius: 20,
  },

  compactCard: {
    padding: 14,
    borderRadius: 14,
  },

  cardInformation: {
    width: "100%",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    marginBottom: 20,
  },

  titleContainer: {
    flex: 1,
    minWidth: 0,
  },

  boldTitle: {
    color: "#ffffff",

    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",

    textTransform: "capitalize",
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "flex-start",

    gap: 20,
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

  actionText: {
    color: "#ffffff",

    fontSize: 12,
    lineHeight: 16,

    marginTop: 4,
  },

  /* =========================================================
     IMAGE AND DETAILS
  ========================================================= */

  imageContainer: {
    position: "relative",

    width: "100%",

    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    width: 360,
    height: 360,
    maxWidth: "100%",

    borderRadius: 15,

    resizeMode: "cover",

    backgroundColor: "rgba(255,255,255,0.06)",
  },

  compactImage: {
    width: 260,
    height: 260,
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
    shadowOpacity: 0.6,
    shadowRadius: 6,

    elevation: 8,
  },

  songDetails: {
    width: "100%",

    alignItems: "center",

    paddingTop: 17,
    paddingHorizontal: 10,
    paddingBottom: 18,
  },

  title: {
    color: "#ffffff",

    fontSize: 25,
    lineHeight: 32,
    fontWeight: "800",

    textAlign: "center",
  },

  artistButton: {
  maxWidth: "100%",

  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",

  marginTop: 5,

  paddingVertical: 4,
  paddingLeft: 10,
  paddingRight: 5,

  borderRadius: 15,

  backgroundColor:
    "rgba(66,191,238,0.08)",
},

artist: {
  color: "rgba(255,255,255,0.72)",

  fontSize: 19,
  fontWeight: "600",

  marginTop: 8,

  paddingVertical: 4,
},

  album: {
    color: "rgba(255,255,255,0.55)",

    fontSize: 15,
    lineHeight: 21,

    textAlign: "center",

    marginTop: 3,
  },

  /* =========================================================
     REVIEW CONTROLS
  ========================================================= */

  reviewControls: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingTop: 15,

    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },

  favouriteContainer: {
    minWidth: 65,

    alignItems: "center",
    justifyContent: "center",
  },

  smallFavIcon: {
    width: 25,
    height: 25,

    resizeMode: "contain",
  },

  favLabel: {
    color: "#ffffff",

    fontSize: 11,
    lineHeight: 15,

    marginTop: 3,

    textAlign: "center",
  },

  starRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    flexWrap: "wrap",
  },

  starIcon: {
    width: 27,
    height: 27,

    marginHorizontal: 3,

    resizeMode: "contain",
  },

  selectEmojiTab: {
    minWidth: 60,

    alignItems: "center",
    justifyContent: "center",

    padding: 10,
  },

  selectEmojiIcon: {
    width: 30,
    height: 30,

    resizeMode: "contain",
  },

  emojiDropdownRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",

    gap: 8,

    paddingTop: 10,
  },

  emojiChoice: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 21,

    borderWidth: 1,
    borderColor: colours.lightblue,

    backgroundColor: "rgba(255,255,255,0.05)",
  },

  selectedEmojiChoice: {
    borderColor: colours.lightblue,
    backgroundColor: "rgba(33,150,243,0.22)",
  },

  reviewEmoji: {
    fontSize: 21,
  },

  reviewInputRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "stretch",

    gap: 10,

    marginTop: 15,
  },

  reviewInput: {
    flex: 1,

    minHeight: 48,
    maxHeight: 110,

    color: "#111111",

    fontSize: 15,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: 11,

    backgroundColor: "#ffffff",

    textAlignVertical: "top",

    outlineStyle: "none",
  },

  reviewButton: {
    minWidth: 78,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 16,

    borderRadius: 11,

    backgroundColor: colours.lightblue,
  },

  disabledReviewButton: {
    opacity: 0.45,
  },

  reviewButtonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },

  selectedEmojisSection: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    marginTop: 12,
  },

  selectedEmojisTitle: {
    color: "rgba(255,255,255,0.6)",

    fontSize: 13,

    marginRight: 7,
  },

  selectedEmojisContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  selectedEmoji: {
    fontSize: 20,
    marginHorizontal: 3,
  },

  /* =========================================================
     REVIEWS
  ========================================================= */

  reviewCardWrapper: {
    width: "100%",
    maxWidth: 900,

    alignSelf: "center",

    marginBottom: 14,
  },

  noReviewsContainer: {
    width: "100%",
    maxWidth: 900,

    alignSelf: "center",
    alignItems: "center",

    paddingVertical: 35,
    paddingHorizontal: 20,
  },

  noReviewsTitle: {
    color: "#ffffff",

    fontSize: 18,
    fontWeight: "800",
  },

  noReviewsText: {
    color: "rgba(255,255,255,0.55)",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",

    marginTop: 5,
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

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",

    backgroundColor: colours.background,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.45,
    shadowRadius: 18,

    elevation: 12,
  },

  desktopModalContent: {
    width: 520,
    maxHeight: 650,

    padding: 22,
  },

  modalHeader: {
    width: "100%",

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

  modalText: {
    color: "#ffffff",

    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },

  modalSongName: {
    color: "rgba(255,255,255,0.58)",

    fontSize: 14,

    marginTop: 3,
  },

  modalCloseButton: {
    width: 38,
    height: 38,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 19,

    backgroundColor: "rgba(255,255,255,0.07)",
  },

  modalSectionTitle: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "700",

    marginBottom: 10,
  },

  gridContainer: {
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

  avatar: {
    width: 54,
    height: 54,

    borderRadius: 27,

    marginBottom: 6,

    backgroundColor: "rgba(255,255,255,0.08)",
  },

  username: {
    color: "#ffffff",

    fontSize: 12,

    textAlign: "center",
  },

  checkmarkIcon: {
    position: "absolute",
    top: 43,
    right: 13,

    width: 21,
    height: 21,
  },

  emptyFriendsText: {
    color: "rgba(255,255,255,0.55)",

    fontSize: 14,

    textAlign: "center",

    paddingVertical: 25,
  },

  commentSection: {
    width: "100%",

    marginTop: 10,
  },

  commentPrompt: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "700",

    marginBottom: 8,
  },

  commentInput: {
    width: "100%",

    minHeight: 75,
    maxHeight: 115,

    color: "#ffffff",

    padding: 12,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 12,

    backgroundColor: colours.darkblue,

    textAlignVertical: "top",

    outlineStyle: "none",
  },

  commentLength: {
    color: "rgba(255,255,255,0.4)",

    fontSize: 11,

    textAlign: "right",

    marginTop: 4,
  },

  shareButton: {
    minHeight: 48,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,

    marginTop: 16,

    borderRadius: 24,

    backgroundColor: "#2196f3",
  },

  disabledButton: {
    opacity: 0.4,
  },

  buttonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colours.darkblue,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  confirmTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 10,
  },

  confirmMessage: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },

  confirmButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  confirmButton: {
    minWidth: 105,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: "center",
  },

  confirmCancelButton: {
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  confirmSubmitButton: {
    backgroundColor: colours.lightblue,
  },

  confirmCancelText: {
    color: "#ffffff",
    fontWeight: "600",
  },

  confirmSubmitText: {
    color: "#ffffff",
    fontWeight: "700",
  },

});