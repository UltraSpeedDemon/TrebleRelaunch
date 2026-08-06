import React, {
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
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
import Icon from "react-native-vector-icons/MaterialIcons";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";

import { auth, authReady } from "../utils/firebase";

import {
  createUser,
  getUserByUsername,
} from "../providers/rest";

import {
  saveSession,
} from "../utils/session";

import colours from "../styles/colours";
import { signInWithGoogle } from "../utils/googleAuth";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function responseContainsUser(data) {
  if (Array.isArray(data)) {
    return data.length > 0;
  }

  if (Array.isArray(data?.users)) {
    return data.users.length > 0;
  }

  if (Array.isArray(data?.results)) {
    return data.results.length > 0;
  }

  return Boolean(data?.user);
}

function getRegisterError(error) {
  const code =
    String(error?.code || "");

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Your password is too weak. Use at least 6 characters.";

    case "auth/network-request-failed":
      return "Unable to connect. Check your internet connection.";

    case "auth/operation-not-allowed":
      return "Email and password registration is not enabled in Firebase.";

    case "auth/too-many-requests":
      return "Too many registration attempts were made. Please wait and try again.";

    case "auth/popup-closed-by-user":
      return "Google registration was cancelled.";

    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow popups for Treble and try again.";

    case "auth/unauthorized-domain":
      return "This Treble domain has not been authorized in Firebase yet.";

    case "auth/argument-error":
      return "Firebase Authentication was not initialized correctly.";

    default:
      return (
        error?.message ||
        "Unable to create your account."
      );
  }
}

export default function Register({
  navigation,
}) {
  const [
    username,
    setUsername,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

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

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const clearError = () => {
    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleGoogleRegister =
    async () => {
      if (authLoading) {
        return;
      }

      if (Platform.OS !== "web") {
        setErrorMessage(
          "Google registration is currently available on the Treble website and installed web app."
        );
        return;
      }

      setGoogleLoading(true);
      setErrorMessage("");

      try {
        await authReady;

        const user =
          await signInWithGoogle();

        if (!user?.uid) {
          throw new Error(
            "Firebase did not return a valid Google account."
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
      } catch (googleError) {
        console.error(
          "[Register] Google registration failed:",
          googleError
        );

        const finalMessage =
          getRegisterError(
            googleError
          );

        setErrorMessage(
          finalMessage
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Google registration failed",
            finalMessage
          );
        }
      } finally {
        setGoogleLoading(false);
      }
    };

  const handleRegister =
    async () => {
      if (authLoading) {
        return;
      }

      const cleanUsername =
        username.trim();

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      setErrorMessage("");

      if (
        !cleanUsername ||
        !cleanEmail ||
        !password ||
        !confirmPassword
      ) {
        setErrorMessage(
          "Please fill out every field."
        );

        return;
      }

      if (
        cleanUsername.length < 3
      ) {
        setErrorMessage(
          "Username must be at least 3 characters."
        );

        return;
      }

      if (
        !/^[a-z0-9._-]+$/i.test(
          cleanUsername
        )
      ) {
        setErrorMessage(
          "Username can only contain letters, numbers, periods, underscores, and hyphens."
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

      if (password.length < 6) {
        setErrorMessage(
          "Password must be at least 6 characters."
        );

        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setErrorMessage(
          "Passwords do not match."
        );

        return;
      }

      setLoading(true);

      let createdFirebaseUser =
        null;

      try {
        await authReady;

        const lookupResponse =
          await getUserByUsername(
            cleanUsername
          );

        if (lookupResponse?.ok) {
          const lookupData =
            await readResponse(
              lookupResponse
            );

          if (
            responseContainsUser(
              lookupData
            )
          ) {
            throw new Error(
              "That username is already taken."
            );
          }
        } else if (
          lookupResponse &&
          lookupResponse.status !== 404
        ) {
          await readResponse(
            lookupResponse
          );
        }

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            cleanEmail,
            password
          );

        createdFirebaseUser =
          userCredential?.user;

        if (
          !createdFirebaseUser?.uid
        ) {
          throw new Error(
            "Firebase did not return a valid user account."
          );
        }

        const firebaseUid =
          createdFirebaseUser.uid;

        console.log(
          "[Register] Firebase account created:",
          firebaseUid
        );

        await updateProfile(
          createdFirebaseUser,
          {
            displayName:
              cleanUsername,
          }
        );

        const payload = {
          firebaseUid,

          userId:
            firebaseUid,

          uid:
            firebaseUid,

          username:
            cleanUsername,

          email:
            cleanEmail,

          avatar:
            null,

          isPublic:
            true,

          spotifyAccessToken:
            "",

          spotifyIsLinked:
            false,

          spotifyRefreshToken:
            "",

          createdAt:
            new Date().toISOString(),
        };

        console.log(
          "[Register] Creating backend user:",
          payload
        );

        const response =
          await createUser(
            payload
          );

        const data =
          await readResponse(
            response
          );

        console.log(
          "[Register] Backend user created:",
          data
        );

        await saveSession(
          "userUid",
          firebaseUid
        );

        navigation.reset({
          index: 0,
          routes: [
            {
              name: "Feed",
            },
          ],
        });
      } catch (registerError) {
        console.error(
          "[Register] Registration failed:",
          registerError
        );

        if (createdFirebaseUser) {
          try {
            await deleteUser(
              createdFirebaseUser
            );

            console.log(
              "[Register] Incomplete Firebase user removed."
            );
          } catch (deleteError) {
            console.warn(
              "[Register] Could not remove incomplete Firebase user:",
              deleteError
            );
          }
        }

        const finalMessage =
          getRegisterError(
            registerError
          );

        setErrorMessage(
          finalMessage
        );

        if (
          Platform.OS !== "web"
        ) {
          Alert.alert(
            "Registration failed",
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
            styles.registerCard
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
            Create Your Account
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Join Treble to discover music,
            write reviews, and connect with
            other listeners.
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
              Username
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Choose a username"
              placeholderTextColor={
                colours.lightgrey ||
                "#8c929c"
              }
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                clearError();
              }}
              autoCapitalize="words"
              spellCheck={false}
              autoCorrect={false}
              autoComplete="username-new"
              textContentType="username"
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
                styles.label
              }
            >
              Email
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
                clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
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
                styles.label
              }
            >
              Password
            </Text>

            <View style={styles.passwordInputContainer}>
  <TextInput
    style={styles.passwordInput}
    placeholder="Create a password"
    placeholderTextColor={
      colours.lightgrey ||
      "#8c929c"
    }
    secureTextEntry={!showPassword}
    value={password}
    onChangeText={(value) => {
      setPassword(value);
      clearError();
    }}
    autoCapitalize="none"
    autoCorrect={false}
    autoComplete="new-password"
    textContentType="newPassword"
    editable={!authLoading}
    returnKeyType="next"
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

            <Text
              style={
                styles.passwordHint
              }
            >
              Use at least 6 characters.
            </Text>
          </View>

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
              Confirm Password
            </Text>

            <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Re-enter your password"
              placeholderTextColor={
                colours.lightgrey ||
                "#8c929c"
              }
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                clearError();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!authLoading}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() =>
                setShowConfirmPassword(
                  (currentValue) =>
                    !currentValue
                )
              }
              disabled={authLoading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                showConfirmPassword
                  ? "Hide confirmed password"
                  : "Show confirmed password"
              }
            >
              <Icon
                name={
                  showConfirmPassword
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
            style={[
              styles.button,
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={
              handleRegister
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
                Create Account
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
            onPress={handleGoogleRegister}
            disabled={authLoading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Sign Up with Google"
          >
            {googleLoading ? (
              <ActivityIndicator
                size="small"
                color="#3c4043"
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
                  Sign Up with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.googleUsernameNote}>
            We’ll create a unique public Treble username. You can change it later in Edit Profile.
          </Text>

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
              Already have an account?
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.loginButton,
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
            disabled={authLoading}
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
            disabled={authLoading}
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

    registerCard: {
      position: "relative",

      width: "100%",
      maxWidth: 490,

      paddingTop: 36,
      paddingBottom: 30,
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
      width: 62,
      height: 62,

      alignSelf: "center",

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 1,
      borderColor:
        "rgba(66,191,238,0.48)",

      borderRadius: 31,

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

      fontSize: 33,
      lineHeight: 38,
      fontWeight: "800",
    },

    brandText: {
      color: "#ffffff",

      fontSize: 50,
      lineHeight: 60,

      fontFamily: "Lobster",

      textAlign: "center",

      marginTop: 5,
    },

    title: {
      color: "#ffffff",

      fontSize: 24,
      lineHeight: 31,
      fontWeight: "800",

      marginTop: 2,

      textAlign: "center",
    },

    subtitle: {
      width: "100%",
      maxWidth: 350,

      alignSelf: "center",

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

    errorText: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",
    },

    formGroup: {
      width: "100%",

      marginBottom: 14,
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

    passwordHint: {
      color:
        "rgba(255,255,255,0.4)",

      fontSize: 11,
      lineHeight: 16,

      marginTop: 5,
      marginLeft: 4,
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

    loginButton: {
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

    googleUsernameNote: {
      color:
        "rgba(255,255,255,0.42)",
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 9,
      paddingHorizontal: 12,
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
      alignSelf: "center",

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