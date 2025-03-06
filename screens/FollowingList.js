import React, { useState, useEffect } from "react";
import {
  View,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { auth } from "../utils/firebase";
import MusicCard from "../components/MusicCard";
// NOTE: we import getFollowing instead of getFollowers
import { getFollowing, followUser, unfollowUser } from "../providers/rest";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import colours from "../styles/colours";

export default function FollowingList({ navigation }) {
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingUsers, setFollowingUsers] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchFollowing() {
      try {
        // Now we fetch the list of users the current user is following
        const response = await getFollowing(auth.currentUser.uid);
        const json = await response.json();
        setFollowingList(json);
      } catch (error) {
        console.error("Error fetching following:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFollowing();
  }, []);

  const handleFollow = async (user) => {
    try {
      console.log("Following user:", user);
      const response = await followUser(auth.currentUser.uid, user["userId"]);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user["userId"]]: true }));
        console.log("Successfully followed user:", user["userId"]);
      } else {
        console.log("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const handleUnfollow = async (user) => {
    try {
      console.log("Unfollowing user:", user);
      const response = await unfollowUser(auth.currentUser.uid, user["userId"]);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user["userId"]]: false }));
        console.log("Successfully unfollowed user:", user["userId"]);
      } else {
        console.log("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
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

      {/* Main Content */}
      <View style={styles.content}>
        <SafeAreaProvider>
          <SafeAreaView>
            <ScrollView>
              {loading ? (
                <ActivityIndicator size="large" color="#4CAF50" />
              ) : followingList.length > 0 ? (
                followingList.map((user) => {
                  // We rely on a local override or user.isFollowing from the backend
                  const isFollowing = followingUsers.hasOwnProperty(user.userId)
                    ? followingUsers[user.userId]
                    : user.isFollowing;

                  return (
                    <MusicCard
                      key={user.userId}
                      id={user.userId}
                      name={user.username}
                      image={user.avatar}
                      // Follow/Unfollow button
                      onFollow={() =>
                        isFollowing ? handleUnfollow(user) : handleFollow(user)
                      }
                      isFollowing={isFollowing}
                      userCard={true}
                      canFollow={true}

                      // Navigate to the "UserProfiles" screen when tapping the card
                      onPressCard={() =>
                        navigation.navigate("UserProfiles", {
                          userId: user.userId,
                        })
                      }
                    />
                  );
                })
              ) : (
                <Text style={styles.noResultsText}>No following found.</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>

      {/* Bottom Navigation Bar */}
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
  content: {
    flex: 1,
    marginTop: 120,
    paddingBottom: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
  noResultsText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginTop: 20,
  },
});
