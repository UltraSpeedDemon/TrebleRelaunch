import React, { useState, useEffect } from "react";
import {
  View,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
  Alert,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { auth } from "../utils/firebase";
import MusicCard from "../components/MusicCard";
import {
  getFollowers,
  followUser,
  unfollowUser,
  getFollowRequests,
  requestFollow,
} from "../providers/rest";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import colours from "../styles/colours";

export default function FollowersList({ navigation }) {
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingUsers, setFollowingUsers] = useState({});
  // Dictionary to track follow-request status for each follower.
  const [followRequests, setFollowRequests] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // Fetch the followers list.
  useEffect(() => {
    async function fetchFollowers() {
      try {
        const response = await getFollowers(auth.currentUser.uid);
        const json = await response.json();
        setFollowersList(json);
      } catch (error) {
        console.error("Error fetching followers:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFollowers();
  }, []);

  // Fetch notifications count (number of follow requests) for the current user.
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

  // For each follower, check if the current user has already requested to follow.
  useEffect(() => {
    async function checkFollowRequestForUser(userId) {
      try {
        const resp = await getFollowRequests(userId);
        if (resp.ok) {
          const requests = await resp.json();
          const alreadyRequested = requests.some(
            (req) => req.userId === auth.currentUser.uid
          );
          setFollowRequests((prev) => ({ ...prev, [userId]: alreadyRequested }));
        }
      } catch (error) {
        console.error("Error fetching follow request status for user", userId, error);
      }
    }
    if (followersList.length > 0) {
      followersList.forEach((user) => {
        checkFollowRequestForUser(user.userId);
      });
    }
  }, [followersList]);

  // Handle follow action.
  const handleFollow = async (user) => {
    // Convert isPublic to a boolean.
    const userIsPublic = user.isPublic === true || user.isPublic === "true";
    if (userIsPublic) {
      try {
        console.log("Following user:", user);
        const response = await followUser(auth.currentUser.uid, user.userId);
        if (response.ok) {
          setFollowingUsers((prev) => ({ ...prev, [user.userId]: true }));
          console.log("Successfully followed user:", user.userId);
        } else {
          console.log("Failed to follow user");
        }
      } catch (error) {
        console.error("Error following user:", error);
      }
    } else {
      // For private accounts, send a follow request if not already done.
      if (!followRequests[user.userId]) {
        try {
          const response = await requestFollow(auth.currentUser.uid, user.userId);
          if (response.ok) {
            setFollowRequests((prev) => ({ ...prev, [user.userId]: true }));
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
  };

  // Handle unfollow action.
  const handleUnfollow = async (user) => {
    try {
      console.log("Unfollowing user:", user);
      const response = await unfollowUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: false }));
        console.log("Successfully unfollowed user:", user.userId);
      } else {
        console.log("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  // Helper: Capitalize the first letter of the username.
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

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

      {/* Main Content */}
      <View style={styles.content}>
        <SafeAreaProvider>
          <SafeAreaView>
            <ScrollView>
              {loading ? (
                <ActivityIndicator size="large" color="#4CAF50" />
              ) : followersList.length > 0 ? (
                followersList.map((user) => {
                  const isFollowing = followingUsers.hasOwnProperty(user.userId)
                    ? followingUsers[user.userId]
                    : user.isFollowing;
                  const alreadyRequested = followRequests[user.userId] || false;
                  const userIsPublic =
                    user.isPublic === true || user.isPublic === "true";
                  let finalButtonLabel = "Follow";
                  if (isFollowing) {
                    finalButtonLabel = "Following";
                  } else if (!userIsPublic && alreadyRequested) {
                    finalButtonLabel = "Requested";
                  }
                  return (
                    <MusicCard
                      key={user.userId}
                      id={user.userId}
                      name={formatUsername(user.username)}
                      image={user.avatar2}
                      onFollow={() =>
                        isFollowing ? handleUnfollow(user) : handleFollow(user)
                      }
                      isFollowing={isFollowing}
                      buttonLabel={finalButtonLabel}
                      userCard={true}
                      canFollow={true}
                      onPressCard={() =>
                        navigation.navigate("UserProfiles", {
                          userId: user.userId,
                        })
                      }
                    />
                  );
                })
              ) : (
                <Text style={styles.noResultsText}>No followers found.</Text>
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
