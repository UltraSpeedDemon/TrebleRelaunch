import React, {
  useCallback,
  useRef,
} from "react";

import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import { Audio } from "expo-av";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 700;

export default function Error({
  message,
  onRetry,
  navigation,
  route,
}) {
  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const soundRef =
    useRef(null);

  const [
    menuOpen,
    setMenuOpen,
  ] = React.useState(false);

  const [
    retrying,
    setRetrying,
  ] = React.useState(false);

  const errorMessage =
    route?.params?.message ||
    message ||
    "An unexpected error occurred. Please try again.";

  /*
   * Play the error sound.
   */
  const playSound =
    useCallback(async () => {
      /*
       * Autoplay is frequently blocked by web browsers.
       * Avoid playing the sound automatically on web.
       */
      if (Platform.OS === "web") {
        return;
      }

      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();

          soundRef.current =
            null;
        }

        const {
          sound,
        } =
          await Audio.Sound.createAsync(
            require("../assets/Error.mp3"),
            {
              shouldPlay: true,
            }
          );

        soundRef.current =
          sound;
      } catch (error) {
        console.warn(
          "[ErrorScreen] Unable to play error sound:",
          error
        );
      }
    }, []);

  /*
   * Stop and unload the sound.
   */
  const stopSound =
    useCallback(async () => {
      if (!soundRef.current) {
        return;
      }

      try {
        await soundRef.current.stopAsync();
      } catch {
        // The sound may already be stopped.
      }

      try {
        await soundRef.current.unloadAsync();
      } catch {
        // The sound may already be unloaded.
      }

      soundRef.current =
        null;
    }, []);

  /*
   * Handle focus and cleanup.
   */
  useFocusEffect(
    useCallback(() => {
      playSound();

      return () => {
        stopSound();
      };
    }, [
      playSound,
      stopSound,
    ])
  );

  /*
   * Return to a safe screen.
   */
  const handleGoBack =
    useCallback(() => {
      if (
        navigation?.canGoBack?.()
      ) {
        navigation.goBack();

        return;
      }

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Feed",
          },
        ],
      });
    }, [navigation]);

  /*
   * Go directly to Feed.
   */
  const handleGoToFeed =
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

  /*
   * Retry the original action.
   */
  const handleRetry =
    useCallback(async () => {
      if (!onRetry || retrying) {
        return;
      }

      try {
        setRetrying(true);

        await onRetry();
      } catch (error) {
        console.error(
          "[ErrorScreen] Retry failed:",
          error
        );
      } finally {
        setRetrying(false);
      }
    }, [
      onRetry,
      retrying,
    ]);

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* Sidebar */}
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

      {/* Main content */}
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
            styles.scrollView,

            isWeb &&
              styles.webScrollView,
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
          <View
            style={
              styles.errorCard
            }
          >
            <Text
              style={
                styles.largeText
              }
            >
              Oops! Something went wrong.
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Treble encountered a problem while loading this page.
            </Text>

            <Image
              source={require(
                "../images/oiia-oiiaoiia.gif"
              )}
              style={styles.gif}
              resizeMode="contain"
            />

            <View
              style={
                styles.messageContainer
              }
            >
              <Text
                style={
                  styles.errorMessage
                }
              >
                {errorMessage}
              </Text>
            </View>

            <View
              style={
                styles.buttonContainer
              }
            >
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.primaryButton,
                ]}
                onPress={
                  handleGoToFeed
                }
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Go to Feed
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.secondaryButton,
                ]}
                onPress={
                  handleGoBack
                }
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Go Back
                </Text>
              </TouchableOpacity>

              {onRetry ? (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.retryButton,

                    retrying &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    handleRetry
                  }
                  disabled={
                    retrying
                  }
                >
                  {retrying ? (
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
                      Retry
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Bottom navigation */}
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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,

      backgroundColor:
        colours.background ||
        colours.bluegrey,
    },

    webContainer: {
      width: "100%",
      height: "100vh",

      overflow: "hidden",
    },

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
      bottom: 0,

      width:
        DESKTOP_SIDEBAR_WIDTH,

      height: "100vh",

      overflow: "hidden",

      zIndex: 100,
    },

    mobileSideMenu: {
      position: "absolute",

      top: 40,
      left: 0,
      bottom: 0,

      zIndex: 100,
    },

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

      paddingTop: 24,
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

      paddingTop: 72,
      paddingHorizontal: 12,

      overflow: "hidden",
    },

    scrollView: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webScrollView: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      scrollbarWidth:
        "none",

      msOverflowStyle:
        "none",
    },

    scrollContent: {
      flexGrow: 1,

      alignItems: "center",
      justifyContent:
        "center",

      width: "100%",

      paddingVertical: 30,
      paddingBottom: 50,
    },

    desktopScrollContent: {
      maxWidth:
        MAX_CONTENT_WIDTH,

      alignSelf: "center",
    },

    errorCard: {
      width: "100%",

      alignItems: "center",

      padding: 28,

      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 20,

      backgroundColor:
        colours.darkblue,

      shadowColor:
        "#000000",

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.18,
      shadowRadius: 12,

      elevation: 4,
    },

    largeText: {
      color:
        colours.lightblue,

      fontSize: 30,
      lineHeight: 38,

      fontWeight: "800",

      textAlign: "center",
    },

    subtitle: {
      color:
        "rgba(255,255,255,0.55)",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",

      marginTop: 6,
    },

    gif: {
      width: 210,
      height: 210,

      marginTop: 22,
      marginBottom: 18,
    },

    messageContainer: {
      width: "100%",

      padding: 15,

      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 12,

      backgroundColor:
        "rgba(255,255,255,0.04)",
    },

    errorMessage: {
      color:
        "rgba(255,255,255,0.78)",

      fontSize: 14,
      lineHeight: 21,

      textAlign: "center",
    },

    buttonContainer: {
      width: "100%",

      alignItems: "center",

      marginTop: 22,
    },

    button: {
      width: "100%",
      maxWidth: 360,

      minHeight: 48,

      alignItems: "center",
      justifyContent:
        "center",

      paddingHorizontal: 20,

      marginBottom: 10,

      borderRadius: 24,
    },

    primaryButton: {
      backgroundColor:
        colours.lightblue,
    },

    secondaryButton: {
      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.18)",

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    retryButton: {
      backgroundColor:
        "rgba(85,145,255,0.7)",
    },

    disabledButton: {
      opacity: 0.5,
    },

    buttonText: {
      color: "#ffffff",

      fontSize: 15,
      fontWeight: "800",
    },

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