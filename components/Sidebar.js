import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Animated,
  TouchableWithoutFeedback,
  PanResponder,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getUser, getFollowRequests } from "../providers/rest";
import { auth } from "../utils/firebase";
import colours from "../styles/colours";
import fontFamily from "../styles/fontFamily";

const Sidebar = () => {
  const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnimation] = useState(new Animated.Value(0)); // Starts at 0
  const [avatar, setAvatar] = useState(null);
  const [username, setUsername] = useState("User");
  const [email, setEmail] = useState("email@example.com");
  const [notificationsCount, setNotificationsCount] = useState(0); // Notifications state
  const noAvatar = require("../images/avatarIcon.png");

  // Toggle side menu
  const toggleMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: menuOpen ? 0 : 300, // Moves 300 pixels to the right when open
      duration: 300,
      useNativeDriver: false,
    }).start();
    setMenuOpen(!menuOpen);
  };

  // Fetch user data from the backend
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const displayName = currentUser.displayName || "";
          setEmail(currentUser.email || "");

          const orientRes = await getUser(currentUser.uid);
        
          if (!orientRes.ok) {
            throw new Error("Failed to fetch user data from OrientDB.asdasd");
          }

          const userData = await orientRes.json();
          setUsername(userData.username || displayName);
          // Use the avatar from backend if valid (either base64 data URI or an http URL)
          if (
            userData.avatar &&
            userData.avatar !== "None" &&
            (userData.avatar.startsWith("data:") || userData.avatar.startsWith("http"))
          ) {
            console.log(
              "[DEBUG] Using avatar from backend:",
              userData.avatar.substring(0, 50) + "..."
            );
            setAvatar({ uri: userData.avatar });
          } else {
            console.log("[DEBUG] No valid avatar returned, using default");
            setAvatar(noAvatar);
          }
        } else {
          navigation.navigate("Home");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Unable to fetch user data.");
      }
    };

    fetchUserData();
  }, [navigation]);

  // Fetch notifications count (follow requests)
  useEffect(() => {
    async function fetchNotificationsCount() {
      try {
        const resp = await getFollowRequests(auth.currentUser.uid);
        if (resp.ok) {
          const requests = await resp.json();
          setNotificationsCount(requests.length);
        }
      } catch (error) {
        console.error("Error fetching notifications count:", error);
      }
    }
    fetchNotificationsCount();
  }, []);

  // PanResponder for swipe-to-close functionality
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      if (menuOpen && gestureState.dx > 0) {
        const newLeft = Math.min(300, gestureState.dx);
        menuAnimation.setValue(newLeft);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (menuOpen && gestureState.dx > 100) {
        Animated.timing(menuAnimation, {
          toValue: 300, // Fully open
          duration: 300,
          useNativeDriver: false,
        }).start();
      } else {
        Animated.timing(menuAnimation, {
          toValue: 0, // Close
          duration: 300,
          useNativeDriver: false,
        }).start(() => setMenuOpen(false));
      }
    },
  });

  // Helper: Capitalize the first letter of the username.
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const handleLogout = () => {
    auth.signOut().then(() => navigation.navigate("Home"));
  };

  return (
    <View style={styles.container}>
      {/* Header with Hamburger */}
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
            <Image source={avatar} style={styles.avatar} />
          </TouchableOpacity>
          <Text style={styles.profileName}>
            {formatUsername(username) || "Loading..."}
          </Text>
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
          <Text style={styles.menuText}>Shared</Text>
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
          {notificationsCount > 0 && (
            <View style={styles.sidebarNotificationBadge}>
              <Text style={styles.sidebarNotificationBadgeText}>
                {notificationsCount}
              </Text>
            </View>
          )}
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
        {/* Additional Menu Items */}
        <TouchableOpacity
          style={styles.menuItem2}
          onPress={() => navigation.navigate("MusicSwiperTest")}
        >
          <Text style={styles.menuText}>Test Swipe Game</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Connections")}
        >
          <Image
            source={require("../images/connectionsIcon.png")}
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Connections</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
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
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 200,
    right: -650,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    color: colours.lightblue,
    fontSize: 10,
    fontFamily: "Domine",
    alignContent: "right",
  },
  hamburger: {
    width: 40,
    height: 40,
    left: 300,
  },
  icon: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  sideMenu: {
    position: "absolute",
    backgroundColor: colours.darkblue,
    top: -40,
    bottom: 0,
    width: 300,
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
    borderBottomColor: colours.secondaryblue,
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
    color: colours.lightblue,
  },
  profileName2: {
    fontSize: 12,
    color: colours.lightblue,
  },
  menuItem: {
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
  },
  menuItem2: {
    padding: 19,
    borderBottomWidth: 2,
    borderBottomColor: colours.secondaryblue,
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
    color: colours.lightblue,
  },
  sidebarNotificationBadge: {
    backgroundColor: "red",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  sidebarNotificationBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default Sidebar;
