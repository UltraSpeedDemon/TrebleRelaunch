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

import {
  getFollowRequests,
  respondFollowRequest,
} from "../providers/rest";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 820;

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

export default function Notifications({
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

  const [
    followRequests,
    setFollowRequests,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [
    responseLoading,
    setResponseLoading,
  ] = useState({});

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
   * Normalize follow-request objects.
   */
  const normalizeRequest =
    useCallback((item) => {
      const userId =
        item?.userId ||
        item?.uid ||
        item?.requesterId ||
        item?.fromUserId ||
        item?.id ||
        "";

      return {
        ...item,

        userId:
          String(userId),

        username:
          item?.username ||
          item?.displayName ||
          item?.name ||
          "Treble User",

        avatar:
          item?.avatar ||
          item?.image ||
          item?.profilePicture ||
          "",
      };
    }, []);

  /*
   * Load pending follow requests.
   */
  const fetchFollowRequests =
    useCallback(
      async (isRefresh = false) => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          setFollowRequests([]);
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
            await getFollowRequests(
              currentUser.uid
            );

          const data =
            await parseResponse(
              response,
              "Unable to load notifications."
            );

          const rawRequests =
            Array.isArray(data)
              ? data
              : Array.isArray(
                    data?.requests
                )
                ? data.requests
                : Array.isArray(
                      data?.followRequests
                  )
                  ? data.followRequests
                  : [];

          setFollowRequests(
            rawRequests
              .map(normalizeRequest)
              .filter(
                (item) =>
                  Boolean(item?.userId)
              )
          );
        } catch (error) {
          console.error(
            "[Notifications] Load error:",
            error
          );

          setFollowRequests([]);

          Alert.alert(
            "Unable to load notifications",
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
        normalizeRequest,
        parseResponse,
      ]
    );

  /*
   * Reload whenever the page is focused.
   */
  useFocusEffect(
    useCallback(() => {
      fetchFollowRequests(false);
    }, [fetchFollowRequests])
  );

  /*
   * Pull-to-refresh.
   */
  const handleRefresh =
    useCallback(() => {
      fetchFollowRequests(true);
    }, [fetchFollowRequests]);

  /*
   * Accept or deny a request.
   */
  const handleResponse =
    useCallback(
      async (
        followerId,
        accept
      ) => {
        const currentUser =
          auth.currentUser;

        const cleanFollowerId =
          String(
            followerId || ""
          );

        if (
          !currentUser?.uid ||
          !cleanFollowerId ||
          responseLoading[
            cleanFollowerId
          ]
        ) {
          return;
        }

        setResponseLoading(
          (current) => ({
            ...current,
            [cleanFollowerId]:
              true,
          })
        );

        /*
         * Remove it immediately for a faster UI.
         */
        const existingRequests =
          followRequests;

        setFollowRequests(
          (current) =>
            current.filter(
              (request) =>
                request.userId !==
                cleanFollowerId
            )
        );

        try {
          const response =
            await respondFollowRequest(
              currentUser.uid,
              cleanFollowerId,
              accept
            );

          await parseResponse(
            response,
            "Unable to process the follow request."
          );

          Alert.alert(
            accept
              ? "Request accepted"
              : "Request denied",
            accept
              ? "This user can now follow you."
              : "The follow request was denied."
          );
        } catch (error) {
          console.error(
            "[Notifications] Response error:",
            error
          );

          setFollowRequests(
            existingRequests
          );

          Alert.alert(
            "Unable to process request",
            error?.message ||
              "Please try again."
          );
        } finally {
          setResponseLoading(
            (current) => {
              const updated = {
                ...current,
              };

              delete updated[
                cleanFollowerId
              ];

              return updated;
            }
          );
        }
      },
      [
        followRequests,
        parseResponse,
        responseLoading,
      ]
    );

  /*
   * Format names.
   */
  const formatUsername =
    useCallback((name) => {
      const cleanName =
        String(name || "").trim();

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
   * Validate avatar sources.
   */
  const getAvatarSource =
    useCallback((avatar) => {
      if (
        avatar &&
        typeof avatar ===
          "string" &&
        avatar !== "None" &&
        (
          avatar.startsWith(
            "data:"
          ) ||
          avatar.startsWith(
            "http://"
          ) ||
          avatar.startsWith(
            "https://"
          )
        )
      ) {
        return {
          uri: avatar,
        };
      }

      return FALLBACK_AVATAR;
    }, []);

  /*
   * Render one notification.
   */
  const renderRequest =
    useCallback(
      ({ item }) => {
        const isProcessing =
          Boolean(
            responseLoading[
              item.userId
            ]
          );

        return (
          <View
            style={[
              styles.requestCard,
              isCompact &&
                styles.compactRequestCard,
            ]}
          >
            <TouchableOpacity
              style={
                styles.userInfoTouchable
              }
              onPress={() =>
                navigation.navigate(
                  "UserProfiles",
                  {
                    userId:
                      item.userId,
                  }
                )
              }
              activeOpacity={0.8}
            >
              <Image
                source={getAvatarSource(
                  item.avatar
                )}
                style={styles.avatar}
              />

              <View
                style={
                  styles.requestInfo
                }
              >
                <Text
                  style={
                    styles.username
                  }
                  numberOfLines={1}
                >
                  {formatUsername(
                    item.username
                  )}
                </Text>

                <Text
                  style={
                    styles.requestText
                  }
                >
                  wants to follow you.
                </Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.buttonContainer,
                isCompact &&
                  styles.compactButtonContainer,
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.acceptButton,
                  isProcessing &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  handleResponse(
                    item.userId,
                    true
                  )
                }
                disabled={isProcessing}
              >
                {isProcessing ? (
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
                    Accept
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.denyButton,
                  isProcessing &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  handleResponse(
                    item.userId,
                    false
                  )
                }
                disabled={isProcessing}
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Deny
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [
        formatUsername,
        getAvatarSource,
        handleResponse,
        isCompact,
        navigation,
        responseLoading,
      ]
    );

  const keyExtractor =
    useCallback(
      (item, index) =>
        String(
          item?.userId ||
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
            source={require(
              "../images/notificationsIcon2.png"
            )}
            style={
              styles.emptyIcon
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            No new notifications
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            New follow requests will appear here.
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
              styles.headerContainer
            }
          >
            <Text
              style={
                styles.header
              }
            >
              Notifications
            </Text>

            <Text
              style={
                styles.subHeader
              }
            >
              Review and respond to follow requests.
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.notificationCount
                }
              >
                {followRequests.length}{" "}
                {followRequests.length ===
                1
                  ? "request"
                  : "requests"}
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
                  colours.lightblue
                }
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading notifications...
              </Text>
            </View>
          ) : (
            <FlatList
              data={
                followRequests
              }
              keyExtractor={
                keyExtractor
              }
              renderItem={
                renderRequest
              }
              ListEmptyComponent={
                renderEmpty
              }
              style={[
                styles.notificationsList,
                isWeb &&
                  styles.webNotificationsList,
              ]}
              contentContainerStyle={[
                styles.listContent,
                followRequests.length ===
                  0 &&
                  styles.emptyListContent,
              ]}
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
              removeClippedSubviews={
                false
              }
            />
          )}
        </View>
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

    paddingTop: 26,
    paddingLeft: 28,
    paddingRight: 28,

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

    paddingTop: 75,
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
     HEADER
  ===================================================== */

  headerContainer: {
    width: "100%",

    marginBottom: 18,
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
      "rgba(255,255,255,0.58)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  notificationCount: {
    color:
      colours.lightblue,

    fontSize: 13,
    fontWeight: "700",

    marginTop: 7,
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
     LIST
  ===================================================== */

  notificationsList: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webNotificationsList: {
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

  listContent: {
    width: "100%",

    paddingBottom: 45,
  },

  emptyListContent: {
    flexGrow: 1,

    justifyContent: "center",
  },

  /* =====================================================
     REQUEST CARDS
  ===================================================== */

  requestCard: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    padding: 17,
    marginBottom: 13,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 16,

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

  compactRequestCard: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  userInfoTouchable: {
    flex: 1,
    minWidth: 0,

    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 56,
    height: 56,

    borderRadius: 28,

    marginRight: 13,

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  requestInfo: {
    flex: 1,
    minWidth: 0,
  },

  username: {
    color: "#ffffff",

    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  requestText: {
    color:
      "rgba(255,255,255,0.55)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 2,
  },

  /* =====================================================
     BUTTONS
  ===================================================== */

  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",

    marginLeft: 14,
  },

  compactButtonContainer: {
    width: "100%",

    marginLeft: 0,
    marginTop: 15,
  },

  actionButton: {
    minWidth: 92,
    minHeight: 42,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 16,

    borderRadius: 21,
  },

  acceptButton: {
    backgroundColor:
      colours.lightblue,

    marginRight: 8,
  },

  denyButton: {
    backgroundColor:
      "#d94343",
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
     EMPTY STATE
  ===================================================== */

  emptyContainer: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 24,
    paddingBottom: 80,
  },

  emptyIcon: {
    width: 70,
    height: 70,

    resizeMode: "contain",

    opacity: 0.42,

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
    color:
      "rgba(255,255,255,0.52)",

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