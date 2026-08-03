import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
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

import { getSongFromDeezer } from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_CONTENT_WIDTH = 1120;
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

  const isMobile =
    width < DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    openingSong,
    setOpeningSong,
  ] = useState(false);

  useEffect(() => {
    setMenuOpen(
      isDesktopWeb
    );
  }, [isDesktopWeb]);

  const post =
    route?.params?.post || {};

  const track =
    post?.item_info ||
    post;

  const songTrackId =
    String(
      track?.listenableId ||
      track?.listenable_id ||
      track?.songId ||
      post?.listenableId ||
      post?.listenable_id ||
      post?.songId ||
      ""
    );

  const songTrack =
    useMemo(
      () => ({
        ...track,

        /*
         * SongPage expects the music catalogue ID in `id`.
         * The top-level post `id` is a Firestore document ID and must
         * never be passed as the song ID.
         */
        id: songTrackId,
        listenableId:
          songTrackId,
        listenable_id:
          songTrackId,
        songId:
          songTrackId,

        type: "track",

        name:
          track?.name ||
          track?.title ||
          "Shared Song",

        title:
          track?.title ||
          track?.name ||
          "Shared Song",

        artist:
          typeof track?.artist ===
          "string"
            ? {
                name:
                  track.artist,
              }
            : track?.artist || {
                name:
                  track?.artistName ||
                  "",
              },

        artistName:
          track?.artistName ||
          track?.artist?.name ||
          (
            typeof track?.artist ===
            "string"
              ? track.artist
              : ""
          ),

        image:
          track?.image ||
          track?.coverArt ||
          "",

        coverArt:
          track?.coverArt ||
          track?.image ||
          "",

        preview:
          track?.preview ||
          track?.previewUrl ||
          track?.playbackUrl ||
          "",

        previewUrl:
          track?.previewUrl ||
          track?.preview ||
          track?.playbackUrl ||
          "",

        playbackUrl:
          track?.playbackUrl ||
          track?.preview ||
          track?.previewUrl ||
          "",
      }),
      [
        songTrackId,
        track,
      ]
    );

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
    async () => {
      if (
        !songTrackId ||
        openingSong
      ) {
        if (!songTrackId) {
          console.warn(
            "[Posts] Cannot open SongPage because the post has no listenable ID.",
            post
          );
        }

        return;
      }

      setOpeningSong(true);

      let finalTrack =
        songTrack;

      try {
        /*
         * Hydrate the post's Deezer song before opening SongPage.
         * This prevents SongPage from reusing stale artwork from the
         * previously-opened song while keeping the post data as fallback.
         */
        const response =
          await getSongFromDeezer(
            songTrackId,
            {
              refresh: true,
              forceRefresh: false,
            }
          );

        if (response?.ok) {
          const deezerTrack =
            await response.json();

          const hydratedImage =
            deezerTrack?.image ||
            deezerTrack?.coverArt ||
            deezerTrack?.album?.cover_xl ||
            deezerTrack?.album?.cover_big ||
            deezerTrack?.album?.cover_medium ||
            songTrack?.image ||
            songTrack?.coverArt ||
            "";

          finalTrack = {
            ...songTrack,
            ...deezerTrack,

            id:
              String(
                deezerTrack?.id ||
                songTrackId
              ),

            listenableId:
              String(
                deezerTrack?.listenableId ||
                deezerTrack?.id ||
                songTrackId
              ),

            listenable_id:
              String(
                deezerTrack?.listenable_id ||
                deezerTrack?.listenableId ||
                deezerTrack?.id ||
                songTrackId
              ),

            songId:
              String(songTrackId),

            type: "track",

            title:
              deezerTrack?.title ||
              songTrack?.title ||
              songTrack?.name ||
              "Shared Song",

            name:
              deezerTrack?.name ||
              deezerTrack?.title ||
              songTrack?.name ||
              songTrack?.title ||
              "Shared Song",

            image:
              hydratedImage,

            coverArt:
              hydratedImage,

            album: {
              ...(songTrack?.album || {}),
              ...(deezerTrack?.album || {}),

              cover_xl:
                deezerTrack?.album?.cover_xl ||
                hydratedImage,

              cover_big:
                deezerTrack?.album?.cover_big ||
                hydratedImage,

              cover_medium:
                deezerTrack?.album?.cover_medium ||
                hydratedImage,
            },

            artist:
              deezerTrack?.artist ||
              songTrack?.artist ||
              {
                name:
                  songTrack?.artistName ||
                  "",
              },

            artistName:
              deezerTrack?.artistName ||
              deezerTrack?.artist?.name ||
              songTrack?.artistName ||
              songTrack?.artist?.name ||
              "",
          };
        }
      } catch (error) {
        console.warn(
          "[Posts] Song hydration failed; opening saved post data:",
          error
        );
      } finally {
        setOpeningSong(false);
      }

      /*
       * push() creates a fresh SongPage instance, preventing stale route
       * state or artwork from the previously-opened song from being reused.
       */
      navigation.push(
        "SongPage",
        {
          track:
            finalTrack,

          songId:
            String(songTrackId),

          fromPostId:
            String(
              post?.id ||
              post?.record_id ||
              ""
            ),
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

      <TouchableOpacity
        style={[
          styles.rootBackButton,
          isDesktopWeb &&
            styles.desktopRootBackButton,
        ]}
        onPress={() =>
          navigation.goBack()
        }
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Icon
          name="arrow-back"
          size={26}
          color="#ffffff"
        />
      </TouchableOpacity>

      <View
        style={[
          styles.page,
          isDesktopWeb &&
            styles.desktopPage,
        ]}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb
              ? styles.scrollContentDesktop
              : styles.scrollContentMobile,
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={[
              styles.topBar,
              isDesktopWeb &&
                styles.topBarDesktop,
              isMobile &&
                styles.topBarMobile,
            ]}
          >
            <View>
              <Text style={styles.eyebrow}>
                TREBLE POST
              </Text>

              <Text style={styles.pageTitle}>
                Post
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.postCard,
              isDesktopWeb &&
                styles.postCardDesktop,
              isCompact &&
                styles.postCardCompact,
            ]}
          >
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
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={openSong}
                disabled={openingSong}
                style={[
                  styles.artworkButton,
                  isCompact &&
                    styles.artworkButtonCompact,
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
              </TouchableOpacity>

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
                  style={[
                    styles.songButton,
                    openingSong &&
                      styles.songButtonDisabled,
                  ]}
                  onPress={openSong}
                  disabled={openingSong}
                  activeOpacity={0.82}
                >
                  {openingSong ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Icon
                      name="music-note"
                      size={18}
                      color="#ffffff"
                    />
                  )}

                  <Text
                    style={
                      styles.songButtonText
                    }
                  >
                    {openingSong
                      ? "Loading Song..."
                      : "Open Song"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb &&
            styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    /*
     * Matches the mobile Sidebar hamburger:
     * same 48px circle, background, no outline, and aligned beside it.
     */
    rootBackButton: {
      position: "absolute",
      top: 40,
      left: 80,

      zIndex: 101,
      elevation: 31,

      width: 48,
      height: 48,

      borderRadius: 24,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "rgba(255,255,255,0.08)",

      borderWidth: 0,
    },

    desktopRootBackButton: {
      top: 20,
      left:
        DESKTOP_SIDEBAR_WIDTH +
        20,
    },

    container: {
      flex: 1,
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
      elevation: 30,
    },

    desktopSideMenu: {
      position: "fixed",

      left: 0,
      top: 0,
      right: undefined,
      bottom: 0,

      width:
        DESKTOP_SIDEBAR_WIDTH,
      height: "100vh",

      zIndex: 100,
      elevation: 30,

      overflow: "hidden",
    },

    mobileSideMenu: {
      position: "absolute",

      top: 40,
      left: 0,
      right: undefined,
      bottom: 0,

      zIndex: 100,
      elevation: 30,
    },

    page: {
      flex: 1,
      width: "100%",
    },

    desktopPage: {
      marginLeft:
        DESKTOP_SIDEBAR_WIDTH,

      width:
        `calc(100% - ${DESKTOP_SIDEBAR_WIDTH}px)`,

      alignItems: "center",
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

      paddingHorizontal: 18,
      paddingBottom:
        BOTTOM_NAV_HEIGHT + 42,
    },

    scrollContentDesktop: {
      width: "100%",

      paddingTop: 58,
      paddingHorizontal: 36,
      paddingBottom:
        BOTTOM_NAV_HEIGHT + 54,
    },

    scrollContentMobile: {
      paddingTop: 112,
      paddingHorizontal: 14,
    },

    topBar: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      marginBottom: 20,
    },

    topBarDesktop: {
      width: "100%",
      maxWidth: 1020,

      alignSelf: "center",
    },

    topBarMobile: {
      minHeight: 46,
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

      padding: 22,

      borderRadius: 24,

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

    postCardDesktop: {
      width: "100%",
      maxWidth: 1020,

      alignSelf: "center",

      padding: 32,
    },

    postCardCompact: {
      padding: 15,
      borderRadius: 19,
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

    artworkButton: {
      position: "relative",

      width: 240,
      height: 240,

      marginRight: 32,

      borderRadius: 20,

      overflow: "hidden",
    },

    artworkButtonCompact: {
      width: "100%",
      height: 300,

      marginRight: 0,
      marginBottom: 20,
    },

    artwork: {
      width: "100%",
      height: "100%",

      borderRadius: 20,
    },

    artworkCompact: {
      width: "100%",
      height: "100%",

      marginRight: 0,
      marginBottom: 0,
    },

    artworkPlaceholder: {
      width: "100%",
      height: "100%",

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 20,

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

      justifyContent: "center",
    },

    songTitle: {
      color: "#ffffff",

      fontSize: 32,
      lineHeight: 38,
      fontWeight: "900",
    },

    artistName: {
      color:
        "rgba(255,255,255,0.55)",

      fontSize: 15,

      marginTop: 4,
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

      minHeight: 44,

      paddingHorizontal: 17,

      borderRadius: 22,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",

      marginTop: 18,
    },

    songButtonDisabled: {
      opacity: 0.66,
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

      zIndex: 200,
      elevation: 40,
    },

    desktopBottomNavBar: {
      left:
        DESKTOP_SIDEBAR_WIDTH,
    },
  });
