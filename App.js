import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';
import { getSession } from './utils/session'; // Session utility
import Home from './screens/Home';
import Login from './screens/Login';
import Hub from './screens/Hub';
import ForgotPassword from './screens/ForgotPassword';
import Register from './screens/Register';
import Error from './screens/Error';
import Main from './screens/Main';

// Stack Navigator
const Stack = createStackNavigator();

// Welcome Screen with Animation
function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeSession = async () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 2500, // Fade in
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 2500, // Fade out
          useNativeDriver: true,
        }),
      ]).start(async () => {
        try {
          // Check for a saved session in SecureStore
          const userUid = await getSession('userUid');
          if (userUid) {
            navigation.replace('Hub'); // Navigate to Hub if session exists
          } else {
            // Check Firebase Authentication state
            onAuthStateChanged(auth, (currentUser) => {
              if (currentUser) {
                navigation.replace('Hub'); // Navigate to Hub if logged in
              } else {
                navigation.replace('Home'); // Navigate to Home if not logged in
              }
            });
          }
        } catch (error) {
          console.error('Error checking session:', error);
          navigation.replace('Error'); // Navigate to Error screen on failure
        }
      });
    };

    initializeSession();
  }, [fadeAnim, navigation]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.text, { opacity: fadeAnim }]}>
        Welcome to
      </Animated.Text>
      <Animated.Text style={[styles.largeText, { opacity: fadeAnim }]}>
        Bass
      </Animated.Text>
    </View>
  );
}

// Main App Component
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Hub" component={Hub} />
        <Stack.Screen name="Main" component={Main} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="Error" component={Error} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontFamily: 'sans-serif',
    fontSize: 30,
    color: '#000',
  },
  largeText: {
    fontSize: 100,
    color: '#000',
  },
});
