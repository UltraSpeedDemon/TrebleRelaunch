import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";

export function SongCardSwipe({ song }) {
  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={song.albumArt} style={styles.image} />
        <View style={styles.overlay} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>
        <View style={styles.instructions}>
          <Text>Swipe right to like, left to skip</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1f1f1f",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  imageContainer: {
    position: "relative",
    aspectRatio: 1,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  artist: {
    fontSize: 18,
    color: "#ccc",
  },
  instructions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    color: "#aaa",
  },
});