import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';
import { getSession } from './utils/session'; // Session utility
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';


import colours from './styles/colours';
import Home from './screens/Home';
import Login from './screens/Login';
import Connections from './screens/Connections';
import ForgotPassword from './screens/ForgotPassword';
import Register from './screens/Register';
import Error from './screens/Error';
import Feed from './screens/Feed';
import Profile from './screens/Profile';
import EditProfile from './screens/EditProfile';
import Settings from './screens/Settings';
import Groups from './screens/Groups';
import Messages from './screens/Messages';
import Notifications from './screens/Notifications';
import Favourites from './screens/Favourites';
import FriendsList from './screens/FriendsList';
import Explore from './screens/Explore';
import RecentlyViewed from './screens/RecentlyViewed';
import Search from './screens/Search';
import CreatePost from './screens/CreatePost';
import Posts from './screens/Posts';
import FollowersList from './screens/FollowersList';
import FollowingList from './screens/FollowingList';
import UserProfiles from './screens/UserProfiles';
import SongPage from './screens/SongPage';
import AlbumPage from './screens/AlbumPage';
import ArtistPage from './screens/ArtistPage';
import { MusicSwiper } from './screens/MusicSwiper';
import { SongCardSwipe } from './screens/SongCardSwipe';
import MusicSwiperTest from './screens/MusicSwiperTest';

// Prepare the splash screen not to auto-hide
SplashScreen.preventAutoHideAsync();
import { ColorSpace } from 'react-native-reanimated';
import UpdateReviewPage from './screens/UpdateReview';
import ArtistListenables from './screens/ArtistListenables';

// Stack Navigator
const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window'); // Get screen dimensions

// Welcome Screen with Animation
function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current; // Start fully visible
  const scaleAnim = useRef(new Animated.Value(0.75)).current; // Start at original size
  const rotateAnim = useRef(new Animated.Value(0)).current; // Start at 0 rotation

  useEffect(() => {
    const initializeSession = async () => {
      // Fade in, then fade out
      Animated.sequence([
        Animated.parallel([
          // Step 1: Fade In
          Animated.timing(fadeAnim, {
            toValue: 1, // Fully visible
            duration: 1000, // Fade-in duration
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1, // Scale up slightly (20%)
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1.4, // Rotate counterclockwise by 10 degrees
            duration: 2600,
            useNativeDriver: true,
          }),
        ]),
        // Step 2: Fade Out
        Animated.timing(fadeAnim, {
          toValue: 0, // Fully invisible
          duration: 1000, // Fade-out duration
          useNativeDriver: true,
        }),
      ]).start(async () => {
        try {
          // Check for a saved session in SecureStore
          const userUid = await getSession('userUid');
          if (userUid) {
            navigation.replace('Feed'); // If session exists, go to Main
          } else {
            onAuthStateChanged(auth, (currentUser) => {
              if (currentUser) {
                navigation.replace('Feed');
              } else {
                navigation.replace('Home');
              }
            });
          }
        } catch (error) {
          console.error('Error checking session:', error);
          navigation.replace('Error');
        }
      });
    };

    initializeSession();
  }, [fadeAnim, scaleAnim, rotateAnim, navigation]);

  return (
    <View style={styles.container} backgroundColor={colours.background}>
      <Animated.Image
        source={require('./images/musicNoteIcon.png')} // Path to your music note image
        style={[
          styles.icon,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim }, // Scale the image
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '-10deg'], // Rotate counterclockwise
                }),
              },
            ],
          },
        ]}
      />
      <Animated.Text style={[styles.largeText, { opacity: fadeAnim, fontFamily: 'Pacifico' }]}>
        Treble
      </Animated.Text>
      <Animated.Text style={[styles.text, { opacity: fadeAnim, fontFamily: 'Lobster' }]}>
        By Bass
      </Animated.Text>
    </View>
  );
}

// Main App Component
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    Pacifico: require('./assets/fonts/Pacifico-Regular.ttf'),
    Domine: require('./assets/fonts/Domine-VariableFont_wght.ttf'),
    Lobster: require('./assets/fonts/Lobster-Regular.ttf'),
    Lilita: require('./assets/fonts/LilitaOne-Regular.ttf'),
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Keep splash screen visible while fonts are still loading
  if (!fontsLoaded) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Connections" component={Connections} />
        <Stack.Screen name="Feed" component={Feed} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="Error" component={Error} />
        <Stack.Screen name="Profile" component={Profile} />
        <Stack.Screen name="EditProfile" component={EditProfile} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="Groups" component={Groups} />
        <Stack.Screen name="Messages" component={Messages} />
        <Stack.Screen name="Notifications" component={Notifications} />
        <Stack.Screen name="Favourites" component={Favourites} />
        <Stack.Screen name="FriendsList" component={FriendsList} />
        <Stack.Screen name="Explore" component={Explore} />
        <Stack.Screen name="CreatePost" component={CreatePost} />
        <Stack.Screen name="Posts" component={Posts} />
        <Stack.Screen name="Search" component={Search} />
        <Stack.Screen name="RecentlyViewed" component={RecentlyViewed} />
        <Stack.Screen name="FollowersList" component={FollowersList} />
        <Stack.Screen name="FollowingList" component={FollowingList} />
        <Stack.Screen name="UserProfiles" component={UserProfiles} />
        <Stack.Screen name="SongPage" component={SongPage} />
        <Stack.Screen name="AlbumPage" component={AlbumPage} />
        <Stack.Screen name="ArtistPage" component={ArtistPage} />
        <Stack.Screen name="MusicSwiper" component={MusicSwiper} />
        <Stack.Screen name="SongCardSwipe" component={SongCardSwipe} />
        <Stack.Screen name="MusicSwiperTest" component={MusicSwiperTest} />
        <Stack.Screen name="UpdateReview" component={UpdateReviewPage} />
        <Stack.Screen name="ArtistListenables" component={ArtistListenables} />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colours.bluegrey,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  icon: {
    width: width * 0.55, // Set image size relative to screen width
    height: height * 0.55, // Maintain aspect ratio or adjust size
  },
  text: {
    fontSize: 55,
    fontWeight: 'bold',
    color: '#fff',
  },
  largeText: {
    fontSize: 105,
    color: '#fff',
  },
});