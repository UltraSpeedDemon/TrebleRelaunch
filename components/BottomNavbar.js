import React from "react";
import { 
  View, 
  TouchableOpacity, 
  Text, 
  Image, 
  StyleSheet, 
  Platform 
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import colours from "../styles/colours";

const BottomNavbar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;

  return (
    <View style={styles.container}>
      <View style={styles.bottomNavBar}>
        {/* Explore */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Explore")}
          style={styles.bottomNavItem}
        >
          <View
            style={[
              styles.iconContainer,
              currentRoute === "Explore" && styles.activeIconBackground,
            ]}
          >
            <Image
              source={require("../images/exploreIcon.png")}
              style={styles.exploreIcon}
            />
          </View>
          <Text style={styles.exploreText}>Explore</Text>
        </TouchableOpacity>

        {/* Feed */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Feed")}
          style={styles.bottomNavItem}
        >
          <View
            style={[
              styles.iconContainer,
              currentRoute === "Feed" && styles.activeIconBackground,
            ]}
          >
            <Image
              source={require("../images/whiteMusicSearchIcon.png")}
              style={styles.feedIcon}
            />
          </View>
          <Text style={styles.feedText}>Feed</Text>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          style={styles.bottomNavItem}
        >
          <View
            style={[
              styles.iconContainer,
              currentRoute === "Profile" && styles.activeIconBackground,
            ]}
          >
            <Image
              source={require("../images/whiteProfileIcon.png")}
              style={styles.icon}
            />
          </View>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Wraps the entire bottom bar so it spans full width and is anchored at bottom
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colours.darkblue,
    borderTopColor: colours.lightblue,
    borderTopWidth: 3,
    // Extra bottom padding to accommodate iPhone home indicator
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  // Holds the row of nav items
  bottomNavBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: "center",
  },
  iconContainer: {
    padding: 9,
    borderRadius: 20,
  },
  activeIconBackground: {
    backgroundColor: "rgba(255,255,255,0.1)", // Subtle highlight
  },
  // Uniform icon sizing for consistent alignment
  icon: {
    width: 36,
    height: 36,
    resizeMode: "contain",
  },
  feedIcon:{
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  feedText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 3,
    textAlign: "center",
  },
  navText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 4,
    textAlign: "center",
  },
  exploreText: { 
    fontSize: 14, 
    color: "#fff", 
    marginTop: 5, 
    textAlign: "center" 
  },
  exploreIcon: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    top: 2,
  },
});

export default BottomNavbar;
