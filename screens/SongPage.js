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
  Linking,
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
const BOTTOM_NAV_HEIGHT = 72;

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
        const currentUser = auth.currentUser;

        if (!currentUser?.uid) {
          Alert.alert(
            "Not signed in",
            "You must be signed in to share music."
          );
          return;
        }

        const response = await getFriends(currentUser.uid);
        const json = await response.json();

        console.log("[SongPage] Friends response:", json);

        if (!response.ok) {
          throw new Error(
            json?.error || "Could not load friends."
          );
        }

        const friends = Array.isArray(json)
          ? json
          : Array.isArray(json?.friends)
            ? json.friends
            : [];

        setFriendsList(friends);
        setSelectedUser(null);
        setComment("");
        setCurrentShareItem(track);
        setModalVisible(true);
      } catch (error) {
        console.error(
          "[SongPage] Could not load friends:",
          error
        );

        setFriendsList([]);

        Alert.alert(
          "Unable to load friends",
          error.message || "Please try again."
        );
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
    const handleShareComment = async () => {
      if (!selectedUser) {
        Alert.alert("Select a friend", "Please select a friend to share with");
        return;
      }

      if (!currentShareItem?.id) {
        Alert.alert("Unable to share", "This music item does not have a valid ID.");
        return;
      }

      try {
        const response = await share(
          selectedUser.userId,
          currentShareItem.record_id || null,
          currentShareItem.id,
          comment,
          currentShareItem.type || "track",
          currentShareItem
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "The music could not be shared.");
        }

        Toast.show({
          type: "success",
          text1: "Shared",
          text2: `Sent to ${selectedUser.username}`,
        });

        closeModal();
      } catch (error) {
        console.error("[SongPage] Share error:", error);
        Alert.alert("Unable to share", error.message || "Please try again.");
      }
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

    /*
     * Always hydrate SongPage from Deezer. Old cards from Feed,
     * Reviews, Likes, Profiles, Search, Albums, and Recently Viewed
     * may contain expired preview URLs.
     */
    const hydrateFreshTrack = async () => {
      const trackId =
        track?.id ||
        track?.listenableId ||
        track?.listenable_id;

      if (!trackId) {
        return;
      }

      try {
        const response = await getSongFromDeezer(
          String(trackId),
          { refresh: true }
        );

        if (!response?.ok) {
          console.warn(
            "[SongPage] Fresh Deezer hydration failed:",
            response?.status
          );
          return;
        }

        const deezerTrack = await response.json();

        setTrack((currentTrack) => ({
          ...currentTrack,
          ...deezerTrack,
          id: String(deezerTrack?.id || trackId),
          listenableId: String(
            deezerTrack?.listenableId ||
            deezerTrack?.id ||
            trackId
          ),
          listenable_id: String(
            deezerTrack?.listenable_id ||
            deezerTrack?.listenableId ||
            deezerTrack?.id ||
            trackId
          ),
          type: "track",
          preview:
            deezerTrack?.preview ||
            deezerTrack?.previewUrl ||
            deezerTrack?.playbackUrl ||
            "",
          previewUrl:
            deezerTrack?.previewUrl ||
            deezerTrack?.preview ||
            deezerTrack?.playbackUrl ||
            "",
          playbackUrl:
            deezerTrack?.playbackUrl ||
            deezerTrack?.preview ||
            deezerTrack?.previewUrl ||
            "",
        }));
      } catch (error) {
        console.warn(
          "[SongPage] Could not hydrate fresh Deezer track:",
          error
        );
      }
    };

    hydrateFreshTrack();

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

  const openFullSongInSpotify =
    async () => {
      const title =
        String(
          track?.title ||
          track?.name ||
          trackName ||
          ""
        ).trim();

      const artist =
        String(
          track?.artistName ||
          track?.artist_name ||
          track?.artist?.name ||
          (
            typeof track?.artist ===
            "string"
              ? track.artist
              : ""
          ) ||
          artistName ||
          ""
        ).trim();

      const searchQuery =
        [title, artist]
          .filter(Boolean)
          .join(" ")
          .trim();

      if (!searchQuery) {
        Alert.alert(
          "Spotify unavailable",
          "This song does not contain enough information to search Spotify."
        );

        return;
      }

      const encodedQuery =
        encodeURIComponent(
          searchQuery
        );

      const spotifyAppUrl =
        `spotify:search:${encodedQuery}`;

      const spotifyWebUrl =
        `https://open.spotify.com/search/${encodedQuery}`;

      try {
        /*
         * On phones, try the installed Spotify app first.
         * If Spotify is not installed or the deep link fails,
         * open the same search on Spotify's website.
         */
        if (
          Platform.OS !== "web"
        ) {
          try {
            await Linking.openURL(
              spotifyAppUrl
            );

            return;
          } catch (appError) {
            console.warn(
              "[SongPage] Spotify app could not open; using web:",
              appError
            );
          }
        }

        await Linking.openURL(
          spotifyWebUrl
        );
      } catch (error) {
        console.error(
          "[SongPage] Could not open Spotify:",
          error
        );

        Alert.alert(
          "Unable to open Spotify",
          "Please try again in a moment."
        );
      }
    };

  const openArtistPage = () => {
  const rawArtist =
    track?.artist;

  const artistObject =
    typeof rawArtist === "object" &&
    rawArtist !== null
      ? rawArtist
      : {};

  const normalizedArtistId = String(
    artistObject.id ||
      artistObject.artistId ||
      artistObject.artist_id ||
      track?.artistId ||
      track?.artist_id ||
      ""
  );

  const normalizedArtistName =
    artistObject.name ||
    track?.artistName ||
    track?.artist_name ||
    artistName ||
    (typeof rawArtist === "string"
      ? rawArtist
      : "") ||
    "Unknown Artist";

  /*
   * Deezer can return the artist image under several
   * different properties depending on the endpoint.
   */
  const normalizedArtistImage =
    artistObject.picture_xl ||
    artistObject.picture_big ||
    artistObject.picture_medium ||
    artistObject.picture_small ||
    artistObject.picture ||
    artistObject.image ||
    artistObject.imageUrl ||
    artistObject.photoURL ||
    track?.artistPicture ||
    track?.artist_picture ||
    track?.artistImage ||
    track?.artist_image ||
    "";

  const normalizedArtist = {
    ...artistObject,

    id: normalizedArtistId,
    artistId: normalizedArtistId,
    artist_id: normalizedArtistId,

    name: normalizedArtistName,
    title: normalizedArtistName,

    picture: normalizedArtistImage,
    picture_xl:
      artistObject.picture_xl ||
      normalizedArtistImage,
    picture_big:
      artistObject.picture_big ||
      normalizedArtistImage,
    picture_medium:
      artistObject.picture_medium ||
      normalizedArtistImage,
    image: normalizedArtistImage,
    imageUrl: normalizedArtistImage,
  };

  if (
    !normalizedArtistId ||
    !normalizedArtistName ||
    normalizedArtistName ===
      "Unknown Artist"
  ) {
    Alert.alert(
      "Artist unavailable",
      "This song does not contain valid artist information."
    );

    return;
  }

  navigation.navigate(
    "ArtistPage",
    {
      artist: normalizedArtist,

      artistId: normalizedArtistId,
      artist_id: normalizedArtistId,

      artistName:
        normalizedArtistName,

      artistImage:
        normalizedArtistImage,

      artistPicture:
        normalizedArtistImage,

      picture:
        normalizedArtistImage,

      image:
        normalizedArtistImage,
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
const [playLoading, setPlayLoading] = useState(false);

const unloadCurrentSound = async () => {
  if (sound) {
    try {
      await sound.unloadAsync();
    } catch (error) {
      console.warn(
        "[SongPage] Could not unload preview:",
        error
      );
    }
  }

  setSound(null);
  setProgress(0);
  setIsPlaying(false);
};

const handlePlayPreview = async () => {
  if (sound) {
    await unloadCurrentSound();
    return;
  }

  if (playLoading) {
    return;
  }

  const trackId =
    track?.id ||
    track?.listenableId ||
    track?.listenable_id;

  if (!trackId) {
    Alert.alert(
      "No Preview",
      "This song does not contain a valid Deezer track ID."
    );
    return;
  }

  setPlayLoading(true);

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

    const fetchFreshPreview = async ({ forceRefresh = false } = {}) => {
      const response =
        await getSongFromDeezer(
          String(trackId),
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

      const preview =
        deezerTrack?.preview ||
        deezerTrack?.previewUrl ||
        deezerTrack?.playbackUrl ||
        "";

      if (!preview) {
        throw new Error(
          "Deezer did not return a preview for this track."
        );
      }

      setTrack((currentTrack) => ({
        ...currentTrack,
        ...deezerTrack,
        id: String(deezerTrack?.id || trackId),
        listenableId: String(
          deezerTrack?.listenableId ||
          deezerTrack?.id ||
          trackId
        ),
        listenable_id: String(
          deezerTrack?.listenable_id ||
          deezerTrack?.listenableId ||
          deezerTrack?.id ||
          trackId
        ),
        type: "track",
        preview,
        previewUrl: preview,
        playbackUrl: preview,
      }));

      return preview;
    };

    const playFreshPreview = async (preview) => {
      const playableUrl =
        `${preview}${
          preview.includes("?")
            ? "&"
            : "?"
        }treble_play=${Date.now()}`;

      const { sound: newSound } =
        await Audio.Sound.createAsync(
          { uri: playableUrl },
          {
            shouldPlay: true,
            volume: previewVolume,
          },
          undefined,
          true
        );

      setSound(newSound);
      setProgress(0);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if (status?.error) {
            console.warn(
              "[SongPage] Playback status error:",
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
          newSound.unloadAsync().catch(() => {});
        }
      });
    };

    let preview =
      await fetchFreshPreview({ forceRefresh: false });

    try {
      await playFreshPreview(preview);
    } catch (firstPlaybackError) {
      console.warn(
        "[SongPage] First fresh preview failed. Retrying:",
        firstPlaybackError
      );

      await unloadCurrentSound();

      preview =
        await fetchFreshPreview({ forceRefresh: true });

      await playFreshPreview(preview);
    }
  } catch (error) {
    console.error(
      "[SongPage] Fresh Deezer playback error:",
      error
    );

    await unloadCurrentSound();

    Alert.alert(
      "Preview unavailable",
      "Treble requested this song directly from Deezer, but Deezer did not provide a playable preview for it."
    );
  } finally {
    setPlayLoading(false);
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

  const trackImageUrl =
    track?.image ||
    track?.coverArt ||
    track?.album?.cover_xl ||
    track?.album?.cover_big ||
    track?.album?.cover_medium ||
    track?.album?.cover ||
    "";

  const trackImage = trackImageUrl
    ? { uri: trackImageUrl }
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


      {/* Back button stays opposite the mobile hamburger and does not
          change the page content width or alignment. */}
      {(isDesktopWeb || !menuOpen) ? (
<TouchableOpacity
        style={[
          styles.pageBackButton,
          isDesktopWeb && styles.desktopPageBackButton,
        ]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Icon
          name="arrow-back"
          size={26}
          color="#ffffff"
        />
      </TouchableOpacity>
      ) : null}

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
                <View
                  style={[
                    styles.detailHeaderRow,
                    isCompact &&
                      styles.detailHeaderRowCompact,
                  ]}
                >
                  <View style={styles.titleContainer}>
                    <Text style={styles.boldTitle}>
                      Song
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.detailActionGroup,
                      isCompact &&
                        styles.detailActionGroupCompact,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleLikeSong();
                      }}
                      style={[
                        styles.detailActionButton,
                        isCompact &&
                          styles.detailActionButtonCompact,
                      ]}
                    >
                      <Image
                        source={
                          liked
                            ? require("../images/whiteFullHeart.png")
                            : require("../images/whiteOpenHeart.png")
                        }
                        style={styles.detailActionIcon}
                      />

                      <Text style={styles.detailActionText}>
                        {liked ? "Liked" : "Like"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleModal(track);
                      }}
                      style={[
                        styles.detailActionButton,
                        isCompact &&
                          styles.detailActionButtonCompact,
                      ]}
                    >
                      <Image
                        source={require("../images/shareIcon.png")}
                        style={styles.detailActionIcon}
                      />

                      <Text style={styles.detailActionText}>
                        Share
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SONG IMAGE */}
                <View style={styles.songArtworkFrame}>
                  <Image
                    source={trackImage}
                    style={[
                      styles.songArtworkImage,
                      isCompact &&
                        styles.songArtworkImageCompact,
                    ]}
                  />

                  <TouchableOpacity
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      handlePlayPreview();
                    }}
                    style={[
                      styles.songPreviewOverlay,
                      playLoading &&
                        styles.songPreviewOverlayLoading,
                    ]}
                    disabled={playLoading}
                    activeOpacity={0.86}
                  >
                    <View
                      style={[
                        styles.songPreviewCircle,
                        isCompact &&
                          styles.songPreviewCircleCompact,
                      ]}
                    >
                    <AnimatedCircularProgress
                      size={isCompact ? 72 : 88}
                      width={5}
                      fill={progress}
                      tintColor={colours.lightblue}
                      backgroundColor="rgba(255,255,255,0.26)"
                      rotation={0}
                    >
                      {() =>
                        playLoading ? (
                          <ActivityIndicator
                            size="small"
                            color="#ffffff"
                          />
                        ) : (
                          <Icon
                            name={
                              isPlaying
                                ? "stop"
                                : "play-arrow"
                            }
                            size={
                              isCompact
                                ? 40
                                : 48
                            }
                            color="#ffffff"
                          />
                        )
                      }
                    </AnimatedCircularProgress>
                    </View>
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
                        openArtistPage();
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

                {/* OPEN FULL SONG IN SPOTIFY */}
                <TouchableOpacity
                  style={[
                    styles.spotifyOpenButton,
                    isCompact &&
                      styles.spotifyOpenButtonCompact,
                  ]}
                  activeOpacity={0.84}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    openFullSongInSpotify();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open full song in Spotify"
                >
                  <Image
                    source={require(
                      "../images/spotifyLogo.png"
                    )}
                    style={
                      styles.spotifyOpenLogo
                    }
                  />

                  <View
                    style={
                      styles.spotifyOpenTextWrap
                    }
                  >
                    <Text
                      style={
                        styles.spotifyOpenTitle
                      }
                    >
                      Open in Spotify
                    </Text>

                    <Text
                      style={
                        styles.spotifyOpenSubtitle
                      }
                    >
                      Listen to the full song
                    </Text>
                  </View>

                  <Icon
                    name="open-in-new"
                    size={20}
                    color="#ffffff"
                  />
                </TouchableOpacity>

                {/* REVIEW OPTIONS */}
                <View
                    style={[
                      styles.detailReviewToolbar,
                      styles.detailReviewToolbarSpacing,
                      isCompact &&
                        styles.detailReviewToolbarCompact,
                    ]}
                  >
                  <View
                      style={[
                        styles.detailHeartZone,
                        isCompact &&
                          styles.detailHeartZoneCompact,
                      ]}
                    >
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
                        style={styles.detailHeartIcon}
                      />
                    </TouchableOpacity>

                    
                  </View>

                  <View
                      style={[
                        styles.detailStarsZone,
                        isCompact &&
                          styles.detailStarsZoneCompact,
                      ]}
                    >
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
                          style={[
                              styles.detailStarIcon,
                              isCompact &&
                                styles.detailStarIconCompact,
                            ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                        styles.detailReactionZone,
                        isCompact &&
                          styles.detailReactionZoneCompact,
                      ]}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      setShowEmojiDropdown(
                        !showEmojiDropdown
                      );
                    }}
                  >
                    <View style={[
                        styles.detailReactionButton,
                        showEmojiDropdown &&
                          styles.detailReactionButtonActive,
                      ]}>
                      <Icon
                        name={
                          showEmojiDropdown
                            ? "sentiment-very-satisfied"
                            : "add-reaction"
                        }
                        size={27}
                        color={
                          showEmojiDropdown
                            ? "#ffffff"
                            : colours.lightblue
                        }
                      />
                    </View>
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
                    placeholder="Write a review"
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

  pageBackButton: {
    position: "absolute",
    top: Platform.OS === "web" ? 18 : -22,
    left: 80,
    right: undefined,
    zIndex: 101,
    elevation: 31,

    width: 46,
    height: 46,
    borderRadius: 23,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 0,
  },

  desktopPageBackButton: {
    top: 18,
    left: DESKTOP_SIDEBAR_WIDTH + 20,
    right: undefined,
  },


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
    alignItems: "center",
    justifyContent: "space-between",

    gap: 16,

    marginBottom: 22,
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
    alignItems: "center",
    justifyContent: "flex-end",

    gap: 12,
  },

  actionButton: {
    minWidth: 132,
    minHeight: 54,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 10,

    paddingHorizontal: 18,
    paddingVertical: 12,

    borderRadius: 16,

    backgroundColor:
      "rgba(53,175,229,0.13)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.42)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,

    elevation: 5,

    ...(
      Platform.OS === "web"
        ? {
            cursor: "pointer",
          }
        : {}
    ),
  },

  actionButtonCompact: {
    minWidth: 104,
    minHeight: 48,

    gap: 8,

    paddingHorizontal: 13,
    paddingVertical: 10,

    borderRadius: 14,
  },

  actionIcon: {
    width: 29,
    height: 29,

    resizeMode: "contain",
  },

  actionText: {
    color: "#ffffff",

    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },

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

    /*
     * Explicitly anchor the preview control to the
     * exact center of the cover artwork.
     */
    top: "50%",
    left: "50%",

    width: 88,
    height: 88,

    marginTop: -44,
    marginLeft: -44,

    borderRadius: 44,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(7,12,20,0.82)",

    borderWidth: 2,
    borderColor:
      "rgba(255,255,255,0.32)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.68,
    shadowRadius: 13,

    elevation: 12,

    ...(
      Platform.OS === "web"
        ? {
            cursor: "pointer",
          }
        : {}
    ),
  },

  compactPlayButton: {
    width: 76,
    height: 76,

    marginTop: -38,
    marginLeft: -38,

    borderRadius: 38,
  },

  playButtonLoading: {
    opacity: 0.88,
  },

  spotifyOpenButton: {
    width: "100%",
    maxWidth: 520,

    alignSelf: "center",

    minHeight: 58,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 16,
    paddingVertical: 10,

    marginTop: 16,
    marginBottom: 2,

    borderRadius: 18,

    backgroundColor:
      "#1DB954",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.14)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,

    elevation: 4,
  },

  spotifyOpenButtonCompact: {
    maxWidth: "100%",

    minHeight: 54,

    marginTop: 14,

    borderRadius: 16,
  },

  spotifyOpenLogo: {
    width: 32,
    height: 32,

    resizeMode: "contain",

    marginRight: 12,
  },

  spotifyOpenTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  spotifyOpenTitle: {
    color: "#ffffff",

    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
  },

  spotifyOpenSubtitle: {
    color:
      "rgba(255,255,255,0.76)",

    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",

    marginTop: 1,
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
    minHeight: 78,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 16,
    paddingVertical: 12,

    borderRadius: 18,

    backgroundColor:
      "rgba(255,255,255,0.045)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.085)",
  },

  reviewControlsCompact: {
    minHeight: 70,

    paddingHorizontal: 8,
    paddingVertical: 10,

    borderRadius: 15,
  },

  favouriteContainer: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",

    gap: 9,
  },

  favouriteContainerCompact: {
    flex: 1,
    flexBasis: 0,
  },

  smallFavIcon: {
    width: 31,
    height: 31,

    resizeMode: "contain",
  },

  favLabel: {
    color: "#ffffff",

    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },

  starRatingContainer: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    flexWrap: "nowrap",
  },

  starRatingContainerCompact: {
    flex: 1,
    flexBasis: 0,

    transform: [
      {
        scale: 0.78,
      },
    ],
  },

  starIcon: {
    width: 32,
    height: 32,

    marginHorizontal: 2,

    resizeMode: "contain",
  },

  selectEmojiTab: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,

    alignItems: "flex-end",
    justifyContent: "center",
  },

  selectEmojiTabCompact: {
    flex: 1,
    flexBasis: 0,
  },

  emojiIconCircle: {
    width: 48,
    height: 48,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 15,

    backgroundColor:
      "rgba(53,175,229,0.14)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.46)",
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

    marginTop: 12,
  },

  reviewInput: {
    flex: 1,

    minHeight: 48,
    maxHeight: 110,

    color: "#ffffff",

    fontSize: 15,

    paddingHorizontal: 14,
    paddingVertical: 12,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.10)",

    borderRadius: 13,

    backgroundColor:
      "rgba(255,255,255,0.055)",

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
      width: "100%",
    },

    modalOverlay: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 18,
      backgroundColor: "rgba(0,0,0,0.76)",
    },

    modalContent: {
      width: "100%",
      maxWidth: "100%",
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
      maxWidth: 520,
      maxHeight: 650,
      padding: 22,
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



  /* =========================================================
     2026 TREBLE DETAIL PAGE REDESIGN
  ========================================================= */

  pageContent: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colours.background || "#101010",
    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",
    top: 0,
    left: DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom: BOTTOM_NAV_HEIGHT,
    minHeight: 0,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 0,
    alignItems: "center",
    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: BOTTOM_NAV_HEIGHT,
    minHeight: 0,
    paddingTop: 76,
    paddingHorizontal: 12,
    paddingBottom: 0,
    overflow: "hidden",
  },

  reviewsList: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
  },

  webReviewsList: {
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    touchAction: "pan-y",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  reviewsContainer: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    paddingBottom: 110,
  },

  desktopReviewsContainer: {
    paddingBottom: 80,
  },

  card: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    overflow: "hidden",
    padding: 24,
    marginBottom: 24,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },

  desktopCard: {
    width: "100%",
    maxWidth: 980,
    padding: 30,
    borderRadius: 30,
  },

  compactCard: {
    padding: 16,
    borderRadius: 22,
  },

  cardInformation: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 18,
    marginBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  titleContainer: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },

  boldTitle: {
    color: colours.lightblue || "#35afe5",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "rgba(53,175,229,0.12)",
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.24)",
  },

  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  actionButton: {
    minWidth: 74,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  actionIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },

  actionText: {
    color: "#ffffff",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    marginTop: 0,
  },

  title: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "900",
    textAlign: "center",
  },

  compactImage: {
    width: "100%",
    height: undefined,
    aspectRatio: 1,
  },

  reviewControls: {
    width: "100%",
    marginTop: 26,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  favouriteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  favLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
  },

  reviewInputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 14,
  },

  reviewInput: {
    flex: 1,
    minHeight: 52,
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    outlineStyle: "none",
  },

  reviewButton: {
    minWidth: 104,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 14,
    backgroundColor: colours.lightblue || "#35afe5",
  },

  reviewButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  reviewCardWrapper: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    marginBottom: 14,
    padding: 3,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.025)",
  },

  noReviewsContainer: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 38,
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  noReviewsTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  noReviewsText: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },

  imageContainer: {
    position: "relative",
    width: "100%",
    maxWidth: 470,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 26,
    backgroundColor: "rgba(53,175,229,0.065)",
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.16)",
  },

  image: {
    width: "100%",
    height: undefined,
    aspectRatio: 1,
    borderRadius: 20,
    resizeMode: "cover",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  playButton: {
    position: "absolute",
    right: 26,
    bottom: 26,
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 33,
    backgroundColor: "rgba(0,0,0,0.74)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
  },

  songDetails: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 12,
  },

  artist: {
    color: colours.lightblue || "#35afe5",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },

  album: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 4,
  },

  ...(Platform.OS === "web"
    ? {
        actionButton: {
          cursor: "pointer",
        },
      }
    : {}),


  /* =========================================================
     FINAL DETAIL PAGE CONTROLS
     Unique names prevent legacy duplicate styles from overriding them.
  ========================================================= */

  detailHeaderRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    gap: 18,

    marginBottom: 22,
    paddingBottom: 18,

    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(255,255,255,0.09)",
  },

  detailHeaderRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",

    gap: 14,
  },

  detailActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",

    gap: 12,
  },

  detailActionGroupCompact: {
    width: "100%",
  },

  detailActionButton: {
    minWidth: 142,
    minHeight: 58,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 10,

    paddingHorizontal: 20,
    paddingVertical: 13,

    borderRadius: 17,

    backgroundColor:
      "rgba(53,175,229,0.14)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.48)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.24,
    shadowRadius: 9,

    elevation: 6,

    ...(
      Platform.OS === "web"
        ? {
            cursor: "pointer",
          }
        : {}
    ),
  },

  detailActionButtonCompact: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: 15,
  },

  detailActionIcon: {
    width: 31,
    height: 31,

    resizeMode: "contain",
  },

  detailActionText: {
    color: "#ffffff",

    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },

  detailReviewToolbar: {
    position: "relative",

    width: "100%",
    minHeight: 82,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 18,
    paddingVertical: 13,

    borderRadius: 18,

    backgroundColor:
      "rgba(255,255,255,0.055)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.10)",
  },

  detailReviewToolbarCompact: {
    minHeight: 72,

    paddingHorizontal: 10,
    paddingVertical: 10,

    borderRadius: 15,
  },

  detailFavouriteZone: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",

    gap: 9,
  },

  detailFavouriteZoneCompact: {
    flex: 1,
    flexBasis: 0,

    gap: 5,
  },

  detailFavouriteIcon: {
    width: 34,
    height: 34,

    resizeMode: "contain",
  },

  detailFavouriteLabel: {
    color: "#ffffff",

    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },

  detailStarsZone: {
    position: "absolute",

    left: "50%",

    width: 190,
    marginLeft: -95,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    flexWrap: "nowrap",

    /*
     * Keep the stars visually centred while allowing
     * the heart and reaction controls to remain tappable.
     */
    pointerEvents: "box-none",
  },

  detailStarsZoneCompact: {
    width: 122,
    marginLeft: -61,
  },

  detailStarIcon: {
    width: 34,
    height: 34,

    marginHorizontal: 2,

    resizeMode: "contain",
  },

  detailStarIconCompact: {
    width: 24,
    height: 24,

    marginHorizontal: 0,
  },

  detailReactionZone: {
    width: 52,
    flexGrow: 0,
    flexShrink: 0,

    alignItems: "flex-end",
    justifyContent: "center",

    marginLeft: "auto",
  },

  detailReactionZoneCompact: {
    width: 48,
    flexGrow: 0,
    flexShrink: 0,
  },

  detailReactionButton: {
    width: 52,
    height: 52,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 16,

    backgroundColor:
      "rgba(53,175,229,0.14)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.48)",
  },

  detailReactionButtonActive: {
    backgroundColor:
      colours.lightblue,

    borderColor:
      colours.lightblue,
  },


  /* =========================================================
     CENTERED SONG PREVIEW
  ========================================================= */

  songArtworkFrame: {
    position: "relative",

    width: "100%",
    maxWidth: 470,
    aspectRatio: 1,

    alignSelf: "center",

    overflow: "hidden",

    borderRadius: 24,

    backgroundColor:
      "rgba(255,255,255,0.05)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.32)",

    marginBottom: 26,
  },

  songArtworkImage: {
    width: "100%",
    height: "100%",

    resizeMode: "cover",
  },

  songArtworkImageCompact: {
    borderRadius: 20,
  },

  songPreviewOverlay: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    alignItems: "center",
    justifyContent: "center",

    zIndex: 10,

    ...(
      Platform.OS === "web"
        ? {
            cursor: "pointer",
          }
        : {}
    ),
  },

  songPreviewOverlayLoading: {
    opacity: 0.9,
  },

  songPreviewCircle: {
    width: 98,
    height: 98,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 49,

    backgroundColor:
      "rgba(5,10,18,0.82)",

    borderWidth: 2,
    borderColor:
      "rgba(255,255,255,0.38)",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.65,
    shadowRadius: 14,

    elevation: 13,
  },

  songPreviewCircleCompact: {
    width: 82,
    height: 82,

    borderRadius: 41,
  },


  /* =========================================================
     REVIEW COMPOSER SPACING + SAVE CONTROL
  ========================================================= */

  detailReviewToolbarSpacing: {
    marginTop: 30,
  },


  /* =========================================================
     HEART / STARS / REACTION TOOLBAR
  ========================================================= */

  detailHeartZone: {
    width: 52,
    flexGrow: 0,
    flexShrink: 0,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",

    marginRight: "auto",
  },

  detailHeartZoneCompact: {
    width: 48,
    flexGrow: 0,
    flexShrink: 0,
  },

  detailHeartIcon: {
    width: 36,
    height: 36,

    resizeMode: "contain",
  },

});
