import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Platform,
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

    const finishSessionCheck = () => {
      if (
        componentMounted &&
        firebaseFinished &&
        sessionFinished
      ) {
        setCheckingSession(false);
      }
    };

    /*
     * Firebase may restore its signed-in user automatically
     * when the app or website is reopened.
     */
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {
          firebaseFinished = true;

          if (
            firebaseUser?.uid &&
            componentMounted
          ) {
            openFeed();
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

    /*
     * Check the same saved session written by Login.js:
     *
     * saveSession("userUid", user.uid)
     */
    async function checkSavedSession() {
      try {
        const savedUserUid =
          await getSession(
            "userUid"
          );

        if (
          savedUserUid &&
          componentMounted
        ) {
          openFeed();
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
            A Music Social Platform
          </Text>

          <Text
            style={
              styles.description
            }
          >
            Discover music, share reviews,
            connect with listeners, and find
            your next favourite song.
          </Text>

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
            activeOpacity={0.8}
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
            activeOpacity={0.8}
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

          <View
            style={
              styles.dividerRow
            }
          >
            <View
              style={
                styles.dividerLine
              }
            />

            <Text
              style={
                styles.dividerText
              }
            >
              TREBLE
            </Text>

            <View
              style={
                styles.dividerLine
              }
            />
          </View>

          <TouchableOpacity
            style={
              styles.restartButton
            }
            activeOpacity={0.75}
            onPress={() =>
              navigation.navigate(
                "Welcome"
              )
            }
          >
            <Text
              style={
                styles.restartButtonText
              }
            >
              Restart Welcome Setup
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        colours.background ||
        colours.bluegrey ||
        "#101010",
    },

    scrollContent: {
      flexGrow: 1,

      alignItems: "center",
      justifyContent: "center",

      padding: 20,
    },

    homeCard: {
      width: "100%",
      maxWidth: 440,

      alignItems: "center",

      paddingVertical: 36,
      paddingHorizontal: 28,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 22,

      backgroundColor:
        colours.darkblue ||
        "rgba(0,0,0,0.2)",
    },

    logoText: {
      color: "#ffffff",

      fontSize: 72,
      lineHeight: 82,

      fontFamily: "Lobster",

      textAlign: "center",
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.78)",

      fontSize: 17,
      fontWeight: "700",

      marginTop: 2,

      textAlign: "center",
    },

    description: {
      maxWidth: 340,

      color:
        "rgba(255,255,255,0.58)",

      fontSize: 14,
      lineHeight: 21,

      marginTop: 14,
      marginBottom: 18,

      textAlign: "center",
    },

    errorContainer: {
      width: "100%",

      padding: 12,
      marginBottom: 8,

      borderWidth: 1,
      borderColor:
        "rgba(255,75,75,0.45)",

      borderRadius: 10,

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
      height: 50,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 25,

      marginTop: 10,
    },

    primaryButton: {
      backgroundColor:
        colours.primaryblue ||
        "#359fe1",
    },

    registerButton: {
      borderWidth: 1,
      borderColor:
        colours.primaryblue ||
        "#359fe1",

      backgroundColor:
        "rgba(55,160,225,0.2)",
    },

    buttonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "800",
    },

    dividerRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      marginTop: 27,
      marginBottom: 8,
    },

    dividerLine: {
      flex: 1,
      height: 1,

      backgroundColor:
        "rgba(255,255,255,0.12)",
    },

    dividerText: {
      color:
        "rgba(255,255,255,0.35)",

      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,

      marginHorizontal: 12,
    },

    restartButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,

      marginTop: 4,
    },

    restartButtonText: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 14,
      fontWeight: "700",

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

      borderRadius: 22,

      backgroundColor:
        colours.darkblue ||
        "rgba(0,0,0,0.2)",
    },

    loadingLogo: {
      color: "#ffffff",

      fontSize: 64,
      lineHeight: 74,

      fontFamily: "Lobster",

      textAlign: "center",

      marginBottom: 24,
    },

    loadingText: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 14,

      marginTop: 15,

      textAlign: "center",
    },
  });