import React, {
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
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
  signInWithEmailAndPassword,
} from "firebase/auth";

import { auth, authReady } from "../utils/firebase";
import { saveSession } from "../utils/session";
import { signInWithGoogle } from "../utils/googleAuth";
import colours from "../styles/colours";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value) {
  return EMAIL_PATTERN.test(
    String(value || "").trim()
  );
}

function getFriendlyLoginError(error) {
  const code =
    String(error?.code || "");

  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email address or password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please wait and try again.";

    case "auth/network-request-failed":
      return "Unable to connect to Firebase. Check your internet connection.";

    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";

    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow popups for Treble and try again.";

    case "auth/cancelled-popup-request":
      return "Another Google sign-in window is already open.";

    case "auth/unauthorized-domain":
      return "This Treble domain has not been authorized in Firebase yet.";

    case "auth/argument-error":
      return "Firebase Authentication was not initialized correctly. Replace utils/firebase.js with the fixed file in this ZIP, then redeploy.";

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
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  const authLoading =
    loading || googleLoading;

  const finishLogin = async (user) => {
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
  };

  const handleLogin = async () => {
    if (authLoading) {
      return;
    }

    const cleanEmail =
      identifier.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        "Enter your email address."
      );
      return;
    }

    if (!isEmail(cleanEmail)) {
      setError(
        "Please enter a valid email address."
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
      await authReady;

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      await finishLogin(
        userCredential.user
      );
    } catch (loginError) {
      console.error(
        "[Login] Email login failed:",
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

  const handleGoogleLogin = async () => {
    if (authLoading) {
      return;
    }

    if (Platform.OS !== "web") {
      setError(
        "Google sign-in is currently available on the Treble website and installed web app."
      );
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      const user =
        await signInWithGoogle();

      await finishLogin(user);
    } catch (googleError) {
      console.error(
        "[Login] Google login failed:",
        googleError
      );

      setError(
        getFriendlyLoginError(
          googleError
        )
      );
    } finally {
      setGoogleLoading(false);
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
              Email Address
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Enter your email address"
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
              textContentType="emailAddress"
              autoComplete="email"
              editable={!authLoading}
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

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={
                  colours.lightgrey ||
                  "#8c929c"
                }
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="current-password"
                editable={!authLoading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() =>
                  setShowPassword(
                    (currentValue) =>
                      !currentValue
                  )
                }
                disabled={authLoading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                <Icon
                  name={
                    showPassword
                      ? "visibility"
                      : "visibility-off"
                  }
                  size={24}
                  color="rgba(255,255,255,0.65)"
                />
              </TouchableOpacity>
            </View>
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
            disabled={authLoading}
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
            disabled={authLoading}
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

          <View style={styles.authDivider}>
            <View style={styles.authDividerLine} />
            <Text style={styles.authDividerText}>OR</Text>
            <View style={styles.authDividerLine} />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.googleButton,
              authLoading &&
                styles.disabledButton,
            ]}
            onPress={handleGoogleLogin}
            disabled={authLoading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Sign In with Google"
          >
            {googleLoading ? (
              <ActivityIndicator
                size="small"
                color="#202124"
              />
            ) : (
              <>
                <Image
                  source={require(
                    "../images/Googleicon.png"
                  )}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />

                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </>
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
            disabled={authLoading}
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
            disabled={authLoading}
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

    passwordInputContainer: {
  position: "relative",

  width: "100%",
  height: 52,

  flexDirection: "row",
  alignItems: "center",

  borderWidth: 1,
  borderColor:
    "rgba(66,191,238,0.48)",

  borderRadius: 13,

  backgroundColor:
    "rgba(255,255,255,0.05)",

  overflow: "hidden",
},

passwordInput: {
  flex: 1,
  height: "100%",

  color: "#ffffff",

  paddingLeft: 15,
  paddingRight: 52,

  fontFamily: "Domine",
  fontSize: 15,

  outlineStyle: "none",

  borderWidth: 0,
  backgroundColor: "transparent",
},

passwordToggle: {
  position: "absolute",

  right: 0,
  top: 0,
  bottom: 0,

  width: 52,

  alignItems: "center",
  justifyContent: "center",
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

    authDivider: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 17,
      marginBottom: 2,
    },

    authDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor:
        "rgba(255,255,255,0.11)",
    },

    authDividerText: {
      color:
        "rgba(255,255,255,0.42)",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginHorizontal: 12,
    },

    googleButton: {
      position: "relative",
      flexDirection: "row",
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#dadce0",
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.14,
      shadowRadius: 4,
      elevation: 3,
    },

    googleIcon: {
      position: "absolute",
      left: 18,
      width: 21,
      height: 21,
    },

    googleButtonText: {
      color: "#3c4043",
      fontSize: 15,
      fontWeight: "700",
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