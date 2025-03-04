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
  followUser,
  unfollowUser,
  getFriends,
} from "../providers/rest";
import colours from "../styles/colours";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

export default function UserProfiles({ navigation }) {
  const route = useRoute();
  const { userId } = route.params;

  // Basic info
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(require("../images/avatarIcon.png"));
  const noAvatar = require("../images/avatarIcon.png");

  // Follow states
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendsList, setFriendsList] = useState([]);

  // Basic numeric data
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Loading/spinners
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Spotify link status
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);

  // Profile-like sections
  const [topTracks, setTopTracks] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [activity, setActivity] = useState([]);

  // Helper for username
  const formatUsername = (name) =>
    name ? name.charAt(0).toUpperCase() + name.slice(1) : "";

  useEffect(() => {
    fetchUserData();
    fetchMyFriends();
  }, [userId]);

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
      setIsFollowing(data.isFollowing || false);

      if (data.avatar && data.avatar !== "None") {
        setAvatar({ uri: data.avatar });
      } else {
        setAvatar(noAvatar);
      }

      if (data.spotifyAccessToken && data.spotifyAccessToken !== "") {
        setIsSpotifyLinked(true);
      } else {
        setIsSpotifyLinked(false);
      }

      // Example placeholders for top tracks, top rated, activity
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
      setActivity([
        {
          id: "1",
          username: data.username || "User",
          text: "Sample review text #1",
          upvotes: 2000,
        },
        {
          id: "2",
          username: data.username || "User",
          text: "Sample review text #2",
          upvotes: 1000,
        },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to fetch user data.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyFriends() {
    try {
      const resp = await getFriends(auth.currentUser.uid);
      if (!resp.ok) {
        throw new Error("Failed to fetch my friends");
      }
      const myFriends = await resp.json();
      setFriendsList(myFriends);
    } catch (error) {
      console.error("Error fetching my friends:", error);
    }
  }

  // Check if user is in friend list
  const isInMyFriends = friendsList.some((fr) => fr.userId === userId);

  // If I'm following them or they're in friend list -> "Following"
  const finalButtonLabel = isInMyFriends || isFollowing ? "Following" : "Follow";
  // If they're in friend list, we display "Friends"
  const showFriendsLabel = isInMyFriends;

  async function handleFollowPress() {
    try {
      if (finalButtonLabel === "Following") {
        // Unfollow
        const resp = await unfollowUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setIsFollowing(false);
          setFollowersCount((prev) => Math.max(0, prev - 1));
          setFriendsList((prev) => prev.filter((f) => f.userId !== userId));
        }
      } else {
        // Follow
        const resp = await followUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setIsFollowing(true);
          setFollowersCount((prev) => prev + 1);

          // Re-fetch friend list to see if it’s mutual
          const updatedFriendsResp = await getFriends(auth.currentUser.uid);
          if (updatedFriendsResp.ok) {
            const updatedFriends = await updatedFriendsResp.json();
            setFriendsList(updatedFriends);
          }
        }
      }
    } catch (error) {
      console.error("Error follow/unfollow:", error);
    }
  }

  // Renders
  const renderTrack = ({ item }) => (
    <View style={styles.trackCard}>
      <Image source={item.image} style={styles.trackImage} />
      <Text style={styles.trackName}>{item.name}</Text>
      <Text style={styles.trackArtist}>{item.artist}</Text>
    </View>
  );

  const renderTopRated = ({ item }) => (
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
  );

  // Upvotes are white, and we keep emojis but remove the numeric counts
  const renderActivity = ({ item }) => (
    <View style={styles.activityCard}>
      <Text style={styles.activityUsername}>{item.username}</Text>
      <Text style={styles.activityText}>{item.text}</Text>
      <View style={styles.activityFooter}>
        <Text style={styles.upvotes}>{item.upvotes} Upvotes</Text>
        {/* Show emojis, but no counts */}
        <Text style={styles.emojis}>❤️ 😢</Text>
      </View>
    </View>
  );

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

      {/* Layout with FlatList */}
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
                  <Image
                    source={require("../images/spotifyLogo.png")}
                    style={styles.spotifyLogo}
                  />
                  <Text style={styles.spotifyText}>Spotify Connected</Text>
                </View>
              )}
            </View>

            {auth.currentUser.uid !== userId && (
              <View style={styles.followContainer}>
                <TouchableOpacity
                  style={styles.followButton}
                  onPress={handleFollowPress}
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
          <>
            {/* Top Tracks Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Tracks</Text>
              <FlatList
                data={topTracks}
                renderItem={renderTrack}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Top Rated Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Rated</Text>
              <FlatList
                data={topRated}
                renderItem={renderTopRated}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Activity Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <FlatList
                data={activity}
                renderItem={renderActivity}
                keyExtractor={(item) => item.id}
              />
            </View>
          </>
        }
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
  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    zIndex: 10,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 18,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginTop: 120,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  stats: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  spotifyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  spotifyLogo: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  spotifyText: {
    color: "#fff",
    fontSize: 14,
  },
  followContainer: {
    alignItems: "center",
    marginLeft: 10,
  },
  followButton: {
    backgroundColor: colours.lightblue,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  friendText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  trackCard: {
    marginRight: 10,
    alignItems: "center",
  },
  trackImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 5,
  },
  trackName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  trackArtist: {
    fontSize: 12,
    color: "#aaa",
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
  activityText: {
    fontSize: 12,
    color: "#fff",
    marginBottom: 5,
  },
  activityFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  upvotes: {
    fontSize: 12,
    color: "#fff",
  },
  emojis: {
    fontSize: 14,       // you can adjust the size as you like
    color: "#fff",
    marginLeft: 10,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
