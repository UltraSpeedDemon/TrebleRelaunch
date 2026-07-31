import React from "react";

import {
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome } from "@expo/vector-icons";

import colours from "../styles/colours";

export function SongCardSwipe({
  song,
  compact = false,
}) {
  const imageSource =
    song?.albumArt ||
    (song?.imageUrl
      ? { uri: song.imageUrl }
      : require("../images/albumImage.jpg"));

  const hasPreview = Boolean(song?.audioUrl);

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          onError={(error) => {
            console.warn(
              "[SongCardSwipe] Artwork failed to load:",
              error?.nativeEvent?.error || error
            );
          }}
        />

        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.12)",
            "rgba(0,0,0,0.94)",
          ]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.previewBadge,
            !hasPreview && styles.noPreviewBadge,
          ]}
        >
          <FontAwesome
            name={hasPreview ? "volume-up" : "volume-off"}
            size={11}
            color={
              hasPreview
                ? "#ffffff"
                : "rgba(255,255,255,0.72)"
            }
          />

          <Text
            style={[
              styles.previewBadgeText,
              !hasPreview && styles.noPreviewText,
            ]}
          >
            {hasPreview ? "Audio preview" : "Preview unavailable"}
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.musicTypeBadge}>
            <Text style={styles.musicTypeText}>TRACK</Text>
          </View>

          <Text
            style={[
              styles.title,
              compact && styles.compactTitle,
            ]}
            numberOfLines={2}
          >
            {song?.title || "Unknown Title"}
          </Text>

          <Text
            style={[
              styles.artist,
              compact && styles.compactArtist,
            ]}
            numberOfLines={1}
          >
            {song?.artist || "Unknown Artist"}
          </Text>

          {song?.album ? (
            <Text style={styles.album} numberOfLines={1}>
              {song.album}
            </Text>
          ) : null}

          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <FontAwesome
                name="arrow-left"
                size={12}
                color="#ff727f"
              />
              <Text style={styles.skipInstruction}>Skip</Text>
            </View>

            <View style={styles.instructionDivider} />

            <View style={styles.instructionItem}>
              <Text style={styles.likeInstruction}>Like</Text>
              <FontAwesome
                name="arrow-right"
                size={12}
                color={colours.lightblue || "#35afe5"}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "rgba(53,175,229,0.28)",
    borderRadius: 25,
    backgroundColor: colours.darkblue || "#222222",
    overflow: "hidden",
  },
  imageContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  previewBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: "rgba(53,175,229,0.84)",
  },
  noPreviewBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  previewBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 6,
  },
  noPreviewText: {
    color: "rgba(255,255,255,0.72)",
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 23,
  },
  musicTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "rgba(53,175,229,0.18)",
  },
  musicTypeText: {
    color: colours.lightblue || "#35afe5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
  },
  compactTitle: {
    fontSize: 25,
    lineHeight: 30,
  },
  artist: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    marginTop: 5,
  },
  compactArtist: {
    fontSize: 16,
    lineHeight: 21,
  },
  album: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  instructions: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  instructionDivider: {
    width: 1,
    height: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  skipInstruction: {
    color: "#ff727f",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
  },
  likeInstruction: {
    color: colours.lightblue || "#35afe5",
    fontSize: 12,
    fontWeight: "800",
    marginRight: 6,
  },
});
