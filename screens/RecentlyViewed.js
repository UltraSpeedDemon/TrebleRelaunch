import React, {
  useCallback,
  useEffect,
  useMemo,
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

import { auth } from "../utils/firebase";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

import {
  clearRecentlyViewed,
  getRecentlyViewed,
} from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_CONTENT_WIDTH = 920;

export default function RecentlyViewed({
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

  const [recentItems, setRecentItems] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [clearing, setClearing] =
    useState(false);

  /*
   * Desktop sidebar is always open.
   * Mobile sidebar begins closed.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  const loadRecentlyViewed = useCallback(
    async (isRefresh = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        setRecentItems([]);
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

        const response =
          await getRecentlyViewed(
            currentUser.uid,
            30
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
              `Unable to load recently viewed music. HTTP ${response.status}`
          );
        }

        const items = Array.isArray(
          data?.recentlyViewed
        )
          ? data.recentlyViewed
          : Array.isArray(data)
            ? data
            : [];

        setRecentItems(items);
      } catch (error) {
        console.error(
          "[RecentlyViewed] Load error:",
          error
        );

        setRecentItems([]);

        Alert.alert(
          "Unable to load history",
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
      loadRecentlyViewed(false);
    }, [loadRecentlyViewed])
  );

  /*
   * Convert all possible backend shapes into one
   * consistent music item.
   */
  const normalizeRecentItem = useCallback(
    (item) => {
      const itemInfo =
        item?.song ||
        item?.item_info ||
        item ||
        {};

      const id =
        itemInfo?.id ||
        itemInfo?.itemId ||
        itemInfo?.listenableId ||
        itemInfo?.listenable_id ||
        item?.itemId ||
        item?.listenableId ||
        item?.listenable_id ||
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

      const albumName =
        typeof album === "string"
          ? album
          : album?.title || "";

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

        record_id:
          item?.record_id ||
          item?.rid ||
          null,

        id: String(id),

        itemId: String(id),

        listenableId: String(id),

        type,

        title,

        name:
          itemInfo?.name ||
          title,

        artist,

        artistName,

        album,

        albumName,

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

        viewedAt:
          item?.viewedAt ||
          item?.viewed_at ||
          item?.createdAt ||
          item?.created_at ||
          null,
      };
    },
    []
  );

  const normalizedRecentItems = useMemo(
    () =>
      recentItems.map(
        normalizeRecentItem
      ),
    [
      normalizeRecentItem,
      recentItems,
    ]
  );

  const handleClear = useCallback(() => {
    if (
      normalizedRecentItems.length === 0 ||
      clearing
    ) {
      return;
    }

    Alert.alert(
      "Clear Recently Viewed?",
      "This will remove your recently viewed history.",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          style: "destructive",

          onPress: async () => {
            const currentUser =
              auth.currentUser;

            if (!currentUser?.uid) {
              return;
            }

            try {
              setClearing(true);

              const response =
                await clearRecentlyViewed(
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
                data = {
                  error:
                    responseText ||
                    "The backend returned invalid JSON.",
                };
              }

              if (!response.ok) {
                throw new Error(
                  data?.error ||
                    `Unable to clear history. HTTP ${response.status}`
                );
              }

              setRecentItems([]);
            } catch (error) {
              console.error(
                "[RecentlyViewed] Clear error:",
                error
              );

              Alert.alert(
                "Unable to clear history",
                error?.message ||
                  "Please try again."
              );
            } finally {
              setClearing(false);
            }
          },
        },
      ],
      {
        cancelable: true,
      }
    );
  }, [
    clearing,
    normalizedRecentItems.length,
  ]);

  const openItem = useCallback(
    (item) => {
      if (!item?.id) {
        Alert.alert(
          "Unable to open item",
          "This recently viewed item does not have an ID."
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

  const formatViewedTime = useCallback(
    (timestamp) => {
      if (!timestamp) {
        return "";
      }

      const date = new Date(timestamp);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      const difference =
        Date.now() - date.getTime();

      const minutes = Math.floor(
        difference / 60000
      );

      if (minutes < 1) {
        return "Viewed just now";
      }

      if (minutes < 60) {
        return `Viewed ${minutes}m ago`;
      }

      const hours = Math.floor(
        minutes / 60
      );

      if (hours < 24) {
        return `Viewed ${hours}h ago`;
      }

      const days = Math.floor(
        hours / 24
      );

      if (days < 7) {
        return `Viewed ${days}d ago`;
      }

      return `Viewed ${date.toLocaleDateString()}`;
    },
    []
  );

  const renderItem = useCallback(
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
            item?.albumName ||
            "";

      const typeLabel =
        item?.type === "artist"
          ? "Artist"
          : item?.type === "album"
            ? "Album"
            : "Song";

      const viewedTime =
        formatViewedTime(
          item?.viewedAt
        );

      return (
        <TouchableOpacity
          style={[
            styles.itemCard,
            isDesktopWeb &&
              styles.desktopItemCard,
            isCompact &&
              styles.compactItemCard,
          ]}
          activeOpacity={0.8}
          onPress={() =>
            openItem(item)
          }
        >
          {imageUri ? (
            <Image
              source={{
                uri: imageUri,
              }}
              style={[
                styles.itemImage,
                isCompact &&
                  styles.compactItemImage,
              ]}
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                isCompact &&
                  styles.compactItemImage,
              ]}
            >
              <Text
                style={
                  styles.placeholderText
                }
              >
                ♪
              </Text>
            </View>
          )}

          <View style={styles.itemInfo}>
            <Text
              style={styles.itemTitle}
              numberOfLines={1}
            >
              {title}
            </Text>

            {artistName ? (
              <Text
                style={styles.itemArtist}
                numberOfLines={1}
              >
                {artistName}
              </Text>
            ) : null}

            {albumName &&
            item?.type !== "album" ? (
              <Text
                style={styles.itemAlbum}
                numberOfLines={1}
              >
                {albumName}
              </Text>
            ) : null}

            <View
              style={styles.metadataRow}
            >
              <Text
                style={styles.typeLabel}
              >
                {typeLabel}
              </Text>

              {viewedTime ? (
                <Text
                  style={styles.viewedTime}
                  numberOfLines={1}
                >
                  {viewedTime}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </TouchableOpacity>
      );
    },
    [
      formatViewedTime,
      isCompact,
      isDesktopWeb,
      openItem,
    ]
  );

  const renderEmptyList = useCallback(
    () => (
      <View
        style={styles.emptyContainer}
      >
        <View
          style={
            styles.emptyIconContainer
          }
        >
          <Text
            style={styles.emptyIcon}
          >
            ♪
          </Text>
        </View>

        <Text style={styles.emptyTitle}>
          Nothing viewed yet
        </Text>

        <Text style={styles.emptyText}>
          Open a song, album, or artist and it will appear here.
        </Text>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() =>
            navigation.navigate(
              "Explore"
            )
          }
        >
          <Text
            style={
              styles.exploreButtonText
            }
          >
            Explore Music
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation]
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
        <View style={styles.headerRow}>
          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text style={styles.header}>
              Recently Viewed
            </Text>

            <Text style={styles.subText}>
              Music you recently opened.
            </Text>
          </View>

          {normalizedRecentItems.length >
          0 ? (
            <TouchableOpacity
              style={[
                styles.clearButton,
                clearing &&
                  styles.disabledClearButton,
              ]}
              onPress={handleClear}
              disabled={clearing}
            >
              {clearing ? (
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />
              ) : null}

              <Text
                style={
                  styles.clearButtonText
                }
              >
                {clearing
                  ? "Clearing..."
                  : "Clear History"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
              Loading recently viewed music...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              normalizedRecentItems
            }
            renderItem={renderItem}
            keyExtractor={(
              item,
              index
            ) =>
              String(
                item?.record_id ||
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
              normalizedRecentItems.length ===
                0 &&
                styles.emptyListContent,
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
                refreshing={refreshing}
                onRefresh={() =>
                  loadRecentlyViewed(true)
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
    paddingHorizontal: 14,
    paddingBottom: 76,

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

  headerRow: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",

    marginBottom: 20,
  },

  headerTextContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 14,
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

  clearButton: {
    minHeight: 42,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 8,

    paddingHorizontal: 15,
    paddingVertical: 9,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",

    borderRadius: 10,

    backgroundColor:
      colours.darkblue,
  },

  disabledClearButton: {
    opacity: 0.55,
  },

  clearButtonText: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "800",
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

    /*
     * Hide the white browser scrollbar
     * while preserving mouse-wheel scrolling.
     */
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
     RECENT ITEM CARDS
  ===================================================== */

  itemCard: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "center",

    padding: 13,
    marginBottom: 13,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 14,

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

  desktopItemCard: {
    minHeight: 112,

    padding: 15,
  },

  compactItemCard: {
    padding: 10,

    borderRadius: 12,
  },

  itemImage: {
    width: 86,
    height: 86,

    borderRadius: 11,

    resizeMode: "cover",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  compactItemImage: {
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

  placeholderText: {
    color: "#ffffff",

    fontSize: 34,

    opacity: 0.75,
  },

  itemInfo: {
    flex: 1,
    minWidth: 0,

    marginLeft: 15,
  },

  itemTitle: {
    color: "#ffffff",

    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },

  itemArtist: {
    color:
      "rgba(255,255,255,0.72)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 4,
  },

  itemAlbum: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 13,
    lineHeight: 18,

    marginTop: 1,
  },

  metadataRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    marginTop: 7,
  },

  typeLabel: {
    color:
      colours.lightblue,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",

    textTransform: "uppercase",
  },

  viewedTime: {
    flex: 1,

    color:
      "rgba(255,255,255,0.42)",

    fontSize: 11,
    lineHeight: 16,

    marginLeft: 12,
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

  emptyIconContainer: {
    width: 72,
    height: 72,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 36,

    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  emptyIcon: {
    color:
      colours.lightblue,

    fontSize: 45,
    lineHeight: 50,
  },

  emptyTitle: {
    color: "#ffffff",

    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",

    textAlign: "center",

    marginTop: 15,
  },

  emptyText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 15,
    lineHeight: 21,

    textAlign: "center",

    marginTop: 8,
  },

  exploreButton: {
    marginTop: 19,

    paddingHorizontal: 20,
    paddingVertical: 11,

    borderRadius: 22,

    backgroundColor:
      colours.lightblue,
  },

  exploreButtonText: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "800",
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