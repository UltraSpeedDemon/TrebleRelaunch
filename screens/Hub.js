import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { deleteSession } from '../utils/session';

import * as Linking from 'expo-linking';

//SPOTIFY API DEVELOPERS
const spotifyClientId = 'ff279a53cc6c4b29af108b043f904cc6';
const redirectUri = 'myapp'; // Make sure this matches your Spotify Developer app settings
const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';

const getSpotifyAuthUrl = () => {
  return `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
};

const handleSpotifyLogin = () => {
  const authUrl = getSpotifyAuthUrl();
  Linking.openURL(authUrl); // Open Spotify login page
};

// import { createClient } from '@supabase/supabase-js'

//SUPABASE THIRD PARTY AUTHENTICATION
// const supabaseUrl = 'https://psbwhmlksuicurraimvo.supabase.co'
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzYndobWxrc3VpY3VycmFpbXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3ODUxMjYsImV4cCI6MjA1MjM2MTEyNn0.GVOq7gUGwAjbyxODcEn_hglznp9YxB4OYtT4MQ7e5ek'
// const supabase = createClient(supabaseUrl, supabaseKey)

export default function Hub({ navigation }) {
  
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  const [token, setToken] = useState(null);

//    // Sign in with Spotify
//    async function signInWithSpotify() {
//     try {
//       const { data, error } = await supabase.auth.signInWithOAuth({
//         provider: 'spotify',
//       });

//       if (error) {
//         console.error('Error during authentication:', error);
//         alert('Authentication failed. Please try again.');
//       } else {
//         console.log('Spotify authentication data:', data);
//         // Navigate to a different screen if you need
//         // navigation.navigate('SomeOtherScreen');
//       }
//     } catch (err) {
//       console.error('Unexpected error:', err);
//       alert('An unexpected error occurred. Please try again.');
//     }
//   }

//   async function signOut() {
//     const { error } = await supabase.auth.signOut()
//   }

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get the current user from Firebase Auth
        const currentUser = auth.currentUser;

        if (currentUser) {
          // Option 1: Use the displayName from Firebase Auth
          const displayName = currentUser.displayName;
          setUsername(displayName);

          // Option 2 (Optional): Fetch additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username); // Use Firestore username if available
          }
        } else {
          navigation.navigate('Home'); // Redirect to Login if no user is logged in
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  useEffect(() => {
    const handleSpotifyRedirect = async () => {
      const url = Linking.createURL(); // Get initial redirect URL
      console.log(url)
      if (url && url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        setToken(token); // Save the token
        console.log('Spotify Access Token:', token);
      } else {
        console.warn('No access token found');
      }
    };

    handleSpotifyRedirect();

    // Listener for future redirects
    Linking.addEventListener('url', (event) => {
      const { url } = event;
      if (url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        setToken(token); // Save the token
        console.log('Spotify Access Token:', token);
      }
    });

    return () => {
      Linking.removeAllListeners('url');
    };
  }, []);

  if (!token) {
    return (
    <View style={styles.container}>
    <View style={styles.container}>
    <Button title="Login with Spotify" onPress={handleSpotifyLogin} />
  </View>
    <Text style={styles.welcomeText}>Welcome, {username}!</Text>
    <Button title="Logout" onPress={handleLogout} />
    <View style={styles.container}>
  </View>
  </View>
    );
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await deleteSession('userUid');
      navigation.navigate('Home'); // Navigate to Login on logout
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Welcome, {username}!</Text>
      <Button title="Login with Spotify" onPress={signInWithSpotify} />
      <Button title="Logout of Spotify" onPress={signOut} />
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  }, 
});