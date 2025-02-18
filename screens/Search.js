import React, { useMemo, useReducer, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Image,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator
} from "react-native";

import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";
import BottomNavbar from "../components/BottomNavbar";
import useFetchUserData from "../hooks/useFetchUserData";

import colours from "../styles/colours";
import { postSearchResults } from "../providers/rest";
import { Card, Chip } from "@rneui/base";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import HorizontalRule from "../components/HorizontalRule";
import SectionDivider from "../components/SectionDivider";
import MusicCard from "../components/MusicCard";

export default function Search({ navigation, route }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchResult, setSearchResults] = useState(null);

    const { username, isSpotifyLinked, spotifyAccessToken, spotifyRefreshToken, loading } = useFetchUserData();
    const { searchQuery } = route.params;

    async function getSearchResults() {
        const results = await postSearchResults(searchQuery);
        const json = await results.json()
        setSearchResults(json)
    }

    const [filter, dispatchFilter] = useReducer((state, action) => {
        let { type } = action
        switch (type) {
            case 'TOGGLE_SONG':
                console.log(!state.albumOnly && !state.artistOnly && !state.userOnly)
                return {
                    songOnly: state.songOnly ? false : !state.albumOnly && !state.artistOnly && !state.userOnly,
                    albumOnly: false,
                    artistOnly: false,
                    userOnly: false,
                };
            case 'TOGGLE_ALBUM':
                return {
                    songOnly: false,
                    albumOnly: state.albumOnly ? false : !state.songOnly && !state.artistOnly && !state.userOnly,
                    artistOnly: false,
                    userOnly: false,
                };
            case 'TOGGLE_ARTIST':
                return {
                    songOnly: false,
                    albumOnly: false,
                    artistOnly: state.artistOnly ? false : !state.songOnly && !state.albumOnly && !state.userOnly,
                    userOnly: false,
                };
            case 'TOGGLE_USER':
                return {
                    songOnly: false,
                    albumOnly: false,
                    artistOnly: false,
                    userOnly: state.userOnly ? false : !state.songOnly && !state.albumOnly && !state.artistOnly,
                };
            default:
                return state;
        }
    },
        {
            songOnly: false,
            albumOnly: false,
            artistOnly: false,
            userOnly: false,
        })

    useState(() => getSearchResults(), []);

    return (
        <View style={styles.container}>
            <SearchBar />

            <TouchableOpacity style={styles.notificationsIcon} onPress={() => navigation.navigate("Notifications")}>
                <Image
                    source={require("../images/notificationsIcon2.png")} // Replace with your notifications icon
                    style={styles.notifIcon}
                />
            </TouchableOpacity>

            {/* Sidebar */}
            {/* <View style={[styles.sideMenu, menuOpen && { zIndex: 10 }]}>
                <Sidebar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
            </View> */}

            {/* Main Content */}
            <View style={styles.content}>
                <SafeAreaProvider>
                    <SafeAreaView>
                        <ScrollView>
                            <View>
                                {searchResult && Array.isArray(searchResult) ?
                                    <View key="searchResults">
                                        <View style={{ flexDirection: "row", gap: 10, marginLeft: 18, marginVertical: 10 }}>
                                            <Chip key="songsChip" title="Songs" onPress={() => dispatchFilter({ type: "TOGGLE_SONG"})} type={filter.songOnly ? "solid" : "outline"} />
                                            <Chip key="albumsChip" title="Albums" onPress={() => dispatchFilter({ type: "TOGGLE_ALBUM"})} type={filter.albumOnly ? "solid" : "outline"} />
                                            <Chip key="artistsChip" title="Artists" onPress={() => dispatchFilter({ type: "TOGGLE_ARTIST"})} type={filter.artistOnly ? "solid" : "outline"} />
                                            <Chip key="usersChip" title="Users" onPress={() => dispatchFilter({ type: "TOGGLE_USER"})} type={filter.userOnly ? "solid" : "outline"} />
                                        </View>

                                        {!(filter.albumOnly || filter.artistOnly || filter.userOnly) &&
                                            <View key="SongsView">
                                                <SectionDivider key="Songs" title="Songs" nonfirst={false} />
                                                {searchResult.map((result) => {
                                                    if (result['type'] == 'track') {
                                                        return (
                                                            <MusicCard
                                                                id={result['id']}
                                                                key={result['id']}
                                                                image={result['image']}
                                                                name={result['name']}
                                                                artist={result['artist']}
                                                                album={result['album']}
                                                            />
                                                        )
                                                    }
                                                })}
                                            </View>
                                        }

                                        {!(filter.songOnly || filter.artistOnly || filter.userOnly) &&
                                            <View key="AlbumsView">
                                                <SectionDivider key="Albums" title="Albums" nonfirst={!filter.albumOnly} />
                                                {searchResult.map((result) => {
                                                    if (result['type'] == 'album') {
                                                        return (
                                                            <MusicCard
                                                                id={result['id']}
                                                                key={result['id']}
                                                                image={result['image']}
                                                                name={result['name']}
                                                                artist={result['artist']}
                                                            />
                                                        )
                                                    }
                                                })}
                                            </View>
                                        }


                                        {!(filter.songOnly || filter.albumOnly || filter.userOnly) &&
                                            <View key="ArtistsView">
                                                <SectionDivider key="Artists" title="Artists" nonfirst={!filter.artistOnly} />
                                                {searchResult.map((result) => {
                                                    if (result['type'] == 'artist') {
                                                        return (
                                                            <MusicCard
                                                                id={result['id']}
                                                                key={result['id']}
                                                                image={result['image']}
                                                                artist={result['name']}
                                                            />
                                                        )
                                                    }
                                                })}
                                            </View>
                                        }

                                        {!(filter.songOnly || filter.albumOnly || filter.artistOnly) &&
                                            <View key="UsersView">
                                                <SectionDivider key="Users" title="Users" nonfirst={!filter.userOnly} />
                                                {searchResult.map((result) => {
                                                    if (result['type'] == 'user') {
                                                        return (
                                                            <MusicCard
                                                                id={result['id']}
                                                                key={result['username']}
                                                                name={result['username']}
                                                            />
                                                        )
                                                    }
                                                })}
                                            </View>
                                        }
                                    </View>
                                    :
                                    <ActivityIndicator size="large" color="#4CAF50" />}
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </SafeAreaProvider>
            </View>

            {/* Bottom Navigation Bar */}
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
    searchBar: {
        position: "absolute",
        width: "70%",
        height: 40,
        top: 70,
        left: "15%",
        borderRadius: 8,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colours.lightblue,
        backgroundColor: colours.darkblue,
    },
    searchInput: {
        fontSize: 16,
        color: "#fff",
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
    sideMenu: {
        position: "absolute",
        top: 40,
        left: 100,
        bottom: 0,
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
        backgroundColor: 'rgba(255,0,0,0.3)',
    },
    content: {
        flex: 1,
        marginTop: 120,
        paddingBottom: 100,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        fontSize: 32,
        fontWeight: "bold",
        color: colours.lightblue,
    },
    subText: {
        fontSize: 16,
        color: colours.darkblue,
        marginTop: 10,
    },
    bottomNavBar: {
        position: "absolute",
        bottom: 0,
        width: "100%",
        flexDirection: "row",
    },
    onTop: {
        zIndex: 999,
    },
    musicCard: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center"
    },
    musicInfo: {
        right: 1,
        width: "80%"
    }
});