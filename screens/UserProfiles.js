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
  ScrollView,
} from 'react-native';
import { auth } from '../utils/firebase';
import { useRoute } from '@react-navigation/native';
import {
  getUser,
  getFollowers,
  getFriends,
  followUser,
  unfollowUser,
  requestFollow,
  getFollowRequests,
  getUserTopReviews,
  getUserFavorites,
  getUserMostUpvoted,
  getUserActivity,
  upvoteReview,
  removeUpvoteFromReview,
  deleteReview,
  getReviewSong, // New function for enriching reviews
} from '../providers/rest';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';
import ReviewCard from '../components/Review';

export default function UserProfiles({ navigation }) {
  const route = useRoute();
  const { userId } = route.params;


  // Basic user info
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(null);
  const noAvatar = require('../images/avatarIcon.png');

  // Followers & Friends
  const [theirFollowers, setTheirFollowers] = useState([]);
  const [myFriends, setMyFriends] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Account
  const [isPublic, setIsPublic] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Follow requests
  const [followRequested, setFollowRequested] = useState(false);

  // Review sections
  const [topReviews, setTopReviews] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [mostUpvoted, setMostUpvoted] = useState([]);
  const [activity, setActivity] = useState([]);
  const [totalReviews, setTotalReviews] = useState(0);

  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canViewFullContent, setCanViewFullContent] = useState(true);

  // Helper: capitalize first letter
  const formatUsername = (name) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };


  // Fetch data when userId changes
  useEffect(() => {
    fetchUserData();
    fetchTheirFollowers();
    fetchMyFriends();
  }, [userId]);

  useEffect(() => {
    async function checkFollowRequest() {
      try {
        const resp = await getFollowRequests(userId);
        if (resp.ok) {
          const requests = await resp.json();
          const alreadyRequested = requests.some(
            (req) => req.userId === auth.currentUser.uid
          );
          setFollowRequested(alreadyRequested);
        }
      } catch (error) {
        console.error('Error fetching follow request status:', error);
      }
    }
    checkFollowRequest();
  }, [userId]);

  async function fetchUserData() {
    try {
      setLoading(true);
      const resp = await getUser(userId);
      if (!resp.ok) throw new Error('Failed to fetch user data');
      const data = await resp.json();
      setUsername(data.username || '');
      setFollowersCount(data.followersCount || 0);
      setFollowingCount(data.followingCount || 0);
      setIsPublic(data.isPublic !== false);
      setIsSpotifyLinked(data.spotifyIsLinked === true);
      setIsAdmin(data.isAdmin || false);
      if (
        data.avatar &&
        data.avatar !== 'None' &&
        (data.avatar.startsWith('http') || data.avatar.startsWith('data:'))
      ) {
        setAvatar(data.avatar);
      } else {
        setAvatar(null);
      }
      const currentUserId = auth.currentUser?.uid;
      const isSelf = currentUserId === userId;
      const iAmFollowing = await checkIfImFollowing(userId);
      const canView = data.isPublic || isSelf || iAmFollowing;
      setCanViewFullContent(canView);
      if (canView) {
        await loadAllReviewsSections();
      } else {
        setTopReviews([]);
        setFavorites([]);
        setMostUpvoted([]);
        setActivity([]);
        setTotalReviews(0);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Unable to fetch user data.');
    } finally {
      setLoading(false);
    }
  }

  async function checkIfImFollowing(targetUserId) {
    try {
      const resp = await getFollowers(targetUserId);
      if (resp.ok) {
        const arr = await resp.json();
        return arr.some((f) => f.userId === auth.currentUser?.uid);
      }
    } catch (error) {
      console.error("Error checking if I'm following:", error);
    }
    return false;
  }

  async function fetchTheirFollowers() {
    try {
      const resp = await getFollowers(userId);
      if (resp.ok) {
        const arr = await resp.json();
        setTheirFollowers(arr);
      }
    } catch (error) {
      console.error('Error fetching their followers:', error);
    }
  }

  async function fetchMyFriends() {
    try {
      const resp = await getFriends(auth.currentUser.uid);
      if (resp.ok) {
        const friendsArr = await resp.json();
        setMyFriends(friendsArr);
      }
    } catch (error) {
      console.error('Error fetching my friends:', error);
    }
  }

  // Enrichment function – now attaches only the song's RID (plus type and listenableId)
  async function enrichReviewsWithSong(reviews) {
    const enriched = await Promise.all(
      reviews.map(async (review) => {
        if (!review.song) {
          try {
            console.log("DEBUG: Calling getReviewSong for", review.id);
            const response = await getReviewSong(userId, review.id);
            if (response && response.ok) {
              const songData = await response.json();
              // If the backend returns an object with a title then we assume we have valid song info.
              return songData;
            }
          } catch (err) {
            console.error("Error enriching review with song:", err);
          }
        }
        return review;
      })
    );
    return enriched;
  }


  async function loadAllReviewsSections() {
      try {
        const [topResp, favResp, upvotedResp, activityResp] = await Promise.all([
          getUserTopReviews(userId),
          getUserFavorites(userId),
          getUserMostUpvoted(userId),
          getUserActivity(userId),
        ]);
  
        if (topResp.ok) {
          let topData = await topResp.json();
          var topData2 = await enrichReviewsWithSong(topData);
  
          const enrichedReviews = topData.map((review, index) => ({
            ...review,
            song: topData2[index]
          }));
          
          setTopReviews(enrichedReviews);
          console.log("DEBUG: Enriched reviews:", enrichedReviews);
        }
        if (favResp.ok) {
          let favData = await favResp.json();
          var favData2 = await enrichReviewsWithSong(favData);
  
          const enrichedReviews = favData.map((review, index) => ({
            ...review,
            song: favData2[index]
          }));
          setFavorites(enrichedReviews);
        }
        if (upvotedResp.ok) {
          let upvotedData = await upvotedResp.json();
          var upvotedData2 = await enrichReviewsWithSong(upvotedData);
  
          const enrichedReviews = upvotedData.map((review, index) => ({
            ...review,
            song: upvotedData2[index]
          }));
  
          setMostUpvoted(enrichedReviews);
        }
        if (activityResp.ok) {
          let activityData = await activityResp.json();
          var activityData2 = await enrichReviewsWithSong(activityData);
  
          const enrichedReviews = activityData.map((review, index) => ({
            ...review,
            song: activityData2[index]
          }));
  
          setActivity(enrichedReviews);
          setTotalReviews(activityData.length);
        }
      } catch (err) {
        console.error("Error loading review sections:", err);
      }
    }

  // Helper: update a review array for a given reviewId
  const updateReviewArray = (array, reviewId) =>
    array.map((r) =>
      r.id === reviewId
        ? { ...r, upvotes: r.upvoted ? r.upvotes - 1 : r.upvotes + 1, upvoted: !r.upvoted }
        : r
    );

  // Updated upvote handler to mimic SongPage behavior
  const handleUpvote = async (reviewId) => {
    const combined = [...topReviews, ...favorites, ...mostUpvoted, ...activity];
    const rev = combined.find((r) => r.id === reviewId);
    if (!rev) return;
    try {
      if (!rev.upvoted) {
        await upvoteReview(reviewId);
      } else {
        await removeUpvoteFromReview(reviewId);
      }
      setTopReviews((prev) => updateReviewArray(prev, reviewId));
      setFavorites((prev) => updateReviewArray(prev, reviewId));
      setMostUpvoted((prev) => updateReviewArray(prev, reviewId));
      setActivity((prev) => updateReviewArray(prev, reviewId));
    } catch (err) {
      console.error('Error upvoting review:', err);
    }
  };

  const handleDelete = async (reviewId) => {
    const combined = [...topReviews, ...favorites, ...mostUpvoted, ...activity];
    const rev = combined.find((r) => r.id === reviewId);
    if (!rev) return;
    try {
      if (rev.isUser) {
        await deleteReview(reviewId);
      }
      await loadAllReviewsSections();
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  // Badge popup handlers
  const handleSpotifyBadgePress = () => {
    Alert.alert('Spotify Badge', 'User is linked to Spotify!');
  };
  const handleAdminBadgePress = () => {
    Alert.alert('Admin Badge', 'User is an Admin/Developer!');
  };

  // Follow logic
  const iAmFollowing = theirFollowers.some(
    (f) => f.userId === auth.currentUser.uid
  );
  const isInMyFriends = myFriends.some((fr) => fr.userId === userId);
  let finalButtonLabel = 'Follow';
  if (iAmFollowing || isInMyFriends) {
    finalButtonLabel = 'Following';
  } else if (!isPublic && followRequested) {
    finalButtonLabel = 'Requested';
  }
  const showFriendsLabel = isInMyFriends;

  async function handleFollowPress() {
    if (finalButtonLabel === 'Following') {
      try {
        const resp = await unfollowUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setFollowersCount((prev) => Math.max(0, prev - 1));
          await fetchTheirFollowers();
          setMyFriends((prev) => prev.filter((f) => f.userId !== userId));
        }
      } catch (error) {
        console.error('Error unfollowing user:', error);
      }
      return;
    }
    if (isPublic) {
      try {
        const resp = await followUser(auth.currentUser.uid, userId);
        if (resp.ok) {
          setFollowersCount((prev) => prev + 1);
          await fetchTheirFollowers();
          const updatedFriendsResp = await getFriends(auth.currentUser.uid);
          if (updatedFriendsResp.ok) {
            const updatedFriends = await updatedFriendsResp.json();
            setMyFriends(updatedFriends);
          }
        }
      } catch (error) {
        console.error('Error following user:', error);
      }
    } else {
      if (!followRequested) {
        try {
          const resp = await requestFollow(auth.currentUser.uid, userId);
          if (resp.ok) {
            setFollowRequested(true);
            Alert.alert('Request Sent', 'Your follow request was sent.');
          } else {
            console.error('Failed to request follow');
          }
        } catch (error) {
          console.error('Error requesting follow:', error);
        }
      }
    }
  }

  const currentUserId = auth.currentUser.uid;
  const isSelf = currentUserId === userId;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }
  if (!username) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>User not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('UserProfile', { userId: userId })
            }
          >
            <Image
              source={avatar ? { uri: avatar } : noAvatar}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.username}>{formatUsername(username)}</Text>
              <Text style={styles.stats}>Followers: {followersCount}</Text>
              <Text style={styles.stats}>Following: {followingCount}</Text>
            <View style={styles.badgeContainer}>
              {isSpotifyLinked && (
                <TouchableOpacity onPress={handleSpotifyBadgePress}>
                  <Image
                    source={require('../images/spotifyLogo.png')}
                    style={styles.badgeIcon}
                  />
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity onPress={handleAdminBadgePress}>
                  <Image
                    source={require('../images/adminBadge.png')}
                    style={styles.badgeIcon}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {!isSelf && (
            <View style={styles.followContainer}>
              <TouchableOpacity
                style={
                  finalButtonLabel === 'Requested'
                    ? styles.requestedButton
                    : styles.followButton
                }
                onPress={handleFollowPress}
                disabled={finalButtonLabel === 'Requested'}
              >
                <Text style={styles.followButtonText}>{finalButtonLabel}</Text>
              </TouchableOpacity>
              {showFriendsLabel && (
                <Text style={styles.friendText}>Friends</Text>
              )}
            </View>
          )}
        </View>

        {/* If account is private, show only the privacy message */}
        {!canViewFullContent ? (
          <View style={styles.privateContainer}>
            <Text style={styles.privateText}>
              User's Account is Private
            </Text>
            <Text style={styles.privateText2}>
              Request to follow to view their content.
            </Text>
          </View>
        ) : (
          <>
            {/* Top Reviews Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Top Reviews</Text>
              {topReviews.length === 0 ? (
                <Text style={styles.sectionPlaceholder}>No top reviews.</Text>
              ) : (
                <FlatList
                  data={topReviews}
                  horizontal
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.reviewSnippetCard}>
                      <ReviewCard
                        item={item}
                        avatar={avatar}
                        handleUpvote={handleUpvote}
                        handleDelete={handleDelete}
                        navigation={navigation}
                      />
                    </View>
                  )}
                />
              )}
            </View>

            {/* Favourites Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Favourites</Text>
              {favorites.length === 0 ? (
                <Text style={styles.sectionPlaceholder}>No favourites.</Text>
              ) : (
                <FlatList
                  data={favorites}
                  horizontal
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.reviewSnippetCard}>
                      <ReviewCard
                        item={item}
                        avatar={avatar}
                        handleUpvote={handleUpvote}
                        handleDelete={handleDelete}
                        navigation={navigation}
                      />
                    </View>
                  )}
                />
              )}
            </View>

            {/* Most Upvoted Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Most Upvoted</Text>
              {mostUpvoted.length === 0 ? (
                <Text style={styles.sectionPlaceholder}>
                  No most-upvoted reviews.
                </Text>
              ) : (
                <FlatList
                  data={mostUpvoted}
                  horizontal
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.reviewSnippetCard}>
                      <ReviewCard
                        item={item}
                        avatar={avatar}
                        handleUpvote={handleUpvote}
                        handleDelete={handleDelete}
                        navigation={navigation}
                      />
                    </View>
                  )}
                />
              )}
            </View>

            {/* Activity Section */}
            <View style={styles.cardSection}>
              <View style={styles.activityHeader}>
                <Text style={styles.sectionTitle}>Activity</Text>
                <Text style={styles.activitySubtitle}>Newest to Oldest</Text>
              </View>
              <Text style={styles.totalActivity}>
                Total Reviews: {totalReviews}
              </Text>
              {activity.length === 0 ? (
                <Text style={styles.sectionPlaceholder}>No reviews found.</Text>
              ) : (
                <View style={styles.activityContainer}>
                  {activity.map((item) => (
                    <View key={item.id} style={styles.activityReviewWrapper}>
                      <ReviewCard
                        item={item}
                        avatar={avatar}
                        handleUpvote={handleUpvote}
                        handleDelete={handleDelete}
                        navigation={navigation}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.bluegrey },
  scrollContainer: { paddingBottom: 120 },
  sideMenu: { position: 'absolute', top: 40, right: 525, bottom: 0, zIndex: 10 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginTop: 120,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 15 },
  headerInfo: { flex: 1 },
  username: { fontSize: 18, fontWeight: 'bold', color: colours.lightblue },
  stats: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  badgeIcon: { width: 24, height: 24, marginRight: 5 },
  editButton: { padding: 10, borderRadius: 5 },
  editButtonText: { color: '#fff', fontWeight: 'bold' },
  followContainer: { alignItems: 'center', marginLeft: 10 },
  followButton: {
    backgroundColor: colours.lightblue,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  requestedButton: {
    backgroundColor: '#999',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  followButtonText: { color: '#fff', fontWeight: 'bold' },
  friendText: { marginTop: 8, fontSize: 14, fontWeight: 'bold', color: '#fff' },
  cardSection: {
    backgroundColor: colours.darkblue,
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 10,
  },
  reviewSnippetCard: { width: 250, marginRight: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colours.lightblue },
  sectionPlaceholder: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
    marginVertical: 5,
  },
  totalActivity: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 7 },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  activitySubtitle: { fontSize: 12, color: '#ccc', fontStyle: 'italic' },
  activityContainer: { paddingHorizontal: 5 },
  activityReviewWrapper: { marginVertical: 5 },
  privateContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    alignItems: 'center',
  },
  privateText: {
    fontSize: 17,
    color: colours.lightblue,
    fontWeight: 'bold',
  },
  privateText2: {
    marginTop: 5,
    fontSize: 12,
    color: colours.secondaryblue,
    fontWeight: 'bold',
  },
  bottomNavBar: { position: 'absolute', bottom: 0, width: '100%' },
});
