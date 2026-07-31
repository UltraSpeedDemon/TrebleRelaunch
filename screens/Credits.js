import React, {
  useEffect,
  useRef,
} from "react";

import {
  Animated,
  Easing,
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

import Icon from "react-native-vector-icons/MaterialIcons";
import colours from "../styles/colours";

const CREDITS = [
  {
    name: "Ethan Curtis",
    studentNumber: "1166648",
    featured: true,
    role:
      "Revived Treble and published its 2026 relaunch with major improvements. Redesigned and remodelled the full app experience, rebuilt existing features, added new functionality, and completed front-end and back-end development. Same app, new look.",
  },
  {
    name: "Connor McElroy",
    studentNumber: "1152990",
    role:
      "Front-End and Back-End Development",
  },
  {
    name: "Aleks Zheleznov",
    studentNumber: "1166794",
    role:
      "Frontend UI/UX and Swiping Recommendation Feature",
  },
  {
    name: "Tuany Van",
    studentNumber: "1162209",
    role:
      "Back-End Development, Reviews, and Album/Artist Feature",
  },
  {
    name: "Paul Molczanski",
    studentNumber: "1169713",
    role:
      "Back-End Development and Commenting/Posting",
  },
  {
    name: "Yama Kamal",
    studentNumber: "1118270",
    role:
      "Song Playback and Frontend UI",
  },
];

export default function Credits({
  navigation,
}) {
  const { width, height } =
    useWindowDimensions();

  const isCompact = width < 768;

  const rise = useRef(
    new Animated.Value(
      Math.max(height * 0.35, 220)
    )
  ).current;

  const fade = useRef(
    new Animated.Value(0)
  ).current;

  const logoScale = useRef(
    new Animated.Value(0.82)
  ).current;

  const glow = useRef(
    new Animated.Value(0.18)
  ).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      Animated.timing(rise, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(
          Easing.cubic
        ),
        useNativeDriver: true,
      }),

      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
    ]);

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.48,
          duration: 1500,
          useNativeDriver: true,
        }),

        Animated.timing(glow, {
          toValue: 0.18,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    glowLoop.start();

    return () => {
      glowLoop.stop();
    };
  }, [
    fade,
    glow,
    logoScale,
    rise,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View
          style={styles.backgroundOrbOne}
        />

        <View
          style={styles.backgroundOrbTwo}
        />

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

        <ScrollView
          style={styles.scrollView}
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
          <Animated.View
            style={[
              styles.creditsCard,
              isCompact &&
                styles.creditsCardCompact,
              {
                opacity: fade,
                transform: [
                  {
                    translateY: rise,
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.logoGlow,
                {
                  opacity: glow,
                },
              ]}
            />

            <Animated.View
              style={{
                transform: [
                  {
                    scale: logoScale,
                  },
                ],
              }}
            >
              <Image
                source={require(
                  "../assets/treblelogo.png"
                )}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            <Text style={styles.kicker}>
              A TREBLE PRODUCTION
            </Text>

            <Text style={styles.title}>
              Credits
            </Text>

            <Text style={styles.subtitle}>
              Built by music lovers, for
              music lovers.
            </Text>

            <View style={styles.divider} />

            <View
              style={styles.creditsList}
            >
              {CREDITS.map(
                (credit, index) => (
                  <Animated.View
                    key={`${credit.name}-${index}`}
                    style={[
                      styles.creditRow,
                      credit.featured &&
                        styles.featuredCredit,
                    ]}
                  >
                    {credit.featured ? (
                      <View
                        style={
                          styles.featuredPill
                        }
                      >
                        <Icon
                          name="star"
                          size={14}
                          color="#ffffff"
                        />

                        <Text
                          style={
                            styles.featuredPillText
                          }
                        >
                          RELAUNCH LEAD
                        </Text>
                      </View>
                    ) : null}

                    <Text style={styles.name}>
                      {credit.name}
                    </Text>

                    <Text
                      style={
                        styles.studentNumber
                      }
                    >
                      Student #{credit.studentNumber}
                    </Text>

                    <Text style={styles.roleLabel}>
                      ROLE
                    </Text>

                    <Text style={styles.roleText}>
                      {credit.role}
                    </Text>
                  </Animated.View>
                )
              )}
            </View>

            <View style={styles.divider} />

            <Text
              style={
                styles.placeholderTitle
              }
            >
              Thank you to everyone who
              helped create Treble
            </Text>

            <Text
              style={
                styles.placeholderText
              }
            >
              Your ideas, testing,
              feedback, creativity, and
              support helped bring the app
              to life.
            </Text>

            <Text style={styles.endMark}>
              THANK YOU FOR LISTENING
            </Text>
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

    minHeight:
      Platform.OS === "web"
        ? "100dvh"
        : undefined,

    backgroundColor: colours.darkblue,
    overflow: "hidden",
  },

  scrollView: {
    flex: 1,
    width: "100%",

    ...(Platform.OS === "web"
      ? {
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling:
            "touch",
        }
      : {}),
  },

  backgroundOrbOne: {
    position: "absolute",

    width: 430,
    height: 430,

    borderRadius: 215,

    top: -170,
    right: -140,

    backgroundColor:
      "rgba(72,136,255,0.16)",
  },

  backgroundOrbTwo: {
    position: "absolute",

    width: 360,
    height: 360,

    borderRadius: 180,

    bottom: -180,
    left: -120,

    backgroundColor:
      "rgba(118,92,255,0.12)",
  },

  backButton: {
    position: "absolute",

    top:
      Platform.OS === "web"
        ? 24
        : 14,

    left: 20,
    zIndex: 5,

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
  },

  scrollContent: {
    flexGrow: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 28,
    paddingVertical: 80,
    paddingBottom: 110,
  },

  scrollContentCompact: {
    justifyContent: "flex-start",

    paddingTop: 88,
    paddingHorizontal: 14,
    paddingBottom: 150,
  },

  creditsCard: {
    width: "100%",
    maxWidth: 820,

    alignItems: "center",

    paddingHorizontal: 34,
    paddingVertical: 44,

    borderRadius: 28,

    backgroundColor:
      "rgba(255,255,255,0.055)",

    borderWidth: 1,

    borderColor:
      "rgba(255,255,255,0.10)",
  },

  creditsCardCompact: {
    paddingHorizontal: 16,
    paddingVertical: 30,
    borderRadius: 20,
  },

  logoGlow: {
    position: "absolute",

    top: 27,

    width: 150,
    height: 150,

    borderRadius: 75,

    backgroundColor:
      colours.secondaryblue,
  },

  logoImage: {
    width: 116,
    height: 116,
    marginBottom: 24,
  },

  kicker: {
    color: colours.lightblue,

    fontSize: 10,
    fontWeight: "900",

    letterSpacing: 2.6,

    marginBottom: 12,
  },

  title: {
    color: "#ffffff",

    fontSize: 46,
    lineHeight: 54,

    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color:
      "rgba(255,255,255,0.64)",

    fontSize: 15,
    lineHeight: 23,

    textAlign: "center",

    marginTop: 8,
  },

  divider: {
    width: "78%",
    height: 1,

    backgroundColor:
      "rgba(255,255,255,0.12)",

    marginVertical: 30,
  },

  creditsList: {
    width: "100%",
    gap: 16,
  },

  creditRow: {
    width: "100%",

    paddingHorizontal: 20,
    paddingVertical: 21,

    borderRadius: 18,

    backgroundColor:
      "rgba(255,255,255,0.035)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.07)",
  },

  featuredCredit: {
    backgroundColor:
      "rgba(0,180,255,0.09)",

    borderColor:
      "rgba(0,190,255,0.28)",
  },

  featuredPill: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    paddingHorizontal: 9,
    paddingVertical: 5,

    borderRadius: 9,

    backgroundColor:
      colours.secondaryblue,

    marginBottom: 11,
  },

  featuredPillText: {
    color: "#ffffff",

    fontSize: 8,
    fontWeight: "900",

    letterSpacing: 0.8,
  },

  name: {
    color: "#ffffff",

    fontSize: 25,
    lineHeight: 32,

    fontWeight: "800",
  },

  studentNumber: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 11,
    lineHeight: 17,

    marginTop: 2,
  },

  roleLabel: {
    color: colours.lightblue,

    fontSize: 10,
    fontWeight: "900",

    letterSpacing: 1.4,

    marginTop: 15,
    marginBottom: 5,
  },

  roleText: {
    color:
      "rgba(255,255,255,0.70)",

    fontSize: 13,
    lineHeight: 21,
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

    color:
      "rgba(255,255,255,0.56)",

    fontSize: 13,
    lineHeight: 21,

    textAlign: "center",
  },

  endMark: {
    color:
      "rgba(255,255,255,0.28)",

    fontSize: 9,
    fontWeight: "900",

    letterSpacing: 2.5,

    marginTop: 38,
  },
});
