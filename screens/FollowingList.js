import React, {
  useCallback,
  useEffect,
  useMemo,
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

import {
  getFollowers,
  getFollowing,
  getFollowRequests,
  getUser,
  unfollowUser,
} from "../providers/rest";

import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import SearchBar from "../components/SearchBar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const DESKTOP_HEADER_HEIGHT = 70;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 900;

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

const NOTIFICATIONS_ICON =
  require("../images/notificationsIcon2.png");

export default function FollowingList({
  navigation,
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

  const gridColumns =
    width >= 1180
      ? 4
      : width >= 820
        ? 3
        : 2;

  const [
    followingList,
    setFollowingList,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    notificationsCount,
    setNotificationsCount,
  ] = useState(0);

  const [
    followingUsers,
    setFollowingUsers,
  ] = useState({});

  const [
    followsMeUsers,
    setFollowsMeUsers,
  ] = useState({});

  const [
    followLoading,
    setFollowLoading,
  ] = useState({});

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const currentUserId =
    String(
      auth.currentUser?.uid ||
      ""
    );

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  const parseResponse =
    useCallback(
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
            "The backend returned invalid data."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            `${fallbackMessage} HTTP ${response.status}`
          );
        }

        return data;
      },
      []
    );

  const normalizeUsers =
    useCallback((data) => {
      const users =
        Array.isArray(data)
          ? data
          : Array.isArray(
                data?.following
            )
            ? data.following
            : Array.isArray(
                  data?.users
              )
              ? data.users
              : [];

      return users
        .map((user) => {
          const userId =
            String(
              user?.userId ||
              user?.uid ||
              user?.id ||
              ""
            );

          return {
            ...user,

            userId,

            username:
              String(
                user?.username ||
                user?.displayName ||
                user?.name ||
                "Treble User"
              ).trim(),

            avatar:
              typeof user?.avatar ===
                "string" &&
              user.avatar !== "None"
                ? user.avatar
                : "",

            isPublic:
              user?.isPublic === true ||
              user?.isPublic === "true" ||
              user?.isPublic === 1,

            isFollowing: true,
          };
        })
        .filter(
          (user) =>
            Boolean(user.userId)
        );
    }, []);

  const getRelationshipUserId =
    useCallback((user) => {
      return String(
        user?.userId ||
        user?.uid ||
        user?.id ||
        user?.followerId ||
        user?.follower_id ||
        ""
      );
    }, []);

  const loadNotifications =
    useCallback(async () => {
      if (!currentUserId) {
        setNotificationsCount(0);
        return;
      }

      try {
        const response =
          await getFollowRequests(
            currentUserId
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
          "[FollowingList] Notifications error:",
          error
        );

        setNotificationsCount(0);
      }
    }, [
      currentUserId,
      parseResponse,
    ]);

  const loadFollowing =
    useCallback(
      async (
        isRefresh = false
      ) => {
        if (!currentUserId) {
          setFollowingList([]);
          setFollowingUsers({});
          setFollowsMeUsers({});
          setLoading(false);
          setRefreshing(false);
          return;
        }

        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setErrorMessage("");

          const [
            followingResponse,
            followersResponse,
          ] = await Promise.all([
            getFollowing(
              currentUserId
            ),

            getFollowers(
              currentUserId
            ),
          ]);

          const followingData =
            await parseResponse(
              followingResponse,
              "Unable to load your following list."
            );

          const rawUsers =
            normalizeUsers(
              followingData
            );

          const users =
            await Promise.all(
              rawUsers.map(
                async (user) => {
                  if (
                    user.username !==
                      "Treble User" &&
                    user.avatar
                  ) {
                    return user;
                  }

                  try {
                    const userResponse =
                      await getUser(
                        user.userId
                      );

                    if (!userResponse?.ok) {
                      return user;
                    }

                    const userData =
                      await userResponse.json();

                    return (
                      normalizeUsers([
                        {
                          ...user,
                          ...userData,

                          userId:
                            user.userId,
                        },
                      ])[0] || user
                    );
                  } catch (error) {
                    console.warn(
                      `[FollowingList] Unable to enrich ${user.userId}:`,
                      error
                    );

                    return user;
                  }
                }
              )
            );

          setFollowingList(
            users
          );

          setFollowingUsers(
            users.reduce(
              (
                result,
                user
              ) => {
                result[user.userId] =
                  true;

                return result;
              },
              {}
            )
          );

          if (followersResponse?.ok) {
            const followersData =
              await followersResponse.json();

            const followerIds =
              new Set(
                normalizeUsers(
                  followersData
                )
                  .map(
                    getRelationshipUserId
                  )
                  .filter(Boolean)
              );

            setFollowsMeUsers(
              users.reduce(
                (
                  result,
                  user
                ) => {
                  result[user.userId] =
                    followerIds.has(
                      user.userId
                    );

                  return result;
                },
                {}
              )
            );
          } else {
            setFollowsMeUsers({});
          }
        } catch (error) {
          console.error(
            "[FollowingList] Load error:",
            error
          );

          setFollowingList([]);
          setFollowingUsers({});
          setFollowsMeUsers({});

          setErrorMessage(
            error?.message ||
            "Unable to load your following list."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        currentUserId,
        getRelationshipUserId,
        normalizeUsers,
        parseResponse,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      loadFollowing(false);
      loadNotifications();
    }, [
      loadFollowing,
      loadNotifications,
    ])
  );

  const handleRefresh =
    useCallback(async () => {
      await Promise.all([
        loadFollowing(true),
        loadNotifications(),
      ]);
    }, [
      loadFollowing,
      loadNotifications,
    ]);

  const handleUnfollow =
    useCallback(
      async (user) => {
        const targetUserId =
          String(
            user?.userId ||
            ""
          );

        if (
          !currentUserId ||
          !targetUserId ||
          followLoading[
            targetUserId
          ]
        ) {
          return;
        }

        setFollowLoading(
          (current) => ({
            ...current,

            [targetUserId]:
              true,
          })
        );

        try {
          const response =
            await unfollowUser(
              currentUserId,
              targetUserId
            );

          await parseResponse(
            response,
            "Unable to unfollow this user."
          );

          setFollowingList(
            (current) =>
              current.filter(
                (item) =>
                  item.userId !==
                  targetUserId
              )
          );

          setFollowingUsers(
            (current) => ({
              ...current,

              [targetUserId]:
                false,
            })
          );

          setFollowsMeUsers(
            (current) => {
              const updated = {
                ...current,
              };

              delete updated[
                targetUserId
              ];

              return updated;
            }
          );
        } catch (error) {
          console.error(
            "[FollowingList] Unfollow error:",
            error
          );

          const message =
            error?.message ||
            "Please try again.";

          if (
            Platform.OS === "web"
          ) {
            window.alert(
              message
            );
          } else {
            Alert.alert(
              "Unable to unfollow",
              message
            );
          }
        } finally {
          setFollowLoading(
            (current) => {
              const updated = {
                ...current,
              };

              delete updated[
                targetUserId
              ];

              return updated;
            }
          );
        }
      },
      [
        currentUserId,
        followLoading,
        parseResponse,
      ]
    );

  const getAvatarSource =
    useCallback((avatar) => {
      if (
        typeof avatar ===
          "string" &&
        (
          avatar.startsWith(
            "http://"
          ) ||
          avatar.startsWith(
            "https://"
          ) ||
          avatar.startsWith(
            "data:"
          )
        )
      ) {
        return {
          uri: avatar,
        };
      }

      return FALLBACK_AVATAR;
    }, []);

  const renderFollowingUser =
    useCallback(
      ({ item }) => {
        const targetUserId =
          item.userId;

        const isCurrentUser =
          targetUserId ===
          currentUserId;

        const isFollowing =
          Object.prototype
            .hasOwnProperty
            .call(
              followingUsers,
              targetUserId
            )
            ? Boolean(
                followingUsers[
                  targetUserId
                ]
              )
            : true;

        const followsMe =
          Boolean(
            followsMeUsers[
              targetUserId
            ]
          );

        const isFriend =
          isFollowing &&
          followsMe;

        const isUpdating =
          Boolean(
            followLoading[
              targetUserId
            ]
          );

        const buttonLabel =
          isUpdating
            ? "Loading..."
            : isFriend
              ? "Friends"
              : "Following";

        return (
          <TouchableOpacity
            style={
              styles.userCard
            }
            activeOpacity={0.82}
            onPress={() =>
              navigation.navigate(
                "UserProfiles",
                {
                  userId:
                    targetUserId,
                }
              )
            }
          >
            <Image
              source={getAvatarSource(
                item.avatar
              )}
              style={
                styles.userAvatar
              }
              onError={(event) => {
                console.warn(
                  "[FollowingList] Avatar error:",
                  event?.nativeEvent
                    ?.error
                );
              }}
            />

            <View
              style={
                styles.userInformation
              }
            >
              <Text
                style={
                  styles.username
                }
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.username}
              </Text>

              <Text
                style={
                  styles.profileStatus
                }
                numberOfLines={1}
              >
                {isFriend
                  ? "Friends · Music sharing enabled"
                  : item.isPublic
                    ? "Public profile"
                    : "Private profile"}
              </Text>
            </View>

            {isCurrentUser ? (
              <View
                style={
                  styles.youBadge
                }
              >
                <Text
                  style={
                    styles.youBadgeText
                  }
                >
                  You
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.followButton,

                  isFollowing &&
                    styles.followingButton,

                  isUpdating &&
                    styles.disabledButton,
                ]}
                disabled={
                  isUpdating
                }
                onPress={(event) => {
                  event
                    ?.stopPropagation
                    ?.();

                  handleUnfollow(
                    item
                  );
                }}
              >
                {isUpdating ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.followButtonText
                    }
                    numberOfLines={1}
                  >
                    {buttonLabel}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      },
      [
        currentUserId,
        followLoading,
        followingUsers,
        followsMeUsers,
        getAvatarSource,
        handleUnfollow,
        navigation,
      ]
    );

  const listCountText =
    useMemo(() => {
      const count =
        followingList.length;

      return `${count} following`;
    }, [
      followingList.length,
    ]);

  return (
    <View
      style={[
        styles.container,

        isWeb &&
          styles.webContainer,
      ]}
    >
      <View
        style={[
          styles.pageHeader,

          isDesktopWeb &&
            styles.desktopPageHeader,

          isMobileWeb &&
            styles.mobilePageHeader,
        ]}
      >
        <View
          style={
            styles.searchContainer
          }
        >
          <SearchBar />
        </View>

        <TouchableOpacity
          style={
            styles.notificationsButton
          }
          onPress={() =>
            navigation.navigate(
              "Notifications"
            )
          }
        >
          <Image
            source={
              NOTIFICATIONS_ICON
            }
            style={
              styles.notificationsIcon
            }
          />

          {notificationsCount >
          0 ? (
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
                {notificationsCount >
                99
                  ? "99+"
                  : notificationsCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

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
              Following
            </Text>

            <Text
              style={
                styles.pageDescription
              }
            >
              Accounts you currently follow on Treble.
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.resultCount
                }
              >
                {listCountText}
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
                color={
                  colours.lightblue ||
                  "#35afe5"
                }
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading following...
              </Text>
            </View>
          ) : (
            <FlatList
              data={
                followingList
              }
              numColumns={gridColumns}
              key={`${followingList}-grid-${gridColumns}`}
              columnWrapperStyle={
                styles.userTileRow
              }
              renderItem={
                renderFollowingUser
              }
              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item.userId ||
                  index
                )
              }
              style={[
                styles.userList,

                isWeb &&
                  styles.webUserList,
              ]}
              contentContainerStyle={[
                styles.userListContent,

                followingList.length ===
                  0 &&
                  styles.emptyListContent,
              ]}
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
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
              ListEmptyComponent={
                <View
                  style={
                    styles.emptyContainer
                  }
                >
                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    {errorMessage
                      ? "Unable to load following"
                      : "You are not following anyone yet"}
                  </Text>

                  <Text
                    style={
                      styles.emptyDescription
                    }
                  >
                    {errorMessage ||
                      "Find users through Search and follow them to see them here."}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>

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
        colours.bluegrey ||
        "#101010",
    },

    webContainer: {
      width: "100%",
      height: "100vh",

      minHeight: 0,

      overflow: "hidden",
    },

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
        colours.background ||
        colours.bluegrey ||
        "#101010",
    },

    desktopPageHeader: {
      left:
        DESKTOP_SIDEBAR_WIDTH,

      height:
        DESKTOP_HEADER_HEIGHT,

      paddingVertical: 9,
      paddingHorizontal: 32,
    },

    mobilePageHeader: {
      height: 105,

      paddingTop: 20,
      paddingBottom: 10,
    },

    searchContainer: {
      flex: 1,
      minWidth: 0,
    },

    notificationsButton: {
      position: "relative",

      width: 48,
      height: 48,

      flexShrink: 0,

      alignItems: "center",
      justifyContent: "center",

      marginLeft: 14,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 24,

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    notificationsIcon: {
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
        colours.background ||
        "#101010",

      borderRadius: 11,

      backgroundColor:
        "#ff4545",
    },

    notificationBadgeText: {
      color: "#ffffff",

      fontSize: 10,
      fontWeight: "800",
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

      paddingTop: 20,
      paddingHorizontal: 28,

      overflow: "hidden",
    },

    mobilePageContent: {
      position: "absolute",

      top: 105,
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

    titleContainer: {
      width: "100%",

      marginBottom: 18,
    },

    pageTitle: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 31,
      lineHeight: 38,
      fontWeight: "900",
    },

    pageDescription: {
      color:
        "rgba(255,255,255,0.6)",

      fontSize: 14,
      lineHeight: 20,

      marginTop: 3,
    },

    resultCount: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 13,
      fontWeight: "800",

      marginTop: 7,
    },

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

    userList: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webUserList: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      WebkitOverflowScrolling:
        "touch",

      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },

    userListContent: {
      width: "100%",

      paddingHorizontal: 2,
      paddingBottom: 56,
    },

    emptyListContent: {
      flexGrow: 1,
    },

    userTileRow: {
      width: "100%",
      gap: 14,
      alignItems: "stretch",
      justifyContent: "flex-start",
    },

    userCard: {
      flex: 1,
      minWidth: 0,
      maxWidth: 270,

      alignItems: "center",

      paddingHorizontal: 15,
      paddingTop: 18,
      paddingBottom: 16,

      marginBottom: 14,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.075)",

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.045)",

      ...(
        Platform.OS === "web"
          ? {
              cursor: "pointer",
              transitionDuration:
                "160ms",
              transitionProperty:
                "transform, border-color, background-color",
            }
          : {}
      ),
    },

    userAvatar: {
      width: 88,
      height: 88,

      borderRadius: 44,

      resizeMode: "cover",

      backgroundColor:
        "rgba(255,255,255,0.06)",

      borderWidth: 2,
      borderColor:
        "rgba(53,175,229,0.22)",

      marginBottom: 13,
    },

    userInformation: {
      width: "100%",
      minWidth: 0,

      alignItems: "center",
      justifyContent: "center",

      marginBottom: 14,
    },

    username: {
      width: "100%",

      color: "#ffffff",

      fontSize: 16,
      lineHeight: 22,
      fontWeight: "900",

      textAlign: "center",
    },

    profileStatus: {
      width: "100%",

      color:
        "rgba(255,255,255,0.50)",

      fontSize: 11,
      lineHeight: 16,

      textAlign: "center",

      marginTop: 4,
    },

    privacyStatus: {
      color:
        "rgba(255,255,255,0.36)",

      fontSize: 10,
      lineHeight: 14,

      textAlign: "center",

      marginTop: 2,
    },

    followButton: {
      width: "100%",
      minHeight: 39,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 13,

      borderRadius: 12,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    followingButton: {
      backgroundColor:
        "rgba(53,175,229,0.16)",

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.44)",
    },

    requestedButton: {
      backgroundColor:
        "rgba(255,255,255,0.07)",

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.12)",
    },

    disabledButton: {
      opacity: 0.62,
    },

    followButtonText: {
      color: "#ffffff",

      fontSize: 12,
      fontWeight: "900",
    },

    youBadge: {
      width: "100%",
      minHeight: 37,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 13,

      borderWidth: 1,
      borderColor:
        colours.lightblue ||
        "#35afe5",

      borderRadius: 12,

      backgroundColor:
        "rgba(53,175,229,0.12)",
    },

    youBadgeText: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 12,
      fontWeight: "900",
    },

    emptyContainer: {
      flex: 1,

      minHeight: 300,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 24,
      paddingBottom: 80,
    },

    emptyTitle: {
      color: "#ffffff",

      fontSize: 22,
      fontWeight: "900",

      textAlign: "center",
    },

    emptyDescription: {
      maxWidth: 430,

      color:
        "rgba(255,255,255,0.55)",

      fontSize: 14,
      lineHeight: 21,

      textAlign: "center",

      marginTop: 7,
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