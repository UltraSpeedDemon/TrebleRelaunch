import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
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
import { auth } from "../utils/firebase";
import { getRecommendations } from "../providers/rest";

export default function Feed({ navigation, route }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Core feed items (e.g., static comments or posts) that load immediately
  const [feedItems, setFeedItems] = useState([
    // Example static feed content (you can replace this with your actual feed data)
    {
      type: "comment",
      username: "Static User",
      text: "This is a static comment that loads instantly!",
      rating: 4,
      upvotes: 10,
      post: {
        album: { images: [{ url: require("../images/albumImage.jpg") }] },
      },
    },
  ]);
  
  // Recommendations state – will be appended to feedItems when loaded
  const [recommendations, setRecommendations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [onEndReachedCalledDuringMomentum, setOnEndReachedCalledDuringMomentum] = useState(true);
  
  // Pagination state for recommendations
  const [offset, setOffset] = useState(0);
  const [limit] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const fetchedInitial = useRef(false);
  const dummyPost = {
    album: { images: [{ url: require("../images/albumImage.jpg") }] },
  };
  const dummyReview = {
    username: "Top Reviewer",
    text: "Amazing track! A must-listen.",
    rating: 5,
    upvotes: 42,
    post: dummyPost,
  };
  // Function to fetch recommendations from the backend with pagination.
  const fetchRecommendations = async (currentOffset) => {
    try {
      const uid = auth.currentUser.uid;
      const response = await getRecommendations(uid, { limit, offset: currentOffset });
      if (response && response.ok) {
        const data = await response.json();
        return data.recommendations || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      return [];
    }
  };

  // Load initial recommendations in the background.
  const fetchInitialRecommendations = async () => {
    const recs = await fetchRecommendations(0);
    // If you want to shuffle the recommendations, do so here:
    recs.sort(() => Math.random() - 0.5);
    if (recs.length < limit) {
      setHasMore(false);
    }
    setOffset(limit);
    setRecommendations(recs);
  };

  // Load more recommendations on scroll.
  const loadMoreRecommendations = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const newRecs = await fetchRecommendations(offset);
    if (newRecs.length < limit) {
      setHasMore(false);
    }
    // If you want to keep the randomized order consistent, you may
    // decide not to reshuffle additional pages.
    setRecommendations((prev) => [...prev, ...newRecs]);
    setOffset((prev) => prev + limit);
    setLoadingMore(false);
  };

  // On component mount, fetch recommendations asynchronously.
  useEffect(() => {
    if (!fetchedInitial.current) {
      fetchedInitial.current = true;
      fetchInitialRecommendations();
    }
  }, []);

  // When refreshing, re-fetch recommendations (and optionally your feed).
  const onRefresh = async () => {
    setRefreshing(true);
    // You can choose to refresh both core feed and recommendations if needed.
    await fetchInitialRecommendations();
    setRefreshing(false);
  };

  // Combine feed items and recommendations (you can also render them in separate sections).
  const combinedFeed = [...feedItems, ...recommendations];

  // Render feed items.
  const renderFeedItem = ({ item }) => {
    if (item.type === "comment") {
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
            <Text style={styles.upvotes}>{item.upvotes || 0} Upvotes</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // For recommendations (Song or Artist)
    let isSong = false;
    let isArtist = false;
    if (item.title) {
      isSong = true;
    } else if (item.name) {
      isArtist = true;
    }

    let displayName = isArtist ? item.name : item.title;
    let subText = isArtist
      ? item.artistId
        ? `ID: ${item.artistId}`
        : ""
      : item.artist && item.artist.name
      ? item.artist.name
      : "Unknown Artist";

    const imageUri = item.coverArt || "https://via.placeholder.com/250";

    let postContext = "";
    if (item.origin && typeof item.origin === "object") {
      if (isSong) {
        postContext = `Because you like "${item.origin.title}" by ${item.origin.artist}`;
      } else if (isArtist) {
        postContext = `Because you like ${item.origin.name}`;
      }
    } else if (typeof item.origin === "string") {
      postContext = item.origin;
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("Posts", { post: item })}
      >
        {postContext ? <Text style={styles.postContext}>{postContext}</Text> : null}
        <Image source={{ uri: imageUri }} style={styles.postImage} />
        <View style={styles.cardContent}>
          <Text style={styles.postTitle}>{displayName}</Text>
          {subText ? <Text style={styles.postArtist}>{subText}</Text> : null}
          <View style={styles.reviewContainer}>
              <Image
                source={dummyReview.post.album.images[0].url}
                style={styles.albumImage}
              />
              <View style={styles.commentContent}>
                <Text style={styles.username}>{dummyReview.username}</Text>
                <Text style={styles.commentText}>{dummyReview.text}</Text>
                <View style={styles.ratingContainer}>
                  {[...Array(5)].map((_, index) => (
                    <Image
                      key={index}
                      source={
                        index < dummyReview.rating
                          ? require("../images/starFullIcon.png")
                          : require("../images/starEmptyIcon.png")
                      }
                      style={styles.starIcon}
                    />
                  ))}
                </View>
                <Text style={styles.upvotes}>{dummyReview.upvotes} Upvotes</Text>
              </View>
            </View>
        </View>
      </TouchableOpacity>
    );
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
      {notificationsCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {notificationsCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Feed List */}
      <View style={styles.content}>
        <Text style={styles.header}>Recent Feed</Text>
        <FlatList
          data={combinedFeed}
          renderItem={renderFeedItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.feedList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onMomentumScrollBegin={() => {
            setOnEndReachedCalledDuringMomentum(false);
          }}
          onEndReached={() => {
            if (!onEndReachedCalledDuringMomentum) {
              loadMoreRecommendations();
              setOnEndReachedCalledDuringMomentum(true);
            }
          }}
          onEndReachedThreshold={2}
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
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  notificationBadgeText: {
    color: "black",
    fontSize: 12,
    fontWeight: "bold",
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
    alignItems: "center",
    textAlign: "center",
  },
  postImage: {
    width: 250,
    height: 250,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardContent: {
    flex: 1,
    textAlign: "center",
    alignItems: "center",
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  postArtist: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 10,
  },
  postContext: {
    fontSize: 12,
    color: "#fff",
    marginBottom: 10,
    alignSelf: "center",
  },
  reviewContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#333",
    borderRadius: 5,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  commentCard: {
    backgroundColor: colours.darkblue,
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
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
    bottom: 120,
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