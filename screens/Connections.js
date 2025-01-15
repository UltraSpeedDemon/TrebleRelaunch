import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, TouchableOpacity, Image} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteSession } from '../utils/session';

import * as Linking from 'expo-linking';
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPE, SPOTIFY_REDIRECT_URI } from '@env';


//SPOTIFY ACCOUNT DEVELOPER
//etcurtis@lakeheadu.ca
//MusicProject123

// import { createClient } from '@supabase/supabase-js'

// const supabase = createClient(supabaseUrl, supabaseKey)

export default function Connections({ navigation }) {
  
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false); // Track Spotify linking status


  const [token, setToken] = useState(null);



  const getSpotifyAuthUrl = () => {
    return `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${SPOTIFY_REDIRECT_URI}&scope=${SPOTIFY_SCOPE}&response_type=token`;
  };
  
  const handleSpotifyLogin = () => {
    const authUrl = getSpotifyAuthUrl();
    Linking.openURL(authUrl); // Open Spotify login page
  };

  // Handle deep linking and extract tokens
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const { url } = event;
      if (url.includes('#access_token=')) {
        const token = url.split('#access_token=')[1].split('&')[0];
        console.log('Spotify Access Token:', token);
  
        // Link Spotify account to Firebase user
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, { spotifyToken: token }, { merge: true });
            console.log('Spotify token linked to Firebase user');
            setIsSpotifyLinked(true); // Update state to reflect the linking
          } catch (error) {
            console.error('Error linking Spotify account:', error);
          }
        } else {
          console.error('No authenticated Firebase user found');
        }
      }
    };
  
    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
  
    // Listen for deep link events
    const unsubscribe = Linking.addEventListener('url', handleDeepLink);
  
    return () => {
      unsubscribe.remove(); // Proper cleanup
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
            setUsername(userData.username || displayName);
          
            // Check if Spotify is linked
            if (userData.spotifyToken) {
              setIsSpotifyLinked(true); // Update state to reflect linking status
            }
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
      {!isSpotifyLinked ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: 'green', opacity: 0.7 }]}
          onPress={handleSpotifyLogin}
        >
          <Text style={styles.buttonTextSpotify}>Login with Spotify</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.textSpotify}>Your Spotify account is already linked!</Text>
      )}
      <TouchableOpacity
              style={[styles.button, { backgroundColor: 'black', opacity: 0.7 }] }
              //error screen
              onPress = {() => navigation.navigate('Error')}
            >
              <Text style={styles.buttonTextLast}>Login with Last.fm</Text>
      </TouchableOpacity>
      <TouchableOpacity
              style={[styles.button, { backgroundColor: '#FA2D48', opacity: 0.7 }] }
              //error screen
              onPress = {() => navigation.navigate('Error')}
            >
              <Text style={styles.buttonTextApple}>Login with Apple Music</Text>
      </TouchableOpacity>
      <Text style={styles.mediumText}></Text>
      
      <Text style={styles.mediumText}></Text>
      {/* Bottom Navigation Bar (Hotbar) */}
             <View style={styles.bottomNavBar}>
             <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.bottomNavItem}>
                <Image source={require('../images/messagesIcon.png')} style={styles.bottomMessagesIcon} />
                <Text style={styles.bottomMessagesText}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.bottomNavItem}>
                <Image source={require('../images/homeIcon.png')} style={styles.bottomNavIcon} />
                <Text style={styles.bottomNavText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Favourites')} style={styles.bottomNavItem}>
                <Image source={require('../images/favouritesIcon2.png')} style={styles.bottomNavIcon} />
                <Text style={styles.bottomNavText}>Favourites</Text>
              </TouchableOpacity>
            </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    top: 20,
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
    width: 250,
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
  textSpotify: {
    color: 'black',
    fontWeight: 'bold',
    backgroundColor: 'green', 
    //smooth border 
    borderRadius: 25,
    //make thicker
    opacity: 0.7,
    fontSize: 18,
    //lower text position in button
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
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 18,
    width: '112%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 10,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
  },
  bottomNavIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  bottomMessagesIcon: {
    width: 50,
    height: 50,
    bottom: 12,
  },
  bottomMessagesText: {
    bottom: 25,
    fontSize: 12,
    color: '#555',
  },
  bottomNavText: {
    fontSize: 12,
    color: '#555',
  },
});