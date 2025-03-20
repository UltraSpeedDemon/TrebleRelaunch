import React, { useReducer, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { Chip } from "@rneui/base";
import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import BottomNavbar from "../components/BottomNavbar";
import useFetchUserData from "../hooks/useFetchUserData";
import SectionDivider from "../components/SectionDivider";
import MusicCard from "../components/MusicCard";
import {
  followUser,
  unfollowUser,
  postSearchResults,
  getFollowRequests,
  requestFollow,
} from "../providers/rest"; // REMOVED getFollowers, getFriends
import colours from "../styles/colours";

export default function Search({ navigation, route }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchResult, setSearchResults] = useState(null);
  const [followingUsers, setFollowingUsers] = useState({});
  const [notificationsCount, setNotificationsCount] = useState(0);
  // Dictionary to track follow-request status per user
  const [followRequests, setFollowRequests] = useState({});

  const { searchQuery } = route.params;

  // Get current user data
  const {
    username,
    userId: currentUserId,
    isSpotifyLinked,
    spotifyAccessToken,
    spotifyRefreshToken,
    loading,
    isPublic: currentUserIsPublic,
    avatar: currentUserAvatar,
  } = useFetchUserData();

  // Fetch search results
  async function getSearchResults() {
    try {
      const results = await postSearchResults(searchQuery, auth.currentUser.uid);
      const json = await results.json();
      console.log("Search results:", json);
      setSearchResults(json);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }

  // Reducer for toggling filters: Songs, Albums, Artists, Users
  const [filter, dispatchFilter] = useReducer(
    (state, action) => {
      switch (action.type) {
        case "TOGGLE_SONG":
          return {
            songOnly: !state.songOnly,
            albumOnly: false,
            artistOnly: false,
            userOnly: false,
          };
        case "TOGGLE_ALBUM":
          return {
            songOnly: false,
            albumOnly: !state.albumOnly,
            artistOnly: false,
            userOnly: false,
          };
        case "TOGGLE_ARTIST":
          return {
            songOnly: false,
            albumOnly: false,
            artistOnly: !state.artistOnly,
            userOnly: false,
          };
        case "TOGGLE_USER":
          return {
            songOnly: false,
            albumOnly: false,
            artistOnly: false,
            userOnly: !state.userOnly,
          };
        default:
          return state;
      }
    },
    {
      songOnly: false,
      albumOnly: false,
      artistOnly: false,
      userOnly: false,
    }
  );

  // 1) Fetch search results on mount
  useEffect(() => {
    getSearchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Fetch notifications count
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

  // 3) Check if the current user already requested to follow each user
  useEffect(() => {
    async function checkFollowRequestForUser(userId) {
      try {
        const resp = await getFollowRequests(userId);
        if (resp.ok) {
          const requests = await resp.json();
          const alreadyRequested = requests.some(
            (req) => req.userId === auth.currentUser.uid
          );
          setFollowRequests((prev) => ({ ...prev, [userId]: alreadyRequested }));
        }
      } catch (error) {
        console.error(
          "Error fetching follow request status for user",
          userId,
          error
        );
      }
    }
    if (searchResult) {
      searchResult.forEach((item) => {
        if (item.type === "user") {
          checkFollowRequestForUser(item.userId);
        }
      });
    }
  }, [searchResult]);

  // Follow a user (or request to follow if private)
  async function handleFollow(targetUser) {
    const userIsPublic =
      targetUser.isPublic === true || targetUser.isPublic === "true";
    if (userIsPublic) {
      try {
        const resp = await followUser(auth.currentUser.uid, targetUser.userId);
        if (resp.ok) {
          setFollowingUsers((prev) => ({ ...prev, [targetUser.userId]: true }));
        }
      } catch (error) {
        console.error("Error following user:", error);
      }
    } else {
      // private => request
      if (!followRequests[targetUser.userId]) {
        try {
          const resp = await requestFollow(auth.currentUser.uid, targetUser.userId);
          if (resp.ok) {
            setFollowRequests((prev) => ({ ...prev, [targetUser.userId]: true }));
            Alert.alert(
              "Request Sent",
              "Your request to follow this private account was sent."
            );
          } else {
            console.error("Failed to request follow");
          }
        } catch (error) {
          console.error("Error requesting follow:", error);
        }
      }
    }
  }

  // Unfollow
  async function handleUnfollow(targetUser) {
    try {
      const response = await unfollowUser(auth.currentUser.uid, targetUser.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [targetUser.userId]: false }));
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  }

  // Helper: Capitalize the first letter
  const formatUsername = (name) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Helper: Fallback if no base64
  const getAvatarSource = (avatar) => {
    const fallback = require("../images/avatarIcon.png");
    return avatar && avatar.startsWith("data:") ? { uri: avatar } : fallback;
  };

  // Decide which sections to show
  const shouldShowTrack =
    !filter.albumOnly && !filter.artistOnly && !filter.userOnly;
  const shouldShowAlbum =
    !filter.songOnly && !filter.artistOnly && !filter.userOnly;
  const shouldShowArtist =
    !filter.songOnly && !filter.albumOnly && !filter.userOnly;
  const shouldShowUser =
    !filter.songOnly && !filter.albumOnly && !filter.artistOnly;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar />

      {/* Notifications Icon + Badge */}
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
      <View style={styles.content}>
        <SafeAreaProvider>
          <SafeAreaView>
            <ScrollView>
              {!searchResult ? (
                <ActivityIndicator size="large" color="#4CAF50" />
              ) : (
                <View key="searchResults">
                  {/* Filter Chips */}
                  <View style={styles.chipContainer}>
                    <Chip
                      title="Songs"
                      onPress={() => dispatchFilter({ type: "TOGGLE_SONG" })}
                      type={filter.songOnly ? "solid" : "outline"}
                    />
                    <Chip
                      title="Albums"
                      onPress={() => dispatchFilter({ type: "TOGGLE_ALBUM" })}
                      type={filter.albumOnly ? "solid" : "outline"}
                    />
                    <Chip
                      title="Artists"
                      onPress={() => dispatchFilter({ type: "TOGGLE_ARTIST" })}
                      type={filter.artistOnly ? "solid" : "outline"}
                    />
                    <Chip
                      title="Users"
                      onPress={() => dispatchFilter({ type: "TOGGLE_USER" })}
                      type={filter.userOnly ? "solid" : "outline"}
                    />
                  </View>

                  {/* Songs Section */}
                  {shouldShowTrack && (
                    <View key="SongsView">
                      <SectionDivider title="Songs" />
                      {searchResult.map((item) => {
                        if (item.type === "track") {
                          return (
                            <MusicCard
                              key={item.id}
                              id={item.id}
                              image={item.image}
                              name={item.name}
                              artist={item.artist}
                              album={item.album}
                              onPressCard={() =>
                                navigation.navigate("SongPage", { track: item })
                              }
                            />
                          );
                        }
                        return null;
                      })}
                    </View>
                  )}

                  {/* Albums Section */}
                  {shouldShowAlbum && (
                    <View key="AlbumsView">
                      <SectionDivider title="Albums" />
                      {searchResult.map((item) => {
                        if (item.type === "album") {
                          return (
                            <MusicCard
                              key={item.id}
                              id={item.id}
                              image={item.image}
                              name={item.name}
                              artist={item.artist}
                              onPressCard={() =>
                                navigation.navigate("AlbumPage", { album: item })
                              }
                            />
                          );
                        }
                        return null;
                      })}
                    </View>
                  )}

                  {/* Artists Section */}
                  {shouldShowArtist && (
                    <View key="ArtistsView">
                      <SectionDivider title="Artists" />
                      {searchResult.map((item) => {
                        if (item.type === "artist") {
                          return (
                            <MusicCard
                              key={item.id}
                              id={item.id}
                              image={item.image}
                              artist={item.name}
                              onPressCard={() =>
                                navigation.navigate("ArtistPage", { artist: item })
                              }
                            />
                          );
                        }
                        return null;
                      })}
                    </View>
                  )}

                  {/* Users Section */}
                  {shouldShowUser && (
                    <View key="UsersView">
                      <SectionDivider title="Users" />
                      {searchResult.map((item) => {
                        if (item.type === "user") {
                          const isCurrentUser = item.userId === auth.currentUser.uid;
                          const isFollowing = followingUsers.hasOwnProperty(item.userId)
                            ? followingUsers[item.userId]
                            : item.isFollowing;
                          const alreadyRequested =
                            followRequests[item.userId] || false;

                          // Convert isPublic to boolean
                          const userIsPublic =
                            item.isPublic === true || item.isPublic === "true";
                          let finalButtonLabel = "Follow";
                          if (isFollowing) {
                            finalButtonLabel = "Following";
                          } else if (!userIsPublic && alreadyRequested) {
                            finalButtonLabel = "Requested";
                          }

                          // Determine the correct avatar
                          const userAvatar = getAvatarSource(item.avatar);

                          const onFollow = !isCurrentUser
                            ? () => {
                                if (isFollowing) {
                                  handleUnfollow(item);
                                } else {
                                  handleFollow(item);
                                }
                              }
                            : undefined;

                          return (
                            <MusicCard
                              key={item.userId}
                              id={item.userId}
                              name={formatUsername(item.username)}
                              image={item.avatar}
                              isPublic={item.isPublic}
                              onFollow={onFollow}
                              isFollowing={isFollowing}
                              buttonLabel={finalButtonLabel}
                              userCard={true}
                              canFollow={!isCurrentUser}
                              onPressCard={() =>
                                navigation.navigate("UserProfiles", {
                                  userId: item.userId,
                                })
                              }
                            />
                          );
                        }
                        return null;
                      })}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },
  notificationsIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
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
    flex: 1,
    marginTop: 120,
    paddingBottom: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  chipContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginVertical: 10,
  },
});
