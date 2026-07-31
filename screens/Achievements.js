import React, { useMemo } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import colours from "../styles/colours";

const ACHIEVEMENTS = [
  {
    id: "listen-100",
    title: "Century Listener",
    description: "Listen to 100 songs.",
    icon: "headphones",
    current: 0,
    goal: 100,
  },
  {
    id: "review-100",
    title: "Music Critic",
    description: "Post 100 song reviews.",
    icon: "rate-review",
    current: 0,
    goal: 100,
  },
  {
    id: "reply-100",
    title: "Conversation Starter",
    description: "Reply to 100 reviews.",
    icon: "forum",
    current: 0,
    goal: 100,
  },
  {
    id: "like-100",
    title: "Big Fan",
    description: "Like 100 songs.",
    icon: "favorite",
    current: 0,
    goal: 100,
  },
  {
    id: "friend-25",
    title: "Connected",
    description: "Connect with 25 friends.",
    icon: "people",
    current: 0,
    goal: 25,
  },
  {
    id: "share-50",
    title: "Taste Maker",
    description: "Share 50 songs with friends.",
    icon: "share",
    current: 0,
    goal: 50,
  },
];

export default function Achievements({ navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 720;

  const unlockedCount = useMemo(
    () => ACHIEVEMENTS.filter((item) => item.current >= item.goal).length,
    []
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Icon name="arrow-back" size={23} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>YOUR TREBLE JOURNEY</Text>
              <Text style={styles.title}>Achievements</Text>
              <Text style={styles.subtitle}>
                Listen, review, reply, share, and unlock badges as you use Treble.
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Icon name="emoji-events" size={31} color="#ffffff" />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryValue}>
                {unlockedCount}/{ACHIEVEMENTS.length}
              </Text>
              <Text style={styles.summaryLabel}>Badges unlocked</Text>
            </View>
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonText}>SYSTEM READY</Text>
            </View>
          </View>

          <View style={[styles.grid, isCompact && styles.gridCompact]}>
            {ACHIEVEMENTS.map((achievement) => {
              const progress = Math.min(
                100,
                Math.round((achievement.current / achievement.goal) * 100)
              );
              const unlocked = achievement.current >= achievement.goal;

              return (
                <View
                  key={achievement.id}
                  style={[
                    styles.achievementCard,
                    isCompact && styles.achievementCardCompact,
                    unlocked && styles.achievementCardUnlocked,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.badgeIcon,
                        unlocked && styles.badgeIconUnlocked,
                      ]}
                    >
                      <Icon
                        name={achievement.icon}
                        size={29}
                        color={unlocked ? "#ffffff" : colours.lightblue}
                      />
                    </View>
                    <View style={styles.lockState}>
                      <Icon
                        name={unlocked ? "lock-open" : "lock-outline"}
                        size={17}
                        color="rgba(255,255,255,0.52)"
                      />
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{achievement.title}</Text>
                  <Text style={styles.cardDescription}>
                    {achievement.description}
                  </Text>

                  <View style={styles.progressHeader}>
                    <Text style={styles.progressText}>
                      {achievement.current} / {achievement.goal}
                    </Text>
                    <Text style={styles.progressPercent}>{progress}%</Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.noteCard}>
            <Icon name="construction" size={22} color={colours.lightblue} />
            <Text style={styles.noteText}>
              These badges are ready for the future achievement API. Replace each current value with live user statistics when the backend counters are added.
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
    minHeight: Platform.OS === "web" ? "100vh" : undefined,
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    color: "rgba(255,255,255,0.60)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 7,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 24,
  },
  summaryIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colours.secondaryblue,
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
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    marginTop: 2,
  },
  comingSoonPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(90, 156, 255, 0.15)",
  },
  comingSoonText: {
    color: colours.lightblue,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
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
    width: "calc(33.333% - 16px)",
    minWidth: 270,
    flexGrow: 1,
    margin: 8,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  achievementCardCompact: {
    width: "100%",
    minWidth: 0,
    marginHorizontal: 0,
    marginVertical: 7,
  },
  achievementCardUnlocked: {
    borderColor: "rgba(83, 153, 255, 0.55)",
    backgroundColor: "rgba(83, 153, 255, 0.10)",
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
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  badgeIconUnlocked: {
    backgroundColor: colours.secondaryblue,
  },
  lockState: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "850",
    marginBottom: 7,
  },
  cardDescription: {
    minHeight: 40,
    color: "rgba(255,255,255,0.55)",
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
    color: "rgba(255,255,255,0.68)",
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    height: "100%",
    minWidth: 0,
    borderRadius: 4,
    backgroundColor: colours.secondaryblue,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 22,
    padding: 17,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  noteText: {
    flex: 1,
    color: "rgba(255,255,255,0.54)",
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 11,
  },
});
