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
import { createReview, getReviews, getUser, populateMetadata, like, getLike, unlike, upvoteReview, removeUpvoteFromReview, deleteReview } from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";

import { Audio } from "expo-av";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function SongPage({ route, navigation }) {
  const { track } = route.params;
  const [username, setUsername] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Reviews state
  const [review, setReview] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [selectedEmojis, setSelectedEmojis] = useState([]);
  const [reviews, setReviews] = useState(
    [
      // {
      //   id: "1",
      //   username: "User1",
      //   text: "This song is so catchy!",
      //   upvotes: 3,
      //   upvoted: false,
      //   rating: 5,
      //   userSelectedEmojis: [],
      // },
      // {
      //   id: "2",
      //   username: "User2",
      //   text: "I love the beat on this track.",
      //   upvotes: 5,
      //   upvoted: false,
      //   rating: 4,
      //   userSelectedEmojis: ["🔥"],
      // },
    ]
  );

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For the emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const isFocused = useIsFocused();

  // Add state for progress
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch current user data
  useEffect(() => {
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

  async function populateReviews() {
    let reqReviews = await (await getReviews(track.id)).json()
    setReviews(reqReviews)
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


  // Sort reviews by upvotes desc
  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => b.upvotes - a.upvotes);
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
        // Call the API to like the song
        const response = await like(currentUser.uid, track.id, track.type);
        if (!response.ok) {
          throw new Error("Failed to like the song");
        }
        const data = await response.json();
        console.log("Song liked successfully:", data);
        setLiked(true);
      } else {
        // Call the API to unlike the song
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
  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => setFavourite(!favourite);
  const handleShare = () => console.log("Song shared!");

  // Toggle the dropdown for emoji selection
  const handleEmojiDropdown = () => {
    setShowEmojiDropdown(!showEmojiDropdown);
  };

  // Add tapped emoji to selectedEmojis
  const handleSelectEmoji = (emoji) => {
    setSelectedEmojis((prev) =>
      prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );
  };

  // Confirmation alert on post
  const handleAddReview = () => {
    if (!review.trim()) return;
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
          onPress: () => actuallyAddReview(),
        },
      ],
      { cancelable: true }
    );
  };

  // Actually add the review
  async function actuallyAddReview() {
    const newReview = {
      id: Date.now().toString(),
      listenable_id: track.id,
      hearted: favourite,
      message: review.trim(),
      rating: reviewRating,
      emoji: [...selectedEmojis],
    };

    await createReview(newReview)
    await populateReviews();

    setReview("");
    setReviewRating(0);
    setSelectedEmojis([]);

  };

  const handleUpvote = async (id) => {
    let rev = reviews.find(r => r.id === id)
    if (!rev.upvoted) {
      await upvoteReview(id)
    } else {
      await removeUpvoteFromReview(id)
    }
    setReviews((prev) =>
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

  const handleDelete = async (id) => {
    let rev = reviews.find(r => r.id === id)
    if (rev.isUser) {
      await deleteReview(id)
    }
    setReviews((prev) =>
      prev.filter((r) => r.id !== id)
    );
  }
  //handles playing the preview
  const [sound, setSound] = useState(null); // Add state for managing the sound instance

  const handlePlayPreview = async () => {
    if (track.preview) {
      try {
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
          setProgress(0);
          setIsPlaying(false);
          return;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: track.preview },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.isPlaying) {
            setProgress((status.positionMillis / status.durationMillis) * 100);
          }
          if (status.didJustFinish) {
            setProgress(0);
            setIsPlaying(false);
          }
        });
      } catch (error) {
        console.error("Error playing preview:", error);
        Alert.alert("Error", "Unable to play the song preview.");
      }
    } else {
      Alert.alert("No Preview", "This song does not have a preview available.");
    }
  };

  useEffect(() => {
    // Cleanup the sound instance when the component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // If no track
  if (!track) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.errorText}>No track data found.</Text>
      </View>
    );
  }

  // Fallback if track.image missing
  const trackImage = track.image
    ? { uri: track.image }
    : require("../images/albumImage.jpg");

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => { }} />
      </View>

      <FlatList
        data={getSortedReviews()}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.card}>
            {/* "Song" text in the same style as the track title */}
            <Text style={styles.title}>Song</Text>

            {/* Song Image */}
            <Image source={trackImage} style={styles.image} />

            {/* Song Details */}
            <Text style={styles.title}>{track.name || "Unknown Track"}</Text>
            <Text style={styles.artist}>
              Artist: {track.artist || "Unknown"}
            </Text>
            {track.album && (
              <Text style={styles.album}>Album: {track.album}</Text>
            )}

            {/* Like, Save, Share */}
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

            <TouchableOpacity onPress={handlePlayPreview} style={styles.previewButton}>
              <AnimatedCircularProgress
                size={50}
                width={5}
                fill={progress}
                tintColor={colours.lightblue}
                backgroundColor={colours.bluegrey}
                rotation={0}
              >
                {() => (
                  <Icon
                    name={isPlaying ? "stop" : "play-arrow"}
                    size={30}
                    color="#fff"
                  />
                )}
              </AnimatedCircularProgress>
            </TouchableOpacity>

            {/* Add Review Section */}
            <KeyboardAvoidingView style={styles.reviewInputContainer}>
              <View style={styles.topRow}>
                {/* Left: Favourite */}
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

                {/* Middle: Star rating */}
                <View style={styles.starRatingContainer}>
                  {[...Array(5)].map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setReviewRating(index + 1)}
                    >
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

                {/* Right: selectEmojiIcon tab */}
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

              {/* If showEmojiDropdown, show row of 3 emojis */}
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

              {/* Review + Post */}
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

              {/* If user selected emojis, show them underneath */}
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
          <ReviewCard item={item} handleUpvote={handleUpvote} handleDelete={handleDelete} navigation={navigation} />
        )}
        contentContainerStyle={styles.reviewsContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
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
  // "Song" text in the same style as track title
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
    // You can style the 'emoji tab' differently if you want a special look
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
  reviewEmoji: {
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
  reviewsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  previewButton: {
    backgroundColor: colours.lightblue,
    borderRadius: 10,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  previewButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
