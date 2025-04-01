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
import { getFollowRequests, getTopReviews, getTopSongs, getRecommendedSongs } from "../providers/rest";

export default function Explore({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [topReviewed, setTopReviewed] = useState([]);
  const [topLiked, setTopLiked] = useState([]);
  const [recommendedSongs, setRecommendedSongs] = useState([]);

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

  // Fetch top reviewed songs
  useEffect(() => {
    async function fetchTopReviewed() {
      try {
        if (!auth.currentUser || !auth.currentUser.uid) {
          console.error("User is not authenticated.");
          return;
        }
        const resp = await getTopReviews(auth.currentUser.uid);
        if (resp.ok) {
          const data = await resp.json();
          const formattedData = data.topSongsByReviews.map((song) => ({
            listenableId: song.listenableId,
            title: song.title,
            reviewCount: song.reviewCount,
            artist: song.artist,
            coverArt: song.coverArt,
            track: song.track, // Include the track object for navigation
          }));
          setTopReviewed(formattedData);
        } else {
          console.error("Failed to fetch top reviewed songs:", resp.status);
        }
      } catch (error) {
        console.error("Error fetching top reviewed songs:", error);
      }
    }
    fetchTopReviewed();
  }, []);

  // Fetch top liked songs
  useEffect(() => {
    async function fetchTopLiked() {
      try {
        if (!auth.currentUser || !auth.currentUser.uid) {
          console.error("User is not authenticated.");
          return;
        }
        const resp = await getTopSongs(auth.currentUser.uid);
        if (resp.ok) {
          const data = await resp.json();
          const formattedData = data.topSongsByLikes.map((song) => ({
            listenableId: song.listenableId,
            title: song.title,
            likes: song.likes,
            artist: song.artist,
            coverArt: song.coverArt,
            track: song.track, // Include the track object for navigation
          }));
          setTopLiked(formattedData);
        } else {
          console.error("Failed to fetch top liked songs:", resp.status);
        }
      } catch (error) {
        console.error("Error fetching top liked songs:", error);
      }
    }
    fetchTopLiked();
  }, []);

  // Fetch recommended songs
  useEffect(() => {
    async function fetchRecommendedSongs() {
      try {
        if (!auth.currentUser || !auth.currentUser.uid) {
          console.error("User is not authenticated.");
          return;
        }
        const resp = await getRecommendedSongs(auth.currentUser.uid);
        if (resp.ok) {
          const data = await resp.json();
          const formattedData = data.recommendedSongs.map((song) => ({
            listenableId: song.listenableId,
            title: song.title,
            artist: song.artist.name,
            coverArt: song.coverArt,
            playbackUrl: song.playbackUrl,
          }));
          setRecommendedSongs(formattedData.slice(0, 10)); // Limit to 10 songs
        } else {
          console.error("Failed to fetch recommended songs:", resp.status);
        }
      } catch (error) {
        console.error("Error fetching recommended songs:", error);
      }
    }
    fetchRecommendedSongs();
  }, []);

  const renderTrackCard = ({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("SongPage", {
          track: {
            id: item.listenableId, // Unique identifier for the track
            name: item.title, // Track title
            artist: item.artist, // Artist name
            image: item.coverArt, // Album art URL
            previewUrl: item.playbackUrl || null, // Preview URL (if available)
            type: "track", // Specify the type as "track"
          },
        })
      }
    >
      <View style={styles.trackCard}>
        <Image source={{ uri: item.coverArt }} style={styles.trackImage} />
        <Text style={styles.trackName} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1} ellipsizeMode="tail">
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
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
      <View style={{ marginBottom: 100 }}>
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
                  keyExtractor={(item) => item.listenableId} // Use listenableId as the unique key
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>

              {/* Top Liked Section */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>Top Liked</Text>
                <FlatList
                  data={topLiked}
                  renderItem={renderTrackCard}
                  keyExtractor={(item) => item.listenableId} // Use listenableId as the unique key
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>

              {/* Recommended by Genre Section */}
              <View style={styles.cardSection}>
                <Text style={styles.sectionTitle}>Recommended by Genre</Text>
                <FlatList
                  data={recommendedSongs}
                  renderItem={renderTrackCard}
                  keyExtractor={(item) => item.listenableId} // Use listenableId as the unique key
                  horizontal
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            </>
          }
        />
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
    width: 100, // Match the width of the image
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
    textAlign: "center",
    width: "100%", // Ensure text stays within the card width
  },
  trackArtist: {
    fontSize: 12,
    color: "#aaa",
    textAlign: "center",
    width: "100%", // Ensure text stays within the card width
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  }
});
