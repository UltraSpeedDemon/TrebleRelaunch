import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "../utils/firebase";
import { getSession } from "../utils/session";
import colours from "../styles/colours";

export default function Home({
  navigation,
}) {
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