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
  const code =
    String(error?.code || "");

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
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const handleResetPassword =
    async () => {
      if (loading) {
        return;
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      setErrorMessage("");
      setSuccessMessage("");

      if (!cleanEmail) {
        setErrorMessage(
          "Please enter your email address."
        );

        return;
      }

      if (
        !EMAIL_PATTERN.test(
          cleanEmail
        )
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

        setSuccessMessage(
          message
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Reset email sent",
            message,
            [
              {
                text:
                  "Back to Login",

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
          getResetError(
            resetError
          );

        setErrorMessage(
          finalMessage
        );

        if (
          Platform.OS !== "web"
        ) {
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
      style={
        styles.container
      }
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
            styles.card
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
            Forgot Your Password?
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Enter the email connected to your
            Treble account and we will send you
            a secure password reset link.
          </Text>

          {errorMessage ? (
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
                style={
                  styles.successIcon
                }
              >
                ✓
              </Text>

              <Text
                style={
                  styles.successText
                }
              >
                {successMessage}
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
                styles.label
              }
            >
              Email Address
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Enter your email"
              placeholderTextColor={
                colours.lightgrey ||
                "#8c929c"
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
          </View>

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
                Send Reset Link
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={
              styles.loginPrompt
            }
          >
            <Text
              style={
                styles.loginPromptText
              }
            >
              Remembered your password?
            </Text>
          </View>

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
            activeOpacity={0.82}
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Back to Login
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.homeButton
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
                styles.homeButtonText
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

    card: {
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
      maxWidth: 350,

      color:
        "rgba(255,255,255,0.58)",

      fontSize: 14,
      lineHeight: 21,

      marginTop: 8,
      marginBottom: 23,

      textAlign: "center",
    },

    formGroup: {
      width: "100%",

      marginBottom: 5,
    },

    label: {
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

    errorText: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",
    },

    successContainer: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 12,
      marginBottom: 16,

      borderWidth: 1,
      borderColor:
        "rgba(80,220,130,0.5)",

      borderRadius: 11,

      backgroundColor:
        "rgba(70,200,120,0.12)",
    },

    successIcon: {
      color: "#7ee2a8",

      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",

      marginRight: 9,
    },

    successText: {
      flex: 1,

      color: "#7ee2a8",

      fontSize: 14,
      lineHeight: 20,
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

    backButton: {
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

    loginPrompt: {
      width: "100%",

      alignItems: "center",

      marginTop: 19,
      marginBottom: -1,
    },

    loginPromptText: {
      color:
        "rgba(255,255,255,0.45)",

      fontSize: 13,
      lineHeight: 18,
    },

    homeButton: {
      marginTop: 17,

      paddingVertical: 8,
      paddingHorizontal: 12,
    },

    homeButtonText: {
      color:
        "rgba(255,255,255,0.42)",

      fontSize: 13,
      fontWeight: "700",
    },
  });