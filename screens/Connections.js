import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Icon from "react-native-vector-icons/MaterialIcons";

import * as AuthSession from "expo-auth-session";

import { auth } from "../utils/firebase";

import {
  getLinkedAuthProviders,
  linkGoogleToCurrentUser,
  linkPasswordToCurrentUser,
} from "../utils/googleAuth";

import {
  discovery,
  getSpotifyAuthRequestConfig,
  REDIRECT_URI,
  SPOTIFY_CLIENT_ID,
} from "../utils/spotifyAuth";

import {
  connectSpotify,
  disconnectSpotify,
  getUser,
} from "../providers/rest";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 820;

export default function Connections({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact =
    width < 600;

  const [username, setUsername] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [linkingSpotify, setLinkingSpotify] =
    useState(false);

  const [
    unlinkingSpotify,
    setUnlinkingSpotify,
  ] = useState(false);

  const [
    isSpotifyLinked,
    setIsSpotifyLinked,
  ] = useState(false);

  const [
    isGoogleLinked,
    setIsGoogleLinked,
  ] = useState(false);

  const [
    googleEmail,
    setGoogleEmail,
  ] = useState("");

  const [
    isPasswordLinked,
    setIsPasswordLinked,
  ] = useState(false);

  const [
    linkingGoogle,
    setLinkingGoogle,
  ] = useState(false);

  const [
    linkingPassword,
    setLinkingPassword,
  ] = useState(false);

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState("");

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmNewPassword,
    setShowConfirmNewPassword,
  ] = useState(false);

  const [
    spotifyBetaError,
    setSpotifyBetaError,
  ] = useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const spotifyConfigured =
    Boolean(
      SPOTIFY_CLIENT_ID &&
      REDIRECT_URI
    );

  /*
   * Spotify authorization request.
   */
  const [
    request,
    response,
    promptAsync,
  ] = AuthSession.useAuthRequest(
    getSpotifyAuthRequestConfig(),
    discovery
  );

  /*
   * Keep the sidebar permanently open on desktop.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  /*
   * Safely read a backend response.
   */
  const parseResponse =
    useCallback(
      async (
        backendResponse,
        fallbackMessage
      ) => {
        if (!backendResponse) {
          throw new Error(
            "The backend returned no response."
          );
        }

        const responseText =
          await backendResponse.text();

        let data = {};

        try {
          data = responseText
            ? JSON.parse(
                responseText
              )
            : {};
        } catch {
          data = {
            error:
              responseText ||
              "The backend returned an invalid response.",
          };
        }

        if (
          !backendResponse.ok
        ) {
          throw new Error(
            data?.error ||
              `${fallbackMessage} HTTP ${backendResponse.status}`
          );
        }

        return data;
      },
      []
    );

  /*
   * Load the current user's linked accounts.
   */
  const fetchUserData =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        navigation.navigate(
          "Home"
        );

        return;
      }

      try {
        setLoading(true);

        await currentUser.reload();

        const refreshedUser =
          auth.currentUser ||
          currentUser;

        const providers =
          getLinkedAuthProviders(
            refreshedUser
          );

        setIsGoogleLinked(
          providers.google
        );

        setIsPasswordLinked(
          providers.password
        );

        const googleProvider =
          refreshedUser.providerData?.find(
            (provider) =>
              provider?.providerId ===
              "google.com"
          );

        setGoogleEmail(
          googleProvider?.email ||
          refreshedUser.email ||
          ""
        );

        const orientResponse =
          await getUser(
            currentUser.uid
          );

        const userData =
          await parseResponse(
            orientResponse,
            "Unable to load connection information."
          );

        setUsername(
          userData?.username ||
            currentUser.displayName ||
            "Treble User"
        );

        const linked =
          userData?.spotifyIsLinked ===
            true ||
          userData?.spotifyIsLinked ===
            "true" ||
          userData?.spotifyIsLinked ===
            1;

        setIsSpotifyLinked(linked);

        if (linked) {
          setSpotifyBetaError(false);
        }
      } catch (error) {
        console.error(
          "[Connections] Load error:",
          error
        );

        Alert.alert(
          "Unable to load connections",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
      }
    }, [
      navigation,
      parseResponse,
    ]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  /*
   * Handle the Spotify authorization response.
   */
  useEffect(() => {
    const finishSpotifyLogin =
      async () => {
        if (
          response?.type !==
            "success" ||
          !response?.params?.code
        ) {
          if (
            response?.type ===
            "error"
          ) {
            setLinkingSpotify(
              false
            );

            Alert.alert(
              "Spotify connection failed",
              response?.error?.message ||
                "Spotify did not complete the connection."
            );
          }

          if (
            response?.type ===
              "dismiss" ||
            response?.type ===
              "cancel"
          ) {
            setLinkingSpotify(
              false
            );
          }

          return;
        }

        if (
          !request?.codeVerifier
        ) {
          setLinkingSpotify(false);

          Alert.alert(
            "Spotify connection failed",
            "The Spotify authorization request is missing its verification code."
          );

          return;
        }

        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setLinkingSpotify(false);

          navigation.navigate(
            "Home"
          );

          return;
        }

        try {
          setLinkingSpotify(true);

          const tokenResponse =
            await AuthSession.exchangeCodeAsync(
              {
                code:
                  response.params.code,

                clientId:
                  SPOTIFY_CLIENT_ID,

                redirectUri:
                  REDIRECT_URI,

                extraParams: {
                  code_verifier:
                    request.codeVerifier,
                },
              },
              discovery
            );

          const accessToken =
            tokenResponse?.accessToken;

          const refreshToken =
            tokenResponse?.refreshToken;

          if (!accessToken) {
            throw new Error(
              "Spotify did not return an access token."
            );
          }

          const updateResponse =
            await connectSpotify(
              currentUser.uid,
              {
                accessToken,

                refreshToken:
                  refreshToken ||
                  "",

                tokenType:
                  tokenResponse?.tokenType ||
                  "Bearer",

                expiresIn:
                  Number(
                    tokenResponse?.expiresIn ||
                    3600
                  ),

                issuedAt:
                  new Date().toISOString(),

                scope:
                  tokenResponse?.scope ||
                  "",
              }
            );

          await parseResponse(
            updateResponse,
            "Unable to save the Spotify connection."
          );

          setIsSpotifyLinked(
            true
          );

          Alert.alert(
            "Spotify connected",
            "Your Spotify account was connected successfully. The Spotify badge is now unlocked on your profile."
          );
        } catch (error) {
          console.error(
            "[Connections] Spotify connection error:",
            error
          );

          const message =
            String(
              error?.message || ""
            );

          const isDevelopmentAccessError =
            message.includes("403") ||
            message
              .toLowerCase()
              .includes(
                "spotify rejected the access token"
              ) ||
            message
              .toLowerCase()
              .includes(
                "not authorized"
              );

          if (
            isDevelopmentAccessError
          ) {
            setSpotifyBetaError(true);

            Alert.alert(
              "Spotify Beta Access",
              "Spotify connections are currently limited to approved Treble beta testers. Your Spotify account completed authorization, but Spotify blocked the final connection because this account is not on Treble's Spotify tester list."
            );
          } else {
            Alert.alert(
              "Spotify connection failed",
              message ||
                "Please try again."
            );
          }
        } finally {
          setLinkingSpotify(
            false
          );
        }
      };

    finishSpotifyLogin();
  }, [
    navigation,
    parseResponse,
    request,
    response,
  ]);

  /*
   * Start the Spotify login flow.
   */
  const handleSpotifyLogin =
    useCallback(async () => {
      if (
        isSpotifyLinked ||
        linkingSpotify ||
        unlinkingSpotify
      ) {
        return;
      }

      if (!spotifyConfigured) {
        Alert.alert(
          "Spotify is not configured",
          "Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID and EXPO_PUBLIC_SPOTIFY_REDIRECT_URI, then rebuild the app."
        );

        return;
      }

      if (!request) {
        Alert.alert(
          "Spotify is still loading",
          "Please wait a moment and try again."
        );

        return;
      }

      try {
        setSpotifyBetaError(false);
        setLinkingSpotify(true);

        const result =
          await promptAsync();

        if (
          result?.type ===
            "cancel" ||
          result?.type ===
            "dismiss"
        ) {
          setLinkingSpotify(
            false
          );
        }
      } catch (error) {
        console.error(
          "[Connections] Spotify login error:",
          error
        );

        setLinkingSpotify(false);

        Alert.alert(
          "Unable to open Spotify",
          error?.message ||
            "Please try again."
        );
      }
    }, [
      isSpotifyLinked,
      linkingSpotify,
      unlinkingSpotify,
      promptAsync,
      request,
      spotifyConfigured,
    ]);



  const performSpotifyUnlink =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (
        !currentUser?.uid ||
        unlinkingSpotify
      ) {
        return;
      }

      try {
        setUnlinkingSpotify(true);

        const response =
          await disconnectSpotify(
            currentUser.uid
          );

        await parseResponse(
          response,
          "Unable to unlink Spotify."
        );

        setIsSpotifyLinked(false);
        setSpotifyBetaError(false);

        /*
         * Read the user back from the backend to confirm Firestore was
         * updated. Profile.js and UserProfiles.js use spotifyIsLinked,
         * so setting it to false removes the Spotify badge.
         */
        await fetchUserData();

        Alert.alert(
          "Spotify unlinked",
          "Spotify was removed from your Treble account. The Spotify badge has also been removed."
        );
      } catch (error) {
        console.error(
          "[Connections] Spotify unlink error:",
          error
        );

        Alert.alert(
          "Unable to unlink Spotify",
          error?.message ||
            "Please try again."
        );
      } finally {
        setUnlinkingSpotify(false);
      }
    }, [
      fetchUserData,
      parseResponse,
      unlinkingSpotify,
    ]);

  const handleSpotifyButtonPress =
    useCallback(() => {
      if (!isSpotifyLinked) {
        handleSpotifyLogin();
        return;
      }

      const confirmationMessage =
        "This removes the Spotify connection and Spotify badge from your Treble profile.";

      /*
       * React Native Web's Alert implementation does not consistently
       * run custom button callbacks. Use the browser confirmation dialog
       * on web so pressing Unlink always calls the backend.
       */
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined"
      ) {
        const confirmed =
          window.confirm(
            `Unlink Spotify?\n\n${confirmationMessage}`
          );

        if (confirmed) {
          performSpotifyUnlink();
        }

        return;
      }

      Alert.alert(
        "Unlink Spotify?",
        confirmationMessage,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Unlink",
            style: "destructive",
            onPress:
              performSpotifyUnlink,
          },
        ]
      );
    }, [
      handleSpotifyLogin,
      isSpotifyLinked,
      performSpotifyUnlink,
    ]);

  const handleConnectGoogle =
    useCallback(async () => {
      if (
        isGoogleLinked ||
        linkingGoogle ||
        linkingPassword
      ) {
        return;
      }

      try {
        setLinkingGoogle(true);

        const user =
          await linkGoogleToCurrentUser();

        const providers =
          getLinkedAuthProviders(
            user
          );

        setIsGoogleLinked(
          providers.google
        );

        setIsPasswordLinked(
          providers.password
        );

        const googleProvider =
          user.providerData?.find(
            (provider) =>
              provider?.providerId ===
              "google.com"
          );

        setGoogleEmail(
          googleProvider?.email ||
          user.email ||
          ""
        );

        Alert.alert(
          "Google connected",
          "Google and your Treble email/password now open the same Treble account."
        );
      } catch (error) {
        console.error(
          "[Connections] Google linking error:",
          error
        );

        const code =
          String(
            error?.code || ""
          );

        let message =
          error?.message ||
          "Please try again.";

        if (
          code ===
          "auth/credential-already-in-use"
        ) {
          message =
            "That Google account is already attached to a different Firebase user. Sign in with that Google account first or use a different Google account.";
        } else if (
          code ===
          "auth/provider-already-linked"
        ) {
          message =
            "Google is already connected to this Treble account.";
        } else if (
          code ===
          "auth/requires-recent-login"
        ) {
          message =
            "For security, sign out and sign back in with your Treble password, then connect Google again.";
        } else if (
          code ===
          "auth/popup-closed-by-user"
        ) {
          message =
            "Google connection was cancelled.";
        }

        Alert.alert(
          "Unable to connect Google",
          message
        );
      } finally {
        setLinkingGoogle(false);
      }
    }, [
      isGoogleLinked,
      linkingGoogle,
      linkingPassword,
    ]);

  const handleAddTreblePassword =
    useCallback(async () => {
      if (
        isPasswordLinked ||
        linkingPassword ||
        linkingGoogle
      ) {
        return;
      }

      if (
        newPassword.length < 6
      ) {
        Alert.alert(
          "Password too short",
          "Your Treble password must be at least 6 characters."
        );
        return;
      }

      if (
        newPassword !==
        confirmNewPassword
      ) {
        Alert.alert(
          "Passwords do not match",
          "Enter the same password in both fields."
        );
        return;
      }

      try {
        setLinkingPassword(true);

        const user =
          await linkPasswordToCurrentUser(
            newPassword
          );

        const providers =
          getLinkedAuthProviders(
            user
          );

        setIsGoogleLinked(
          providers.google
        );

        setIsPasswordLinked(
          providers.password
        );

        setNewPassword("");
        setConfirmNewPassword("");

        Alert.alert(
          "Treble password added",
          "You can now sign in with Google or your email and Treble password. Both open the same account."
        );
      } catch (error) {
        console.error(
          "[Connections] Password linking error:",
          error
        );

        const code =
          String(
            error?.code || ""
          );

        let message =
          error?.message ||
          "Please try again.";

        if (
          code ===
          "auth/email-already-in-use"
        ) {
          message =
            "This email already belongs to another Firebase password account. The accounts must be resolved before they can be linked.";
        } else if (
          code ===
          "auth/provider-already-linked"
        ) {
          message =
            "Email and password login is already connected.";
        } else if (
          code ===
          "auth/requires-recent-login"
        ) {
          message =
            "For security, sign out and sign back in with Google, then add the password again.";
        } else if (
          code ===
          "auth/weak-password"
        ) {
          message =
            "Choose a stronger password with at least 6 characters.";
        }

        Alert.alert(
          "Unable to add password",
          message
        );
      } finally {
        setLinkingPassword(false);
      }
    }, [
      confirmNewPassword,
      isPasswordLinked,
      linkingGoogle,
      linkingPassword,
      newPassword,
    ]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator
          size="large"
          color={
            colours.lightblue
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading connections...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <View
        style={[
          styles.sideMenu,
          isDesktopWeb &&
            styles.desktopSideMenu,
          isMobileWeb &&
            styles.mobileSideMenu,
        ]}
        pointerEvents="box-none"
      >
        <Sidebar
          menuOpen={
            isDesktopWeb
              ? true
              : menuOpen
          }
          setMenuOpen={
            isDesktopWeb
              ? () => {}
              : setMenuOpen
          }
          isDesktop={
            isDesktopWeb
          }
        />
      </View>
      {(isDesktopWeb || !menuOpen) ? (
        <TouchableOpacity
          style={[
            styles.rootBackButton,
            isDesktopWeb &&
              styles.desktopRootBackButton,
          ]}
          onPress={() =>
            navigation.goBack()
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon
            name="arrow-back"
            size={26}
            color="#ffffff"
          />
        </TouchableOpacity>
      ) : null}


      {/* =====================================================
          PAGE CONTENT
      ===================================================== */}
      <View
        style={[
          styles.pageContent,
          isDesktopWeb &&
            styles.desktopPageContent,
          isMobileWeb &&
            styles.mobilePageContent,
        ]}
      >
        <ScrollView
          style={[
            styles.connectionsScroll,
            isWeb &&
              styles.webConnectionsScroll,
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb &&
              styles.desktopScrollContent,
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          {/* PAGE HEADER */}
          <View
            style={
              styles.pageHeader
            }
          >
            <Text
              style={
                styles.header
              }
            >
              Connections
            </Text>

            <Text
              style={
                styles.subHeader
              }
            >
              Manage your linked music accounts.
            </Text>

            {username ? (
              <Text
                style={
                  styles.usernameText
                }
              >
                Signed in as {username}
              </Text>
            ) : null}
          </View>

          {/* GOOGLE + TREBLE LOGIN */}
          <View
            style={[
              styles.connectionCard,
              styles.googleAccountCard,
              isCompact &&
                styles.compactConnectionCard,
            ]}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require(
                  "../images/Googleicon.png"
                )}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.connectionInfo}>
              <Text style={styles.connectionName}>
                Account Login Methods
              </Text>

              <View style={styles.providerStatusRow}>
                <View
                  style={[
                    styles.providerPill,
                    isGoogleLinked
                      ? styles.providerPillConnected
                      : styles.providerPillDisconnected,
                  ]}
                >
                  <Icon
                    name={
                      isGoogleLinked
                        ? "check-circle"
                        : "cancel"
                    }
                    size={16}
                    color={
                      isGoogleLinked
                        ? "#45d67b"
                        : "rgba(255,255,255,0.48)"
                    }
                  />

                  <Text
                    style={[
                      styles.providerPillText,
                      isGoogleLinked &&
                        styles.providerPillTextConnected,
                    ]}
                  >
                    Google
                  </Text>
                </View>

                <View
                  style={[
                    styles.providerPill,
                    isPasswordLinked
                      ? styles.providerPillConnected
                      : styles.providerPillDisconnected,
                  ]}
                >
                  <Icon
                    name={
                      isPasswordLinked
                        ? "check-circle"
                        : "cancel"
                    }
                    size={16}
                    color={
                      isPasswordLinked
                        ? "#45d67b"
                        : "rgba(255,255,255,0.48)"
                    }
                  />

                  <Text
                    style={[
                      styles.providerPillText,
                      isPasswordLinked &&
                        styles.providerPillTextConnected,
                    ]}
                  >
                    Email & Password
                  </Text>
                </View>
              </View>

              <Text style={styles.connectionDescription}>
                {isGoogleLinked &&
                isPasswordLinked
                  ? `Both login methods are connected${googleEmail ? ` to ${googleEmail}` : ""}. Either option opens this same Treble profile.`
                  : isGoogleLinked
                    ? `Google is connected${googleEmail ? ` to ${googleEmail}` : ""}. Add a Treble password below so both login methods work.`
                    : "Connect Google while signed in to attach it to this existing Treble profile."}
              </Text>

              {isGoogleLinked &&
              !isPasswordLinked ? (
                <View
                  style={
                    styles.passwordLinkSection
                  }
                >
                  <Text
                    style={
                      styles.passwordLinkTitle
                    }
                  >
                    Add Treble email/password login
                  </Text>

                  <Text
                    style={
                      styles.passwordLinkHelp
                    }
                  >
                    Your email will be {googleEmail || "your Google email"}.
                  </Text>

                  <View
                    style={
                      styles.passwordField
                    }
                  >
                    <TextInput
                      style={
                        styles.passwordFieldInput
                      }
                      value={newPassword}
                      onChangeText={
                        setNewPassword
                      }
                      placeholder="Create a Treble password"
                      placeholderTextColor="rgba(255,255,255,0.38)"
                      secureTextEntry={
                        !showNewPassword
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      editable={
                        !linkingPassword
                      }
                    />

                    <TouchableOpacity
                      style={
                        styles.passwordFieldToggle
                      }
                      onPress={() =>
                        setShowNewPassword(
                          (value) => !value
                        )
                      }
                    >
                      <Icon
                        name={
                          showNewPassword
                            ? "visibility"
                            : "visibility-off"
                        }
                        size={21}
                        color="rgba(255,255,255,0.62)"
                      />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={
                      styles.passwordField
                    }
                  >
                    <TextInput
                      style={
                        styles.passwordFieldInput
                      }
                      value={
                        confirmNewPassword
                      }
                      onChangeText={
                        setConfirmNewPassword
                      }
                      placeholder="Confirm Treble password"
                      placeholderTextColor="rgba(255,255,255,0.38)"
                      secureTextEntry={
                        !showConfirmNewPassword
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      editable={
                        !linkingPassword
                      }
                    />

                    <TouchableOpacity
                      style={
                        styles.passwordFieldToggle
                      }
                      onPress={() =>
                        setShowConfirmNewPassword(
                          (value) => !value
                        )
                      }
                    >
                      <Icon
                        name={
                          showConfirmNewPassword
                            ? "visibility"
                            : "visibility-off"
                        }
                        size={21}
                        color="rgba(255,255,255,0.62)"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            {!isGoogleLinked ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.connectButton,
                  linkingGoogle &&
                    styles.disabledButton,
                  isCompact &&
                    styles.compactButton,
                ]}
                onPress={
                  handleConnectGoogle
                }
                disabled={
                  linkingGoogle ||
                  linkingPassword
                }
              >
                {linkingGoogle ? (
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
                    Connect Google
                  </Text>
                )}
              </TouchableOpacity>
            ) : !isPasswordLinked ? (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.connectButton,
                  linkingPassword &&
                    styles.disabledButton,
                  isCompact &&
                    styles.compactButton,
                ]}
                onPress={
                  handleAddTreblePassword
                }
                disabled={
                  linkingPassword ||
                  linkingGoogle
                }
              >
                {linkingPassword ? (
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
                    Add Password
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.googleStatusButton,
                  styles.googleConnectedButton,
                  isCompact &&
                    styles.compactButton,
                ]}
              >
                <Icon
                  name="verified-user"
                  size={17}
                  color="#45d67b"
                />

                <Text
                  style={[
                    styles.googleStatusButtonText,
                    styles.googleConnectedButtonText,
                  ]}
                >
                  Both Connected
                </Text>
              </View>
            )}
          </View>

          {/* SPOTIFY */}
          <View
            style={[
              styles.connectionCard,
              isCompact &&
                styles.compactConnectionCard,
            ]}
          >
            <View
              style={
                styles.logoContainer
              }
            >
              <Image
                source={require(
                  "../images/spotifyLogo.png"
                )}
                style={styles.logo}
              />
            </View>

            <View
              style={
                styles.connectionInfo
              }
            >
              <Text
                style={
                  styles.connectionName
                }
              >
                Spotify
              </Text>

              <Text
                style={[
                  styles.connectionStatus,
                  isSpotifyLinked &&
                    styles.connectedStatus,
                ]}
              >
                {isSpotifyLinked
                  ? "Connected"
                  : "Not connected"}
              </Text>

              <Text
                style={
                  styles.connectionDescription
                }
              >
                Connect Spotify to improve music discovery and unlock the Spotify badge on your profile.
              </Text>

              {!isSpotifyLinked ? (
                <View
                  style={[
                    styles.spotifyBetaNotice,
                    spotifyBetaError &&
                      styles.spotifyBetaNoticeError,
                  ]}
                >
                  <View
                    style={
                      styles.spotifyBetaHeader
                    }
                  >
                    <Text
                      style={
                        styles.spotifyBetaBadge
                      }
                    >
                      BETA
                    </Text>

                    <Text
                      style={
                        styles.spotifyBetaTitle
                      }
                    >
                      Limited Spotify access
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.spotifyBetaText
                    }
                  >
                    Spotify connections are currently available only to approved Treble beta testers. Other users may complete Spotify authorization, but Spotify can block the final connection until their account is added to the tester list.
                  </Text>
                </View>
              ) : null}

              {!spotifyConfigured ? (
                <Text
                  style={
                    styles.configurationWarning
                  }
                >
                  Spotify environment variables are missing. Rebuild after adding them.
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                isSpotifyLinked
                  ? styles.unlinkButton
                  : styles.connectButton,
                (
                  linkingSpotify ||
                  unlinkingSpotify ||
                  !request ||
                  !spotifyConfigured
                ) &&
                  !isSpotifyLinked &&
                  styles.disabledButton,
                isCompact &&
                  styles.compactButton,
              ]}
              onPress={
                handleSpotifyButtonPress
              }
              disabled={
                linkingSpotify ||
                unlinkingSpotify ||
                (
                  !isSpotifyLinked &&
                  (
                    !request ||
                    !spotifyConfigured
                  )
                )
              }
            >
              {linkingSpotify ||
              unlinkingSpotify ? (
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
                  {isSpotifyLinked
                    ? "Unlink"
                    : !spotifyConfigured
                      ? "Setup Required"
                      : "Connect Beta"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* LAST.FM */}
          <View
            style={[
              styles.connectionCard,
              isCompact &&
                styles.compactConnectionCard,
            ]}
          >
            <View
              style={
                styles.logoContainer
              }
            >
              <Image
                source={require(
                  "../images/lastfmLogo.png"
                )}
                style={styles.logo}
              />
            </View>

            <View
              style={
                styles.connectionInfo
              }
            >
              <Text
                style={
                  styles.connectionName
                }
              >
                Last.fm
              </Text>

              <Text
                style={
                  styles.connectionStatus
                }
              >
                Coming soon
              </Text>

              <Text
                style={
                  styles.connectionDescription
                }
              >
                Last.fm support is coming soon to Treble.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.comingSoonButton,
                isCompact &&
                  styles.compactButton,
              ]}
              disabled
            >
              <Text
                style={
                  styles.comingSoonButtonText
                }
              >
                Coming Soon
              </Text>
            </TouchableOpacity>
          </View>

          {/* APPLE MUSIC */}
          <View
            style={[
              styles.connectionCard,
              isCompact &&
                styles.compactConnectionCard,
            ]}
          >
            <View
              style={
                styles.logoContainer
              }
            >
              <Image
                source={require(
                  "../images/appleMusicLogo.png"
                )}
                style={styles.logo}
              />
            </View>

            <View
              style={
                styles.connectionInfo
              }
            >
              <Text
                style={
                  styles.connectionName
                }
              >
                Apple Music
              </Text>

              <Text
                style={
                  styles.connectionStatus
                }
              >
                Coming soon
              </Text>

              <Text
                style={
                  styles.connectionDescription
                }
              >
                Apple Music support is coming soon to Treble.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                styles.comingSoonButton,
                isCompact &&
                  styles.compactButton,
              ]}
              disabled
            >
              <Text
                style={
                  styles.comingSoonButtonText
                }
              >
                Coming Soon
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb &&
            styles.desktopBottomNavBar,
        ]}
      >
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootBackButton: {
      position: "absolute",
      top: Platform.OS === "web" ? 18 : -22,
      left: 80,
      zIndex: 101,
      elevation: 31,
  
      width: 46,
      height: 46,
      borderRadius: 23,
  
      alignItems: "center",
      justifyContent: "center",
  
      backgroundColor: "rgba(255,255,255,0.07)",
      borderWidth: 0,
    },
  
    desktopRootBackButton: {
      top: 18,
      left: DESKTOP_SIDEBAR_WIDTH + 20,
    },

  /* =====================================================
     PAGE
  ===================================================== */

  container: {
    flex: 1,
    minHeight: 0,

    backgroundColor:
      colours.background,
  },

  webContainer: {
    width: "100%",
    height: "100vh",

    minHeight: 0,

    overflow: "hidden",
  },

  loader: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      colours.background,
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     SIDEBAR
  ===================================================== */

  sideMenu: {
    position: "absolute",

    top: 40,
    left: 0,
    bottom: 0,

    zIndex: 100,
    elevation: 20,
  },

  desktopSideMenu: {
    position: "fixed",

    top: 0,
    left: 0,
    right: undefined,
    bottom: 0,

    width:
      DESKTOP_SIDEBAR_WIDTH,

    height: "100vh",

    overflow: "hidden",

    zIndex: 100,
    elevation: 20,
  },

  mobileSideMenu: {
    position: "absolute",

    top: 40,
    left: 0,
    right: undefined,
    bottom: 0,

    zIndex: 100,
  },

  /* =====================================================
     CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",

    top: 0,
    left:
      DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 25,
    paddingHorizontal: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 70,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  connectionsScroll: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webConnectionsScroll: {
    height: "100%",

    overflowY: "auto",
    overflowX: "hidden",

    WebkitOverflowScrolling:
      "touch",

    overscrollBehaviorY:
      "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  scrollContent: {
    width: "100%",

    paddingBottom: 45,
  },

  desktopScrollContent: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",
  },

  /* =====================================================
     HEADER
  ===================================================== */

  pageHeader: {
    width: "100%",

    marginBottom: 22,
  },

  header: {
    color:
      colours.lightblue,

    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
  },

  subHeader: {
    color:
      "rgba(255,255,255,0.62)",

    fontSize: 15,
    lineHeight: 21,

    marginTop: 3,
  },

  usernameText: {
    color:
      "rgba(255,255,255,0.42)",

    fontSize: 12,

    marginTop: 7,
  },

  /* =====================================================
     CONNECTION CARDS
  ===================================================== */

  connectionCard: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    padding: 20,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,

    elevation: 3,
  },

  compactConnectionCard: {
    flexDirection: "column",
    alignItems: "flex-start",
  },

  logoContainer: {
    width: 64,
    height: 64,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 17,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  logo: {
    width: 45,
    height: 45,

    resizeMode: "contain",
  },

  connectionInfo: {
    flex: 1,
    minWidth: 0,

    paddingRight: 18,
  },

  connectionName: {
    color: "#ffffff",

    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },

  connectionStatus: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 13,
    fontWeight: "700",

    marginTop: 2,
  },

  connectedStatus: {
    color: "#45d67b",
  },

  spotifyBetaNotice: {
    width: "100%",

    marginTop: 10,
    padding: 11,

    borderRadius: 12,

    backgroundColor:
      "rgba(255,191,71,0.08)",

    borderWidth: 1,
    borderColor:
      "rgba(255,191,71,0.22)",
  },

  spotifyBetaNoticeError: {
    backgroundColor:
      "rgba(255,86,86,0.09)",

    borderColor:
      "rgba(255,86,86,0.32)",
  },

  spotifyBetaHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 6,
  },

  spotifyBetaBadge: {
    color: "#101010",

    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,

    paddingHorizontal: 7,
    paddingVertical: 3,

    borderRadius: 7,

    backgroundColor:
      "#ffbf47",

    marginRight: 8,
  },

  spotifyBetaTitle: {
    color: "#ffffff",

    fontSize: 12,
    fontWeight: "900",
  },

  spotifyBetaText: {
    color:
      "rgba(255,255,255,0.66)",

    fontSize: 11,
    lineHeight: 16,
  },

  configurationWarning: {
    color: "#ffbf47",

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",

    marginTop: 7,
  },

  connectionDescription: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 13,
    lineHeight: 18,

    marginTop: 6,
  },

  googleAccountCard: {
    alignItems: "flex-start",
  },

  providerStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",

    gap: 8,

    marginTop: 8,
  },

  providerPill: {
    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    minHeight: 30,

    paddingHorizontal: 10,

    borderRadius: 15,

    borderWidth: 1,
  },

  providerPillConnected: {
    backgroundColor:
      "rgba(69,214,123,0.09)",

    borderColor:
      "rgba(69,214,123,0.34)",
  },

  providerPillDisconnected: {
    backgroundColor:
      "rgba(255,255,255,0.04)",

    borderColor:
      "rgba(255,255,255,0.10)",
  },

  providerPillText: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 11,
    fontWeight: "800",
  },

  providerPillTextConnected: {
    color: "#45d67b",
  },

  passwordLinkSection: {
    width: "100%",

    marginTop: 15,
    padding: 14,

    borderRadius: 14,

    borderWidth: 1,
    borderColor:
      "rgba(66,191,238,0.22)",

    backgroundColor:
      "rgba(66,191,238,0.06)",
  },

  passwordLinkTitle: {
    color: "#ffffff",

    fontSize: 13,
    fontWeight: "900",
  },

  passwordLinkHelp: {
    color:
      "rgba(255,255,255,0.52)",

    fontSize: 11,
    lineHeight: 16,

    marginTop: 4,
    marginBottom: 10,
  },

  passwordField: {
    position: "relative",

    width: "100%",
    height: 46,

    flexDirection: "row",
    alignItems: "center",

    marginTop: 9,

    borderWidth: 1,
    borderColor:
      "rgba(66,191,238,0.36)",

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.05)",

    overflow: "hidden",
  },

  passwordFieldInput: {
    flex: 1,
    height: "100%",

    color: "#ffffff",

    paddingLeft: 13,
    paddingRight: 48,

    fontSize: 13,

    borderWidth: 0,
    outlineStyle: "none",

    backgroundColor:
      "transparent",
  },

  passwordFieldToggle: {
    position: "absolute",

    top: 0,
    right: 0,
    bottom: 0,

    width: 46,

    alignItems: "center",
    justifyContent: "center",
  },

  googleStatusButton: {
    minWidth: 132,
    minHeight: 44,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: 7,

    paddingHorizontal: 16,

    borderRadius: 22,

    borderWidth: 1,
  },

  googleConnectedButton: {
    backgroundColor:
      "rgba(69,214,123,0.10)",

    borderColor:
      "rgba(69,214,123,0.40)",
  },

  googleNotConnectedButton: {
    backgroundColor:
      "rgba(255,255,255,0.05)",

    borderColor:
      "rgba(255,255,255,0.12)",
  },

  googleStatusButtonText: {
    color:
      "rgba(255,255,255,0.62)",

    fontSize: 13,
    fontWeight: "800",
  },

  googleConnectedButtonText: {
    color: "#45d67b",
  },

  /* =====================================================
     BUTTONS
  ===================================================== */

  button: {
    minWidth: 112,
    minHeight: 44,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 18,

    borderRadius: 22,
  },

  compactButton: {
    width: "100%",

    marginTop: 17,
  },

  connectButton: {
    backgroundColor:
      colours.lightblue,
  },

  connectedButton: {
    backgroundColor:
      "rgba(69,214,123,0.22)",

    borderWidth: 1,
    borderColor:
      "rgba(69,214,123,0.55)",
  },

  unlinkButton: {
    backgroundColor:
      "rgba(255,86,86,0.14)",

    borderWidth: 1,
    borderColor:
      "rgba(255,86,86,0.48)",
  },

  comingSoonButton: {
    backgroundColor:
      "rgba(255,255,255,0.06)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
  },

  comingSoonButtonText: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 13,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "800",
  },

  /* =====================================================
     BOTTOM NAVIGATION
  ===================================================== */

  bottomNavBar: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 90,
  },

  desktopBottomNavBar: {
    left:
      DESKTOP_SIDEBAR_WIDTH,
    right: 0,
  },
});