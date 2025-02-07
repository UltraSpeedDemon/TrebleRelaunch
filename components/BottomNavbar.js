import React from "react";
import { View, TouchableOpacity, Text, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native"; // Import navigation hook

import colours from "../styles/colours"; // Import colours 

const BottomNavbar = () => {
  const navigation = useNavigation(); // Navigation hook to handle screen transitions

  return (
    <View style={styles.bottomNavBar}>
      {/* Explore Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Explore")} // Navigate to Messages screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/exploreIcon.png")} // Icon for Messages
          style={styles.bottomMessagesIcon}
        />
        <Text style={styles.bottomMessagesText}>Explore</Text>
      </TouchableOpacity>

      {/* Feed Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Main")} // Navigate to Main screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/whiteMusicSearchIcon.png")} // Icon for Home
          style={styles.bottomNavIcon}
        />
        <Text style={styles.bottomFeedText}>Feed</Text>
      </TouchableOpacity>

      {/* Profile Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Profile")} // Navigate to Favourites screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/whiteProfileIcon.png")} // Icon for Favourites
          style={styles.profileIcon}
        />
        <Text style={styles.bottomNavText}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
    bottomNavBar: {
      backgroundColor: colours.darkblue, // Apply secondary blue as background
      position: "absolute",
      bottom: 0,
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-around",
      borderTopColor: colours.lightblue,
      borderTopWidth: 3,
      paddingVertical: 10,
    },
    bottomNavItem: {
      flex: 1,
      alignItems: "center",
    },
    bottomNavIcon: {
      width: 44,
      height: 44,
      bottom: 3,
      resizeMode: "contain",
    },
    profileIcon: {
      width: 36,
      height: 36,
      top: 1,
      resizeMode: "contain",
    },
    bottomMessagesIcon: {
      width: 40,
      height: 40,
    },
    bottomMessagesText: {
      fontSize: 14,
      color: "#fff",
    },
    bottomFeedText: {
      fontSize: 14,
      color: "#fff",
      bottom: 4,
    },
    bottomNavText: {
      fontSize: 14,
      color: "#fff",
      top: 4,
    },
  });

export default BottomNavbar;