import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import colours from "../styles/colours";
import { getComments, getUser, addComment, deleteComment } from "../providers/rest"; // Import the API function
import { auth } from '../utils/firebase';

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const ReviewCard = ({ item, avatar = null, handleUpvote, handleDelete, handleReply, navigation }) => {
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
    Alert.alert(
      "Confirm Reply",
      "Are you sure you want to post this reply?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Post", style: "default", onPress: handlePostReply },
      ]
    );
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

  return (
    <View style={styles.reviewCard}>
      <Image source={avatar ? { uri: avatar } : require("../images/avatarIcon.png")} style={styles.avatar} />
      <View style={styles.reviewContent}>
        <Text style={styles.username}>{capitalize(item.username)}</Text>
        <Text style={styles.reviewText}>{item.text}</Text>
        <View style={styles.reviewRatingContainer}>
          <View style={styles.reviewRating}>
            {item.hearted && (
              <Image source={require("../images/whiteFullHeart.png")} style={styles.heartEmoji} />
            )}
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
          <TextInput
            style={styles.replyInput}
            placeholder="Write a reply..."
            placeholderTextColor="#CCC"
            value={replyText}
            onChangeText={setReplyText}
            editable={!loading} // Disable input while posting
          />
          <TouchableOpacity onPress={confirmReply} style={styles.replyButton} disabled={loading}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
        {item.userSelectedEmojis?.length > 0 && (
          <View style={styles.reviewEmojisContainer}>
            {item.userSelectedEmojis.map((emo, i) => (
              <Text key={i} style={styles.reviewEmoji}>
                {emo.replaceAll("'", "")}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.rightButtonsContainer}>
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
        {item.isUser && (
          <>
            <TouchableOpacity onPress={() => handleDeleteReview(item.id)} style={styles.trashButton}>
              <Image source={require("../images/trash.png")} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("UpdateReview", { review: item })} style={styles.editButton}>
              <Image source={require("../images/editPencil.png")} style={styles.icon} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.commentsContainer}>
        {comments.length > 0 ? (
          comments.map((comment, index) => (
            <CommentCard key={index} comment={comment} onDelete={handleDeletePost} />
          ))
        ) : (
          <Text style={styles.noCommentsText}>No comments yet</Text>
        )}
      </View>
    </View>
  );
};

const CommentCard = ({ comment, onDelete }) => (
  <View style={styles.commentCard}>
    <Image source={comment.avatar != "" ? { uri: comment.avatar } : require("../images/avatarIcon.png") } style={styles.commentAvatar} />
    <View style={styles.commentTextContainer}>
      <Text style={styles.accountName}>{capitalize(comment.username)}</Text>
      <Text style={styles.commentText}>{comment.message}</Text>
    </View>

    {comment.isUser && (
      <TouchableOpacity onPress={() => onDelete(comment.id)} style={styles.commentTrashButton}>
        <Image source={require("../images/trash.png")} style={styles.icon} />
      </TouchableOpacity>
    )}
  </View>
);


const styles = StyleSheet.create({
  reviewCard: {
    flexDirection: "column",
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 10,
  },
  heartEmoji: {
    width: 16,
    height: 16,
    marginRight: 7.5,
  },
  reviewContent: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64B5F6",
  },
  reviewText: {
    fontSize: 14,
    color: "#FFF",
    marginVertical: 5,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  reviewStar: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  reviewEmojisContainer: {
    flexDirection: "row",
    marginTop: 7.5,
  },
  reviewEmoji: {
    fontSize: 16,
    marginRight: 4,
    color: "#FFF",
  },

  rightButtonsContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    alignItems: "center",
  },
  upvoteButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  trashButton: {
    marginBottom: 5, // Added spacing between buttons
  },
  editButton: {
    marginBottom: 5,
  },
  icon: {
    width: 20,
    height: 20,
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
  replyButton: {
    marginLeft: 10,
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
    flex: 1, // Ensures text takes up available space
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
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 5,
    padding: 5,
    marginLeft: 10,
    color: "#000",
  },
});

export default ReviewCard;
