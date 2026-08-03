import React, {
  useMemo,
} from "react";

import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Icon from "react-native-vector-icons/MaterialIcons";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_CONTENT_WIDTH = 760;
const BOTTOM_NAV_HEIGHT = 72;

export default function Posts({
  route,
  navigation,
}) {
  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isCompact =
    width < 600;

  const post =
    route?.params?.post || {};

  const track =
    post?.item_info ||
    post;

  const image =
    track?.image ||
    track?.coverArt ||
    track?.albumCover?.uri ||
    "";

  const title =
    track?.title ||
    track?.name ||
    "Shared Song";

  const artist =
    track?.artistName ||
    track?.artist?.name ||
    (
      typeof track?.artist ===
      "string"
        ? track.artist
        : ""
    );

  const username =
    track?.username ||
    post?.username ||
    "Treble User";

  const comment =
    track?.comment ||
    post?.origin?.description ||
    "";

  const rating =
    Math.max(
      0,
      Math.min(
        5,
        Number(
          track?.rating ||
          post?.rating ||
          0
        )
      )
    );

  const createdLabel =
    useMemo(() => {
      const value =
        post?.createdAt;

      if (!value) {
        return "";
      }

      const parsed =
        new Date(value);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return "";
      }

      return parsed.toLocaleString();
    }, [post?.createdAt]);

  const openSong =
    () => {
      if (!track?.id) {
        return;
      }

      navigation.navigate(
        "SongPage",
        {
          track,
        }
      );
    };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb &&
            styles.desktopSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={isDesktopWeb}
          setMenuOpen={() => {}}
          isDesktop={isDesktopWeb}
        />
      </View>

      <View
        style={[
          styles.page,
          isDesktopWeb &&
            styles.desktopPage,
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.goBack()
              }
              activeOpacity={0.8}
            >
              <Icon
                name="arrow-back"
                size={22}
                color="#ffffff"
              />
            </TouchableOpacity>

            <View>
              <Text style={styles.eyebrow}>
                TREBLE POST
              </Text>

              <Text style={styles.pageTitle}>
                Post
              </Text>
            </View>
          </View>

          <View style={styles.postCard}>
            <View style={styles.authorRow}>
              <View style={styles.postPill}>
                <Icon
                  name="edit"
                  size={14}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.postPillText
                  }
                >
                  POST
                </Text>
              </View>

              <View
                style={
                  styles.authorTextWrap
                }
              >
                <Text
                  style={styles.authorName}
                >
                  {username}
                </Text>

                {createdLabel ? (
                  <Text
                    style={
                      styles.createdDate
                    }
                  >
                    {createdLabel}
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.songCommentLayout,
                isCompact &&
                  styles.songCommentLayoutCompact,
              ]}
            >
              {image ? (
                <Image
                  source={{
                    uri: image,
                  }}
                  style={[
                    styles.artwork,
                    isCompact &&
                      styles.artworkCompact,
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.artworkPlaceholder,
                    isCompact &&
                      styles.artworkCompact,
                  ]}
                >
                  <Text
                    style={
                      styles.artworkPlaceholderText
                    }
                  >
                    ♪
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.postContent
                }
              >
                <Text
                  style={styles.songTitle}
                >
                  {title}
                </Text>

                <Text
                  style={styles.artistName}
                >
                  {artist}
                </Text>

                <View
                  style={styles.stars}
                >
                  {[1, 2, 3, 4, 5].map(
                    (value) => (
                      <Icon
                        key={value}
                        name={
                          value <= rating
                            ? "star"
                            : "star-border"
                        }
                        size={23}
                        color={
                          value <= rating
                            ? "#ffb400"
                            : "rgba(255,255,255,0.28)"
                        }
                      />
                    )
                  )}
                </View>

                <Text
                  style={
                    styles.commentText
                  }
                >
                  {comment ||
                    "No comment was added to this post."}
                </Text>

                <TouchableOpacity
                  style={styles.songButton}
                  onPress={openSong}
                  activeOpacity={0.82}
                >
                  <Icon
                    name="music-note"
                    size={18}
                    color="#ffffff"
                  />

                  <Text
                    style={
                      styles.songButtonText
                    }
                  >
                    Open Song
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {!isDesktopWeb ? (
        <View
          style={
            styles.bottomNavBar
          }
        >
          <BottomNavbar />
        </View>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        colours.background ||
        "#101010",
    },

    sideMenu: {
      position: "absolute",
      zIndex: 20,
    },

    desktopSideMenu: {
      left: 0,
      top: 0,
      bottom: 0,
      width:
        DESKTOP_SIDEBAR_WIDTH,
    },

    page: {
      flex: 1,
      width: "100%",
    },

    desktopPage: {
      marginLeft:
        DESKTOP_SIDEBAR_WIDTH,
    },

    scrollView: {
      flex: 1,
      width: "100%",
    },

    scrollContent: {
      width: "100%",
      maxWidth:
        MAX_CONTENT_WIDTH,

      alignSelf: "center",

      paddingHorizontal: 16,
      paddingTop: 34,
      paddingBottom:
        BOTTOM_NAV_HEIGHT + 42,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",

      marginBottom: 22,
    },

    backButton: {
      width: 42,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 21,

      backgroundColor:
        "rgba(255,255,255,0.07)",

      marginRight: 13,
    },

    eyebrow: {
      color: "#ffb400",

      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.1,
    },

    pageTitle: {
      color: "#ffffff",

      fontSize: 26,
      fontWeight: "900",
    },

    postCard: {
      width: "100%",

      padding: 18,

      borderRadius: 22,

      backgroundColor:
        "rgba(27,27,30,0.99)",

      borderWidth: 1,
      borderColor:
        "rgba(255,180,0,0.24)",

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.3,
      shadowRadius: 18,

      elevation: 7,
    },

    authorRow: {
      flexDirection: "row",
      alignItems: "center",

      marginBottom: 18,
    },

    postPill: {
      flexDirection: "row",
      alignItems: "center",

      gap: 5,

      paddingHorizontal: 9,
      paddingVertical: 5,

      borderRadius: 11,

      backgroundColor:
        "rgba(255,180,0,0.16)",

      borderWidth: 1,
      borderColor:
        "rgba(255,180,0,0.30)",
    },

    postPillText: {
      color: "#ffffff",

      fontSize: 10,
      fontWeight: "900",
    },

    authorTextWrap: {
      marginLeft: 10,
    },

    authorName: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "900",
    },

    createdDate: {
      color:
        "rgba(255,255,255,0.43)",

      fontSize: 10,

      marginTop: 2,
    },

    songCommentLayout: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    songCommentLayoutCompact: {
      flexDirection: "column",
    },

    artwork: {
      width: 150,
      height: 150,

      borderRadius: 17,

      marginRight: 18,
    },

    artworkCompact: {
      width: "100%",
      height: 280,

      marginRight: 0,
      marginBottom: 18,
    },

    artworkPlaceholder: {
      width: 150,
      height: 150,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 17,

      marginRight: 18,

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    artworkPlaceholderText: {
      color:
        "rgba(255,255,255,0.45)",

      fontSize: 50,
    },

    postContent: {
      flex: 1,
      minWidth: 0,
    },

    songTitle: {
      color: "#ffffff",

      fontSize: 22,
      lineHeight: 27,
      fontWeight: "900",
    },

    artistName: {
      color:
        "rgba(255,255,255,0.55)",

      fontSize: 14,

      marginTop: 3,
    },

    stars: {
      flexDirection: "row",
      alignItems: "center",

      marginTop: 12,
    },

    commentText: {
      color:
        "rgba(255,255,255,0.88)",

      fontSize: 15,
      lineHeight: 22,

      marginTop: 14,
    },

    songButton: {
      alignSelf: "flex-start",

      flexDirection: "row",
      alignItems: "center",

      gap: 7,

      minHeight: 40,

      paddingHorizontal: 14,

      borderRadius: 20,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",

      marginTop: 18,
    },

    songButtonText: {
      color: "#ffffff",

      fontSize: 13,
      fontWeight: "900",
    },

    bottomNavBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
  });
