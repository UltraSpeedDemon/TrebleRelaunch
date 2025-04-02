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
import { auth } from "../utils/firebase";
import Toast from 'react-native-toast-message';
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { getUser, populateMetadata, getLike, unlike, like, postRecommendations, createReview, getReviews, upvoteReview, removeUpvoteFromReview, deleteReview, getFriends, share } from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";
import { Icon, ListItem } from "@rneui/base";

export default function ArtistPage({ route, navigation }) {
  const { artist } = route.params;
  const [username, setUsername] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Reviews state
  const [review, setReview] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    console.log("SongPage mounted with track:", artist);
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
    let reqReviews = await (await getReviews(artist.id)).json();
    setReviews(reqReviews.reviews);
    setUsers(reqReviews.users);
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
        const response = await getLike(currentUser.uid, artist.id, artist.type);
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
  }, [artist.id]);

  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => b.upvotes - a.upvotes);
  };

  const handleLikeArtist = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "User not logged in");
        return;
      }
      if (!liked) {
        const response = await like(currentUser.uid, artist.id, artist.type);
        if (!response.ok) throw new Error("Failed to like the artist");
        const data = await response.json();
        console.log("Artist liked successfully:", data);
        setLiked(true);
        try {
          const recResponse = await postRecommendations(
            currentUser.uid,
            artist.id,
            artist.type,
            "",
            artist.name
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
        const response = await unlike(currentUser.uid, artist.id, artist.type);
        if (!response.ok) throw new Error("Failed to unlike the artist");
        const data = await response.json();
        console.log("Artist unliked successfully:", data);
        setLiked(false);
      }
    } catch (error) {
      console.error("Error toggling like status:", error);
      Alert.alert("Error", "Unable to toggle like status");
    }
  };

  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => setFavourite(!favourite);
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
    if (!review.trim()) return;
    Alert.alert(
      "Confirm",
      "Are you sure you want to post?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "default", onPress: () => actuallyAddReview() },
      ],
      { cancelable: true }
    );
  };

  const actuallyAddReview = async () => {
    const newReview = {
      id: Date.now().toString(),
      listenable_id: artist.id,
      hearted: favourite,
      message: review.trim(),
      rating: reviewRating,
      emoji: [...selectedEmojis],
    };
    await createReview(newReview);
    await populateReviews();
    setReview("");
    setReviewRating(0);
    setSelectedEmojis([]);
  };

  const handleUpvote = async (id) => {
    let rev = reviews.find((r) => r.id === id);
    if (!rev.upvoted) {
      await upvoteReview(id);
    } else {
      await removeUpvoteFromReview(id);
    }
    setReviews((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, upvotes: c.upvoted ? c.upvotes - 1 : c.upvotes + 1, upvoted: !c.upvoted }
          : c
      )
    );
  };

  const handleDelete = async (id) => {
    let rev = reviews.find((r) => r.id === id);
    if (rev.isUser) {
      await deleteReview(id);
    }
    setReviews((prev) => prev.filter((r) => r.id !== id));
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
    <View
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={10}
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
                    Artist
                  </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleLikeArtist} style={styles.actionButton}>
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
                <TouchableOpacity onPress={() => handleModal(artist)} style={styles.actionButton}>
                  <Image
                    source={require("../images/shareIcon.png")}
                    style={styles.actionIcon}
                  />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Artist Image */}
            <Image source={artistImage} style={styles.image} />
            <Text style={styles.title}>{artist.name || "Unknown Artist"}</Text>
            
            <TouchableOpacity onPress={() => {navigateToListenablePage("track")}}>
              <ListItem containerStyle={{
                borderRadius: 10,
                overflow: 'hidden',
                marginTop: 20
                }}>
                <Icon name="audiotrack" size={20} />
                <ListItem.Content>
                  <ListItem.Title style={{ borderRadius: 10}}>Songs</ListItem.Title>
                </ListItem.Content>
                <ListItem.Chevron />
              </ListItem>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => {navigateToListenablePage("album")}}>
              <ListItem containerStyle={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  marginTop: 20
                  }}>
                <Icon name="album" size={20} />
                <ListItem.Content>
                  <ListItem.Title>Albums</ListItem.Title>
                </ListItem.Content>
                <ListItem.Chevron />
              </ListItem>
            </TouchableOpacity>

            {/* Add Review Section */}
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
                  <TouchableOpacity onPress={() => handleSelectEmoji("❤️")}>
                    <Text style={styles.reviewEmoji}>❤️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectEmoji("🔥")}>
                    <Text style={styles.reviewEmoji}>🔥</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectEmoji("👏")}>
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
                <TouchableOpacity style={styles.reviewButton} onPress={handleAddReview}>
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
          </View>
          </TouchableWithoutFeedback>
        }
        renderItem={({ item }) => {
          let avatar = users.filter((u) => u.userId === item.userId)[0].avatarLong;
          return (
            <ReviewCard
              item={item}
              avatar={avatar}
              handleUpvote={handleUpvote}
              handleDelete={handleDelete}
              navigation={navigation}
            />
          );
        }}
        contentContainerStyle={styles.reviewsContainer}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...StyleSheet.create({
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
  
  }),
});
