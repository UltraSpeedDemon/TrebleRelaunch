import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

import { auth } from "../utils/firebase";

import {
  getUser,
  updateUser,
} from "../providers/rest";

import {
  signOut,
  updateProfile,
} from "firebase/auth";

import {
  deleteSession,
} from "../utils/session";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 760;

export default function Settings({
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

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [darkMode, setDarkMode] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  /*
   * Keep the desktop sidebar open.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  /*
   * Load the current user's settings.
   */
  const fetchUserData =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        navigation.navigate("Home");
        return;
      }

      try {
        setLoading(true);

        const response =
          await getUser(
            currentUser.uid
          );

        if (!response?.ok) {
          throw new Error(
            "Failed to fetch your account settings."
          );
        }

        const userData =
          await response.json();

        setUsername(
          userData?.username ||
            currentUser.displayName ||
            ""
        );

        setEmail(
          userData?.email ||
            currentUser.email ||
            ""
        );

        setDarkMode(
          Boolean(
            userData?.darkMode
          )
        );
      } catch (error) {
        console.error(
          "[Settings] Load error:",
          error
        );

        Alert.alert(
          "Unable to load settings",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
      }
    }, [navigation]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  /*
   * Save settings.
   */
  const handleSaveSettings =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        Alert.alert(
          "Not signed in",
          "Please sign in again."
        );

        navigation.navigate("Home");
        return;
      }

      const cleanedUsername =
        username.trim();

      if (!cleanedUsername) {
        Alert.alert(
          "Username required",
          "Please enter a username."
        );

        return;
      }

      try {
        setSaving(true);

        const payload = {
          username:
            cleanedUsername,

          darkMode:
            Boolean(darkMode),
        };

        const response =
          await updateUser(
            currentUser.uid,
            payload
          );

        if (!response) {
          throw new Error(
            "The backend returned no response."
          );
        }

        const responseText =
          await response.text();

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
              "Invalid backend response.",
          };
        }

        if (!response.ok) {
          if (
            response.status === 409
          ) {
            throw new Error(
              data?.error ||
                "That username is already being used."
            );
          }

          throw new Error(
            data?.error ||
              `Unable to save settings. HTTP ${response.status}`
          );
        }

        if (
          currentUser.displayName !==
          cleanedUsername
        ) {
          await updateProfile(
            currentUser,
            {
              displayName:
                cleanedUsername,
            }
          );
        }

        setUsername(
          cleanedUsername
        );

        Alert.alert(
          "Settings saved",
          "Your settings were updated successfully."
        );
      } catch (error) {
        console.error(
          "[Settings] Save error:",
          error
        );

        Alert.alert(
          "Unable to save settings",
          error?.message ||
            "Please try again."
        );
      } finally {
        setSaving(false);
      }
    }, [
      darkMode,
      navigation,
      username,
    ]);

  /*
   * Sign the user out.
   */
const performLogout =
  useCallback(async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      console.log(
        "[Settings] Logging out..."
      );

      /*
       * Sign out of Firebase Authentication.
       */
      await signOut(auth);

      /*
       * Remove the locally saved login session.
       */
      await deleteSession(
        "userUid"
      );

      /*
       * Reset navigation so the user cannot
       * press Back and return to Settings/Feed.
       */
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Home",
          },
        ],
      });

      console.log(
        "[Settings] Logout complete."
      );
    } catch (error) {
      console.error(
        "[Settings] Logout error:",
        error
      );

      const message =
        "Unable to log out. Please try again.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert(
          "Unable to log out",
          message
        );
      }
    } finally {
      setLoggingOut(false);
    }
  }, [
    loggingOut,
    navigation,
  ]);

const handleLogout =
  useCallback(() => {
    if (loggingOut) {
      return;
    }

    /*
     * Use the browser's confirmation dialog on web.
     * React Native Alert confirmation buttons are
     * not dependable in React Native Web.
     */
    if (Platform.OS === "web") {
      const confirmed =
        window.confirm(
          "Are you sure you want to log out?"
        );

      if (confirmed) {
        performLogout();
      }

      return;
    }

    Alert.alert(
      "Log Out?",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: performLogout,
        },
      ]
    );
  }, [
    loggingOut,
    performLogout,
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
          Loading settings...
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
            styles.settingsScroll,
            isWeb &&
              styles.webSettingsScroll,
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb &&
              styles.desktopScrollContent,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
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
              Settings
            </Text>

            <Text
              style={
                styles.subHeader
              }
            >
              Manage your account and application preferences.
            </Text>
          </View>

          {/* ACCOUNT INFORMATION */}
          <View
            style={
              styles.settingCard
            }
          >
            <View
              style={
                styles.cardHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.cardTitle
                  }
                >
                  Account
                </Text>

                <Text
                  style={
                    styles.cardDescription
                  }
                >
                  Your Treble account information
                </Text>
              </View>
            </View>

            <View
              style={
                styles.accountInformation
              }
            >
              <View
                style={
                  styles.accountRow
                }
              >
                <Text
                  style={
                    styles.accountLabel
                  }
                >
                  Username
                </Text>

                <Text
                  style={
                    styles.accountValue
                  }
                  numberOfLines={1}
                >
                  {username ||
                    "Not set"}
                </Text>
              </View>

              <View
                style={
                  styles.accountDivider
                }
              />

              <View
                style={
                  styles.accountRow
                }
              >
                <Text
                  style={
                    styles.accountLabel
                  }
                >
                  Email
                </Text>

                <Text
                  style={
                    styles.accountValue
                  }
                  numberOfLines={1}
                >
                  {email ||
                    "Not available"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={
                styles.editProfileButton
              }
              onPress={() =>
                navigation.navigate(
                  "EditProfile"
                )
              }
            >
              <Text
                style={
                  styles.editProfileButtonText
                }
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>

          {/* APPEARANCE */}
          <View
            style={
              styles.settingCard
            }
          >
            <View
              style={[
                styles.settingRow,
                isCompact &&
                  styles.compactSettingRow,
              ]}
            >
              <View
                style={
                  styles.settingTextContainer
                }
              >
                <Text
                  style={
                    styles.settingLabel
                  }
                >
                  Dark Mode
                </Text>

                <Text
                  style={
                    styles.settingDescription
                  }
                >
                  Use a darker appearance throughout the application.
                </Text>
              </View>

              <Switch
                value={darkMode}
                onValueChange={
                  setDarkMode
                }
                trackColor={{
                  false:
                    "rgba(255,255,255,0.18)",
                  true:
                    colours.lightblue,
                }}
                thumbColor="#ffffff"
                ios_backgroundColor="rgba(255,255,255,0.18)"
              />
            </View>
          </View>

          {/* SAVE SETTINGS */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving &&
                styles.disabledButton,
            ]}
            onPress={
              handleSaveSettings
            }
            disabled={saving}
          >
            {saving ? (
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
                Save Settings
              </Text>
            )}
          </TouchableOpacity>

          {/* LOGOUT */}
          <View
            style={[
              styles.settingCard,
              styles.dangerCard,
            ]}
          >
            <View
              style={
                styles.dangerContent
              }
            >
              <View
                style={
                  styles.dangerTextContainer
                }
              >
                <Text
                  style={
                    styles.dangerTitle
                  }
                >
                  Log Out
                </Text>

                <Text
                  style={
                    styles.dangerDescription
                  }
                >
                  Sign out of your Treble account on this device.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  loggingOut &&
                    styles.disabledButton,
                ]}
                onPress={
                  handleLogout
                }
                disabled={
                  loggingOut
                }
              >
                {loggingOut ? (
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
                    Logout
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* =====================================================
          BOTTOM NAVIGATION — MOBILE AND DESKTOP
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
      "rgba(255,255,255,0.7)",

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
     PAGE CONTENT
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    paddingBottom:
      BOTTOM_NAV_HEIGHT,

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

    minHeight: 0,

    paddingTop: 70,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  settingsScroll: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webSettingsScroll: {
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

    marginBottom: 20,
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

  /* =====================================================
     SETTING CARDS
  ===================================================== */

  settingCard: {
    width: "100%",

    padding: 20,
    marginBottom: 16,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 17,

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.14,
    shadowRadius: 9,

    elevation: 3,
  },

  cardHeader: {
    width: "100%",

    marginBottom: 16,
  },

  cardTitle: {
    color: "#ffffff",

    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },

  cardDescription: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 13,
    lineHeight: 18,

    marginTop: 3,
  },

  /* =====================================================
     ACCOUNT
  ===================================================== */

  accountInformation: {
    width: "100%",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.07)",

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  accountRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",

    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  accountLabel: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 13,
    fontWeight: "600",
  },

  accountValue: {
    flex: 1,

    color: "#ffffff",

    fontSize: 14,
    fontWeight: "700",

    textAlign: "right",

    marginLeft: 16,
  },

  accountDivider: {
    width: "100%",
    height: 1,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  editProfileButton: {
    minHeight: 43,

    alignItems: "center",
    justifyContent: "center",

    marginTop: 15,

    paddingHorizontal: 18,

    borderRadius: 22,

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  editProfileButtonText: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "800",
  },

  /* =====================================================
     DARK MODE
  ===================================================== */

  settingRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  compactSettingRow: {
    alignItems: "flex-start",
  },

  settingTextContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 20,
  },

  settingLabel: {
    color: "#ffffff",

    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  settingDescription: {
    color:
      "rgba(255,255,255,0.52)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 3,
  },

  /* =====================================================
     BUTTONS
  ===================================================== */

  saveButton: {
    width: "100%",
    minHeight: 49,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    marginBottom: 16,

    borderRadius: 25,

    backgroundColor:
      colours.lightblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 7,

    elevation: 3,
  },

  buttonText: {
    color: "#ffffff",

    fontSize: 15,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.5,
  },

  /* =====================================================
     LOGOUT
  ===================================================== */

  dangerCard: {
    borderColor:
      "rgba(255,70,70,0.24)",
  },

  dangerContent: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  dangerTextContainer: {
    flex: 1,
    minWidth: 0,

    paddingRight: 18,
  },

  dangerTitle: {
    color: "#ff6b6b",

    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  dangerDescription: {
    color:
      "rgba(255,255,255,0.5)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 3,
  },

  logoutButton: {
    minWidth: 100,
    minHeight: 43,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 18,

    borderRadius: 22,

    backgroundColor:
      "#d94343",
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