import React, {
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
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
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth } from "../utils/firebase";
import colours from "../styles/colours";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getResetError(error) {
  const code = String(
    error?.code || ""
  );

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-not-found":
      return "No account was found with that email address.";

    case "auth/missing-email":
      return "Please enter your email address.";

    case "auth/too-many-requests":
      return "Too many reset attempts were made. Please wait and try again.";

    case "auth/network-request-failed":
      return "Unable to connect. Check your internet connection.";

    case "auth/operation-not-allowed":
      return "Password reset is not enabled for this project.";

    default:
      return (
        error?.message ||
        "Unable to send the password reset email."
      );
  }
}

export default function ForgotPassword({
  navigation,
}) {
  const [email, setEmail] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const handleResetPassword =
    async () => {
      if (loading) {
        return;
      }

      const cleanEmail =
        email.trim().toLowerCase();

      setErrorMessage("");
      setSuccessMessage("");

      if (!cleanEmail) {
        setErrorMessage(
          "Please enter your email address."
        );

        return;
      }

      if (
        !EMAIL_PATTERN.test(cleanEmail)
      ) {
        setErrorMessage(
          "Please enter a valid email address."
        );

        return;
      }

      setLoading(true);

      try {
        auth.useDeviceLanguage();

        await sendPasswordResetEmail(
          auth,
          cleanEmail
        );

        const message =
          "Password reset email sent. Check your inbox and spam folder.";

        setSuccessMessage(message);

        if (Platform.OS !== "web") {
          Alert.alert(
            "Reset email sent",
            message,
            [
              {
                text: "Back to Login",
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name: "Login",
                      },
                    ],
                  });
                },
              },
            ]
          );

          return;
        }

        /*
         * Keep the success message visible briefly
         * before returning to Login on web.
         */
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: "Login",
              },
            ],
          });
        }, 1800);
      } catch (resetError) {
        console.error(
          "[ForgotPassword] Reset failed:",
          resetError
        );

        const finalMessage =
          getResetError(resetError);

        setErrorMessage(finalMessage);

        if (Platform.OS !== "web") {
          Alert.alert(
            "Password reset failed",
            finalMessage
          );
        }
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
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.card}>
          <Text style={styles.largeText}>
            Forgot Password?
          </Text>

          <Text style={styles.subtitle}>
            Enter your email and we will send
            you a password reset link.
          </Text>

          {errorMessage ? (
            <View
              style={
                styles.errorContainer
              }
            >
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              style={
                styles.successContainer
              }
            >
              <Text
                style={styles.successText}
              >
                {successMessage}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={
              colours.lightgrey ||
              "#9b9b9b"
            }
            value={email}
            onChangeText={(value) => {
              setEmail(value);

              if (errorMessage) {
                setErrorMessage("");
              }

              if (successMessage) {
                setSuccessMessage("");
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!loading}
            returnKeyType="send"
            onSubmitEditing={
              handleResetPassword
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
              handleResetPassword
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
                style={styles.buttonText}
              >
                Send Reset Link
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.backButton,
            ]}
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: "Login",
                  },
                ],
              });
            }}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text
              style={styles.buttonText}
            >
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor:
      colours.background ||
      colours.bluegrey,
  },

  scrollContent: {
    flexGrow: 1,

    alignItems: "center",
    justifyContent: "center",

    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 460,

    paddingVertical: 34,
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

    fontSize: 48,
    lineHeight: 58,

    fontFamily: "Lobster",

    textAlign: "center",
  },

  subtitle: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 15,
    lineHeight: 21,

    marginTop: 8,
    marginBottom: 24,

    textAlign: "center",
  },

  label: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "700",

    marginBottom: 7,
  },

  input: {
    width: "100%",
    height: 52,

    color: "#ffffff",

    borderWidth: 1,
    borderColor:
      colours.secondaryblue,

    borderRadius: 12,

    marginBottom: 17,
    paddingHorizontal: 15,

    fontFamily: "Domine",
    fontSize: 16,

    backgroundColor:
      "rgba(255,255,255,0.055)",

    outlineStyle: "none",
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

  errorText: {
    color: "#ff7777",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",
  },

  successContainer: {
    width: "100%",

    padding: 12,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(80,220,130,0.5)",

    borderRadius: 10,

    backgroundColor:
      "rgba(70,200,120,0.12)",
  },

  successText: {
    color: "#7ee2a8",

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
      colours.primaryblue,
  },

  backButton: {
    borderWidth: 1,
    borderColor:
      colours.secondaryblue,

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
});