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
import { auth } from "../utils/firebase";
import Toast from 'react-native-toast-message';
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import {
  getUser,
  populateMetadata,
  getLike,
  unlike,
  like,
  postRecommendations,
  createReview,
  updateReview,
  getReviews,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
  getFriends,
  share,
  saveRecentlyViewed,
} from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";
import { Icon } from "@rneui/base";

export default function ArtistPage({ route, navigation }) {
    const { width } = useWindowDimensions();

    const DESKTOP_BREAKPOINT = 768;
    const DESKTOP_SIDEBAR_WIDTH = 280;
    
    const isWeb = Platform.OS === "web";
    const isDesktopWeb = isWeb && width >= 768;
    const isMobileWeb = isWeb && width < 768;
    const isCompact = width < 600;

    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
      if (isDesktopWeb) {
        setMenuOpen(true);
      } else {
        setMenuOpen(false);
      }
    }, [isDesktopWeb]);
  const { artist } = route.params;
  const [username, setUsername] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Reviews state
  const [review, setReview] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);
  const [existingReviewId, setExistingReviewId] =
    useState(null);

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
  const recordRecentlyViewed = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser || !artist?.id) {
      return;
    }

    try {
      const response = await saveRecentlyViewed(
        currentUser.uid,
        {
          ...artist,
          id: String(artist.id),
          type: "artist",
          title:
            artist.title ||
            artist.name ||
            "Unknown Artist",
          name:
            artist.name ||
            artist.title ||
            "Unknown Artist",
          image:
            artist.image ||
            artist.picture ||
            artist.coverArt ||
            "",
          coverArt:
            artist.coverArt ||
            artist.image ||
            artist.picture ||
            "",
        }
      );

      if (!response?.ok) {
        const data = await response?.json();

        console.warn(
          "[ArtistPage] Failed to save recently viewed:",
          data
        );
      }
    } catch (error) {
      console.error(
        "[ArtistPage] Recently viewed error:",
        error
      );
    }
  };

  recordRecentlyViewed();
}, [artist?.id]);

  useEffect(() => {
    console.log("[ArtistPage] Mounted with artist:", artist);
    try {
      populateMetadata(artist.type, artist.id);
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
    const response = await getReviews(
      artist.id
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Failed to load artist reviews."
      );
    }

    const loadedReviews = Array.isArray(data)
      ? data
      : Array.isArray(data.reviews)
        ? data.reviews
        : [];

    setReviews(loadedReviews);
    setUsers([]);

    const myExistingReview =
      loadedReviews.find(
        (item) => item.isUser === true
      );

    if (myExistingReview) {
      setExistingReviewId(
        myExistingReview.id
      );

      setFavourite(
        Boolean(myExistingReview.hearted)
      );

      setReviewRating(
        Number(
          myExistingReview.rating || 0
        )
      );

      setSelectedEmojis(
        Array.isArray(
          myExistingReview.emoji
        )
          ? myExistingReview.emoji
          : []
      );

      setReview(
        myExistingReview.message || ""
      );
    } else {
      setExistingReviewId(null);
      setFavourite(false);
      setReviewRating(0);
      setSelectedEmojis([]);
      setReview("");
    }
  } catch (error) {
    console.error(
      "[ArtistPage] Error loading reviews:",
      error
    );

    setReviews([]);
    setUsers([]);
  }
}

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
    handleLikeArtist(); // Use your existing like function
  };

  useEffect(() => {
    async function checkLikeStatus() {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const response = await getLike(
          currentUser.uid,
          String(artist.id),
          "artist"
        );
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
  }, [artist.id, isFocused]);

  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => b.upvotes - a.upvotes);
  };

  const handleLikeArtist = async () => {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert(
          "Error",
          "User not logged in"
        );

        return;
      }

      const artistId = String(artist.id);

      if (!liked) {
        const response = await like(
          currentUser.uid,
          artistId,
          "artist"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Failed to like the artist."
          );
        }

        setLiked(true);

        console.log(
          "[ArtistPage] Artist liked:",
          artistId
        );

        /*
        * Store the artist as a recommendation seed.
        */
        try {
          const recommendationResponse =
            await postRecommendations(
              currentUser.uid,
              artistId,
              "artist",
              artist.name || "",
              artist.name || "",
              "like"
            );

          if (!recommendationResponse?.ok) {
            console.warn(
              "[ArtistPage] Artist liked, but recommendation seed failed."
            );
          }
        } catch (recommendationError) {
          console.warn(
            "[ArtistPage] Recommendation seed error:",
            recommendationError
          );
        }
      } else {
        const response = await unlike(
          currentUser.uid,
          artistId,
          "artist"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Failed to unlike the artist."
          );
        }

        setLiked(false);

        console.log(
          "[ArtistPage] Artist unliked:",
          artistId
        );
      }
    } catch (error) {
      console.error(
        "[ArtistPage] Like error:",
        error
      );

      Alert.alert(
        "Unable to update Like",
        error.message
      );
    }
  };

  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => {
    setFavourite(
      (currentValue) => !currentValue
    );
  };
   // Share modal
    const [modalVisible, setModalVisible] = useState(false);
    const [friendsList, setFriendsList] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [comment, setComment] = useState("");
    const [currentShareItem, setCurrentShareItem] = useState(null);
  
    // -------------------------------------------------------------------------
    //  handleModal (open share modal)
    // -------------------------------------------------------------------------
    const handleModal = async (artist) => {
      try {
        const response = await getFriends(auth.currentUser.uid);
        const json = await response.json();
        setFriendsList(json);
        setCurrentShareItem(artist);
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
        ? "Do you want to update your existing artist review?"
        : "Are you sure you want to post this artist review?",
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
        listenable_id: String(artist.id),
        type: "artist",
        hearted: Boolean(favourite),
        message: reviewText,
        rating: Number(reviewRating),
        emoji: [...selectedEmojis],
      };

      console.log(
        "[ArtistPage] Sending review:",
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

      const responseText =
        await response.text();

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
        "[ArtistPage] Review response:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Backend returned HTTP ${response.status}`
        );
      }

      setExistingReviewId(
        data.id || existingReviewId
      );

      /*
      * Favourite and high-rating artist reviews
      * also influence recommendations.
      */
      if (
        favourite ||
        Number(reviewRating) >= 4
      ) {
        try {
          await postRecommendations(
            auth.currentUser.uid,
            String(artist.id),
            "artist",
            artist.name || "",
            artist.name || "",
            favourite
              ? "favourite"
              : "high-rating"
          );
        } catch (recommendationError) {
          console.warn(
            "[ArtistPage] Review saved, but recommendation seed failed:",
            recommendationError
          );
        }
      }

      await populateReviews();

      Toast.show({
        type: "success",
        text1: existingReviewId
          ? "Review updated"
          : "Review posted",
      });
    } catch (error) {
      console.error(
        "[ArtistPage] Error saving review:",
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
      const response =
        existingReview.upvoted
          ? await removeUpvoteFromReview(id)
          : await upvoteReview(id);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Unable to update upvote."
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
              ? Math.max(
                  0,
                  Number(item.upvotes || 0) - 1
                )
              : Number(item.upvotes || 0) + 1,
          };
        })
      );
    } catch (error) {
      console.error(
        "[ArtistPage] Upvote error:",
        error
      );

      Alert.alert(
        "Unable to update review",
        error.message
      );
    }
  };

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
          data?.error ||
          "Unable to delete review."
        );
      }

      setReviews((previousReviews) =>
        previousReviews.filter(
          (item) => item.id !== id
        )
      );

      setExistingReviewId(null);
      setFavourite(false);
      setReviewRating(0);
      setSelectedEmojis([]);
      setReview("");
    } catch (error) {
      console.error(
        "[ArtistPage] Delete error:",
        error
      );

      Alert.alert(
        "Unable to delete review",
        error.message
      );
    }
  };

  const navigateToListenablePage = (type) => {
    navigation.navigate("ArtistListenables", { type, artist })
  }

  // If no artist data
  if (!artist) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.errorText}>No artist data found.</Text>
      </View>
    );
  }

  const artistImage = artist.image
    ? { uri: artist.image }
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
      {/* =====================================================
          SHARE MODAL
      ===================================================== */}
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
                    isDesktopWeb &&
                      styles.desktopModalContent,
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
                        Share Artist
                      </Text>

                      <Text
                        style={styles.modalSubtitle}
                        numberOfLines={1}
                      >
                        {currentShareItem?.name ||
                          artist?.name ||
                          "Artist"}
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
                        ? "compact-artist-share"
                        : "desktop-artist-share"
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

      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb &&
            styles.desktopSideMenu,
          isMobileWeb &&
            styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={
            isDesktopWeb
              ? true
              : menuOpen
          }
          setMenuOpen={
            isDesktopWeb
              ? () => {}
              : setMenuOpen
          }
          isDesktop={isDesktopWeb}
        />
      </View>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <View
        style={[
          styles.pageContent,
          isDesktopWeb &&
            styles.desktopPageContent,
          isMobileWeb &&
            styles.mobilePageContent,
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
            isDesktopWeb &&
              styles.desktopReviewsContainer,
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
                  isDesktopWeb &&
                    styles.desktopCard,
                  isCompact &&
                    styles.compactCard,
                ]}
              >
                {/* ARTIST HEADER */}
                <View style={styles.cardInformation}>
                  <View style={styles.titleContainer}>
                    <Text style={styles.boldTitle}>
                      Artist
                    </Text>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleLikeArtist();
                      }}
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
                      style={styles.actionButton}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleModal(artist);
                      }}
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

                {/* ARTIST IMAGE */}
                <View style={styles.artistImageContainer}>
                  <Image
                    source={artistImage}
                    style={[
                      styles.image,
                      isCompact &&
                        styles.compactImage,
                    ]}
                  />
                </View>

                {/* ARTIST NAME */}
                <View style={styles.artistDetails}>
                  <Text
                    style={styles.title}
                    numberOfLines={2}
                  >
                    {artist.name ||
                      artist.title ||
                      "Unknown Artist"}
                  </Text>
                </View>

                {/* SONGS AND ALBUMS LINKS */}
                <View style={styles.listenablesContainer}>
                  <TouchableOpacity
                    style={styles.artistLinkRow}
                    activeOpacity={0.8}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      navigateToListenablePage("track");
                    }}
                  >
                    <View style={styles.artistLinkIconContainer}>
                      <Icon
                        name="audiotrack"
                        size={24}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.artistLinkContent}>
                      <Text style={styles.artistLinkText}>
                        Songs
                      </Text>

                      <Text style={styles.artistLinkDescription}>
                        View songs by this artist
                      </Text>
                    </View>

                    <Icon
                      name="chevron-right"
                      size={29}
                      color="rgba(255,255,255,0.58)"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.artistLinkRow}
                    activeOpacity={0.8}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      navigateToListenablePage("album");
                    }}
                  >
                    <View style={styles.artistLinkIconContainer}>
                      <Icon
                        name="album"
                        size={24}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.artistLinkContent}>
                      <Text style={styles.artistLinkText}>
                        Albums
                      </Text>

                      <Text style={styles.artistLinkDescription}>
                        View albums by this artist
                      </Text>
                    </View>

                    <Icon
                      name="chevron-right"
                      size={29}
                      color="rgba(255,255,255,0.58)"
                    />
                  </TouchableOpacity>
                </View>

                {/* REVIEW CONTROLS */}
                <View style={styles.reviewInputContainer}>
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

                  {showEmojiDropdown ? (
                    <View style={styles.emojiDropdownRow}>
                      {["❤️", "🔥", "👏"].map((emoji) => {
                        const isSelected =
                          selectedEmojis.includes(emoji);

                        return (
                          <TouchableOpacity
                            key={emoji}
                            style={[
                              styles.emojiChoice,
                              isSelected &&
                                styles.selectedEmojiChoice,
                            ]}
                            onPress={(event) => {
                              event?.stopPropagation?.();
                              handleSelectEmoji(emoji);
                            }}
                          >
                            <Text style={styles.reviewEmoji}>
                              {emoji}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  <View style={styles.reviewInputRow}>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Add an artist review..."
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
              </View>
            </TouchableWithoutFeedback>
          }
          ListHeaderComponentStyle={styles.listHeader}
          ListEmptyComponent={
            <View style={styles.noReviewsContainer}>
              <Text style={styles.noReviewsTitle}>
                No artist reviews yet
              </Text>

              <Text style={styles.noReviewsText}>
                Be the first person to review this artist.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const user = users.find(
              (userItem) =>
                userItem.userId === item.userId
            );

            const avatar =
              user?.avatarLong ||
              user?.avatar ||
              null;

            return (
              <View style={styles.reviewCardWrapper}>
                <ReviewCard
                  item={item}
                  avatar={avatar}
                  handleUpvote={handleUpvote}
                  handleDelete={handleDelete}
                  navigation={navigation}
                  showComments={false}
                  showReplyInput={false}
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
  /* =====================================================
     PAGE
  ===================================================== */
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colours.background,
  },

  errorText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 10,
  },

  /* =====================================================
     SIDEBAR
  ===================================================== */

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

  /* =====================================================
     PAGE CONTENT AND SCROLLING
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 76,
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
    bottom: 72,

    minHeight: 0,

    paddingTop: 70,
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
    paddingBottom: 115,
  },

  desktopReviewsContainer: {
    paddingBottom: 65,
  },

  listHeader: {
    width: "100%",
  },

  /* =====================================================
     ARTIST CARD
  ===================================================== */

  card: {
    width: "100%",

    alignSelf: "center",

    padding: 18,
    marginBottom: 22,

    borderRadius: 18,

    backgroundColor: colours.darkblue,

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

  /* =====================================================
     ARTIST IMAGE AND DETAILS
  ===================================================== */

  artistImageContainer: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    width: 360,
    height: 360,
    maxWidth: "100%",

    borderRadius: 180,

    resizeMode: "cover",

    backgroundColor: "rgba(255,255,255,0.06)",

    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.08)",
  },

  compactImage: {
    width: 250,
    height: 250,

    borderRadius: 125,
  },

  artistDetails: {
    width: "100%",

    alignItems: "center",

    paddingTop: 18,
    paddingHorizontal: 12,
  },

  title: {
    color: "#ffffff",

    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",

    textAlign: "center",
  },

  /* =====================================================
     SONGS AND ALBUMS LINKS
  ===================================================== */

  listenablesContainer: {
    width: "100%",

    marginTop: 22,

    gap: 12,
  },

  artistLinkRow: {
    width: "100%",
    minHeight: 68,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 15,
    paddingVertical: 12,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",

    borderRadius: 13,

    backgroundColor: colours.foreground,
  },

  artistLinkIconContainer: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 21,

    backgroundColor: "rgba(255,255,255,0.07)",
  },

  artistLinkContent: {
    flex: 1,
    minWidth: 0,

    marginLeft: 13,
  },

  artistLinkText: {
    color: "#ffffff",

    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },

  artistLinkDescription: {
    color: "rgba(255,255,255,0.5)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 1,
  },

  /* =====================================================
     REVIEW CONTROLS
  ===================================================== */

  reviewInputContainer: {
    width: "100%",

    marginTop: 22,
    paddingTop: 17,

    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },

  reviewControls: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",

    borderRadius: 21,

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

  /* =====================================================
     REVIEWS
  ===================================================== */

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

  /* =====================================================
     MOBILE NAVIGATION
  ===================================================== */

  bottomNavBar: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 90,
  },

  /* =====================================================
     SHARE MODAL
  ===================================================== */

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

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",

    borderRadius: 20,

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

  shareButtonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },
});
