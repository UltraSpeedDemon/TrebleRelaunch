import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { MusicSwiper } from "./MusicSwiper";
import { getRecommendations, getSongFromDeezer } from "../providers/rest";
import { auth } from "../utils/firebase";
import { Audio } from "expo-av";

const MusicSwiperTest = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchRecommendedSongs = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert("Error", "User not logged in");
          return;
        }

        const response = await getRecommendations(currentUser.uid, { limit: 10 });
        if (response.ok) {
          const data = await response.json();
          console.log("API Response:", data.recommendations); // Log the recommendations

          const recommendedSongs = await Promise.all(
            data.recommendations.map(async (item) => {
              let previewUrl = null;
              try {
                const deezerResponse = await getSongFromDeezer(item.id);
                if (deezerResponse.ok) {
                  const deezerData = await deezerResponse.json();
                  previewUrl = deezerData.preview;
                }
              } catch (error) {
                console.error(`Error fetching preview for song ID ${item.id}:`, error);
              }

              return {
                id: item.id,
                audioUrl: previewUrl,
                title: item.name || "Unknown Title",
                artist: item.artist?.name || "Unknown Artist",
                albumArt: item.image
                  ? { uri: item.image }
                  : require("../images/albumImage.jpg"),
              };
            })
          );

          setSongs(recommendedSongs);
        } else {
          console.error("Failed to fetch recommendations:", response.status);
        }
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        Alert.alert("Error", "Unable to fetch recommended songs.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendedSongs();

    // Cleanup sound on unmount
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handlePlayPause = async (audioUrl) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }

      if (audioUrl) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert("Error", "Unable to play the song.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MusicSwiper
        songs={songs}
        onPlayPause={handlePlayPause} // Pass playback handler to MusicSwiper
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default MusicSwiperTest;