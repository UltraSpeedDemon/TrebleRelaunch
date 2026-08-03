import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getFollowRequests,
  getNotifications,
  getUser,
} from "../providers/rest";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import Icon from "react-native-vector-icons/MaterialIcons";

import { auth } from "../utils/firebase";
import { deleteSession } from "../utils/session";
import colours from "../styles/colours";

const DESKTOP_SIDEBAR_WIDTH = 280;
const MOBILE_SIDEBAR_MAX_WIDTH = 300;
const MOBILE_BREAKPOINT = 768;

/*
 * Notification badge optimization.
 *
 * Sidebar is mounted on many screens, so a module-level cache prevents
 * each page transition from immediately repeating the same two requests.
 */
const NOTIFICATION_REFRESH_MS = 60000;
const SIDEBAR_PROFILE_CACHE_PREFIX =
  "treble_sidebar_profile_v1";

const getSidebarProfileCacheKey =
  (userId) =>
    `${SIDEBAR_PROFILE_CACHE_PREFIX}:${String(
      userId || "anonymous"
    )}`;

const notificationCountCache = new Map();
const notificationRequestCache = new Map();

export default function Sidebar({
  menuOpen = false,
  setMenuOpen = () => {},
  isDesktop: suppliedIsDesktop,
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const isDesktop =
    typeof suppliedIsDesktop === "boolean"
      ? suppliedIsDesktop
      : Platform.OS === "web" && width >= MOBILE_BREAKPOINT;

  const mobileMenuWidth = Math.min(
    MOBILE_SIDEBAR_MAX_WIDTH,
    Math.max(260, width * 0.86)
  );

  const sidebarWidth = isDesktop
    ? DESKTOP_SIDEBAR_WIDTH
    : mobileMenuWidth;

  const initialFirebaseUser =
    auth.currentUser;

  const [avatar, setAvatar] =
    useState(
      initialFirebaseUser?.photoURL ||
      null
    );

  const [username, setUsername] =
    useState(
      initialFirebaseUser
        ?.displayName ||
      "User"
    );

  const [email, setEmail] =
    useState(
      initialFirebaseUser?.email ||
      ""
    );
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const noAvatar = require("../images/avatarIcon.png");

  const translateX = useRef(
    new Animated.Value(
      isDesktop || menuOpen ? 0 : -sidebarWidth
    )
  ).current;

  const animateMenu = useCallback(
    (open) => {
      if (isDesktop) {
        translateX.setValue(0);
        return;
      }

      Animated.timing(translateX, {
        toValue: open ? 0 : -sidebarWidth,
        duration: 240,
        useNativeDriver: true,
      }).start();
    },
    [isDesktop, sidebarWidth, translateX]
  );

  useEffect(() => {
    animateMenu(isDesktop ? true : menuOpen);
  }, [animateMenu, isDesktop, menuOpen]);

  const restoreCachedProfile =
    useCallback(
      async (userId) => {
        if (!userId) {
          return false;
        }

        try {
          const raw =
            await AsyncStorage.getItem(
              getSidebarProfileCacheKey(
                userId
              )
            );

          if (!raw) {
            return false;
          }

          const cached =
            JSON.parse(raw);

          if (
            cached?.username
          ) {
            setUsername(
              cached.username
            );
          }

          if (
            typeof cached?.email ===
            "string"
          ) {
            setEmail(
              cached.email
            );
          }

          if (
            typeof cached?.avatar ===
              "string" &&
            cached.avatar
          ) {
            setAvatar(
              cached.avatar
            );

            Image.prefetch(
              cached.avatar
            ).catch(() => {});
          }

          setLoadingProfile(false);
          return true;
        } catch (error) {
          console.warn(
            "[Sidebar] Could not restore cached profile:",
            error
          );

          return false;
        }
      },
      []
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          if (!firebaseUser?.uid) {
            setAvatar(null);
            setUsername("User");
            setEmail("");
            setLoadingProfile(false);
            return;
          }

          /*
           * Firebase values paint immediately while the backend profile and
           * cached custom avatar are restored.
           */
          setUsername(
            firebaseUser.displayName ||
            "User"
          );

          setEmail(
            firebaseUser.email || ""
          );

          if (
            firebaseUser.photoURL
          ) {
            setAvatar(
              firebaseUser.photoURL
            );
          }

          await restoreCachedProfile(
            firebaseUser.uid
          );
        }
      );

    return unsubscribe;
  }, [restoreCachedProfile]);

  const loadProfile = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      setAvatar(null);
      setUsername("User");
      setEmail("");
      setLoadingProfile(false);
      return;
    }

    try {
      /*
       * Keep cached/Firebase profile visible while refreshing in the
       * background. Only show a loader when there is truly no avatar.
       */
      if (!avatar) {
        setLoadingProfile(true);
      }

      await currentUser.reload();

      const refreshedUser = auth.currentUser || currentUser;
      const response = await getUser(refreshedUser.uid);

      if (!response?.ok) {
        throw new Error(
          `User request failed with status ${response?.status}`
        );
      }

      const userData = await response.json();

      const finalUsername =
        typeof userData?.username === "string" &&
        userData.username.trim()
          ? userData.username.trim()
          : refreshedUser.displayName || "User";

      const finalEmail =
        typeof userData?.email === "string" &&
        userData.email.trim()
          ? userData.email.trim()
          : refreshedUser.email || "";

      const backendAvatar =
        typeof userData?.avatar === "string" &&
        userData.avatar.trim() &&
        userData.avatar !== "None"
          ? userData.avatar.trim()
          : "";

      const firebaseAvatar =
        typeof refreshedUser.photoURL === "string"
          ? refreshedUser.photoURL.trim()
          : "";

      const finalAvatar =
        backendAvatar ||
        firebaseAvatar ||
        "";

      setUsername(finalUsername);
      setEmail(finalEmail);
      setAvatar(
        finalAvatar || null
      );

      if (finalAvatar) {
        Image.prefetch(
          finalAvatar
        ).catch(() => {});
      }

      await AsyncStorage.setItem(
        getSidebarProfileCacheKey(
          refreshedUser.uid
        ),
        JSON.stringify({
          username:
            finalUsername,
          email:
            finalEmail,
          avatar:
            finalAvatar,
          savedAt:
            Date.now(),
        })
      );
    } catch (error) {
      console.error("[Sidebar] User-data error:", error);

      const fallbackUser = auth.currentUser;

      setUsername(fallbackUser?.displayName || "User");
      setEmail(fallbackUser?.email || "");
      setAvatar(fallbackUser?.photoURL || null);
    } finally {
      setLoadingProfile(false);
    }
  }, [avatar]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const openMenu = useCallback(() => {
    if (!isDesktop) {
      setMenuOpen(true);
    }
  }, [isDesktop, setMenuOpen]);

  const closeMenu = useCallback(() => {
    if (!isDesktop) {
      setMenuOpen(false);
    }
  }, [isDesktop, setMenuOpen]);

  const toggleMenu = useCallback(() => {
    if (!isDesktop) {
      setMenuOpen(!menuOpen);
    }
  }, [isDesktop, menuOpen, setMenuOpen]);

  const navigateTo = useCallback(
    (screenName, parameters) => {
      navigation.navigate(screenName, parameters);

      if (!isDesktop) {
        setMenuOpen(false);
      }
    },
    [isDesktop, navigation, setMenuOpen]
  );

  /*
   * Load the Sidebar notification badge efficiently.
   *
   * The old version performed two requests every 15 seconds on every
   * mounted Sidebar. This version:
   * - caches counts for 60 seconds,
   * - reuses an in-progress request,
   * - pauses while the app/browser tab is inactive,
   * - keeps the previous valid count if a temporary request fails.
   */
  const loadNotificationsCount =
    useCallback(async ({
      force = false,
    } = {}) => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setNotificationsCount(0);
        return;
      }

      const userId =
        String(currentUser.uid);

      const cached =
        notificationCountCache.get(
          userId
        );

      const cacheIsFresh =
        cached &&
        Date.now() -
          cached.updatedAt <
          NOTIFICATION_REFRESH_MS;

      if (!force && cacheIsFresh) {
        setNotificationsCount(
          cached.count
        );

        return;
      }

      /*
       * If another Sidebar instance already started this request,
       * await that same Promise rather than issuing duplicate reads.
       */
      const existingRequest =
        notificationRequestCache.get(
          userId
        );

      if (existingRequest) {
        try {
          const count =
            await existingRequest;

          setNotificationsCount(count);
        } catch {
          /*
           * The original request handles logging.
           * Preserve the current badge count here.
           */
        }

        return;
      }

      const requestPromise =
        (async () => {
          const [
            notificationsResponse,
            requestsResponse,
          ] = await Promise.all([
            getNotifications(userId),
            getFollowRequests(userId),
          ]);

          let notificationsData = {};
          let requestsData = {};

          if (
            notificationsResponse?.ok
          ) {
            notificationsData =
              await notificationsResponse.json();
          }

          if (requestsResponse?.ok) {
            requestsData =
              await requestsResponse.json();
          }

          const notifications =
            Array.isArray(
              notificationsData
            )
              ? notificationsData
              : Array.isArray(
                    notificationsData
                      ?.notifications
                )
                ? notificationsData
                    .notifications
                : [];

          const requests =
            Array.isArray(requestsData)
              ? requestsData
              : Array.isArray(
                    requestsData?.requests
                )
                ? requestsData.requests
                : Array.isArray(
                      requestsData
                        ?.followRequests
                  )
                  ? requestsData
                      .followRequests
                  : [];

          const unreadNormalCount =
            notifications.filter(
              (notification) => {
                const type = String(
                  notification?.type ||
                    notification
                      ?.notificationType ||
                    notification
                      ?.notification_type ||
                    ""
                )
                  .trim()
                  .toLowerCase()
                  .replaceAll("-", "_")
                  .replaceAll(" ", "_");

                const isRead =
                  notification?.read ===
                    true ||
                  notification?.read ===
                    "true" ||
                  notification?.read ===
                    1 ||
                  notification?.isRead ===
                    true ||
                  notification?.is_read ===
                    true;

                return (
                  !isRead &&
                  type !==
                    "follow_request"
                );
              }
            ).length;

          const totalCount =
            unreadNormalCount +
            requests.length;

          notificationCountCache.set(
            userId,
            {
              count: totalCount,
              updatedAt: Date.now(),
            }
          );

          return totalCount;
        })();

      notificationRequestCache.set(
        userId,
        requestPromise
      );

      try {
        const totalCount =
          await requestPromise;

        setNotificationsCount(
          totalCount
        );
      } catch (error) {
        console.error(
          "[Sidebar] Notification count error:",
          error
        );

        /*
         * Do not reset the badge to zero because of a temporary
         * network/backend error. Reuse the most recent valid count.
         */
        const fallback =
          notificationCountCache.get(
            userId
          );

        if (fallback) {
          setNotificationsCount(
            fallback.count
          );
        }
      } finally {
        notificationRequestCache.delete(
          userId
        );
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      /*
       * Display cached data immediately. A real request only runs
       * when the cache is older than 60 seconds.
       */
      loadNotificationsCount();

      const intervalId = setInterval(
        () => {
          const nativeAppIsInactive =
            Platform.OS !== "web" &&
            AppState.currentState &&
            AppState.currentState !==
              "active";

          const browserTabIsHidden =
            Platform.OS === "web" &&
            typeof document !==
              "undefined" &&
            document.visibilityState ===
              "hidden";

          if (
            nativeAppIsInactive ||
            browserTabIsHidden
          ) {
            return;
          }

          loadNotificationsCount();
        },
        NOTIFICATION_REFRESH_MS
      );

      return () => {
        clearInterval(intervalId);
      };
    }, [
      loadNotificationsCount,
    ])
  );


  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => {
        const horizontalSwipe =
          Math.abs(gesture.dx) > Math.abs(gesture.dy);

        return (
          !isDesktop &&
          menuOpen &&
          gesture.dx < -8 &&
          horizontalSwipe
        );
      },

      onPanResponderMove: (_event, gesture) => {
        if (
          isDesktop ||
          !menuOpen ||
          gesture.dx >= 0
        ) {
          return;
        }

        const nextPosition = Math.max(
          -sidebarWidth,
          gesture.dx
        );

        translateX.setValue(nextPosition);
      },

      onPanResponderRelease: (_event, gesture) => {
        if (isDesktop) {
          translateX.setValue(0);
          return;
        }

        if (
          gesture.dx < -70 ||
          gesture.vx < -0.45
        ) {
          setMenuOpen(false);
        } else {
          animateMenu(true);
        }
      },

      onPanResponderTerminate: () => {
        if (!isDesktop) {
          animateMenu(menuOpen);
        }
      },
    })
  ).current;

  const performLogout = useCallback(async () => {
    try {
      console.log("[Sidebar] Logging out...");

      await signOut(auth);
      await deleteSession("userUid");

      if (!isDesktop) {
        setMenuOpen(false);
      }

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Home",
          },
        ],
      });

      console.log("[Sidebar] Logout complete.");
    } catch (error) {
      console.error("[Sidebar] Logout error:", error);

      if (Platform.OS === "web") {
        window.alert(
          "Unable to log out. Please try again."
        );
      } else {
        Alert.alert(
          "Unable to log out",
          "Please try again."
        );
      }
    }
  }, [isDesktop, navigation, setMenuOpen]);

  const handleLogout = useCallback(() => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to log out?"
      );

      if (confirmed) {
        performLogout();
      }

      return;
    }

    Alert.alert(
      "Log out",
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
  }, [performLogout]);

  return (
    <View
      style={[
        styles.root,
        isDesktop
          ? styles.desktopRoot
          : styles.mobileRoot,
      ]}
      pointerEvents="box-none"
    >
      {!isDesktop && !menuOpen ? (
        <TouchableOpacity
          onPress={openMenu}
          style={styles.hamburgerButton}
          activeOpacity={0.8}
        >
          <Icon
            name="menu"
            size={28}
            color="#ffffff"
          />
        </TouchableOpacity>
      ) : null}

      {!isDesktop && menuOpen ? (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      ) : null}

      <Animated.View
        {...(isDesktop ? {} : panResponder.panHandlers)}
        style={[
          styles.sideMenu,
          isDesktop
            ? styles.desktopSideMenu
            : styles.mobileSideMenu,
          {
            width: sidebarWidth,
            transform: [
              {
                translateX: isDesktop
                  ? 0
                  : translateX,
              },
            ],
          },
        ]}
      >
        {!isDesktop ? (
          <TouchableOpacity
            onPress={toggleMenu}
            style={styles.closeButton}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={[
            styles.sidebarScrollContent,
            !isDesktop && styles.mobileScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={() => navigateTo("Profile")}
              activeOpacity={0.8}
            >
              {loadingProfile && !avatar ? (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarLoading,
                  ]}
                >
                  <ActivityIndicator
                    size="small"
                    color={colours.lightblue}
                  />
                </View>
              ) : (
                <Image
                  key={
                    avatar ||
                    "sidebar-default-avatar"
                  }
                  source={
                    avatar
                      ? {
                          uri: avatar,
                        }
                      : noAvatar
                  }
                  style={styles.avatar}
                  onError={(event) => {
                    console.error(
                      "[Sidebar] Avatar display error:",
                      event?.nativeEvent?.error
                    );

                    setAvatar(null);
                  }}
                />
              )}
            </TouchableOpacity>

            <Text
              style={styles.profileName}
              numberOfLines={1}
            >
              {username || "User"}
            </Text>

            <Text
              style={styles.profileEmail}
              numberOfLines={1}
            >
              {email}
            </Text>

            <TouchableOpacity
              onPress={() => navigateTo("EditProfile")}
              style={styles.editAccountButton}
              activeOpacity={0.8}
            >
              <Text style={styles.editAccount}>
                Edit Account
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuSection}>
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>
                LIBRARY
              </Text>

              <View style={styles.menuGroupCard}>
                <MenuItem
                  iconName="history"
                  label="Recently Viewed"
                  onPress={() =>
                    navigateTo("RecentlyViewed")
                  }
                />

                <MenuItem
                  iconName="favorite-border"
                  label="Liked"
                  onPress={() =>
                    navigateTo("Favourites")
                  }
                />

                <MenuItem
                  iconName="auto-awesome"
                  label="Swipe to Discover"
                  onPress={() =>
                    navigateTo("MusicSwiperTest")
                  }
                />
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>
                SOCIAL
              </Text>

              <View style={styles.menuGroupCard}>
                <MenuItem
                  iconName="people-outline"
                  label="Friends List"
                  onPress={() =>
                    navigateTo("FriendsList")
                  }
                />

                <MenuItem
                  iconName="groups"
                  label="Community"
                  onPress={() =>
                    navigateTo("Groups")
                  }
                />

                <MenuItem
                  iconName="chat-bubble-outline"
                  label="Messages"
                  onPress={() =>
                    navigateTo("Messages")
                  }
                />

                <MenuItem
                  iconName="notifications-none"
                  label="Notifications"
                  onPress={() =>
                    navigateTo("Notifications")
                  }
                  badgeCount={notificationsCount}
                />
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>
                YOUR TREBLE
              </Text>

              <View style={styles.menuGroupCard}>
                <MenuItem
                  iconName="hub"
                  label="Connections"
                  onPress={() =>
                    navigateTo("Connections")
                  }
                />

                <MenuItem
                  iconName="emoji-events"
                  label="Achievements"
                  onPress={() =>
                    navigateTo("Achievements")
                  }
                />

                <MenuItem
                  iconName="settings"
                  label="Settings"
                  onPress={() =>
                    navigateTo("Settings")
                  }
                />

                <MenuItem
                  iconName="logout"
                  label="Logout"
                  onPress={handleLogout}
                  destructive
                />
              </View>
            </View>

            <View style={styles.sidebarFooter}>
              <Text style={styles.sectionLabel}>
                ABOUT
              </Text>

              <View style={styles.menuGroupCard}>
                <MenuItem
                  iconName="movie-filter"
                  label="Credits"
                  onPress={() =>
                    navigateTo("Credits")
                  }
                />
              </View>

              <Text style={styles.footerBrand}>
                TREBLE
              </Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function MenuItem({
  iconName,
  label,
  onPress,
  badgeCount = 0,
  badgeText = "",
  destructive = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.menuItem,
        Platform.OS === "web" &&
          hovered &&
          styles.menuItemHovered,
        pressed && styles.menuItemPressed,
      ]}
    >
      {({ hovered, pressed }) => {
        const isActive = Boolean(hovered || pressed);

        const itemColor = destructive
          ? isActive
            ? "#ff8494"
            : "#ff5a70"
          : isActive
            ? "#ffffff"
            : colours.lightblue;

        return (
          <>
            <View
              style={[
                styles.menuIconContainer,
                isActive &&
                  styles.menuIconContainerActive,
                destructive &&
                  styles.destructiveIconContainer,
              ]}
            >
              <Icon
                name={iconName}
                size={21}
                color={itemColor}
              />
            </View>

            <Text
              style={[
                styles.menuText,
                isActive && styles.menuTextActive,
                destructive &&
                  styles.destructiveMenuText,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>

            {badgeText ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>
                  {badgeText}
                </Text>
              </View>
            ) : null}

            {badgeCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text
                  style={styles.notificationBadgeText}
                >
                  {badgeCount > 99
                    ? "99+"
                    : badgeCount}
                </Text>
              </View>
            ) : null}

            {!badgeText && badgeCount <= 0 ? (
              <Icon
                name="chevron-right"
                size={20}
                color={
                  isActive
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.30)"
                }
              />
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
  },

  desktopRoot: {
    width: DESKTOP_SIDEBAR_WIDTH,
    height: "100vh",
  },

  mobileRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 100,
  },

  hamburgerButton: {
    position:
      Platform.OS === "web"
        ? "fixed"
        : "absolute",
    top: 18,
    left: 16,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.07)",
    zIndex: 130,
    elevation: 25,
  },

  closeButton: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    zIndex: 5,
  },

  closeButtonText: {
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 34,
    fontWeight: "300",
  },

  overlay: {
    position:
      Platform.OS === "web"
        ? "fixed"
        : "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: Platform.OS === "web" ? "100vw" : "100%",
    height: Platform.OS === "web" ? "100dvh" : "100%",
    backgroundColor: "rgba(0,0,0,0.62)",
    zIndex: 110,
  },

  sideMenu: {
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colours.darkblue,
    shadowColor: "#000000",
    shadowOffset: {
      width: 3,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 120,
    overflow: "hidden",
  },

  desktopSideMenu: {
    position: "absolute",
    height: "100vh",
  },

  mobileSideMenu: {
    position:
      Platform.OS === "web"
        ? "fixed"
        : "absolute",
    top: 0,
    bottom: 0,
    height:
      Platform.OS === "web"
        ? "100dvh"
        : "100%",
    maxWidth: "90vw",
  },

  sidebarScroll: {
    flex: 1,
    width: "100%",
  },

  sidebarScrollContent: {
    paddingBottom: 34,
  },

  mobileScrollContent: {
    paddingBottom: 80,
  },

  profileSection: {
    minHeight: 205,
    alignItems: "center",
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  avatarLoading: {
    alignItems: "center",
    justifyContent: "center",
  },

  profileName: {
    maxWidth: "100%",
    color: colours.lightblue,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  profileEmail: {
    maxWidth: "100%",
    color: colours.lightblue,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 1,
    opacity: 0.9,
  },

  editAccountButton: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    marginTop: 4,
  },

  editAccount: {
    color: colours.lightblue,
    fontSize: 10,
    lineHeight: 15,
    textDecorationLine: "underline",
  },

  menuSection: {
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 30,
  },

  sectionBlock: {
    marginBottom: 17,
  },

  sectionLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 7,
    paddingHorizontal: 10,
  },

  menuGroupCard: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.055)",
  },

  menuItem: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    cursor:
      Platform.OS === "web"
        ? "pointer"
        : undefined,
  },

  menuItemHovered: {
    backgroundColor: "rgba(0,190,255,0.13)",
    transform: [
      {
        translateX: 2,
      },
    ],
  },

  menuItemPressed: {
    backgroundColor: "rgba(0,190,255,0.20)",
    opacity: 0.92,
  },

  menuIconContainer: {
    width: 36,
    height: 36,
    marginRight: 11,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.035)",
  },

  menuIconContainerActive: {
    backgroundColor: "rgba(0,190,255,0.20)",
    borderColor: "rgba(0,190,255,0.25)",
  },

  destructiveIconContainer: {
    backgroundColor: "rgba(255,80,104,0.08)",
  },

  menuText: {
    flex: 1,
    color: colours.lightblue,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
  },

  menuTextActive: {
    color: "#ffffff",
  },

  destructiveMenuText: {
    color: "#ff5a70",
  },

  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colours.lightblue || "#35afe5",
  },

  newBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  sidebarFooter: {
    marginTop: 0,
    paddingTop: 2,
    paddingBottom: 12,
  },

  footerBrand: {
    color: "rgba(255,255,255,0.18)",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 10,
  },

  notificationBadge: {
    minWidth: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: "#ff334f",
  },

  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
});
