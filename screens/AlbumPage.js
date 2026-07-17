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
  TouchableHighlight,
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
import { Avatar, Icon, ListItem } from "@rneui/base";
import { Audio } from "expo-av";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

export default function AlbumPage({ route, navigation }) {
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
    try {
      if (currentPreview === previewUrl && sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setProgress(0);
        setCurrentPreview(null);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      setCurrentPreview(previewUrl);

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

      const [
        reviewsData,
        songsData,
        summaryData,
      ] = await Promise.all([
        reviewsResponse.json(),
        songsResponse.json(),
        summaryResponse.json(),
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

      setReviews(loadedReviews);
      setUsers([]);
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
        const response = await getFriends(auth.currentUser.uid);
        const json = await response.json();
        setFriendsList(json);
        setCurrentShareItem(album);
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
        ? "Do you want to update your existing album review?"
        : "Are you sure you want to post this album review?",
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

        artist: {
          name:
            song.artist?.name ||
            song.artist ||
            artistName,
        },

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

  const albumImage = album.image
    ? { uri: album.image }
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
                                  Album
                                </Text>
                            </View>
                            <View style={styles.actionButtons}>
                              <TouchableOpacity onPress={handleLikeAlbum} style={styles.actionButton}>
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
                              <TouchableOpacity onPress={() => handleModal(album)} style={styles.actionButton}>
                                <Image
                                  source={require("../images/shareIcon.png")}
                                  style={styles.actionIcon}
                                />
                                <Text style={styles.actionText}>Share</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

              {/* Album Image */}
              <Image source={albumImage} style={styles.image} />

              {/* Album Name */}
              <Text style={styles.title}>{(album.name || album.title) || "Unknown Album"}</Text>
              {/* Show artist if present */}
              <Text style={styles.artist}>
                Artist: {
                  typeof album.artist === "string"
                    ? album.artist
                    : album.artist?.name ||
                      "Unknown"
                }
              </Text>

              {summary &&
                <Text style={styles.summaryText}>{summary}</Text>
              }

              <View style={styles.songAccordion}>
                {
                  !songsLoading 
                  ?
                    <View style={styles.roundedWrapper}>
                      <ListItem.Accordion
                        content={
                          <>
                            <Icon name="audiotrack" size={20} style={{ borderRadius: 10, marginRight: 10}} />
                            <ListItem.Content>
                              <ListItem.Title>Songs</ListItem.Title>
                            </ListItem.Content>
                          </>
                        }
                        isExpanded={songExpanded}
                        onPress={() => {
                          setSongExpanded(!songExpanded);
                        }}
                        style={{ marginTop: 20 }}
                      >
                        {albumSongs.map((song, i) => (
                          <ListItem 
                            id={song.listenableId} 
                            key={song.listenableId}
                            bottomDivider 
                            onPress={() => { navigateToSong(song) }}
                            Component={TouchableHighlight}
                          >
                            <View style={styles.songRow}>
                              {/* Song Number */}
                              <Text style={styles.songNumber}>{i + 1}</Text>

                              {/* Song Title */}
                              <Text style={styles.songTitle}>{song.title}</Text>

                              {/* Preview Button */}
                              {song.preview && (
                                <TouchableOpacity
                                  onPress={() => handlePlayPreview(song.preview)}
                                  style={styles.playButton}
                                >
                                  <AnimatedCircularProgress
                                    size={40}
                                    width={4}
                                    fill={currentPreview === song.preview ? progress : 0}
                                    tintColor={colours.secondaryblue}
                                    backgroundColor={colours.bluegrey}
                                    rotation={0}
                                  >
                                    {() => (
                                      <MaterialIcons
                                        name={
                                          currentPreview === song.preview && isPlaying
                                            ? "stop"
                                            : "play-arrow"
                                        }
                                        size={24}
                                        color="#fff"
                                      />
                                    )}
                                  </AnimatedCircularProgress>
                                </TouchableOpacity>
                              )}
                            </View>
                          </ListItem>
                        ))}
                      </ListItem.Accordion>
                    </View>
                  :
                    <ActivityIndicator size="large" color="white" />
                }
                  
              </View>
              {/* Review Input Section (same as SongPage) */}
              <View style={styles.reviewInputContainer}>
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
                      <TouchableOpacity key={index} onPress={() => setReviewRating(index + 1)}>
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
                      onPress={() =>
                        handleSelectEmoji("❤️")
                      }
                      style={
                        selectedEmojis.includes("❤️")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>
                        ❤️
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleSelectEmoji("🔥")
                      }
                      style={
                        selectedEmojis.includes("🔥")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>
                        🔥
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleSelectEmoji("👏")
                      }
                      style={
                        selectedEmojis.includes("👏")
                          ? styles.selectedEmojiChoice
                          : styles.emojiChoice
                      }
                    >
                      <Text style={styles.reviewEmoji}>
                        👏
                      </Text>
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
                    !review.trim() && {
                      opacity: 0.5,
                    },
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
            </View>
          </TouchableWithoutFeedback>
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
  ...StyleSheet.create({
    emojiChoice: {
      borderRadius: 8,
      padding: 4,
    },

    selectedEmojiChoice: {
      borderRadius: 8,
      padding: 4,
      backgroundColor:
        "rgba(255,255,255,0.2)",
      borderWidth: 1,
      borderColor: colours.lightblue,
    },
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
      marginHorizontal: 0,
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#fff",
      marginBottom: 10,
      textAlign: "center",
    },
    image: {
      width: "70%",
      height: 200,
      alignSelf: "center",
      borderRadius: 10,
      marginBottom: 20,
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
    summaryText: {
      marginBottom: 7.5,
      color: "#ddd",
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
  
    previewButton: {
      backgroundColor: colours.lightblue,
      padding: 5,
      borderRadius: 5,
      marginLeft: 10,
    },
    previewButtonText: {
      color: "#fff",
      fontWeight: "bold",
    },
    playButton: {
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 25,
      width: 50,
      height: 50,
      marginLeft: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 3,
      elevation: 5,
    },
    songRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    songNumber: {
      fontSize: 16,
      color: "#000",
      width: "10%",
      textAlign: "center",
    },
    songTitle: {
      fontSize: 16,
      color: "#000",
      width: "70%",
      textAlign: "left",
    },
    playButton: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      borderRadius: 20,
      width: 40,
      height: 40,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 3,
      elevation: 5,
    },
    roundedWrapper: {
      borderRadius: 10,
      overflow: 'hidden',
    }
  }),
});
