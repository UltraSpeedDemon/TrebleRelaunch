import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { auth } from "../utils/firebase";
import { getUser, updateUser, getFollowRequests } from "../providers/rest";
import * as AuthSession from "expo-auth-session";
import { SPOTIFY_CLIENT_ID, REDIRECT_URI, SPOTIFY_SCOPES } from "@env";
import { discovery, setAccessToken, setRefreshToken } from "../utils/spotifyAuth";
import SearchBar from "../components/SearchBar";

export default function Feed({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // For testing, set a static count (replace this with your API call as needed)
  const [notificationsCount, setNotificationsCount] = useState(3);

  // Example: Fetch notifications count based on follow requests
  useEffect(() => {
    async function fetchNotificationsCount() {
      try {
        const resp = await getFollowRequests(auth.currentUser.uid);
        if (!resp.ok) {
          throw new Error("Failed to fetch follow requests");
        }
        const requests = await resp.json();
        setNotificationsCount(requests.length);
      } catch (error) {
        console.error("Error fetching notifications count:", error);
      }
    }
    fetchNotificationsCount();
  }, []);

  const handleSpotifyReAuth = async () => {
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scopes: SPOTIFY_SCOPES,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      },
      discovery
    );

    useEffect(() => {
      if (response?.type === "success" && response.params?.code) {
        // Handle the response and save the new tokens as needed
      }
    }, [response]);

    promptAsync();
  };

  const refreshSpotifyToken = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userData = await getUser(currentUser.uid);
      const refreshToken = userData.spotifyRefreshToken;

      if (refreshToken) {
        try {
          if (AuthSession.refreshAsync) {
            const refreshResult = await AuthSession.refreshAsync(
              {
                clientId: SPOTIFY_CLIENT_ID,
                refreshToken: refreshToken,
              },
              discovery
            );

            if (refreshResult.accessToken) {
              await updateUser(currentUser.uid, {
                spotifyAccessToken: refreshResult.accessToken,
                spotifyRefreshToken:
                  refreshResult.refreshToken ?? refreshToken,
              });
              setAccessToken(refreshResult.accessToken);
              setRefreshToken(refreshResult.refreshToken ?? refreshToken);
            } else {
              console.log(
                "Failed to refresh token, re-authentication required"
              );
              handleSpotifyReAuth();
            }
          } else {
            console.log("AuthSession.refreshAsync is not available");
          }
        } catch (error) {
          console.log("Error refreshing token", error);
          if (error.message.includes("Refresh token revoked")) {
            console.log(
              "Refresh token revoked, re-authentication required"
            );
            handleSpotifyReAuth();
          }
        }
      }
    } catch (error) {
      console.log("Error fetching user data from OrientDB", error);
    }
  };

  useEffect(() => {
    refreshSpotifyToken();
  }, []);

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
        <Text style={styles.header}>Feed</Text>
        <Text style={styles.subText}>
          Catch up with the latest posts and updates!
        </Text>
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
    zIndex: 10, // ensures the badge appears above other elements
  },
  notificationBadgeText: {
    color: "black",
    fontSize: 12,
    fontWeight: "bold",
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    left: 100,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  subText: {
    fontSize: 16,
    color: colours.darkblue,
    marginTop: 10,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
});
