import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
} from "react-native";
import { auth } from "../utils/firebase";
import { getReviewById, updateReview } from "../providers/rest";
import colours from "../styles/colours";
import BottomNavbar from "../components/BottomNavbar";

export default function UpdateReviewPage({ route, navigation }) {
    const { review } = route.params;
    const [loading, setLoading] = useState(true);
    const [hearted, setHearted] = useState(false);
    const [message, setMessage] = useState("");
    const [rating, setRating] = useState(0);
    const [userSelectedEmojis, setSelectedEmojis] = useState([]);

    useEffect(() => {
        async function fetchReview() {
            try {
                setHearted(review.hearted)
                setMessage(review.text)
                setRating(review.rating)
                setSelectedEmojis(review.userSelectedEmojis ? review.userSelectedEmojis.map(e => e.replaceAll("'", "")) : [])
            } catch (error) {
                console.error("Error fetching review:", error);
                Alert.alert("Error", "Unable to fetch review");
            } finally {
                setLoading(false);
            }
        }
        fetchReview();
    }, [review]);

    const handleSelectEmoji = (emoji) => {
        setSelectedEmojis((prev) =>
            prev.includes(emoji) ? prev.filter((e) => e !== emoji) : [...prev, emoji]
        );
    };

    const handleUpdateReview = async () => {
        if (!message.trim()) return;
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                Alert.alert("Error", "User not logged in");
                return;
            }
            const response = await updateReview(review.id, userSelectedEmojis, hearted, message, rating);
            if (!response.ok) throw new Error("Failed to update review");
            Alert.alert("Success", "Review updated successfully");
            navigation.goBack();
        } catch (error) {
            console.error("Error updating review:", error);
            Alert.alert("Error", "Unable to update review");
        }
    };
    
    const handleHearted = () => {
        setHearted(!hearted)
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={() => { navigation.goBack(); }} style={styles.goBackButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Image
                    source={require("../images/arrowLeftIcon.png")}
                    style={styles.backIcon}
                />
            </TouchableOpacity>

            <View style={styles.card}>
                <Text style={styles.title}>Update Review</Text>
                <TextInput
                    style={styles.reviewInput}
                    placeholder="Update your review..."
                    placeholderTextColor="#aaa"
                    value={message}
                    onChangeText={setMessage}
                />
                <View>
                    <View style={styles.actionButtons}>
                        <View style={styles.favouriteContainer}>
                            <TouchableOpacity onPress={handleHearted}>
                                <Image
                                    source={
                                        hearted
                                            ? require("../images/whiteFullHeart.png")
                                            : require("../images/whiteOpenHeart.png")
                                    }
                                    style={styles.smallFavIcon}
                                />
                            </TouchableOpacity>
                            <Text style={styles.favLabel}>Favourite</Text>
                        </View>
                        <View style={styles.emojiDropdownRow}>
                            <Image
                                source={require("../images/selectEmojiIcon.png")}
                                style={styles.selectEmojiIcon}
                            />
                            <TouchableOpacity onPress={() => handleSelectEmoji("❤️")}>
                                <Text style={styles.reviewEmoji}>❤️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSelectEmoji("🔥")}>
                                <Text style={styles.reviewEmoji}>🔥</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleSelectEmoji("👏")}>
                                <Text style={styles.reviewEmoji}>👏</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.starRatingContainer}>
                        {userSelectedEmojis?.length > 0 && (
                            <View style={styles.reviewEmojisContainer}>
                                {userSelectedEmojis.map((emo, i) => (
                                    <Text key={i} style={styles.reviewEmoji}>{emo.replaceAll("'", "")}</Text>
                                ))}
                            </View>
                        )}
                        {[...Array(5)].map((_, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => setRating(index + 1)}
                            >
                                <Image
                                    source={
                                        index < rating
                                            ? require("../images/starFullIcon.png")
                                            : require("../images/starEmptyIcon.png")
                                    }
                                    style={styles.starIcon}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <TouchableOpacity style={styles.reviewButton} onPress={handleUpdateReview}>
                    <Text style={styles.reviewButtonText}>Update</Text>
                </TouchableOpacity>
            </View>
            {/* Bottom Nav */}
            <View style={styles.bottomNavBar}>
                <BottomNavbar />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colours.darkblue,
        padding: 20,
        borderRadius: 20,
        marginTop: 110,
        marginHorizontal: 5,
        marginBottom: 20,
    },
    backIcon: {
        width: 20,
        height: 20,
    },
    container: {
        flex: 1,
        backgroundColor: colours.bluegrey,
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        color: "#fff",
        fontSize: 16,
        marginTop: 10,
    },
    sideMenu: {
        position: "absolute",
        top: 40,
        right: 525,
        bottom: 0,
        zIndex: 10,
    },
    card: {
        backgroundColor: colours.darkblue,
        padding: 20,
        borderRadius: 20,
        marginTop: 110,
        marginHorizontal: 5,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#fff",
        textAlign: "center",
        marginBottom: 20,
    },
    image: {
        width: "70%",
        height: 200,
        alignSelf: "center",
        borderRadius: 10,
        marginBottom: 20,
    },
    artist: {
        fontSize: 18,
        color: "#bbb",
        marginBottom: 10,
        textAlign: "center",
    },
    actionButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    actionButton: {
        alignItems: "center",
    },
    actionIcon: {
        width: 30,
        height: 30,
    },
    actionText: {
        fontSize: 14,
        color: "#fff",
        marginTop: 5,
    },
    reviewInputContainer: {
        marginTop: 20,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    favouriteContainer: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        top: 3,
        padding: 3,
    },
    smallFavIcon: {
        width: 21,
        height: 21,
    },
    favLabel: {
        color: "#fff",
        fontSize: 11,
        marginTop: 2,
    },
    goBackButton: {
        top: 70,
        left: 20,
    },
    starRatingContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 20
    },
    starIcon: {
        width: 25,
        height: 25,
        marginHorizontal: 2,
    },
    selectEmojiTab: {
        padding: 14,
    },
    selectEmojiIcon: {
        width: 18,
        height: 18,
        marginTop: 2,
        marginRight: 2
    },
    emojiDropdownRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 8,
    },
    reviewEmoji: {
        fontSize: 20,
        marginHorizontal: 6,
    },
    reviewInput: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 10,
        fontSize: 16,
        marginRight: 10,
    },
    reviewButton: {
        backgroundColor: colours.lightblue,
        borderRadius: 10,
        padding: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    reviewButtonText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
    },
    selectedEmojisSection: {
        marginTop: 10,
        alignItems: "center",
    },
    selectedEmojisTitle: {
        fontSize: 14,
        color: "#fff",
        marginBottom: 5,
    },
    selectedEmojisContainer: {
        flexDirection: "row",
        justifyContent: "center",
    },
    selectedEmoji: {
        fontSize: 20,
        marginHorizontal: 4,
    },
    reviewCard: {
        flexDirection: "row",
        backgroundColor: colours.darkblue,
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        alignItems: "center",
        position: "relative",
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    reviewContent: {
        flex: 1,
    },
    reviewHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    username: {
        fontSize: 14,
        fontWeight: "bold",
        color: colours.lightblue,
        marginRight: 10,
    },
    reviewText: {
        fontSize: 14,
        color: "#fff",
        marginVertical: 5,
    },
    reviewRating: {
        flexDirection: "row",
        marginTop: 5,
    },
    reviewStar: {
        width: 16,
        height: 16,
        marginRight: 2,
    },
    reviewEmojisContainer: {
        flexDirection: "row",
        position: "absolute",
        bottom: 0,
        right: 10,
    },
    reviewEmoji: {
        fontSize: 16,
        marginLeft: 4,
        color: "#fff",
    },
    upvoteButton: {
        position: "absolute",
        top: 10,
        right: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    upvoteIcon: {
        width: 20,
        height: 20,
        marginRight: 5,
    },
    upvoteCount: {
        fontSize: 14,
        color: "#fff",
    },
    reviewsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    bottomNavBar: {
        position: "absolute",
        bottom: 0,
        width: "100%",
    }
});
