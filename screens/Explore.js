import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

import { auth } from "../utils/firebase";

import {
  getFollowRequests,
  getRecommendedSongs,
  getTopReviews,
  getTopSongs,
} from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_CONTENT_WIDTH = 1120;

export default function Explore({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact = width < 600;

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

  const [topReviewed, setTopReviewed] =
    useState([]);

  const [topLiked, setTopLiked] =
    useState([]);

  const [
    recommendedSongs,
    setRecommendedSongs,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  /*
   * Keep the sidebar permanently open on desktop.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  /*
   * Safely read JSON from the backend.
   */
  const parseResponse = useCallback(
    async (
      response,
      fallbackMessage
    ) => {
      if (!response) {
        throw new Error(
          "The backend returned no response."
        );
      }

      const responseText =
        await response.text();

      let data = {};

      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          responseText ||
            "The backend returned invalid JSON."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `${fallbackMessage} HTTP ${response.status}`
        );
      }

      return data;
    },
    []
  );

  /*
   * Convert different song formats into one consistent
   * object for the Explore cards and SongPage.
   */
  const normalizeTrack = useCallback(
    (song) => {
      const track =
        song?.track ||
        song?.song ||
        song ||
        {};

      const id =
        track?.listenableId ||
        track?.listenable_id ||
        track?.id ||
        song?.listenableId ||
        song?.listenable_id ||
        song?.id ||
        "";

      const title =
        track?.title ||
        track?.name ||
        song?.title ||
        song?.name ||
        "Unknown Track";

      const rawArtist =
        track?.artist ||
        song?.artist ||
        null;

      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            track?.artistName ||
            song?.artistName ||
            "Unknown Artist";

      const artist =
        typeof rawArtist === "string"
          ? {
              name: rawArtist,
            }
          : rawArtist || {
              name: artistName,
            };

      const album =
        track?.album ||
        song?.album ||
        null;

      const image =
        track?.image ||
        track?.coverArt ||
        song?.image ||
        song?.coverArt ||
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        "";

      const preview =
        track?.preview ||
        track?.previewUrl ||
        track?.playbackUrl ||
        song?.preview ||
        song?.previewUrl ||
        song?.playbackUrl ||
        "";

      return {
        ...song,
        ...track,

        id: String(id),

        listenableId: String(id),

        type: "track",

        title,

        name:
          track?.name ||
          title,

        artist,

        artistName,

        album,

        image,

        coverArt:
          track?.coverArt ||
          song?.coverArt ||
          image,

        preview,

        previewUrl: preview,

        playbackUrl: preview,

        reviewCount:
          Number(
            song?.reviewCount ||
              track?.reviewCount ||
              0
          ),

        likes:
          Number(
            song?.likes ||
              track?.likes ||
              0
          ),
      };
    },
    []
  );

  const fetchNotifications =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setNotificationsCount(0);

        return;
      }

      try {
        const response =
          await getFollowRequests(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load notifications."
          );

        const requests =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.requests
                )
              ? data.requests
              : [];

        setNotificationsCount(
          requests.length
        );
      } catch (error) {
        console.error(
          "[Explore] Notifications error:",
          error
        );

        setNotificationsCount(0);
      }
    }, [parseResponse]);

  const fetchTopReviewed =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setTopReviewed([]);

        return;
      }

      try {
        const response =
          await getTopReviews(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load top-reviewed songs."
          );

        const songs =
          Array.isArray(
            data?.topSongsByReviews
          )
            ? data.topSongsByReviews
            : Array.isArray(data)
              ? data
              : [];

        setTopReviewed(
          songs.map(normalizeTrack)
        );
      } catch (error) {
        console.error(
          "[Explore] Top-reviewed error:",
          error
        );

        setTopReviewed([]);
      }
    }, [
      normalizeTrack,
      parseResponse,
    ]);

  const fetchTopLiked =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setTopLiked([]);

        return;
      }

      try {
        const response =
          await getTopSongs(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load top-liked songs."
          );

        const songs =
          Array.isArray(
            data?.topSongsByLikes
          )
            ? data.topSongsByLikes
            : Array.isArray(data)
              ? data
              : [];

        setTopLiked(
          songs.map(normalizeTrack)
        );
      } catch (error) {
        console.error(
          "[Explore] Top-liked error:",
          error
        );

        setTopLiked([]);
      }
    }, [
      normalizeTrack,
      parseResponse,
    ]);

  const fetchRecommendedSongs =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setRecommendedSongs([]);

        return;
      }

      try {
        const response =
          await getRecommendedSongs(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load recommendations."
          );

        const songs =
          Array.isArray(
            data?.recommendedSongs
          )
            ? data.recommendedSongs
            : Array.isArray(
                  data?.recommendations
                )
              ? data.recommendations
              : Array.isArray(data)
                ? data
                : [];

        setRecommendedSongs(
          songs
            .map(normalizeTrack)
            .slice(0, 20)
        );
      } catch (error) {
        console.error(
          "[Explore] Recommendations error:",
          error
        );

        setRecommendedSongs([]);
      }
    }, [
      normalizeTrack,
      parseResponse,
    ]);

  const loadExplore =
    useCallback(
      async (
        isRefresh = false
      ) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setTopReviewed([]);
          setTopLiked([]);
          setRecommendedSongs([]);
          setNotificationsCount(0);
          setLoading(false);
          setRefreshing(false);

          return;
        }

        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          await Promise.all([
            fetchNotifications(),
            fetchTopReviewed(),
            fetchTopLiked(),
            fetchRecommendedSongs(),
          ]);
        } catch (error) {
          console.error(
            "[Explore] Page-load error:",
            error
          );

          Alert.alert(
            "Unable to load Explore",
            error?.message ||
              "Please try again."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        fetchNotifications,
        fetchRecommendedSongs,
        fetchTopLiked,
        fetchTopReviewed,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      loadExplore(false);
    }, [loadExplore])
  );

  const openTrack =
    useCallback(
      (item) => {
        if (!item?.id) {
          Alert.alert(
            "Unable to open song",
            "This song does not have an ID."
          );

          return;
        }

        navigation.navigate(
          "SongPage",
          {
            track: {
              ...item,

              id: String(item.id),

              listenableId:
                String(item.id),

              type: "track",

              title:
                item.title ||
                item.name ||
                "Unknown Track",

              name:
                item.name ||
                item.title ||
                "Unknown Track",

              artist:
                item.artist || {
                  name:
                    item.artistName ||
                    "Unknown Artist",
                },

              image:
                item.image ||
                item.coverArt ||
                "",

              coverArt:
                item.coverArt ||
                item.image ||
                "",

              preview:
                item.preview ||
                item.previewUrl ||
                item.playbackUrl ||
                "",
            },
          }
        );
      },
      [navigation]
    );

  const renderTrackCard =
    useCallback(
      ({ item }) => {
        const title =
          item?.title ||
          item?.name ||
          "Unknown Track";

        const artistName =
          typeof item?.artist ===
          "string"
            ? item.artist
            : item?.artist?.name ||
              item?.artistName ||
              "Unknown Artist";

        const imageUri =
          item?.image ||
          item?.coverArt ||
          item?.album?.cover_xl ||
          item?.album?.cover_big ||
          item?.album?.cover_medium ||
          "";

        return (
          <TouchableOpacity
            style={[
              styles.trackCard,
              isDesktopWeb &&
                styles.desktopTrackCard,
              isCompact &&
                styles.compactTrackCard,
            ]}
            activeOpacity={0.82}
            onPress={() =>
              openTrack(item)
            }
          >
            <View
              style={
                styles.trackImageContainer
              }
            >
              {imageUri ? (
                <Image
                  source={{
                    uri: imageUri,
                  }}
                  style={[
                    styles.trackImage,
                    isDesktopWeb &&
                      styles.desktopTrackImage,
                    isCompact &&
                      styles.compactTrackImage,
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.imagePlaceholder,
                    isDesktopWeb &&
                      styles.desktopTrackImage,
                    isCompact &&
                      styles.compactTrackImage,
                  ]}
                >
                  <Text
                    style={
                      styles.placeholderIcon
                    }
                  >
                    ♪
                  </Text>
                </View>
              )}

              {item?.preview ? (
                <View
                  style={
                    styles.previewBadge
                  }
                >
                  <Text
                    style={
                      styles.previewBadgeText
                    }
                  >
                    Preview
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={
                styles.trackName
              }
              numberOfLines={1}
            >
              {title}
            </Text>

            <Text
              style={
                styles.trackArtist
              }
              numberOfLines={1}
            >
              {artistName}
            </Text>
          </TouchableOpacity>
        );
      },
      [
        isCompact,
        isDesktopWeb,
        openTrack,
      ]
    );

  const renderSection =
    useCallback(
      ({
        title,
        subtitle,
        data,
        emptyText,
      }) => (
        <View
          style={styles.cardSection}
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionHeadingGroup
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                {title}
              </Text>

              {subtitle ? (
                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View
              style={
                styles.sectionCountBadge
              }
            >
              <Text
                style={
                  styles.sectionCountText
                }
              >
                {data.length}
              </Text>
            </View>
          </View>

          {data.length === 0 ? (
            <View
              style={
                styles.emptySection
              }
            >
              <Text
                style={
                  styles.emptySectionIcon
                }
              >
                ♪
              </Text>

              <Text
                style={
                  styles.emptySectionText
                }
              >
                {emptyText}
              </Text>
            </View>
          ) : (
            <FlatList
              data={data}
              renderItem={
                renderTrackCard
              }
              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item?.id ||
                    `${title}-${index}`
                )
              }
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.horizontalListContent
              }
              nestedScrollEnabled
              removeClippedSubviews={
                false
              }
            />
          )}
        </View>
      ),
      [renderTrackCard]
    );

  const exploreSections = [
    {
      id: "top-reviewed",
      title: "Top Reviewed",
      subtitle:
        "The most-reviewed songs in Treble",
      data: topReviewed,
      emptyText:
        "No top-reviewed songs are available yet.",
    },
    {
      id: "top-liked",
      title: "Top Liked",
      subtitle:
        "Songs receiving the most likes",
      data: topLiked,
      emptyText:
        "No top-liked songs are available yet.",
    },
    {
      id: "recommended",
      title: "Recommended for You",
      subtitle:
        "Suggestions based on your music activity",
      data: recommendedSongs,
      emptyText:
        "Like and review music to improve your recommendations.",
    },
  ];

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
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

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <View
        style={[
          styles.pageContent,
          isDesktopWeb &&
            styles.desktopPageContent,
          isMobileWeb &&
            styles.mobilePageContent,
        ]}
      >
        {/* HEADER */}
        <View
          style={[
            styles.pageHeader,
            isCompact &&
              styles.compactPageHeader,
          ]}
        >
          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={styles.pageTitle}
            >
              Explore
            </Text>

            <Text
              style={
                styles.pageSubtitle
              }
            >
              Discover popular music and personalized recommendations.
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.notificationsButton
            }
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate(
                "Notifications"
              )
            }
          >
            <Image
              source={require("../images/notificationsIcon2.png")}
              style={
                styles.notificationsIcon
              }
            />

            {notificationsCount >
            0 ? (
              <View
                style={
                  styles.notificationBadge
                }
              >
                <Text
                  style={
                    styles.notificationBadgeText
                  }
                >
                  {notificationsCount >
                  99
                    ? "99+"
                    : notificationsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <View
          style={
            styles.searchBarContainer
          }
        >
          <SearchBar />
        </View>

        {/* EXPLORE SECTIONS */}
        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
              color={
                colours.lightblue
              }
            />

            <Text
              style={styles.loadingText}
            >
              Loading music...
            </Text>
          </View>
        ) : (
          <FlatList
            data={exploreSections}
            keyExtractor={(item) =>
              item.id
            }
            renderItem={({ item }) =>
              renderSection(item)
            }
            style={[
              styles.contentList,
              isWeb &&
                styles.webContentList,
            ]}
            contentContainerStyle={[
              styles.contentContainer,
              isDesktopWeb &&
                styles.desktopContentContainer,
            ]}
            showsVerticalScrollIndicator={
              false
            }
            scrollEnabled
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={() =>
                  loadExplore(true)
                }
                tintColor="#ffffff"
                colors={["#ffffff"]}
                progressBackgroundColor={
                  colours.darkblue
                }
              />
            }
          />
        )}
      </View>

      {/* MOBILE BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb && styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* =====================================================
     PAGE
  ===================================================== */
    desktopBottomNavBar: {
  left: DESKTOP_SIDEBAR_WIDTH,
  right: 0,
},
  container: {
    flex: 1,
    minHeight: 0,

    backgroundColor:
      colours.background,
  },

  webContainer: {
    width: "100%",
    height: "100vh",

    minHeight: 0,

    overflow: "hidden",
  },

  /* =====================================================
     SIDEBAR
  ===================================================== */

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
    right: undefined,
    bottom: 0,

    width:
      DESKTOP_SIDEBAR_WIDTH,

    height: "100vh",

    overflow: "hidden",

    zIndex: 100,
    elevation: 20,
  },

  mobileSideMenu: {
    position: "absolute",

    top: 40,
    left: 0,
    right: undefined,
    bottom: 0,

    zIndex: 100,
  },

  /* =====================================================
     PAGE CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    paddingBottom: 74,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",

    top: 0,
    left:
      DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom: 0,

    minHeight: 0,

    paddingTop: 23,
    paddingHorizontal: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 72,

    minHeight: 0,

    paddingTop: 69,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  /* =====================================================
     HEADER
  ===================================================== */

  pageHeader: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",

    marginBottom: 14,
  },

  compactPageHeader: {
    alignItems: "center",
  },

  headerTextContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 15,
  },

  pageTitle: {
    color:
      colours.lightblue,

    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
  },

  pageSubtitle: {
    color:
      "rgba(255,255,255,0.67)",

    fontSize: 15,
    lineHeight: 21,

    marginTop: 3,
  },

  notificationsButton: {
    width: 47,
    height: 47,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 24,

    backgroundColor:
      colours.darkblue,
  },

  notificationsIcon: {
    width: 29,
    height: 29,

    resizeMode: "contain",
  },

  notificationBadge: {
    position: "absolute",

    top: -4,
    right: -4,

    minWidth: 21,
    height: 21,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 5,

    borderWidth: 2,
    borderColor:
      colours.background,

    borderRadius: 11,

    backgroundColor:
      "#ff4545",
  },

  notificationBadgeText: {
    color: "#ffffff",

    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },

  /* =====================================================
     SEARCH
  ===================================================== */

  searchBarContainer: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    minHeight: 47,

    alignSelf: "center",

    marginBottom: 17,

    position: "relative",
    zIndex: 20,
  },

  /* =====================================================
     VERTICAL SCROLLING
  ===================================================== */

  contentList: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webContentList: {
    height: "100%",

    overflowY: "auto",
    overflowX: "hidden",

    WebkitOverflowScrolling:
      "touch",

    overscrollBehaviorY:
      "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  contentContainer: {
    width: "100%",

    paddingBottom: 110,
  },

  desktopContentContainer: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",

    paddingBottom: 65,
  },

  loadingContainer: {
    flex: 1,
    minHeight: 260,

    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.68)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     SECTIONS
  ===================================================== */

  cardSection: {
    width: "100%",

    padding: 18,
    marginBottom: 17,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 17,

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 9,

    elevation: 3,
  },

  sectionHeader: {
    width: "100%",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",

    marginBottom: 14,
  },

  sectionHeadingGroup: {
    flex: 1,
    minWidth: 0,

    paddingRight: 12,
  },

  sectionTitle: {
    color:
      colours.lightblue,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color:
      "rgba(255,255,255,0.47)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 2,
  },

  sectionCountBadge: {
    minWidth: 31,
    height: 31,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 7,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  sectionCountText: {
    color: "#ffffff",

    fontSize: 12,
    fontWeight: "800",
  },

  horizontalListContent: {
    paddingRight: 3,
  },

  /* =====================================================
     TRACK CARDS
  ===================================================== */

  trackCard: {
    width: 128,

    marginRight: 14,

    alignItems: "flex-start",
  },

  desktopTrackCard: {
    width: 160,

    marginRight: 17,
  },

  compactTrackCard: {
    width: 116,

    marginRight: 12,
  },

  trackImageContainer: {
    position: "relative",

    width: "100%",

    marginBottom: 9,
  },

  trackImage: {
    width: 128,
    height: 128,

    borderRadius: 12,

    resizeMode: "cover",

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  desktopTrackImage: {
    width: 160,
    height: 160,

    borderRadius: 14,
  },

  compactTrackImage: {
    width: 116,
    height: 116,

    borderRadius: 11,
  },

  imagePlaceholder: {
    width: 128,
    height: 128,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  placeholderIcon: {
    color: "#ffffff",

    fontSize: 39,

    opacity: 0.65,
  },

  previewBadge: {
    position: "absolute",

    left: 7,
    bottom: 7,

    paddingHorizontal: 7,
    paddingVertical: 3,

    borderRadius: 9,

    backgroundColor:
      "rgba(0,0,0,0.72)",
  },

  previewBadgeText: {
    color: "#ffffff",

    fontSize: 9,
    fontWeight: "800",
  },

  trackName: {
    width: "100%",

    color: "#ffffff",

    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  trackArtist: {
    width: "100%",

    color:
      "rgba(255,255,255,0.53)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 2,
  },

  /* =====================================================
     EMPTY SECTION
  ===================================================== */

  emptySection: {
    minHeight: 115,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  emptySectionIcon: {
    color:
      colours.lightblue,

    fontSize: 33,

    opacity: 0.7,
  },

  emptySectionText: {
    color:
      "rgba(255,255,255,0.59)",

    fontSize: 13,
    lineHeight: 19,

    textAlign: "center",

    marginTop: 7,
  },

  /* =====================================================
     MOBILE NAVIGATION
  ===================================================== */

  bottomNavBar: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 90,
  },
});