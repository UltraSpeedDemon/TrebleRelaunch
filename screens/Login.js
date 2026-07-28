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

  if (
    Array.isArray(data?.users)
  ) {
    return data.users[0] || null;
  }

  if (
    Array.isArray(data?.results)
  ) {
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

      /*
       * Firebase password login requires an email.
       * When a username is entered, retrieve the
       * account email from the backend first.
       */
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

      /*
       * Reset prevents the user from being sent
       * back to Login or Error after signing in.
       */
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
      style={
        styles.container
      }
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
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
          <Text
            style={
              styles.largeText
            }
          >
            Login
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Welcome back to Treble
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

          <TextInput
            style={
              styles.input
            }
            placeholder="Username or Email"
            placeholderTextColor={
              colours.lightgrey ||
              "#9b9b9b"
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

          <TextInput
            style={
              styles.input
            }
            placeholder="Password"
            placeholderTextColor={
              colours.lightgrey ||
              "#9b9b9b"
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
            activeOpacity={0.8}
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
            activeOpacity={0.8}
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
              styles.forgotButton
            }
            onPress={() =>
              navigation.navigate(
                "ForgotPassword"
              )
            }
            disabled={loading}
          >
            <Text
              style={
                styles.forgotButtonText
              }
            >
              Forgot Password?
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

      backgroundColor:
        colours.background ||
        colours.bluegrey,
    },

    scrollContent: {
      flexGrow: 1,

      alignItems: "center",
      justifyContent:
        "center",

      padding: 20,
    },

    loginCard: {
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

    largeText: {
      color: "#ffffff",

      fontSize: 64,
      lineHeight: 74,

      fontFamily: "Lobster",

      textAlign: "center",
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 15,

      marginTop: 4,
      marginBottom: 26,

      textAlign: "center",
    },

    errorContainer: {
      width: "100%",

      padding: 12,
      marginBottom: 16,

      borderWidth: 1,
      borderColor:
        "rgba(255,75,75,0.45)",

      borderRadius: 10,

      backgroundColor:
        "rgba(255,50,50,0.1)",
    },

    error: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",
    },

    input: {
      width: "100%",
      height: 52,

      color: "#ffffff",
      backgroundColor:
        "rgba(255,255,255,0.055)",

      borderWidth: 1,
      borderColor:
        colours.secondaryblue,

      borderRadius: 12,

      marginBottom: 16,
      paddingHorizontal: 15,

      fontFamily: "Domine",
      fontSize: 16,

      outlineStyle: "none",
    },

    button: {
      width: "100%",
      height: 50,

      alignItems: "center",
      justifyContent:
        "center",

      borderRadius: 25,

      marginTop: 10,
    },

    primaryButton: {
      backgroundColor:
        colours.primaryblue,
    },

    registerButton: {
      borderWidth: 1,
      borderColor:
        colours.primaryblue,

      backgroundColor:
        "rgba(55,160,225,0.2)",
    },

    disabledButton: {
      opacity: 0.55,
    },

    buttonText: {
      color: "#ffffff",

      fontSize: 16,
      fontWeight: "800",
    },

    forgotButton: {
      marginTop: 22,
      padding: 10,
    },

    forgotButtonText: {
      color:
        colours.lightblue ||
        "#42bfee",

      fontSize: 15,
      fontWeight: "700",
    },
  });