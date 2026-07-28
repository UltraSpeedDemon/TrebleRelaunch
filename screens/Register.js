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
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";

import { auth } from "../utils/firebase";

import {
  createUser,
  getUserByUsername,
} from "../providers/rest";

import {
  saveSession,
} from "../utils/session";

import colours from "../styles/colours";

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
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const clearError = () => {
    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleRegister =
    async () => {
      if (loading) {
        return;
      }

      const cleanUsername =
        username
          .trim()
          .toLowerCase();

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
        !/^[a-z0-9._-]+$/.test(
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
        /*
         * Check the backend for an existing
         * username before creating Firebase auth.
         */
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

        /*
         * Create the Firebase Authentication user.
         * Firebase automatically signs in the
         * newly created account.
         */
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

        /*
         * Send all common UID field names so this
         * remains compatible with the current backend.
         *
         * The important required field is:
         * firebaseUid
         */
        const payload = {
          firebaseUid,

          userId: firebaseUid,

          uid: firebaseUid,

          username:
            cleanUsername,

          email:
            cleanEmail,

          avatar: null,

          isPublic: true,

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

        /*
         * Delete the Firebase account if Firebase
         * succeeded but backend profile creation failed.
         */
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
          <Text
            style={
              styles.largeText
            }
          >
            Register
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Create your Treble account
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
            placeholder="Enter your username"
            placeholderTextColor={
              colours.lightgrey ||
              "#9b9b9b"
            }
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            textContentType="username"
            editable={!loading}
            returnKeyType="next"
          />

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
              "#9b9b9b"
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
            editable={!loading}
            returnKeyType="next"
          />

          <Text
            style={
              styles.label
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
              "#9b9b9b"
            }
            secureTextEntry
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            returnKeyType="next"
          />

          <Text
            style={
              styles.label
            }
          >
            Confirm Password
          </Text>

          <TextInput
            style={
              styles.input
            }
            placeholder="Re-enter your password"
            placeholderTextColor={
              colours.lightgrey ||
              "#9b9b9b"
            }
            secureTextEntry
            value={
              confirmPassword
            }
            onChangeText={(value) => {
              setConfirmPassword(
                value
              );

              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={
              handleRegister
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
              handleRegister
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
                Create Account
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
              style={
                styles.buttonText
              }
            >
              Back to Login
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

    registerCard: {
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

      fontSize: 60,
      lineHeight: 70,

      fontFamily: "Lobster",

      textAlign: "center",
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 15,

      marginTop: 4,
      marginBottom: 24,

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

    errorText: {
      color: "#ff7777",

      fontSize: 14,
      lineHeight: 20,

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