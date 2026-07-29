import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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

import { Chip } from "@rneui/base";
import { useFocusEffect } from "@react-navigation/native";

import { auth } from "../utils/firebase";

import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import BottomNavbar from "../components/BottomNavbar";
import SectionDivider from "../components/SectionDivider";
import MusicCard from "../components/MusicCard";

import {
  followUser,
  getFollowRequests,
  postSearchResults,
  requestFollow,
  unfollowUser,
} from "../providers/rest";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const DESKTOP_HEADER_HEIGHT = 70;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 980;

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

const initialFilterState = {
  songOnly: false,
  albumOnly: false,
  artistOnly: false,
  userOnly: false,
};

function filterReducer(state, action) {
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

    case "RESET":
      return initialFilterState;

    default:
      return state;
  }
}

export default function Search({
  navigation,
  route,
}) {
  const { width } = useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact =
    width < 600;

  const searchQuery =
    route?.params?.searchQuery?.trim() ||
    "";

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    searchResult,
    setSearchResults,
  ] = useState([]);

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    followingUsers,
    setFollowingUsers,
  ] = useState({});

  const [
    followRequests,
    setFollowRequests,
  ] = useState({});

  const [
    followLoading,
    setFollowLoading,
  ] = useState({});

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

  const [filter, dispatchFilter] =
    useReducer(
      filterReducer,
      initialFilterState
    );

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
            "The backend returned an invalid response."
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
   * Normalize all search result types.
   */
  const normalizeSearchItem =
    useCallback((item) => {
      const rawType =
        item?.type ||
        item?.itemType ||
        item?.category ||
        "";

      const type =
        String(rawType).toLowerCase();

      const id =
        item?.id ||
        item?.listenableId ||
        item?.listenable_id ||
        item?.userId ||
        item?.uid ||
        "";

      const rawArtist =
        item?.artist ||
        item?.artistName ||
        null;

      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            item?.artistName ||
            "";

      const artist =
        typeof rawArtist === "string"
          ? {
              name: rawArtist,
            }
          : rawArtist ||
            (
              artistName
                ? {
                    name: artistName,
                  }
                : null
            );

      const album =
        item?.album || null;

      const albumName =
        item?.albumName ||
        (
          typeof album === "string"
            ? album
            : album?.title ||
              album?.name ||
              ""
        );

      const image =
        item?.image ||
        item?.coverArt ||
        item?.avatar ||
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        "";

      return {
        ...item,

        id: String(id),

        userId:
          type === "user"
            ? String(
                item?.userId ||
                  item?.uid ||
                  id
              )
            : item?.userId,

        type,

        name:
          item?.name ||
          item?.title ||
          item?.username ||
          "Unknown",

        title:
          item?.title ||
          item?.name ||
          "",

        username:
          item?.username ||
          item?.name ||
          "",

        artist:
  artistName,

        artistName,

        album,

        albumName,

        image,

        coverArt:
          item?.coverArt ||
          image,
      };
    }, []);

  /*
   * Fetch search results.
   */
  const getSearchResults =
    useCallback(
      async (isRefresh = false) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setSearchResults([]);
          setSearchLoading(false);
          setRefreshing(false);

          navigation.navigate("Home");

          return;
        }

        if (!searchQuery) {
          setSearchResults([]);
          setSearchLoading(false);
          setRefreshing(false);

          return;
        }

        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setSearchLoading(true);
          }

          const response =
            await postSearchResults(
              searchQuery,
              currentUser.uid
            );

          const data =
            await parseResponse(
              response,
              "Search failed."
            );

          const rawResults =
            Array.isArray(data)
              ? data
              : Array.isArray(
                    data?.searchResult
                )
                ? data.searchResult
                : Array.isArray(
                      data?.results
                  )
                  ? data.results
                  : [];

          const normalized =
            rawResults
              .map(
                normalizeSearchItem
              )
              .filter(
                (item) =>
                  Boolean(
                    item?.type
                  )
              );

          setSearchResults(
            normalized
          );

          /*
           * Save initial following state from search results.
           */
          setFollowingUsers(
            normalized.reduce(
              (
                result,
                item
              ) => {
                if (
                  item?.type ===
                    "user" &&
                  item?.userId
                ) {
                  result[
                    item.userId
                  ] =
                    Boolean(
                      item?.isFollowing
                    );
                }

                return result;
              },
              {}
            )
          );
        } catch (error) {
          console.error(
            "[Search] Search error:",
            error
          );

          setSearchResults([]);

          Alert.alert(
            "Search failed",
            error?.message ||
              "Unable to complete your search."
          );
        } finally {
          setSearchLoading(false);
          setRefreshing(false);
        }
      },
      [
        navigation,
        normalizeSearchItem,
        parseResponse,
        searchQuery,
      ]
    );

  /*
   * Fetch pending notification count.
   */
  const loadNotifications =
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
          "[Search] Notifications error:",
          error
        );

        setNotificationsCount(0);
      }
    }, [parseResponse]);

  /*
   * Check pending follow requests for private users.
   */
  const loadFollowRequestStatuses =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        return;
      }

      const userResults =
        searchResult.filter(
          (item) =>
            item?.type ===
              "user" &&
            item?.userId &&
            item.userId !==
              currentUser.uid
        );

      if (
        userResults.length === 0
      ) {
        return;
      }

      await Promise.all(
        userResults.map(
          async (user) => {
            try {
              const response =
                await getFollowRequests(
                  user.userId
                );

              if (!response?.ok) {
                return;
              }

              const data =
                await response.json();

              const requests =
                Array.isArray(data)
                  ? data
                  : Array.isArray(
                        data?.requests
                    )
                    ? data.requests
                    : [];

              const requested =
                requests.some(
                  (requestItem) =>
                    String(
                      requestItem?.userId ||
                        requestItem?.requesterId ||
                        requestItem?.fromUserId ||
                        ""
                    ) ===
                    String(
                      currentUser.uid
                    )
                );

              setFollowRequests(
                (current) => ({
                  ...current,
                  [user.userId]:
                    requested,
                })
              );
            } catch (error) {
              console.warn(
                `[Search] Could not check follow request for ${user.userId}:`,
                error
              );
            }
          }
        )
      );
    }, [searchResult]);

  /*
   * Run search whenever query changes.
   */
  useEffect(() => {
    dispatchFilter({
      type: "RESET",
    });

    getSearchResults(false);
  }, [
    getSearchResults,
    searchQuery,
  ]);

  /*
   * Reload notification count when the page is focused.
   */
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  useEffect(() => {
    loadFollowRequestStatuses();
  }, [
    loadFollowRequestStatuses,
  ]);

  const handleRefresh =
    useCallback(async () => {
      await Promise.all([
        getSearchResults(true),
        loadNotifications(),
      ]);
    }, [
      getSearchResults,
      loadNotifications,
    ]);

  /*
   * Follow a public user or request access to a private user.
   */
  const handleFollow =
    useCallback(
      async (targetUser) => {
        const currentUser =
          auth.currentUser;

        const targetUserId =
          String(
            targetUser?.userId ||
              ""
          );

        if (
          !currentUser?.uid ||
          !targetUserId ||
          followLoading[
            targetUserId
          ]
        ) {
          return;
        }

        const userIsPublic =
          targetUser?.isPublic ===
            true ||
          targetUser?.isPublic ===
            "true" ||
          targetUser?.isPublic ===
            1;

        setFollowLoading(
          (current) => ({
            ...current,
            [targetUserId]: true,
          })
        );

        try {
          if (userIsPublic) {
            setFollowingUsers(
              (current) => ({
                ...current,
                [targetUserId]:
                  true,
              })
            );

            const response =
              await followUser(
                currentUser.uid,
                targetUserId
              );

            await parseResponse(
              response,
              "Unable to follow this user."
            );
          } else {
            if (
              followRequests[
                targetUserId
              ]
            ) {
              return;
            }

            const response =
              await requestFollow(
                currentUser.uid,
                targetUserId
              );

            await parseResponse(
              response,
              "Unable to send the follow request."
            );

            setFollowRequests(
              (current) => ({
                ...current,
                [targetUserId]:
                  true,
              })
            );

            Alert.alert(
              "Request sent",
              "Your request to follow this private account was sent."
            );
          }
        } catch (error) {
          console.error(
            "[Search] Follow error:",
            error
          );

          if (userIsPublic) {
            setFollowingUsers(
              (current) => ({
                ...current,
                [targetUserId]:
                  false,
              })
            );
          }

          Alert.alert(
            "Unable to follow",
            error?.message ||
              "Please try again."
          );
        } finally {
          setFollowLoading(
            (current) => {
              const updated = {
                ...current,
              };

              delete updated[
                targetUserId
              ];

              return updated;
            }
          );
        }
      },
      [
        followLoading,
        followRequests,
        parseResponse,
      ]
    );

  /*
   * Unfollow a user.
   */
  const handleUnfollow =
    useCallback(
      async (targetUser) => {
        const currentUser =
          auth.currentUser;

        const targetUserId =
          String(
            targetUser?.userId ||
              ""
          );

        if (
          !currentUser?.uid ||
          !targetUserId ||
          followLoading[
            targetUserId
          ]
        ) {
          return;
        }

        setFollowLoading(
          (current) => ({
            ...current,
            [targetUserId]: true,
          })
        );

        setFollowingUsers(
          (current) => ({
            ...current,
            [targetUserId]:
              false,
          })
        );

        try {
          const response =
            await unfollowUser(
              currentUser.uid,
              targetUserId
            );

          await parseResponse(
            response,
            "Unable to unfollow this user."
          );
        } catch (error) {
          console.error(
            "[Search] Unfollow error:",
            error
          );

          setFollowingUsers(
            (current) => ({
              ...current,
              [targetUserId]:
                true,
            })
          );

          Alert.alert(
            "Unable to unfollow",
            error?.message ||
              "Please try again."
          );
        } finally {
          setFollowLoading(
            (current) => {
              const updated = {
                ...current,
              };

              delete updated[
                targetUserId
              ];

              return updated;
            }
          );
        }
      },
      [
        followLoading,
        parseResponse,
      ]
    );

  const formatUsername =
    useCallback((name) => {
      const cleanName =
        String(name || "").trim();

      if (!cleanName) {
        return "Treble User";
      }

      return (
        cleanName
          .charAt(0)
          .toUpperCase() +
        cleanName.slice(1)
      );
    }, []);

  const getAvatarSource =
    useCallback((avatar) => {
      if (
        avatar &&
        typeof avatar ===
          "string" &&
        (
          avatar.startsWith(
            "data:"
          ) ||
          avatar.startsWith(
            "http://"
          ) ||
          avatar.startsWith(
            "https://"
          )
        )
      ) {
        return {
          uri: avatar,
        };
      }

      return FALLBACK_AVATAR;
    }, []);

  const safeSearchResults =
    useMemo(
      () =>
        Array.isArray(
          searchResult
        )
          ? searchResult
          : [],
      [searchResult]
    );

  const songs = useMemo(
    () =>
      safeSearchResults.filter(
        (item) =>
          item?.type === "track"
      ),
    [safeSearchResults]
  );

  const albums = useMemo(
    () =>
      safeSearchResults.filter(
        (item) =>
          item?.type === "album"
      ),
    [safeSearchResults]
  );

  const artists = useMemo(
    () =>
      safeSearchResults.filter(
        (item) =>
          item?.type === "artist"
      ),
    [safeSearchResults]
  );

  const users = useMemo(
    () =>
      safeSearchResults.filter(
        (item) =>
          item?.type === "user"
      ),
    [safeSearchResults]
  );

  const shouldShowTrack =
    !filter.albumOnly &&
    !filter.artistOnly &&
    !filter.userOnly;

  const shouldShowAlbum =
    !filter.songOnly &&
    !filter.artistOnly &&
    !filter.userOnly;

  const shouldShowArtist =
    !filter.songOnly &&
    !filter.albumOnly &&
    !filter.userOnly;

  const shouldShowUser =
    !filter.songOnly &&
    !filter.albumOnly &&
    !filter.artistOnly;

  const totalResults =
    safeSearchResults.length;

  const renderEmptySection =
    useCallback((label) => {
      return (
        <Text
          style={
            styles.emptySectionText
          }
        >
          No {label.toLowerCase()} found.
        </Text>
      );
    }, []);

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* =====================================================
          TOP HEADER
      ===================================================== */}
      <View
        style={[
          styles.pageHeader,
          isDesktopWeb &&
            styles.desktopPageHeader,
          isMobileWeb &&
            styles.mobilePageHeader,
        ]}
      >
        <View
          style={
            styles.searchContainer
          }
        >
          <SearchBar />
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
        >
          <Image
            source={require(
              "../images/notificationsIcon2.png"
            )}
            style={
              styles.notificationIcon
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
          isDesktop={
            isDesktopWeb
          }
        />
      </View>

      {/* =====================================================
          PAGE CONTENT
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
        <View
          style={[
            styles.contentInner,
            isDesktopWeb &&
              styles.desktopContentInner,
          ]}
        >
          <View
            style={
              styles.titleContainer
            }
          >
            <Text
              style={
                styles.pageTitle
              }
            >
              Search Results
            </Text>

            <Text
              style={
                styles.pageDescription
              }
            >
              {searchQuery
                ? `Results for “${searchQuery}”`
                : "Enter a search to find music and users."}
            </Text>

            {!searchLoading &&
            searchQuery ? (
              <Text
                style={
                  styles.resultCount
                }
              >
                {totalResults}{" "}
                {totalResults === 1
                  ? "result"
                  : "results"}
              </Text>
            ) : null}
          </View>

          {searchLoading ? (
            <View
              style={
                styles.loaderContainer
              }
            >
              <ActivityIndicator
                size="large"
                color="#ffffff"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Searching...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={[
                styles.resultsScroll,
                isWeb &&
                  styles.webResultsScroll,
              ]}
              contentContainerStyle={[
                styles.resultsContent,
                totalResults === 0 &&
                  styles.emptyResultsContent,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={
                    refreshing
                  }
                  onRefresh={
                    handleRefresh
                  }
                  tintColor="#ffffff"
                  colors={[
                    "#ffffff",
                  ]}
                  progressBackgroundColor={
                    colours.darkblue
                  }
                />
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              {/* FILTER CHIPS */}
              <View
                style={[
                  styles.chipContainer,
                  isCompact &&
                    styles.compactChipContainer,
                ]}
              >
                <Chip
                  title="Songs"
                  onPress={() =>
                    dispatchFilter({
                      type:
                        "TOGGLE_SONG",
                    })
                  }
                  type={
                    filter.songOnly
                      ? "solid"
                      : "outline"
                  }
                  buttonStyle={[
                    styles.filterChip,
                    filter.songOnly &&
                      styles.selectedFilterChip,
                  ]}
                  titleStyle={
                    styles.filterChipText
                  }
                  containerStyle={
                    styles.filterChipContainer
                  }
                />

                <Chip
                  title="Albums"
                  onPress={() =>
                    dispatchFilter({
                      type:
                        "TOGGLE_ALBUM",
                    })
                  }
                  type={
                    filter.albumOnly
                      ? "solid"
                      : "outline"
                  }
                  buttonStyle={[
                    styles.filterChip,
                    filter.albumOnly &&
                      styles.selectedFilterChip,
                  ]}
                  titleStyle={
                    styles.filterChipText
                  }
                  containerStyle={
                    styles.filterChipContainer
                  }
                />

                <Chip
                  title="Artists"
                  onPress={() =>
                    dispatchFilter({
                      type:
                        "TOGGLE_ARTIST",
                    })
                  }
                  type={
                    filter.artistOnly
                      ? "solid"
                      : "outline"
                  }
                  buttonStyle={[
                    styles.filterChip,
                    filter.artistOnly &&
                      styles.selectedFilterChip,
                  ]}
                  titleStyle={
                    styles.filterChipText
                  }
                  containerStyle={
                    styles.filterChipContainer
                  }
                />

                <Chip
                  title="Users"
                  onPress={() =>
                    dispatchFilter({
                      type:
                        "TOGGLE_USER",
                    })
                  }
                  type={
                    filter.userOnly
                      ? "solid"
                      : "outline"
                  }
                  buttonStyle={[
                    styles.filterChip,
                    filter.userOnly &&
                      styles.selectedFilterChip,
                  ]}
                  titleStyle={
                    styles.filterChipText
                  }
                  containerStyle={
                    styles.filterChipContainer
                  }
                />
              </View>

              {totalResults === 0 ? (
                <View
                  style={
                    styles.emptyContainer
                  }
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    No results found
                  </Text>

                  <Text
                    style={
                      styles.emptyDescription
                    }
                  >
                    Try searching for a different song, album, artist, or user.
                  </Text>
                </View>
              ) : (
                <>
                  {/* SONGS */}
                  {shouldShowTrack ? (
                    <View
                      style={
                        styles.resultSection
                      }
                    >
                      <SectionDivider
                        title="Songs"
                      />

                      {songs.length >
                      0
                        ? songs.map(
                            (item) => (
                              <View
                                key={`track-${item.id}`}
                                style={
                                  styles.cardWrapper
                                }
                              >
                                <MusicCard
                                  id={
                                    item.id
                                  }
                                  image={
                                    item.image
                                  }
                                  name={
                                    item.name ||
                                    item.title
                                  }
                                  artist={
                                    item.artistName ||
                                    item.artist?.name ||
                                    ""
                                  }
                                  album={
                                    item.albumName ||
                                    item.album
                                      ?.title ||
                                    ""
                                  }
                                  onPressCard={() =>
                                    navigation.navigate(
                                      "SongPage",
                                      {
                                        track:
                                          item,
                                      }
                                    )
                                  }
                                />
                              </View>
                            )
                          )
                        : renderEmptySection(
                            "Songs"
                          )}
                    </View>
                  ) : null}

                  {/* ALBUMS */}
                  {shouldShowAlbum ? (
                    <View
                      style={
                        styles.resultSection
                      }
                    >
                      <SectionDivider
                        title="Albums"
                      />

                      {albums.length >
                      0
                        ? albums.map(
                            (item) => (
                              <View
                                key={`album-${item.id}`}
                                style={
                                  styles.cardWrapper
                                }
                              >
                                <MusicCard
                                  id={
                                    item.id
                                  }
                                  image={
                                    item.image
                                  }
                                  name={
                                    item.name ||
                                    item.title
                                  }
                                  artist={
                                    item.artistName ||
                                    item.artist?.name ||
                                    ""
                                  }
                                  onPressCard={() =>
                                    navigation.navigate(
                                      "AlbumPage",
                                      {
                                        album:
                                          item,
                                      }
                                    )
                                  }
                                />
                              </View>
                            )
                          )
                        : renderEmptySection(
                            "Albums"
                          )}
                    </View>
                  ) : null}

                  {/* ARTISTS */}
                  {shouldShowArtist ? (
                    <View
                      style={
                        styles.resultSection
                      }
                    >
                      <SectionDivider
                        title="Artists"
                      />

                      {artists.length >
                      0
                        ? artists.map(
                            (item) => (
                              <View
                                key={`artist-${item.id}`}
                                style={
                                  styles.cardWrapper
                                }
                              >
                                <MusicCard
                                  id={
                                    item.id
                                  }
                                  image={
                                    item.image
                                  }
                                  name={
                                    item.name
                                  }
                                  artist={
                                    item.name
                                  }
                                  onPressCard={() =>
                                    navigation.navigate(
                                      "ArtistPage",
                                      {
                                        artist:
                                          item,
                                      }
                                    )
                                  }
                                />
                              </View>
                            )
                          )
                        : renderEmptySection(
                            "Artists"
                          )}
                    </View>
                  ) : null}

                  {/* USERS */}
                  {shouldShowUser ? (
                    <View
                      style={
                        styles.resultSection
                      }
                    >
                      <SectionDivider
                        title="Users"
                      />

                      {users.length >
                      0
                        ? users.map(
                            (item) => {
                              const currentUserId =
                                String(
                                  auth
                                    .currentUser
                                    ?.uid ||
                                    ""
                                );

                              const userId =
                                String(
                                  item?.userId ||
                                    ""
                                );

                              const isCurrentUser =
                                userId ===
                                currentUserId;

                              const isFollowing =
                                Object.prototype.hasOwnProperty.call(
                                  followingUsers,
                                  userId
                                )
                                  ? Boolean(
                                      followingUsers[
                                        userId
                                      ]
                                    )
                                  : Boolean(
                                      item?.isFollowing
                                    );

                              const alreadyRequested =
                                Boolean(
                                  followRequests[
                                    userId
                                  ]
                                );

                              const userIsPublic =
                                item?.isPublic ===
                                  true ||
                                item?.isPublic ===
                                  "true" ||
                                item?.isPublic ===
                                  1;

                              const isUpdating =
                                Boolean(
                                  followLoading[
                                    userId
                                  ]
                                );

                              let finalButtonLabel =
                                "Follow";

                              if (
                                isUpdating
                              ) {
                                finalButtonLabel =
                                  "Loading...";
                              } else if (
                                isFollowing
                              ) {
                                finalButtonLabel =
                                  "Following";
                              } else if (
                                !userIsPublic &&
                                alreadyRequested
                              ) {
                                finalButtonLabel =
                                  "Requested";
                              }

                              const avatar =
                                item?.avatar ||
                                item?.image ||
                                "";

                              return (
                                <View
                                    key={`user-${userId}`}
                                    style={
                                      styles.userCardWrapper
                                    }
                                  >
                                    <TouchableOpacity
                                      style={
                                        styles.userResultCard
                                      }
                                      activeOpacity={0.82}
                                      onPress={() =>
                                        navigation.navigate(
                                          "UserProfiles",
                                          {
                                            userId,
                                          }
                                        )
                                      }
                                    >
                                      <Image
                                        source={
                                          getAvatarSource(
                                            avatar
                                          )
                                        }
                                        style={
                                          styles.userResultAvatar
                                        }
                                        onError={(event) => {
                                          console.warn(
                                            "[Search] User avatar failed:",
                                            event?.nativeEvent?.error
                                          );
                                        }}
                                      />

                                      <View
                                        style={
                                          styles.userResultInformation
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.userResultUsername
                                          }
                                          numberOfLines={1}
                                          ellipsizeMode="tail"
                                        >
                                          {formatUsername(
                                            item?.username
                                          )}
                                        </Text>

                                        <Text
                                          style={
                                            styles.userResultPrivacy
                                          }
                                          numberOfLines={1}
                                        >
                                          {userIsPublic
                                            ? "Public profile"
                                            : "Private profile"}
                                        </Text>
                                      </View>

                                      {!isCurrentUser ? (
                                        <TouchableOpacity
                                          style={[
                                            styles.userFollowButton,

                                            isFollowing &&
                                              styles.userFollowingButton,

                                            alreadyRequested &&
                                            !isFollowing &&
                                              styles.userRequestedButton,

                                            (
                                              isUpdating ||
                                              (
                                                !userIsPublic &&
                                                alreadyRequested &&
                                                !isFollowing
                                              )
                                            ) &&
                                              styles.userFollowButtonDisabled,
                                          ]}
                                          disabled={
                                            isUpdating ||
                                            (
                                              !userIsPublic &&
                                              alreadyRequested &&
                                              !isFollowing
                                            )
                                          }
                                          activeOpacity={0.8}
                                          onPress={(event) => {
                                            event?.stopPropagation?.();

                                            if (
                                              isUpdating
                                            ) {
                                              return;
                                            }

                                            if (
                                              isFollowing
                                            ) {
                                              handleUnfollow(
                                                item
                                              );
                                            } else {
                                              handleFollow(
                                                item
                                              );
                                            }
                                          }}
                                        >
                                          {isUpdating ? (
                                            <ActivityIndicator
                                              size="small"
                                              color="#ffffff"
                                            />
                                          ) : (
                                            <Text
                                              style={
                                                styles.userFollowButtonText
                                              }
                                              numberOfLines={1}
                                            >
                                              {finalButtonLabel}
                                            </Text>
                                          )}
                                        </TouchableOpacity>
                                      ) : (
                                        <View
                                          style={
                                            styles.currentUserBadge
                                          }
                                        >
                                          <Text
                                            style={
                                              styles.currentUserBadgeText
                                            }
                                          >
                                            You
                                          </Text>
                                        </View>
                                      )}
                                    </TouchableOpacity>
                                  </View>
                              );
                            }
                          )
                        : renderEmptySection(
                            "Users"
                          )}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}
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

const styles = StyleSheet.create({
  /* =====================================================
     PAGE
  ===================================================== */

  container: {
    flex: 1,
    minHeight: 0,

    backgroundColor:
  colours.background ||
  colours.bluegrey,
  },

  webContainer: {
    width: "100%",
    height: "100vh",

    minHeight: 0,

    overflow: "hidden",
  },

  /* =====================================================
     HEADER
  ===================================================== */

  pageHeader: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,

    zIndex: 50,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 18,

    backgroundColor:
      colours.background ||
      colours.bluegrey,
  },

  desktopPageHeader: {
    left:
      DESKTOP_SIDEBAR_WIDTH,

    height:
      DESKTOP_HEADER_HEIGHT,

    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 32,
    paddingRight: 32,
  },

  mobilePageHeader: {
    height: 105,

    paddingTop: 20,
    paddingBottom: 10,
  },

  searchContainer: {
    flex: 1,
    minWidth: 0,
  },

  notificationsButton: {
    position: "relative",

    width: 48,
    height: 48,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 14,

    borderRadius: 24,

    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  notificationIcon: {
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
      colours.background ||
      colours.bluegrey,

    borderRadius: 11,

    backgroundColor:
      "#ff334f",
  },

  notificationBadgeText: {
    color: "#ffffff",

    fontSize: 10,
    fontWeight: "800",
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
     CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",

    top:
      DESKTOP_HEADER_HEIGHT,

    left:
      DESKTOP_SIDEBAR_WIDTH,

    right: 0,

    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 18,
    paddingLeft: 28,
    paddingRight: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 105,
    left: 0,
    right: 0,

    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 14,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  contentInner: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  desktopContentInner: {
    width: "100%",

    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",

    paddingHorizontal: 10,
  },

  /* =====================================================
     PAGE TITLE
  ===================================================== */

  titleContainer: {
    width: "100%",

    marginBottom: 14,
  },

  pageTitle: {
    color: "#ffffff",

    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
  },

  pageDescription: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  resultCount: {
    color:
      colours.lightblue,

    fontSize: 13,
    fontWeight: "700",

    marginTop: 7,
  },

  /* =====================================================
     LOADING
  ===================================================== */

  loaderContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingBottom: 80,
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     RESULTS SCROLLING
  ===================================================== */

  resultsScroll: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webResultsScroll: {
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

  resultsContent: {
    width: "100%",

    paddingBottom: 50,
  },

  emptyResultsContent: {
    flexGrow: 1,
  },

  /* =====================================================
     FILTER CHIPS
  ===================================================== */

  chipContainer: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",

    flexWrap: "wrap",

    gap: 10,

    paddingVertical: 4,
    marginBottom: 22,
  },

  compactChipContainer: {
    justifyContent:
      "flex-start",
  },

  filterChipContainer: {
    margin: 0,
  },

  filterChip: {
    minHeight: 38,

    paddingHorizontal: 15,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.2)",

    borderRadius: 19,

    backgroundColor:
      "rgba(255,255,255,0.04)",
  },

  selectedFilterChip: {
    borderColor:
      colours.lightblue,

    backgroundColor:
      colours.lightblue,
  },

  filterChipText: {
    color: "#ffffff",

    fontSize: 13,
    fontWeight: "700",
  },

  /* =====================================================
     RESULT SECTIONS
  ===================================================== */

  resultSection: {
    width: "100%",

    marginBottom: 20,
  },

  cardWrapper: {
    width: "100%",
    maxWidth: 860,

    alignSelf: "center",

    marginBottom: 10,
  },

  userCardWrapper: {
  width: "100%",
  maxWidth: 860,

  alignSelf: "center",

  marginBottom: 12,
},

userResultCard: {
  width: "100%",
  minHeight: 76,

  flexDirection: "row",
  alignItems: "center",

  paddingVertical: 10,
  paddingHorizontal: 12,

  borderWidth: 1,
  borderColor:
    "rgba(255,255,255,0.12)",

  borderRadius: 14,

  backgroundColor:
    "rgba(255,255,255,0.96)",
},

userResultAvatar: {
  width: 54,
  height: 54,

  flexShrink: 0,

  borderRadius: 10,

  resizeMode: "cover",

  backgroundColor:
    "rgba(0,0,0,0.16)",
},

userResultInformation: {
  flex: 1,
  minWidth: 0,

  justifyContent: "center",

  marginLeft: 14,
  marginRight: 14,
},

userResultUsername: {
  width: "100%",

  color: "#111111",

  fontSize: 16,
  lineHeight: 21,
  fontWeight: "800",
},

userResultPrivacy: {
  color:
    "rgba(0,0,0,0.52)",

  fontSize: 12,
  lineHeight: 17,

  marginTop: 3,
},

userFollowButton: {
  minWidth: 108,
  height: 40,

  flexShrink: 0,

  alignItems: "center",
  justifyContent: "center",

  paddingHorizontal: 18,

  borderRadius: 20,

  backgroundColor:
    colours.lightblue ||
    "#35afe5",
},

userFollowingButton: {
  backgroundColor:
    "#258bb9",
},

userRequestedButton: {
  backgroundColor:
    "#777777",
},

userFollowButtonDisabled: {
  opacity: 0.62,
},

userFollowButtonText: {
  color: "#ffffff",

  fontSize: 14,
  fontWeight: "800",
},

currentUserBadge: {
  minWidth: 58,
  height: 34,

  flexShrink: 0,

  alignItems: "center",
  justifyContent: "center",

  paddingHorizontal: 14,

  borderWidth: 1,
  borderColor:
    colours.lightblue ||
    "#35afe5",

  borderRadius: 17,

  backgroundColor:
    "rgba(53,175,229,0.12)",
},

currentUserBadgeText: {
  color:
    colours.lightblue ||
    "#35afe5",

  fontSize: 13,
  fontWeight: "800",
},

  emptySectionText: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 14,

    textAlign: "center",

    paddingVertical: 22,
  },

  /* =====================================================
     EMPTY SEARCH
  ===================================================== */

  emptyContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 24,
    paddingBottom: 80,
  },

  emptyTitle: {
    color: "#ffffff",

    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",

    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 420,

    color:
      "rgba(255,255,255,0.55)",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",

    marginTop: 6,
  },

  /* =====================================================
     BOTTOM NAVIGATION
  ===================================================== */

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