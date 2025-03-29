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
  TouchableHighlight,
} from "react-native";
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { createReview, getReviews, getUser, populateMetadata, getLike, unlike, like, upvoteReview, removeUpvoteFromReview, deleteReview, getAlbumSongs, getAlbumSummary } from "../providers/rest";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";
import { Avatar, Icon, ListItem } from "@rneui/base";

export default function AlbumPage({ route, navigation }) {
  const { album } = route.params; // Expecting "album" passed from navigation
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
      //   text: "This album is so catchy!",
      //   upvotes: 3,
      //   upvoted: false,
      //   rating: 5,
      //   userSelectedEmojis: [],
      // },
      // {
      //   id: "2",
      //   username: "User2",
      //   text: "I love the entire tracklist.",
      //   upvotes: 5,
      //   upvoted: false,
      //   rating: 4,
      //   userSelectedEmojis: ["🔥"],
      // },
    ]
  );
  const [users, setUsers] = useState([]);

  // Like, Save, Favourite states
  const [liked, setLiked] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [favourite, setFavourite] = useState(false);

  // For the emoji dropdown
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const [albumSongs, setAlbumSongs] = useState([]);
  const [songExpanded, setSongExpanded] = useState(false);
  const [summary, setSummary] = useState("");
  const isFocused = useIsFocused();

  // 1) Fetch user data
  useEffect(() => {
    try {
      if (isFocused) {
        console.log("Fetching album metadata on mount...");
        populateMetadata(album.type, album.id);
      }
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
    populateReviewsAndSongs();
    fetchUserData();
  }, [navigation, isFocused]);
  
  async function populateReviewsAndSongs() {
    let promises = await Promise.all([
      (await getReviews(album.id)).json(),
      (await getAlbumSongs(album.id)).json(),
      (await getAlbumSummary(album.id)).json()
    ])
    const reqReviews = promises[0]
    const albumSongs = promises[1]
    const summary = promises[2].summary
    setReviews(reqReviews.reviews)
    setUsers(reqReviews.users)
    setAlbumSongs(albumSongs)
    setSummary(summary)
  }

  useEffect(() => {
      async function checkLikeStatus() {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const response = await getLike(currentUser.uid, album.id, album.type);
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
    }, [album.id]);

  // Sort reviews by upvotes desc
  const getSortedReviews = () => {
    return [...reviews].sort((a, b) => b.upvotes - a.upvotes);
  };

  // Handlers
    // Handler logic
    const handleLikeAlbum = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert("Error", "User not logged in");
          return;
        }
        if (!liked) {
          // Call the API to like the song
          const response = await like(currentUser.uid, album.id, album.type);
          if (!response.ok) {
            throw new Error("Failed to like the album");
          }
          const data = await response.json();
          console.log("Album liked successfully:", data);
          setLiked(true);
        } else {
          // Call the API to unlike the song
          const response = await unlike(currentUser.uid, album.id, album.type);
          if (!response.ok) {
            throw new Error("Failed to unlike the album");
          }
          const data = await response.json();
          console.log("Album unliked successfully:", data);
          setLiked(false);
        }
      } catch (error) {
        console.error("Error toggling like status:", error);
        Alert.alert("Error", "Unable to toggle like status");
      }
    };  
  const handleSaveToLibrary = () => setSavedToLibrary(!savedToLibrary);
  const handleToggleFavourite = () => setFavourite(!favourite);
  const handleShare = () => console.log("Album shared!");

  const handleEmojiDropdown = () => {
    setShowEmojiDropdown(!showEmojiDropdown);
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
      "Are you sure you want to post this review?",
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
      listenable_id: album.id,
      hearted: favourite,
      message: review.trim(),
      rating: reviewRating,
      emoji: [...selectedEmojis],
    };

    await createReview(newReview)
    await populateReviewsAndSongs();

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
  
  const navigateToSong = (song) => { 
    navigation.navigate("SongPage", { 
      track: {
        id: parseInt(song.listenableId),
        image: song.coverArt,
        name: song.title,
        artist: album.artist,
        album: album.name,
        type: "track"
      }
    })
  }

  // If no album data
  if (!album) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.errorText}>No album data found.</Text>
      </View>
    );
  }

  // Fallback if album.image missing
  const albumImage = album.image
    ? { uri: album.image }
    : require("../images/albumImage.jpg");

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => {}} />
      </View>

      <FlatList
        data={getSortedReviews()}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.card}>
            {/* "Album" text (like "Song") */}
            <Text style={styles.title}>Album</Text>

            {/* Album Image */}
            <Image source={albumImage} style={styles.image} />

            {/* Album Name */}
            <Text style={styles.title}>{album.name || "Unknown Album"}</Text>
            {/* Show artist if present */}
            <Text style={styles.artist}>
              Artist: {album.artist || "Unknown"}
            </Text>

            {summary &&
              <Text style={styles.summaryText}>{summary}</Text>
            }

            {/* Like, Save, Share */}
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

            <View style={styles.songAccordion}>
                <ListItem.Accordion
                  content={
                    <>
                      <Icon name="audiotrack" size={20} style={{ marginRight: 10}} />
                      <ListItem.Content>
                        <ListItem.Title>Songs</ListItem.Title>
                      </ListItem.Content>
                    </>
                  }
                  isExpanded={songExpanded}
                  onPress={() => {
                    setSongExpanded(!songExpanded);
                  }}
                >
                  {albumSongs.map((song, i) => {
                    return (
                        <ListItem 
                          id={song.listenableId} 
                          key={song.listenableId}
                          bottomDivider 
                          onPress={() => { navigateToSong(song) }}
                          Component={TouchableHighlight}
                        >
                          <Text>{i.toString()}</Text>
                          <ListItem.Content>
                            <ListItem.Title>{song.title}</ListItem.Title>
                          </ListItem.Content>
                          {/* <Avatar source={{ uri: song['coverArt']}}></Avatar> */}
                        </ListItem>
                    )
                  })}
                </ListItem.Accordion>
            </View>

            {/* Review Section */}
            <KeyboardAvoidingView style={styles.reviewInputContainer}>
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
            </KeyboardAvoidingView>
          </View>
        }
        renderItem={({ item }) => {
          let avatar = users.filter(u => u.userId == item.userId)[0].avatarLong
          return (<ReviewCard item={item} avatar={avatar} handleUpvote={handleUpvote} handleDelete={handleDelete} navigation={navigation} />)
        }}
        contentContainerStyle={styles.reviewsContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

// Reuse the same styling as your SongPage, just changing "Song" → "Album" in text
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
    reviewEmoji: {
      fontSize: 16,
      marginLeft: 4,
      color: "#fff",
    },
    summaryText: {
      marginBottom: 7.5,
      color: "#ddd"
    },
    songAccordion: {
      marginTop: 20
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
  }),
});
