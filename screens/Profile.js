import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { auth } from '../utils/firebase';
import {
  getUser,
  getUserReview,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
} from '../providers/rest';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';
import ReviewCard from '../components/Review';

export default function Profile({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [followers, setFollowers] = useState(420);
  const [following, setFollowing] = useState(51);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Initially set avatar to default local image
  const [avatar, setAvatar] = useState(require('../images/avatarIcon.png'));
  const noAvatar = require('../images/avatarIcon.png');

  // Top Tracks / Top Rated placeholders (just as before)
  const [topTracks, setTopTracks] = useState([
    {
      id: '1',
      name: 'I Wonder',
      artist: 'Kanye West',
      image: require('../images/albumImage.jpg'),
    },
    {
      id: '2',
      name: 'Stronger',
      artist: 'Kanye West',
      image: require('../images/albumImage.jpg'),
    },
    {
      id: '3',
      name: 'Gold Digger',
      artist: 'Kanye West',
      image: require('../images/albumImage.jpg'),
    },
  ]);
  const [topRated, setTopRated] = useState([
    {
      id: '1',
      name: 'Stronger',
      artist: 'Kanye West',
      rating: 5,
      image: require('../images/albumImage.jpg'),
    },
    {
      id: '2',
      name: 'Gold Digger',
      artist: 'Kanye West',
      rating: 4,
      image: require('../images/albumImage.jpg'),
    },
  ]);

  // The activity feed (array of reviews for the current user).
  const [activity, setActivity] = useState([]);
  // Optionally track total reviews count
  const [totalReviews, setTotalReviews] = useState(0);

  // Capitalize the first letter of the username
  const formatUsername = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Fetch user data (and their reviews) on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigation.navigate('Home');
          return;
        }
        const resp = await getUser(currentUser.uid);
        if (!resp.ok) {
          throw new Error('Failed to fetch user data from backend.');
        }
        const userData = await resp.json();
        console.log('DEBUG: Fetched user data:', userData);

        setUsername(userData.username || '');
        setEmail(userData.email || '');
        setFollowers(userData.followersCount || 0);
        setFollowing(userData.followingCount || 0);
        setIsSpotifyLinked(!!userData.spotifyAccessToken);
        setIsAdmin(userData.isAdmin || false);

        // Check avatar
        if (
          userData.avatar &&
          userData.avatar !== 'None' &&
          (userData.avatar.startsWith('data:') || userData.avatar.startsWith('http'))
        ) {
          setAvatar({ uri: userData.avatar });
        } else {
          setAvatar(noAvatar);
        }

        // Now fetch the user's reviews to populate the activity feed
        const reviewsResp = await getUserReview(currentUser.uid);
        if (reviewsResp.ok) {
          const userReviews = await reviewsResp.json();
          console.log('DEBUG: Fetched user reviews:', userReviews);
          setActivity(userReviews);
          setTotalReviews(userReviews.length);
        } else {
          console.error('Failed to fetch user reviews');
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

  // Upvote logic
  const handleUpvote = async (reviewId) => {
    const rev = activity.find((r) => r.id === reviewId);
    if (!rev) return;

    try {
      if (!rev.upvoted) {
        await upvoteReview(reviewId);
      } else {
        await removeUpvoteFromReview(reviewId);
      }
      // Update state
      setActivity((prev) =>
        prev.map((item) =>
          item.id === reviewId
            ? {
                ...item,
                upvotes: rev.upvoted ? item.upvotes - 1 : item.upvotes + 1,
                upvoted: !item.upvoted,
              }
            : item
        )
      );
    } catch (err) {
      console.error('Error upvoting review:', err);
    }
  };

  // Delete logic
  const handleDelete = async (reviewId) => {
    const rev = activity.find((r) => r.id === reviewId);
    if (!rev) return;

    try {
      // If you want to check if the user is the owner, ensure rev.isUser or compare user IDs
      if (rev.isUser) {
        await deleteReview(reviewId);
      }
      setActivity((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Renders a single top track item
  const renderTrack = ({ item }) => (
    <View style={styles.trackCard}>
      <Image source={item.image} style={styles.trackImage} />
      <Text style={styles.trackName}>{item.name}</Text>
      <Text style={styles.trackArtist}>{item.artist}</Text>
    </View>
  );

  // Renders a single top rated item
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
                ? require('../images/starFullIcon.png')
                : require('../images/starEmptyIcon.png')
            }
            style={styles.starIcon}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar />
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Image source={avatar} style={styles.avatar} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.username}>{formatUsername(username)}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('FollowersList')}>
                <Text style={styles.stats}>Followers: {followers}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('FollowingList')}>
                <Text style={styles.stats}>Following: {following}</Text>
              </TouchableOpacity>
              {(isSpotifyLinked || isAdmin) && (
                <View style={styles.badgeContainer}>
                  {isSpotifyLinked && (
                    <Image
                      source={require('../images/spotifyLogo.png')}
                      style={styles.badgeIcon}
                    />
                  )}
                  {isAdmin && (
                    <Image
                      source={require('../images/adminBadge.png')}
                      style={styles.badgeIcon}
                    />
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: colours.lightblue }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        }
        data={[]}
        ListFooterComponent={
          <>
            {/* Top Tracks */}
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

            {/* Top Rated */}
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

            {/* Activity (User Reviews) */}
            <View style={styles.cardSectionActivity}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.totalActivity}>Total Reviews: {totalReviews}</Text>
              <FlatList
                data={activity}
                renderItem={({ item }) => (
                  <ReviewCard
                    item={item}
                    handleUpvote={handleUpvote}
                    handleDelete={handleDelete}
                    navigation={navigation}
                  />
                )}
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
    position: 'absolute',
    top: 40,
    right: 525,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
    color: colours.lightblue,
  },
  stats: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  badgeIcon: {
    width: 24,
    height: 24,
    marginRight: 5,
  },
  editButton: {
    padding: 10,
    borderRadius: 5,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  cardSectionActivity: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
    marginBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colours.lightblue,
    marginBottom: 10,
  },
  trackCard: {
    marginRight: 10,
    alignItems: 'center',
  },
  trackImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 5,
  },
  trackName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  trackArtist: {
    fontSize: 12,
    color: '#aaa',
  },
  ratingContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  starIcon: {
    width: 16,
    height: 16,
    marginRight: 2,
  },
  totalActivity: {
    fontSize: 14,
    marginBottom: 7,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
});
