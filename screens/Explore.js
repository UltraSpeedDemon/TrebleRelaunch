import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
} from "react-native";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { auth } from "../utils/firebase";
import { getFollowRequests } from "../providers/rest";

export default function Explore({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // Example data for sections
  const topReviewed = [
    { id: "1", name: "I Wonder", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "2", name: "Stronger", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "3", name: "Gold Digger", artist: "Kanye West", image: require("../images/albumImage.jpg") },
  ];

  const popularWithFriends = [
    { id: "1", name: "Graduation", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "2", name: "Graduation", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "3", name: "Graduation", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "4", name: "Graduation", artist: "Kanye West", image: require("../images/albumImage.jpg") },
    { id: "5", name: "Graduation", artist: "Kanye West", image: require("../images/albumImage.jpg") },
  ];

  // Fetch notifications count (number of follow requests)
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

  const renderTrackCard = ({ item }) => (
    <View style={styles.trackCard}>
      <Image source={item.image} style={styles.trackImage} />
      <Text style={styles.trackName}>{item.name}</Text>
      <Text style={styles.trackArtist}>{item.artist}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar />

      {/* Notifications Button with Badge */}
      <TouchableOpacity
        style={styles.notificationsIcon}
        onPress={() => navigation.navigate("Notifications")}
      >
        <Image
          source={require("../images/notificationsIcon2.png")}
          style={styles.notifIcon}
        />
        {notificationsCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {notificationsCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      {/* Main Content */}
      <FlatList
        style={styles.content}
        ListHeaderComponent={
          <>
            {/* Top Reviewed Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Reviewed</Text>
              <FlatList
                data={topReviewed}
                renderItem={renderTrackCard}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Popular with Friends Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Popular with Friends</Text>
              <FlatList
                data={popularWithFriends}
                renderItem={renderTrackCard}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
          </>
        }
      />

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
    zIndex: 1,
  },
  notificationsIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
    zIndex: 1,
  },
  notifIcon: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
    left: 10,
    top: 2,
  },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  notificationBadgeText: {
    color: "black",
    fontSize: 12,
    fontWeight: "bold",
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
  content: {
    marginTop: 130, // Ensures content starts below the search bar
  },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  trackCard: {
    marginRight: 10,
    alignItems: "center",
  },
  trackImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 5,
  },
  trackName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  trackArtist: {
    fontSize: 12,
    color: "#aaa",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
