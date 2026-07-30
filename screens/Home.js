import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  onAuthStateChanged,
} from "firebase/auth";

import { FontAwesome } from "@expo/vector-icons";

import { auth } from "../utils/firebase";
import { getSession } from "../utils/session";
import colours from "../styles/colours";

export default function Home({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isMobileWidth =
    width < 768;

  const [showInstallPrompt, setShowInstallPrompt] =
    useState(false);

  const [mobilePlatform, setMobilePlatform] =
    useState("mobile");

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    sessionError,
    setSessionError,
  ] = useState("");

  const openFeed =
    useCallback(() => {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Feed",
          },
        ],
      });
    }, [navigation]);

  const closeInstallPrompt =
    useCallback(() => {
      setShowInstallPrompt(false);

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined"
      ) {
        try {
          window.localStorage.setItem(
            "treble-install-prompt-dismissed",
            "true"
          );
        } catch {
          // Storage can be unavailable in private browsing.
        }
      }
    }, []);

  useEffect(() => {
    if (
      !isWeb ||
      !isMobileWidth ||
      typeof window === "undefined"
    ) {
      setShowInstallPrompt(false);
      return;
    }

    const userAgent =
      window.navigator?.userAgent ||
      "";

    const isIOS =
      /iPad|iPhone|iPod/i.test(
        userAgent
      ) ||
      (
        /Macintosh/i.test(userAgent) &&
        Number(
          window.navigator?.maxTouchPoints ||
          0
        ) > 1
      );

    const isAndroid =
      /Android/i.test(userAgent);

    const isStandalone =
      window.matchMedia?.(
        "(display-mode: standalone)"
      )?.matches ||
      window.navigator?.standalone === true;

    let wasDismissed = false;

    try {
      wasDismissed =
        window.localStorage.getItem(
          "treble-install-prompt-dismissed"
        ) === "true";
    } catch {
      wasDismissed = false;
    }

    if (
      isStandalone ||
      wasDismissed ||
      (
        !isIOS &&
        !isAndroid
      )
    ) {
      setShowInstallPrompt(false);
      return;
    }

    setMobilePlatform(
      isIOS
        ? "ios"
        : "android"
    );

    const timer =
      window.setTimeout(() => {
        setShowInstallPrompt(true);
      }, 850);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isMobileWidth,
    isWeb,
  ]);

  useEffect(() => {
    let componentMounted = true;
    let firebaseFinished = false;
    let sessionFinished = false;
    let navigationStarted = false;

    const goToFeed = () => {
      if (
        !componentMounted ||
        navigationStarted
      ) {
        return;
      }

      navigationStarted = true;
      openFeed();
    };

    const finishSessionCheck = () => {
      if (
        componentMounted &&
        !navigationStarted &&
        firebaseFinished &&
        sessionFinished
      ) {
        setCheckingSession(false);
      }
    };

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {
          firebaseFinished = true;

          if (firebaseUser?.uid) {
            goToFeed();
            return;
          }

          finishSessionCheck();
        },
        (error) => {
          console.error(
            "[Home] Firebase session error:",
            error
          );

          firebaseFinished = true;
          finishSessionCheck();
        }
      );

    async function checkSavedSession() {
      try {
        const savedUserUid =
          await getSession(
            "userUid"
          );

        if (savedUserUid) {
          goToFeed();
          return;
        }
      } catch (error) {
        console.error(
          "[Home] Saved-session error:",
          error
        );

        if (componentMounted) {
          setSessionError(
            "We could not restore your saved session. You can still log in normally."
          );
        }
      } finally {
        sessionFinished = true;
        finishSessionCheck();
      }
    }

    checkSavedSession();

    return () => {
      componentMounted = false;
      unsubscribe();
    };
  }, [openFeed]);

  if (checkingSession) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <View
          style={
            styles.loadingCard
          }
        >
          <View
            style={
              styles.loadingLogoCircle
            }
          >
            <Text
              style={
                styles.loadingMusicNote
              }
            >
              ♪
            </Text>
          </View>

          <Text
            style={
              styles.loadingLogo
            }
          >
            Treble
          </Text>

          <ActivityIndicator
            size="large"
            color={
              colours.lightblue ||
              "#42bfee"
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Restoring your session...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.backgroundGlowTop
        }
      />

      <View
        style={
          styles.backgroundGlowBottom
        }
      />

      <Modal
        visible={showInstallPrompt}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeInstallPrompt
        }
      >
        <View style={styles.installOverlay}>
          <View style={styles.installModal}>
            <TouchableOpacity
              style={styles.installCloseButton}
              onPress={closeInstallPrompt}
              activeOpacity={0.75}
              accessibilityLabel="Close install instructions"
            >
              <FontAwesome
                name="times"
                size={20}
                color="rgba(255,255,255,0.72)"
              />
            </TouchableOpacity>

            <View style={styles.installIconCircle}>
              <FontAwesome
                name="mobile"
                size={34}
                color={
                  colours.lightblue ||
                  "#42bfee"
                }
              />
            </View>

            <Text style={styles.installTitle}>
              Add Treble to Your Home Screen
            </Text>

            <Text style={styles.installDescription}>
              You’re using Treble on mobile. Save it as an app for faster access and a full-screen experience.
            </Text>

            <View style={styles.installSteps}>
              {mobilePlatform === "ios" ? (
                <>
                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="share-square-o"
                        size={21}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        1. Tap Share
                      </Text>

                      <Text style={styles.installStepText}>
                        In Safari, tap the Share icon at the bottom of the screen.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="plus-square-o"
                        size={22}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        2. Add to Home Screen
                      </Text>

                      <Text style={styles.installStepText}>
                        Scroll down and choose “Add to Home Screen.”
                      </Text>
                    </View>
                  </View>

                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="check"
                        size={20}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        3. Tap Add
                      </Text>

                      <Text style={styles.installStepText}>
                        Confirm the Treble name and logo, then tap Add.
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="ellipsis-v"
                        size={21}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        1. Open the browser menu
                      </Text>

                      <Text style={styles.installStepText}>
                        In Chrome, tap the three-dot menu in the top-right.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="download"
                        size={20}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        2. Install the app
                      </Text>

                      <Text style={styles.installStepText}>
                        Choose “Install app” or “Add to Home screen.”
                      </Text>
                    </View>
                  </View>

                  <View style={styles.installStep}>
                    <View style={styles.installStepIcon}>
                      <FontAwesome
                        name="check"
                        size={20}
                        color="#ffffff"
                      />
                    </View>

                    <View style={styles.installStepContent}>
                      <Text style={styles.installStepTitle}>
                        3. Confirm
                      </Text>

                      <Text style={styles.installStepText}>
                        Tap Install to add the Treble icon to your Home Screen.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.installGotItButton}
              onPress={closeInstallPrompt}
              activeOpacity={0.82}
            >
              <Text style={styles.installGotItText}>
                Got It
              </Text>
            </TouchableOpacity>

            <Text style={styles.installBrowserNote}>
              {mobilePlatform === "ios"
                ? "Use Safari for the Add to Home Screen option."
                : "Chrome provides the best installation experience."}
            </Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.homeCard
          }
        >
          <View
            style={
              styles.cardAccent
            }
          />

          <View
            style={
              styles.logoCircle
            }
          >
            <Text
              style={
                styles.musicNote
              }
            >
              ♪
            </Text>
          </View>

          <Text
            style={
              styles.logoText
            }
          >
            Treble
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Discover Music Together
          </Text>

          <Text
            style={
              styles.description
            }
          >
            Discover new songs, share honest
            reviews, share with other music
            lovers, and create a soundtrack profile that
            feels like you.
          </Text>

          <View
            style={
              styles.featureRow
            }
          >
            <View
              style={
                styles.feature
              }
            >
              <Text
                style={
                  styles.featureIcon
                }
              >
                ♫
              </Text>

              <Text
                style={
                  styles.featureText
                }
              >
                Discover
              </Text>
            </View>

            <View
              style={
                styles.featureDivider
              }
            />

            <View
              style={
                styles.feature
              }
            >
              <Text
                style={
                  styles.featureIcon
                }
              >
                ★
              </Text>

              <Text
                style={
                  styles.featureText
                }
              >
                Review
              </Text>
            </View>

            <View
              style={
                styles.featureDivider
              }
            />

            <View
              style={
                styles.feature
              }
            >
              <Text
                style={
                  styles.featureIcon
                }
              >
                ♥
              </Text>

              <Text
                style={
                  styles.featureText
                }
              >
                Connect
              </Text>
            </View>
          </View>

          {sessionError ? (
            <View
              style={
                styles.errorContainer
              }
            >
              <Text
                style={
                  styles.errorText
                }
              >
                {sessionError}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
            ]}
            activeOpacity={0.82}
            onPress={() =>
              navigation.navigate(
                "Login"
              )
            }
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Login
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.registerButton,
            ]}
            activeOpacity={0.82}
            onPress={() =>
              navigation.navigate(
                "Register"
              )
            }
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Create Account
            </Text>
          </TouchableOpacity>

          <Text
            style={
              styles.footerText
            }
          >
            Join the conversation around music.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      position: "relative",
      overflow: "hidden",

      backgroundColor:
        colours.background ||
        colours.bluegrey ||
        "#101010",
    },

    backgroundGlowTop: {
      position: "absolute",

      top: -180,
      right: -150,

      width: 420,
      height: 420,

      borderRadius: 210,

      backgroundColor:
        "rgba(53,159,225,0.12)",
    },

    backgroundGlowBottom: {
      position: "absolute",

      bottom: -230,
      left: -190,

      width: 480,
      height: 480,

      borderRadius: 240,

      backgroundColor:
        "rgba(66,191,238,0.08)",
    },

    scrollContent: {
      flexGrow: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingVertical: 35,
      paddingHorizontal: 20,
    },

    homeCard: {
      position: "relative",

      width: "100%",
      maxWidth: 470,

      alignItems: "center",

      paddingTop: 43,
      paddingBottom: 34,
      paddingHorizontal: 32,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.12)",

      borderRadius: 28,

      backgroundColor:
        colours.darkblue ||
        "#1b1f28",

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: 14,
      },

      shadowOpacity: 0.36,
      shadowRadius: 30,

      elevation: 12,

      overflow: "hidden",
    },

    cardAccent: {
      position: "absolute",

      top: 0,
      left: 0,
      right: 0,

      height: 5,

      backgroundColor:
        colours.lightblue ||
        "#42bfee",
    },

    logoCircle: {
      width: 72,
      height: 72,

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.48)",

      borderRadius: 36,

      backgroundColor:
        "rgba(66,191,238,0.13)",

      shadowColor:
        colours.lightblue ||
        "#42bfee",

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity: 0.25,
      shadowRadius: 12,

      elevation: 5,
    },

    musicNote: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 38,
      lineHeight: 43,
      fontWeight: "800",
    },

    logoText: {
      color: "#ffffff",

      fontSize: 72,
      lineHeight: 82,

      fontFamily: "Lobster",

      textAlign: "center",

      marginTop: 8,
    },

    subtitle: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 17,
      lineHeight: 23,
      fontWeight: "800",

      textAlign: "center",
    },

    description: {
      width: "100%",
      maxWidth: 365,

      color:
        "rgba(255,255,255,0.64)",

      fontSize: 14,
      lineHeight: 22,

      marginTop: 15,

      textAlign: "center",
    },

    featureRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",

      marginTop: 24,
      marginBottom: 17,

      paddingVertical: 14,
      paddingHorizontal: 8,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.07)",

      borderRadius: 15,

      backgroundColor:
        "rgba(255,255,255,0.035)",
    },

    feature: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",
    },

    featureIcon: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 19,
      lineHeight: 23,
      fontWeight: "800",
    },

    featureText: {
      color:
        "rgba(255,255,255,0.7)",

      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",

      marginTop: 3,
    },

    featureDivider: {
      width: 1,
      height: 29,

      backgroundColor:
        "rgba(255,255,255,0.1)",
    },

    errorContainer: {
      width: "100%",

      padding: 12,
      marginBottom: 7,

      borderWidth: 1,
      borderColor:
        "rgba(255,75,75,0.45)",

      borderRadius: 11,

      backgroundColor:
        "rgba(255,50,50,0.1)",
    },

    errorText: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",
    },

    button: {
      width: "100%",
      height: 52,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 26,

      marginTop: 11,
    },

    primaryButton: {
      backgroundColor:
        colours.primaryblue ||
        "#359fe1",

      shadowColor:
        colours.primaryblue ||
        "#359fe1",

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.25,
      shadowRadius: 10,

      elevation: 4,
    },

    registerButton: {
      borderWidth: 1,
      borderColor:
        colours.primaryblue ||
        "#359fe1",

      backgroundColor:
        "rgba(55,160,225,0.15)",
    },

    buttonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "800",
    },

    footerText: {
      color:
        "rgba(255,255,255,0.35)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 20,

      textAlign: "center",
    },

    installOverlay: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 20,
      paddingVertical: 30,

      backgroundColor:
        "rgba(0,0,0,0.78)",
    },

    installModal: {
      position: "relative",

      width: "100%",
      maxWidth: 430,

      alignItems: "center",

      paddingTop: 31,
      paddingBottom: 24,
      paddingHorizontal: 21,

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.34)",

      borderRadius: 25,

      backgroundColor:
        colours.darkblue ||
        "#1b1f28",

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 13,
      },
      shadowOpacity: 0.48,
      shadowRadius: 28,

      elevation: 18,
    },

    installCloseButton: {
      position: "absolute",

      top: 13,
      right: 13,

      width: 38,
      height: 38,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 19,

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    installIconCircle: {
      width: 66,
      height: 66,

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.42)",

      borderRadius: 33,

      backgroundColor:
        "rgba(66,191,238,0.12)",
    },

    installTitle: {
      color: "#ffffff",

      fontSize: 23,
      lineHeight: 29,
      fontWeight: "900",

      marginTop: 15,

      textAlign: "center",
    },

    installDescription: {
      color:
        "rgba(255,255,255,0.67)",

      fontSize: 14,
      lineHeight: 20,

      marginTop: 8,

      textAlign: "center",
    },

    installSteps: {
      width: "100%",

      marginTop: 20,
    },

    installStep: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 12,
      marginBottom: 9,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 14,

      backgroundColor:
        "rgba(255,255,255,0.035)",
    },

    installStepIcon: {
      width: 42,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      marginRight: 12,

      borderRadius: 21,

      backgroundColor:
        colours.primaryblue ||
        "#359fe1",
    },

    installStepContent: {
      flex: 1,
      minWidth: 0,
    },

    installStepTitle: {
      color: "#ffffff",

      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
    },

    installStepText: {
      color:
        "rgba(255,255,255,0.58)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 2,
    },

    installGotItButton: {
      width: "100%",
      height: 49,

      alignItems: "center",
      justifyContent: "center",

      marginTop: 8,

      borderRadius: 25,

      backgroundColor:
        colours.primaryblue ||
        "#359fe1",
    },

    installGotItText: {
      color: "#ffffff",

      fontSize: 15,
      fontWeight: "900",
    },

    installBrowserNote: {
      color:
        "rgba(255,255,255,0.38)",

      fontSize: 11,
      lineHeight: 16,

      marginTop: 11,

      textAlign: "center",
    },

    loadingContainer: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      padding: 20,

      backgroundColor:
        colours.background ||
        colours.bluegrey ||
        "#101010",
    },

    loadingCard: {
      width: "100%",
      maxWidth: 440,

      alignItems: "center",

      paddingVertical: 44,
      paddingHorizontal: 28,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 24,

      backgroundColor:
        colours.darkblue ||
        "rgba(0,0,0,0.2)",

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: 10,
      },

      shadowOpacity: 0.3,
      shadowRadius: 20,

      elevation: 9,
    },

    loadingLogoCircle: {
      width: 58,
      height: 58,

      alignItems: "center",
      justifyContent: "center",

      marginBottom: 7,

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.45)",

      borderRadius: 29,

      backgroundColor:
        "rgba(66,191,238,0.12)",
    },

    loadingMusicNote: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 31,
      lineHeight: 36,
      fontWeight: "800",
    },

    loadingLogo: {
      color: "#ffffff",

      fontSize: 64,
      lineHeight: 74,

      fontFamily: "Lobster",

      textAlign: "center",

      marginBottom: 19,
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 14,

      marginTop: 15,

      textAlign: "center",
    },
  });