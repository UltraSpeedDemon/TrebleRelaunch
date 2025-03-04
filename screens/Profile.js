import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { auth } from '../utils/firebase';
import { getUser } from '../providers/rest';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';
import { FlatList } from 'react-native-gesture-handler';

export default function Profile({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [followers, setFollowers] = useState(420);
  const [following, setFollowing] = useState(51);
  const [reviews, setReviews] = useState(3);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  // Store the avatar as an object: either { uri: ... } or a local image
  const [avatar, setAvatar] = useState(require('../images/avatarIcon.png'));

  const noAvatar = require('../images/avatarIcon.png');
  const [topTracks, setTopTracks] = useState([
    {
      id: "1",
      name: "I Wonder",
      artist: "Kanye West",
      image: require("../images/albumImage.jpg"),
    },
    {
      id: "2",
      name: "Stronger",
      artist: "Kanye West",
      image: require("../images/albumImage.jpg"),
    },
    {
      id: "3",
      name: "Gold Digger",
      artist: "Kanye West",
      image: require("../images/albumImage.jpg"),
    },
  ]);

  const [topRated, setTopRated] = useState([
    {
      id: "1",
      name: "Stronger",
      artist: "Kanye West",
      rating: 5,
      image: require("../images/albumImage.jpg"),
    },
    {
      id: "2",
      name: "Gold Digger",
      artist: "Kanye West",
      rating: 4,
      image: require("../images/albumImage.jpg"),
    },
  ]);

  const [activity, setActivity] = useState([
    {
      id: "1",
      username: "Ultra",
      text: "\"I Wonder\" from Kanye West's critically acclaimed album Graduation (2007), is a masterful blend of introspection, ambition, and sonic innovation.",
      upvotes: 2000,
      emojis: { heart: 10, cry: 2 },
    },
    {
      id: "2",
      username: "Ultra",
      text: "\"I Wonder\" from Kanye West's critically acclaimed album Graduation (2007), is a masterful blend of introspection, ambition, and sonic innovation.",
      upvotes: 2000,
      emojis: { heart: 10, cry: 2 },
    },
    {
      id: "3",
      username: "Ultra",
      text: "\"I Wonder\" from Kanye West's critically acclaimed album Graduation (2007), is a masterful blend of introspection, ambition, and sonic innovation.",
      upvotes: 2000,
      emojis: { heart: 10, cry: 2 },
    },
  ]);

  // Helper: Capitalize the first letter of the username.
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          setEmail(currentUser.email || '');
          const response = await getUser(currentUser.uid);
          if (!response.ok) {
            throw new Error('Failed to fetch user data from backend.');
          }
          const userData = await response.json();
          setUsername(userData.username || '');
          setEmail(userData.email || '');
          // Use the backend avatar if present (and not "None")
          if (userData.avatar && userData.avatar !== "None") {
            setAvatar({ uri: userData.avatar });
          } else {
            setAvatar(noAvatar);
          }
          // Check for Spotify token
          if (userData.spotifyAccessToken && userData.spotifyAccessToken !== "") {
            setIsSpotifyLinked(true);
          } else {
            setIsSpotifyLinked(false);
          }

          setFollowers(userData.followersCount || 0);
          setFollowing(userData.followingCount || 0);

        } else {
          navigation.navigate('Home');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Unable to fetch user data.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  const renderTrack = ({ item }) => (
    <View style={styles.trackCard}>
      <Image source={item.image} style={styles.trackImage} />
      <Text style={styles.trackName}>{item.name}</Text>
      <Text style={styles.trackArtist}>{item.artist}</Text>
    </View>
  );

  const renderTopRated = ({ item }) => (
    <View style={styles.trackCard}>
      <Image source={item.image} style={styles.trackImage} />
      <Text style={styles.trackName}>{item.name}</Text>
      <Text style={styles.trackArtist}>{item.artist}</Text>
      <View style={styles.ratingContainer}>
        {[...Array(5)].map((_, index) => (
          <Image
            key={index}
            source={
              index < item.rating
                ? require("../images/starFullIcon.png")
                : require("../images/starEmptyIcon.png")
            }
            style={styles.starIcon}
          />
        ))}
      </View>
    </View>
  );

  const renderActivity = ({ item }) => (
    <View style={styles.activityCard}>
      <Text style={styles.activityUsername}>{item.username}</Text>
      <Text style={styles.activityText}>{item.text}</Text>
      <View style={styles.activityFooter}>
        <Text style={styles.upvotes}>{item.upvotes} Upvotes</Text>
        <Text style={styles.emojis}>❤️ {item.emojis.heart} 😢 {item.emojis.cry}</Text>
      </View>
    </View>
  );
  
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar />
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
              <Image source={avatar} style={styles.avatar} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.username}>{formatUsername(username)}</Text>
              <TouchableOpacity onPress={() => navigation.navigate("FollowersList")}>
                <Text style={styles.stats}>Followers: {followers}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate("FollowingList")}>
                <Text style={styles.stats}>Following: {following}</Text>
              </TouchableOpacity>
              {/* Show Spotify logo below following if linked */}
              {isSpotifyLinked && (
                <View style={styles.spotifyContainer}>
                  <Image
                    source={require("../images/spotifyLogo.png")}
                    style={styles.spotifyLogo}
                  />
                  <Text style={styles.spotifyText}>Spotify Connected</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: colours.lightblue }]}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        }
        data={[]}
        ListFooterComponent={
          <>
            {/* Top Tracks Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Tracks</Text>
              <FlatList
                data={topTracks}
                renderItem={renderTrack}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Top Rated Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Rated</Text>
              <FlatList
                data={topRated}
                renderItem={renderTopRated}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Activity Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.stats}>Total Reviews: {reviews}</Text>
              <FlatList
                data={activity}
                renderItem={renderActivity}
                keyExtractor={(item) => item.id}
              />
            </View>
          </>
        }
      />

      {/* Bottom Navigation */}
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
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    marginTop: 120,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  stats: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  spotifyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  spotifyLogo: {
    width: 24,
    height: 24,
    marginRight: 5,
    // Ensure no tintColor is applied
  },
  spotifyText: {
    color: "#fff",
    fontSize: 14,
  },
  editButton: {
    padding: 10,
    borderRadius: 5,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "bold",
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
  ratingContainer: {
    flexDirection: "row",
    marginTop: 5,
  },
  starIcon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  activityCard: {
    backgroundColor: "#1E1E2C",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  activityUsername: {
    fontSize: 14,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  activityText: {
    fontSize: 12,
    color: "#fff",
    marginBottom: 5,
  },
  activityFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  upvotes: {
    fontSize: 12,
    color: "#fff",
  },
  emojis: {
    fontSize: 12,
    color: "#fff",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
