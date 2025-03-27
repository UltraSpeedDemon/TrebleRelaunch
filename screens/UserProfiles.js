import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { auth } from "../utils/firebase";
import {
  getUser,
  getFollowers,
  getFriends,
  followUser,
  unfollowUser,
  requestFollow,
  getFollowRequests,
  getUserReview,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
} from "../providers/rest";
import colours from "../styles/colours";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import ReviewCard from "../components/Review";
import { FlatList } from "react-native-gesture-handler";

export default function UserProfiles({ navigation }) {
  const route = useRoute();
  const { userId } = route.params;

  // Basic user info
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(require("../images/avatarIcon.png"));
  const noAvatar = require("../images/avatarIcon.png");

  const [theirFollowers, setTheirFollowers] = useState([]);
  const [myFriends, setMyFriends] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Account settings
  const [isPublic, setIsPublic] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Follow request status
  const [followRequested, setFollowRequested] = useState(false);

  // Demo placeholders for topTracks & topRated
  const [topTracks, setTopTracks] = useState([]);
  const [topRated, setTopRated] = useState([]);

  // Activity feed
  const [activity, setActivity] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0); // track the number of reviews

  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // For naming
  function formatUsername(name) {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // On mount or userId change, fetch user data / followers / friend list
  useEffect(() => {
    fetchUserData();
    fetchTheirFollowers();
    fetchMyFriends();
  }, [userId]);

  // Check if we already requested follow
  useEffect(() => {
    async function checkFollowRequest() {
      try {
        const resp = await getFollowRequests(userId);
        if (resp.ok) {
          const requests = await resp.json();
          const alreadyRequested = requests.some(
            (req) => req.userId === auth.currentUser.uid
          );
          setFollowRequested(alreadyRequested);
        }
      } catch (error) {
        console.error("Error fetching follow request status:", error);
      }
    }
    checkFollowRequest();
  }, [userId]);

  // 1) Fetch user data
  async function fetchUserData() {
    try {
      setLoading(true);
      const resp = await getUser(userId);
      if (!resp.ok) {
        const errText = await resp.text();
        console.log("DEBUG: getUser error response:", errText);
        throw new Error("Failed to fetch user data from backend.");
      }
      const data = await resp.json();
      console.log("DEBUG: Fetched user data:", data);

      setUsername(data.username || "");
      setFollowersCount(data.followersCount || 0);
      setFollowingCount(data.followingCount || 0);
      setIsPublic(data.isPublic !== false);
      setIsSpotifyLinked(data.spotifyIsLinked === true);
      setIsAdmin(data.isAdmin || false);

      // If avatar is valid, set it. Otherwise, fallback.
      if (
        data.avatar &&
        data.avatar !== "None" &&
        (data.avatar.startsWith("data:") || data.avatar.startsWith("http"))
      ) {
        setAvatar(data.avatar);
      } else {
        setAvatar(null);
      }

      // Example placeholders
      setTopTracks([
        {
          id: "1",
          name: "I Wonder",
          artist: "Kanye West",
          image: require("../images/albumImage.jpg"),
        },
        {
          id: "2",
          name: "Stronger",
          artist: "Kanye West",
          image: require("../images/albumImage.jpg"),
        },
        {
          id: "3",
          name: "Gold Digger",
          artist: "Kanye West",
          image: require("../images/albumImage.jpg"),
        },
      ]);
      setTopRated([
        {
          id: "1",
          name: "Stronger",
          artist: "Kanye West",
          rating: 5,
          image: require("../images/albumImage.jpg"),
        },
        {
          id: "2",
          name: "Gold Digger",
          artist: "Kanye West",
          rating: 4,
          image: require("../images/albumImage.jpg"),
        },
      ]);

      // Now fetch user reviews
      const reviewResp = await getUserReview(userId);
      if (reviewResp.ok) {
        const userReviews = await reviewResp.json();
        setActivity(userReviews);

        // Update totalReviews to length of userReviews
        setTotalReviews(userReviews.length);
      } else {
        console.error("Failed to fetch user reviews. Status:", reviewResp.status);
        setActivity([]); // or leave existing
        setTotalReviews(0);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Unable to fetch user data.");
    } finally {
      setLoading(false);
    }
  }

  // 2) Fetch the user’s followers
  async function fetchTheirFollowers() {
    try {
      const resp = await getFollowers(userId);
      if (!resp.ok) {
        throw new Error("Failed to fetch their followers");
      }
      const arr = await resp.json();
      setTheirFollowers(arr);
    } catch (error) {
      console.error("Error fetching their followers:", error);
    }
  }

  // 3) Fetch my friend list
  async function fetchMyFriends() {
    try {
      const resp = await getFriends(auth.currentUser.uid);
      if (!resp.ok) {
        throw new Error("Failed to fetch my friends");
      }
      const friendsArr = await resp.json();
      setMyFriends(friendsArr);
    } catch (error) {
      console.error("Error fetching my friends:", error);
    }
  }

  const handleUpvote = async (id) => {
    let rev = activity.find((r) => r.id === id);
    if (!rev) return;

    try {
      if (!rev.upvoted) {
        await upvoteReview(id);
      } else {
        await removeUpvoteFromReview(id);
      }
      setActivity((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                upvotes: rev.upvoted ? c.upvotes - 1 : c.upvotes + 1,
                upvoted: !c.upvoted,
              }
            : c
        )
      );
    } catch (err) {
      console.error("Error upvoting review:", err);
    }
  };

  const handleDelete = async (id) => {
    let rev = activity.find((r) => r.id === id);
    if (rev?.isUser) {
      try {
        await deleteReview(id);
        setActivity((prev) => prev.filter((r) => r.id !== id));
        setTotalReviews((prevCount) => Math.max(prevCount - 1, 0)); // Decrement total
      } catch (err) {
        console.error("Error deleting review:", err);
      }
    }
  };

  // Determine if I'm following or if we are friends
  const iAmFollowing = theirFollowers.some(
    (f) => f.userId === auth.currentUser.uid
  );
  const isInMyFriends = myFriends.some((fr) => fr.userId === userId);

  let finalButtonLabel = "Follow";
  if (iAmFollowing || isInMyFriends) {
    finalButtonLabel = "Following";
  } else if (!isPublic && followRequested) {
    finalButtonLabel = "Requested";
  }
  const showFriendsLabel = isInMyFriends;

  async function handleFollowPress() {
    if (finalButtonLabel === "Following") {
      try {
        const resp = await unfollowUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setFollowersCount((prev) => Math.max(0, prev - 1));
          await fetchTheirFollowers();
          setMyFriends((prev) => prev.filter((f) => f.userId !== userId));
        }
      } catch (error) {
        console.error("Error unfollowing user:", error);
      }
      return;
    }
    if (isPublic) {
      try {
        const resp = await followUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setFollowersCount((prev) => prev + 1);
          await fetchTheirFollowers();
          const updatedFriendsResp = await getFriends(auth.currentUser.uid);
          if (updatedFriendsResp.ok) {
            const updatedFriends = await updatedFriendsResp.json();
            setMyFriends(updatedFriends);
          }
        }
      } catch (error) {
        console.error("Error following user:", error);
      }
    } else {
      if (!followRequested) {
        try {
          const resp = await requestFollow(auth.currentUser.uid, userId);
          if (resp.ok) {
            setFollowRequested(true);
            Alert.alert(
              "Request Sent",
              "Your request to follow this private account was sent."
            );
          } else {
            console.error("Failed to request follow");
          }
        } catch (error) {
          console.error("Error requesting follow:", error);
        }
      }
    }
  }

  const currentUserId = auth.currentUser.uid;
  const isSelf = currentUserId === userId;
  const canViewFullContent = isPublic || isSelf || iAmFollowing || isInMyFriends;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }
  if (!username) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>User not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <Image source={avatar ? { uri: avatar } : noAvatar} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text style={styles.username}>{formatUsername(username)}</Text>
              <Text style={styles.stats}>Followers: {followersCount}</Text>
              <Text style={styles.stats}>Following: {followingCount}</Text>
              {(isSpotifyLinked || isAdmin) && (
                <View style={styles.badgeContainer}>
                  {isSpotifyLinked ? (
                    <Image
                      source={require("../images/spotifyLogo.png")}
                      style={styles.badgeIcon}
                    />
                  ) : null}
                  {isAdmin ? (
                    <Image
                      source={require("../images/adminBadge.png")}
                      style={[
                        styles.badgeIcon,
                        !isSpotifyLinked && { marginLeft: 0 },
                      ]}
                    />
                  ) : null}
                </View>
              )}
            </View>
            {!isSelf && (
              <View style={styles.followContainer}>
                <TouchableOpacity
                  style={
                    finalButtonLabel === "Requested"
                      ? styles.requestedButton
                      : styles.followButton
                  }
                  onPress={handleFollowPress}
                  disabled={finalButtonLabel === "Requested"}
                >
                  <Text style={styles.followButtonText}>{finalButtonLabel}</Text>
                </TouchableOpacity>
                {showFriendsLabel && (
                  <Text style={styles.friendText}>Friends</Text>
                )}
              </View>
            )}
          </View>
        }
        data={[]}
        ListFooterComponent={
          canViewFullContent ? (
            <>
              {/* Top Tracks */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>Top Tracks</Text>
                <FlatList
                  data={topTracks}
                  renderItem={({ item }) => (
                    <View style={styles.trackCard}>
                      <Image source={item.image} style={styles.trackImage} />
                      <Text style={styles.trackName}>{item.name}</Text>
                      <Text style={styles.trackArtist}>{item.artist}</Text>
                    </View>
                  )}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>

              {/* Top Rated */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>Top Rated</Text>
                <FlatList
                  data={topRated}
                  renderItem={({ item }) => (
                    <View style={styles.trackCard}>
                      <Image source={item.image} style={styles.trackImage} />
                      <Text style={styles.trackName}>{item.name}</Text>
                      <Text style={styles.trackArtist}>{item.artist}</Text>
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
                  )}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>

              {/* Activity / Reviews */}
              <View style={styles.cardSectionActivity}>
                <Text style={styles.sectionTitle}>Activity</Text>
                {/* Show total number of reviews */}
                <Text style={styles.totalActivity}>
                  Total Reviews: {totalReviews}
                </Text>

                {/* If user has no reviews, show "No Reviews" */}
                {activity.length === 0 ? (
                  <Text style={styles.noReviewsText}>No Reviews</Text>
                ) : (
                  <FlatList
                    data={activity}
                    renderItem={({ item }) => (
                      <ReviewCard
                        item={item}
                        avatar={avatar}
                        handleUpvote={handleUpvote}
                        handleDelete={handleDelete}
                        navigation={navigation}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                  />
                )}
              </View>
            </>
          ) : (
            <View style={{ margin: 20 }}>
              <Text style={styles.privateAccountText}>
                This Account is Private
              </Text>
            </View>
          )
        }
      />
      <Text></Text>
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.bluegrey },
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
  spotifyContainer: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  spotifyLogo: { width: 24, height: 24, marginRight: 5 },
  editButton: { padding: 10, borderRadius: 5 },
  editButtonText: { color: "#fff", fontWeight: "bold" },
  followContainer: { alignItems: "center", marginLeft: 10 },
  followButton: {
    backgroundColor: colours.lightblue,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  requestedButton: {
    backgroundColor: "#999",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  followButtonText: { color: "#fff", fontWeight: "bold" },
  friendText: { marginTop: 8, fontSize: 14, fontWeight: "bold", color: "#fff" },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  cardSectionActivity: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
    marginBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  trackCard: { marginRight: 10, alignItems: "center" },
  totalActivity: { fontSize: 14, color: "#fff", marginBottom: 10 },
  noReviewsText: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    marginTop: 5,
  },
  trackImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 5 },
  trackName: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  trackArtist: { fontSize: 12, color: "#aaa" },
  ratingContainer: { flexDirection: "row", marginTop: 5 },
  starIcon: { width: 16, height: 16, marginRight: 2 },
  activityCardSection: {
    backgroundColor: colours.bluegrey,
    marginBottom: 100,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  activityCard: {
    backgroundColor: "#1E1E2C",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  activityUsername: {
    fontSize: 14,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  activityText: { fontSize: 12, color: "#fff", marginBottom: 5 },
  activityFooter: { flexDirection: "row", justifyContent: "space-between" },
  upvotes: { fontSize: 12, color: "#fff" },
  emojis: { fontSize: 14, color: "#fff", marginLeft: 10 },
  privateAccountText: {
    fontSize: 18,
    marginTop: 40,
    fontWeight: "bold",
    color: colours.lightblue,
    textAlign: "center",
  },
  bottomNavBar: { position: "absolute", bottom: 0, width: "100%" },
});
