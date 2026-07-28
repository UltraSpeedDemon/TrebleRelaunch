import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import { auth } from "../utils/firebase";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

import {
  getUserLikes,
} from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;

export default function Favourites({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const isDesktopWeb =
    isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb =
    isWeb && width < DESKTOP_BREAKPOINT;
  const isCompact = width < 600;

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [likedItems, setLikedItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const searchAnimation = useRef(
    new Animated.Value(
      isDesktopWeb ? 1 : 0
    )
  ).current;

  /*
   * Keep the sidebar permanently open on desktop.
   * Mobile continues to use the hamburger menu.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
      setSearchOpen(true);
      searchAnimation.setValue(1);
    } else {
      setMenuOpen(false);
      setSearchOpen(false);
      searchAnimation.setValue(0);
    }
  }, [
    isDesktopWeb,
    searchAnimation,
  ]);

  const toggleSearch = useCallback(() => {
    if (isDesktopWeb) {
      return;
    }

    const nextOpenState = !searchOpen;

    Animated.timing(searchAnimation, {
      toValue: nextOpenState ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();

    setSearchOpen(nextOpenState);

    if (!nextOpenState) {
      setSearchText("");
    }
  }, [
    isDesktopWeb,
    searchAnimation,
    searchOpen,
  ]);

  const loadLikedItems = useCallback(
    async (isRefresh = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        setLikedItems([]);
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

        const response = await getUserLikes(
          currentUser.uid
        );

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
              `Unable to load liked items. HTTP ${response.status}`
          );
        }

        const rawLikes = Array.isArray(
          data?.likes
        )
          ? data.likes
          : Array.isArray(data)
            ? data
            : [];

        setLikedItems(rawLikes);
      } catch (error) {
        console.error(
          "[Favourites] Load error:",
          error
        );

        setLikedItems([]);

        Alert.alert(
          "Unable to load liked music",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadLikedItems(false);
    }, [loadLikedItems])
  );

  /*
   * Normalize the different possible shapes returned
   * by the backend into one consistent music object.
   */
  const normalizeLikedItem = useCallback(
    (item) => {
      const itemInfo =
        item?.song ||
        item?.item_info ||
        item ||
        {};

      const itemId =
        itemInfo?.id ||
        itemInfo?.listenableId ||
        itemInfo?.listenable_id ||
        item?.listenableId ||
        item?.listenable_id ||
        item?.itemId ||
        item?.id ||
        "";

      const title =
        itemInfo?.title ||
        itemInfo?.name ||
        item?.title ||
        item?.name ||
        "Unknown Item";

      const rawArtist =
        itemInfo?.artist ||
        item?.artist ||
        null;

      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            itemInfo?.artistName ||
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
        itemInfo?.album ||
        item?.album ||
        null;

      const image =
        itemInfo?.image ||
        itemInfo?.coverArt ||
        item?.image ||
        item?.coverArt ||
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        "";

      const type =
        itemInfo?.type ||
        item?.type ||
        "track";

      return {
        ...item,
        ...itemInfo,

        likeId:
          item?.likeId ||
          item?.record_id ||
          item?.rid ||
          null,

        id: String(itemId),

        listenableId: String(itemId),

        type,

        title,

        name:
          itemInfo?.name ||
          title,

        artist,

        artistName,

        album,

        image,

        coverArt:
          itemInfo?.coverArt ||
          item?.coverArt ||
          image,

        preview:
          itemInfo?.preview ||
          itemInfo?.previewUrl ||
          item?.preview ||
          item?.previewUrl ||
          "",
      };
    },
    []
  );

  const normalizedLikedItems = useMemo(
    () =>
      likedItems.map(
        normalizeLikedItem
      ),
    [
      likedItems,
      normalizeLikedItem,
    ]
  );

  const filteredLikedItems = useMemo(() => {
    const query = searchText
      .trim()
      .toLowerCase();

    if (!query) {
      return normalizedLikedItems;
    }

    return normalizedLikedItems.filter(
      (item) => {
        const title = String(
          item?.title ||
          item?.name ||
          ""
        ).toLowerCase();

        const artist = String(
          typeof item?.artist === "string"
            ? item.artist
            : item?.artist?.name ||
              item?.artistName ||
              ""
        ).toLowerCase();

        const album = String(
          typeof item?.album === "string"
            ? item.album
            : item?.album?.title ||
              ""
        ).toLowerCase();

        const type = String(
          item?.type || ""
        ).toLowerCase();

        return (
          title.includes(query) ||
          artist.includes(query) ||
          album.includes(query) ||
          type.includes(query)
        );
      }
    );
  }, [
    normalizedLikedItems,
    searchText,
  ]);

  const openLikedItem = useCallback(
    (item) => {
      if (!item?.id) {
        Alert.alert(
          "Unable to open item",
          "This liked item does not have an ID."
        );

        return;
      }

      if (item.type === "artist") {
        navigation.navigate(
          "ArtistPage",
          {
            artist: item,
          }
        );

        return;
      }

      if (item.type === "album") {
        navigation.navigate(
          "AlbumPage",
          {
            album: item,
          }
        );

        return;
      }

      navigation.navigate(
        "SongPage",
        {
          track: {
            ...item,
            type:
              item?.type ||
              "track",
          },
        }
      );
    },
    [navigation]
  );

  const renderLikedItem = useCallback(
    ({ item }) => {
      const imageUri =
        item?.image ||
        item?.coverArt ||
        item?.album?.cover_xl ||
        item?.album?.cover_big ||
        item?.album?.cover_medium ||
        "";

      const title =
        item?.title ||
        item?.name ||
        "Unknown Item";

      const artistName =
        typeof item?.artist === "string"
          ? item.artist
          : item?.artist?.name ||
            item?.artistName ||
            "";

      const albumName =
        typeof item?.album === "string"
          ? item.album
          : item?.album?.title ||
            "";

      const typeLabel =
        item?.type === "artist"
          ? "Artist"
          : item?.type === "album"
            ? "Album"
            : "Song";

      return (
        <TouchableOpacity
          style={[
            styles.favouriteCard,
            isDesktopWeb &&
              styles.desktopFavouriteCard,
            isCompact &&
              styles.compactFavouriteCard,
          ]}
          activeOpacity={0.8}
          onPress={() =>
            openLikedItem(item)
          }
        >
          {imageUri ? (
            <Image
              source={{
                uri: imageUri,
              }}
              style={[
                styles.albumImage,
                isCompact &&
                  styles.compactAlbumImage,
              ]}
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                isCompact &&
                  styles.compactAlbumImage,
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

          <View
            style={
              styles.favouriteDetails
            }
          >
            <View style={styles.titleRow}>
              <Text
                style={styles.songTitle}
                numberOfLines={1}
              >
                {title}
              </Text>

              <Image
                source={require("../images/whiteFullHeart.png")}
                style={styles.heartIcon}
              />
            </View>

            {artistName ? (
              <Text
                style={styles.artistName}
                numberOfLines={1}
              >
                {artistName}
              </Text>
            ) : null}

            {albumName &&
            item?.type !== "album" ? (
              <Text
                style={styles.albumName}
                numberOfLines={1}
              >
                {albumName}
              </Text>
            ) : null}

            <Text
              style={styles.typeLabel}
            >
              {typeLabel}
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </TouchableOpacity>
      );
    },
    [
      isCompact,
      isDesktopWeb,
      openLikedItem,
    ]
  );

  const searchWidth =
    searchAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [
        "0%",
        isDesktopWeb ? "100%" : "76%",
      ],
    });

  const searchOpacity =
    searchAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

  const renderEmptyList = useCallback(
    () => {
      const hasSearch =
        searchText.trim().length > 0;

      return (
        <View
          style={styles.emptyContainer}
        >
          <Image
            source={require("../images/whiteOpenHeart.png")}
            style={styles.emptyHeart}
          />

          <Text
            style={styles.emptyTitle}
          >
            {hasSearch
              ? "No matching liked music"
              : "No liked music yet"}
          </Text>

          <Text style={styles.emptyText}>
            {hasSearch
              ? "Try searching for a different song, artist, or album."
              : "Like songs, albums, and artists to see them here."}
          </Text>
        </View>
      );
    },
    [searchText]
  );

  return (
    <View
      style={[
        styles.container,
        isWeb && styles.webContainer,
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
        {/* TOP HEADER */}
        <View
          style={[
            styles.topHeader,
            isCompact &&
              styles.compactTopHeader,
          ]}
        >
          <View style={styles.headingGroup}>
            <Text style={styles.header}>
              Liked
            </Text>

            <Text style={styles.subText}>
              Songs, albums, and artists you have liked.
            </Text>
          </View>

          {!isDesktopWeb ? (
            <TouchableOpacity
              style={
                styles.searchIconButton
              }
              onPress={toggleSearch}
            >
              <Image
                source={require("../images/blackSearchIcon.png")}
                style={styles.searchIconImage}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* SEARCH */}
        <Animated.View
          style={[
            styles.searchBar,
            isDesktopWeb &&
              styles.desktopSearchBar,
            !isDesktopWeb && {
              width: searchWidth,
              opacity: searchOpacity,
              maxHeight:
                searchAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 48],
                }),
              marginBottom:
                searchAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 16],
                }),
            },
          ]}
          pointerEvents={
            isDesktopWeb || searchOpen
              ? "auto"
              : "none"
          }
        >
          <Image
            source={require("../images/blackSearchIcon.png")}
            style={styles.inputSearchIcon}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search liked music..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            selectionColor="#ffffff"
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          {searchText ? (
            <TouchableOpacity
              onPress={() =>
                setSearchText("")
              }
              style={
                styles.clearSearchButton
              }
            >
              <Text
                style={
                  styles.clearSearchText
                }
              >
                ×
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>

        {/* LIST */}
        {loading ? (
          <View
            style={
              styles.centerContent
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
              Loading liked music...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLikedItems}
            renderItem={renderLikedItem}
            keyExtractor={(
              item,
              index
            ) =>
              String(
                item?.likeId ||
                `${item?.type}-${item?.id}-${index}`
              )
            }
            style={[
              styles.list,
              isWeb && styles.webList,
            ]}
            contentContainerStyle={[
              styles.listContent,
              isDesktopWeb &&
                styles.desktopListContent,
              filteredLikedItems.length ===
                0 &&
                styles.emptyListContent,
            ]}
            showsVerticalScrollIndicator={
              false
            }
            scrollEnabled
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  loadLikedItems(true)
                }
                tintColor="#ffffff"
                colors={["#ffffff"]}
                progressBackgroundColor={
                  colours.darkblue
                }
              />
            }
            ListEmptyComponent={
              renderEmptyList
            }
          />
        )}
      </View>

      {/* MOBILE NAVIGATION ONLY */}
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

const styles = StyleSheet.create({
  /* =====================================================
     PAGE
  ===================================================== */

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
     CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    paddingTop: 72,
    paddingHorizontal: 15,
    paddingBottom: 78,

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

    paddingTop: 28,
    paddingLeft: 36,
    paddingRight: 36,
    paddingBottom: 0,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 72,

    minHeight: 0,

    paddingTop: 72,
    paddingHorizontal: 14,
    paddingBottom: 0,

    overflow: "hidden",
  },

  /* =====================================================
     HEADER
  ===================================================== */

  topHeader: {
    width: "100%",
    maxWidth: 920,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",

    marginBottom: 18,
  },

  compactTopHeader: {
    alignItems: "center",
  },

  headingGroup: {
    flex: 1,
    minWidth: 0,

    paddingRight: 12,
  },

  header: {
    color:
      colours.lightblue,

    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
  },

  subText: {
    color:
      "rgba(255,255,255,0.7)",

    fontSize: 15,
    lineHeight: 21,

    marginTop: 3,
  },

  searchIconButton: {
    width: 45,
    height: 45,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 23,

    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  searchIconImage: {
    width: 27,
    height: 27,

    resizeMode: "contain",
  },

  /* =====================================================
     SEARCH
  ===================================================== */

  searchBar: {
    width: "100%",
    maxWidth: 920,
    height: 46,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 13,

    borderWidth: 1,
    borderColor:
      colours.lightblue,
    borderRadius: 10,

    backgroundColor:
      colours.darkblue,

    overflow: "hidden",
  },

  desktopSearchBar: {
    width: "100%",
    opacity: 1,

    marginBottom: 18,
  },

  inputSearchIcon: {
    width: 21,
    height: 21,

    marginRight: 10,

    resizeMode: "contain",

    opacity: 0.72,
  },

  searchInput: {
    flex: 1,
    height: "100%",

    color: "#ffffff",

    fontSize: 15,

    paddingVertical: 0,
    paddingHorizontal: 0,

    outlineStyle: "none",
  },

  clearSearchButton: {
    width: 31,
    height: 31,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 7,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  clearSearchText: {
    color: "#ffffff",

    fontSize: 22,
    lineHeight: 24,
  },

  /* =====================================================
     LIST AND SCROLLING
  ===================================================== */

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

    overscrollBehaviorY:
      "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  listContent: {
    width: "100%",

    paddingBottom: 110,
  },

  desktopListContent: {
    paddingBottom: 65,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  centerContent: {
    flex: 1,
    minHeight: 250,

    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.7)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     FAVOURITE CARDS
  ===================================================== */

  favouriteCard: {
    width: "100%",
    maxWidth: 920,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "center",

    padding: 13,
    marginBottom: 13,

    borderRadius: 14,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 9,

    elevation: 4,
  },

  desktopFavouriteCard: {
    minHeight: 112,

    padding: 15,
  },

  compactFavouriteCard: {
    padding: 10,
    borderRadius: 12,
  },

  albumImage: {
    width: 86,
    height: 86,

    borderRadius: 11,

    resizeMode: "cover",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  compactAlbumImage: {
    width: 68,
    height: 68,

    borderRadius: 9,
  },

  imagePlaceholder: {
    width: 86,
    height: 86,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 11,

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  placeholderIcon: {
    color: "#ffffff",

    fontSize: 34,

    opacity: 0.75,
  },

  favouriteDetails: {
    flex: 1,
    minWidth: 0,

    marginLeft: 15,
  },

  titleRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
  },

  songTitle: {
    flex: 1,
    minWidth: 0,

    color: "#ffffff",

    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },

  heartIcon: {
    width: 19,
    height: 19,

    marginLeft: 9,

    resizeMode: "contain",
  },

  artistName: {
    color:
      "rgba(255,255,255,0.72)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 4,
  },

  albumName: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 13,
    lineHeight: 18,

    marginTop: 1,
  },

  typeLabel: {
    color:
      colours.lightblue,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",

    marginTop: 6,

    textTransform: "uppercase",
  },

  arrow: {
    color:
      "rgba(255,255,255,0.7)",

    fontSize: 34,
    lineHeight: 38,

    marginLeft: 10,
  },

  /* =====================================================
     EMPTY STATE
  ===================================================== */

  emptyContainer: {
    flex: 1,
    minHeight: 320,

    width: "100%",
    maxWidth: 520,

    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 30,
  },

  emptyHeart: {
    width: 58,
    height: 58,

    resizeMode: "contain",

    opacity: 0.72,
  },

  emptyTitle: {
    color: "#ffffff",

    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",

    textAlign: "center",

    marginTop: 14,
  },

  emptyText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 15,
    lineHeight: 21,

    textAlign: "center",

    marginTop: 8,
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