import React, {
  useCallback,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";

import { auth } from "../utils/firebase";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";

import {
  getRecentlyViewed,
  clearRecentlyViewed,
} from "../providers/rest";

export default function RecentlyViewed({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadRecentlyViewed = useCallback(
    async (isRefresh = false) => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
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

        const response = await getRecentlyViewed(
          currentUser.uid,
          30
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
            "Unable to load recently viewed songs."
          );
        }

        setRecentItems(
          Array.isArray(data.recentlyViewed)
            ? data.recentlyViewed
            : []
        );
      } catch (error) {
        console.error(
          "[RecentlyViewed] Load error:",
          error
        );

        Alert.alert(
          "Unable to load history",
          error.message
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

  const handleClear = () => {
    if (recentItems.length === 0 || clearing) {
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
            const currentUser = auth.currentUser;

            if (!currentUser) {
              return;
            }

            try {
              setClearing(true);

              const response =
                await clearRecentlyViewed(
                  currentUser.uid
                );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(
                  data?.error ||
                  "Unable to clear history."
                );
              }

              setRecentItems([]);
            } catch (error) {
              Alert.alert(
                "Unable to clear history",
                error.message
              );
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const openItem = (item) => {
    navigation.navigate("SongPage", {
      track: {
        ...item,
        id:
          item.id ||
          item.itemId ||
          item.listenableId,

        type: item.type || "track",

        title:
          item.title ||
          item.name ||
          "Unknown Track",

        name:
          item.name ||
          item.title ||
          "Unknown Track",

        image:
          item.image ||
          item.coverArt ||
          "",

        coverArt:
          item.coverArt ||
          item.image ||
          "",
      },
    });
  };

  const getArtistName = (item) => {
    if (typeof item.artist === "string") {
      return item.artist;
    }

    return (
      item.artist?.name ||
      item.artistName ||
      "Unknown Artist"
    );
  };

  const renderItem = ({ item }) => {
    const imageUri =
      item.image ||
      item.coverArt ||
      item.album?.cover_xl ||
      item.album?.cover_big ||
      "";

    return (
      <TouchableOpacity
        style={styles.itemCard}
        activeOpacity={0.8}
        onPress={() => openItem(item)}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.itemImage}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>
              ♪
            </Text>
          </View>
        )}

        <View style={styles.itemInfo}>
          <Text
            style={styles.itemTitle}
            numberOfLines={1}
          >
            {item.title ||
              item.name ||
              "Unknown Track"}
          </Text>

          <Text
            style={styles.itemArtist}
            numberOfLines={1}
          >
            {getArtistName(item)}
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sideMenu}>
        <Sidebar
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.header}>
              Recently Viewed
            </Text>

            <Text style={styles.subText}>
              Songs you recently opened.
            </Text>
          </View>

          {recentItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
              disabled={clearing}
            >
              <Text style={styles.clearButtonText}>
                {clearing
                  ? "Clearing..."
                  : "Clear"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator
              size="large"
              color={colours.lightblue}
            />

            <Text style={styles.loadingText}>
              Loading recently viewed songs...
            </Text>
          </View>
        ) : (
          <FlatList
            data={recentItems}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              item.record_id ||
              `${item.type}-${item.id}-${index}`
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              recentItems.length === 0 &&
                styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  loadRecentlyViewed(true)
                }
                tintColor="#FFFFFF"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>
                  ♪
                </Text>

                <Text style={styles.emptyTitle}>
                  Nothing viewed yet
                </Text>

                <Text style={styles.emptyText}>
                  Open a song and it will appear here.
                </Text>
              </View>
            }
          />
        )}
      </View>

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

  content: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 90,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  header: {
    fontSize: 30,
    fontWeight: "bold",
    color: colours.lightblue,
  },

  subText: {
    fontSize: 15,
    color: "#FFFFFF",
    opacity: 0.75,
    marginTop: 5,
  },

  clearButton: {
    backgroundColor: colours.darkblue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#FFFFFF",
    marginTop: 12,
  },

  listContent: {
    paddingBottom: 30,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colours.darkblue,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
  },

  itemImage: {
    width: 68,
    height: 68,
    borderRadius: 8,
  },

  imagePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.1)",
  },

  placeholderText: {
    color: "#FFFFFF",
    fontSize: 32,
  },

  itemInfo: {
    flex: 1,
    marginLeft: 14,
  },

  itemTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },

  itemArtist: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 14,
    marginTop: 5,
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 34,
    marginLeft: 8,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  emptyIcon: {
    color: colours.lightblue,
    fontSize: 58,
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },

  emptyText: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },

  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },

  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});