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
    getArtistSongs,
    getArtistAlbums,
} from "../providers/rest"; // REMOVED getFollowers, getFriends
import colours from "../styles/colours";

export default function ArtistListenables({ navigation, route }) {
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [listenableData, setListenableData] = useState([]);
    const [onEndReachedCalledDuringMomentum, setOnEndReachedCalledDuringMomentum] = useState(true);
    const { type, artist } = route.params;

    function renderListenableItem({ item }) {
        if (item.type == "track") {
            let track = { ...item, artist: artist.name }
            return (
                <MusicCard
                    key={item.id}
                    id={item.id}
                    image={item.image}
                    name={item.name}
                    artist={artist.name}
                    album={item.album}
                    onPressCard={() =>
                        navigation.navigate("SongPage", { track })
                    }
                />
            );
        }
        else {
            let album = { ...item, artist: artist.name }
            return (
                <MusicCard
                    key={item.id}
                    id={item.id}
                    image={item.image}
                    name={item.name}
                    artist={artist.name}
                    onPressCard={() =>
                        navigation.navigate("AlbumPage", { album })
                    }
                />
            );
        }
    }

    useEffect(() => {
        loadNextListenables();
    }, [])

    async function loadNextListenables() {
        if (type == "track") {
            const songs = await (await getArtistSongs(artist.id, page)).json()
            setListenableData([...listenableData, ...songs])
        }
        else {
            const albums = await (await getArtistAlbums(artist.id, page)).json()
            setListenableData([...listenableData, ...albums])
        }
        setPage(page + 1)
        setLoading(false);
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
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={styles.feedList}
                        onMomentumScrollBegin={() => {
                            setOnEndReachedCalledDuringMomentum(false);
                        }}
                        onEndReached={() => {
                            if (!onEndReachedCalledDuringMomentum) {
                                loadNextListenables();
                                setOnEndReachedCalledDuringMomentum(true);
                            }
                        }}
                        onEndReachedThreshold={0.01}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>

            {/* Bottom Navigation Bar */}
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
