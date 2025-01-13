import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, TouchableOpacity} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { deleteSession } from '../utils/session';

import * as Linking from 'expo-linking';

//SPOTIFY ACCOUNT DEVELOPER
//etcurtis@lakeheadu.ca
//MusicProject123

// import { createClient } from '@supabase/supabase-js'

//SUPABASE THIRD PARTY AUTHENTICATION
// const supabaseUrl = 'https://psbwhmlksuicurraimvo.supabase.co'
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzYndobWxrc3VpY3VycmFpbXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3ODUxMjYsImV4cCI6MjA1MjM2MTEyNn0.GVOq7gUGwAjbyxODcEn_hglznp9YxB4OYtT4MQ7e5ek'
// const supabase = createClient(supabaseUrl, supabaseKey)

export default function Hub({ navigation }) {
  
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  const [token, setToken] = useState(null);

  
  //SPOTIFY API DEVELOPERS
  const spotifyClientId = 'ff279a53cc6c4b29af108b043f904cc6';
  const redirectUri = 'musicproject://redirect';
  const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';

  const getSpotifyAuthUrl = () => {
    return `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token`;
  };
  
  const handleSpotifyLogin = () => {
    const authUrl = getSpotifyAuthUrl();
    Linking.openURL(authUrl); // Open Spotify login page
  };

  // Handle deep linking and extract token
  useEffect(() => {
    const handleDeepLink = (event) => {
      const { url } = event;
      if (url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        setToken(token);
        console.log('Spotify Access Token:', token);
      }
    };

    // Handle the initial URL when the app is opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        setToken(token);
        console.log('Spotify Access Token (initial):', token);
      }
    });

    // Listen for deep link events
    Linking.addEventListener('url', handleDeepLink);

    return () => {
      Linking.removeEventListener('url', handleDeepLink);
    };
  }, []);


//    // Sign in with Spotify SUPABASE ---- 
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

  //For BASS Accounts
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
      <Text style={styles.welcome}>Welcome, {username}!</Text>
      <Text style={styles.mediumText}>You are now logged in.</Text>
      <Text style={styles.mediumText}></Text>
      <Text style={styles.largeText}>Connect an Account</Text>
      <TouchableOpacity
              style={[styles.button, { backgroundColor: 'green', opacity: 0.7 }] }
              onPress={handleSpotifyLogin}
            >
              <Text style={styles.buttonTextSpotify}>Login with Spotify</Text>
      </TouchableOpacity>
      <TouchableOpacity
              style={[styles.button, { backgroundColor: 'black', opacity: 0.7 }] }
              //error screen
              onPress = {() => navigation.navigate('Error')}
            >
              <Text style={styles.buttonTextLast}>Login with Last.fm</Text>
      </TouchableOpacity>
      <Text style={styles.mediumText}></Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Main')}>
                    <Text style={styles.buttonText}>Not Now?</Text>
                  </TouchableOpacity>
                
      <Text style={styles.mediumText}></Text>
      <TouchableOpacity
              style={[styles.button, { backgroundColor: '#8080E0', opacity: 0.7 }]}
              onPress={handleLogout}
            >
              <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  welcome: {
    fontSize: 35,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 10,
  },
  largeText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  mediumText: {
    fontSize: 20,
    color: '#000',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    width: '90%',
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007BFF',
    fontSize: 20,
    borderRadius: 25,
    width: 200,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSpotify: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextLast: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  red: {
    color: 'red',
    fontSize: 28,
    //bold
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  }
});