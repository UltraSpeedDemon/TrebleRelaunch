import React, {
  useEffect,
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

import Icon from "react-native-vector-icons/MaterialIcons";

import {
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
  authReady,
} from "../utils/firebase";

import colours from "../styles/colours";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword({
  route,
  navigation,
}) {
  const [
    email,
    setEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    const suppliedEmail =
      route?.params?.email ||
      auth.currentUser?.email ||
      "";

    setEmail(
      String(suppliedEmail)
        .trim()
        .toLowerCase()
    );
  }, [
    route?.params?.email,
  ]);

  const sendReset =
    async () => {
      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      if (
        !EMAIL_PATTERN.test(
          cleanEmail
        )
      ) {
        setError(
          "Enter a valid email address."
        );
        setMessage("");
        return;
      }

      setLoading(true);
      setError("");
      setMessage("");

      try {
        await authReady;

        await sendPasswordResetEmail(
          auth,
          cleanEmail,
          {
            url:
              "https://treblemusic.app/login",
            handleCodeInApp:
              false,
          }
        );

        /*
         * Use a neutral success message. This avoids exposing whether an
         * email is registered with Treble.
         */
        setMessage(
          "If this email can use Treble password login, Firebase has sent password-reset instructions. Check your inbox and junk folder."
        );
      } catch (resetError) {
        console.error(
          "[ForgotPassword] Reset error:",
          resetError
        );

        const code =
          String(
            resetError?.code || ""
          );

        if (
          code ===
          "auth/invalid-email"
        ) {
          setError(
            "Enter a valid email address."
          );
        } else if (
          code ===
          "auth/too-many-requests"
        ) {
          setError(
            "Too many reset attempts were made. Wait a little and try again."
          );
        } else if (
          code ===
          "auth/network-request-failed"
        ) {
          setError(
            "Unable to connect. Check your internet connection."
          );
        } else {
          setError(
            "Unable to send the reset email right now. Please try again."
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
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon
              name="lock-reset"
              size={34}
              color={
                colours.lightblue ||
                "#42bfee"
              }
            />
          </View>

          <Text style={styles.title}>
            Reset Password
          </Text>

          <Text style={styles.subtitle}>
            Firebase will send secure password-reset instructions to your email. Treble never displays or stores your password.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          {message ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                {message}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            Email Address
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError("");
              setMessage("");
            }}
            placeholder="Enter your email address"
            placeholderTextColor="rgba(255,255,255,0.38)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!loading}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={sendReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
              />
            ) : (
              <>
                <Icon
                  name="email"
                  size={19}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Send Reset Email
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Icon
              name="arrow-back"
              size={18}
              color="rgba(255,255,255,0.65)"
            />

            <Text style={styles.backText}>
              Back
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
        "#101010",
    },

    scrollContent: {
      flexGrow: 1,

      alignItems: "center",
      justifyContent: "center",

      padding: 20,
    },

    card: {
      width: "100%",
      maxWidth: 500,

      padding: 28,

      borderRadius: 24,

      backgroundColor:
        colours.darkblue ||
        "#222222",

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.12)",

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.34,
      shadowRadius: 22,

      elevation: 8,
    },

    iconCircle: {
      width: 68,
      height: 68,

      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",

      borderRadius: 34,

      backgroundColor:
        "rgba(66,191,238,0.10)",

      marginBottom: 16,
    },

    title: {
      color: "#ffffff",

      fontSize: 27,
      fontWeight: "900",

      textAlign: "center",
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.60)",

      fontSize: 13,
      lineHeight: 20,

      textAlign: "center",

      marginTop: 8,
      marginBottom: 22,
    },

    label: {
      color:
        "rgba(255,255,255,0.82)",

      fontSize: 12,
      fontWeight: "800",

      marginBottom: 7,
    },

    input: {
      width: "100%",
      height: 52,

      color: "#ffffff",

      paddingHorizontal: 14,

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.46)",

      borderRadius: 13,

      backgroundColor:
        "rgba(255,255,255,0.06)",

      fontSize: 14,

      outlineStyle: "none",
    },

    errorBox: {
      padding: 12,

      borderRadius: 11,

      backgroundColor:
        "rgba(255,76,76,0.11)",

      borderWidth: 1,
      borderColor:
        "rgba(255,76,76,0.40)",

      marginBottom: 15,
    },

    errorText: {
      color: "#ff8585",

      fontSize: 12,
      lineHeight: 17,

      textAlign: "center",
    },

    successBox: {
      padding: 12,

      borderRadius: 11,

      backgroundColor:
        "rgba(69,214,123,0.09)",

      borderWidth: 1,
      borderColor:
        "rgba(69,214,123,0.34)",

      marginBottom: 15,
    },

    successText: {
      color: "#68e598",

      fontSize: 12,
      lineHeight: 17,

      textAlign: "center",
    },

    primaryButton: {
      width: "100%",
      minHeight: 50,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      gap: 8,

      borderRadius: 25,

      backgroundColor:
        colours.lightblue ||
        "#42bfee",

      marginTop: 18,
    },

    primaryButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.58,
    },

    backButton: {
      alignSelf: "center",

      flexDirection: "row",
      alignItems: "center",

      gap: 6,

      marginTop: 20,
    },

    backText: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 13,
      fontWeight: "700",
    },
  });
