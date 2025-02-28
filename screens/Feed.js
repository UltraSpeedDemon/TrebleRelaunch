import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import SearchBar from "../components/SearchBar";

//MusicProject123

export default function Feed({ navigation, route }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedItems, setFeedItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mockComments, setMockComments] = useState([]);

  useEffect(() => {
    const fetchFeedItems = () => {
      const mockPosts = [
        {
          id: "1",
          type: "post",
          name: "Graduation",
          album: { images: [{ url: require("../images/albumImage.jpg") }] },
          artists: [{ name: "Kanye" }],
          rating: 4,
        },
        {
          id: "2",
          type: "post",
          name: "Certified Lover Boy",
          album: { images: [{ url: require("../images/albumImage.jpg") }] },
          artists: [{ name: "Drake" }],
          rating: 5,
        },
        {
          id: "3",
          type: "post",
          name: "Midnights",
          album: { images: [{ url: require("../images/albumImage.jpg") }] },
          artists: [{ name: "Taylor Swift" }],
          rating: 4,
        },
        {
          id: "4",
          type: "post",
          name: "DAMN.",
          album: { images: [{ url: require("../images/albumImage.jpg") }] },
          artists: [{ name: "Kendrick Lamar" }],
          rating: 5,
        },
        {
          id: "5",
          type: "post",
          name: "Astroworld",
          album: { images: [{ url: require("../images/albumImage.jpg") }] },
          artists: [{ name: "Travis Scott" }],
          rating: 5,
        },
      ];
      
      const mockCommentsData = [
        {
          id: "101",
          type: "comment",
          username: "User1",
          text: "This song is so catchy!",
          rating: 5,
          post: mockPosts[0],
        },
        {
          id: "102",
          type: "comment",
          username: "User2",
          text: "Drake's new album is amazing!",
          rating: 4,
          post: mockPosts[1],
        },
        {
          id: "103",
          type: "comment",
          username: "User3",
          text: "The beats on Graduation are incredible!",
          rating: 5,
          post: mockPosts[0],
        },
        {
          id: "104",
          type: "comment",
          username: "User4",
          text: "Taylor's storytelling is unmatched!",
          rating: 5,
          post: mockPosts[2],
        },
        {
          id: "105",
          type: "comment",
          username: "User5",
          text: "Kendrick's flow is amazing on this one.",
          rating: 4,
          post: mockPosts[3],
        },
        {
          id: "106",
          type: "comment",
          username: "User6",
          text: "Astroworld takes me to another planet.",
          rating: 5,
          post: mockPosts[4],
        },
        {
          id: "107",
          type: "comment",
          username: "User7",
          text: "Kanye's production on this is genius.",
          rating: 5,
          post: mockPosts[0],
        },
        {
          id: "108",
          type: "comment",
          username: "User8",
          text: "This album is all I listen to these days!",
          rating: 5,
          post: mockPosts[4],
        },
        {
          id: "109",
          type: "comment",
          username: "User9",
          text: "Midnights hits so differently late at night.",
          rating: 4,
          post: mockPosts[2],
        },
        {
          id: "110",
          type: "comment",
          username: "User10",
          text: "Certified Lover Boy is the perfect vibe.",
          rating: 4,
          post: mockPosts[1],
        },
        {
          id: "111",
          type: "comment",
          username: "User11",
          text: "DAMN. is a lyrical masterpiece.",
          rating: 5,
          post: mockPosts[3],
        },
        {
          id: "112",
          type: "comment",
          username: "User12",
          text: "Kendrick is in his own league with this.",
          rating: 5,
          post: mockPosts[3],
        },
        {
          id: "113",
          type: "comment",
          username: "User13",
          text: "Astroworld's energy is unmatched.",
          rating: 5,
          post: mockPosts[4],
        },
      ];
      

      setMockComments(mockCommentsData);
      setFeedItems([...mockPosts, ...mockCommentsData].sort(() => Math.random() - 0.5));
    };

    fetchFeedItems();
  }, []);

  // Handle new post/comment from CreatePost
  useEffect(() => {
    if (route?.params?.newPost) {
      const newPost = route.params.newPost;
      const newComment = {
        id: Date.now().toString(),
        type: "comment",
        username: newPost.username,
        text: newPost.comment,
        rating: newPost.rating,
        post: {
          id: newPost.id,
          type: "post",
          name: newPost.name,
          album: { images: [{ url: newPost.albumCover }] },
          artists: [{ name: newPost.artist }],
          rating: newPost.rating,
        },
      };

      setMockComments((prevComments) => [newComment, ...prevComments]);
      setFeedItems((prevFeedItems) => [newComment, ...prevFeedItems]);
    }
  }, [route?.params?.newPost]);

  const onRefresh = () => {
    setFeedItems([...feedItems].sort(() => Math.random() - 0.5));
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderFeedItem = ({ item }) => {
    if (item.type === "post") {
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate("Posts", { post: item })}
        >
          <Image source={item.album.images[0].url} style={styles.postImage} />
          <View style={styles.cardContent}>
            <Text style={styles.postTitle}>
              {item.name} <Text style={styles.songTag}>[Song]</Text>
            </Text>
            <Text style={styles.postArtist}>{item.artists[0].name}</Text>
            <View style={styles.ratingContainer}>
              {[...Array(5)].map((_, index) => (
                <Image
                  key={index}
                  source={
                    index < item.rating
                      ? require("../images/starFullIcon.png")
                      : require("../images/starEmptyIcon.png")
                  }
                  style={styles.starIcon}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    } else if (item.type === "comment") {
      return (
        <TouchableOpacity
          style={styles.commentCard}
          onPress={() => navigation.navigate("Posts", { post: item.post })}
        >
          <Image source={item.post.album.images[0].url} style={styles.albumImage} />
          <View style={styles.commentContent}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.commentText}>{item.text}</Text>
            <View style={styles.ratingContainer}>
              {[...Array(5)].map((_, index) => (
                <Image
                  key={index}
                  source={
                    index < item.rating
                      ? require("../images/starFullIcon.png")
                      : require("../images/starEmptyIcon.png")
                  }
                  style={styles.starIcon}
                />
              ))}
            </View>
            <Text style={styles.upvotes}>{item.upvotes} Upvotes</Text>
          </View>
        </TouchableOpacity>
      );
    }
  };

  return (
    <View style={styles.container}>

      {/* Sidebar */}
      <View style={styles.sideMenu}>
                 <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
            </View>

      {/* Search Bar */}
      <SearchBar />

      {/* Notifications Button */}
      <TouchableOpacity
        style={styles.notificationsIcon}
        onPress={() => navigation.navigate("Notifications")}
      >
        <Image
          source={require("../images/notificationsIcon2.png")}
          style={styles.notifIcon}
        />
      </TouchableOpacity>

      {/* Feed List */}
      <View style={styles.content}>
        <Text style={styles.header}>Recent Feed</Text>
        <FlatList
          data={feedItems}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id + Math.random().toString()}
          contentContainerStyle={styles.feedList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Add Post Button */}
      <TouchableOpacity
        style={styles.addPostButton}
        onPress={() => navigation.navigate("CreatePost")}
      >
        <Image
          source={require("../images/addPost.png")}
          style={styles.addPostIcon}
        />
      </TouchableOpacity>

      {/* Bottom Navbar */}
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
  searchBar: {
    position: "absolute",
    width: "70%",
    height: 40,
    top: 70,
    left: "15%",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colours.lightblue,
    backgroundColor: colours.darkblue,
  },
  searchInput: {
    fontSize: 16,
    color: "#fff",
  },
  notificationsIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
  },
  notifIcon: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
    left: 10,
    top: 2,
  },
  content: {
    flex: 1,
    marginTop: 130,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  feedList: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colours.darkblue,
    marginBottom: 20,
    borderRadius: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postImage: {
    width: "50%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardContent: {
    flex: 1,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  songTag: {
    fontSize: 14,
    color: colours.lightblue,
  },
  postArtist: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 10,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  albumImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  commentContent: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  commentText: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  starIcon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  upvotes: {
    fontSize: 14,
    color: "#fff",
    marginTop: 5,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
  addPostButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    backgroundColor: colours.lightblue,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  addPostIcon: {
    width: 30,
    height: 30,
    tintColor: "#fff",
  },
});
