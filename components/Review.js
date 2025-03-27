import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { getUserByUsername } from "../providers/rest"; // <--- Your function that calls serverGet("users/", { username })
import colours from "../styles/colours";

// Helper to capitalize the first letter.
const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const ReviewCard = ({ item, avatar=null, handleUpvote, handleDelete, navigation }) => {
  // Handle delete confirmation
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

  return (
    <View style={styles.reviewCard}>
      <Image source={avatar ? { uri: avatar } : require("../images/avatarIcon.png")} style={styles.avatar} />
      <View style={styles.reviewContent}>
        <Text style={styles.username}>{capitalize(item.username)}</Text>
        <Text style={styles.reviewText}>{item.text}</Text>
        <View>
          <View style={styles.reviewRating}>
            {item.hearted && (
              <Image
                source={require("../images/whiteFullHeart.png")}
                style={styles.heartEmoji}
              />
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
      </View>

      {/* Upvote Button */}
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

      {/* If the review belongs to the current user, show delete/edit */}
      {item.isUser && (
        <>
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
            onPress={() => navigation.navigate("UpdateReview", { review: item })}
            style={styles.editPencil}
          >
            <Image
              source={require("../images/editPencil.png")}
              style={styles.upvoteIcon}
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    paddingRight: 20,
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
    marginTop: 7.5,
  },
  reviewEmoji: {
    fontSize: 16,
    marginRight: 4,
    color: "#FFF",
  },
  upvoteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  trashButton: {
    position: "absolute",
    right: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  editPencil: {
    position: "absolute",
    right: 5,
    bottom: 15,
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
});

export default ReviewCard;
