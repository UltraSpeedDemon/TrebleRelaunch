import React from "react";
import { View, StyleSheet } from "react-native";
import { MusicSwiper } from "./MusicSwiper";

const songs = [
  {
    audioUrl: "path/to/song1.mp3",
    title: "Graduation",
    artist: "Kanye",
    albumArt: require("../images/albumImage.jpg"),
  },
  {
    audioUrl: "path/to/song2.mp3",
    title: "Certified Lover Boy",
    artist: "Drake",
    albumArt: require("../images/albumImage.jpg"),
  },
  {
    audioUrl: "path/to/song3.mp3",
    title: "Midnights",
    artist: "Taylor Swift",
    albumArt: require("../images/albumImage.jpg"),
  },
  {
    audioUrl: "path/to/song4.mp3",
    title: "DAMN.",
    artist: "Kendrick Lamar",
    albumArt: require("../images/albumImage.jpg"),
  },
  {
    audioUrl: "path/to/song5.mp3",
    title: "Astroworld",
    artist: "Travis Scott",
    albumArt: require("../images/albumImage.jpg"),
  },
];

const MusicSwiperTest = () => {
  return (
    <View style={styles.container}>
      <MusicSwiper songs={songs} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MusicSwiperTest;