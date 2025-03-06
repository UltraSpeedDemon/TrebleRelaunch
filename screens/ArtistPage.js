import React, { useState, useEffect } from "react";
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
} from "react-native";
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { getUser } from "../providers/rest";

export default function ArtistPage({ route, navigation }) {
  const { artist } = route.params; // Expecting "artist" from navigation
  const [username, setUsername] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Comments state
  const [comment, setComment] = useState("");
  const [commentRating, setCommentRating] = useState(0);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [comments, setComments] = useState([
    {
      id: "1",
      username: "User1",
      text: "I love this artist’s vibe!",
      upvotes: 3,
      upvoted: false,
      rating: 5,
      userSelectedEmojis: [],
    },
    {
      id: "2",
      username: "User2",
      text: "They have such a unique style.",
      upvotes: 5,
      upvoted: false,
      rating: 4,
      userSelectedEmojis: ["🔥"],
    },
  ]);

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For the emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);

  // 1) Fetch user data
  useEffect(() => {
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
    fetchUserData();
  }, [navigation]);

  // Sort comments by upvotes desc
  const getSortedComments = () => {
    return [...comments].sort((a, b) => b.upvotes - a.upvotes);
  };

  // Handlers
  const handleLikeArtist = () => setLiked(!liked);
  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => setFavourite(!favourite);
  const handleShare = () => console.log("Artist shared!");

  const handleEmojiDropdown = () => {
    setShowEmojiDropdown(!showEmojiDropdown);
  };

  const handleSelectEmoji = (emoji) => {
    setSelectedEmojis((prev) => [...prev, emoji]);
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    Alert.alert(
      "Confirm",
      "Are you sure you want to post?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          style: "default",
          onPress: () => actuallyAddComment(),
        },
      ],
      { cancelable: true }
    );
  };

  const actuallyAddComment = () => {
    const newComment = {
      id: Date.now().toString(),
      username: username || "Anonymous",
      text: comment.trim(),
      upvotes: 0,
      upvoted: false,
      rating: commentRating,
      userSelectedEmojis: [...selectedEmojis],
    };
    setComments((prev) => [...prev, newComment]);
    setComment("");
    setCommentRating(0);
    setSelectedEmojis([]);
  };

  const handleUpvote = (id) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              upvotes: c.upvoted ? c.upvotes - 1 : c.upvotes + 1,
              upvoted: !c.upvoted,
            }
          : c
      )
    );
  };

  // If no artist data
  if (!artist) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.errorText}>No artist data found.</Text>
      </View>
    );
  }

  // Fallback if artist.image missing
  const artistImage = artist.image
    ? { uri: artist.image }
    : require("../images/albumImage.jpg");

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => {}} />
      </View>

      <FlatList
        data={getSortedComments()}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.card}>
            {/* "Artist" text in place of "Song" */}
            <Text style={styles.title}>Artist</Text>

            {/* Artist Image */}
            <Image source={artistImage} style={styles.image} />

            {/* Artist Name */}
            <Text style={styles.title}>{artist.name || "Unknown Artist"}</Text>

            {/* Like, Save, Share */}
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
                <Text style={styles.actionText}>{liked ? "Liked" : "Like"}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSaveToLibrary} style={styles.actionButton}>
                <Image
                  source={
                    savedToLibrary
                      ? require("../images/musicLibraryClosed.png")
                      : require("../images/musicLibraryOpen.png")
                  }
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>
                  {savedToLibrary ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                <Image
                  source={require("../images/shareIcon.png")}
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Add Comment Section */}
            <KeyboardAvoidingView style={styles.commentInputContainer}>
              <View style={styles.topRow}>
                {/* Favourite button */}
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

                {/* Star rating */}
                <View style={styles.starRatingContainer}>
                  {[...Array(5)].map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setCommentRating(index + 1)}
                    >
                      <Image
                        source={
                          index < commentRating
                            ? require("../images/starFullIcon.png")
                            : require("../images/starEmptyIcon.png")
                        }
                        style={styles.starIcon}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Emoji Icon Tab */}
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
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#aaa"
                  value={comment}
                  onChangeText={setComment}
                />
                <TouchableOpacity style={styles.commentButton} onPress={handleAddComment}>
                  <Text style={styles.commentButtonText}>Post</Text>
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
            </KeyboardAvoidingView>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <Image source={require("../images/avatarIcon.png")} style={styles.avatar} />
            <View style={styles.commentContent}>
              <View style={styles.commentHeader}>
                <Text style={styles.username}>{item.username}</Text>
              </View>
              <Text style={styles.commentText}>{item.text}</Text>
              <View style={styles.commentRating}>
                {[...Array(5)].map((_, index) => (
                  <Image
                    key={index}
                    source={
                      index < item.rating
                        ? require("../images/starFullIcon.png")
                        : require("../images/starEmptyIcon.png")
                    }
                    style={styles.commentStar}
                  />
                ))}
              </View>
              {item.userSelectedEmojis && item.userSelectedEmojis.length > 0 && (
                <View style={styles.commentEmojisContainer}>
                  {item.userSelectedEmojis.map((emo, i) => (
                    <Text key={i} style={styles.commentEmoji}>
                      {emo}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleUpvote(item.id)}
              style={styles.upvoteButton}
            >
              <Image
                source={
                  item.upvoted
                    ? require("../images/upvoteIconBlack.png")
                    : require("../images/upvoteIconWhite.png")
                }
                style={styles.upvoteIcon}
              />
              <Text style={styles.upvoteCount}>{item.upvotes}</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.commentsContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

// Identical styling
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
      padding: 20,
      borderRadius: 20,
      marginTop: 110,
      marginHorizontal: 5,
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
    commentInputContainer: {
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
    commentInput: {
      flex: 1,
      backgroundColor: "#fff",
      borderRadius: 10,
      padding: 10,
      fontSize: 16,
      marginRight: 10,
    },
    commentButton: {
      backgroundColor: colours.lightblue,
      borderRadius: 10,
      padding: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    commentButtonText: {
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
    commentCard: {
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
    commentContent: {
      flex: 1,
    },
    commentHeader: {
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
    commentText: {
      fontSize: 14,
      color: "#fff",
      marginVertical: 5,
    },
    commentRating: {
      flexDirection: "row",
      marginTop: 5,
    },
    commentStar: {
      width: 16,
      height: 16,
      marginRight: 2,
    },
    commentEmojisContainer: {
      flexDirection: "row",
      position: "absolute",
      bottom: 10,
      right: 10,
    },
    commentEmoji: {
      fontSize: 16,
      marginLeft: 4,
      color: "#fff",
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
    commentsContainer: {
      paddingHorizontal: 20,
      paddingBottom: 100,
    },
    bottomNavBar: {
      position: "absolute",
      bottom: 0,
      width: "100%",
    },
  }),
});
