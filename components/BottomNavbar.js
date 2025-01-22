import React from "react";
import { View, TouchableOpacity, Text, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native"; // Import navigation hook

import colours from "../styles/colours"; // Import colours 

const BottomNavbar = () => {
  const navigation = useNavigation(); // Navigation hook to handle screen transitions

  return (
    <View style={styles.bottomNavBar}>
      {/* Messages Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Messages")} // Navigate to Messages screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/whiteMessagesIcon.png")} // Icon for Messages
          style={styles.bottomMessagesIcon}
        />
        <Text style={styles.bottomMessagesText}>Messages</Text>
      </TouchableOpacity>

      {/* Home Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Main")} // Navigate to Main screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/whiteHomeIcon.png")} // Icon for Home
          style={styles.bottomNavIcon}
        />
        <Text style={styles.bottomNavText}>Home</Text>
      </TouchableOpacity>

      {/* Favourites Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Favourites")} // Navigate to Favourites screen
        style={styles.bottomNavItem}
      >
        <Image
          source={require("../images/whiteFavourite.png")} // Icon for Favourites
          style={styles.bottomNavIcon}
        />
        <Text style={styles.bottomNavText}>Favourites</Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
    bottomNavBar: {
      backgroundColor: colours.primaryblue, // Apply secondary blue as background
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
      width: 25,
      height: 25,
      resizeMode: "contain",
    },
    bottomMessagesIcon: {
      width: 50,
      height: 50,
      bottom: 12,
    },
    bottomMessagesText: {
      bottom: 25,
      fontSize: 14,
      color: "#fff",
    },
    bottomNavText: {
      fontSize: 14,
      color: "#fff",
    },
  });

export default BottomNavbar;