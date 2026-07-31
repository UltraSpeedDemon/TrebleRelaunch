import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
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

const CREDITS = [
  { role: "Creator & Developer", name: "Ethan Curtis" },
  { role: "Creator & Developer", name: "Connor McElroy" },
];

export default function Credits({ navigation }) {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 768;
  const rise = useRef(new Animated.Value(Math.max(height * 0.45, 260))).current;
  const fade = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 1350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.9,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.25,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    glowLoop.start();

    return () => glowLoop.stop();
  }, [fade, glow, rise]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.backgroundOrbOne} />
        <View style={styles.backgroundOrbTwo} />

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={23} color="#ffffff" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isCompact && styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.creditsCard,
              {
                opacity: fade,
                transform: [{ translateY: rise }],
              },
            ]}
          >
            <Animated.View style={[styles.logoGlow, { opacity: glow }]} />
            <View style={styles.logoCircle}>
              <Icon name="graphic-eq" size={42} color="#ffffff" />
            </View>

            <Text style={styles.kicker}>A TREBLE PRODUCTION</Text>
            <Text style={styles.title}>Credits</Text>
            <Text style={styles.subtitle}>
              Built by music lovers, for music lovers.
            </Text>

            <View style={styles.divider} />

            {CREDITS.map((credit, index) => (
              <Animated.View
                key={`${credit.name}-${index}`}
                style={styles.creditRow}
              >
                <Text style={styles.role}>{credit.role}</Text>
                <Text style={styles.name}>{credit.name}</Text>
              </Animated.View>
            ))}

            <View style={styles.divider} />

            <Text style={styles.placeholderTitle}>More credits coming soon</Text>
            <Text style={styles.placeholderText}>
              Add designers, developers, artists, testers, contributors, and anyone else who helped create Treble.
            </Text>

            <Text style={styles.endMark}>THANK YOU FOR LISTENING</Text>
          </Animated.View>
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
    overflow: "hidden",
  },
  backgroundOrbOne: {
    position: "absolute",
    width: 430,
    height: 430,
    borderRadius: 215,
    top: -170,
    right: -140,
    backgroundColor: "rgba(72, 136, 255, 0.16)",
  },
  backgroundOrbTwo: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -180,
    left: -120,
    backgroundColor: "rgba(118, 92, 255, 0.12)",
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 14,
    left: 20,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 80,
  },
  scrollContentCompact: {
    justifyContent: "flex-start",
    paddingTop: 96,
  },
  creditsCard: {
    width: "100%",
    maxWidth: 720,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 42,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  logoGlow: {
    position: "absolute",
    top: 30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colours.secondaryblue,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colours.secondaryblue,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    marginBottom: 22,
  },
  kicker: {
    color: colours.lightblue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.6,
    marginBottom: 10,
  },
  title: {
    color: "#ffffff",
    fontSize: 46,
    lineHeight: 54,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 8,
  },
  divider: {
    width: "72%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 30,
  },
  creditRow: {
    alignItems: "center",
    marginVertical: 14,
  },
  role: {
    color: colours.lightblue,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  name: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
    textAlign: "center",
  },
  placeholderTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  placeholderText: {
    maxWidth: 520,
    color: "rgba(255,255,255,0.56)",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
  endMark: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.5,
    marginTop: 38,
  },
});
