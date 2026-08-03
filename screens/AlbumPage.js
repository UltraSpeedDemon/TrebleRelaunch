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
  createReview,
  updateReview,
  getReviews,
  getUser,
  populateMetadata,
  getLike,
  unlike,
  like,
  postRecommendations,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
  getAlbumSongs,
  getAlbumSummary,
  getFriends,
  share,
  getSongFromDeezer,
  saveRecentlyViewed,
} from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";
import {
  Icon
} from "@rneui/base";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

  const DESKTOP_BREAKPOINT = 768;
  const DESKTOP_SIDEBAR_WIDTH = 280;
  const BOTTOM_NAV_HEIGHT = 72;


const cleanArtistName = (value) => {
  const name =
    typeof value === "string"
      ? value.trim()
      : "";

  if (
    !name ||
    name.toLowerCase() === "unknown artist" ||
    name.toLowerCase() === "unknown"
  ) {
    return "";
  }

  return name;
};

export default function AlbumPage({ route, navigation }) {
    const { width } = useWindowDimensions();

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
  const { album } = route.params;
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

  // In-app confirmation modal used on native and web.
  const [confirmation, setConfirmation] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "Post",
    onConfirm: null,
  });

  const openConfirmation = ({
    title,
    message,
    confirmText,
    onConfirm,
  }) => {
    setConfirmation({
      visible: true,
      title,
      message,
      confirmText: confirmText || "Confirm",
      onConfirm,
    });
  };

  const closeConfirmation = () => {
    setConfirmation((current) => ({
      ...current,
      visible: false,
      onConfirm: null,
    }));
  };

  const confirmAction = async () => {
    const action = confirmation.onConfirm;
    closeConfirmation();

    if (typeof action === "function") {
      await action();
    }
  };

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For emoji dropdown, album songs and summary
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const [albumSongs, setAlbumSongs] = useState([]);
  const [songExpanded, setSongExpanded] = useState(false);
  const [songsLoading, setSongsLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const isFocused = useIsFocused();

  useEffect(() => {
    const recordRecentlyViewed = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser || !album?.id) {
        return;
      }

      try {
        const artistName =
          typeof album.artist === "string"
            ? album.artist
            : album.artist?.name || "";

        const response = await saveRecentlyViewed(
          currentUser.uid,
          {
            ...album,
            id: String(album.id),
            type: "album",
            title:
              album.title ||
              album.name ||
              "Unknown Album",
            name:
              album.name ||
              album.title ||
              "Unknown Album",
            artist: artistName
              ? { name: artistName }
              : null,
            image:
              album.image ||
              album.coverArt ||
              album.cover ||
              "",
            coverArt:
              album.coverArt ||
              album.image ||
              album.cover ||
              "",
          }
        );

        if (!response?.ok) {
          const data = await response?.json();

          console.warn(
            "[AlbumPage] Failed to save recently viewed:",
            data
          );
        }
      } catch (error) {
        console.error(
          "[AlbumPage] Recently viewed error:",
          error
        );
      }
    };

    recordRecentlyViewed();
  }, [album?.id]);

  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPreview, setCurrentPreview] = useState(null);

  const handlePlayPreview = async (previewUrl) => {
  if (!previewUrl) {
    Alert.alert(
      "Preview unavailable",
      "This song does not have a preview available."
    );

    return;
  }

  try {
    /*
     * Stop the preview if the same song
     * is clicked again.
     */
    if (
      currentPreview === previewUrl &&
      sound
    ) {
      await sound.unloadAsync();

      setSound(null);
      setIsPlaying(false);
      setProgress(0);
      setCurrentPreview(null);

      return;
    }

    /*
     * Stop any other album preview.
     */
    if (sound) {
      await sound.unloadAsync();

      setSound(null);
      setIsPlaying(false);
      setProgress(0);
      setCurrentPreview(null);
    }

    /*
     * Read the volume saved in Settings.
     */
    const savedVolume =
      await AsyncStorage.getItem(
        "treble_preview_volume"
      );

    const parsedVolume =
      savedVolume !== null
        ? Number(savedVolume)
        : 0.65;

    /*
     * Expo requires a volume between 0 and 1.
     */
    const previewVolume =
      Number.isFinite(parsedVolume)
        ? Math.min(
            1,
            Math.max(
              0,
              parsedVolume
            )
          )
        : 0.65;

    console.log(
      "[AlbumPage] Preview volume:",
      previewVolume
    );

    /*
     * Start the album song preview
     * with the saved volume.
     */
    const { sound: newSound } =
      await Audio.Sound.createAsync(
        {
          uri: previewUrl,
        },
        {
          shouldPlay: true,
          volume: previewVolume,
        }
      );

    setSound(newSound);
    setIsPlaying(true);
    setProgress(0);
    setCurrentPreview(previewUrl);

    newSound.setOnPlaybackStatusUpdate(
      (status) => {
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

        setIsPlaying(
          Boolean(status.isPlaying)
        );

        if (status.didJustFinish) {
          setProgress(0);
          setIsPlaying(false);
          setCurrentPreview(null);
          setSound(null);

          newSound
            .unloadAsync()
            .catch(() => {});
        }
      }
    );
  } catch (error) {
    console.error(
      "[AlbumPage] Preview error:",
      error
    );

    setSound(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentPreview(null);

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
    if (!isFocused && sound) {
      sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setProgress(0);
      setCurrentPreview(null);
    }
  }, [isFocused]);

  // 1) Fetch user data
  useEffect(() => {
    if (isFocused) {
      async function fetchMetadataReviewAndSongs() {
        try {  
          console.log("Fetching album metadata on mount...");
          await populateMetadata(album.type, album.id);
          await populateReviewsAndSongs();
        }
        catch (error) {
          console.error("Error populating metadata:", error);
        }
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

      fetchMetadataReviewAndSongs();
      fetchUserData();
    }
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
            "[AlbumPage] Could not load review user:",
            error
          );

          return reviewItem;
        }
      })
    );
  };

  
  async function populateReviewsAndSongs() {
    setSongsLoading(true);

    try {
      const [
        reviewsResponse,
        songsResponse,
        summaryResponse,
      ] = await Promise.all([
        getReviews(album.id),
        getAlbumSongs(album.id),
        getAlbumSummary(album.id),
      ]);

      const parseJsonResponse = async (
  response,
  label
) => {
  const text = await response.text();

  try {
    return text
      ? JSON.parse(text)
      : {};
  } catch {
    throw new Error(
      `${label} returned invalid JSON. ` +
      `HTTP ${response.status}: ` +
      text.slice(0, 120)
    );
  }
};

    const [
      reviewsData,
      songsData,
      summaryData,
    ] = await Promise.all([
      parseJsonResponse(
        reviewsResponse,
        "Reviews"
      ),
      parseJsonResponse(
        songsResponse,
        "Album songs"
      ),
      parseJsonResponse(
        summaryResponse,
        "Album summary"
      ),
    ]);

      if (!reviewsResponse.ok) {
        throw new Error(
          reviewsData?.error ||
          "Failed to load album reviews."
        );
      }

      if (!songsResponse.ok) {
        throw new Error(
          songsData?.error ||
          "Failed to load album songs."
        );
      }

      const loadedReviews =
        Array.isArray(reviewsData)
          ? reviewsData
          : Array.isArray(reviewsData.reviews)
            ? reviewsData.reviews
            : [];

      const loadedSongs =
        Array.isArray(songsData)
          ? songsData
          : Array.isArray(songsData.songs)
            ? songsData.songs
            : Array.isArray(songsData.data)
              ? songsData.data
              : [];

      const updatedSongs = await Promise.all(
        loadedSongs.map(async (song) => {
          const songId =
            song.listenableId ||
            song.listenable_id ||
            song.id;

          if (!songId || song.preview) {
            return song;
          }

          try {
            const response =
              await getSongFromDeezer(songId);

            const deezerData =
              await response.json();

            if (
              response.ok &&
              deezerData?.preview
            ) {
              return {
                ...song,
                preview: deezerData.preview,
              };
            }
          } catch (error) {
            console.warn(
              `[AlbumPage] Preview failed for ${songId}:`,
              error
            );
          }

          return song;
        })
      );

      const enrichedReviews =
        await enrichReviewUsers(
          loadedReviews
        );

      setReviews(enrichedReviews);
      setUsers(enrichedReviews);
      setAlbumSongs(updatedSongs);
      setSummary(
        summaryData?.summary || ""
      );

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
        "[AlbumPage] Loading error:",
        error
      );

      setReviews([]);
      setUsers([]);
      setAlbumSongs([]);
      setSummary("");

      Alert.alert(
        "Unable to load album",
        error.message
      );
    } finally {
      setSongsLoading(false);
    }
  }

  useEffect(() => {
    async function checkLikeStatus() {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const response = await getLike(
          currentUser.uid,
          String(album.id),
          "album"
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
  }, [album.id, isFocused]);

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
        handleLikeAlbum(); // Use your existing like function
      };

  const handleLikeAlbum = async () => {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert(
          "Error",
          "User not logged in"
        );

        return;
      }

      const albumId = String(album.id);

      const albumTitle =
        album.title ||
        album.name ||
        "";

      const artistName =
        typeof album.artist === "string"
          ? album.artist
          : album.artist?.name || "";

      if (!liked) {
        const response = await like(
          currentUser.uid,
          albumId,
          "album"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Failed to like the album."
          );
        }

        setLiked(true);

        try {
          await postRecommendations(
            currentUser.uid,
            albumId,
            "album",
            albumTitle,
            artistName,
            "like"
          );
        } catch (recommendationError) {
          console.warn(
            "[AlbumPage] Album liked, but recommendation seed failed:",
            recommendationError
          );
        }
      } else {
        const response = await unlike(
          currentUser.uid,
          albumId,
          "album"
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Failed to unlike the album."
          );
        }

        setLiked(false);
      }
    } catch (error) {
      console.error(
        "[AlbumPage] Like error:",
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
    const handleModal = async (album) => {
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

        console.log("[AlbumPage] Friends response:", json);

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
        setCurrentShareItem(album);
        setModalVisible(true);
      } catch (error) {
        console.error(
          "[AlbumPage] Could not load friends:",
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
          currentShareItem.type || "album",
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
        console.error("[AlbumPage] Share error:", error);
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
      title: isUpdating
        ? "Update Album Review?"
        : "Post Album Review?",
      message: isUpdating
        ? "Are you sure you want to update this album review?"
        : "Are you sure you want to post this album review?",
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
        listenable_id: String(album.id),
        type: "album",
        hearted: Boolean(favourite),
        message: reviewText,
        rating: Number(reviewRating),
        emoji: [...selectedEmojis],
      };

      console.log(
        "[AlbumPage] Sending review:",
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

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Backend returned HTTP ${response.status}`
        );
      }

      setExistingReviewId(
        data.id || existingReviewId
      );

      const albumTitle =
        album.title ||
        album.name ||
        "";

      const artistName =
        typeof album.artist === "string"
          ? album.artist
          : album.artist?.name || "";

      if (
        favourite ||
        Number(reviewRating) >= 4
      ) {
        try {
          await postRecommendations(
            auth.currentUser.uid,
            String(album.id),
            "album",
            albumTitle,
            artistName,
            favourite
              ? "favourite"
              : "high-rating"
          );
        } catch (recommendationError) {
          console.warn(
            "[AlbumPage] Review saved, but recommendation seed failed:",
            recommendationError
          );
        }
      }

      await populateReviewsAndSongs();

      Toast.show({
        type: "success",
        text1: existingReviewId
          ? "Review updated"
          : "Review posted",
      });
    } catch (error) {
      console.error(
        "[AlbumPage] Review error:",
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
        "[AlbumPage] Upvote error:",
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
        "[AlbumPage] Delete error:",
        error
      );

      Alert.alert(
        "Unable to delete review",
        error.message
      );
    }
  };

  const navigateToSong = (song) => {
    const songId =
      song.listenableId ||
      song.listenable_id ||
      song.id;

    const artistName =
      typeof album.artist === "string"
        ? album.artist
        : album.artist?.name || "";

    navigation.navigate("SongPage", {
      track: {
        ...song,

        id: String(songId),
        listenableId: String(songId),
        type: "track",

        title:
          song.title ||
          song.name ||
          "Unknown Track",

        name:
          song.name ||
          song.title ||
          "Unknown Track",

        artist: cleanArtistName(
          song.artist?.name ||
          song.artist ||
          artistName
        )
          ? {
              name: cleanArtistName(
                song.artist?.name ||
                song.artist ||
                artistName
              ),
            }
          : null,

        album: {
          id: String(album.id),
          title:
            album.title ||
            album.name ||
            "Unknown Album",
        },

        image:
          song.image ||
          song.coverArt ||
          album.image ||
          album.coverArt ||
          "",

        coverArt:
          song.coverArt ||
          song.image ||
          album.coverArt ||
          album.image ||
          "",

        preview: song.preview || "",
      },
    });
  };

  if (!album) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.errorText}>No album data found.</Text>
      </View>
    );
  }

  const albumImageUrl =
    album?.cover_xl ||
    album?.cover_big ||
    album?.cover_medium ||
    album?.cover ||
    album?.image ||
    album?.coverArt ||
    "";

  const albumImage = albumImageUrl
    ? { uri: albumImageUrl }
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
          APP CONFIRMATION MODAL
      ===================================================== */}
      <Modal
        animationType="fade"
        transparent
        visible={confirmation.visible}
        onRequestClose={closeConfirmation}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconCircle}>
              <MaterialIcons
                name="rate-review"
                size={27}
                color="#ffffff"
              />
            </View>

            <Text style={styles.confirmTitle}>
              {confirmation.title}
            </Text>

            <Text style={styles.confirmMessage}>
              {confirmation.message}
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  styles.confirmCancelButton,
                ]}
                onPress={closeConfirmation}
              >
                <Text style={styles.confirmCancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  styles.confirmSubmitButton,
                ]}
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
                        Share Album
                      </Text>

                      <Text
                        style={styles.modalSubtitle}
                        numberOfLines={1}
                      >
                        {currentShareItem?.name ||
                          currentShareItem?.title ||
                          album?.name ||
                          album?.title ||
                          "Album"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={closeModal}
                      style={styles.modalCloseButton}
                    >
                      <MaterialIcons
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
                        ? "compact-album-share"
                        : "desktop-album-share"
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
                    <MaterialIcons
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


      {/* Back button stays opposite the mobile hamburger and does not
          change the page content width or alignment. */}
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
        <MaterialIcons
          name="arrow-back"
          size={24}
          color="#ffffff"
        />
      </TouchableOpacity>

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
                {/* ALBUM CARD HEADER */}
                <View
                  style={[
                    styles.detailHeaderRow,
                    isCompact &&
                      styles.detailHeaderRowCompact,
                  ]}
                >
                  <View style={styles.titleContainer}>
                    <Text style={styles.boldTitle}>
                      Album
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
                      style={[
                        styles.detailActionButton,
                        isCompact &&
                          styles.detailActionButtonCompact,
                      ]}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleLikeAlbum();
                      }}
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
                      style={[
                        styles.detailActionButton,
                        isCompact &&
                          styles.detailActionButtonCompact,
                      ]}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        handleModal(album);
                      }}
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

                {/* ALBUM IMAGE */}
                <View style={styles.albumImageContainer}>
                  <Image
                    source={albumImage}
                    style={[
                      styles.image,
                      isCompact &&
                        styles.compactImage,
                    ]}
                  />
                </View>

                {/* ALBUM DETAILS */}
                <View style={styles.albumDetails}>
                  <Text
                    style={styles.title}
                    numberOfLines={2}
                  >
                    {album.name ||
                      album.title ||
                      "Unknown Album"}
                  </Text>

                  {cleanArtistName(
                    typeof album.artist === "string"
                      ? album.artist
                      : album.artist?.name
                  ) ? (
                    <Text
                      style={styles.artist}
                      numberOfLines={1}
                    >
                      {cleanArtistName(
                        typeof album.artist === "string"
                          ? album.artist
                          : album.artist?.name
                      )}
                    </Text>
                  ) : null}

                  {summary ? (
                    <Text style={styles.summaryText}>
                      {summary}
                    </Text>
                  ) : null}
                </View>

                {/* SONG ACCORDION */}
                <View style={styles.songAccordion}>
                  {songsLoading ? (
                    <View style={styles.songsLoadingContainer}>
                      <ActivityIndicator
                        size="large"
                        color="#ffffff"
                      />

                      <Text style={styles.songsLoadingText}>
                        Loading album songs...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.roundedWrapper}>
                      <TouchableOpacity
                        style={styles.accordionButton}
                        activeOpacity={0.8}
                        onPress={(event) => {
                          event?.stopPropagation?.();

                          setSongExpanded(
                            (currentValue) =>
                              !currentValue
                          );
                        }}
                      >
                        <View style={styles.accordionHeader}>
                          <MaterialIcons
                            name="audiotrack"
                            size={21}
                            color="#ffffff"
                          />

                          <Text style={styles.accordionTitle}>
                            Songs ({albumSongs.length})
                          </Text>
                        </View>

                        <MaterialIcons
                          name={
                            songExpanded
                              ? "keyboard-arrow-up"
                              : "keyboard-arrow-down"
                          }
                          size={27}
                          color="#ffffff"
                        />
                      </TouchableOpacity>

                      {songExpanded ? (
                        <View style={styles.songList}>
                          {albumSongs.length > 0 ? (
                            albumSongs.map(
                              (song, index) => {
                                const songId = String(
                                  song.listenableId ||
                                    song.listenable_id ||
                                    song.id ||
                                    index
                                );

                                const songTitle =
                                  song.title ||
                                  song.name ||
                                  "Unknown Track";

                                const isCurrentSong =
                                  currentPreview ===
                                  song.preview;

                                return (
                                  <TouchableOpacity
                                    key={`album-song-${songId}-${index}`}
                                    style={styles.songListItem}
                                    activeOpacity={0.8}
                                    onPress={(event) => {
                                      event?.stopPropagation?.();
                                      navigateToSong(song);
                                    }}
                                  >
                                    <View style={styles.songRow}>
                                      <Text style={styles.songNumber}>
                                        {index + 1}
                                      </Text>

                                      <View style={styles.songInformation}>
                                        <Text
                                          style={styles.songTitle}
                                          numberOfLines={1}
                                        >
                                          {songTitle}
                                        </Text>

                                        {song.duration ? (
                                          <Text style={styles.songDuration}>
                                            {song.duration}
                                          </Text>
                                        ) : null}
                                      </View>

                                      {song.preview ? (
                                        <TouchableOpacity
                                          style={styles.songPlayButton}
                                          onPress={(event) => {
                                            event?.stopPropagation?.();

                                            handlePlayPreview(
                                              song.preview
                                            );
                                          }}
                                        >
                                          <AnimatedCircularProgress
                                            size={42}
                                            width={4}
                                            fill={
                                              isCurrentSong
                                                ? progress
                                                : 0
                                            }
                                            tintColor={
                                              colours.secondaryblue
                                            }
                                            backgroundColor="rgba(255,255,255,0.2)"
                                            rotation={0}
                                          >
                                            {() => (
                                              <MaterialIcons
                                                name={
                                                  isCurrentSong &&
                                                  isPlaying
                                                    ? "stop"
                                                    : "play-arrow"
                                                }
                                                size={25}
                                                color="#ffffff"
                                              />
                                            )}
                                          </AnimatedCircularProgress>
                                        </TouchableOpacity>
                                      ) : (
                                        <View style={styles.songPlayPlaceholder} />
                                      )}
                                    </View>
                                  </TouchableOpacity>
                                );
                              }
                            )
                          ) : (
                            <Text style={styles.noSongsText}>
                              No songs were found for this album.
                            </Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>

                {/* REVIEW CONTROLS */}
                <View style={styles.reviewInputContainer}>
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
                        <MaterialIcons
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
                No album reviews yet
              </Text>

              <Text style={styles.noReviewsText}>
                Be the first person to review this album.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const user = users.find(
              (userItem) =>
                userItem.userId === item.userId
            );

            const avatar =
              item?.avatarLong ||
              item?.avatar ||
              item?.userAvatar ||
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

  pageBackButton: {
    position: "absolute",
    top: Platform.OS === "web" ? 52 : 18,
    left: 112,
    right: undefined,
    zIndex: 90,
    elevation: 15,

    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",

    backgroundColor: "rgba(255,255,255,0.10)",
  },

  desktopPageBackButton: {
    top: 20,
    left: DESKTOP_SIDEBAR_WIDTH + 20,
    right: undefined,
  },



  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,0.76)",
  },

  confirmCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.5)",
    backgroundColor: colours.darkblue || "#181f2b",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 12,
  },

  confirmIconCircle: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderRadius: 28,
    backgroundColor:
      colours.lightblue || "#35afe5",
  },

  confirmTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 9,
  },

  confirmMessage: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 23,
  },

  confirmButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },

  confirmButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 11,
  },

  confirmCancelButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  confirmSubmitButton: {
    backgroundColor:
      colours.lightblue || "#35afe5",
  },

  confirmCancelText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  confirmSubmitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
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
    paddingBottom: 115,
  },

  desktopReviewsContainer: {
    paddingBottom: 65,
  },

  listHeader: {
    width: "100%",
  },

  /* =====================================================
     ALBUM CARD
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

  albumImageContainer: {
    width: "100%",
    alignItems: "center",
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

  albumDetails: {
    width: "100%",

    alignItems: "center",

    paddingTop: 18,
    paddingHorizontal: 12,
  },

  title: {
    color: "#ffffff",

    fontSize: 25,
    lineHeight: 32,
    fontWeight: "800",

    textAlign: "center",
  },

  artist: {
    color: "rgba(255,255,255,0.74)",

    fontSize: 17,
    lineHeight: 23,

    textAlign: "center",

    marginTop: 5,
  },

  summaryText: {
    width: "100%",
    maxWidth: 720,

    color: "rgba(255,255,255,0.66)",

    fontSize: 14,
    lineHeight: 22,

    textAlign: "center",

    marginTop: 15,
  },

  /* =====================================================
     SONG ACCORDION
  ===================================================== */

  songAccordion: {
    width: "100%",
    marginTop: 22,
  },

  roundedWrapper: {
    width: "100%",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",

    borderRadius: 13,

    overflow: "hidden",

    backgroundColor: colours.foreground,
  },

  accordionButton: {
    minHeight: 55,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 16,
    paddingVertical: 13,

    backgroundColor: colours.foreground,
  },

  accordionHeader: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",
  },

  accordionTitle: {
    color: "#ffffff",

    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",

    marginLeft: 10,
  },

  songsLoadingContainer: {
    minHeight: 100,

    alignItems: "center",
    justifyContent: "center",
  },

  songsLoadingText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    marginTop: 8,
  },

  songList: {
    width: "100%",
    backgroundColor: colours.darkblue,
  },

  songListItem: {
    width: "100%",

    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",

    backgroundColor: colours.darkblue,
  },

  songRow: {
    minHeight: 62,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  songNumber: {
    width: 32,

    color: "rgba(255,255,255,0.5)",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",
  },

  songInformation: {
    flex: 1,
    minWidth: 0,

    paddingHorizontal: 10,
  },

  songTitle: {
    color: "#ffffff",

    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },

  songDuration: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginTop: 2,
  },

  songPlayButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 22,

    backgroundColor: "rgba(0,0,0,0.52)",
  },

  songPlayPlaceholder: {
    width: 44,
    height: 44,
  },

  noSongsText: {
    color: "rgba(255,255,255,0.65)",

    fontSize: 14,

    textAlign: "center",

    padding: 22,
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

  albumImageContainer: {
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

  albumDetails: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    alignItems: "center",
    paddingTop: 23,
    paddingHorizontal: 12,
  },

  artist: {
    color: colours.lightblue || "#35afe5",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },

  summaryText: {
    maxWidth: 680,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 13,
  },

  songAccordion: {
    width: "100%",
    marginTop: 25,
  },

  roundedWrapper: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  accordionButton: {
    width: "100%",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    paddingVertical: 13,
    backgroundColor: "rgba(53,175,229,0.08)",
  },

  accordionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  songList: {
    width: "100%",
    padding: 8,
  },

  songListItem: {
    width: "100%",
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 3,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  songNumber: {
    width: 30,
    color: "rgba(255,255,255,0.34)",
    fontSize: 11,
    fontWeight: "900",
  },

  songTitle: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  songDuration: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 10,
    marginTop: 2,
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
