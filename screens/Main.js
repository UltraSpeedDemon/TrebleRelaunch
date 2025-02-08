import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as AuthSession from "expo-auth-session";
import { SPOTIFY_CLIENT_ID, REDIRECT_URI, SPOTIFY_SCOPES } from "@env";
import { discovery, setAccessToken, setRefreshToken } from "../utils/spotifyAuth";

export default function Feed({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
      if (response?.type === 'success' && response.params?.code) {
        // Handle the response and save the new tokens
        // You can use the same logic as in your Connections.js file
      }
    }, [response]);

    promptAsync();
  };

  const refreshSpotifyToken = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userDocRef = doc(db, "users", currentUser.uid);
    const userSnapshot = await getDoc(userDocRef);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
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
              await setDoc(
                userDocRef,
                {
                  spotifyAccessToken: refreshResult.accessToken,
                  spotifyRefreshToken: refreshResult.refreshToken ?? refreshToken,
                },
                { merge: true }
              );
              setAccessToken(refreshResult.accessToken);
              setRefreshToken(refreshResult.refreshToken ?? refreshToken);
            } else {
              console.log("Failed to refresh token, re-authentication required");
              handleSpotifyReAuth();
            }
          } else {
            console.log("AuthSession.refreshAsync is not available");
          }
        } catch (error) {
          console.log("Error refreshing token", error);
          if (error.message.includes("Refresh token revoked")) {
            console.log("Refresh token revoked, re-authentication required");
            handleSpotifyReAuth();
          }
        }
      }
    }
  };

  useEffect(() => {
    refreshSpotifyToken();
  }, []);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for Songs..."
          placeholderTextColor="#fff"
        />
      </View>

      {/* Notifications Button */}
      <TouchableOpacity style={styles.notificationsIcon} onPress={() => navigation.navigate("Notifications")}>
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
        <Text style={styles.header}>Feed</Text>
        <Text style={styles.subText}>Catch up with the latest posts and updates!</Text>
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
  searchBar: {
    position: "absolute",
    width: "70%",
    height: 40,
    top: 70,
    left: "15%",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colours.lightblue,
    backgroundColor: colours.darkblue,
  },
  searchInput: {
    fontSize: 16,
    color: "#fff",
  },
  notificationsIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
  },
  icon: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  notifIcon: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
    left: 10,
    top: 2,
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
