import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import Icon from "react-native-vector-icons/MaterialIcons";

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
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 1180;

const EMPTY_TRACK = {
  id: "",
  title: "Unknown Track",
  artistName: "Unknown Artist",
  image: "",
  preview: "",
  type: "track",
};

function normalizeArray(data, keys = []) {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function uniqueTracks(items = []) {
  return Array.from(
    new Map(
      items
        .filter((item) => item?.id)
        .map((item) => [
          String(item.id),
          item,
        ])
    ).values()
  );
}

export default function Explore({
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

  const isCompact = width < 640;

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

  const [
    topReviewed,
    setTopReviewed,
  ] = useState([]);

  const [
    topLiked,
    setTopLiked,
  ] = useState([]);

  const [
    recommendedSongs,
    setRecommendedSongs,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    setMenuOpen(isDesktopWeb);
  }, [isDesktopWeb]);

  const parseResponse =
    useCallback(
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
              "The backend returned invalid data."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `${fallbackMessage} HTTP ${response.status}`
          );
        }

        return data;
      },
      []
    );

  const normalizeTrack =
    useCallback((song) => {
      const rawTrack =
        song?.track ||
        song?.song ||
        song ||
        {};

      const id =
        rawTrack?.id ||
        rawTrack?.listenableId ||
        rawTrack?.listenable_id ||
        song?.id ||
        song?.listenableId ||
        song?.listenable_id ||
        "";

      const title =
        rawTrack?.title ||
        rawTrack?.name ||
        song?.title ||
        song?.name ||
        "Unknown Track";

      const rawArtist =
        rawTrack?.artist ||
        song?.artist ||
        null;

      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            rawTrack?.artistName ||
            rawTrack?.artist_name ||
            song?.artistName ||
            song?.artist_name ||
            "Unknown Artist";

      const artist =
        typeof rawArtist === "object" &&
        rawArtist !== null
          ? rawArtist
          : {
              name: artistName,
            };

      const album =
        rawTrack?.album ||
        song?.album ||
        null;

      const image =
        rawTrack?.image ||
        rawTrack?.coverArt ||
        song?.image ||
        song?.coverArt ||
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        album?.cover ||
        "";

      const preview =
        rawTrack?.preview ||
        rawTrack?.previewUrl ||
        rawTrack?.playbackUrl ||
        song?.preview ||
        song?.previewUrl ||
        song?.playbackUrl ||
        "";

      return {
        ...EMPTY_TRACK,
        ...song,
        ...rawTrack,

        id: String(id),
        listenableId: String(id),
        listenable_id: String(id),

        type: "track",

        title,
        name: title,

        artist: {
          ...artist,
          name: artistName,
        },

        artistName,

        album,

        image,
        coverArt:
          rawTrack?.coverArt ||
          song?.coverArt ||
          image,

        preview,
        previewUrl: preview,
        playbackUrl: preview,

        reviewCount: Number(
          song?.reviewCount ||
            rawTrack?.reviewCount ||
            0
        ),

        likes: Number(
          song?.likes ||
            rawTrack?.likes ||
            0
        ),
      };
    }, []);

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

        if (!response?.ok) {
          setNotificationsCount(0);
          return;
        }

        const data =
          await response.json();

        const requests =
          normalizeArray(
            data,
            [
              "requests",
              "followRequests",
            ]
          );

        setNotificationsCount(
          requests.length
        );
      } catch (error) {
        console.warn(
          "[Explore] Notification count error:",
          error
        );

        setNotificationsCount(0);
      }
    }, []);

  const fetchTopReviewed =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setTopReviewed([]);
        return;
      }

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
        normalizeArray(
          data,
          [
            "topSongsByReviews",
            "topReviewed",
            "songs",
            "results",
          ]
        );

      setTopReviewed(
        uniqueTracks(
          songs
            .map(normalizeTrack)
            .filter((item) => item.id)
        )
      );
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
        normalizeArray(
          data,
          [
            "topSongsByLikes",
            "topLiked",
            "songs",
            "results",
          ]
        );

      setTopLiked(
        uniqueTracks(
          songs
            .map(normalizeTrack)
            .filter((item) => item.id)
        )
      );
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
        normalizeArray(
          data,
          [
            "recommendedSongs",
            "recommendations",
            "songs",
            "results",
          ]
        );

      setRecommendedSongs(
        uniqueTracks(
          songs
            .map(normalizeTrack)
            .filter((item) => item.id)
        ).slice(0, 24)
      );
    }, [
      normalizeTrack,
      parseResponse,
    ]);

  const loadExplore =
    useCallback(
      async (isRefresh = false) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setTopReviewed([]);
          setTopLiked([]);
          setRecommendedSongs([]);
          setLoading(false);
          setRefreshing(false);
          setErrorMessage(
            "Sign in to discover music."
          );
          return;
        }

        try {
          setErrorMessage("");

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const results =
            await Promise.allSettled([
              fetchNotifications(),
              fetchTopReviewed(),
              fetchTopLiked(),
              fetchRecommendedSongs(),
            ]);

          const failed =
            results.filter(
              (result) =>
                result.status ===
                "rejected"
            );

          if (
            failed.length ===
            results.length
          ) {
            throw new Error(
              "Explore could not load any music."
            );
          }

          if (failed.length > 0) {
            console.warn(
              "[Explore] Some sections failed:",
              failed
            );
          }
        } catch (error) {
          console.error(
            "[Explore] Load error:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Explore could not be loaded."
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

  const trendingSongs =
    useMemo(() => {
      const scored = [
        ...topLiked.map((item, index) => ({
          ...item,
          _trendScore:
            1000 -
            index * 10 +
            Number(item.likes || 0) * 5,
        })),

        ...topReviewed.map((item, index) => ({
          ...item,
          _trendScore:
            900 -
            index * 10 +
            Number(
              item.reviewCount || 0
            ) * 5,
        })),
      ];

      return Array.from(
        scored.reduce(
          (map, item) => {
            const current =
              map.get(item.id);

            if (
              !current ||
              item._trendScore >
                current._trendScore
            ) {
              map.set(item.id, item);
            }

            return map;
          },
          new Map()
        ).values()
      )
        .sort(
          (a, b) =>
            b._trendScore -
            a._trendScore
        )
        .slice(0, 12);
    }, [
      topLiked,
      topReviewed,
    ]);

  const featuredTrack =
    recommendedSongs[0] ||
    trendingSongs[0] ||
    topLiked[0] ||
    topReviewed[0] ||
    null;

  const openTrack =
    useCallback(
      (track) => {
        if (!track?.id) {
          Alert.alert(
            "Unable to open song",
            "This song does not have a valid ID."
          );

          return;
        }

        navigation.navigate(
          "SongPage",
          {
            track,
          }
        );
      },
      [navigation]
    );

  const renderTrackTile =
    useCallback(
      (
        track,
        {
          rank = null,
          metricLabel = "",
          metricValue = "",
        } = {}
      ) => {
        return (
          <TouchableOpacity
            key={`track-${track.id}`}
            style={[
              styles.trackTile,
              isCompact &&
                styles.trackTileCompact,
            ]}
            onPress={() =>
              openTrack(track)
            }
            activeOpacity={0.84}
          >
            <View
              style={styles.trackImageWrap}
            >
              {track.image ? (
                <Image
                  source={{
                    uri: track.image,
                  }}
                  style={styles.trackImage}
                />
              ) : (
                <View
                  style={
                    styles.trackImageFallback
                  }
                >
                  <Icon
                    name="music-note"
                    size={38}
                    color="rgba(255,255,255,0.28)"
                  />
                </View>
              )}

              {rank !== null ? (
                <View style={styles.rankBadge}>
                  <Text
                    style={styles.rankText}
                  >
                    {rank}
                  </Text>
                </View>
              ) : null}

              {track.preview ? (
                <View
                  style={styles.previewBadge}
                >
                  <Icon
                    name="play-arrow"
                    size={13}
                    color="#ffffff"
                  />

                  <Text
                    style={
                      styles.previewBadgeText
                    }
                  >
                    PREVIEW
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.trackTileBody}>
              <Text
                style={styles.trackTitle}
                numberOfLines={2}
              >
                {track.title}
              </Text>

              <Text
                style={styles.trackArtist}
                numberOfLines={1}
              >
                {track.artistName}
              </Text>

              {metricLabel ? (
                <View
                  style={styles.metricRow}
                >
                  <Text
                    style={styles.metricLabel}
                  >
                    {metricLabel}
                  </Text>

                  <Text
                    style={styles.metricValue}
                  >
                    {metricValue}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      },
      [
        isCompact,
        openTrack,
      ]
    );

  const renderHorizontalSection =
    useCallback(
      ({
        title,
        subtitle,
        iconName,
        data,
        metric,
        emptyText,
      }) => (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View
                style={styles.sectionIcon}
              >
                <Icon
                  name={iconName}
                  size={20}
                  color={colours.lightblue}
                />
              </View>

              <View
                style={styles.sectionHeading}
              >
                <Text
                  style={styles.sectionTitle}
                >
                  {title}
                </Text>

                <Text
                  style={styles.sectionSubtitle}
                >
                  {subtitle}
                </Text>
              </View>
            </View>

            <View
              style={styles.sectionCount}
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
            <View style={styles.emptySection}>
              <Icon
                name="explore-off"
                size={28}
                color="rgba(255,255,255,0.26)"
              />

              <Text
                style={styles.emptySectionText}
              >
                {emptyText}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.horizontalContent
              }
            >
              {data.map(
                (track, index) =>
                  renderTrackTile(
                    track,
                    metric
                      ? metric(
                          track,
                          index
                        )
                      : {}
                  )
              )}
            </ScrollView>
          )}
        </View>
      ),
      [renderTrackTile]
    );

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
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
            styles.pageScroll,
            isWeb &&
              styles.webPageScroll,
          ]}
          contentContainerStyle={
            styles.pageScrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
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
        >
          <View style={styles.contentInner}>
            <View style={styles.pageHeader}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>
                  DISCOVER SOMETHING NEW
                </Text>

                <Text style={styles.pageTitle}>
                  Explore
                </Text>

                <Text style={styles.pageSubtitle}>
                  Trending songs, community
                  favourites, and music selected
                  for you.
                </Text>
              </View>

              <TouchableOpacity
                style={
                  styles.notificationsButton
                }
                onPress={() =>
                  navigation.navigate(
                    "Notifications"
                  )
                }
                activeOpacity={0.8}
              >
                <Icon
                  name="notifications-none"
                  size={25}
                  color="#ffffff"
                />

                {notificationsCount > 0 ? (
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
                      {notificationsCount > 99
                        ? "99+"
                        : notificationsCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View
              style={styles.searchContainer}
            >
              <SearchBar />
            </View>

            {loading ? (
              <View
                style={
                  styles.loadingContainer
                }
              >
                <ActivityIndicator
                  size="large"
                  color={colours.lightblue}
                />

                <Text
                  style={styles.loadingText}
                >
                  Discovering music...
                </Text>
              </View>
            ) : (
              <>
                {errorMessage ? (
                  <View
                    style={styles.errorCard}
                  >
                    <Icon
                      name="error-outline"
                      size={21}
                      color="#ff7187"
                    />

                    <Text
                      style={styles.errorText}
                    >
                      {errorMessage}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        loadExplore(false)
                      }
                      style={
                        styles.retryButton
                      }
                    >
                      <Text
                        style={
                          styles.retryButtonText
                        }
                      >
                        RETRY
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {featuredTrack ? (
                  <TouchableOpacity
                    style={[
                      styles.heroCard,
                      isCompact &&
                        styles.heroCardCompact,
                    ]}
                    onPress={() =>
                      openTrack(featuredTrack)
                    }
                    activeOpacity={0.88}
                  >
                    <View
                      style={[
                        styles.heroArtworkWrap,
                        isCompact &&
                          styles.heroArtworkWrapCompact,
                      ]}
                    >
                      {featuredTrack.image ? (
                        <Image
                          source={{
                            uri:
                              featuredTrack.image,
                          }}
                          style={
                            styles.heroArtwork
                          }
                        />
                      ) : (
                        <View
                          style={
                            styles.heroArtworkFallback
                          }
                        >
                          <Icon
                            name="music-note"
                            size={60}
                            color="rgba(255,255,255,0.28)"
                          />
                        </View>
                      )}
                    </View>

                    <View
                      style={
                        styles.heroInformation
                      }
                    >
                      <View
                        style={
                          styles.heroLabel
                        }
                      >
                        <Icon
                          name="auto-awesome"
                          size={15}
                          color="#ffffff"
                        />

                        <Text
                          style={
                            styles.heroLabelText
                          }
                        >
                          FEATURED DISCOVERY
                        </Text>
                      </View>

                      <Text
                        style={styles.heroTitle}
                        numberOfLines={2}
                      >
                        {featuredTrack.title}
                      </Text>

                      <Text
                        style={styles.heroArtist}
                        numberOfLines={1}
                      >
                        {
                          featuredTrack.artistName
                        }
                      </Text>

                      <Text
                        style={
                          styles.heroDescription
                        }
                      >
                        Selected from your Treble
                        recommendations and current
                        community activity.
                      </Text>

                      <View
                        style={
                          styles.heroAction
                        }
                      >
                        <Icon
                          name="play-arrow"
                          size={20}
                          color="#ffffff"
                        />

                        <Text
                          style={
                            styles.heroActionText
                          }
                        >
                          Open Song
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {renderHorizontalSection({
                  title: "Trending Now",
                  subtitle:
                    "Songs rising across likes and reviews",
                  iconName:
                    "local-fire-department",
                  data: trendingSongs,
                  metric: (
                    track,
                    index
                  ) => ({
                    rank: index + 1,
                    metricLabel: "TRENDING",
                    metricValue:
                      Number(
                        track.likes || 0
                      ) > 0
                        ? `${track.likes} likes`
                        : `${track.reviewCount || 0} reviews`,
                  }),
                  emptyText:
                    "Trending songs will appear as the community starts liking and reviewing music.",
                })}

                {renderHorizontalSection({
                  title: "For You",
                  subtitle:
                    "Recommendations based on your activity",
                  iconName: "auto-awesome",
                  data:
                    recommendedSongs,
                  emptyText:
                    "Like and review music to build your personal recommendations.",
                })}

                {renderHorizontalSection({
                  title: "Most Liked",
                  subtitle:
                    "Community favourites on Treble",
                  iconName: "favorite",
                  data: topLiked,
                  metric: (track) => ({
                    metricLabel: "LIKES",
                    metricValue: String(
                      track.likes || 0
                    ),
                  }),
                  emptyText:
                    "No liked songs are available yet.",
                })}

                {renderHorizontalSection({
                  title: "Most Reviewed",
                  subtitle:
                    "Songs creating the most conversation",
                  iconName: "rate-review",
                  data: topReviewed,
                  metric: (track) => ({
                    metricLabel: "REVIEWS",
                    metricValue: String(
                      track.reviewCount || 0
                    ),
                  }),
                  emptyText:
                    "No reviewed songs are available yet.",
                })}
              </>
            )}
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
    container: {
      flex: 1,
      minHeight: 0,
      backgroundColor:
        colours.background ||
        "#101010",
    },

    webContainer: {
      width: "100%",
      height: "100dvh",
      minHeight: 0,
      overflow: "hidden",
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
      height: "100dvh",
      zIndex: 100,
      elevation: 20,
    },

    mobileSideMenu: {
      position: "absolute",
      top: 40,
      left: 0,
      bottom: 0,
      zIndex: 100,
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
      bottom:
        BOTTOM_NAV_HEIGHT,
    },

    mobilePageContent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom:
        BOTTOM_NAV_HEIGHT,
      paddingTop: 64,
    },

    pageScroll: {
      flex: 1,
      width: "100%",
    },

    webPageScroll: {
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling:
        "touch",
      touchAction: "pan-y",
    },

    pageScrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 70,
    },

    contentInner: {
      width: "100%",
      maxWidth:
        MAX_CONTENT_WIDTH,
      alignSelf: "center",
    },

    pageHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent:
        "space-between",
      marginBottom: 18,
    },

    headerText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 18,
    },

    eyebrow: {
      color: colours.lightblue,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.8,
      marginBottom: 5,
    },

    pageTitle: {
      color: "#ffffff",
      fontSize: 38,
      lineHeight: 45,
      fontWeight: "900",
    },

    pageSubtitle: {
      maxWidth: 650,
      color:
        "rgba(255,255,255,0.60)",
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
    },

    notificationsButton: {
      position: "relative",
      width: 46,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      backgroundColor:
        "rgba(255,255,255,0.055)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.09)",
    },

    notificationBadge: {
      position: "absolute",
      top: -5,
      right: -5,
      minWidth: 21,
      height: 21,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 11,
      backgroundColor: "#ff405f",
      borderWidth: 2,
      borderColor:
        colours.background ||
        "#101010",
    },

    notificationBadgeText: {
      color: "#ffffff",
      fontSize: 9,
      fontWeight: "900",
    },

    searchContainer: {
      width: "100%",
      marginBottom: 22,
      position: "relative",
      zIndex: 20,
    },

    loadingContainer: {
      minHeight: 400,
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.60)",
      fontSize: 13,
      marginTop: 12,
    },

    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      marginBottom: 18,
      borderRadius: 14,
      backgroundColor:
        "rgba(255,70,100,0.10)",
      borderWidth: 1,
      borderColor:
        "rgba(255,70,100,0.18)",
    },

    errorText: {
      flex: 1,
      color: "#ff9cac",
      fontSize: 12,
      lineHeight: 18,
      marginHorizontal: 9,
    },

    retryButton: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    retryButtonText: {
      color: "#ffffff",
      fontSize: 9,
      fontWeight: "900",
    },

    heroCard: {
      width: "100%",
      minHeight: 290,
      flexDirection: "row",
      overflow: "hidden",
      marginBottom: 26,
      borderRadius: 24,
      backgroundColor:
        "rgba(27,54,78,0.88)",
      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.26)",
    },

    heroCardCompact: {
      flexDirection: "column",
    },

    heroArtworkWrap: {
      width: "42%",
      minHeight: 290,
      backgroundColor:
        "rgba(255,255,255,0.045)",
    },

    heroArtworkWrapCompact: {
      width: "100%",
      height: 250,
      minHeight: 250,
    },

    heroArtwork: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    heroArtworkFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    heroInformation: {
      flex: 1,
      justifyContent: "center",
      padding: 28,
    },

    heroLabel: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor:
        colours.lightblue,
      marginBottom: 15,
    },

    heroLabelText: {
      color: "#ffffff",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    heroTitle: {
      color: "#ffffff",
      fontSize: 31,
      lineHeight: 38,
      fontWeight: "900",
    },

    heroArtist: {
      color: colours.lightblue,
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "800",
      marginTop: 5,
    },

    heroDescription: {
      maxWidth: 520,
      color:
        "rgba(255,255,255,0.61)",
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },

    heroAction: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor:
        "rgba(255,255,255,0.10)",
      marginTop: 20,
    },

    heroActionText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "900",
    },

    section: {
      width: "100%",
      marginBottom: 28,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginBottom: 13,
    },

    sectionTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
    },

    sectionIcon: {
      width: 39,
      height: 39,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor:
        "rgba(53,175,229,0.11)",
      marginRight: 11,
    },

    sectionHeading: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      color: "#ffffff",
      fontSize: 20,
      lineHeight: 25,
      fontWeight: "900",
    },

    sectionSubtitle: {
      color:
        "rgba(255,255,255,0.47)",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 1,
    },

    sectionCount: {
      minWidth: 31,
      height: 31,
      paddingHorizontal: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    sectionCountText: {
      color: colours.lightblue,
      fontSize: 11,
      fontWeight: "900",
    },

    horizontalContent: {
      paddingRight: 24,
    },

    trackTile: {
      width: 182,
      flexShrink: 0,
      overflow: "hidden",
      marginRight: 14,
      borderRadius: 18,
      backgroundColor:
        "rgba(255,255,255,0.045)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.075)",
    },

    trackTileCompact: {
      width: 155,
    },

    trackImageWrap: {
      position: "relative",
      width: "100%",
      aspectRatio: 1,
      backgroundColor:
        "rgba(255,255,255,0.05)",
    },

    trackImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    trackImageFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    rankBadge: {
      position: "absolute",
      top: 9,
      left: 9,
      minWidth: 31,
      height: 31,
      paddingHorizontal: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor:
        "rgba(0,0,0,0.72)",
    },

    rankText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900",
    },

    previewBadge: {
      position: "absolute",
      left: 9,
      bottom: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor:
        "rgba(0,0,0,0.72)",
    },

    previewBadgeText: {
      color: "#ffffff",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.5,
    },

    trackTileBody: {
      paddingHorizontal: 13,
      paddingTop: 12,
      paddingBottom: 14,
    },

    trackTitle: {
      color: "#ffffff",
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
    },

    trackArtist: {
      color:
        "rgba(255,255,255,0.48)",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },

    metricRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 11,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor:
        "rgba(255,255,255,0.07)",
    },

    metricLabel: {
      color:
        "rgba(255,255,255,0.34)",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    metricValue: {
      color: colours.lightblue,
      fontSize: 10,
      fontWeight: "900",
    },

    emptySection: {
      minHeight: 130,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
      borderRadius: 17,
      backgroundColor:
        "rgba(255,255,255,0.035)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.06)",
    },

    emptySectionText: {
      maxWidth: 500,
      color:
        "rgba(255,255,255,0.49)",
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 8,
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
      right: 0,
    },

  });
