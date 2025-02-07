import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteSession } from '../utils/session';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';


import * as AuthSession from 'expo-auth-session';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';
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
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setUsername(userData.username || displayName);

          if (userData.spotifyAccessToken) {
            setIsSpotifyLinked(true);
          }
        } else {
          // If no user doc, at least set display name from Firebase Auth
          setUsername(displayName);
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
              const userDocRef = doc(db, 'users', currentUser.uid);
              await setDoc(
                userDocRef,
                { 
                  spotifyAccessToken: accessToken, 
                  spotifyRefreshToken: refreshToken 
                },
                { merge: true }
              );
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
      <View style={styles.sideMenu}>
        {/* Sidebar */}
          <Sidebar />
            </View>
      <Text style={styles.welcome}>Welcome, {username}!</Text>
      <Text style={styles.mediumText}>You are now logged in.</Text>
      <Text style={styles.mediumText}></Text>
      <Text style={styles.largeText}>Connect an Account</Text>

      {/* Spotify Connection */}
      {!isSpotifyLinked ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "green", opacity: 0.7 }]}
          onPress={handleSpotifyLogin}
          disabled={!request} // disable if request is not ready
        >
          <Text style={styles.buttonTextSpotify}>Login with Spotify</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.textSpotify}>
          Your Spotify account is already linked!
        </Text>
      )}

      {/* Last.fm Connection (placeholder) */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "black", opacity: 0.7 }]}
        //error screen
        onPress={() => navigation.navigate("Error")}
      >
        <Text style={styles.buttonTextLast}>Login with Last.fm</Text>
      </TouchableOpacity>

      {/* Apple Music Connection (placeholder) */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#FA2D48", opacity: 0.7 }]}
        //error screen
        onPress={() => navigation.navigate("Error")}
      >
        <Text style={styles.buttonTextApple}>Login with Apple Music</Text>
      </TouchableOpacity>
              {/* Bottom Navigation Bar */}
              <View style={styles.bottomNavBar}>
                <BottomNavbar />
            </View>
    </View>
  );
}

// -------------------- STYLES --------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: colours.bluegrey,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 55,
    fontFamily: 'Lobster',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 10,
  },
  largeText: {
    fontSize: 40,
    fontFamily: 'Lobster',
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  mediumText: {
    fontSize: 30,
    fontFamily: 'Lobster',
    color: '#000',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007BFF',
    fontSize: 20,
    borderRadius: 25,
    width: 250,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Domine',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSpotify: {
    color: 'black',
    top: 3,
    fontSize: 16,
    fontWeight: 'bold',
  },
  textSpotify: {
    color: 'black',
    fontWeight: 'bold',
    backgroundColor: 'green',
    opacity: 0.7,
    fontSize: 18,
    padding: 10,
    marginBottom: 20,
    borderRadius: 25,
    width: 380,
    height: 50,
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonTextLast: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextApple: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
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
});
