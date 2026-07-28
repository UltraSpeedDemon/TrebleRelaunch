import React, { useEffect, useState } from "react";
import {
    View,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Image
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import SectionDivider from "../components/SectionDivider";
import MusicCard from "../components/MusicCard";
import {
  getArtistTracks,
  getArtistAlbums,
} from "../providers/rest";
import colours from "../styles/colours";

export default function ArtistListenables({ navigation, route }) {
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [listenableData, setListenableData] = useState([]);
    const [onEndReachedCalledDuringMomentum, setOnEndReachedCalledDuringMomentum] = useState(true);
    const { type, artist } = route.params;

    function renderListenableItem({ item }) {
        if (item.type === "track") {
            const artistName =
                artist?.name ||
                artist?.title ||
                item.artistName ||
                item.artist?.name ||
                "Unknown Artist";

            const albumTitle =
                typeof item.album === "string"
                ? item.album
                : item.album?.title || "";

            const track = {
                ...item,

                id: String(item.id),
                listenableId: String(
                item.listenableId ||
                item.id
                ),

                type: "track",

                title:
                item.title ||
                item.name ||
                "Unknown Track",

                name:
                item.name ||
                item.title ||
                "Unknown Track",

                artist: {
                id: String(
                    artist?.id ||
                    item.artist?.id ||
                    ""
                ),
                name: artistName,
                },

                artistName,

                album: {
                ...(typeof item.album === "object"
                    ? item.album
                    : {}),
                title: albumTitle,
                },

                image:
                item.image ||
                item.coverArt ||
                item.album?.cover_xl ||
                item.album?.cover_big ||
                "",

                coverArt:
                item.coverArt ||
                item.image ||
                item.album?.cover_xl ||
                item.album?.cover_big ||
                "",

                preview:
                item.preview ||
                item.previewUrl ||
                "",
            };

            return (
                <MusicCard
                id={track.id}
                image={track.image}
                name={track.title}
                artist={artistName}
                album={albumTitle}
                onPressCard={() =>
                    navigation.navigate(
                    "SongPage",
                    { track }
                    )
                }
                />
            );
            }
        else {
            const artistName =
                artist?.name ||
                artist?.title ||
                item.artistName ||
                item.artist?.name ||
                "Unknown Artist";

                const album = {
                ...item,

                id: String(item.id),
                listenableId: String(
                    item.listenableId ||
                    item.id
                ),

                type: "album",

                title:
                    item.title ||
                    item.name ||
                    "Unknown Album",

                name:
                    item.name ||
                    item.title ||
                    "Unknown Album",

                artist:
                    item.artist &&
                    typeof item.artist === "object"
                    ? item.artist
                    : {
                        id: String(
                            artist?.id || ""
                        ),
                        name: artistName,
                        },

                artistName,

                image:
                    item.image ||
                    item.coverArt ||
                    item.cover_xl ||
                    item.cover_big ||
                    "",

                coverArt:
                    item.coverArt ||
                    item.image ||
                    item.cover_xl ||
                    item.cover_big ||
                    "",
                };

                return (
                <MusicCard
                    id={album.id}
                    image={album.image}
                    name={album.title}
                    artist={artistName}
                    onPressCard={() =>
                    navigation.navigate(
                        "AlbumPage",
                        { album }
                    )
                    }
                />
                );
        }
    }

    useEffect(() => {
        setPage(0);
        setListenableData([]);
        loadNextListenables();
        }, [artist?.id, type]);

    async function loadNextListenables() {
        if (loading && page > 0) {
            return;
        }

        try {
            setLoading(true);

            const artistId = String(
            artist?.id ||
            artist?.listenableId ||
            ""
            );

            if (!artistId) {
            throw new Error(
                "This artist does not have a valid ID."
            );
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
                `Backend returned HTTP ${response.status}`
            );
            }

            const newItems =
            type === "track"
                ? Array.isArray(data.tracks)
                ? data.tracks
                : []
                : Array.isArray(data.albums)
                ? data.albums
                : [];

            setListenableData((previousItems) => {
            const existingIds = new Set(
                previousItems.map((item) =>
                String(item.id)
                )
            );

            const uniqueNewItems =
                newItems.filter(
                (item) =>
                    !existingIds.has(
                    String(item.id)
                    )
                );

            return [
                ...previousItems,
                ...uniqueNewItems,
            ];
            });

            setPage(
            (previousPage) =>
                previousPage + 1
            );

            console.log(
            `[ArtistListenables] Loaded ${newItems.length} ${type}s`
            );
        } catch (error) {
            console.error(
            "[ArtistListenables] Load error:",
            error
            );

            setListenableData([]);
        } finally {
            setLoading(false);
        }
        }

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={() => { navigation.goBack(); }} style={styles.goBackButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Image
                    source={require("../images/arrowLeftIconWhite.png")}
                    style={styles.backIcon}
                />
            </TouchableOpacity>

            {/* Main Content */}
            <View style={styles.content}>
                <View style={{ marginBottom: 15 }}>
                    <SectionDivider title={type == "track" ? `Songs by ${artist.name}` : `Albums by ${artist.name}`} />
                </View>
                {loading && <ActivityIndicator size="large" color="white" />}
                <View key="Listenables">
                    <FlatList
                        data={listenableData}
                        renderItem={renderListenableItem}
                        keyExtractor={(item, index) =>
                        `${item.type || type}-${item.id}-${index}`
                        }
                        contentContainerStyle={styles.feedList}
                        onMomentumScrollBegin={() => {
                            setOnEndReachedCalledDuringMomentum(false);
                        }}
                        onEndReached={() => {}}
                        onEndReachedThreshold={0.01}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>

            {/* Bottom Navigation Bar fix*/}
            <View style={styles.bottomNavBar}>
                <BottomNavbar />
            </View>
        </View>
    );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colours.bluegrey,
    },
    feedList: {
        paddingBottom: 100,
    },
    goBackButton: {
        top: 70,
        left: 20,
    },
    backIcon: {
        width: 20,
        height: 20,
    },
    notificationsIcon: {
        width: 40,
        height: 40,
        position: "absolute",
        top: 70,
        right: 20,
    },
    notifIcon: {
        width: "90%",
        height: "90%",
        resizeMode: "contain",
        left: 10,
        top: 2,
    },
    notificationBadge: {
        position: "absolute",
        top: -5,
        right: -5,
        backgroundColor: "red",
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },
    notificationBadgeText: {
        color: "black",
        fontSize: 12,
        fontWeight: "bold",
    },
    sideMenu: {
        position: "absolute",
        top: 40,
        right: 525,
        bottom: 0,
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
    },
    content: {
        flex: 1,
        marginTop: 120,
        paddingBottom: 100,
        justifyContent: "center",
        alignItems: "center",
    },
    bottomNavBar: {
        position: "absolute",
        bottom: 0,
        width: "100%",
    },
    chipContainer: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        marginVertical: 10,
    },
});
