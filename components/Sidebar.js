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
  Image,
  PanResponder,
  Platform,
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

import {
  getFollowRequests,
  getNotifications,
  getUser,
} from "../providers/rest";

import { signOut } from "firebase/auth";

import { auth } from "../utils/firebase";
import { deleteSession } from "../utils/session";
import colours from "../styles/colours";

const DESKTOP_SIDEBAR_WIDTH = 280;
const MOBILE_SIDEBAR_MAX_WIDTH = 300;
const MOBILE_BREAKPOINT = 768;

export default function Sidebar({
  menuOpen = false,
  setMenuOpen = () => {},
  isDesktop: suppliedIsDesktop,
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  /*
   * Feed.js passes isDesktop.
   * The fallback also allows Sidebar.js to work on other screens.
   */
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

  const [avatar, setAvatar] = useState(null);
  const [username, setUsername] = useState("User");
  const [email, setEmail] = useState("");
  const [notificationsCount, setNotificationsCount] =
    useState(0);
  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const noAvatar = require("../images/avatarIcon.png");

  /*
   * Desktop is always positioned at zero.
   * Mobile starts completely outside the left edge.
   */
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
    [
      isDesktop,
      sidebarWidth,
      translateX,
    ]
  );


  /*
 * Keep the animated sidebar synchronized
 * with the menuOpen state.
 *
 * Without this effect, the overlay appears,
 * but the sidebar stays translated off-screen.
 */
useEffect(() => {
  animateMenu(
    isDesktop ? true : menuOpen
  );
}, [
  animateMenu,
  isDesktop,
  menuOpen,
]);

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
    setLoadingProfile(true);

    /*
     * Reload the Firebase user so the latest
     * displayName and photoURL are available.
     */
    await currentUser.reload();

    const refreshedUser =
      auth.currentUser || currentUser;

    const response = await getUser(
      refreshedUser.uid
    );

    if (!response?.ok) {
      throw new Error(
        `User request failed with status ${response?.status}`
      );
    }

    const userData =
      await response.json();

    /*
     * Keep the username exactly as saved,
     * including all capitalization.
     */
    const finalUsername =
      typeof userData?.username === "string" &&
      userData.username.trim()
        ? userData.username.trim()
        : refreshedUser.displayName ||
          "User";

    const finalEmail =
      typeof userData?.email === "string" &&
      userData.email.trim()
        ? userData.email.trim()
        : refreshedUser.email || "";

    /*
     * Prefer the avatar stored by the Treble backend.
     * Fall back to Firebase Authentication photoURL.
     */
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

    setUsername(finalUsername);
    setEmail(finalEmail);

    setAvatar(
      backendAvatar ||
      firebaseAvatar ||
      null
    );
  } catch (error) {
    console.error(
      "[Sidebar] User-data error:",
      error
    );

    const fallbackUser =
      auth.currentUser;

    setUsername(
      fallbackUser?.displayName ||
      "User"
    );

    setEmail(
      fallbackUser?.email || ""
    );

    setAvatar(
      fallbackUser?.photoURL ||
      null
    );
  } finally {
    setLoadingProfile(false);
  }
}, []);

/*
 * Reload the Sidebar profile every time the
 * current screen becomes active again.
 *
 * This makes changes from Edit Profile appear
 * when returning to Feed, Profile, or Settings.
 */
useFocusEffect(
  useCallback(() => {
    loadProfile();
  }, [loadProfile])
);
  const openMenu = useCallback(() => {
    if (isDesktop) {
      return;
    }

    setMenuOpen(true);
  }, [isDesktop, setMenuOpen]);

  const closeMenu = useCallback(() => {
    if (isDesktop) {
      return;
    }

    setMenuOpen(false);
  }, [isDesktop, setMenuOpen]);

  const toggleMenu = useCallback(() => {
    if (isDesktop) {
      return;
    }

    setMenuOpen(!menuOpen);
  }, [
    isDesktop,
    menuOpen,
    setMenuOpen,
  ]);

  /*
   * Close the mobile sidebar after navigating.
   * Desktop sidebar remains open.
   */
  const navigateTo = useCallback(
    (screenName, parameters) => {
      navigation.navigate(
        screenName,
        parameters
      );

      if (!isDesktop) {
        setMenuOpen(false);
      }
    },
    [
      isDesktop,
      navigation,
      setMenuOpen,
    ]
  );

 /*
 * Load the notification badge.
 *
 * Normal notifications count while unread.
 * Pending follow requests remain counted until
 * they are accepted or denied.
 */
const loadNotificationsCount =
  useCallback(async () => {
    const currentUser =
      auth.currentUser;

    if (!currentUser?.uid) {
      setNotificationsCount(0);
      return;
    }

    try {
      const [
        notificationsResponse,
        requestsResponse,
      ] = await Promise.all([
        getNotifications(
          currentUser.uid
        ),

        getFollowRequests(
          currentUser.uid
        ),
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

      /*
       * Support either a direct array or:
       *
       * {
       *   notifications: [...]
       * }
       */
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

      /*
       * Support either a direct array or:
       *
       * {
       *   requests: [...]
       * }
       *
       * or:
       *
       * {
       *   followRequests: [...]
       * }
       */
      const requests =
        Array.isArray(
          requestsData
        )
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

      /*
       * Follow requests exist in both:
       *
       * notifications
       * followRequests
       *
       * Exclude follow_request notifications here
       * so they are not counted twice.
       */
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

      /*
       * Pending private follow requests remain
       * in the badge until accepted or denied.
       */
      const totalCount =
        unreadNormalCount +
        requests.length;

      setNotificationsCount(
        totalCount
      );
    } catch (error) {
      console.error(
        "[Sidebar] Notification count error:",
        error
      );

      setNotificationsCount(0);
    }
  }, []);

/*
 * Reload whenever the current page gets focus.
 *
 * Also check every 15 seconds so new notifications
 * can appear without refreshing the whole app.
 */
useFocusEffect(
  useCallback(() => {
    loadNotificationsCount();

    const intervalId =
      setInterval(
        loadNotificationsCount,
        15000
      );

    return () => {
      clearInterval(
        intervalId
      );
    };
  }, [
    loadNotificationsCount,
  ])
);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        _event,
        gesture
      ) => {
        return (
          !isDesktop &&
          menuOpen &&
          Math.abs(gesture.dx) > 8
        );
      },

      onPanResponderMove: (
        _event,
        gesture
      ) => {
        if (
          isDesktop ||
          !menuOpen ||
          gesture.dx >= 0
        ) {
          return;
        }

        /*
         * Only permit movement from zero toward
         * the closed position on the left.
         */
        const nextPosition = Math.max(
          -sidebarWidth,
          gesture.dx
        );

        translateX.setValue(nextPosition);
      },

      onPanResponderRelease: (
        _event,
        gesture
      ) => {
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

    /*
     * Sign out of Firebase.
     */
    await signOut(auth);

    /*
     * Remove the custom saved UID session.
     */
    await deleteSession("userUid");

    if (!isDesktop) {
      setMenuOpen(false);
    }

    /*
     * Reset navigation so Feed cannot be reached
     * by pressing the browser Back button.
     */
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
    console.error(
      "[Sidebar] Logout error:",
      error
    );

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
}, [
  isDesktop,
  navigation,
  setMenuOpen,
]);

const handleLogout = useCallback(() => {
  /*
   * React Native Alert confirmation buttons
   * are not dependable on React Native Web.
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
      {/* MOBILE HAMBURGER ONLY */}
      {!isDesktop && !menuOpen ? (
        <TouchableOpacity
          onPress={openMenu}
          style={styles.hamburgerButton}
          activeOpacity={0.8}
        >
          <Image
            source={require("../images/blackHamburger.png")}
            style={styles.hamburgerIcon}
          />
        </TouchableOpacity>
      ) : null}

      {/* MOBILE DARK OVERLAY */}
      {!isDesktop && menuOpen ? (
        <TouchableWithoutFeedback
          onPress={closeMenu}
        >
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      ) : null}

      {/* SIDEBAR PANEL */}
      <Animated.View
        {...(
          isDesktop
            ? {}
            : panResponder.panHandlers
        )}
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
        {/* MOBILE CLOSE BUTTON */}
        {!isDesktop ? (
          <TouchableOpacity
            onPress={toggleMenu}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>
              ×
            </Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView
          style={styles.sidebarScroll}
          contentContainerStyle={
            styles.sidebarScrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          bounces={false}
        >
          {/* PROFILE */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={() =>
                navigateTo("Profile")
              }
              activeOpacity={0.8}
            >
              {loadingProfile &&
                !avatar ? (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarLoading,
                    ]}
                  >
                    <ActivityIndicator
                      size="small"
                      color={
                        colours.lightblue
                      }
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
              onPress={() =>
                navigateTo("EditProfile")
              }
              style={
                styles.editAccountButton
              }
            >
              <Text
                style={styles.editAccount}
              >
                Edit Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* MAIN MENU */}
          <View style={styles.menuSection}>
            <MenuItem
              icon={require("../images/blackClockIcon.png")}
              label="Recently Viewed"
              onPress={() =>
                navigateTo(
                  "RecentlyViewed"
                )
              }
            />

            <MenuItem
              icon={require("../images/friendsIcon.png")}
              label="Friends List"
              onPress={() =>
                navigateTo("FriendsList")
              }
              iconStyle={
                styles.friendsIcon
              }
            />

            <MenuItem
              icon={require("../images/groupsIcon.png")}
              label="Community"
              onPress={() =>
                navigateTo("Groups")
              }
            />

            <MenuItem
              icon={require("../images/messagesIcon.png")}
              label="Messages"
              onPress={() =>
                navigateTo("Messages")
              }
              iconStyle={
                styles.largeMenuIcon
              }
            />

            <MenuItem
              icon={require("../images/notificationsIcon2.png")}
              label="Notifications"
              onPress={() =>
                navigateTo(
                  "Notifications"
                )
              }
              badgeCount={
                notificationsCount
              }
            />

            <MenuItem
              icon={require("../images/favouritesIcon2.png")}
              label="Liked"
              onPress={() =>
                navigateTo("Favourites")
              }
              iconStyle={
                styles.favouritesIcon
              }
              dividerAfter
            />

            <MenuItem
              icon={require("../images/cardgame.png")}
              label="Swipe to Discover"
              onPress={() =>
                navigateTo(
                  "MusicSwiperTest"
                )
              }
              iconStyle={
                styles.cardGameIcon
              }
              dividerAfter
            />

            <MenuItem
              icon={require("../images/connectionsIcon.png")}
              label="Connections"
              onPress={() =>
                navigateTo("Connections")
              }
            />

            <MenuItem
              icon={require("../images/settingsIcon.png")}
              label="Settings"
              onPress={() =>
                navigateTo("Settings")
              }
            />

            <MenuItem
              label="Logout"
              onPress={handleLogout}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  badgeCount = 0,
  iconStyle,
  dividerAfter = false,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={[
        styles.menuItem,
        dividerAfter &&
          styles.menuItemDivider,
      ]}
    >
      {icon ? (
        <Image
          source={icon}
          style={[
            styles.menuIcon,
            iconStyle,
          ]}
        />
      ) : (
        <View
          style={styles.menuIconPlaceholder}
        />
      )}

      <Text
        style={styles.menuText}
        numberOfLines={1}
      >
        {label}
      </Text>

      {badgeCount > 0 ? (
        <View
          style={
            styles.notificationBadge
          }
        >
          <Text
            style={
              styles.notificationBadgeText
            }
          >
            {badgeCount > 99
              ? "99+"
              : badgeCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
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

  /* =========================================================
     MOBILE CONTROLS
  ========================================================= */

  hamburgerButton: {
    position: "fixed",
    top: 18,
    left: 16,

    width: 46,
    height: 46,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 23,

    backgroundColor:
      "rgba(255,255,255,0.07)",

    zIndex: 130,
    elevation: 25,
  },

  hamburgerIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
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

    backgroundColor:
      "rgba(255,255,255,0.08)",

    zIndex: 5,
  },

  closeButtonText: {
    color: "#ffffff",
    fontSize: 31,
    lineHeight: 34,
    fontWeight: "300",
  },

  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    width: "100vw",
    height: "100vh",

    backgroundColor:
      "rgba(0,0,0,0.62)",

    zIndex: 110,
  },

  /* =========================================================
     SIDEBAR PANEL
  ========================================================= */

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

    height:
      Platform.OS === "web"
        ? "100vh"
        : "100%",

    maxWidth: "90vw",
  },

  sidebarScroll: {
    flex: 1,
  },

  sidebarScrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  /* =========================================================
     PROFILE
  ========================================================= */

  profileSection: {
    minHeight: 205,

    alignItems: "center",

    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 18,

    borderBottomWidth: 2,
    borderBottomColor:
      colours.secondaryblue,
  },

  avatar: {
    width: 80,
    height: 80,

    borderRadius: 40,

    marginBottom: 9,

    backgroundColor:
      "rgba(255,255,255,0.08)",
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

  /* =========================================================
     MENU ITEMS
  ========================================================= */

  menuSection: {
    flex: 1,
  },

  menuItem: {
    minHeight: 55,

    flexDirection: "row",
    alignItems: "center",

    paddingVertical: 13,
    paddingHorizontal: 18,
  },

  menuItemDivider: {
    borderBottomWidth: 2,
    borderBottomColor:
      colours.secondaryblue,
  },

  menuIcon: {
    width: 21,
    height: 21,

    marginRight: 15,

    resizeMode: "contain",
  },

  largeMenuIcon: {
    width: 25,
    height: 25,

    marginLeft: -2,
    marginRight: 13,
  },

  friendsIcon: {
    width: 23,
    height: 23,

    marginLeft: -1,
    marginRight: 14,
  },

  favouritesIcon: {
    width: 19,
    height: 19,

    marginLeft: 1,
    marginRight: 17,
  },

  /*
   * The two-card Swipe to Discover artwork contains more
   * empty transparent space than the other sidebar icons,
   * so it needs its own larger dimensions.
   */
  cardGameIcon: {
    width: 34,
    height: 34,

    marginLeft: -6,
    marginRight: 9,

    resizeMode: "contain",
  },

  menuIconPlaceholder: {
    width: 21,
    height: 21,

    marginRight: 15,
  },

  menuText: {
    flex: 1,

    color: colours.lightblue,

    fontSize: 15,
    lineHeight: 21,
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