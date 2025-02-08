import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';
import { getSession } from './utils/session'; // Session utility
import { useFonts } from 'expo-font';

import colours from './styles/colours';
import Home from './screens/Home';
import Login from './screens/Login';
import Connections from './screens/Connections';
import ForgotPassword from './screens/ForgotPassword';
import Register from './screens/Register';
import Error from './screens/Error';
import Main from './screens/Main';
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
// Prepare the splash screen not to auto-hide
SplashScreen.preventAutoHideAsync();
import { ColorSpace } from 'react-native-reanimated';

// Stack Navigator
const Stack = createStackNavigator();
const { width, height } = Dimensions.get('window'); // Get screen dimensions

// Welcome Screen with Animation
function WelcomeScreen() {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current; // Start fully visible
  const scaleAnim = useRef(new Animated.Value(0.75)).current; // Start at original size
  const rotateAnim = useRef(new Animated.Value(0)).current; // Start at 0 rotation

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setTimeout(() => {
        if (user) {
          // User is signed in, navigate to the main screen
          navigation.replace('Main');
        } else {
          // User is signed out, stay on the login screen
          navigation.replace('Login');
        }
      }, 4000); // Delay navigation by 4 seconds
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 3000, // Increase duration to 3 seconds
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 2,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000, // Increase duration to 3 seconds
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('./assets/icon.png')}
        style={[
          styles.icon,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { rotate }],
          },
        ]}
      />
      <Text style={styles.text}>Welcome</Text>
    </View>
  );
}

// Main App Component
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    Pacifico: require('./assets/fonts/Pacifico-Regular.ttf'),
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
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Connections" component={Connections} />
        <Stack.Screen name="Main" component={Main} />
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
        <Stack.Screen name="RecentlyViewed" component={RecentlyViewed} />
      </Stack.Navigator>
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
    color: '#000',
  },
  largeText: {
    fontSize: 105,
    color: '#000',
  },
});
