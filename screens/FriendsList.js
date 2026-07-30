import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import { auth } from "../utils/firebase";

import MusicCard from "../components/MusicCard";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";

import colours from "../styles/colours";

import {
  followUser,
  getFollowRequests,
  getFriends,
  getUser,
  unfollowUser,
} from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const DESKTOP_HEADER_HEIGHT = 70;
const MAX_CONTENT_WIDTH = 920;

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

export default function FriendsList({
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

  const [friendsList, setFriendsList] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    followingUsers,
    setFollowingUsers,
  ] = useState({});

  const [
    followLoading,
    setFollowLoading,
  ] = useState({});

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

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
  const parseResponse = useCallback(
    async (
      response,
      fallbackMessage
    ) => {
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
          ? JSON.parse(responseText)
          : {};
      } catch {
        throw new Error(
          responseText ||
            "The backend returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `${fallbackMessage} HTTP ${response.status}`
        );
      }

      return data;
    },
    []
  );

  /*
   * Fetch the friends list and fill in any missing avatars.
   */
  const loadFriends = useCallback(
    async (isRefresh = false) => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setFriendsList([]);
        setLoading(false);
        setRefreshing(false);

        navigation.navigate("Home");
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response =
          await getFriends(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load friends."
          );

        const rawFriends =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.friends
              )
              ? data.friends
              : [];

        const updatedFriends =
          await Promise.all(
            rawFriends.map(
              async (friend) => {
                const friendId =
                  friend?.userId ||
                  friend?.uid ||
                  friend?.id;

                if (
                  !friendId ||
                  friend?.avatar
                ) {
                  return {
                    ...friend,
                    userId:
                      String(
                        friendId || ""
                      ),
                  };
                }

                try {
                  const userResponse =
                    await getUser(
                      friendId
                    );

                  if (
                    !userResponse?.ok
                  ) {
                    return {
                      ...friend,
                      userId:
                        String(
                          friendId
                        ),
                    };
                  }

                  const userData =
                    await userResponse.json();

                  return {
                    ...friend,

                    userId:
                      String(
                        friendId
                      ),

                    username:
                      friend?.username ||
                      userData?.username ||
                      userData?.displayName ||
                      "Treble User",

                    avatar:
                      userData?.avatar ||
                      userData?.avatarLong ||
                      "",
                  };
                } catch (error) {
                  console.warn(
                    `[FriendsList] Could not load avatar for ${friendId}:`,
                    error
                  );

                  return {
                    ...friend,
                    userId:
                      String(
                        friendId
                      ),
                  };
                }
              }
            )
          );

        setFriendsList(
          updatedFriends.filter(
            (friend) =>
              Boolean(friend?.userId)
          )
        );

        /*
         * Save the initial follow state locally.
         */
        setFollowingUsers(
          updatedFriends.reduce(
            (
              result,
              friend
            ) => {
              if (friend?.userId) {
                result[
                  friend.userId
                ] =
                  Boolean(
                    friend?.isFollowing
                  );
              }

              return result;
            },
            {}
          )
        );
      } catch (error) {
        console.error(
          "[FriendsList] Load error:",
          error
        );

        setFriendsList([]);

        Alert.alert(
          "Unable to load friends",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      navigation,
      parseResponse,
    ]
  );

  /*
   * Fetch pending follow requests.
   */
  const loadNotifications =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setNotificationsCount(0);
        return;
      }

      try {
        const response =
          await getFollowRequests(
            currentUser.uid
          );

        const data =
          await parseResponse(
            response,
            "Unable to load notifications."
          );

        const requests =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.requests
              )
              ? data.requests
              : [];

        setNotificationsCount(
          requests.length
        );
      } catch (error) {
        console.error(
          "[FriendsList] Notification error:",
          error
        );

        setNotificationsCount(0);
      }
    }, [parseResponse]);

  /*
   * Reload whenever this page is focused.
   */
  useFocusEffect(
    useCallback(() => {
      loadFriends(false);
      loadNotifications();
    }, [
      loadFriends,
      loadNotifications,
    ])
  );

  /*
   * Pull-to-refresh.
   */
  const handleRefresh =
    useCallback(async () => {
      await Promise.all([
        loadFriends(true),
        loadNotifications(),
      ]);
    }, [
      loadFriends,
      loadNotifications,
    ]);

  /*
   * Follow a user.
   */
  const handleFollow =
    useCallback(async (user) => {
      const currentUser =
        auth.currentUser;

      const userId =
        String(
          user?.userId || ""
        );

      if (
        !currentUser?.uid ||
        !userId ||
        followLoading[userId]
      ) {
        return;
      }

      setFollowLoading(
        (current) => ({
          ...current,
          [userId]: true,
        })
      );

      /*
       * Optimistically update the button.
       */
      setFollowingUsers(
        (current) => ({
          ...current,
          [userId]: true,
        })
      );

      try {
        const response =
          await followUser(
            currentUser.uid,
            userId
          );

        await parseResponse(
          response,
          "Unable to follow this user."
        );
      } catch (error) {
        console.error(
          "[FriendsList] Follow error:",
          error
        );

        setFollowingUsers(
          (current) => ({
            ...current,
            [userId]: false,
          })
        );

        Alert.alert(
          "Unable to follow",
          error?.message ||
            "Please try again."
        );
      } finally {
        setFollowLoading(
          (current) => {
            const updated = {
              ...current,
            };

            delete updated[userId];

            return updated;
          }
        );
      }
    }, [
      followLoading,
      parseResponse,
    ]);

  /*
   * Unfollow a user.
   */
  const handleUnfollow =
    useCallback(async (user) => {
      const currentUser =
        auth.currentUser;

      const userId =
        String(
          user?.userId || ""
        );

      if (
        !currentUser?.uid ||
        !userId ||
        followLoading[userId]
      ) {
        return;
      }

      setFollowLoading(
        (current) => ({
          ...current,
          [userId]: true,
        })
      );

      /*
       * Optimistically update the button.
       */
      setFollowingUsers(
        (current) => ({
          ...current,
          [userId]: false,
        })
      );

      try {
        const response =
          await unfollowUser(
            currentUser.uid,
            userId
          );

        await parseResponse(
          response,
          "Unable to unfollow this user."
        );
      } catch (error) {
        console.error(
          "[FriendsList] Unfollow error:",
          error
        );

        setFollowingUsers(
          (current) => ({
            ...current,
            [userId]: true,
          })
        );

        Alert.alert(
          "Unable to unfollow",
          error?.message ||
            "Please try again."
        );
      } finally {
        setFollowLoading(
          (current) => {
            const updated = {
              ...current,
            };

            delete updated[userId];

            return updated;
          }
        );
      }
    }, [
      followLoading,
      parseResponse,
    ]);

  /*
   * Capitalize the username.
   */
  const formatUsername =
    useCallback((name) => {
      if (!name) {
        return "Treble User";
      }

      const cleanName =
        String(name).trim();

      if (!cleanName) {
        return "Treble User";
      }

      return (
        cleanName
          .charAt(0)
          .toUpperCase() +
        cleanName.slice(1)
      );
    }, []);

  /*
   * Validate avatar URLs.
   */
  const getAvatarSource =
    useCallback(
      (avatarString) => {
        if (
          avatarString &&
          typeof avatarString ===
            "string" &&
          (
            avatarString.startsWith(
              "data:"
            ) ||
            avatarString.startsWith(
              "http://"
            ) ||
            avatarString.startsWith(
              "https://"
            )
          )
        ) {
          return {
            uri: avatarString,
          };
        }

        return FALLBACK_AVATAR;
      },
      []
    );

  /*
   * Render one friend card.
   */
  const renderFriend =
    useCallback(
      ({ item }) => {
        const userId =
          String(
            item?.userId || ""
          );

        const isFollowing =
          Object.prototype.hasOwnProperty.call(
            followingUsers,
            userId
          )
            ? Boolean(
                followingUsers[
                  userId
                ]
              )
            : Boolean(
                item?.isFollowing
              );

        const isUpdating =
          Boolean(
            followLoading[
              userId
            ]
          );

        /*
         * MusicCard originally receives an avatar URI.
         * Keep this value as a string for compatibility.
         */
        const avatar =
          item?.avatar &&
          typeof item.avatar ===
            "string"
            ? item.avatar
            : "";

        return (
          <View
            style={[
              styles.friendCardWrapper,
              isDesktopWeb &&
                styles.desktopFriendCardWrapper,
            ]}
          >
            <MusicCard
              id={userId}
              name={formatUsername(
                item?.username
              )}
              image={avatar}
              imageSource={getAvatarSource(
                avatar
              )}
              isFollowing={
                isFollowing
              }
              userCard
              canFollow
              followLoading={
                isUpdating
              }
              disabled={
                isUpdating
              }
              onFollow={() => {
                if (isUpdating) {
                  return;
                }

                if (isFollowing) {
                  handleUnfollow(
                    item
                  );
                } else {
                  handleFollow(
                    item
                  );
                }
              }}
              onPressCard={() =>
                navigation.navigate(
                  "UserProfiles",
                  {
                    userId,
                  }
                )
              }
            />
          </View>
        );
      },
      [
        followLoading,
        followingUsers,
        formatUsername,
        getAvatarSource,
        handleFollow,
        handleUnfollow,
        isDesktopWeb,
        navigation,
      ]
    );

  const keyExtractor =
    useCallback(
      (item, index) =>
        String(
          item?.userId ||
          item?.uid ||
          item?.id ||
          index
        ),
      []
    );

  const renderEmpty =
    useCallback(() => {
      return (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Image
            source={
              FALLBACK_AVATAR
            }
            style={
              styles.emptyIcon
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            No friends found
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            Search for people and start connecting with other music fans.
          </Text>
        </View>
      );
    }, []);

  return (
    <View
      style={[
        styles.container,
        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* =====================================================
          TOP HEADER
      ===================================================== */}
      {isDesktopWeb ? (
        <View
          style={[
            styles.pageHeader,
            styles.desktopPageHeader,
          ]}
        >
          <View style={styles.searchContainer}>
            <SearchBar />
          </View>

          <TouchableOpacity
            style={styles.notificationsButton}
            onPress={() =>
              navigation.navigate(
                "Notifications"
              )
            }
          >
            <Image
              source={require(
                "../images/notificationsIcon2.png"
              )}
              style={styles.notificationIcon}
            />

            {notificationsCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationsCount > 99
                    ? "99+"
                    : notificationsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mobileTopHeader}>
          {/* Keep a dedicated area for the Sidebar hamburger. */}
          <View style={styles.mobileHamburgerSpace} />

          <View style={styles.mobileSearchContainer}>
            <SearchBar />
          </View>

          <TouchableOpacity
            style={[
              styles.notificationsButton,
              styles.mobileNotificationsButton,
            ]}
            onPress={() =>
              navigation.navigate(
                "Notifications"
              )
            }
          >
            <Image
              source={require(
                "../images/notificationsIcon2.png"
              )}
              style={styles.notificationIcon}
            />

            {notificationsCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationsCount > 99
                    ? "99+"
                    : notificationsCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      )}

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
        <View
          style={[
            styles.contentInner,
            isDesktopWeb &&
              styles.desktopContentInner,
          ]}
        >
          <View
            style={
              styles.titleContainer
            }
          >
            <Text
              style={
                styles.pageTitle
              }
            >
              Friends
            </Text>

            <Text
              style={
                styles.pageDescription
              }
            >
              View your friends, manage who you follow, and discover what they are listening to.
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.friendCount
                }
              >
                {friendsList.length}{" "}
                {friendsList.length ===
                1
                  ? "friend"
                  : "friends"}
              </Text>
            ) : null}
          </View>

          {loading ? (
            <View
              style={
                styles.loadingContainer
              }
            >
              <ActivityIndicator
                size="large"
                color="#ffffff"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading friends...
              </Text>
            </View>
          ) : (
            <FlatList
              data={
                friendsList
              }
              renderItem={
                renderFriend
              }
              keyExtractor={
                keyExtractor
              }
              style={[
                styles.friendsList,
                isWeb &&
                  styles.webFriendsList,
              ]}
              contentContainerStyle={[
                styles.friendsListContent,
                isDesktopWeb &&
                  styles.desktopFriendsListContent,
                friendsList.length ===
                  0 &&
                  styles.emptyListContent,
              ]}
              ListEmptyComponent={
                renderEmpty
              }
              refreshControl={
                <RefreshControl
                  refreshing={
                    refreshing
                  }
                  onRefresh={
                    handleRefresh
                  }
                  tintColor="#ffffff"
                  colors={[
                    "#ffffff",
                  ]}
                  progressBackgroundColor={
                    colours.darkblue
                  }
                />
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled
              removeClippedSubviews={
                false
              }
            />
          )}
        </View>
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

  /* =====================================================
     HEADER
  ===================================================== */

  pageHeader: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,

    zIndex: 50,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 18,

    backgroundColor:
      colours.background,
  },

  desktopPageHeader: {
    left:
      DESKTOP_SIDEBAR_WIDTH,

    height:
      DESKTOP_HEADER_HEIGHT,

    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 32,
    paddingRight: 32,
  },

  mobilePageHeader: {
    height: 92,

    paddingTop: 12,
    paddingBottom: 8,
  },

  searchContainer: {
    flex: 1,
    minWidth: 0,
  },

  mobileTopHeader: {
    position: "absolute",

    top: 28,
    left: 12,
    right: 12,

    minHeight: 52,

    flexDirection: "row",
    alignItems: "center",

    zIndex: 70,
    elevation: 15,
  },

  /*
   * Reserve space for the Sidebar hamburger so the search
   * field cannot slide underneath it.
   */
  mobileHamburgerSpace: {
    width: 58,
    flexShrink: 0,
  },

  mobileSearchContainer: {
    flex: 1,
    minWidth: 0,

    marginLeft: 12,
  },

  mobileNotificationsButton: {
    width: 46,
    height: 46,

    marginLeft: 12,

    borderRadius: 23,
  },

  notificationsButton: {
    position: "relative",

    width: 48,
    height: 48,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 14,

    borderRadius: 24,

    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  notificationIcon: {
    width: 29,
    height: 29,

    resizeMode: "contain",
  },

  notificationBadge: {
    position: "absolute",

    top: -4,
    right: -4,

    minWidth: 21,
    height: 21,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 5,

    borderWidth: 2,
    borderColor:
      colours.background,

    borderRadius: 11,

    backgroundColor:
      "#ff334f",
  },

  notificationBadgeText: {
    color: "#ffffff",

    fontSize: 10,
    fontWeight: "800",
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

    top:
      DESKTOP_HEADER_HEIGHT,

    left:
      DESKTOP_SIDEBAR_WIDTH,

    right: 0,

    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 18,
    paddingLeft: 28,
    paddingRight: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 92,
    left: 0,
    right: 0,

    bottom:
      BOTTOM_NAV_HEIGHT,

    minHeight: 0,

    paddingTop: 14,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  contentInner: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  desktopContentInner: {
    width: "100%",
    maxWidth:
      MAX_CONTENT_WIDTH,

    alignSelf: "center",
  },

  /* =====================================================
     TITLE
  ===================================================== */

  titleContainer: {
    width: "100%",

    marginBottom: 12,
  },

  pageTitle: {
    color: "#ffffff",

    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
  },

  pageDescription: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  friendCount: {
    color:
      colours.lightblue,

    fontSize: 13,
    fontWeight: "700",

    marginTop: 8,
  },

  /* =====================================================
     LOADING
  ===================================================== */

  loadingContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingBottom: 80,
  },

  loadingText: {
    color:
      "rgba(255,255,255,0.65)",

    fontSize: 14,

    marginTop: 12,
  },

  /* =====================================================
     FRIEND LIST
  ===================================================== */

  friendsList: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webFriendsList: {
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

  friendsListContent: {
    width: "100%",

    paddingBottom: 40,
  },

  desktopFriendsListContent: {
    paddingBottom: 50,
  },

  friendCardWrapper: {
    width: "100%",

    alignSelf: "center",

    marginBottom: 13,
  },

  desktopFriendCardWrapper: {
    width: "100%",
    maxWidth: 760,
  },

  /* =====================================================
     EMPTY STATE
  ===================================================== */

  emptyListContent: {
    flexGrow: 1,

    justifyContent: "center",
  },

  emptyContainer: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 25,
    paddingBottom: 80,
  },

  emptyIcon: {
    width: 72,
    height: 72,

    resizeMode: "contain",

    opacity: 0.45,

    marginBottom: 16,
  },

  emptyTitle: {
    color: "#ffffff",

    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",

    textAlign: "center",
  },

  emptyDescription: {
    maxWidth: 420,

    color:
      "rgba(255,255,255,0.55)",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",

    marginTop: 6,
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