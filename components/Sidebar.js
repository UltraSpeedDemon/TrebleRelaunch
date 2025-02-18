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
import { auth, db } from "../utils/firebase";
import {
  collection,
  query,
  where,
  getDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { saveSession } from "../utils/session";
import { useNavigation } from "@react-navigation/native";
import colours from "../styles/colours";
import fontFamily from "../styles/fontFamily";
 
const Sidebar = ({ children }) => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(-300));
  const [avatar, setAvatar] = useState("../images/avatarIcon.png");
  const [username, setUsername] = useState("User");
  const [email, setEmail] = useState("email@example.com");

  const noAvatar = require("../images/avatarIcon.png");

  const toggleMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: menuOpen ? -300 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setMenuOpen(!menuOpen);
  };

     // Close the menu when clicking outside the sidebar (on the overlay)
     const closeMenu = () => {
        console.log("Closing menu...");
        Animated.timing(menuAnimation, {
          toValue: -300,
          duration: 300,
          useNativeDriver: false,
        }).start();
        setMenuOpen(false);
      };

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
              setAvatar(userData.avatar || null);
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

       {/* Tap-to-close overlay */}
       {menuOpen && (
        <TouchableWithoutFeedback onPress={toggleMenu}>
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
              source={avatar ? { uri: avatar } : require('../images/avatarIcon.png')}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <Text style={styles.profileName}>{username || "Loading..."}</Text>
          <Text style={styles.profileName2}>{email}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("EditProfile")}>
              <Text style={styles.editAccount}>Edit Account</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("RecentlyViewed")}
        >
          <Image
            source={require("../images/blackClockIcon.png")}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Recently Viewed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("FriendsList")}
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
          <Text style={styles.menuText}>Community</Text>
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
        <TouchableOpacity style={[styles.menuItem, {alignItems: "right"}]} onPress={handleLogout}>
          <Text style={styles.menuText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
      </View>
  );
      };

const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 30,
      right: 100,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1000,
        left: 0,
        right: 50,
        zIndex: 9,
      },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    editAccount: {
      top: 5,
      left: 110,
      color: "#333",
      fontSize: 10,
      fontFamily: 'Domine',
      alignContent: "right",
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
  });

export default Sidebar;