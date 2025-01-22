import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  TouchableWithoutFeedback,
  PanResponder,
  searchAnimation,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import {
  collection,
  query,
  where,
  getDoc,
  getDocs,
  doc,
} from "firebase/firestore";
import { saveSession } from "../utils/session";

import PersistentLayout from "../components/PersistentLayout";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours"; // Import the colors

export default function Main({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false); // Track Spotify linking status
  const [avatar, setAvatar] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false); // State to manage search bar visibility
  const [searchAnimation] = useState(new Animated.Value(0)); // Animation value for search bar

// Toggle Search Bar from right to left
const toggleSearch = () => {
  const toValue = searchOpen ? 0 : 1; // 1 will move it into view from the right, 0 will bring it out to the right
  Animated.timing(searchAnimation, {
    toValue,
    duration: 300,
    useNativeDriver: false,
  }).start();
  setSearchOpen(!searchOpen);
};

  const basicAvatar = require("../images/avatarIcon.png");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get the current user from Firebase Auth
        const currentUser = auth.currentUser;

        // Option 1: Use the displayName from Firebase Auth
        if (currentUser) {
          const displayName = currentUser.displayName || "";
          setEmail(currentUser.email || "");

          // Option 2 (Optional): Fetch additional user data from Firestore
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username || displayName);
            setAvatar(userData.avatar || basicAvatar);

            // Check if Spotify is linked
            if (userData.spotifyToken) {
              setIsSpotifyLinked(true); // Update state to reflect linking status
            }
          }
        } else {
          navigation.navigate("Home"); // Redirect to Login if no user is logged in
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  const [menuAnimation] = useState(new Animated.Value(-300)); // Side menu starts off-screen

  // PanResponder for swipe-to-close functionality
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (menuOpen && gestureState.dx < 0) {
        const newLeft = Math.max(-300, gestureState.dx);
        menuAnimation.setValue(newLeft);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (menuOpen && gestureState.dx < -100) {
        Animated.timing(menuAnimation, {
          toValue: -300,
          duration: 300,
          useNativeDriver: false,
        }).start(() => setMenuOpen(false));
      } else if (menuOpen) {
        Animated.timing(menuAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
    },
  });

    // Interpolations for search bar animation
    const searchWidth = searchAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "67%"],
    });

    const searchOpacity = searchAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }); 

    const noAvatar = require("../images/avatarIcon.png");

    return (
      <View style={styles.container}>
        <Animated.View
              style={[
                styles.searchBar,
                {
                  transform: [
                    {
                      translateX: searchAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [300, 0], // Start from 300 (off-screen right) to 0 (in view)
                      }),
                    },
                  ],
                  opacity: searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1], // Optional: make the search bar fade in
                  }),
                },
                { width: searchWidth, opacity: searchOpacity },
              ]}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Search for Songs..."
                placeholderTextColor="#fff"
              />
            </Animated.View>
            <TouchableOpacity style={styles.searchIcon} onPress={toggleSearch}>
              <Image
                source={require("../images/blackSearchIcon.png")}
                style={styles.icon}
              />
            </TouchableOpacity>
            <View style={styles.sideMenu}>
              {/* Sidebar */}
              <Sidebar />
            </View>

              {/* Main Feed Content */}
              <View style={styles.feed}>
                <Text style={styles.feedText}>Feed</Text>
              </View>

              {/* Bottom Navigation Bar */}
              <View style={styles.bottomNavBar}>
                <BottomNavbar />
            </View>
      </View>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
  feed: {
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  feedText: {
    fontSize: 70,
    top: 250,
    color: "#333",
  },
  searchIcon: {
    width: 40,
    left: 330,
    top: 70,
    height: 40,
  },
  icon: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  searchBar: {
    position: "absolute",
    width: "80%",
    height: 40,
    top: 70,
    left: 60,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colours.lightblue,
    backgroundColor: colours.primaryblue,
  },
  searchInput: {
    fontSize: 16,
    color: "#fff",
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});
