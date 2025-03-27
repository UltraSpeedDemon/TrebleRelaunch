import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { auth } from "../utils/firebase";
import { getFollowRequests, respondFollowRequest } from "../providers/rest";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

export default function Notifications({ navigation }) {
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchFollowRequests();
  }, []);

  async function fetchFollowRequests() {
    try {
      setLoading(true);
      // Fetch inbound follow requests for the current user
      const resp = await getFollowRequests(auth.currentUser.uid);
      if (!resp.ok) {
        throw new Error("Failed to fetch follow requests");
      }
      const requests = await resp.json();
      setFollowRequests(requests);
    } catch (error) {
      console.error("Error fetching follow requests:", error);
      Alert.alert("Error", "Unable to fetch follow requests.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResponse(followerId, accept) {
    try {
      const resp = await respondFollowRequest(
        auth.currentUser.uid,
        followerId,
        accept
      );
      if (resp.ok) {
        Alert.alert("Success", `Follow request ${accept ? "accepted" : "denied"}.`);
        // Refresh the follow requests list
        fetchFollowRequests();
      } else {
        Alert.alert("Error", "Failed to process follow request.");
      }
    } catch (error) {
      console.error("Error responding to follow request:", error);
      Alert.alert("Error", "Failed to process follow request.");
    }
  }

  // Helper to capitalize the first letter of the username.
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const renderRequest = ({ item }) => {
    // Fallback default avatar.
    const fallbackAvatar = require("../images/avatarIcon.png");

    // If item.avatar exists and is valid (base64 data URI or http URL), use it;
    // otherwise, fallback to the default.
    const avatarSource =
      item.avatar &&
      item.avatar !== "None" &&
      (item.avatar.startsWith("data:") || item.avatar.startsWith("http"))
        ? { uri: item.avatar }
        : fallbackAvatar;

    return (
      <View style={styles.requestCard}>
        {/* Tapping user info navigates to their profile */}
        <TouchableOpacity
          style={styles.userInfoTouchable}
          onPress={() =>
            navigation.navigate("UserProfiles", { userId: item.userId })
          }
          activeOpacity={0.8}
        >
          <Image source={avatarSource} style={styles.avatar} />
          <View style={styles.requestInfo}>
            <Text style={styles.username}>{formatUsername(item.username)}</Text>
            <Text style={styles.requestText}>wants to follow you.</Text>
          </View>
        </TouchableOpacity>

        {/* Accept / Deny buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleResponse(item.userId, true)}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.denyButton}
            onPress={() => handleResponse(item.userId, false)}
          >
            <Text style={styles.buttonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.header}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colours.lightblue} />
      ) : (
        <FlatList
          data={followRequests}
          keyExtractor={(item) => item.userId}
          renderItem={renderRequest}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No new notifications</Text>
            </View>
          }
        />
      )}

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
    paddingTop: 100,
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    zIndex: 10,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  requestCard: {
    flexDirection: "row",
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    alignItems: "center",
  },
  userInfoTouchable: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  requestInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  requestText: {
    fontSize: 14,
    color: "#aaa",
  },
  buttonContainer: {
    flexDirection: "row",
  },
  acceptButton: {
    backgroundColor: colours.lightblue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 5,
  },
  denyButton: {
    backgroundColor: "#FF0000",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#fff",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
