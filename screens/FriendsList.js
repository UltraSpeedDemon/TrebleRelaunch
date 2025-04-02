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
import {
  getFriends,
  getUser, 
  followUser,
  unfollowUser,
  getFollowRequests,
} from "../providers/rest";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import colours from "../styles/colours";

export default function FriendsList({ navigation }) {
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [followingUsers, setFollowingUsers] = useState({});
  const [notificationsCount, setNotificationsCount] = useState(0);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const response = await getFriends(auth.currentUser.uid);
        if (!response.ok) {
          throw new Error("Failed to fetch friends list");
        }
        const json = await response.json();
  
        // For each friend, if friend.avatar is missing, fetch the user data to get the avatar.
        const updatedFriends = await Promise.all(
          json.map(async (friend) => {
            if (!friend.avatar) {
              try {
                const userResp = await getUser(friend.userId);
                if (userResp.ok) {
                  const userData = await userResp.json();
                  return { ...friend, avatar: userData.avatar };
                }
                return friend;
              } catch (err) {
                console.error("Error fetching avatar for friend", friend.userId, err);
                return friend;
              }
            } else {
              return friend;
            }
          })
        );
        setFriendsList(updatedFriends);
      } catch (error) {
        console.error("Error fetching friends:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFriends();
  }, []);

  // 2) Fetch the count of pending follow requests (notifications)
  useEffect(() => {
    async function fetchNotificationsCount() {
      try {
        const resp = await getFollowRequests(auth.currentUser.uid);
        if (resp.ok) {
          const requests = await resp.json();
          setNotificationsCount(requests.length);
        }
      } catch (error) {
        console.error("Error fetching notifications count:", error);
      }
    }
    fetchNotificationsCount();
  }, []);

  // Follow a friend
  const handleFollow = async (user) => {
    try {
      const response = await followUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: true }));
        console.log("Successfully followed user:", user.userId);
      } else {
        console.error("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  // Unfollow a friend
  const handleUnfollow = async (user) => {
    try {
      const response = await unfollowUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: false }));
        console.log("Successfully unfollowed user:", user.userId);
      } else {
        console.error("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  /**
   * Returns a valid image source for the user's avatar.
   * If avatarString starts with "data:" or "http", we treat it as a valid URI.
   * Otherwise, return our local fallback image.
   */
  const getAvatarSource = (avatarString) => {
    const fallback = require("../images/avatarIcon.png");
    if (
      avatarString &&
      (avatarString.startsWith("data:") || avatarString.startsWith("http"))
    ) {
      return { uri: avatarString };
    }
    return fallback;
  };

  // Optionally capitalize the first letter of the username.
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar />

      {/* Notifications Button with Badge */}
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

      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <SafeAreaProvider>
          <SafeAreaView>
            {loading ? (
              <ActivityIndicator size="large" color="white" />
            ) : friendsList.length > 0 ? (
              <ScrollView>
                {friendsList.map((friend) => {
                  // If we've overridden their follow status, use that; else fallback to friend.isFollowing.
                  const isFollowing = followingUsers.hasOwnProperty(friend.userId)
                    ? followingUsers[friend.userId]
                    : friend.isFollowing;

                  return (
                    <MusicCard
                      key={friend.userId}
                      id={friend.userId}
                      name={formatUsername(friend.username)}
                      image={friend.avatar}
                      isFollowing={isFollowing}
                      userCard={true}
                      canFollow={true}
                      onFollow={() =>
                        isFollowing ? handleUnfollow(friend) : handleFollow(friend)
                      }
                      onPressCard={() =>
                        navigation.navigate("UserProfiles", {
                          userId: friend.userId,
                        })
                      }
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
    marginTop: 120,
    paddingBottom: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  noResultsText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginTop: 20,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
});
