import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

export default function Favourites({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchAnimation] = useState(new Animated.Value(0));

  // Toggle search bar visibility
  const toggleSearch = () => {
    const toValue = searchOpen ? 0 : 1;
    Animated.timing(searchAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setSearchOpen(!searchOpen);
  };

  // Interpolations for search bar animation
  const searchWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "67%"],
  });

  const searchOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <Animated.View
        style={[
          styles.searchBar,
          {
            transform: [
              {
                translateX: searchAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              },
            ],
            width: searchWidth,
            opacity: searchOpacity,
          },
        ]}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search favourites..."
          placeholderTextColor="#fff"
        />
      </Animated.View>

      {/* Search Icon */}
      <TouchableOpacity style={styles.searchIcon} onPress={toggleSearch}>
        <Image
          source={require("../images/blackSearchIcon.png")}
          style={styles.icon}
        />
      </TouchableOpacity>

      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.header}>Favourites</Text>
        <Text style={styles.subText}>Here are your favourite tracks and playlists.</Text>
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },
  searchIcon: {
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
  searchBar: {
    position: "absolute",
    height: 40,
    top: 70,
    left: 20,
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
  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
},
});