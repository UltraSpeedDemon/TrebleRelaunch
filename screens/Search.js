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
  const [followingUsers, setFollowingUsers] = useState({}); // track followed users by their ID
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

  // Fetch search results from your backend
  async function getSearchResults() {
    try {
      const results = await postSearchResults(searchQuery, auth.currentUser.uid);
      const json = await results.json();
      setSearchResults(json);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }

  // Filter state + reducer for toggling between songs, albums, artists, users
  const [filter, dispatchFilter] = useReducer(
    (state, action) => {
      let { type } = action;
      switch (type) {
        case "TOGGLE_SONG":
          return {
            songOnly: state.songOnly
              ? false
              : !state.albumOnly && !state.artistOnly && !state.userOnly,
            albumOnly: false,
            artistOnly: false,
            userOnly: false,
          };
        case "TOGGLE_ALBUM":
          return {
            songOnly: false,
            albumOnly: state.albumOnly
              ? false
              : !state.songOnly && !state.artistOnly && !state.userOnly,
            artistOnly: false,
            userOnly: false,
          };
        case "TOGGLE_ARTIST":
          return {
            songOnly: false,
            albumOnly: false,
            artistOnly: state.artistOnly
              ? false
              : !state.songOnly && !state.albumOnly && !state.userOnly,
            userOnly: false,
          };
        case "TOGGLE_USER":
          return {
            songOnly: false,
            albumOnly: false,
            artistOnly: false,
            userOnly: state.userOnly
              ? false
              : !state.songOnly && !state.albumOnly && !state.artistOnly,
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

  // Handle following a user
  const handleFollow = async (user) => {
    try {
      console.log("Following user:", user);
      const response = await followUser(auth.currentUser.uid, user.userId);
      if (response.ok) {
        setFollowingUsers((prev) => ({ ...prev, [user.userId]: true }));
      } else {
        console.log("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  // Handle unfollowing a user
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
              <View>
                {searchResult && Array.isArray(searchResult) ? (
                  <View key="searchResults">
                    {/* Filter Chips */}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        marginLeft: 18,
                        marginVertical: 10,
                      }}
                    >
                      <Chip
                        key="songsChip"
                        title="Songs"
                        onPress={() => dispatchFilter({ type: "TOGGLE_SONG" })}
                        type={filter.songOnly ? "solid" : "outline"}
                      />
                      <Chip
                        key="albumsChip"
                        title="Albums"
                        onPress={() => dispatchFilter({ type: "TOGGLE_ALBUM" })}
                        type={filter.albumOnly ? "solid" : "outline"}
                      />
                      <Chip
                        key="artistsChip"
                        title="Artists"
                        onPress={() =>
                          dispatchFilter({ type: "TOGGLE_ARTIST" })
                        }
                        type={filter.artistOnly ? "solid" : "outline"}
                      />
                      <Chip
                        key="usersChip"
                        title="Users"
                        onPress={() => dispatchFilter({ type: "TOGGLE_USER" })}
                        type={filter.userOnly ? "solid" : "outline"}
                      />
                    </View>

                    {/* Songs Section */}
                    {!(filter.albumOnly || filter.artistOnly || filter.userOnly) && (
                      <View key="SongsView">
                        <SectionDivider key="Songs" title="Songs" nonfirst={false} />
                        {searchResult.map((result) => {
                          if (result.type === "track") {
                            return (
                              <TouchableOpacity
                                key={result.id}
                                onPress={() =>
                                  navigation.navigate("Posts", {
                                    post: result,
                                    posts: searchResult,
                                  })
                                }
                              >
                                <MusicCard
                                  id={result.id}
                                  image={result.image}
                                  name={result.name}
                                  artist={result.artist}
                                  album={result.album}
                                />
                              </TouchableOpacity>
                            );
                          }
                          return null;
                        })}
                      </View>
                    )}

                    {/* Albums Section */}
                    {!(filter.songOnly || filter.artistOnly || filter.userOnly) && (
                      <View key="AlbumsView">
                        <SectionDivider
                          key="Albums"
                          title="Albums"
                          nonfirst={!filter.albumOnly}
                        />
                        {searchResult.map((result) => {
                          if (result.type === "album") {
                            return (
                              <MusicCard
                                key={result.id}
                                id={result.id}
                                image={result.image}
                                name={result.name}
                                artist={result.artist}
                              />
                            );
                          }
                          return null;
                        })}
                      </View>
                    )}

                    {/* Artists Section */}
                    {!(filter.songOnly || filter.albumOnly || filter.userOnly) && (
                      <View key="ArtistsView">
                        <SectionDivider
                          key="Artists"
                          title="Artists"
                          nonfirst={!filter.artistOnly}
                        />
                        {searchResult.map((result) => {
                          if (result.type === "artist") {
                            return (
                              <MusicCard
                                key={result.id}
                                id={result.id}
                                image={result.image}
                                artist={result.name}
                              />
                            );
                          }
                          return null;
                        })}
                      </View>
                    )}

                    {/* Users Section */}
                    {!(filter.songOnly || filter.albumOnly || filter.artistOnly) && (
                      <View key="UsersView">
                        <SectionDivider
                          key="Users"
                          title="Users"
                          nonfirst={!filter.userOnly}
                        />
                        {searchResult.map((result) => {
                          if (result.type === "user") {
                            const isCurrentUser = result.userId === auth.currentUser.uid;
                            const isFollowing = followingUsers.hasOwnProperty(result.userId)
                              ? followingUsers[result.userId]
                              : result.isFollowing;

                            const onFollow = !isCurrentUser
                              ? () => {
                                  console.log("onFollow triggered for user", result.userId);
                                  return isFollowing
                                    ? handleUnfollow(result)
                                    : handleFollow(result);
                                }
                              : undefined;

                            const canFollow = !isCurrentUser;
                            return (
                              <MusicCard
                                key={result.userId}
                                id={result.userId}
                                name={result.username}
                                image={result.avatar}
                                onFollow={onFollow}
                                isFollowing={isFollowing}
                                userCard={true}
                                canFollow={canFollow}
                                
                                // Navigate to the user profile on card press
                                onPressCard={() =>
                                  navigation.navigate("UserProfiles", {
                                    userId: result.userId,
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
                ) : (
                  <ActivityIndicator size="large" color="#4CAF50" />
                )}
              </View>
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
  },
  searchInput: {
    fontSize: 16,
    color: "#fff",
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
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  subText: {
    fontSize: 16,
    color: colours.darkblue,
    marginTop: 10,
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
  onTop: {
    zIndex: 999,
  },
  musicCard: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  musicInfo: {
    right: 1,
    width: "80%",
  },
});
