import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  ScrollView,
} from "react-native";
import { auth } from "../utils/firebase";
import {
  getUser,
  getFollowers,
  getFriends,
  followUser,
  unfollowUser,
  requestFollow,
  getFollowRequests,
  // Review endpoints
  getUserTopReviews,
  getUserFavorites,
  getUserMostUpvoted,
  getUserActivity,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
  getReviewSong,
} from "../providers/rest";
import colours from "../styles/colours";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import ReviewCard from "../components/Review";
import { useIsFocused } from "@react-navigation/native";

export default function Profile({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState(require("../images/avatarIcon.png"));
  const noAvatar = require("../images/avatarIcon.png");
  const isFocused = useIsFocused();
  
  // Review sections
  const [topReviews, setTopReviews] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [mostUpvoted, setMostUpvoted] = useState([]);
  const [activity, setActivity] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);

  // Helper to capitalize the first letter
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

 // ------------------------------------------------------------------
  // Enrichment function – now attaches only the song's RID (plus type and listenableId)
  async function enrichReviewsWithSong(reviews) {
    const enriched = await Promise.all(
      reviews.map(async (review) => {
        if (!review.song) {
          try {
            console.log("DEBUG: Calling getReviewSong for", review.id);
            const response = await getReviewSong(auth.currentUser.uid, review.id);
            if (response && response.ok) {
              const songData = await response.json();
              // If the backend returns an object with a title then we assume we have valid song info.
              return songData;
            }
          } catch (err) {
            console.error("Error enriching review with song:", err);
          }
        }
        return review;
      })
    );
    return enriched;
  }

  async function loadReviewSections() {
    try {
      const [topResp, favResp, upvotedResp, activityResp] = await Promise.all([
        getUserTopReviews(auth.currentUser.uid),
        getUserFavorites(auth.currentUser.uid),
        getUserMostUpvoted(auth.currentUser.uid),
        getUserActivity(auth.currentUser.uid),
      ]);

      if (topResp.ok) {
        let topData = await topResp.json();
        var topData2 = await enrichReviewsWithSong(topData);

        const enrichedReviews = topData.map((review, index) => ({
          ...review,
          song: topData2[index]
        }));
        
        setTopReviews(enrichedReviews);
        console.log("DEBUG: Enriched reviews:", enrichedReviews);
      }
      if (favResp.ok) {
        let favData = await favResp.json();
        var favData2 = await enrichReviewsWithSong(favData);

        const enrichedReviews = favData.map((review, index) => ({
          ...review,
          song: favData2[index]
        }));
        setFavorites(enrichedReviews);
      }
      if (upvotedResp.ok) {
        let upvotedData = await upvotedResp.json();
        var upvotedData2 = await enrichReviewsWithSong(upvotedData);

        const enrichedReviews = upvotedData.map((review, index) => ({
          ...review,
          song: upvotedData2[index]
        }));

        setMostUpvoted(enrichedReviews);
      }
      if (activityResp.ok) {
        let activityData = await activityResp.json();
        var activityData2 = await enrichReviewsWithSong(activityData);

        const enrichedReviews = activityData.map((review, index) => ({
          ...review,
          song: activityData2[index]
        }));

        setActivity(enrichedReviews);
        setTotalReviews(activityData.length);
      }
    } catch (err) {
      console.error("Error loading review sections:", err);
    }
  }

  useEffect(() => {
    if (isFocused) {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigation.navigate("Home");
          return;
        }
        const resp = await getUser(currentUser.uid);
        if (!resp.ok) {
          throw new Error("Failed to fetch user data from backend.");
        }
        const userData = await resp.json();
        console.log("DEBUG: Fetched user data:", userData);

        setUsername(userData.username || "");
        setEmail(userData.email || "");
        setFollowers(userData.followersCount || 0);
        setFollowing(userData.followingCount || 0);
        setIsSpotifyLinked(!!userData.spotifyAccessToken);
        setIsAdmin(userData.isAdmin || false);
        if (
          userData.avatar &&
          userData.avatar !== "None" &&
          (userData.avatar.startsWith("data:") || userData.avatar.startsWith("http"))
        ) {
          setAvatar(userData.avatar);
        } else {
          setAvatar(null);
        }

        await loadReviewSections();
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Unable to fetch user data.");
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
    }
  }, [navigation, isFocused]);

  // Fetch followers and following counts (social info)
  useEffect(() => {
    const fetchSocials = async () => {
      try {
        const follResp = await getFollowers(auth.currentUser.uid);
        if (follResp.ok) {
          const follData = await follResp.json();
          setFollowers(follData.length);
        }
        const friendsResp = await getFriends(auth.currentUser.uid);
        if (friendsResp.ok) {
          const friendsData = await friendsResp.json();
          setFollowing(friendsData.length);
        }
      } catch (error) {
        console.error("Error fetching socials:", error);
      }
    };
    fetchSocials();
  }, []);

  // Upvote and delete handlers remain similar
  const updateReviewArray = (array, reviewId) =>
    array.map((r) =>
      r.id === reviewId
        ? { ...r, upvotes: r.upvoted ? r.upvotes - 1 : r.upvotes + 1, upvoted: !r.upvoted }
        : r
    );

  const handleUpvote = async (reviewId) => {
    const combined = [...topReviews, ...favorites, ...mostUpvoted, ...activity];
    const rev = combined.find((r) => r.id === reviewId);
    if (!rev) return;
    try {
      if (!rev.upvoted) {
        await upvoteReview(reviewId);
      } else {
        await removeUpvoteFromReview(reviewId);
      }
      setTopReviews((prev) => updateReviewArray(prev, reviewId));
      setFavorites((prev) => updateReviewArray(prev, reviewId));
      setMostUpvoted((prev) => updateReviewArray(prev, reviewId));
      setActivity((prev) => updateReviewArray(prev, reviewId));
    } catch (err) {
      console.error("Error upvoting review:", err);
    }
  };

  const handleDelete = async (reviewId) => {
    const combined = [...topReviews, ...favorites, ...mostUpvoted, ...activity];
    const rev = combined.find((r) => r.id === reviewId);
    if (!rev) return;
    try {
      if (rev.isUser) {
        await deleteReview(reviewId);
      }
      await loadReviewSections();
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  const handleSpotifyBadgePress = () => {
    Alert.alert("Spotify Badge", "User is linked to Spotify!");
  };

  const handleAdminBadgePress = () => {
    Alert.alert("Admin Badge", "User is an Admin/Developer!");
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="black" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
            <Image
              source={avatar ? { uri: avatar } : noAvatar}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.username}>{formatUsername(username)}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("FollowersList")}>
              <Text style={styles.stats}>Followers: {followers}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("FollowingList")}>
              <Text style={styles.stats}>Following: {following}</Text>
            </TouchableOpacity>
            <View style={styles.badgeContainer}>
              {isSpotifyLinked && (
                <TouchableOpacity onPress={handleSpotifyBadgePress}>
                  <Image
                    source={require("../images/spotifyLogo.png")}
                    style={styles.badgeIcon}
                  />
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity onPress={handleAdminBadgePress}>
                  <Image
                    source={require("../images/adminBadge.png")}
                    style={styles.badgeIcon}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colours.lightblue }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Top Reviews Section */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Top Reviews</Text>
          {topReviews.length === 0 ? (
            <Text style={styles.sectionPlaceholder}>No top reviews.</Text>
          ) : (
            <FlatList
              data={topReviews}
              horizontal
              keyExtractor={(item, index) => {
                let baseKey;
                baseKey = item.id
                return `${baseKey}-${index}`;
              }}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.reviewSnippetCard}>
                  <ReviewCard
                    item={item}
                    avatar={avatar}
                    handleUpvote={handleUpvote}
                    handleDelete={handleDelete}
                    navigation={navigation}
                    showReplyInput={false}
                    showComments={false}
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* Favourites Section */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Favourites</Text>
          {favorites.length === 0 ? (
            <Text style={styles.sectionPlaceholder}>No favourites.</Text>
          ) : (
            <FlatList
              data={favorites}
              horizontal
              keyExtractor={(item, index) => {
                let baseKey;
                baseKey = item.id
                return `${baseKey}-${index}`;
              }}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.reviewSnippetCard}>
                  <ReviewCard
                    item={item}
                    avatar={avatar}
                    handleUpvote={handleUpvote}
                    handleDelete={handleDelete}
                    navigation={navigation}
                    showReplyInput={false}
                    showComments={false}
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* Most Upvoted Section */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Most Upvoted</Text>
          {mostUpvoted.length === 0 ? (
            <Text style={styles.sectionPlaceholder}>
              No most upvoted reviews.
            </Text>
          ) : (
            <FlatList
              data={mostUpvoted}
              horizontal
              keyExtractor={(item, index) => {
                let baseKey;
                baseKey = item.id
                return `${baseKey}-${index}`;
              }}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.reviewSnippetCard}>
                  <ReviewCard
                    item={item}
                    avatar={avatar}
                    handleUpvote={handleUpvote}
                    handleDelete={handleDelete}
                    navigation={navigation}
                    showReplyInput={false}
                    showComments={false}
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* Activity Section */}
        <View style={styles.cardSection}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Latest Activity</Text>
            <Text style={styles.activitySubtitle}>Newest to Oldest</Text>
          </View>
          <Text style={styles.totalActivity}>Total Reviews: {totalReviews}</Text>
          {activity.length === 0 ? (
            <Text style={styles.sectionPlaceholder}>
              Start making reviews on Songs!
            </Text>
          ) : (
            <View style={styles.activityContainer}>
              {activity.map((item) => (
                <View key={item.id} style={styles.activityReviewWrapper}>
                  <ReviewCard
                    item={item}
                    avatar={avatar}
                    handleUpvote={handleUpvote}
                    handleDelete={handleDelete}
                    navigation={navigation}
                    showReplyInput={false}
                    showComments={false}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.bluegrey },
  scrollContainer: { paddingBottom: 120 },
  sideMenu: { position: "absolute", top: 40, right: 525, bottom: 0, zIndex: 10 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginTop: 120,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 15 },
  headerInfo: { flex: 1 },
  username: { fontSize: 18, fontWeight: "bold", color: colours.lightblue },
  stats: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  badgeContainer: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  badgeIcon: { width: 24, height: 24, marginRight: 5 },
  editButton: { padding: 10, borderRadius: 5 },
  editButtonText: { color: "#fff", fontWeight: "bold" },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  reviewSnippetCard: { width: 300, marginRight: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colours.lightblue },
  sectionPlaceholder: {
    fontSize: 14,
    color: "#fff",
    fontStyle: "italic",
    marginVertical: 5,
  },
  totalActivity: { fontSize: 14, fontWeight: "bold", color: "#fff", marginBottom: 7 },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  activitySubtitle: { fontSize: 12, color: "#ccc", fontStyle: "italic" },
  activityContainer: { paddingHorizontal: 5 },
  activityReviewWrapper: { marginVertical: 5 },
  bottomNavBar: { position: "absolute", bottom: 0, width: "100%" },
});
