import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { auth } from '../utils/firebase';
import { deleteSession } from '../utils/session';
import colours from '../styles/colours';
import { getUser, updateUser } from "../providers/rest"; // Orient endpoints
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';
import * as AuthSession from 'expo-auth-session'; // Ensure AuthSession is imported correctly

import { SPOTIFY_CLIENT_ID } from '@env';
import { discovery, SPOTIFY_SCOPES, REDIRECT_URI } from '../utils/spotifyAuth';

export default function Connections({ navigation }) {
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);

  // Step 1: Set up a request object with useAuthRequest
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: SPOTIFY_SCOPES,
      // PKCE code challenge
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    },
    discovery
  );
  console.log('REQUEST:', request);
  console.log('RESPONSE:', response);
  console.log('REDIRECT_URI:', REDIRECT_URI);

  // Fetch user data from Firestore and check if Spotify is already linked
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          // If no user is logged in, redirect to Home (or Login)
          navigation.navigate('Home');
          return;
        }

        const displayName = currentUser.displayName;
        // Fetch user data from Orient instead of Firestore
        const orientRes = await getUser(currentUser.uid);
        if (!orientRes.ok) {
          throw new Error('Failed to fetch user data from OrientDB.');
        }
        const userData = await orientRes.json();
        setUsername(userData.username || displayName);

        if (userData.spotifyAccessToken) {
          setIsSpotifyLinked(true);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  // Step 2: Listen for the authorization code response
  useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
      const { code } = response.params;

      // Step 3: Exchange the code for tokens
      AuthSession.exchangeCodeAsync({
        code,
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri: REDIRECT_URI,
        extraParams: {
          code_verifier: request.codeVerifier, // set the exact param name
        },
      }, discovery)
        .then(async (tokenResponse) => {
          console.log('Spotify Token Response:', tokenResponse);
          const { accessToken, refreshToken } = tokenResponse;

          // Store tokens in Firestore
          const currentUser = auth.currentUser;
          if (currentUser) {
            try {
              await updateUser(currentUser.uid, {
                spotifyAccessToken: accessToken,
                spotifyRefreshToken: refreshToken,
                spotifyIsLinked: true,
              });
              setIsSpotifyLinked(true);
            } catch (err) {
              console.error('Error linking Spotify account:', err);
            }
          }
        })
        .catch((err) => {
          console.error('Error exchanging code for tokens:', err);
        });
    }
  }, [response]);

  // Trigger the Spotify login flow
  const handleSpotifyLogin = () => {
    promptAsync();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar />
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={styles.header}>Connections</Text>
        <Text style={styles.subHeader}>Manage your linked accounts</Text>

        <View style={styles.connectionCard}>
          <Image
            source={require("../images/spotifyLogo.png")}
            style={styles.logo}

            // style={[styles.logo, isSpotifyLinked ? null : styles.grayscale]}
          />
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionName}>Spotify</Text>
            <Text style={styles.connectionStatus}>
              {isSpotifyLinked ? "Connected" : "Not Connected"}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              isSpotifyLinked
                ? styles.disconnectButton
                : styles.connectButton,
            ]}
            onPress={isSpotifyLinked ? null : handleSpotifyLogin}
            disabled={isSpotifyLinked}
          >
            <Text style={styles.buttonText}>
              {isSpotifyLinked ? "Connected" : "Connect"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.connectionCard}>
          <Image
            source={require("../images/lastfmLogo.png")}
            style={styles.logo}
          />
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionName}>Last.fm</Text>
            <Text style={styles.connectionStatus}>Not Connected</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={() => navigation.navigate("Error")}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.connectionCard}>
          <Image
            source={require("../images/appleMusicLogo.png")}
            style={styles.logo}
          />
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionName}>Apple Music</Text>
            <Text style={styles.connectionStatus}>Not Connected</Text>
          </View>
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={() => navigation.navigate("Error")}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Navbar */}
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
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  mainContent: {
    marginTop: 140, // Ensures content starts below the sidebar
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  subHeader: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 20,
  },
  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colours.darkblue,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  grayscale: {
    tintColor: "#aaa",
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  connectionStatus: {
    fontSize: 14,
    color: "#aaa",
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  connectButton: {
    backgroundColor: "#4CAF50",
  },
  disconnectButton: {
    backgroundColor: "#FF0000",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
