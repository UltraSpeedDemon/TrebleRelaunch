import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import colours from "../styles/colours";
import ArtistListenables from "../screens/ArtistListenables";

const capitalize = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const ReviewCard = ({
  item,
  avatar = null,
  handleUpvote,
  handleDelete,
  navigation,
}) => {
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
  console.log("item", item);
  // When the content area is pressed, navigate based on the enriched song data.
  const handleContentPress = () => {
    if (item) {
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
          <View style={styles.infoAndDateContainer}>
            <View style={styles.reviewInfoContainer}>
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
              <Text>  </Text>
              {item.song && (
                <View style={styles.songInfoContainer}>
                  <Text style={styles.songTitle}>
                    {" "}
                    {item.song.type === "album"
                      ? item.song.title
                      : item.song.name}{" "}
                    (
                    {item.song.type === "track"
                      ? "Song"
                      : item.song.type === "album"
                      ? "Album"
                      : item.song.type === "artist"
                      ? "Artist"
                      : ""}
                    )
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.reviewDate}>{createdAtText}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>


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

      {/* Delete / Edit Buttons (if review belongs to the user) */}
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
    marginTop: 5,
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
  trashButton: {
    position: "absolute",
    right: 5,
    top: 60,
  },
  editPencil: {
    position: "absolute",
    right: 5,
    bottom: 5,
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
});

export default ReviewCard;