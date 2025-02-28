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
} from "react-native";
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { getUser } from "../providers/rest"; // New REST helper for Orient user data

export default function Posts({ route, navigation }) {
  const { post, setPosts, posts } = route.params;

  const [comment, setComment] = useState("");
  const [commentRating, setCommentRating] = useState(0);
  const [comments, setComments] = useState([
    { id: "1", username: "User1", text: "This song is so catchy!", upvotes: 3, upvoted: false, rating: 5, heartCount: 2, cryCount: 1 },
    { id: "2", username: "User2", text: "I love the beat on this track.", upvotes: 5, upvoted: true, rating: 4, heartCount: 3, cryCount: 0 },
    { id: "3", username: "User3", text: "Not really my vibe, but the artist did a great job!", upvotes: 2, upvoted: false, rating: 3, heartCount: 1, cryCount: 2 },
  ]);
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [username, setUsername] = useState(null);


  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigation.navigate("Home");
          return;
        }
        console.log("[DEBUG] Fetching user data from Orient for UID:", currentUser.uid);
        const response = await getUser(currentUser.uid);
        if (!response.ok) {
          throw new Error("Failed to fetch user data from backend.");
        }
        const userData = await response.json();
        console.log("[DEBUG] Received user data from OrientDB:", userData);
        // Use the username from Orient or fall back to the currentUser displayName
        setUsername(userData.username || currentUser.displayName);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [navigation]);

  const getSortedComments = () => {
    return [...comments].sort((a, b) => b.upvotes - a.upvotes);
  };

  const handleLikeSong = () => {
    setLiked(!liked);
  };

  const handleSaveToLibrary = () => {
    setSavedToLibrary(!savedToLibrary);
  };

  const handleAddComment = () => {
    if (comment.trim() === "") return;
    const newComment = {
      id: Date.now().toString(),
      username: username || "Anonymous",
      text: comment.trim(),
      upvotes: 0,
      upvoted: false,
      rating: commentRating,
      heartCount: 0,
      cryCount: 0,
    };
    setComments((prevComments) => [...prevComments, newComment]);
    setComment("");
    setCommentRating(0);
  };

  const handleUpvote = (id) => {
    setComments((prevComments) =>
      prevComments.map((c) =>
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

  const handleEmojiClick = (emojiType, id) => {
    setComments((prevComments) =>
      prevComments.map((c) =>
        c.id === id ? { ...c, [`${emojiType}Count`]: c[`${emojiType}Count`] + 1 } : c
      )
    );
  };

  const handleShare = () => {
    console.log("Shared the song!");
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => {}} />
      </View>

      {/* Main Content */}
      <FlatList
        data={getSortedComments()}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.card}>
            {/* Post Image */}
            <Image source={{ uri: post.album.images[0].url }} style={styles.image} />

            {/* Post Details */}
            <Text style={styles.title}>{post.name}</Text>
            <Text style={styles.artist}>Artist: {post.artists[0].name}</Text>

            {/* Like, Save, and Share Buttons */}
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

            {/* Add Comment Input */}
            <KeyboardAvoidingView behavior="padding" style={styles.commentInputContainer}>
              {/* Star Rating Above Input */}
              <View style={styles.starRatingContainer}>
                {[...Array(5)].map((_, index) => (
                  <TouchableOpacity key={index} onPress={() => setCommentRating(index + 1)}>
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
            </KeyboardAvoidingView>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <Image source={require("../images/avatarIcon.png")} style={styles.avatar} />
            <View style={styles.commentContent}>
              <View style={styles.commentHeader}>
                <Text style={styles.username}>{item.username}</Text>
                <View style={styles.emojisContainer}>
                  <TouchableOpacity onPress={() => handleEmojiClick("heart", item.id)}>
                    <Text style={styles.emojiCount}>{item.heartCount} ❤️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEmojiClick("cry", item.id)}>
                    <Text style={styles.emojiCount}>{item.cryCount} 😢</Text>
                  </TouchableOpacity>
                </View>
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
            </View>
            <TouchableOpacity onPress={() => handleUpvote(item.id)} style={styles.upvoteButton}>
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

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
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
  card: {
    backgroundColor: colours.darkblue,
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 110,
    marginHorizontal: 5,
    marginBottom: 20,
  },
  image: {
    width: "70%",
    height: 200,
    left: 45,
    borderRadius: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
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
    flexDirection: "column",
    marginTop: 20,
    marginHorizontal: 20,
  },
  starRatingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  starIcon: {
    width: 25,
    height: 25,
    marginHorizontal: 5,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
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
  emojisContainer: {
    flexDirection: "row",
    marginLeft: 10,
    right: 40,
    bottom: 4,
  },
  emojiCount: {
    fontSize: 14,
    color: "#fff",
    marginLeft: 10,
  },
  commentText: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 10,
  },
  commentRating: {
    flexDirection: "row",
  },
  commentStar: {
    width: 16,
    height: 16,
    marginRight: 2,
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
    flexDirection: "row",
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: colours.lightblue,
    marginRight: 10,
  },
});
