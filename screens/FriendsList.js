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
import { getFriends, followUser, unfollowUser } from "../providers/rest"; 
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import colours from "../styles/colours";

export default function FriendsList({ navigation }) {
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [followingUsers, setFollowingUsers] = useState({});

  useEffect(() => {
    async function fetchFriends() {
      try {
        const response = await getFriends(auth.currentUser.uid);
        const json = await response.json();
        setFriendsList(json);
      } catch (error) {
        console.error("Error fetching friends:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFriends();
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

      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <SafeAreaProvider>
          <SafeAreaView>
            {loading ? (
              <ActivityIndicator size="large" color="#4CAF50" />
            ) : friendsList.length > 0 ? (
              <ScrollView>
                {friendsList.map((friend) => {
                  const isFollowing = followingUsers.hasOwnProperty(friend.userId)
                    ? followingUsers[friend.userId]
                    : friend.isFollowing;

                  return (
                    <MusicCard
                      key={friend.userId}
                      id={friend.userId}
                      name={friend.username}
                      image={friend.avatar}
                      isFollowing={isFollowing}
                      userCard={true}
                      // Follow/Unfollow button
                      onFollow={() =>
                        isFollowing ? handleUnfollow(friend) : handleFollow(friend)
                      }
                      // Tapping the card -> go to that user's profile
                      onPressCard={() =>
                        navigation.navigate("UserProfiles", {
                          userId: friend.userId,
                        })
                      }
                      canFollow={true}
                    />
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.noResultsText}>No friends found.</Text>
            )}
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
