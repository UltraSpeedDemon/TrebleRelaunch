
//
// UNUSED *** HAS BOTH NAVBAR and SIDEBAR -- USE SEPERATE COMPONENT PAGES

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
  searchAnimation,
  Image,
  TouchableWithoutFeedback,
  PanResponder,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { getUser } from "../providers/rest";
import { saveSession } from "../utils/session";
import { useNavigation } from "@react-navigation/native";
import colours from "../styles/colours";

const PersistentLayout = ({ children }) => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(-300));
  const [avatar, setAvatar] = useState(null);
  const [username, setUsername] = useState("User");
  const [email, setEmail] = useState("email@example.com");

  // Toggle Side Menu
    const toggleMenu = () => {
      Animated.timing(menuAnimation, {
        toValue: menuOpen ? -300 : 0, // Slide in or out
        duration: 300,
        useNativeDriver: false,
      }).start();
      setMenuOpen(!menuOpen);
    };  

     // Close the menu when clicking outside the sidebar (on the overlay)
    const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: -300,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setMenuOpen(false);
  };
  
    const basicAvatar = require("../images/avatarIcon.png");
  
    useEffect(() => {
      const fetchUserData = async () => {
        try {
          // Get the current user from Firebase Auth
          const currentUser = auth.currentUser;
          if (currentUser) {
            const displayName = currentUser.displayName || "";
            setEmail(currentUser.email || "");
            // Fetch additional user data from Orient using getUser
            const orientRes = await getUser(currentUser.uid);
            if (!orientRes.ok) {
              throw new Error("Failed to fetch user data from OrientDB.");
            }
            const userData = await orientRes.json();
            setUsername(userData.username || displayName);
            setAvatar(userData.avatar || basicAvatar);
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

  const noAvatar = require("../images/avatarIcon.png");

  const handleLogout = () => {
    auth.signOut().then(() => navigation.navigate("Home"));
  };

  return (
    <View style={styles.container}>
      {/* Header with Hamburger and Search Icons */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.hamburger} onPress={toggleMenu}>
          <Image
            source={require("../images/blackHamburger.png")}
            style={styles.icon}
          />
        </TouchableOpacity>
      </View>

      {/* Overlay to detect clicks outside the menu */}
      {menuOpen && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Side Menu */}
      <Animated.View
        style={[styles.sideMenu, { left: menuAnimation }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
            <Image
              source={avatar ? { uri: avatar } : noAvatar}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <Text style={styles.profileName}>{username || "Loading..."}</Text>
          <Text style={styles.profileName2}>{email}</Text>
        </View>

        {/* Menu Items */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Image
            source={require("../images/profileIcon2.png")}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Connections")}
        >
          <Image
            source={require("../images/friendsIcon.png")}
            style={styles.friendsIcon}
          />
          <Text style={styles.menuText}>Friends List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Groups")}
        >
          <Image
            source={require("../images/groupsIcon.png")}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Messages")}
        >
          <Image
            source={require("../images/messagesIcon.png")}
            style={styles.messagesIcon}
          />
          <Text style={styles.menuText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Image
            source={require("../images/notificationsIcon2.png")}
            style={styles.notificationsIcon}
          />
          <Text style={styles.menuText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem2}
          onPress={() => navigation.navigate("Favourites")}
        >
          <Image
            source={require("../images/favouritesIcon2.png")}
            style={styles.favouritesIcon}
          />
          <Text style={styles.menuText}>Favourites</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Connections")}
        >
          <Image
            source={require("../images/connectionsIcon.png")}
            style={styles.connectionsIcon}
          />
          <Text style={styles.menuText}>Connections</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem2}
          onPress={() => navigation.navigate("Settings")}
        >
          <Image
            source={require("../images/settingsIcon.png")}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={styles.menuText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Navigation Bar (Hotbar) */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Messages")}
          style={styles.bottomNavItem}
        >
          <Image
            source={require("../images/whiteMessagesIcon.png")}
            style={styles.bottomMessagesIcon}
          />
          <Text style={styles.bottomMessagesText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Main")}
          style={styles.bottomNavItem}
        >
          <Image
            source={require("../images/whiteHomeIcon.png")}
            style={styles.bottomNavIcon}
          />
          <Text style={styles.bottomNavText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Favourites")}
          style={styles.bottomNavItem}
        >
          <Image
            source={require("../images/whiteFavourite.png")}
            style={styles.bottomNavIcon}
          />
          <Text style={styles.bottomNavText}>Favourites</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
      };

const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 30,
    },
    feed: {
      flex: 0.8,
      textAlign: "center",
      justifyContent: "center",
      alignItems: "center",
    },
    feedText: {
      fontSize: 60,
      color: "#333",
    },
    overlay: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    hamburger: {
      width: 40,
      height: 40,
    },
    searchIcon: {
      width: 40,
      height: 40,
    },
    icon: {
      width: "100%",
      height: "100%",
      resizeMode: "contain",
    },
    searchInput: {
      fontSize: 16,
      color: "#000",
    },
    sideMenu: {
      position: "absolute",
      top: -40,
      bottom: 0,
      width: 300,
      backgroundColor: colours.bluegrey2,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 10,
    },
    profileSection: {
      alignItems: "center",
      padding: 50,
      height: 200,
      borderBottomWidth: 2,
      borderBottomColor: colours.darkgrey,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 10,
    },
    profileName: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#333",
    },
    profileName2: {
      fontSize: 12,
      color: "#333",
    },
    menuItem: {
      padding: 19,
      flexDirection: "row",
      alignItems: "center",
    },
    menuItem2: {
      padding: 19,
      borderBottomWidth: 2,
      borderBottomColor: colours.darkgrey,
      flexDirection: "row",
      alignItems: "center",
    },
    menuIcon: {
      width: 20,
      height: 20,
      marginRight: 15,
      resizeMode: "contain",
    },
    messagesIcon: {
      width: 29,
      height: 29,
      right: 4,
      marginRight: 6,
      resizeMode: "contain",
    },
    connectionsIcon: {
      width: 29,
      height: 29,
      right: 4,
      marginRight: 6,
      resizeMode: "contain",
    },
    favouritesIcon: {
      width: 18,
      height: 18,
      left: 1,
      marginRight: 17,
      resizeMode: "contain",
    },
    notificationsIcon: {
      width: 20,
      height: 20,
      marginRight: 15,
      resizeMode: "contain",
    },
    friendsIcon: {
      width: 22,
      height: 22,
      right: 1,
      marginRight: 13,
      resizeMode: "contain",
    },
    menuText: {
      fontSize: 16,
      color: "#555",
    },
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

export default PersistentLayout;