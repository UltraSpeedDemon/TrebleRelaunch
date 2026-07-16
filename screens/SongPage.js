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
  Keyboard
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
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function SongPage({ route, navigation }) {
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

    setReviews(loadedReviews);
    setUsers([]);

    const myExistingReview = loadedReviews.find(
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

  Alert.alert(
    existingReviewId
      ? "Update Review?"
      : "Want to Post?",
    existingReviewId
      ? "Do you want to update your existing review?"
      : "Are you sure you want to post this review?",
    [
      {
        text: "No",
        style: "cancel",
      },
      {
        text: "Yes",
        onPress: actuallyAddReview,
      },
    ],
    {
      cancelable: true,
    }
  );
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
  const [sound, setSound] = useState(null);
  const handlePlayPreview = async () => {
    if (track.preview) {
      try {
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
          setProgress(0);
          setIsPlaying(false);
          return;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: track.preview },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.isPlaying) {
            setProgress((status.positionMillis / status.durationMillis) * 100);
          }
          if (status.didJustFinish) {
            setProgress(0);
            setIsPlaying(false);
          }
        });
      } catch (error) {
        console.error("Error playing preview:", error);
        Alert.alert("Error", "Unable to play the song preview.");
      }
    } else {
      Alert.alert("No Preview", "This song does not have a preview available.");
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={10} // adjust this value as needed
    >
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
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => {}} />
      </View>

      <FlatList
        data={getSortedReviews()}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <TouchableWithoutFeedback onPress={handleTap}>
            <View style={styles.card}>
              <View style={styles.cardInformation}>
                <View style={styles.titleContainer}>
                    <Text style={styles.boldTitle}>
                      Song
                    </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={handleLikeSong} style={styles.actionButton}>
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
                  <TouchableOpacity onPress={() => handleModal(track)} style={styles.actionButton}>
                    <Image
                      source={require("../images/shareIcon.png")}
                      style={styles.actionIcon}
                    />
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Song Image with Play Button */}
              <View style={styles.imageContainer}>
                <Image source={trackImage} style={styles.image} />
                <TouchableOpacity
                  onPress={handlePlayPreview}
                  style={styles.playButton}
                  disabled={!track.preview} // Disable button if preview is not loaded
                >
                  <AnimatedCircularProgress
                    size={50}
                    width={5}
                    fill={progress}
                    tintColor={colours.secondaryblue}
                    backgroundColor={colours.bluegrey}
                    rotation={0}
                  >
                    {() => (
                      <Icon
                        name={isPlaying ? "stop" : "play-arrow"}
                        size={30}
                        color="#fff"
                      />
                    )}
                  </AnimatedCircularProgress>
                </TouchableOpacity>
              </View>

              {/* Song Details */}
              <Text style={styles.title}>{trackName || "Unknown Track"}</Text>
              <Text style={styles.artist}>
                Artist: {artistName || "Unknown"}
              </Text>
              {albumName && (
                <Text style={styles.album}>Album: {albumName}</Text>
              )}

              {/* Add Review Section */}
                <View style={styles.topRow}>
                  <View style={styles.favouriteContainer}>
                    <TouchableOpacity onPress={handleToggleFavourite}>
                      <Image
                        source={
                          favourite
                            ? require("../images/whiteFullHeart.png")
                            : require("../images/whiteOpenHeart.png")
                        }
                        style={styles.smallFavIcon}
                      />
                    </TouchableOpacity>
                    <Text style={styles.favLabel}>Favourite</Text>
                  </View>
                  <View style={styles.starRatingContainer}>
                    {[...Array(5)].map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setReviewRating(index + 1)}
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
                    onPress={() => setShowEmojiDropdown(!showEmojiDropdown)}
                  >
                    <Image
                      source={require("../images/selectEmojiIcon.png")}
                      style={styles.selectEmojiIcon}
                    />
                  </TouchableOpacity>
                </View>

                {showEmojiDropdown && (
                  <View style={styles.emojiDropdownRow}>
                    <TouchableOpacity
                      onPress={() => handleSelectEmoji("❤️")}
                      style={
                        selectedEmojis.includes("❤️")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>❤️</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSelectEmoji("🔥")}
                      style={
                        selectedEmojis.includes("🔥")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>🔥</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSelectEmoji("👏")}
                      style={
                        selectedEmojis.includes("👏")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>👏</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ flexDirection: "row", marginTop: 15 }}>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Add a review..."
                    placeholderTextColor="#aaa"
                    value={review}
                    onChangeText={setReview}
                  />
                  <TouchableOpacity
                  style={[
                    styles.reviewButton,
                    !review.trim() && { opacity: 0.5 },
                  ]}
                  onPress={handleAddReview}
                  disabled={!review.trim()}
                >
                  <Text style={styles.reviewButtonText}>Post</Text>
                </TouchableOpacity>
                </View>

                {selectedEmojis.length > 0 && (
                  <View style={styles.selectedEmojisSection}>
                    <Text style={styles.selectedEmojisTitle}>Selected Emojis</Text>
                    <View style={styles.selectedEmojisContainer}>
                      {selectedEmojis.map((em, idx) => (
                        <Text key={idx} style={styles.selectedEmoji}>
                          {em}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
          </TouchableWithoutFeedback>
        }
        renderItem={({ item }) => {
          const user = users.find((u) => u.userId === item.userId);
          const avatar = user ? user.avatarLong : null;
          return (
            <ReviewCard
              item={item}
              avatar={avatar}
              handleUpvote={handleUpvote}
              handleDelete={handleDelete}
              navigation={navigation}
              showComments={false}
              showReplyInput={false}
            />
          );
        }}
        contentContainerStyle={styles.reviewsContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 10,
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    zIndex: 10,
  },
  card: {
    backgroundColor: colours.darkblue,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 20,
    marginTop: 110,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  imageContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "70%",
    height: 200,
    alignSelf: "center",
    borderRadius: 10,
    marginBottom: 20,
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
  artist: {
    fontSize: 18,
    color: "#bbb",
    marginBottom: 10,
    textAlign: "center",
  },
  album: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
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
  reviewInputContainer: {
    marginTop: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  favouriteContainer: {
    top: 3,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  smallFavIcon: {
    width: 21,
    height: 21,
  },
  favLabel: {
    color: "#fff",
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
  starRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  starIcon: {
    width: 25,
    height: 25,
    marginHorizontal: 2,
  },
  selectEmojiTab: {
    padding: 14,
  },
  selectEmojiIcon: {
    width: 28,
    height: 28,
  },
  emojiDropdownRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  reviewEmoji: {
    fontSize: 20,
    marginHorizontal: 6,
  },
  reviewInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginRight: 10,
  },
  reviewButton: {
    backgroundColor: colours.lightblue,
    borderRadius: 10,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  selectedEmojisSection: {
    marginTop: 10,
    alignItems: "center",
  },
  selectedEmojisTitle: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 5,
  },
  selectedEmojisContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  selectedEmoji: {
    fontSize: 20,
    marginHorizontal: 4,
  },
  reviewCard: {
    flexDirection: "row",
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: "center",
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  reviewContent: {
    flex: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: colours.lightblue,
    marginRight: 10,
  },
  reviewText: {
    fontSize: 14,
    color: "#fff",
    marginVertical: 5,
  },
  reviewRating: {
    flexDirection: "row",
    marginTop: 5,
  },
  reviewStar: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 10,
    right: 10,
  },
  upvoteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  upvoteIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  upvoteCount: {
    fontSize: 14,
    color: "#fff",
  },
  reviewsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  previewButton: {
    backgroundColor: colours.lightblue,
    borderRadius: 10,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  previewButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
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

  cardInformation: {

    display: "flex",

    flex: 1,

    flexDirection: "row",

    marginBottom: 10

  },
  titleContainer: {

    flex: 1,

  },


  boldTitle: {

    fontSize: 20,

    color: "#fff",

    width: "100%",

    marginBottom: 0,

    alignSelf: "left",


    textTransform: "capitalize",

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




});
