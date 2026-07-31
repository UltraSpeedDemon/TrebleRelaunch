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
  getFollowRequests,
  getNotifications,
  getSharedItems,
  getUser,
  markNotificationsRead,
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

const NOTIFICATIONS_ICON =
  require("../images/notificationsIcon2.png");

const NOTIFICATION_TYPES = {
  FOLLOW: "follow",

  FOLLOW_REQUEST:
    "follow_request",

  FOLLOW_ACCEPTED:
    "follow_accepted",

  MUSIC_SHARED:
    "music_share",
};

export default function Notifications({
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

  const isCompact =
    width < 600;

  const [
    notifications,
    setNotifications,
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
    responseLoading,
    setResponseLoading,
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

  /*
   * Keep desktop sidebar open.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

  /*
   * Safely parse backend responses.
   */
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

  /*
   * Extract arrays from different
   * possible backend response shapes.
   */
  const normalizeArray =
    useCallback(
      (
        data,
        possibleKeys = []
      ) => {
        if (Array.isArray(data)) {
          return data;
        }

        for (
          const key of possibleKeys
        ) {
          if (
            Array.isArray(
              data?.[key]
            )
          ) {
            return data[key];
          }
        }

        return [];
      },
      []
    );

  /*
   * Extract the user responsible
   * for the notification.
   */
  const getNotificationUserId =
    useCallback((item) => {
      return String(
        item?.fromUserId ||
        item?.from_user_id ||
        item?.requesterId ||
        item?.requester_id ||
        item?.followerId ||
        item?.follower_id ||
        item?.userId ||
        item?.uid ||
        ""
      );
    }, []);

  /*
   * Normalize notification types.
   */
  const normalizeNotificationType =
    useCallback((type) => {
      const cleanType =
        String(type || "")
          .trim()
          .toLowerCase()
          .replaceAll("-", "_")
          .replaceAll(" ", "_");

      if (
        cleanType ===
          "follow_request" ||
        cleanType ===
          "request_follow" ||
        cleanType ===
          "followrequest"
      ) {
        return NOTIFICATION_TYPES
          .FOLLOW_REQUEST;
      }

      if (
        cleanType ===
          "follow_accepted" ||
        cleanType ===
          "request_accepted" ||
        cleanType ===
          "followaccepted"
      ) {
        return NOTIFICATION_TYPES
          .FOLLOW_ACCEPTED;
      }

      if (
        cleanType === "music_share" ||
        cleanType === "music_shared" ||
        cleanType === "song_shared" ||
        cleanType === "shared_song" ||
        cleanType === "songshare"
      ) {
        return NOTIFICATION_TYPES
          .MUSIC_SHARED;
      }

      return NOTIFICATION_TYPES
        .FOLLOW;
    }, []);

  /*
   * Normalize notification data.
   */
  const normalizeNotification =
    useCallback(
      (
        item,
        forcedType = null
      ) => {
        const userId =
          getNotificationUserId(
            item
          );

        const type =
          normalizeNotificationType(
            forcedType ||
            item?.type ||
            item?.notificationType ||
            item?.notification_type
          );

        return {
          ...item,

          id:
            String(
              item?.notificationId ||
              item?.notification_id ||
              item?.requestId ||
              item?.request_id ||
              item?.id ||
              `${type}-${userId}`
            ),

          type,

          userId,

          username:
            String(
              item?.username ||
              item?.displayName ||
              item?.display_name ||
              item?.name ||
              "Treble User"
            ).trim(),

          avatar:
            typeof item?.avatar ===
              "string" &&
            item.avatar !== "None"
              ? item.avatar
              : typeof item
                    ?.profilePicture ===
                  "string"
                ? item.profilePicture
                : typeof item
                      ?.profile_picture ===
                    "string"
                  ? item.profile_picture
                  : "",

          read:
            item?.read === true ||
            item?.read === "true" ||
            item?.read === 1 ||
            item?.isRead === true ||
            item?.is_read === true,

          createdAt:
            item?.createdAt ||
            item?.created_at ||
            item?.timestamp ||
            item?.date ||
            null,

          targetId:
          String(
            item?.itemId ||
            item?.item_id ||
            item?.songId ||
            item?.song_id ||
            item?.targetId ||
            item?.target_id ||
            ""
          ),

        shareId:
          String(
            item?.shareId ||
            item?.share_id ||
            ""
          ),

        itemType:
          String(
            item?.itemType ||
            item?.item_type ||
            item?.musicType ||
            item?.music_type ||
            "track"
          )
            .trim()
            .toLowerCase(),

        itemData:
          item?.itemData ||
          item?.item_data ||
          item?.track ||
          item?.musicItem ||
          null,

        songTitle:
          String(
            item?.songTitle ||
            item?.song_title ||
            item?.targetTitle ||
            item?.target_title ||
            item?.itemData?.title ||
            item?.itemData?.name ||
            ""
          ),

        comment:
          String(
            item?.comment ||
            item?.message ||
            item?.description ||
            ""
          ).trim(),
        };
      },
      [
        getNotificationUserId,
        normalizeNotificationType,
      ]
    );

  /*
   * Fetch missing account details.
   */
  const enrichNotification =
    useCallback(
      async (notification) => {
        if (!notification?.userId) {
          return notification;
        }

        const needsUsername =
          !notification.username ||
          notification.username ===
            "Treble User";

        const needsAvatar =
          !notification.avatar;

        if (
          !needsUsername &&
          !needsAvatar
        ) {
          return notification;
        }

        try {
          const response =
            await getUser(
              notification.userId
            );

          if (!response?.ok) {
            return notification;
          }

          const userData =
            await response.json();

          return {
            ...notification,

            username:
              String(
                userData?.username ||
                userData?.displayName ||
                userData?.display_name ||
                userData?.name ||
                notification.username ||
                "Treble User"
              ).trim(),

            avatar:
              typeof userData?.avatar ===
                "string" &&
              userData.avatar !== "None"
                ? userData.avatar
                : notification.avatar,
          };
        } catch (error) {
          console.warn(
            `[Notifications] Unable to enrich ${notification.userId}:`,
            error
          );

          return notification;
        }
      },
      []
    );

  /*
   * Sort newest notifications first.
   */
  const sortNotifications =
    useCallback((items) => {
      return [...items].sort(
        (
          first,
          second
        ) => {
          const firstTime =
            new Date(
              first?.createdAt || 0
            ).getTime();

          const secondTime =
            new Date(
              second?.createdAt || 0
            ).getTime();

          return (
            secondTime -
            firstTime
          );
        }
      );
    }, []);

  /*
   * Remove duplicate notifications.
   *
   * Follow requests might be returned by
   * both the notification endpoint and
   * the old follow-request endpoint.
   */
  const removeDuplicates =
    useCallback((items) => {
      const seen =
        new Set();

      return items.filter(
        (item) => {
          const duplicateKey =
            item.type ===
            NOTIFICATION_TYPES
              .FOLLOW_REQUEST
              ? `${item.type}-${item.userId}`
              : item.id;

          if (
            seen.has(
              duplicateKey
            )
          ) {
            return false;
          }

          seen.add(
            duplicateKey
          );

          return true;
        }
      );
    }, []);

  /*
   * Load all notifications.
   */
  const fetchNotifications =
    useCallback(
      async (
        isRefresh = false
      ) => {
        if (!currentUserId) {
          setNotifications([]);
          setLoading(false);
          setRefreshing(false);

          navigation.navigate(
            "Home"
          );

          return;
        }

        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setErrorMessage("");

          /*
           * Load the full notification feed
           * and pending private requests.
           */
          const [
            notificationResponse,
            requestResponse,
            sharedItemsResponse,
          ] = await Promise.all([
            getNotifications(
              currentUserId
            ),

            getFollowRequests(
              currentUserId
            ),

            getSharedItems(
              currentUserId
            ),
          ]);

          let notificationItems =
            [];

          let requestItems =
            [];

          /*
           * Normal notifications:
           * follow, accepted and song shared.
           */
          if (
            notificationResponse?.ok
          ) {
            const data =
              await parseResponse(
                notificationResponse,
                "Unable to load notifications."
              );

            notificationItems =
              normalizeArray(
                data,
                [
                  "notifications",
                  "results",
                  "items",
                ]
              ).map(
                (item) =>
                  normalizeNotification(
                    item
                  )
              );
          }

          /*
           * Pending private follow requests.
           */
          if (
            requestResponse?.ok
          ) {
            const requestData =
              await parseResponse(
                requestResponse,
                "Unable to load follow requests."
              );

            requestItems =
              normalizeArray(
                requestData,
                [
                  "requests",
                  "followRequests",
                  "follow_requests",
                ]
              ).map(
                (item) =>
                  normalizeNotification(
                    item,
                    NOTIFICATION_TYPES
                      .FOLLOW_REQUEST
                  )
              );
          }

          let sharedItems = [];

          if (sharedItemsResponse?.ok) {
            try {
              const sharedData =
                await parseResponse(
                  sharedItemsResponse,
                  "Unable to load shared music."
                );

              sharedItems = normalizeArray(
                sharedData,
                ["sharedItems", "items", "results"]
              );
            } catch (sharedError) {
              console.warn(
                "[Notifications] Unable to enrich shared music:",
                sharedError
              );
            }
          }

          const sharedItemsById = new Map();

          sharedItems.forEach((sharedItem) => {
            const shareId = String(
              sharedItem?.shareId ||
              sharedItem?.share_id ||
              ""
            );

            if (shareId) {
              sharedItemsById.set(shareId, sharedItem);
            }
          });

          notificationItems = notificationItems.map(
            (notification) => {
              if (
                notification.type !==
                NOTIFICATION_TYPES.MUSIC_SHARED
              ) {
                return notification;
              }

              const legacyShareId = String(
                notification.shareId ||
                notification.targetId ||
                ""
              );

              const sharedItem =
                sharedItemsById.get(legacyShareId);

              if (!sharedItem) {
                return notification;
              }

              const itemData =
                sharedItem.item_info ||
                sharedItem.itemData ||
                sharedItem;

              return {
                ...notification,
                shareId:
                  sharedItem.shareId ||
                  legacyShareId,
                targetId: String(
                  itemData?.id ||
                  itemData?.listenableId ||
                  sharedItem?.id ||
                  notification.targetId ||
                  ""
                ),
                itemType:
                  itemData?.type ||
                  sharedItem?.type ||
                  notification.itemType ||
                  "track",
                itemData,
                songTitle:
                  itemData?.title ||
                  itemData?.name ||
                  notification.songTitle,
                comment:
                  sharedItem?.comment ||
                  notification.comment ||
                  "",
              };
            }
          );

          const mergedItems =
            removeDuplicates([
              ...notificationItems,
              ...requestItems,
            ]);

          const enrichedItems =
            await Promise.all(
              mergedItems.map(
                enrichNotification
              )
            );

          setNotifications(
            sortNotifications(
              enrichedItems
            )
          );

          /*
           * Mark normal notifications read
           * after the feed has loaded.
           */
          try {
            const unreadNormalIds =
              notificationItems
                .filter(
                  (item) =>
                    !item.read &&
                    item.id
                )
                .map(
                  (item) =>
                    item.id
                );

            if (
              unreadNormalIds.length >
              0
            ) {
              await markNotificationsRead(
                currentUserId,
                unreadNormalIds
              );

              setNotifications(
                (current) =>
                  current.map(
                    (item) => ({
                      ...item,
                      read:
                        item.type ===
                        NOTIFICATION_TYPES
                          .FOLLOW_REQUEST
                          ? item.read
                          : true,
                    })
                  )
              );
            }
          } catch (readError) {
            console.warn(
              "[Notifications] Unable to mark notifications read:",
              readError
            );
          }
        } catch (error) {
          console.error(
            "[Notifications] Load error:",
            error
          );

          setNotifications([]);

          setErrorMessage(
            error?.message ||
            "Unable to load notifications."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        currentUserId,
        enrichNotification,
        navigation,
        normalizeArray,
        normalizeNotification,
        parseResponse,
        removeDuplicates,
        sortNotifications,
      ]
    );

  /*
   * Reload when page is opened.
   */
  useFocusEffect(
    useCallback(() => {
      fetchNotifications(false);
    }, [
      fetchNotifications,
    ])
  );

  /*
   * Pull-to-refresh.
   */
  const handleRefresh =
    useCallback(() => {
      fetchNotifications(true);
    }, [
      fetchNotifications,
    ]);

  /*
   * Accept or deny a private request.
   */
  const handleResponse =
    useCallback(
      async (
        notification,
        accept
      ) => {
        const cleanFollowerId =
          String(
            notification?.userId ||
            ""
          );

        if (
          !currentUserId ||
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

        const existingNotifications =
          notifications;

        /*
         * Remove immediately for a
         * responsive interface.
         */
        setNotifications(
          (current) =>
            current.filter(
              (item) =>
                !(
                  item.type ===
                    NOTIFICATION_TYPES
                      .FOLLOW_REQUEST &&
                  item.userId ===
                    cleanFollowerId
                )
            )
        );

        try {
          const response =
            await respondFollowRequest(
              currentUserId,
              cleanFollowerId,
              accept
            );

          await parseResponse(
            response,
            "Unable to process the follow request."
          );

          const title =
            accept
              ? "Request accepted"
              : "Request denied";

          const message =
            accept
              ? "This user can now follow you."
              : "The follow request was denied.";

          if (
            Platform.OS === "web"
          ) {
            window.alert(
              `${title}\n\n${message}`
            );
          } else {
            Alert.alert(
              title,
              message
            );
          }
        } catch (error) {
          console.error(
            "[Notifications] Response error:",
            error
          );

          setNotifications(
            existingNotifications
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
              "Unable to process request",
              message
            );
          }
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
        currentUserId,
        notifications,
        parseResponse,
        responseLoading,
      ]
    );

  /*
   * Format usernames.
   */
  const formatUsername =
    useCallback((name) => {
      const cleanName =
        String(name || "")
          .trim();

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
   * Validate avatar.
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
   * Format notification time.
   */
  const formatNotificationTime =
    useCallback((value) => {
      if (!value) {
        return "";
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "";
      }

      const now =
        new Date();

      const difference =
        Math.max(
          0,
          now.getTime() -
            date.getTime()
        );

      const seconds =
        Math.floor(
          difference / 1000
        );

      const minutes =
        Math.floor(
          seconds / 60
        );

      const hours =
        Math.floor(
          minutes / 60
        );

      const days =
        Math.floor(
          hours / 24
        );

      if (seconds < 60) {
        return "Just now";
      }

      if (minutes < 60) {
        return `${minutes} ${
          minutes === 1
            ? "minute"
            : "minutes"
        } ago`;
      }

      if (hours < 24) {
        return `${hours} ${
          hours === 1
            ? "hour"
            : "hours"
        } ago`;
      }

      if (days < 7) {
        return `${days} ${
          days === 1
            ? "day"
            : "days"
        } ago`;
      }

      return date.toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",

          year:
            date.getFullYear() !==
            now.getFullYear()
              ? "numeric"
              : undefined,
        }
      );
    }, []);

  const getSharedMusicImage =
    useCallback((item) => {
      const music = item?.itemData || {};

      return (
        music?.image ||
        music?.coverArt ||
        music?.album?.cover_xl ||
        music?.album?.cover_big ||
        music?.album?.cover_medium ||
        ""
      );
    }, []);

  const getSharedMusicArtist =
    useCallback((item) => {
      const music = item?.itemData || {};

      return String(
        music?.artist?.name ||
        music?.artistName ||
        ""
      );
    }, []);

  const getSharedMusicAlbum =
    useCallback((item) => {
      const music = item?.itemData || {};

      return String(
        music?.album?.title ||
        music?.albumTitle ||
        ""
      );
    }, []);

  /*
   * Notification message.
   */
  const getNotificationText =
  useCallback((item) => {
    switch (item.type) {
      case NOTIFICATION_TYPES
        .FOLLOW_REQUEST:
        return "requested to follow you.";

      case NOTIFICATION_TYPES
        .FOLLOW_ACCEPTED:
        return "accepted your follow request.";

      case NOTIFICATION_TYPES
        .MUSIC_SHARED:
        return item.songTitle
          ? `shared “${item.songTitle}” with you.`
          : "shared music with you.";

      case NOTIFICATION_TYPES
        .FOLLOW:

      default:
        return "started following you.";
    }
  }, []);

  /*
   * Open notification destination.
   */
  const handleNotificationPress =
  useCallback(
    (item) => {
      if (
        item.type ===
        NOTIFICATION_TYPES.MUSIC_SHARED
      ) {
        const musicItem =
          item.itemData || {
            id: item.targetId,
            listenableId:
              item.targetId,
            listenable_id:
              item.targetId,
            type:
              item.itemType ||
              "track",
            title:
              item.songTitle ||
              "Shared music",
            name:
              item.songTitle ||
              "Shared music",
          };

        const musicType =
          String(
            item.itemType ||
            musicItem.type ||
            "track"
          ).toLowerCase();

        if (musicType === "artist") {
          navigation.navigate(
            "ArtistPage",
            {
              artist:
                musicItem,
            }
          );

          return;
        }

        if (musicType === "album") {
          navigation.navigate(
            "AlbumPage",
            {
              album:
                musicItem,
            }
          );

          return;
        }

        navigation.navigate(
          "SongPage",
          {
            track: {
              ...musicItem,

              id:
                musicItem.id ||
                item.targetId,

              type: "track",
            },
          }
        );

        return;
      }

      if (item.userId) {
        navigation.navigate(
          "UserProfiles",
          {
            userId:
              item.userId,
          }
        );
      }
    },
    [navigation]
  );

  /*
   * Render one notification.
   */
  const renderNotification =
    useCallback(
      ({ item }) => {
        const isRequest =
          item.type ===
          NOTIFICATION_TYPES
            .FOLLOW_REQUEST;

        const isProcessing =
          Boolean(
            responseLoading[
              item.userId
            ]
          );

        const isMusicShare =
          item.type ===
          NOTIFICATION_TYPES.MUSIC_SHARED;

        const musicImage =
          getSharedMusicImage(item);

        const musicArtist =
          getSharedMusicArtist(item);

        const musicAlbum =
          getSharedMusicAlbum(item);

        return (
          <View
            style={[
              styles.notificationCard,

              !item.read &&
                styles.unreadCard,

              isCompact &&
                styles.compactNotificationCard,
            ]}
          >
            {!item.read ? (
              <View
                style={
                  styles.unreadDot
                }
              />
            ) : null}

            <TouchableOpacity
              style={
                styles.notificationMain
              }
              activeOpacity={0.8}
              onPress={() =>
                handleNotificationPress(
                  item
                )
              }
            >
              <View style={styles.notificationImageWrap}>
                <Image
                  source={
                    isMusicShare && musicImage
                      ? { uri: musicImage }
                      : getAvatarSource(item.avatar)
                  }
                  style={[
                    styles.avatar,
                    isMusicShare &&
                      styles.musicThumbnail,
                  ]}
                />

                {isMusicShare ? (
                  <Image
                    source={getAvatarSource(item.avatar)}
                    style={styles.senderAvatarBadge}
                  />
                ) : null}
              </View>

              <View
                style={
                  styles.notificationInfo
                }
              >
                <Text
                  style={
                    styles.notificationMessage
                  }
                >
                  <Text
                    style={
                      styles.username
                    }
                  >
                    {formatUsername(
                      item.username
                    )}{" "}
                  </Text>

                  {getNotificationText(
                    item
                  )}
                </Text>

                {isMusicShare &&
                (musicArtist || musicAlbum) ? (
                  <Text
                    style={styles.sharedMusicMeta}
                    numberOfLines={1}
                  >
                    {[musicArtist, musicAlbum]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                ) : null}

                {isMusicShare &&
                item.comment ? (
                  <Text style={styles.sharedComment}>
                    “{item.comment}”
                  </Text>
                ) : null}

                {item.createdAt ? (
                  <Text
                    style={
                      styles.timeText
                    }
                  >
                    {formatNotificationTime(
                      item.createdAt
                    )}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>

            {isRequest ? (
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
                  disabled={
                    isProcessing
                  }
                  onPress={() =>
                    handleResponse(
                      item,
                      true
                    )
                  }
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
                  disabled={
                    isProcessing
                  }
                  onPress={() =>
                    handleResponse(
                      item,
                      false
                    )
                  }
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
            ) : (
              <TouchableOpacity
                style={
                  styles.viewButton
                }
                onPress={() =>
                  handleNotificationPress(
                    item
                  )
                }
              >
                <Text
                  style={
                    styles.viewButtonText
                  }
                >
                  {item.type ===
                  NOTIFICATION_TYPES
                    .MUSIC_SHARED
                    ? item.itemType === "artist"
                      ? "View Artist"
                      : item.itemType === "album"
                        ? "View Album"
                        : "View Song"
                    : "View Profile"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      },
      [
        formatNotificationTime,
        formatUsername,
        getAvatarSource,
        getNotificationText,
        getSharedMusicAlbum,
        getSharedMusicArtist,
        getSharedMusicImage,
        handleNotificationPress,
        handleResponse,
        isCompact,
        responseLoading,
      ]
    );

  /*
   * Unique list keys.
   */
  const keyExtractor =
    useCallback(
      (
        item,
        index
      ) => {
        return String(
          item?.id ||
          `${item?.type}-${item?.userId}-${index}`
        );
      },
      []
    );

  /*
   * Empty state.
   */
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
              NOTIFICATIONS_ICON
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
            {errorMessage
              ? "Unable to load notifications"
              : "No new notifications"}
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            {errorMessage ||
              "New followers, follow requests, and shared songs will appear here."}
          </Text>
        </View>
      );
    }, [
      errorMessage,
    ]);

  const notificationCountText =
    useMemo(() => {
      const count =
        notifications.length;

      return `${count} ${
        count === 1
          ? "notification"
          : "notifications"
      }`;
    }, [
      notifications.length,
    ]);

  return (
    <View
      style={[
        styles.container,

        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* SIDEBAR */}
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

      {/* CONTENT */}
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
              Followers, requests, shared music, and account activity.
            </Text>

            {!loading ? (
              <Text
                style={
                  styles.notificationCount
                }
              >
                {notificationCountText}
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
                notifications
              }
              keyExtractor={
                keyExtractor
              }
              renderItem={
                renderNotification
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

                notifications.length ===
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

      {/* BOTTOM NAVIGATION */}
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
        colours.background,
    },

    webContainer: {
      width: "100%",
      height: "100vh",

      minHeight: 0,

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

    notificationCard: {
      position: "relative",

      width: "100%",
      minHeight: 92,

      flexDirection: "row",
      alignItems: "center",

      padding: 16,
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

    unreadCard: {
      borderColor:
        "rgba(53,175,229,0.52)",

      backgroundColor:
        "rgba(24,62,82,0.98)",
    },

    compactNotificationCard: {
      flexDirection: "column",
      alignItems: "stretch",
    },

    unreadDot: {
      position: "absolute",

      top: 12,
      left: 12,

      width: 8,
      height: 8,

      borderRadius: 4,

      backgroundColor:
        colours.lightblue,

      zIndex: 5,
    },

    notificationMain: {
      flex: 1,
      minWidth: 0,

      flexDirection: "row",
      alignItems: "center",
    },

    notificationImageWrap: {
      position: "relative",
      flexShrink: 0,
      marginRight: 13,
    },

    musicThumbnail: {
      borderRadius: 10,
      marginRight: 0,
    },

    senderAvatarBadge: {
      position: "absolute",
      right: -5,
      bottom: -5,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colours.darkblue,
      backgroundColor: colours.darkblue,
    },

    avatar: {
      width: 56,
      height: 56,

      flexShrink: 0,

      borderRadius: 28,

      marginRight: 0,

      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    notificationInfo: {
      flex: 1,
      minWidth: 0,

      paddingRight: 10,
    },

    notificationMessage: {
      color:
        "rgba(255,255,255,0.72)",

      fontSize: 14,
      lineHeight: 20,
    },

    username: {
      color: "#ffffff",

      fontSize: 16,
      lineHeight: 22,
      fontWeight: "800",
    },

    sharedMusicMeta: {
      color: "rgba(255,255,255,0.58)",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    sharedComment: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
    fontStyle: "italic",
  },

    timeText: {
      color:
        "rgba(255,255,255,0.42)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 4,
    },

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

      flex: 1,

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

    viewButton: {
      minWidth: 112,
      minHeight: 42,

      flexShrink: 0,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 16,

      marginLeft: 14,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.65)",

      borderRadius: 21,

      backgroundColor:
        "rgba(53,175,229,0.12)",
    },

    viewButtonText: {
      color:
        colours.lightblue,

      fontSize: 13,
      fontWeight: "800",
    },

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
      maxWidth: 430,

      color:
        "rgba(255,255,255,0.52)",

      fontSize: 14,
      lineHeight: 20,

      textAlign: "center",

      marginTop: 6,
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