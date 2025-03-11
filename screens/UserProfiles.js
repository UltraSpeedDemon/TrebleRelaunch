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
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { auth } from "../utils/firebase";
import {
  getUser,
  getFollowers,
  getFriends,
  followUser,
  unfollowUser,
  requestFollow,  // For private accounts
  getFollowRequests,  // Already defined: export async function getFollowRequests(userId) { return await serverGet(`users/${userId}/followRequests`); }
} from "../providers/rest";
import colours from "../styles/colours";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

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

  // Persisted follow request status (using getFollowRequests below)
  const [followRequested, setFollowRequested] = useState(false);

  // Demo placeholders
  const [topTracks, setTopTracks] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [activity, setActivity] = useState([]);

  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  function formatUsername(name) {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  useEffect(() => {
    fetchUserData();
    fetchTheirFollowers();
    fetchMyFriends();
  }, [userId]);


  // New effect: Use getFollowRequests to check if current user has already requested to follow
  useEffect(() => {
    async function checkFollowRequest() {
      try {
        const resp = await getFollowRequests(userId);
        if (resp.ok) {
          const requests = await resp.json();
          // Assuming each request object has a "userId" property for the requester
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
        throw new Error("Failed to fetch user data");
      }
      const data = await resp.json();

      setUsername(data.username || "");
      setFollowersCount(data.followersCount || 0);
      setFollowingCount(data.followingCount || 0);

      setIsPublic(data.isPublic !== false);
      setIsSpotifyLinked(data.spotifyIsLinked === true);

      if (data.avatar && data.avatar !== "None") {
        setAvatar({ uri: data.avatar });
      } else {
        setAvatar(noAvatar);
      }

      // Example placeholders for tracks, ratings, activity
      setTopTracks([
        { id: "1", name: "I Wonder", artist: "Kanye West", image: require("../images/albumImage.jpg") },
        { id: "2", name: "Stronger", artist: "Kanye West", image: require("../images/albumImage.jpg") },
        { id: "3", name: "Gold Digger", artist: "Kanye West", image: require("../images/albumImage.jpg") },
      ]);
      setTopRated([
        { id: "1", name: "Stronger", artist: "Kanye West", rating: 5, image: require("../images/albumImage.jpg") },
        { id: "2", name: "Gold Digger", artist: "Kanye West", rating: 4, image: require("../images/albumImage.jpg") },
      ]);
      setActivity([
        { id: "1", username: data.username || "User", text: "Sample review text #1", upvotes: 2000 },
        { id: "2", username: data.username || "User", text: "Sample review text #2", upvotes: 1000 },
      ]);
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

  // Determine if I'm following or if we are friends
  const iAmFollowing = theirFollowers.some(
    (f) => f.userId === auth.currentUser.uid
  );
  const isInMyFriends = myFriends.some((fr) => fr.userId === userId);

  // Compute button label: "Follow", "Following", or "Requested"
  let finalButtonLabel = "Follow";
  if (iAmFollowing || isInMyFriends) {
    finalButtonLabel = "Following";
  } else if (!isPublic && followRequested) {
    finalButtonLabel = "Requested";
  }

  const showFriendsLabel = isInMyFriends;

  // 4) Handle follow/unfollow press
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
      // For private accounts: only send a request if not already requested
      if (!followRequested) {
        try {
          const resp = await requestFollow(auth.currentUser.uid, userId);
          if (resp.ok) {
            setFollowRequested(true);
            Alert.alert("Request Sent", "Your request to follow this private account was sent.");
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
            <Image source={avatar} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text style={styles.username}>{formatUsername(username)}</Text>
              <Text style={styles.stats}>Followers: {followersCount}</Text>
              <Text style={styles.stats}>Following: {followingCount}</Text>
              {isSpotifyLinked && (
                <View style={styles.spotifyContainer}>
                  <Image source={require("../images/spotifyLogo.png")} style={styles.spotifyLogo} />
                </View>
              )}
            </View>

            {/* Follow/Request Button (only if viewing someone else's profile) */}
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
        data={[]} // Using FlatList only for header and footer
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

              {/* Activity */}
              <View style={styles.activityCardSection}>
                <Text style={styles.sectionTitle}>Activity</Text>
                <FlatList
                  data={activity}
                  renderItem={({ item }) => (
                    <View style={styles.activityCard}>
                      <Text style={styles.activityUsername}>{item.username}</Text>
                      <Text style={styles.activityText}>{item.text}</Text>
                      <View style={styles.activityFooter}>
                        <Text style={styles.upvotes}>{item.upvotes} Upvotes</Text>
                        <Text style={styles.emojis}>❤️ 😢</Text>
                      </View>
                    </View>
                  )}
                  keyExtractor={(item) => item.id}
                />
              </View>
            </>
          ) : (
            <View style={{ margin: 20 }}>
              <Text style={styles.privateAccountText}>This Account is Private</Text>
            </View>
          )
        }
      />

      {/* Bottom Navigation Bar */}
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
  errorText: { color: "#fff", fontSize: 18 },
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
  spotifyContainer: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  spotifyLogo: { width: 24, height: 24, marginRight: 5 },
  followContainer: { alignItems: "center", marginLeft: 10 },
  followButton: { backgroundColor: colours.lightblue, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5 },
  requestedButton: { backgroundColor: "#999", paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5 },
  followButtonText: { color: "#fff", fontWeight: "bold" },
  friendText: { marginTop: 8, fontSize: 14, fontWeight: "bold", color: "#fff" },
  cardSection: { backgroundColor: colours.darkblue, padding: 10, borderRadius: 10, marginHorizontal: 10, marginVertical: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colours.lightblue, marginBottom: 10 },
  trackCard: { marginRight: 10, alignItems: "center" },
  trackImage: { width: 100, height: 100, borderRadius: 10, marginBottom: 5 },
  trackName: { fontSize: 14, fontWeight: "bold", color: "#fff" },
  trackArtist: { fontSize: 12, color: "#aaa" },
  ratingContainer: { flexDirection: "row", marginTop: 5 },
  starIcon: { width: 16, height: 16, marginRight: 2 },
  activityCardSection: { backgroundColor: colours.darkblue, marginBottom: 100, padding: 10, borderRadius: 10, marginHorizontal: 10, marginVertical: 10 },
  activityCard: { backgroundColor: "#1E1E2C", borderRadius: 10, padding: 10, marginBottom: 10 },
  activityUsername: { fontSize: 14, fontWeight: "bold", color: colours.lightblue, marginBottom: 5 },
  activityText: { fontSize: 12, color: "#fff", marginBottom: 5 },
  activityFooter: { flexDirection: "row", justifyContent: "space-between" },
  upvotes: { fontSize: 12, color: "#fff" },
  emojis: { fontSize: 14, color: "#fff", marginLeft: 10 },
  privateAccountText: { fontSize: 18, marginTop: 40, fontWeight: "bold", color: colours.lightblue, textAlign: "center" },
  bottomNavBar: { position: "absolute", bottom: 0, width: "100%" },
  notificationsIcon: { width: 40, height: 40, position: "absolute", top: 70, right: 20 },
  notifIcon: { width: "90%", height: "90%", resizeMode: "contain", left: 10, top: 2 },
  notificationBadge: { position: "absolute", top: -5, right: -5, backgroundColor: "red", width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", zIndex: 10 },
  notificationBadgeText: { color: "black", fontSize: 12, fontWeight: "bold" },
});
