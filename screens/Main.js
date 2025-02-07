import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

export default function Feed({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for Songs..."
          placeholderTextColor="#fff"
        />
      </View>

      {/* Notifications Button */}
      <TouchableOpacity style={styles.notificationsIcon} onPress={() => navigation.navigate("Notifications")}>
        <Image
          source={require("../images/notificationsIcon2.png")} // Replace with your notifications icon
          style={styles.notifIcon}
        />
      </TouchableOpacity>

      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.header}>Feed</Text>
        <Text style={styles.subText}>Catch up with the latest posts and updates!</Text>
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },
  searchBar: {
    position: "absolute",
    width: "70%",
    height: 40,
    top: 70,
    left: "15%",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colours.lightblue,
    backgroundColor: colours.darkblue,
  },
  searchInput: {
    fontSize: 16,
    color: "#fff",
  },
  notificationsIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
  },
  icon: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  notifIcon: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
    left: 10,
    top: 2,
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    left: 100,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  subText: {
    fontSize: 16,
    color: colours.darkblue,
    marginTop: 10,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
});
