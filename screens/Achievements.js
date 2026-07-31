import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import Icon from "react-native-vector-icons/MaterialIcons";

import {
  getAchievements,
} from "../providers/rest";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";

const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "listen-100",
    statKey: "songsListened",
    title: "Century Listener",
    description: "Listen to 100 different songs.",
    icon: "headphones",
    goal: 100,
  },
  {
    id: "review-100",
    statKey: "reviewsPosted",
    title: "Music Critic",
    description: "Post 100 song reviews.",
    icon: "rate-review",
    goal: 100,
  },
  {
    id: "reply-100",
    statKey: "repliesPosted",
    title: "Conversation Starter",
    description: "Reply to 100 reviews.",
    icon: "forum",
    goal: 100,
  },
  {
    id: "like-100",
    statKey: "songsLiked",
    title: "Big Fan",
    description: "Like 100 songs.",
    icon: "favorite",
    goal: 100,
  },
  {
    id: "friend-25",
    statKey: "friendsConnected",
    title: "Connected",
    description: "Connect with 25 mutual friends.",
    icon: "people",
    goal: 25,
  },
  {
    id: "share-50",
    statKey: "songsShared",
    title: "Taste Maker",
    description: "Share 50 songs with friends.",
    icon: "share",
    goal: 50,
  },
];

const EMPTY_STATS = {
  songsListened: 0,
  reviewsPosted: 0,
  repliesPosted: 0,
  songsLiked: 0,
  friendsConnected: 0,
  songsShared: 0,
};

export default function Achievements({
  navigation,
}) {
  const { width } =
    useWindowDimensions();

  const isCompact = width < 720;

  const [stats, setStats] =
    useState(EMPTY_STATS);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadAchievements =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setStats(EMPTY_STATS);
        setErrorMessage(
          "Sign in to view your achievements."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const response =
          await getAchievements(
            currentUser.uid
          );

        if (!response?.ok) {
          throw new Error(
            `Achievement request failed with status ${response?.status}`
          );
        }

        const data =
          await response.json();

        setStats({
          ...EMPTY_STATS,
          ...(data?.stats || {}),
        });
      } catch (error) {
        console.error(
          "[Achievements] Load error:",
          error
        );

        setErrorMessage(
          "Achievements could not be loaded. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadAchievements();
    }, [loadAchievements])
  );

  const achievements =
    useMemo(
      () =>
        ACHIEVEMENT_DEFINITIONS.map(
          (achievement) => ({
            ...achievement,
            current: Math.max(
              0,
              Number(
                stats[
                  achievement.statKey
                ] || 0
              )
            ),
          })
        ),
      [stats]
    );

  const unlockedCount =
    useMemo(
      () =>
        achievements.filter(
          (achievement) =>
            achievement.current >=
            achievement.goal
        ).length,
      [achievements]
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          bounces={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.goBack()
              }
              activeOpacity={0.8}
            >
              <Icon
                name="arrow-back"
                size={23}
                color="#ffffff"
              />
            </TouchableOpacity>

            <View
              style={styles.headerTextWrap}
            >
              <Text style={styles.eyebrow}>
                YOUR TREBLE JOURNEY
              </Text>

              <Text style={styles.title}>
                Achievements
              </Text>

              <Text style={styles.subtitle}>
                Listen, review, reply,
                share, and unlock badges
                as you use Treble.
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View
              style={styles.summaryIcon}
            >
              <Icon
                name="emoji-events"
                size={31}
                color="#ffffff"
              />
            </View>

            <View
              style={styles.summaryTextWrap}
            >
              <Text
                style={styles.summaryValue}
              >
                {unlockedCount}/
                {achievements.length}
              </Text>

              <Text
                style={styles.summaryLabel}
              >
                Badges unlocked
              </Text>
            </View>

            <TouchableOpacity
              onPress={loadAchievements}
              activeOpacity={0.75}
              style={styles.refreshButton}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={colours.lightblue}
                />
              ) : (
                <>
                  <Icon
                    name="refresh"
                    size={17}
                    color={colours.lightblue}
                  />

                  <Text
                    style={
                      styles.refreshButtonText
                    }
                  >
                    REFRESH
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <Icon
                name="error-outline"
                size={21}
                color="#ff6b7f"
              />

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.grid,
              isCompact &&
                styles.gridCompact,
            ]}
          >
            {achievements.map(
              (achievement) => {
                const progress = Math.min(
                  100,
                  Math.round(
                    (
                      achievement.current /
                      achievement.goal
                    ) * 100
                  )
                );

                const unlocked =
                  achievement.current >=
                  achievement.goal;

                return (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementCard,

                      isCompact &&
                        styles
                          .achievementCardCompact,

                      unlocked &&
                        styles
                          .achievementCardUnlocked,
                    ]}
                  >
                    <View
                      style={styles.cardTopRow}
                    >
                      <View
                        style={[
                          styles.badgeIcon,

                          unlocked &&
                            styles
                              .badgeIconUnlocked,
                        ]}
                      >
                        <Icon
                          name={
                            achievement.icon
                          }
                          size={29}
                          color={
                            unlocked
                              ? "#ffffff"
                              : colours.lightblue
                          }
                        />
                      </View>

                      <View
                        style={styles.lockState}
                      >
                        <Icon
                          name={
                            unlocked
                              ? "lock-open"
                              : "lock-outline"
                          }
                          size={17}
                          color={
                            unlocked
                              ? colours.lightblue
                              : "rgba(255,255,255,0.52)"
                          }
                        />
                      </View>
                    </View>

                    <Text
                      style={styles.cardTitle}
                    >
                      {achievement.title}
                    </Text>

                    <Text
                      style={
                        styles.cardDescription
                      }
                    >
                      {
                        achievement.description
                      }
                    </Text>

                    <View
                      style={
                        styles.progressHeader
                      }
                    >
                      <Text
                        style={
                          styles.progressText
                        }
                      >
                        {achievement.current} /{" "}
                        {achievement.goal}
                      </Text>

                      <Text
                        style={
                          styles.progressPercent
                        }
                      >
                        {progress}%
                      </Text>
                    </View>

                    <View
                      style={
                        styles.progressTrack
                      }
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress}%`,
                          },
                        ]}
                      />
                    </View>

                    {unlocked ? (
                      <View
                        style={
                          styles.unlockedLabel
                        }
                      >
                        <Icon
                          name="check-circle"
                          size={15}
                          color="#ffffff"
                        />

                        <Text
                          style={
                            styles.unlockedText
                          }
                        >
                          UNLOCKED
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              }
            )}
          </View>

          <View style={styles.noteCard}>
            <Icon
              name="info-outline"
              size={22}
              color={colours.lightblue}
            />

            <Text style={styles.noteText}>
              Progress is calculated from
              your live Treble activity.
              Song listening counts unique
              songs recorded by the playback
              tracker.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colours.darkblue,
  },

  screen: {
    flex: 1,

    minHeight:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    backgroundColor: colours.darkblue,
  },

  scrollContent: {
    width: "100%",
    maxWidth: 1180,

    alignSelf: "center",

    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 60,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginBottom: 28,
  },

  backButton: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(255,255,255,0.08)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.10)",

    marginRight: 16,
  },

  headerTextWrap: {
    flex: 1,
  },

  eyebrow: {
    color: colours.lightblue,

    fontSize: 10,
    fontWeight: "900",

    letterSpacing: 2,

    marginBottom: 6,
  },

  title: {
    color: "#ffffff",

    fontSize: 38,
    lineHeight: 46,

    fontWeight: "900",
  },

  subtitle: {
    maxWidth: 660,

    color:
      "rgba(255,255,255,0.60)",

    fontSize: 14,
    lineHeight: 22,

    marginTop: 7,
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",

    padding: 20,

    borderRadius: 22,

    backgroundColor:
      "rgba(255,255,255,0.06)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.10)",

    marginBottom: 24,
  },

  summaryIcon: {
    width: 58,
    height: 58,

    borderRadius: 18,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      colours.secondaryblue,

    marginRight: 15,
  },

  summaryTextWrap: {
    flex: 1,
  },

  summaryValue: {
    color: "#ffffff",

    fontSize: 23,
    fontWeight: "900",
  },

  summaryLabel: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 12,

    marginTop: 2,
  },

  refreshButton: {
    minWidth: 94,
    minHeight: 38,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 6,

    paddingHorizontal: 11,
    paddingVertical: 7,

    borderRadius: 11,

    backgroundColor:
      "rgba(90,156,255,0.15)",
  },

  refreshButtonText: {
    color: colours.lightblue,

    fontSize: 9,
    fontWeight: "900",

    letterSpacing: 0.7,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",

    padding: 14,

    borderRadius: 14,

    backgroundColor:
      "rgba(255,80,104,0.10)",

    marginBottom: 18,
  },

  errorText: {
    flex: 1,

    color: "#ff9baa",

    fontSize: 12,
    lineHeight: 18,

    marginLeft: 9,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",

    marginHorizontal: -8,
  },

  gridCompact: {
    marginHorizontal: 0,
  },

  achievementCard: {
    width:
      Platform.OS === "web"
        ? "calc(33.333% - 16px)"
        : "31.5%",

    minWidth: 270,
    flexGrow: 1,

    margin: 8,
    padding: 20,

    borderRadius: 22,

    backgroundColor:
      "rgba(255,255,255,0.05)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.09)",
  },

  achievementCardCompact: {
    width: "100%",
    minWidth: 0,

    marginHorizontal: 0,
    marginVertical: 7,
  },

  achievementCardUnlocked: {
    borderColor:
      "rgba(83,153,255,0.55)",

    backgroundColor:
      "rgba(83,153,255,0.10)",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 18,
  },

  badgeIcon: {
    width: 58,
    height: 58,

    borderRadius: 18,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(255,255,255,0.065)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.08)",
  },

  badgeIconUnlocked: {
    backgroundColor:
      colours.secondaryblue,
  },

  lockState: {
    width: 30,
    height: 30,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      "rgba(255,255,255,0.05)",
  },

  cardTitle: {
    color: "#ffffff",

    fontSize: 18,
    fontWeight: "800",

    marginBottom: 7,
  },

  cardDescription: {
    minHeight: 40,

    color:
      "rgba(255,255,255,0.55)",

    fontSize: 12,
    lineHeight: 19,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",

    marginTop: 21,
    marginBottom: 8,
  },

  progressText: {
    color:
      "rgba(255,255,255,0.68)",

    fontSize: 11,
    fontWeight: "700",
  },

  progressPercent: {
    color: colours.lightblue,

    fontSize: 11,
    fontWeight: "900",
  },

  progressTrack: {
    width: "100%",
    height: 7,

    borderRadius: 4,
    overflow: "hidden",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  progressFill: {
    height: "100%",

    minWidth: 0,

    borderRadius: 4,

    backgroundColor:
      colours.secondaryblue,
  },

  unlockedLabel: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    marginTop: 14,

    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 9,

    backgroundColor:
      colours.secondaryblue,
  },

  unlockedText: {
    color: "#ffffff",

    fontSize: 8,
    fontWeight: "900",

    letterSpacing: 0.7,
  },

  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",

    marginTop: 22,
    padding: 17,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.04)",
  },

  noteText: {
    flex: 1,

    color:
      "rgba(255,255,255,0.54)",

    fontSize: 12,
    lineHeight: 19,

    marginLeft: 11,
  },
});
