import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
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
import { LinearGradient } from "expo-linear-gradient";

import {
  getAchievements,
} from "../providers/rest";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";

const ACHIEVEMENT_BADGE =
  require("../images/achievementBadge.png");

import {
  ACHIEVEMENT_DEFINITIONS,
  EMPTY_ACHIEVEMENT_STATS,
  getLocalAchievementStats,
  mergeAchievementStats,
} from "../utils/achievementTracker";

export default function Achievements({
  navigation,
}) {
  const { width } =
    useWindowDimensions();

  const isCompact = width < 720;

  const [stats, setStats] =
    useState(EMPTY_ACHIEVEMENT_STATS);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadAchievements =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setStats(EMPTY_ACHIEVEMENT_STATS);
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

        const localStats =
          await getLocalAchievementStats(
            currentUser.uid
          );

        setStats(
          mergeAchievementStats(
            data?.stats,
            localStats
          )
        );
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

  const overallProgress =
    achievements.length > 0
      ? Math.round(
          (unlockedCount /
            achievements.length) *
            100
        )
      : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          style={[
            styles.scrollView,
            Platform.OS === "web" &&
              styles.webScrollView,
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact &&
              styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
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

          <LinearGradient
            colors={[
              "rgba(53,175,229,0.24)",
              "rgba(44,88,160,0.18)",
              "rgba(255,255,255,0.045)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryGlowOne} />
            <View style={styles.summaryGlowTwo} />

            <View style={styles.summaryMainRow}>
              <View
                style={styles.summaryIcon}
              >
                <Image
                  source={ACHIEVEMENT_BADGE}
                  style={styles.summaryBadgeImage}
                />
              </View>

              <View
                style={styles.summaryTextWrap}
              >
                <Text style={styles.summaryEyebrow}>
                  EARN THIS ACHIEVEMENT BADGE
                </Text>

                <Text
                  style={styles.summaryValue}
                >
                  {unlockedCount} of{" "}
                  {achievements.length}
                </Text>

                <Text
                  style={styles.summaryLabel}
                >
                  Achievements Completed
                </Text>

                <Text
                  style={styles.summaryRewardText}
                >
                  Complete all 6 to Earn this Profile badge!
                </Text>
              </View>

              <View style={styles.completionBubble}>
                <Text style={styles.completionValue}>
                  {overallProgress}%
                </Text>

                <Text style={styles.completionLabel}>
                  COMPLETE
                </Text>
              </View>
            </View>

            <View style={styles.overallTrack}>
              <View
                style={[
                  styles.overallFill,
                  {
                    width: `${overallProgress}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.summaryFooter}>
              <Text style={styles.summaryHint}>
                Complete All 6 Achievements to earn the Treble Profile Trophy badge.
              </Text>

              <TouchableOpacity
                onPress={loadAchievements}
                activeOpacity={0.75}
                style={styles.refreshButton}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <>
                    <Icon
                      name="refresh"
                      size={17}
                      color="#ffffff"
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
          </LinearGradient>

          <View style={styles.collectionHeader}>
            <View>
              <Text style={styles.collectionEyebrow}>
                YOUR PROGRESS
              </Text>

              <Text style={styles.collectionTitle}>
                Achievement Progression
              </Text>
            </View>

            <View style={styles.collectionCount}>
              <Text style={styles.collectionCountText}>
                {achievements.length}
              </Text>
            </View>
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
                            unlocked
                              ? "emoji-events"
                              : "emoji-events"
                          }
                          size={29}
                          color={
                            unlocked
                              ? "#ffd768"
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

    height:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    minHeight:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    backgroundColor: colours.darkblue,
  },

  screen: {
    flex: 1,

    height:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    minHeight:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    backgroundColor: colours.darkblue,
  },

  scrollView: {
    flex: 1,
    width: "100%",
  },

  webScrollView: {
    height: "100dvh",
    maxHeight: "100dvh",

    overflowY: "scroll",
    overflowX: "hidden",

    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    touchAction: "pan-y",
  },

  scrollContent: {
    width: "100%",
    maxWidth: 1180,

    alignSelf: "center",

    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 100,
  },

  scrollContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 82,
    paddingBottom: 150,
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
    position: "relative",
    overflow: "hidden",

    padding: 22,

    borderRadius: 25,

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.32)",

    marginBottom: 28,
  },

  summaryGlowOne: {
    position: "absolute",
    top: -70,
    right: -35,

    width: 180,
    height: 180,

    borderRadius: 90,

    backgroundColor:
      "rgba(53,175,229,0.13)",
  },

  summaryGlowTwo: {
    position: "absolute",
    bottom: -90,
    left: 80,

    width: 170,
    height: 170,

    borderRadius: 85,

    backgroundColor:
      "rgba(98,82,255,0.09)",
  },

  summaryMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  summaryIcon: {
    width: 70,
    height: 70,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "transparent",
    borderWidth: 0,

    marginRight: 16,
  },

  summaryBadgeImage: {
    width: 68,
    height: 68,

    resizeMode: "contain",
  },

  summaryTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  summaryEyebrow: {
    color: colours.lightblue,

    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,

    marginBottom: 4,
  },

  summaryValue: {
    color: "#ffffff",

    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },

  summaryLabel: {
    color:
      "rgba(255,255,255,0.64)",

    fontSize: 12,

    marginTop: 1,
  },

  summaryRewardText: {
    color: "#ffd768",

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",

    marginTop: 5,
  },

  completionBubble: {
    width: 68,
    height: 68,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 12,

    borderRadius: 34,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.16)",

    backgroundColor:
      "rgba(5,13,25,0.36)",
  },

  completionValue: {
    color: "#ffffff",

    fontSize: 17,
    fontWeight: "900",
  },

  completionLabel: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.7,

    marginTop: 1,
  },

  overallTrack: {
    width: "100%",
    height: 8,

    overflow: "hidden",

    marginTop: 20,

    borderRadius: 5,

    backgroundColor:
      "rgba(255,255,255,0.10)",
  },

  overallFill: {
    height: "100%",

    borderRadius: 5,

    backgroundColor:
      colours.lightblue,
  },

  summaryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginTop: 14,
  },

  summaryHint: {
    flex: 1,

    color:
      "rgba(255,255,255,0.54)",

    fontSize: 11,
    lineHeight: 17,

    marginRight: 14,
  },

  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 12,
  },

  collectionEyebrow: {
    color: colours.lightblue,

    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,

    marginBottom: 3,
  },

  collectionTitle: {
    color: "#ffffff",

    fontSize: 23,
    fontWeight: "900",
  },

  collectionCount: {
    minWidth: 36,
    height: 36,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 9,

    borderRadius: 18,

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.32)",

    backgroundColor:
      "rgba(53,175,229,0.11)",
  },

  collectionCountText: {
    color: "#ffffff",

    fontSize: 13,
    fontWeight: "900",
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
      "rgba(255,255,255,0.10)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
  },

  refreshButtonText: {
    color: "#ffffff",

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
      "rgba(255,255,255,0.045)",

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
