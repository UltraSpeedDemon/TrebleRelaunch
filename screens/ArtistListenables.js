import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import MusicCard from "../components/MusicCard";

import {
  getArtistTracks,
  getArtistAlbums,
} from "../providers/rest";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const DESKTOP_HEADER_HEIGHT = 86;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 980;

const BACK_ICON =
  require("../images/arrowLeftIconWhite.png");


const cleanArtistName = (value) => {
  const name =
    typeof value === "string"
      ? value.trim()
      : "";

  if (
    !name ||
    name.toLowerCase() === "unknown artist" ||
    name.toLowerCase() === "unknown"
  ) {
    return "";
  }

  return name;
};

export default function ArtistListenables({
  navigation,
  route,
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

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    listenableData,
    setListenableData,
  ] = useState([]);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const type =
    route?.params?.type === "album"
      ? "album"
      : "track";

  const artist =
    route?.params?.artist || {};

  const artistId =
    String(
      artist?.id ||
      artist?.listenableId ||
      artist?.artistId ||
      ""
    );

  const artistName = cleanArtistName(
    artist?.name ||
    artist?.title ||
    artist?.artistName ||
    ""
  );

  const pageTitle =
    type === "track"
      ? artistName
        ? `Songs by ${artistName}`
        : "Songs"
      : artistName
        ? `Albums by ${artistName}`
        : "Albums";

  const pageDescription =
    artistName
      ? type === "track"
        ? `Browse songs featuring ${artistName}.`
        : `Browse albums by ${artistName}.`
      : "";

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
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
    useCallback(
      (item) => {
        const itemArtistName = cleanArtistName(
          typeof item?.artist === "string"
            ? item.artist
            : item?.artist?.name ||
              item?.artistName ||
              artistName
        );

        const albumTitle =
          typeof item?.album === "string"
            ? item.album
            : item?.album?.title ||
              item?.album?.name ||
              item?.albumName ||
              "";

        const image =
          item?.image ||
          item?.coverArt ||
          item?.album?.cover_xl ||
          item?.album?.cover_big ||
          item?.album?.cover_medium ||
          item?.album?.cover ||
          "";

        return {
          ...item,

          id: String(
            item?.id ||
            item?.listenableId ||
            item?.trackId ||
            ""
          ),

          listenableId: String(
            item?.listenableId ||
            item?.id ||
            item?.trackId ||
            ""
          ),

          type: "track",

          title:
            item?.title ||
            item?.name ||
            "Unknown Track",

          name:
            item?.name ||
            item?.title ||
            "Unknown Track",

          artist: {
            id: String(
              item?.artist?.id ||
              artistId
            ),

            name:
              itemArtistName,
          },

          artistName:
            itemArtistName,

          album: {
            ...(
              item?.album &&
              typeof item.album === "object"
                ? item.album
                : {}
            ),

            title:
              albumTitle,
          },

          albumName:
            albumTitle,

          image,

          coverArt:
            item?.coverArt ||
            image,

          preview:
            item?.preview ||
            item?.previewUrl ||
            "",
        };
      },
      [
        artistId,
        artistName,
      ]
    );

  const normalizeAlbum =
    useCallback(
      (item) => {
        const itemArtistName = cleanArtistName(
          typeof item?.artist === "string"
            ? item.artist
            : item?.artist?.name ||
              item?.artistName ||
              artistName
        );

        const image =
          item?.image ||
          item?.coverArt ||
          item?.cover_xl ||
          item?.cover_big ||
          item?.cover_medium ||
          item?.cover ||
          "";

        return {
          ...item,

          id: String(
            item?.id ||
            item?.listenableId ||
            item?.albumId ||
            ""
          ),

          listenableId: String(
            item?.listenableId ||
            item?.id ||
            item?.albumId ||
            ""
          ),

          type: "album",

          title:
            item?.title ||
            item?.name ||
            "Unknown Album",

          name:
            item?.name ||
            item?.title ||
            "Unknown Album",

          artist: {
            ...(
              item?.artist &&
              typeof item.artist === "object"
                ? item.artist
                : {}
            ),

            id: String(
              item?.artist?.id ||
              artistId
            ),

            name:
              itemArtistName,
          },

          artistName:
            itemArtistName,

          image,

          coverArt:
            item?.coverArt ||
            image,
        };
      },
      [
        artistId,
        artistName,
      ]
    );

  const loadListenables =
    useCallback(
      async (
        isRefresh = false
      ) => {
        if (!artistId) {
          setErrorMessage(
            "This artist does not have a valid ID."
          );

          setListenableData([]);
          setLoading(false);
          setRefreshing(false);

          return;
        }

        try {
          setErrorMessage("");

          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          const response =
            type === "track"
              ? await getArtistTracks(
                  artistId,
                  50
                )
              : await getArtistAlbums(
                  artistId,
                  50
                );

          const data =
            await parseResponse(
              response,
              type === "track"
                ? "Unable to load artist songs."
                : "Unable to load artist albums."
            );

          const rawItems =
            type === "track"
              ? Array.isArray(data?.tracks)
                ? data.tracks
                : Array.isArray(data)
                  ? data
                  : []
              : Array.isArray(data?.albums)
                ? data.albums
                : Array.isArray(data)
                  ? data
                  : [];

          const normalizedItems =
            rawItems
              .map(
                type === "track"
                  ? normalizeTrack
                  : normalizeAlbum
              )
              .filter(
                (item) =>
                  Boolean(item?.id)
              );

          const uniqueItems =
            Array.from(
              new Map(
                normalizedItems.map(
                  (item) => [
                    `${item.type}-${item.id}`,
                    item,
                  ]
                )
              ).values()
            );

          setListenableData(
            uniqueItems
          );

          console.log(
            `[ArtistListenables] Loaded ${uniqueItems.length} ${type}s for ${artistName}`
          );
        } catch (error) {
          console.error(
            "[ArtistListenables] Load error:",
            error
          );

          setErrorMessage(
            error?.message ||
            "Unable to load this artist's music."
          );

          setListenableData([]);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        artistId,
        artistName,
        normalizeAlbum,
        normalizeTrack,
        parseResponse,
        type,
      ]
    );

  useEffect(() => {
    setListenableData([]);
    setErrorMessage("");

    loadListenables(false);
  }, [loadListenables]);

  const handleRefresh =
    useCallback(() => {
      loadListenables(true);
    }, [loadListenables]);

  const handleGoBack =
    useCallback(() => {
      if (
        navigation.canGoBack()
      ) {
        navigation.goBack();
        return;
      }

      navigation.navigate(
        "Search"
      );
    }, [navigation]);

  const renderListenableItem =
    useCallback(
      ({ item }) => {
        if (
          item?.type === "track"
        ) {
          const trackArtistName =
            item?.artistName ||
            item?.artist?.name ||
            artistName;

          const albumTitle =
            item?.albumName ||
            item?.album?.title ||
            "";

          return (
            <View
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
                  item.title
                }
                artist={
                  cleanArtistName(
                    trackArtistName
                  ) || undefined
                }
                album={
                  albumTitle
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
          );
        }

        const albumArtistName =
          item?.artistName ||
          item?.artist?.name ||
          artistName;

        return (
          <View
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
                item.title
              }
              artist={
                cleanArtistName(
                  albumArtistName
                ) || undefined
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
        );
      },
      [
        artistName,
        navigation,
      ]
    );

  const keyExtractor =
    useCallback(
      (item, index) =>
        `${
          item?.type || type
        }-${
          item?.id || index
        }`,
      [type]
    );

  const renderHeader =
    useCallback(
      () => (
        <View>
          <View
            style={
              styles.headingRow
            }
          >
            <TouchableOpacity
              style={
                styles.backButton
              }
              onPress={
                handleGoBack
              }
              activeOpacity={0.8}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
            >
              <Image
                source={
                  BACK_ICON
                }
                style={
                  styles.backIcon
                }
              />
            </TouchableOpacity>

            <View
              style={
                styles.headingInformation
              }
            >
              <Text
                style={
                  styles.pageTitle
                }
                numberOfLines={2}
              >
                {pageTitle}
              </Text>

              {pageDescription ? (
                <Text
                  style={
                    styles.pageDescription
                  }
                >
                  {pageDescription}
                </Text>
              ) : null}

              {!loading &&
              !errorMessage ? (
                <Text
                  style={
                    styles.resultCount
                  }
                >
                  {
                    listenableData.length
                  }{" "}
                  {listenableData.length ===
                  1
                    ? type ===
                      "track"
                      ? "song"
                      : "album"
                    : type ===
                        "track"
                      ? "songs"
                      : "albums"}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={
              styles.listDivider
            }
          />
        </View>
      ),
      [
        errorMessage,
        handleGoBack,
        listenableData.length,
        loading,
        pageDescription,
        pageTitle,
        type,
      ]
    );

  const renderEmpty =
    useCallback(() => {
      if (loading) {
        return null;
      }

      if (errorMessage) {
        return (
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
              Unable to load music
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              {errorMessage}
            </Text>

            <TouchableOpacity
              style={
                styles.retryButton
              }
              onPress={() =>
                loadListenables(
                  false
                )
              }
              activeOpacity={0.8}
            >
              <Text
                style={
                  styles.retryButtonText
                }
              >
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
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
            {type === "track"
              ? "No songs found"
              : "No albums found"}
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            {type === "track"
              ? `No songs are currently available for ${artistName}.`
              : `No albums are currently available for ${artistName}.`}
          </Text>
        </View>
      );
    }, [
      artistName,
      errorMessage,
      loadListenables,
      loading,
      type,
    ]);

  return (
    <View
      style={[
        styles.container,

        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* SIDEBAR */}
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

      {/* PAGE */}
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
          {loading &&
          listenableData.length ===
            0 ? (
            <View
              style={
                styles.loadingContainer
              }
            >
              <ActivityIndicator
                size="large"
                color={
                  colours.lightblue ||
                  "#35afe5"
                }
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                {type === "track"
                  ? `Loading songs by ${artistName}...`
                  : `Loading albums by ${artistName}...`}
              </Text>
            </View>
          ) : (
            <FlatList
              style={[
                styles.list,

                isWeb &&
                  styles.webList,
              ]}
              data={
                listenableData
              }
              renderItem={
                renderListenableItem
              }
              keyExtractor={
                keyExtractor
              }
              ListHeaderComponent={
                renderHeader
              }
              ListEmptyComponent={
                renderEmpty
              }
              contentContainerStyle={[
                styles.listContent,

                listenableData.length ===
                  0 &&
                  styles.emptyListContent,
              ]}
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              removeClippedSubviews={
                Platform.OS !== "web"
              }
            />
          )}
        </View>
      </View>

      {/* BOTTOM NAVIGATION */}
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
        colours.bluegrey ||
        "#101010",
    },

    webContainer: {
      width: "100%",
      height: "100vh",

      minHeight: 0,

      overflow: "hidden",
    },

    /* SIDEBAR */

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

    /* PAGE */

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

      minHeight: 0,

      paddingTop: 18,
      paddingLeft: 28,
      paddingRight: 28,

      overflow: "hidden",
    },

    mobilePageContent: {
      position: "absolute",

      top: 0,
      left: 0,
      right: 0,

      bottom:
        BOTTOM_NAV_HEIGHT,

      minHeight: 0,

      paddingTop: 62,
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
    },

    /* HEADER */

    headingRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "flex-start",

      paddingTop: 12,
      paddingBottom: 18,
    },

    backButton: {
      width: 44,
      height: 44,

      flexShrink: 0,

      alignItems: "center",
      justifyContent: "center",

      marginRight: 14,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.14)",

      borderRadius: 22,

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    backIcon: {
      width: 19,
      height: 19,

      resizeMode: "contain",
    },

    headingInformation: {
      flex: 1,
      minWidth: 0,

      paddingTop: 1,
    },

    pageTitle: {
      color: "#ffffff",

      fontSize: 29,
      lineHeight: 36,
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
        colours.lightblue ||
        "#35afe5",

      fontSize: 13,
      fontWeight: "800",

      marginTop: 7,
    },

    listDivider: {
      width: "100%",
      height: 1,

      marginBottom: 16,

      backgroundColor:
        "rgba(255,255,255,0.12)",
    },

    /* LIST */

    list: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webList: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      WebkitOverflowScrolling:
        "touch",

      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },

    listContent: {
      width: "100%",

      paddingBottom: 40,
    },

    emptyListContent: {
      flexGrow: 1,
    },

    cardWrapper: {
      width: "100%",

      maxWidth: 860,

      alignSelf: "center",

      marginBottom: 10,
    },

    /* LOADING */

    loadingContainer: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingBottom:
        DESKTOP_HEADER_HEIGHT,
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.66)",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",

      marginTop: 12,
    },

    /* EMPTY / ERROR */

    emptyContainer: {
      flex: 1,

      minHeight: 300,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 24,
      paddingBottom: 70,
    },

    emptyTitle: {
      color: "#ffffff",

      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",

      textAlign: "center",
    },

    emptyDescription: {
      maxWidth: 440,

      color:
        "rgba(255,255,255,0.56)",

      fontSize: 14,
      lineHeight: 21,

      textAlign: "center",

      marginTop: 7,
    },

    retryButton: {
      minWidth: 130,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 20,

      marginTop: 18,

      borderRadius: 21,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    retryButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "800",
    },

    /* BOTTOM NAVIGATION */

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