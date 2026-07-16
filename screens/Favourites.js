import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Animated,
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
  getUserLikes,
} from "../providers/rest";

export default function Favourites({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchAnimation] = useState(
    new Animated.Value(0)
  );

  const [likedItems, setLikedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const toggleSearch = () => {
    const nextOpenState = !searchOpen;

    Animated.timing(searchAnimation, {
      toValue: nextOpenState ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setSearchOpen(nextOpenState);

    if (!nextOpenState) {
      setSearchText("");
    }
  };

  const searchWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "67%"],
  });

  const searchOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const loadLikedItems = useCallback(
  async (isRefresh = false) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
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

      console.log(
        "[LikedSongs] Loading likes for:",
        currentUser.uid
      );

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

      setLikedItems(
        Array.isArray(data.likes)
          ? data.likes
          : []
      );
    } catch (error) {
      console.error(
        "[LikedSongs] Load error:",
        error
      );

      setLikedItems([]);

      Alert.alert(
        "Unable to load liked music",
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
      loadLikedItems(false);
    }, [loadLikedItems])
  );

  const filteredLikedItems = useMemo(() => {
  const query = searchText
    .trim()
    .toLowerCase();

  if (!query) {
    return likedItems;
  }

  return likedItems.filter((item) => {
    const title = String(
      item.title ||
      item.name ||
      ""
    ).toLowerCase();

    const artist = String(
      typeof item.artist === "string"
        ? item.artist
        : item.artist?.name ||
          item.artistName ||
          ""
    ).toLowerCase();

    const type = String(
      item.type || ""
    ).toLowerCase();

    return (
      title.includes(query) ||
      artist.includes(query) ||
      type.includes(query)
    );
  });
}, [likedItems, searchText]);

  const getSongFromFavourite = (item) => {
    const song =
      item.song ||
      item.item_info ||
      {};

    const itemId =
      song.id ||
      song.listenableId ||
      song.listenable_id ||
      item.listenableId ||
      item.listenable_id ||
      item.itemId ||
      item.id ||
      "";

    const title =
      song.title ||
      song.name ||
      item.title ||
      item.name ||
      "Unknown Track";

    const artist =
      song.artist ||
      item.artist ||
      (
        song.artistName ||
        item.artistName
          ? {
              name:
                song.artistName ||
                item.artistName,
            }
          : null
      );

    const album =
      song.album ||
      item.album ||
      null;

    const image =
      song.image ||
      song.coverArt ||
      item.image ||
      item.coverArt ||
      album?.cover_xl ||
      album?.cover_big ||
      "";

    return {
      ...song,

      id: String(itemId),
      listenableId: String(itemId),
      type: song.type || item.type || "track",

      title,
      name: song.name || title,

      artist,
      artistName:
        song.artistName ||
        item.artistName ||
        artist?.name ||
        (
          typeof artist === "string"
            ? artist
            : ""
        ),

      album,

      image,
      coverArt:
        song.coverArt ||
        item.coverArt ||
        image,

      preview:
        song.preview ||
        song.previewUrl ||
        item.preview ||
        item.previewUrl ||
        "",
    };
  };

  const openLikedItem = (item) => {
  if (!item?.id) {
    Alert.alert(
      "Unable to open item",
      "This liked item does not have an ID."
    );

    return;
  }

  if (item.type === "artist") {
    navigation.navigate("ArtistPage", {
      artist: item,
    });

    return;
  }

  if (item.type === "album") {
    navigation.navigate("AlbumPage", {
      album: item,
    });

    return;
  }

  navigation.navigate("SongPage", {
    track: item,
  });
};

  const getArtistName = (item) => {
    const song = getSongFromFavourite(item);

    if (typeof song.artist === "string") {
      return song.artist;
    }

    return (
      song.artist?.name ||
      song.artistName ||
      "Unknown Artist"
    );
  };

  const getImage = (item) => {
    const song = getSongFromFavourite(item);

    return (
      song.image ||
      song.coverArt ||
      song.album?.cover_xl ||
      song.album?.cover_big ||
      ""
    );
  };

  const renderLikedItem = ({ item }) => {
  const imageUri =
    item.image ||
    item.coverArt ||
    item.album?.cover_xl ||
    item.album?.cover_big ||
    "";

  const title =
    item.title ||
    item.name ||
    "Unknown Item";

  const artistName =
    typeof item.artist === "string"
      ? item.artist
      : item.artist?.name ||
        item.artistName ||
        "";

  const typeLabel =
    item.type === "artist"
      ? "Artist"
      : item.type === "album"
        ? "Album"
        : "Song";

  return (
    <TouchableOpacity
      style={styles.favouriteCard}
      activeOpacity={0.8}
      onPress={() =>
        openLikedItem(item)
      }
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.albumImage}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderIcon}>
            ♪
          </Text>
        </View>
      )}

      <View style={styles.favouriteDetails}>
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

        {!!artistName && (
          <Text
            style={styles.artistName}
            numberOfLines={1}
          >
            {artistName}
          </Text>
        )}

        <Text style={styles.typeLabel}>
          {typeLabel}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
};

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.searchBar,
          {
            transform: [
              {
                translateX:
                  searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
              },
            ],
            width: searchWidth,
            opacity: searchOpacity,
          },
        ]}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search liked music..."
          placeholderTextColor="#aaa"
          value={searchText}
          onChangeText={setSearchText}
        />
      </Animated.View>

      <TouchableOpacity
        style={styles.searchIcon}
        onPress={toggleSearch}
      >
        <Image
          source={require("../images/blackSearchIcon.png")}
          style={styles.icon}
        />
      </TouchableOpacity>

      <View style={styles.sideMenu}>
        <Sidebar
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.header}>
          Liked Songs
        </Text>

        <Text style={styles.subText}>
          Songs, albums, and artists you have liked.
        </Text>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator
              size="large"
              color={colours.lightblue}
            />

            <Text style={styles.loadingText}>
              Loading liked songs...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLikedItems}
            renderItem={renderLikedItem}
            keyExtractor={(item, index) =>
              item.likeId ||
              `${item.type}-${item.id}-${index}`
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              filteredLikedItems.length === 0 &&
                styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  loadLikedItems(true)
                }
                tintColor="#FFFFFF"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Image
                  source={require("../images/whiteOpenHeart.png")}
                  style={styles.emptyHeart}
                />

                <Text style={styles.emptyTitle}>
                  No liked songs yet
                </Text>

                <Text style={styles.emptyText}>
                  Like songs to see them here.
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

  typeLabel: {
    color: colours.lightblue,
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 6,
    textTransform: "uppercase",
  },

  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
  },

  searchIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    top: 70,
    right: 20,
    zIndex: 20,
  },

  icon: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },

  searchBar: {
    position: "absolute",
    height: 40,
    top: 70,
    left: 20,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colours.lightblue,
    backgroundColor: colours.darkblue,
    zIndex: 19,
  },

  searchInput: {
    fontSize: 16,
    color: "#FFFFFF",
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

  content: {
    flex: 1,
    paddingTop: 130,
    paddingHorizontal: 20,
    paddingBottom: 90,
  },

  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: colours.lightblue,
  },

  subText: {
    fontSize: 15,
    color: "#FFFFFF",
    opacity: 0.75,
    marginTop: 5,
    marginBottom: 20,
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

  favouriteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colours.darkblue,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  albumImage: {
    width: 78,
    height: 78,
    borderRadius: 9,
  },

  imagePlaceholder: {
    width: 78,
    height: 78,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(255,255,255,0.1)",
  },

  placeholderIcon: {
    color: "#FFFFFF",
    fontSize: 34,
  },

  favouriteDetails: {
    flex: 1,
    marginLeft: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  songTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },

  heartIcon: {
    width: 18,
    height: 18,
    marginLeft: 8,
  },

  artistName: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 14,
    marginTop: 4,
  },

  ratingRow: {
    flexDirection: "row",
    marginTop: 7,
  },

  starIcon: {
    width: 15,
    height: 15,
    marginRight: 2,
  },

  emojiRow: {
    flexDirection: "row",
    marginTop: 5,
  },

  emoji: {
    fontSize: 16,
    marginRight: 5,
  },

  reviewText: {
    color: "#FFFFFF",
    opacity: 0.8,
    fontSize: 13,
    marginTop: 6,
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

  emptyHeart: {
    width: 58,
    height: 58,
    opacity: 0.8,
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 14,
  },

  emptyText: {
    color: "#FFFFFF",
    opacity: 0.7,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
});