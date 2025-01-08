import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Button,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import Home from './Home';
import Login from './Login';
import Hub from './Hub';
import ForgotPassword from './ForgotPassword';
import Register from './Register';
import Error from './Error';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Welcome'); // Manage screen state
  const fadeAnim = useRef(new Animated.Value(0)).current; // Animation value

  // Animation logic for Welcome Screen
  useEffect(() => {
    if (currentScreen === 'Welcome') {
      const fadeInOut = () => {
        Animated.sequence([
          // Fade in
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 2500, // 2.5 seconds
            useNativeDriver: true,
          }),
          // Fade out
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2500, // 2.5 seconds
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Navigate to Home after animation
          setCurrentScreen('Home');
        });
      };

      fadeInOut();
    }
  }, [currentScreen, fadeAnim]);

  // Render the appropriate screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'Welcome':
        return (
          <View style={styles.container}>
            <Animated.Text style={[styles.text, { opacity: fadeAnim }]}>
              Welcome to
            </Animated.Text>
            <Animated.Text style={[styles.largeText, { opacity: fadeAnim }]}>
              Bass
            </Animated.Text>
            <StatusBar style="auto" />
          </View>
        );
      case 'Home':
        return <Home navigate={setCurrentScreen} />;
      case 'Login':
        return <Login navigate={setCurrentScreen} />;
      case 'Hub':
        return <Hub navigate={setCurrentScreen} />;
      case 'ForgotPassword':
        return <ForgotPassword navigate={setCurrentScreen} />;
      case 'Register':
        return <Register navigate={setCurrentScreen} />;
      case 'Error':
        return <Error navigate={setCurrentScreen} />;
      default:
        return <Home navigate={setCurrentScreen} />;
    }
  };

  return <View style={styles.container}>{renderScreen()}</View>;
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