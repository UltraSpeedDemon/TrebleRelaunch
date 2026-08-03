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
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;

const CREDITS = [
  {
    name: "Ethan Curtis",
    studentNumber: "1166648",
    featured: true,
    role:
      "Revived Treble and published its 2026 relaunch with major improvements. Redesigned and remodelled the full app experience, rebuilt existing features, and completed front-end and back-end development. Created and improved Profiles, User Profiles, Following, Followers, Friends, Notifications, Badges, Settings, Achievements, Credits, mobile navigation, music playback, and other major Treble features. Same app, new look.",
  },
  {
    name: "Connor McElroy",
    studentNumber: "1152990",
    role:
      "Front-End and Back-End Development, Feed Page, Recommendation System, and Search Functionality",
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

  const isWeb = Platform.OS === "web";
  const isDesktopWeb =
    isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb =
    isWeb && width < DESKTOP_BREAKPOINT;
  const isCompact = width < 768;
  const isMobile =
    Platform.OS !== "web" || width < 768;

  const [menuOpen, setMenuOpen] =
    React.useState(false);

  useEffect(() => {
    setMenuOpen(isDesktopWeb);
  }, [isDesktopWeb]);

  /*
   * Mobile uses a shorter one-time entrance and no infinite glow
   * loop. This prevents the Credits page from becoming choppy.
   */
  const shouldAnimateGlow =
    !isMobile;

  const rise = useRef(
    new Animated.Value(
      isMobile
        ? 32
        : Math.max(
            height * 0.24,
            150
          )
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
    if (isMobile) {
      fade.setValue(1);
      rise.setValue(0);
      logoScale.setValue(1);
      glow.setValue(0.18);

      return undefined;
    }

    const entrance = Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),

      Animated.timing(rise, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(
          Easing.cubic
        ),
        useNativeDriver: true,
      }),

      Animated.timing(logoScale, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(
          Easing.cubic
        ),
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
      entrance.stop();
      glowLoop.stop();

      fade.stopAnimation();
      rise.stopAnimation();
      logoScale.stopAnimation();
      glow.stopAnimation();
    };
  }, [
    fade,
    glow,
    isMobile,
    logoScale,
    rise,
  ]);

  return (
    <View style={styles.appContainer}>
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb && styles.desktopSideMenu,
          isMobileWeb && styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={isDesktopWeb ? true : menuOpen}
          setMenuOpen={
            isDesktopWeb ? () => {} : setMenuOpen
          }
          isDesktop={isDesktopWeb}
        />
      </View>

      <View
        style={[
          styles.pageContent,
          isDesktopWeb && styles.desktopPageContent,
          isMobileWeb && styles.mobilePageContent,
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.screen}>
        <View
          style={[
            styles.backgroundOrbOne,
            isCompact &&
              styles.backgroundOrbOneCompact,
          ]}
        />

        <View
          style={[
            styles.backgroundOrbTwo,
            isCompact &&
              styles.backgroundOrbTwoCompact,
          ]}
        />

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
          removeClippedSubviews={false}
          scrollEventThrottle={32}
        >
          <View
            style={[
              styles.topBar,
              !isDesktopWeb && styles.mobileTopBar,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.backButton,
                !isDesktopWeb && styles.mobileBackButton,
              ]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Icon
                name="arrow-back"
                size={23}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.creditsCard,
              isCompact &&
                styles.creditsCardCompact,
              !isMobile && {
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
                isCompact &&
                  styles.logoGlowCompact,
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
                style={[
                  styles.logoImage,
                  isCompact &&
                    styles.logoImageCompact,
                ]}
                resizeMode="contain"
              />
            </Animated.View>

            <Text
              style={[
                styles.kicker,
                isCompact &&
                  styles.kickerCompact,
              ]}
            >
              A TREBLE PRODUCTION
            </Text>

            <Text
              style={[
                styles.title,
                isCompact &&
                  styles.titleCompact,
              ]}
            >
              Credits
            </Text>

            <Text
              style={[
                styles.subtitle,
                isCompact &&
                  styles.subtitleCompact,
              ]}
            >
              Built by music lovers, for
              music lovers.
            </Text>

            <View style={styles.divider} />

            <View
              style={styles.creditsList}
            >
              {CREDITS.map(
                (credit, index) => (
                  <View
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
                          color={
                            colours.lightblue ||
                            "#35afe5"
                          }
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

                    <Text style={styles.roleLabel}>
                      ROLE
                    </Text>

                    <Text style={styles.roleText}>
                      {credit.role}
                    </Text>
                  </View>
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
      </View>

      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb && styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colours.darkblue,
  },

  sideMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 20,
  },

  desktopSideMenu: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: DESKTOP_SIDEBAR_WIDTH,
    height: "100vh",
    overflow: "hidden",
  },

  mobileSideMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    bottom: 0,
  },

  pageContent: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",
    top: 0,
    left: DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom: BOTTOM_NAV_HEIGHT,
    overflow: "hidden",
  },

  mobilePageContent: {
    paddingBottom: BOTTOM_NAV_HEIGHT,
  },

  bottomNavBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },

  desktopBottomNavBar: {
    left: DESKTOP_SIDEBAR_WIDTH,
  },
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
    minWidth: 0,
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

  backgroundOrbOneCompact: {
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -110,
    right: -145,
    opacity: 0.72,
  },

  backgroundOrbTwoCompact: {
    width: 280,
    height: 280,
    borderRadius: 140,
    bottom: -150,
    left: -135,
    opacity: 0.72,
  },

  topBar: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    marginBottom: 12,
  },

  mobileTopBar: {
    position: "relative",
    height: 0,
    marginBottom: 0,
    paddingLeft: 0,
  },

  mobileBackButton: {
    position: "absolute",
    top: -72,
    left: 80,
    zIndex: 90,
    elevation: 15,
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
  },

  scrollContent: {
    flexGrow: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 110,
  },

  scrollContentCompact: {
    justifyContent: "flex-start",
    alignItems: "stretch",

    paddingTop: 68,
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
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",

    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 36,

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

  logoGlowCompact: {
    display: "none",
    opacity: 0,
  },

  logoImageCompact: {
    width: 92,
    height: 92,
    marginBottom: 28,
  },

  kickerCompact: {
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 2.2,
    marginBottom: 10,
  },

  titleCompact: {
    fontSize: 39,
    lineHeight: 46,
  },

  subtitleCompact: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
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
    alignSelf: "stretch",
    flexShrink: 0,

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

    paddingHorizontal: 10,
    paddingVertical: 6,

    borderRadius: 9,

    backgroundColor:
      "rgba(0,0,0,0.28)",

    borderWidth: 1,
    borderColor:
      "rgba(53,175,229,0.65)",

    marginBottom: 13,
  },

  featuredPillText: {
    color:
      colours.lightblue ||
      "#35afe5",

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
