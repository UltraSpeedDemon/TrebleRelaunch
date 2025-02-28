import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import { getUser } from "../providers/rest"; // Orient endpoints
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

export default function CreatePost({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [postComment, setPostComment] = useState("");
  const [rating, setRating] = useState(0);
  const [username, setUsername] = useState(null);
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigation.navigate("Home");
          return;
        }

        const orientRes = await getUser(currentUser.uid);
        if (!orientRes.ok) {
          throw new Error("Failed to fetch user data from OrientDB.");
        }
        const userData = await orientRes.json();

        setUsername(userData.username || currentUser.displayName);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();

    // Mock songs data
    const mockSongs = [
      {
        id: "1",
        name: "Graduation",
        artist: "Kanye West",
        albumCover: require("../images/albumImage.jpg"),
      },
      {
        id: "2",
        name: "Certified Lover Boy",
        artist: "Drake",
        albumCover: require("../images/albumImage.jpg"),
      },
      {
        id: "3",
        name: "Midnights",
        artist: "Taylor Swift",
        albumCover: require("../images/albumImage.jpg"),
      },
      {
        id: "4",
        name: "DAMN.",
        artist: "Kendrick Lamar",
        albumCover: require("../images/albumImage.jpg"),
      },
    ];
    setSongs(mockSongs);
  }, [navigation]);

  useEffect(() => {
    const showListener = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handlePostSubmit = () => {
    if (!postComment.trim() || !selectedSong) {
      Alert.alert("Error", "Please select a song and enter a comment.");
      return;
    }

    const newPost = {
      id: Date.now().toString(),
      name: selectedSong.name,
      artist: selectedSong.artist,
      albumCover: selectedSong.albumCover,
      username: username,
      comment: postComment,
      rating,
    };

    Alert.alert("Success", "Your post has been created!");
    setPostComment(""); // Clear the input
    setSelectedSong(null); // Clear the selected song
    setRating(0); // Reset rating
    //trim the comment
    newPost.comment = newPost.comment.trim();
    navigation.navigate("Feed", { newPost });
  };

  const renderSongCard = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.songCard,
        selectedSong?.id === item.id && styles.selectedCard,
      ]}
      onPress={() => setSelectedSong(item)}
    >
      <Image source={item.albumCover} style={styles.albumCover} />
      <Text style={styles.songName}>{item.name}</Text>
      <Text style={styles.artistName}>{item.artist}</Text>
    </TouchableOpacity>
  );

  const renderStars = () => (
    <View style={styles.ratingContainer}>
      {[...Array(5)].map((_, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => setRating(index + 1)}
        >
          <Image
            source={
              index < rating
                ? require("../images/starFullIcon.png")
                : require("../images/starEmptyIcon.png")
            }
            style={styles.starIcon}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Create a Review</Text>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for songs..."
            placeholderTextColor="#fff"
            value={searchTerm}
            onChangeText={(text) => setSearchTerm(text)}
          />
          <Image
            source={require("../images/searchIcon.png")}
            style={styles.searchIcon}
          />
        </View>

        {/* Scrollable Songs List */}
        <Text style={styles.sectionTitle}>Select a Song</Text>
        <FlatList
          data={songs.filter((song) =>
            song.name.toLowerCase().includes(searchTerm.toLowerCase())
          )}
          renderItem={renderSongCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.songList}
        />

        {/* Selected Song Section */}
        {selectedSong && (
          <View style={styles.selectedSongContainer}>
            <Text style={styles.selectedSongHeader}>Selected Song:</Text>
            <Text style={styles.selectedSongName}>{selectedSong.name}</Text>
            <Text style={styles.selectedSongArtist}>
              {selectedSong.artist}
            </Text>
          </View>
        )}

        {/* Post Comment */}
        <Text style={styles.sectionTitle}>Write a Comment</Text>
        <TextInput
          style={styles.textInput}
          placeholder="What do you think about this song?"
          placeholderTextColor="#aaa"
          value={postComment}
          onChangeText={(text) => setPostComment(text)}
          multiline
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        {/* Rating */}
        {selectedSong && renderStars()}

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handlePostSubmit}>
          <Text style={styles.submitText}>Post</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      {!keyboardVisible && (
        <View style={styles.bottomNavBar}>
          <BottomNavbar />
        </View>
      )}
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingHorizontal: 20,
    marginTop: 100,
    paddingBottom: 20,
  },
  header: {
    fontSize: 32,
    top: 10,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colours.darkblue,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 20,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  songList: {
    paddingBottom: 10,
  },
  songCard: {
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginRight: 10,
    alignItems: "center",
    paddingVertical: 10,
    width: 150,
    overflow: "hidden",
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: colours.lightblue,
  },
  albumCover: {
    width: "80%",
    height: 100,
    borderRadius: 10,
    marginBottom: 5,
  },
  songName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  artistName: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
  },
  selectedSongContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    bottom: 10,
  },
  selectedSongHeader: {
    fontSize: 16,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  selectedSongName: {
    fontSize: 14,
    color: "#fff",
  },
  selectedSongArtist: {
    fontSize: 12,
    color: "#aaa",
  },
  textInput: {
    width: "100%",
    height: 80,
    borderColor: colours.lightblue,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colours.darkblue,
    color: "#fff",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  starIcon: {
    width: 30,
    height: 30,
    marginHorizontal: 5,
  },
  submitButton: {
    backgroundColor: colours.lightblue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  submitText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
