import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Icon from "react-native-vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";

import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import { getUser } from "../providers/rest";
import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_CONTENT_WIDTH = 960;
const BOTTOM_NAV_HEIGHT = 72;

const MOCK_SONGS = [
  {
    id: "1",
    name: "Graduation",
    artist: "Kanye West",
    albumCover: require("../images/albumImage.jpg"),
  },
  {
    id: "2",
    name: "Certified Lover Boy",
    artist: "Drake",
    albumCover: require("../images/albumImage.jpg"),
  },
  {
    id: "3",
    name: "Midnights",
    artist: "Taylor Swift",
    albumCover: require("../images/albumImage.jpg"),
  },
  {
    id: "4",
    name: "DAMN.",
    artist: "Kendrick Lamar",
    albumCover: require("../images/albumImage.jpg"),
  },
];

export default function CreatePost({
  navigation,
}) {
  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact =
    width < 640;

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    postComment,
    setPostComment,
  ] = useState("");

  const [rating, setRating] =
    useState(0);

  const [username, setUsername] =
    useState("");

  const [songs, setSongs] =
    useState(MOCK_SONGS);

  const [
    selectedSong,
    setSelectedSong,
  ] = useState(null);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    keyboardVisible,
    setKeyboardVisible,
  ] = useState(false);

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  useEffect(() => {
    const fetchUserData =
      async () => {
        try {
          const currentUser =
            auth.currentUser;

          if (!currentUser) {
            navigation.navigate(
              "Home"
            );

            return;
          }

          const response =
            await getUser(
              currentUser.uid
            );

          if (!response?.ok) {
            throw new Error(
              "Unable to load your Treble profile."
            );
          }

          const userData =
            await response.json();

          setUsername(
            userData?.username ||
              currentUser.displayName ||
              "Treble User"
          );
        } catch (error) {
          console.error(
            "[CreatePost] User load error:",
            error
          );
        }
      };

    fetchUserData();
  }, [navigation]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios"
        ? "keyboardWillShow"
        : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios"
        ? "keyboardWillHide"
        : "keyboardDidHide";

    const showListener =
      Keyboard.addListener(
        showEvent,
        () => {
          setKeyboardVisible(true);
        }
      );

    const hideListener =
      Keyboard.addListener(
        hideEvent,
        () => {
          setKeyboardVisible(false);
        }
      );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const filteredSongs =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return songs;
      }

      return songs.filter(
        (song) =>
          song.name
            .toLowerCase()
            .includes(
              normalizedSearch
            ) ||
          song.artist
            .toLowerCase()
            .includes(
              normalizedSearch
            )
      );
    }, [
      searchTerm,
      songs,
    ]);

  const handlePostSubmit =
    useCallback(() => {
      if (!selectedSong) {
        Alert.alert(
          "Choose a song",
          "Select a song before creating your post."
        );

        return;
      }

      if (!postComment.trim()) {
        Alert.alert(
          "Write something",
          "Add a description or comment before posting."
        );

        return;
      }

      const newPost = {
        id:
          Date.now().toString(),

        name:
          selectedSong.name,

        artist:
          selectedSong.artist,

        albumCover:
          selectedSong.albumCover,

        username:
          username ||
          "Treble User",

        comment:
          postComment.trim(),

        rating,
      };

      setPostComment("");
      setSelectedSong(null);
      setRating(0);
      setSearchTerm("");

      navigation.navigate(
        "Feed",
        {
          newPost,
        }
      );
    }, [
      navigation,
      postComment,
      rating,
      selectedSong,
      username,
    ]);

  const renderSongCard =
    useCallback(
      ({ item }) => {
        const isSelected =
          selectedSong?.id ===
          item.id;

        return (
          <TouchableOpacity
            style={[
              styles.songCard,
              isCompact &&
                styles.compactSongCard,
              isSelected &&
                styles.selectedCard,
            ]}
            onPress={() =>
              setSelectedSong(item)
            }
            activeOpacity={0.84}
          >
            <View
              style={
                styles.albumCoverWrap
              }
            >
              <Image
                source={
                  item.albumCover
                }
                style={
                  styles.albumCover
                }
              />

              {isSelected ? (
                <View
                  style={
                    styles.selectedCheck
                  }
                >
                  <Icon
                    name="check"
                    size={18}
                    color="#ffffff"
                  />
                </View>
              ) : null}
            </View>

            <Text
              style={
                styles.songName
              }
              numberOfLines={1}
            >
              {item.name}
            </Text>

            <Text
              style={
                styles.artistName
              }
              numberOfLines={1}
            >
              {item.artist}
            </Text>
          </TouchableOpacity>
        );
      },
      [
        isCompact,
        selectedSong,
      ]
    );

  const renderStars = () => (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map(
        (value) => (
          <TouchableOpacity
            key={value}
            style={
              styles.starButton
            }
            onPress={() =>
              setRating(value)
            }
            activeOpacity={0.75}
          >
            <Icon
              name={
                value <= rating
                  ? "star"
                  : "star-border"
              }
              size={34}
              color={
                value <= rating
                  ? "#ffb400"
                  : "rgba(255,255,255,0.42)"
              }
            />
          </TouchableOpacity>
        )
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb &&
            styles.desktopSideMenu,
          isMobileWeb &&
            styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={
            isDesktopWeb
              ? true
              : menuOpen
          }
          setMenuOpen={
            isDesktopWeb
              ? () => {}
              : setMenuOpen
          }
          isDesktop={isDesktopWeb}
        />
      </View>

      <View
        style={[
          styles.pageContent,
          isDesktopWeb &&
            styles.desktopPageContent,
          isMobileWeb &&
            styles.mobilePageContent,
        ]}
      >
        <ScrollView
          style={[
            styles.scrollView,
            isWeb &&
              styles.webScrollView,
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact &&
              styles.compactScrollContent,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <LinearGradient
            colors={[
              "rgba(53,175,229,0.26)",
              "rgba(35,74,132,0.18)",
              "rgba(255,255,255,0.04)",
            ]}
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: 1,
            }}
            style={styles.heroCard}
          >
            <View
              style={
                styles.heroGlowOne
              }
            />

            <View
              style={
                styles.heroGlowTwo
              }
            />

            <View
              style={
                styles.heroIcon
              }
            >
              <Icon
                name="add-comment"
                size={28}
                color="#ffffff"
              />
            </View>

            <View
              style={
                styles.heroTextWrap
              }
            >
              <Text
                style={
                  styles.heroEyebrow
                }
              >
                SHARE WITH YOUR FRIENDS
              </Text>

              <Text
                style={
                  styles.heroTitle
                }
              >
                Create a Post
              </Text>

              <Text
                style={
                  styles.heroSubtitle
                }
              >
                Pick a song, add your thoughts,
                and share it with the people who
                follow you.
              </Text>
            </View>
          </LinearGradient>

          <View
            style={
              styles.composerCard
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  STEP 1
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Choose a Song
                </Text>
              </View>

              <Text
                style={
                  styles.sectionCount
                }
              >
                {filteredSongs.length}
              </Text>
            </View>

            <View
              style={
                styles.searchBar
              }
            >
              <Icon
                name="search"
                size={22}
                color={
                  colours.lightblue ||
                  "#35afe5"
                }
              />

              <TextInput
                style={
                  styles.searchInput
                }
                placeholder="Search songs or artists..."
                placeholderTextColor="rgba(255,255,255,0.38)"
                value={searchTerm}
                onChangeText={
                  setSearchTerm
                }
                returnKeyType="search"
              />

              {searchTerm ? (
                <TouchableOpacity
                  onPress={() =>
                    setSearchTerm("")
                  }
                  style={
                    styles.clearSearchButton
                  }
                >
                  <Icon
                    name="close"
                    size={18}
                    color="rgba(255,255,255,0.65)"
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredSongs}
              renderItem={
                renderSongCard
              }
              keyExtractor={(
                item
              ) => item.id}
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.songList
              }
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={3}
            />

            {selectedSong ? (
              <View
                style={
                  styles.selectedSongPanel
                }
              >
                <View
                  style={
                    styles.selectedSongIcon
                  }
                >
                  <Icon
                    name="music-note"
                    size={24}
                    color="#ffffff"
                  />
                </View>

                <View
                  style={
                    styles.selectedSongText
                  }
                >
                  <Text
                    style={
                      styles.selectedSongLabel
                    }
                  >
                    SELECTED SONG
                  </Text>

                  <Text
                    style={
                      styles.selectedSongName
                    }
                    numberOfLines={1}
                  >
                    {selectedSong.name}
                  </Text>

                  <Text
                    style={
                      styles.selectedSongArtist
                    }
                    numberOfLines={1}
                  >
                    {selectedSong.artist}
                  </Text>
                </View>

                <TouchableOpacity
                  style={
                    styles.removeSongButton
                  }
                  onPress={() =>
                    setSelectedSong(null)
                  }
                >
                  <Icon
                    name="close"
                    size={20}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View
            style={
              styles.composerCard
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  STEP 2
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Add Your Thoughts
                </Text>
              </View>

              <Text
                style={
                  styles.characterCount
                }
              >
                {postComment.length}/500
              </Text>
            </View>

            <TextInput
              style={
                styles.textInput
              }
              placeholder="What do you think about this song?"
              placeholderTextColor="rgba(255,255,255,0.36)"
              value={postComment}
              onChangeText={(text) =>
                setPostComment(
                  text.slice(
                    0,
                    500
                  )
                )
              }
              multiline
              textAlignVertical="top"
              returnKeyType="default"
            />

            <Text
              style={
                styles.ratingLabel
              }
            >
              OPTIONAL RATING
            </Text>

            {renderStars()}
          </View>

          <View
            style={
              styles.actionRow
            }
          >
            <TouchableOpacity
              style={
                styles.cancelButton
              }
              onPress={() =>
                navigation.goBack()
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (
                  !selectedSong ||
                  !postComment.trim()
                ) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={
                handlePostSubmit
              }
              activeOpacity={0.82}
            >
              <Icon
                name="send"
                size={19}
                color="#ffffff"
              />

              <Text
                style={
                  styles.submitText
                }
              >
                Share Post
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {!keyboardVisible ? (
        <View
          style={[
            styles.bottomNavBar,
            isDesktopWeb &&
              styles.desktopBottomNavBar,
          ]}
        >
          <BottomNavbar />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,

      backgroundColor:
        colours.background ||
        "#101010",
    },

    sideMenu: {
      position: "absolute",

      top: 40,
      left: 0,
      bottom: 0,

      zIndex: 100,
      elevation: 20,
    },

    desktopSideMenu: {
      position: "fixed",

      top: 0,
      left: 0,
      bottom: 0,

      width:
        DESKTOP_SIDEBAR_WIDTH,

      height: "100vh",

      overflow: "hidden",
    },

    mobileSideMenu: {
      top: 40,
      left: 0,
    },

    pageContent: {
      flex: 1,
      minHeight: 0,

      overflow: "hidden",
    },

    desktopPageContent: {
      position: "absolute",

      top: 0,
      left:
        DESKTOP_SIDEBAR_WIDTH,
      right: 0,
      bottom: 0,

      paddingTop: 24,
      paddingHorizontal: 28,
    },

    mobilePageContent: {
      position: "absolute",

      top: 0,
      left: 0,
      right: 0,
      bottom: 0,

      paddingTop: 70,
      paddingBottom:
        BOTTOM_NAV_HEIGHT,
      paddingHorizontal: 12,
    },

    scrollView: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webScrollView: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      WebkitOverflowScrolling:
        "touch",
    },

    scrollContent: {
      width: "100%",
      maxWidth:
        MAX_CONTENT_WIDTH,

      alignSelf: "center",

      paddingBottom: 110,
    },

    compactScrollContent: {
      paddingBottom: 120,
    },

    heroCard: {
      position: "relative",
      overflow: "hidden",

      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 24,
      marginBottom: 20,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.30)",

      borderRadius: 24,
    },

    heroGlowOne: {
      position: "absolute",

      top: -90,
      right: -50,

      width: 220,
      height: 220,

      borderRadius: 110,

      backgroundColor:
        "rgba(53,175,229,0.14)",
    },

    heroGlowTwo: {
      position: "absolute",

      bottom: -110,
      left: 130,

      width: 200,
      height: 200,

      borderRadius: 100,

      backgroundColor:
        "rgba(105,80,255,0.08)",
    },

    heroIcon: {
      width: 62,
      height: 62,

      alignItems: "center",
      justifyContent: "center",

      marginRight: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.18)",

      borderRadius: 20,

      backgroundColor:
        colours.secondaryblue ||
        "#2878c7",
    },

    heroTextWrap: {
      flex: 1,
      minWidth: 0,
    },

    heroEyebrow: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,

      marginBottom: 4,
    },

    heroTitle: {
      color: "#ffffff",

      fontSize: 30,
      lineHeight: 36,
      fontWeight: "900",
    },

    heroSubtitle: {
      maxWidth: 600,

      color:
        "rgba(255,255,255,0.61)",

      fontSize: 13,
      lineHeight: 20,

      marginTop: 4,
    },

    composerCard: {
      width: "100%",

      padding: 20,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.17)",

      borderRadius: 20,

      backgroundColor:
        "rgba(17,27,40,0.94)",
    },

    sectionHeader: {
      width: "100%",

      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent:
        "space-between",

      marginBottom: 14,
    },

    sectionEyebrow: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,

      marginBottom: 3,
    },

    sectionTitle: {
      color: "#ffffff",

      fontSize: 21,
      lineHeight: 27,
      fontWeight: "900",
    },

    sectionCount: {
      minWidth: 34,
      height: 34,

      color: "#ffffff",

      fontSize: 12,
      lineHeight: 34,
      fontWeight: "900",

      textAlign: "center",

      borderRadius: 17,

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    characterCount: {
      color:
        "rgba(255,255,255,0.38)",

      fontSize: 11,
      fontWeight: "700",
    },

    searchBar: {
      width: "100%",
      minHeight: 48,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 14,
      marginBottom: 16,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.20)",

      borderRadius: 15,

      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    searchInput: {
      flex: 1,

      color: "#ffffff",

      fontSize: 15,

      marginLeft: 10,
      paddingVertical: 11,
    },

    clearSearchButton: {
      width: 30,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 15,

      backgroundColor:
        "rgba(255,255,255,0.05)",
    },

    songList: {
      paddingRight: 4,
    },

    songCard: {
      position: "relative",

      width: 172,

      flexShrink: 0,

      marginRight: 13,

      overflow: "hidden",

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 16,

      backgroundColor:
        "rgba(10,21,35,0.95)",
    },

    compactSongCard: {
      width: 150,
    },

    selectedCard: {
      borderColor:
        colours.lightblue ||
        "#35afe5",

      backgroundColor:
        "rgba(53,175,229,0.10)",
    },

    albumCoverWrap: {
      position: "relative",

      width: "100%",
      height: 145,
    },

    albumCover: {
      width: "100%",
      height: "100%",

      resizeMode: "cover",
    },

    selectedCheck: {
      position: "absolute",

      top: 10,
      right: 10,

      width: 30,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 15,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    songName: {
      color: "#ffffff",

      fontSize: 14,
      lineHeight: 19,
      fontWeight: "900",

      marginTop: 11,
      paddingHorizontal: 12,
    },

    artistName: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 12,
      lineHeight: 17,

      paddingHorizontal: 12,
      paddingBottom: 13,
    },

    selectedSongPanel: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 14,
      marginTop: 18,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.24)",

      borderRadius: 15,

      backgroundColor:
        "rgba(53,175,229,0.08)",
    },

    selectedSongIcon: {
      width: 44,
      height: 44,

      alignItems: "center",
      justifyContent: "center",

      marginRight: 12,

      borderRadius: 14,

      backgroundColor:
        colours.secondaryblue ||
        "#2878c7",
    },

    selectedSongText: {
      flex: 1,
      minWidth: 0,
    },

    selectedSongLabel: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.3,

      marginBottom: 2,
    },

    selectedSongName: {
      color: "#ffffff",

      fontSize: 15,
      fontWeight: "900",
    },

    selectedSongArtist: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 12,

      marginTop: 2,
    },

    removeSongButton: {
      width: 36,
      height: 36,

      alignItems: "center",
      justifyContent: "center",

      marginLeft: 10,

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    textInput: {
      width: "100%",
      minHeight: 150,

      color: "#ffffff",

      fontSize: 15,
      lineHeight: 22,

      padding: 16,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.20)",

      borderRadius: 16,

      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    ratingLabel: {
      color:
        "rgba(255,255,255,0.45)",

      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,

      marginTop: 18,
      marginBottom: 8,
    },

    ratingRow: {
      flexDirection: "row",
      alignItems: "center",

      marginHorizontal: -4,
    },

    starButton: {
      padding: 4,
    },

    actionRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",

      marginTop: 2,
      gap: 12,
    },

    cancelButton: {
      minHeight: 48,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 22,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.12)",

      borderRadius: 24,

      backgroundColor:
        "rgba(255,255,255,0.04)",
    },

    cancelButtonText: {
      color:
        "rgba(255,255,255,0.70)",

      fontSize: 14,
      fontWeight: "800",
    },

    submitButton: {
      minHeight: 48,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 24,

      borderRadius: 24,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    submitButtonDisabled: {
      opacity: 0.48,
    },

    submitText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "900",

      marginLeft: 8,
    },

    bottomNavBar: {
      position: "absolute",

      left: 0,
      right: 0,
      bottom: 0,

      zIndex: 90,
    },

    desktopBottomNavBar: {
      left:
        DESKTOP_SIDEBAR_WIDTH,
    },
  });
