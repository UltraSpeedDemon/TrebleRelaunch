
import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

export default function Error({ message, onRetry, navigation }) {
  const sound = useRef(null);

  // Function to play the sound
  const playSound = async () => {
    try {
      const { sound: playbackObject } = await Audio.Sound.createAsync(
        require("../assets/Error.mp3")
      );
      sound.current = playbackObject;
      await playbackObject.playAsync();
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  };

  // Function to stop and unload the sound
  const stopSound = async () => {
    if (sound.current) {
      try {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
        sound.current = null;
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
    }
  };

  // Use useFocusEffect to handle screen focus/unfocus events
  useFocusEffect(
    useCallback(() => {
      // Play sound when screen is focused
      playSound();

      // Stop sound when screen is unfocused
      return () => {
        stopSound();
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Oops! Something went wrong.</Text>

      {/* Display the GIF */}
      <Image
        source={require("../images/oiia-oiiaoiia.gif")}
        style={styles.gif}
      />

      {/* Display the error message */}
      <Text style={styles.errorMessage}>{message}</Text>

      {/* Go Back Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          navigation.goBack();
        }}
      >
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>

      {/* Retry Button (optional) */}
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 0.4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colours.bluegrey,
    padding: 20,
  },
  errorText: {
    color: "red",   // Red text for error
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,

    textAlign: "center",
    marginBottom: 20,
  },
  gif: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: colours.lightblue,
    borderRadius: 8,
    marginBottom: 20, // Space before the bottom nav bar
  },
  retryButtonText: {
    color: "#fff",

    fontSize: 18,
    fontWeight: "bold",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});