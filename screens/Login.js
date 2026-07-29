import React, {
  useState,
} from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "../utils/firebase";
import { getUserByUsername } from "../providers/rest";
import { saveSession } from "../utils/session";
import colours from "../styles/colours";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value) {
  return EMAIL_PATTERN.test(
    String(value || "").trim()
  );
}

async function readResponse(response) {
  if (!response) {
    throw new Error(
      "The server did not return a response."
    );
  }

  const responseText =
    await response.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Server error ${response.status}.`
    );
  }

  return data;
}

function findUserRecord(data) {
  if (Array.isArray(data)) {
    return data[0] || null;
  }

  if (Array.isArray(data?.users)) {
    return data.users[0] || null;
  }

  if (Array.isArray(data?.results)) {
    return data.results[0] || null;
  }

  if (data?.user) {
    return data.user;
  }

  if (
    data &&
    typeof data === "object" &&
    (
      data.email ||
      data.userEmail
    )
  ) {
    return data;
  }

  return null;
}

function getFriendlyLoginError(error) {
  const code =
    String(error?.code || "");

  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid username, email, or password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please wait and try again.";

    case "auth/network-request-failed":
      return "Unable to connect to Firebase. Check your internet connection.";

    default:
      return (
        error?.message ||
        "Unable to log in. Please try again."
      );
  }
}

export default function Login({
  navigation,
}) {
  const [
    identifier,
    setIdentifier,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    const cleanIdentifier =
      identifier.trim();

    if (!cleanIdentifier) {
      setError(
        "Enter your username or email."
      );

      return;
    }

    if (!password) {
      setError(
        "Enter your password."
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      let userEmail =
        cleanIdentifier.toLowerCase();

      if (!isEmail(cleanIdentifier)) {
        console.log(
          "[Login] Looking up username:",
          userEmail
        );

        const response =
          await getUserByUsername(
            userEmail
          );

        const data =
          await readResponse(
            response
          );

        const userRecord =
          findUserRecord(data);

        if (!userRecord) {
          throw new Error(
            "Username not found."
          );
        }

        userEmail =
          String(
            userRecord.email ||
              userRecord.userEmail ||
              userRecord.uemail ||
              ""
          )
            .trim()
            .toLowerCase();

        if (
          !userEmail ||
          !isEmail(userEmail)
        ) {
          throw new Error(
            "This username does not have a valid email address attached to it."
          );
        }
      }

      console.log(
        "[Login] Signing in as:",
        userEmail
      );

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          userEmail,
          password
        );

      const user =
        userCredential.user;

      if (!user?.uid) {
        throw new Error(
          "Firebase did not return a valid user account."
        );
      }

      await saveSession(
        "userUid",
        user.uid
      );

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Feed",
          },
        ],
      });
    } catch (loginError) {
      console.error(
        "[Login] Login failed:",
        loginError
      );

      setError(
        getFriendlyLoginError(
          loginError
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.loginCard
          }
        >
          <View
            style={
              styles.cardAccent
            }
          />

          <Text
            style={
              styles.title
            }
          >
            Welcome Back
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Sign in to continue discovering,
            reviewing, and sharing music.
          </Text>

          {error ? (
            <View
              style={
                styles.errorContainer
              }
            >
              <Text
                style={
                  styles.error
                }
              >
                {error}
              </Text>
            </View>
          ) : null}

          <View
            style={
              styles.formGroup
            }
          >
            <Text
              style={
                styles.inputLabel
              }
            >
              Username or Email
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Enter your username or email"
              placeholderTextColor={
                colours.lightgrey ||
                "#8c929c"
              }
              value={
                identifier
              }
              onChangeText={
                setIdentifier
              }
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View
            style={
              styles.formGroup
            }
          >
            <Text
              style={
                styles.inputLabel
              }
            >
              Password
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Enter your password"
              placeholderTextColor={
                colours.lightgrey ||
                "#8c929c"
              }
              value={password}
              onChangeText={
                setPassword
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="current-password"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={
                handleLogin
              }
            />
          </View>

          <TouchableOpacity
            style={
              styles.forgotButton
            }
            onPress={() =>
              navigation.navigate(
                "ForgotPassword"
              )
            }
            disabled={loading}
            activeOpacity={0.75}
          >
            <Text
              style={
                styles.forgotButtonText
              }
            >
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={
              handleLogin
            }
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Login
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={
              styles.accountPrompt
            }
          >
            <Text
              style={
                styles.accountPromptText
              }
            >
              New to Treble?
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.registerButton,
            ]}
            onPress={() =>
              navigation.navigate(
                "Register"
              )
            }
            disabled={loading}
            activeOpacity={0.82}
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              navigation.navigate(
                "Home"
              )
            }
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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

    loginCard: {
      position: "relative",

      width: "100%",
      maxWidth: 470,

      alignItems: "center",

      paddingTop: 38,
      paddingBottom: 31,
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
      width: 64,
      height: 64,

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.48)",

      borderRadius: 32,

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

      fontSize: 34,
      lineHeight: 39,
      fontWeight: "800",
    },

    brandText: {
      color: "#ffffff",

      fontSize: 52,
      lineHeight: 62,

      fontFamily: "Lobster",

      textAlign: "center",

      marginTop: 6,
    },

    title: {
      color: "#ffffff",

      fontSize: 25,
      lineHeight: 32,
      fontWeight: "800",

      marginTop: 4,

      textAlign: "center",
    },

    subtitle: {
      width: "100%",
      maxWidth: 340,

      color:
        "rgba(255,255,255,0.58)",

      fontSize: 14,
      lineHeight: 21,

      marginTop: 8,
      marginBottom: 23,

      textAlign: "center",
    },

    errorContainer: {
      width: "100%",

      padding: 12,
      marginBottom: 16,

      borderWidth: 1,
      borderColor:
        "rgba(255,75,75,0.45)",

      borderRadius: 11,

      backgroundColor:
        "rgba(255,50,50,0.1)",
    },

    error: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",
    },

    formGroup: {
      width: "100%",

      marginBottom: 15,
    },

    inputLabel: {
      color:
        "rgba(255,255,255,0.76)",

      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",

      marginBottom: 7,
      marginLeft: 3,
    },

    input: {
      width: "100%",
      height: 52,

      color: "#ffffff",

      paddingHorizontal: 15,

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.48)",

      borderRadius: 13,

      backgroundColor:
        "rgba(255,255,255,0.05)",

      fontFamily: "Domine",
      fontSize: 15,

      outlineStyle: "none",
    },

    forgotButton: {
      alignSelf: "flex-end",

      paddingVertical: 5,
      paddingHorizontal: 3,

      marginTop: -4,
      marginBottom: 4,
    },

    forgotButtonText: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 13,
      fontWeight: "700",
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

    disabledButton: {
      opacity: 0.55,
    },

    buttonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "800",
    },

    accountPrompt: {
      width: "100%",

      alignItems: "center",

      marginTop: 19,
      marginBottom: -1,
    },

    accountPromptText: {
      color:
        "rgba(255,255,255,0.45)",

      fontSize: 13,
      lineHeight: 18,
    },

    backButton: {
      marginTop: 17,

      paddingVertical: 8,
      paddingHorizontal: 12,
    },

    backButtonText: {
      color:
        "rgba(255,255,255,0.42)",

      fontSize: 13,
      fontWeight: "700",
    },
  });