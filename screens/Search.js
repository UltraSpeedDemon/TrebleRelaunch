import React, { useReducer, useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
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
import { followUser, unfollowUser, postSearchResults } from "../providers/rest";
import colours from "../styles/colours";

export default function Search({ navigation, route }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchResult, setSearchResults] = useState(null);
  const [followingUsers, setFollowingUsers] = useState({});
  const { searchQuery } = route.params;

  // Custom hook to fetch the current user data
  const {
    username,
    userId,
    isSpotifyLinked,
    spotifyAccessToken,
    spotifyRefreshToken,
    loading,
  } = useFetchUserData();

  // Fetch search results from backend
  async function getSearchResults() {
    try {
      const results = await postSearchResults(searchQuery, auth.currentUser.uid);
      const json = await results.json();
      console.log("Search results:", json); // Debug: see the entire result array
      setSearchResults(json);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }

  // Reducer for toggling filters: songs, albums, artists, users
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

  useEffect(() => {
    getSearchResults();
  }, []);

  // Follow/unfollow user
  const handleFollow = async (user) => {
    try {
      console.log("Following user:", user);
      const response = await followUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: true }));
        console.log("Successfully followed user:", user.userId);
      } else {
        console.log("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const handleUnfollow = async (user) => {
    try {
      console.log("Unfollowing user:", user.userId);
      const response = await unfollowUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: false }));
        console.log("Successfully unfollowed user:", user.userId);
      } else {
        console.log("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  // Which sections to show
  const shouldShowTrack = !filter.albumOnly && !filter.artistOnly && !filter.userOnly;
  const shouldShowAlbum = !filter.songOnly && !filter.artistOnly && !filter.userOnly;
  const shouldShowArtist = !filter.songOnly && !filter.albumOnly && !filter.userOnly;
  const shouldShowUser = !filter.songOnly && !filter.albumOnly && !filter.artistOnly;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <SearchBar />

      {/* Notifications Icon */}
      <TouchableOpacity
        style={styles.notificationsIcon}
        onPress={() => navigation.navigate("Notifications")}
      >
        <Image
          source={require("../images/notificationsIcon2.png")}
          style={styles.notifIcon}
        />
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
                      
                        // Adjust condition if your backend uses "song" instead of "track"
                        if (item.type === "track") {
                          console.log("Navigating to SongPage with item:", item.id);
                          return (
                              <MusicCard
                              key={item.id}
                              id={item.id}
                              image={item.image}
                              name={item.name}
                              artist={item.artist}
                              album={item.album}
                              // When the card is pressed, go to SongPage
                              onPressCard={() =>
                                navigation.navigate("SongPage", {
                                  track: item, // pass the full track object or just an ID
                                })
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
                            // Press goes to AlbumPage with { album: item }
                            onPressCard={() =>
                              navigation.navigate("AlbumPage", {
                                album: item, // <-- pass it as 'album'
                              })
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
                            navigation.navigate("ArtistPage", {
                              artist: item, // pass the data as 'artist'
                            })
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

                          const onFollow = !isCurrentUser
                            ? () => {
                                if (isFollowing) handleUnfollow(item);
                                else handleFollow(item);
                              }
                            : undefined;

                          const canFollow = !isCurrentUser;
                          return (
                            <MusicCard
                              key={item.userId}
                              id={item.userId}
                              name={item.username}
                              image={item.avatar}
                              onFollow={onFollow}
                              isFollowing={isFollowing}
                              userCard={true}
                              canFollow={canFollow}
                              // Navigate to user profile on card press
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
    gap: 10,
    marginLeft: 18,
    marginVertical: 10,
  },
});
