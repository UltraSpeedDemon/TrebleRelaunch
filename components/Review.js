import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import colours from "../styles/colours";
import { getComments, getUser, addComment, deleteComment } from "../providers/rest"; // Import the API function
import { auth } from '../utils/firebase';

import ArtistListenables from "../screens/ArtistListenables";

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const ReviewCard = ({
  item,
  avatar = null,
  handleUpvote,
  handleDelete,
  navigation,
  // NEW PROPS for toggling comments/reply on/off
  showComments = true,
  showReplyInput = true,
}) => {

  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false); // To manage loading state while posting a reply
  const [refresh, setRefresh] = useState(false);  // Add the refresh state

  useEffect(() => {
    async function fetchComments() {
      try {
      const currentUser = auth.currentUser;
      // Fetch user data from your backend
      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error('Failed to fetch user data from backend.');
      }
      const userData = await orientRes.json();
        const response = await getComments(item.id, userData.rid);
        const responseText = await response.text();
        console.log("Raw response:", responseText);

        if (response.ok) {
          const data = JSON.parse(responseText);
          console.log("Fetched comments data:", data);
          setComments(data || []);
        } else {
          console.error("Error: Received non-OK response");
          console.log("Error details:", responseText);
          setComments([]);
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    }

    fetchComments();
  }, [item.id, refresh]); // Fetch comments when the item ID changes

  // Format createdAt to show only the date (no time)
  const createdAtText = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString()
    : "";

  // Confirm deletion of review
  const handleDeleteReview = (itemId) => {
    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this post?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "default", onPress: () => handleDelete(itemId) },
      ],
      { cancelable: true }
    );
  };

  const confirmReply = () => {
    if (replyText && replyText.trim()) {
      Alert.alert(
        "Confirm Reply",
        "Are you sure you want to post this reply?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Post", style: "default", onPress: handlePostReply },
        ]
      );
    }
  };

  const handleDeletePost = async (postId) => {

    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this post?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", style: "default", onPress: () => handleDeleteComment(postId) },
      ],
      { cancelable: true }
    );
  }
  const handleDeleteComment = async (id) => {
    let post = comments.find(c => c.id === id)
    if (post.isUser) {
      await deleteComment(id)
      setRefresh((prev) => !prev);  // Toggle the refresh state to trigger useEffect again
    }

  }

  const handlePostReply = async () => {
    if (!replyText.trim()) {
      Alert.alert("Error", "Reply message cannot be empty!");
      return;
    }
      const currentUser = auth.currentUser;
    try {
      // Fetch user data from your backend
      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error('Failed to fetch user data from backend.');
      }
      const userData = await orientRes.json();

      const response = await addComment(userData.rid, item.id, replyText); // Send the reply to the API

      if (response.status === 201) {
        setReplyText(""); // Clear the reply input field
        // After posting the comment, refresh the comments list
        setRefresh((prev) => !prev);  // Toggle the refresh state to trigger useEffect again
      } else {
        throw new Error("Failed to post reply");
      }
    } catch (error) {
      console.error("Error posting reply:", error);
      Alert.alert("Error", "Failed to post your reply.");
    } finally {
      setLoading(false);
    }
  };

  // console.log("item", item);
  // When the content area is pressed, navigate based on the enriched song data.
  const handleContentPress = () => {
    if (item.song.type != undefined) {
      switch (item.song.type) {
        case "track":
          navigation.navigate("SongPage", { track: item.song });
          break;
        case "album":
          navigation.navigate("AlbumPage", { album: item.song });
          break;
        case "artist":
          navigation.navigate("ArtistPage", { artist: item.song });
          break;
        default:
          navigation.navigate("SongPage", { track: item.song });
          break;
      }
    }
  };

  return (
    <View style={styles.reviewCard}>
      <View style={[styles.row, styles.reviewContent]}>
        <Image
          source={avatar ? { uri: avatar } : require("../images/avatarIcon.png")}
          style={styles.avatar}
        />

        <TouchableOpacity
          onPress={handleContentPress}
          activeOpacity={0.8}
          style={styles.contentTouchable}
        >
          <View style={styles.contentContainer}>
            <View>
              {/* Inline container for username, heart and emojis */}
              <View style={styles.inlineContainer}>
                <Text style={styles.username}>{capitalize(item.username)}</Text>
                {item.hearted && (
                  <Image
                    source={require("../images/whiteFullHeart.png")}
                    style={styles.heartEmoji}
                  />
                )}
                {item.userSelectedEmojis && item.userSelectedEmojis.length > 0 ? (
                  item.userSelectedEmojis.map((emo, i) => (
                    <Text key={i} style={styles.reviewEmoji}>
                      {emo.replaceAll("'", "")}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.emptyEmojiSpace}> </Text>
                )}
              </View>
              <Text style={styles.reviewText}>{item.text}</Text>
            </View>
              <View style={styles.reviewInfoContainer}>
                <View style={[styles.row, styles.rateAndAction]}>
                  <View style={styles.reviewRating}>
                    {[...Array(5)].map((_, index) => (
                      <Image
                        key={index}
                        source={
                          index < item.rating
                            ? require("../images/starFullIcon.png")
                            : require("../images/starEmptyIcon.png")
                        }
                        style={styles.reviewStar}
                      />
                    ))}
                  </View>

                  {/* Delete / Edit Buttons (if review belongs to the user) */}
                  {item.isUser && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={() => handleDeleteReview(item.id)}
                        style={styles.trashButton}
                      >
                        <Image
                          source={require("../images/trash.png")}
                          style={styles.upvoteIcon}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate("UpdateReview", { review: item })
                        }
                        style={styles.editPencil}
                      >
                        <Image
                          source={require("../images/editPencil.png")}
                          style={styles.upvoteIcon}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                
                {/* Only show reply input if showReplyInput is true */}
                {showReplyInput && (
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={10} // adjust as needed
                  >
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Write a reply..."
                      placeholderTextColor="#CCC"
                      value={replyText}
                      onChangeText={setReplyText}
                      editable={!loading} // Disable input while posting
                    />
                    <TouchableOpacity
                      onPress={confirmReply}
                      style={styles.replyButton}
                      disabled={loading}
                    >
                      <Text style={styles.replyText}>Reply</Text>
                    </TouchableOpacity>
                  </KeyboardAvoidingView>
                )}
              </View>
              
              <View style={styles.infoAndDateContainer}>  
                {item.song && (
                  <View style={styles.songInfoContainer}>
                    <Text style={styles.songTitle}>
                      {" "}
                      {item.song.type === "album"
                        ? item.song.title
                        : item.song.name}{" "}
                      
                      {item.song.type === "track"
                        ? "(Song)"
                        : item.song.type === "album"
                        ? "(Album)"
                        : item.song.type === "artist"
                        ? "(Artist)"
                        : ""}
                      
                    </Text>
                  </View>
                )}

              </View>
              <View style={styles.dateContainer}>
                <Text style={styles.reviewDate}>{createdAtText}</Text>
              </View>
          </View>
        </TouchableOpacity>

        
      </View>

      {/* Upvote Button */}
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

      {/* Only show comments if showComments is true */}
      {showComments && (
        <View style={styles.commentsContainer}>
          {comments.length > 0 ? (
            comments.map((comment, index) => (
              <CommentCard key={index} comment={comment} onDelete={handleDeletePost} />
            ))
          ) : (
            // If no comments, you could display something like "No comments yet"
            <></>
          )}
        </View>
      )}
    </View>
  );
};

const CommentCard = ({ comment, onDelete }) => (
  <View style={styles.commentCard}>
    <View style={[styles.row, styles.alignItemsCenter]}>
      <Image source={comment.avatar != "" ? { uri: comment.avatar } : require("../images/avatarIcon.png") } style={styles.commentAvatar} />
      <View style={styles.commentTextContainer}>
        <Text style={styles.accountName}>{capitalize(comment.username)}</Text>
        <Text style={styles.commentText}>{comment.message}</Text>
      </View>
    </View>

    {comment.isUser && (
      <TouchableOpacity onPress={() => onDelete(comment.id)} style={styles.commentTrashButton}>
        <Image source={require("../images/trash.png")} style={styles.icon} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row"
  },
  alignItemsCenter: {
    alignItems: "center"
  },
  reviewContent: {
    minHeight: 100
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10
  },
  rateAndAction: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5
  },
  reviewCard: {
    flexDirection: "column",
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    paddingBottom: 30, // Reserve space for the date
    marginBottom: 10,
    alignItems: "flex-start",
    position: "relative",
    minHeight: 100,
  },
  contentTouchable: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    marginTop: 5,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  username: {
    fontSize: 14,
    marginRight: 10,
    fontWeight: "bold",
    color: "#64B5F6",
  },
  reviewText: {
    fontSize: 14,
    color: "#FFF",
    marginVertical: 5,
    paddingRight: 20,
  },
  infoAndDateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  reviewInfoContainer: {
    flex: 1,
    flexDirection: "column",
  },
  reviewRating: {
    flexDirection: "row",
  },
  heartEmoji: {
    width: 16,
    height: 16,
    marginRight: 7.5,
  },
  reviewStar: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
  },
  reviewEmoji: {
    fontSize: 12,
    marginRight: 2,
    color: "#FFF",
  },
  emptyEmojiSpace: {
    height: 20,
  },
  songInfoContainer: {
    marginTop: 5,
  },
  songTitle: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#90CAF9",
  },
  songSummary: {
    fontSize: 12,
    color: "#B0BEC5",
  },
  dateContainer: {
    justifyContent: "flex-end",
  },
  reviewDate: {
    fontSize: 12,
    color: "#FFF",
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
    color: "#FFF",
  },
  hearted: {
    fontSize: 14,
    marginRight: 5,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  heartEmoji: {
    width: 15,
    height: 15,
    marginRight: 10,
  },
  reviewEmoji: {
    marginRight: 4,
    fontSize: 13,
    // your emoji text styling
  },
  emptyEmojiSpace: {
  
    width: 20,
  },
  // ...rest of your styles
  commentsContainer: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginTop: 10
  },
  replyButton: {
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#64B5F6",
    borderRadius: 5,
  },
  replyText: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "bold",
  },
  commentCard: {
    backgroundColor: colours.lightblue,
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // Moves delete button to the right
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  commentTextContainer: {
  },
  commentTrashButton: {
    marginLeft: 10, // Adds spacing from the text
  },
  reviewRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  replyInput: {
    marginTop: 10,
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 5,
    padding: 5,
    color: "#000",
  },
  icon: {
    width: 20,
    height: 20,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "bold"
  },
  commentText: {
    maxWidth: 120
  }
});

export default ReviewCard;