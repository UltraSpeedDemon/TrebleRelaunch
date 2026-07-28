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

import { useNavigation } from "@react-navigation/native";

import {
  getFollowRequests,
  getUser,
} from "../providers/rest";

import { auth } from "../utils/firebase";
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

  useEffect(() => {
    if (isDesktop) {
      translateX.setValue(0);

      if (!menuOpen) {
        setMenuOpen(true);
      }

      return;
    }

    animateMenu(menuOpen);
  }, [
    animateMenu,
    isDesktop,
    menuOpen,
    setMenuOpen,
    translateX,
  ]);

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

  useEffect(() => {
    let mounted = true;

    const fetchUserData = async () => {
      setLoadingProfile(true);

      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          if (mounted) {
            setAvatar(noAvatar);
            setUsername("User");
            setEmail("");
          }

          return;
        }

        if (mounted) {
          setEmail(currentUser.email || "");
        }

        const response = await getUser(
          currentUser.uid
        );

        if (!response?.ok) {
          throw new Error(
            `User request failed with status ${response?.status}`
          );
        }

        const userData = await response.json();

        if (!mounted) {
          return;
        }

        setUsername(
          userData?.username ||
            currentUser.displayName ||
            "User"
        );

        const avatarValue = userData?.avatar;

        if (
          avatarValue &&
          avatarValue !== "None" &&
          (
            avatarValue.startsWith("data:") ||
            avatarValue.startsWith("http")
          )
        ) {
          setAvatar({
            uri: avatarValue,
          });
        } else {
          setAvatar(noAvatar);
        }
      } catch (error) {
        console.error(
          "[Sidebar] User-data error:",
          error
        );

        if (mounted) {
          setAvatar(noAvatar);

          setUsername(
            auth.currentUser?.displayName ||
              "User"
          );

          setEmail(
            auth.currentUser?.email || ""
          );
        }
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    };

    fetchUserData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchNotificationsCount =
      async () => {
        try {
          const currentUser =
            auth.currentUser;

          if (!currentUser?.uid) {
            if (mounted) {
              setNotificationsCount(0);
            }

            return;
          }

          const response =
            await getFollowRequests(
              currentUser.uid
            );

          if (!response?.ok) {
            return;
          }

          const requests =
            await response.json();

          if (mounted) {
            setNotificationsCount(
              Array.isArray(requests)
                ? requests.length
                : 0
            );
          }
        } catch (error) {
          console.error(
            "[Sidebar] Notification error:",
            error
          );
        }
      };

    fetchNotificationsCount();

    return () => {
      mounted = false;
    };
  }, []);

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

  const formatUsername = useCallback(
    (name) => {
      if (!name) {
        return "User";
      }

      return (
        name.charAt(0).toUpperCase() +
        name.slice(1)
      );
    },
    []
  );

  const handleLogout = useCallback(() => {
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
          onPress: async () => {
            try {
              await auth.signOut();

              if (!isDesktop) {
                setMenuOpen(false);
              }

              navigation.navigate("Home");
            } catch (error) {
              console.error(
                "[Sidebar] Logout error:",
                error
              );

              Alert.alert(
                "Unable to log out",
                "Please try again."
              );
            }
          },
        },
      ]
    );
  }, [
    isDesktop,
    navigation,
    setMenuOpen,
  ]);

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
      {!isDesktop ? (
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
                  source={
                    avatar || noAvatar
                  }
                  style={styles.avatar}
                />
              )}
            </TouchableOpacity>

            <Text
              style={styles.profileName}
              numberOfLines={1}
            >
              {formatUsername(username)}
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
              label="Shared"
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
              label="Test Swipe Game"
              onPress={() =>
                navigateTo(
                  "MusicSwiperTest"
                )
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