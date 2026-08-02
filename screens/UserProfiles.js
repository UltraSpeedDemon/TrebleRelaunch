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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useFocusEffect,
  useRoute,
} from "@react-navigation/native";

import { auth } from "../utils/firebase";

import {
  deleteReview,
  followUser,
  getFollowers,
  getFollowRequests,
  getReviewSong,
  getSongFromDeezer,
  getUser,
  getUserActivity,
  getUserFavorites,
  getUserLikes,
  getUserMostUpvoted,
  getUserTopReviews,
  removeUpvoteFromReview,
  requestFollow,
  unfollowUser,
  upvoteReview,
} from "../providers/rest";

import colours from "../styles/colours";
import { LinearGradient } from "expo-linear-gradient";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import ReviewCard from "../components/Review";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 1080;

const ADMIN_BADGE_EMAILS = new Set([
  "mcplayzethan@gmail.com",
]);

function hasAdminBadge({
  email,
  isAdmin,
} = {}) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  return (
    Boolean(isAdmin) ||
    ADMIN_BADGE_EMAILS.has(
      normalizedEmail
    )
  );
}

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

const SPOTIFY_LOGO =
  require("../images/spotifyLogo.png");

const ADMIN_BADGE =
  require("../images/adminBadge.png");

function DraggableProfileRow({
  children,
  useNativeScroll,
  contentStyle,
}) {
  const webScrollRef = React.useRef(null);
  const dragRef = React.useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const [dragging, setDragging] =
    React.useState(false);

  if (useNativeScroll) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        scrollEnabled
        bounces
        alwaysBounceHorizontal={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={contentStyle}
        style={styles.mobileHorizontalScroller}
      >
        {children}
      </ScrollView>
    );
  }

  const stopDragging = () => {
    dragRef.current.active = false;
    setDragging(false);

    window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 60);
  };

  return React.createElement(
    "div",
    {
      ref: webScrollRef,

      onPointerDown: (event) => {
        const node = webScrollRef.current;

        if (!node) {
          return;
        }

        node.setPointerCapture?.(
          event.pointerId
        );

        dragRef.current = {
          active: true,
          startX: event.clientX,
          startScrollLeft:
            node.scrollLeft,
          moved: false,
        };

        setDragging(true);
      },

      onPointerMove: (event) => {
        const node = webScrollRef.current;

        if (
          !node ||
          !dragRef.current.active
        ) {
          return;
        }

        const movement =
          event.clientX -
          dragRef.current.startX;

        if (Math.abs(movement) > 5) {
          dragRef.current.moved = true;

          node.scrollLeft =
            dragRef.current.startScrollLeft -
            movement;

          event.preventDefault();
        }
      },

      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
      onPointerLeave: stopDragging,

      onClickCapture: (event) => {
        if (dragRef.current.moved) {
          event.preventDefault();
          event.stopPropagation();
        }
      },

      style: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        overflowX: "auto",
        overflowY: "hidden",
        paddingRight: 12,
        boxSizing: "border-box",
        cursor:
          dragging
            ? "grabbing"
            : "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "pan-y",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      },
    },
    children
  );
}

export default function UserProfiles({
  navigation,
}) {
  const route = useRoute();

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
    width < 640;

  const userId =
    String(
      route?.params?.userId ||
      ""
    );

  const currentUserId =
    String(
      auth.currentUser?.uid ||
      ""
    );

  const isSelf =
    currentUserId === userId;

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    avatar,
    setAvatar,
  ] = useState(null);

  const [
    theirFollowers,
    setTheirFollowers,
  ] = useState([]);

  const [
    myFollowers,
    setMyFollowers,
  ] = useState([]);

  const [
    followersCount,
    setFollowersCount,
  ] = useState(0);

  const [
    followingCount,
    setFollowingCount,
  ] = useState(0);

  const [
    isPublic,
    setIsPublic,
  ] = useState(true);

  const [
    isSpotifyLinked,
    setIsSpotifyLinked,
  ] = useState(false);

  const [
    isAdmin,
    setIsAdmin,
  ] = useState(false);

  const [
    followRequested,
    setFollowRequested,
  ] = useState(false);

  const [
    followLoading,
    setFollowLoading,
  ] = useState(false);

  const [
    topReviews,
    setTopReviews,
  ] = useState([]);

  const [
    likedSongs,
    setLikedSongs,
  ] = useState([]);

  const [
    favorites,
    setFavorites,
  ] = useState([]);

  const [
    mostUpvoted,
    setMostUpvoted,
  ] = useState([]);

  const [
    activity,
    setActivity,
  ] = useState([]);

  const [
    totalReviews,
    setTotalReviews,
  ] = useState(0);

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
    canViewFullContent,
    setCanViewFullContent,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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

  const formatUsername =
  useCallback((name) => {
    const cleanName =
      String(name || "").trim();

    if (!cleanName) {
      return "Treble User";
    }

    return (
      cleanName.charAt(0).toUpperCase() +
      cleanName.slice(1)
    );
  }, []);

  const normalizeArray =
  useCallback((data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    if (Array.isArray(data?.users)) {
      return data.users;
    }

    if (Array.isArray(data?.followers)) {
      return data.followers;
    }

    if (Array.isArray(data?.following)) {
      return data.following;
    }

    if (Array.isArray(data?.friends)) {
      return data.friends;
    }

    if (Array.isArray(data?.requests)) {
      return data.requests;
    }

    if (Array.isArray(data?.followRequests)) {
      return data.followRequests;
    }

    if (Array.isArray(data?.notifications)) {
      return data.notifications;
    }

    return [];
  }, []);

  const enrichReviewsWithSong =
    useCallback(
      async (reviews) => {
        const safeReviews =
          Array.isArray(reviews)
            ? reviews
            : [];

        return Promise.all(
          safeReviews.map(
            async (review) => {
              if (review?.song) {
                return review;
              }

              try {
                const response =
                  await getReviewSong(
                    userId,
                    review.id
                  );

                if (!response?.ok) {
                  return review;
                }

                const songData =
                  await response.json();

                return {
                  ...review,
                  song:
                    songData,
                };
              } catch (error) {
                console.warn(
                  "[UserProfiles] Unable to enrich review:",
                  error
                );

                return review;
              }
            }
          )
        );
      },
      [userId]
    );

  const normalizeLikedSong =
    useCallback((item) => {
      const song =
        item?.song ||
        item?.item_info ||
        item ||
        {};

      const id =
        song?.id ||
        song?.listenableId ||
        song?.listenable_id ||
        item?.listenableId ||
        item?.listenable_id ||
        item?.itemId ||
        item?.id ||
        "";

      if (!id) {
        return null;
      }

      const rawArtist =
        song?.artist ||
        item?.artist ||
        null;

      const artistName =
        typeof rawArtist === "string"
          ? rawArtist
          : rawArtist?.name ||
            song?.artistName ||
            item?.artistName ||
            "Unknown Artist";

      const album =
        song?.album ||
        item?.album ||
        null;

      const image =
        song?.image ||
        song?.coverArt ||
        item?.image ||
        item?.coverArt ||
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        "";

      return {
        ...item,
        ...song,

        id: String(id),
        listenableId: String(id),
        type: "track",

        title:
          song?.title ||
          song?.name ||
          item?.title ||
          item?.name ||
          "Unknown Track",

        name:
          song?.name ||
          song?.title ||
          item?.name ||
          item?.title ||
          "Unknown Track",

        artist:
          typeof rawArtist === "string"
            ? { name: rawArtist }
            : rawArtist || {
                name: artistName,
              },

        artistName,
        album,
        image,
        coverArt:
          song?.coverArt ||
          item?.coverArt ||
          image,

        preview:
          song?.preview ||
          song?.previewUrl ||
          item?.preview ||
          item?.previewUrl ||
          "",
      };
    }, []);

  const loadAllReviewsSections =
    useCallback(async () => {
      try {
        const [
          topResponse,
          likedResponse,
          favoritesResponse,
          upvotedResponse,
          activityResponse,
        ] = await Promise.all([
          getUserTopReviews(userId),
          getUserLikes(userId),
          getUserFavorites(userId),
          getUserMostUpvoted(userId),
          getUserActivity(userId),
        ]);

        const [
          topData,
          likedData,
          favoritesData,
          upvotedData,
          activityData,
        ] = await Promise.all([
          topResponse?.ok
            ? topResponse.json()
            : [],

          likedResponse?.ok
            ? likedResponse.json()
            : { likes: [] },

          favoritesResponse?.ok
            ? favoritesResponse.json()
            : [],

          upvotedResponse?.ok
            ? upvotedResponse.json()
            : [],

          activityResponse?.ok
            ? activityResponse.json()
            : [],
        ]);

        const [
          enrichedTop,
          enrichedFavorites,
          enrichedUpvoted,
          enrichedActivity,
        ] = await Promise.all([
          enrichReviewsWithSong(
            normalizeArray(topData)
          ),

          enrichReviewsWithSong(
            normalizeArray(
              favoritesData
            )
          ),

          enrichReviewsWithSong(
            normalizeArray(
              upvotedData
            )
          ),

          enrichReviewsWithSong(
            normalizeArray(
              activityData
            )
          ),
        ]);

        const rawLikes =
          Array.isArray(likedData?.likes)
            ? likedData.likes
            : normalizeArray(likedData);

        const normalizedLikedSongs =
          rawLikes
            .filter((item) => {
              const type =
                String(
                  item?.type ||
                  item?.item_info?.type ||
                  item?.song?.type ||
                  "track"
                ).toLowerCase();

              return (
                type === "track" ||
                type === "song"
              );
            })
            .map(normalizeLikedSong)
            .filter(Boolean)
            .slice(0, 20);

        setTopReviews(enrichedTop);
        setLikedSongs(normalizedLikedSongs);
        setFavorites(enrichedFavorites);
        setMostUpvoted(enrichedUpvoted);
        setActivity(enrichedActivity);
        setTotalReviews(
          enrichedActivity.length
        );
      } catch (error) {
        console.error(
          "[UserProfiles] Profile section error:",
          error
        );

        setLikedSongs([]);
      }
    }, [
      enrichReviewsWithSong,
      normalizeArray,
      normalizeLikedSong,
      userId,
    ]);

  const checkIfFollowing =
    useCallback(
      async (
        targetUserId
      ) => {
        try {
          const response =
            await getFollowers(
              targetUserId
            );

          if (!response?.ok) {
            return false;
          }

          const data =
            await response.json();

          const followers =
            normalizeArray(data);

          return followers.some(
            (follower) =>
              String(
                follower?.userId ||
                follower?.uid ||
                ""
              ) ===
              currentUserId
          );
        } catch (error) {
          console.error(
            "[UserProfiles] Follow status error:",
            error
          );

          return false;
        }
      },
      [
        currentUserId,
        normalizeArray,
      ]
    );

  const fetchTheirFollowers =
    useCallback(async () => {
      if (!userId) {
        return [];
      }

      try {
        const response =
          await getFollowers(
            userId
          );

        if (!response?.ok) {
          return [];
        }

        const data =
          await response.json();

        const followers =
          normalizeArray(data);

        setTheirFollowers(
          followers
        );
          console.log(
      "[Followers]",
      followers
  );

        return followers;
      } catch (error) {
        console.error(
          "[UserProfiles] Followers error:",
          error
        );

        return [];
      }
    }, [
      normalizeArray,
      userId,
    ]);

    const fetchMyFollowers =
  useCallback(async () => {
    if (!currentUserId) {
      return [];
    }

    try {
      const response =
        await getFollowers(
          currentUserId
        );
console.log(
    "Current User:",
    currentUserId
);

      if (!response?.ok) {
        return [];
      }

      const data =
        await response.json();

      const followers =
        normalizeArray(data);

      setMyFollowers(
        followers
      );
      console.log(
    "Their Followers:",
    followers
);
      return followers;
    } catch (error) {
      console.error(
        "[UserProfiles] My followers error:",
        error
      );

      return [];
    }
  }, [
    currentUserId,
    normalizeArray,
  ]);


  const checkFollowRequest =
    useCallback(async () => {
      if (
        !userId ||
        !currentUserId ||
        isSelf
      ) {
        setFollowRequested(
          false
        );

        return;
      }

      try {
        const response =
          await getFollowRequests(
            userId
          );

        if (!response?.ok) {
          return;
        }

        const data =
          await response.json();

        const requests =
          normalizeArray(data);

        const requested =
          requests.some(
            (request) =>
              String(
                request?.userId ||
                request?.requesterId ||
                request?.fromUserId ||
                ""
              ) ===
              currentUserId
          );

        setFollowRequested(
          requested
        );
      } catch (error) {
        console.error(
          "[UserProfiles] Follow request error:",
          error
        );
      }
    }, [
      currentUserId,
      isSelf,
      normalizeArray,
      userId,
    ]);

  const fetchUserData =
    useCallback(
      async (
        isRefresh = false
      ) => {
        if (!userId) {
          setErrorMessage(
            "No user was selected."
          );

          setLoading(false);

          return;
        }

        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setErrorMessage("");

          const response =
            await getUser(
              userId
            );

          const data =
            await parseResponse(
              response,
              "Unable to load this profile."
            );

          const finalUsername =
            String(
              data?.username ||
              data?.displayName ||
              "Treble User"
            );

          const finalAvatar =
            typeof data?.avatar ===
              "string" &&
            data.avatar !== "None" &&
            (
              data.avatar.startsWith(
                "http://"
              ) ||
              data.avatar.startsWith(
                "https://"
              ) ||
              data.avatar.startsWith(
                "data:"
              )
            )
              ? data.avatar
              : null;

          const publicValue =
            data?.isPublic;

          const finalIsPublic =
            publicValue === true ||
            publicValue ===
              "true" ||
            publicValue === 1 ||
            publicValue ===
              undefined;

          setUsername(
            finalUsername
          );

          setAvatar(
            finalAvatar
          );

          setFollowersCount(
            Number(
              data?.followersCount
            ) || 0
          );

          setFollowingCount(
            Number(
              data?.followingCount
            ) || 0
          );

          setIsPublic(
            finalIsPublic
          );

          setIsSpotifyLinked(
            data?.spotifyIsLinked ===
              true ||
            data?.spotifyIsLinked ===
              "true"
          );

          setIsAdmin(
            hasAdminBadge({
              email:
                data?.email ||
                data?.userEmail,
              isAdmin:
                data?.isAdmin,
            })
          );

          const [
            following,
          ] = await Promise.all([
            checkIfFollowing(
              userId
            ),

            fetchTheirFollowers(),

            fetchMyFollowers(),

            checkFollowRequest(),
          ]);

          const canView =
            finalIsPublic ||
            isSelf ||
            following;

          setCanViewFullContent(
            canView
          );

          if (canView) {
            await loadAllReviewsSections();
          } else {
            setTopReviews([]);
            setLikedSongs([]);
            setFavorites([]);
            setMostUpvoted([]);
            setActivity([]);
            setTotalReviews(0);
          }
        } catch (error) {
          console.error(
            "[UserProfiles] Load error:",
            error
          );

          setErrorMessage(
            error?.message ||
            "Unable to load this profile."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
      checkFollowRequest,
      checkIfFollowing,
      fetchMyFollowers,
      fetchTheirFollowers,
      isSelf,
      loadAllReviewsSections,
      parseResponse,
      userId,
    ]
    );

  useFocusEffect(
    useCallback(() => {
      fetchUserData(false);
    }, [fetchUserData])
  );

  const iAmFollowing =
  useMemo(
    () =>
      theirFollowers.some(
        (follower) =>
          String(
            follower?.userId ||
            follower?.uid ||
            follower?.id ||
            follower?.followerId ||
            follower?.follower_id ||
            ""
          ) ===
          currentUserId
      ),
    [
      currentUserId,
      theirFollowers,
    ]
  );

  const theyFollowMe =
  useMemo(
    () =>
      myFollowers.some(
        (follower) =>
          String(
            follower?.userId ||
            follower?.uid ||
            follower?.id ||
            follower?.followerId ||
            follower?.follower_id ||
            ""
          ) ===
          userId
      ),
    [
      myFollowers,
      userId,
    ]
  );

const isFriend =
  iAmFollowing &&
  theyFollowMe;

const finalButtonLabel =
  useMemo(() => {
    if (isFriend) {
      return "Friends";
    }

    if (iAmFollowing) {
      return "Following";
    }

    if (
      !isPublic &&
      followRequested
    ) {
      return "Requested";
    }

    if (theyFollowMe) {
      return "Follow Back";
    }

    return "Follow";
  }, [
    followRequested,
    iAmFollowing,
    isFriend,
    isPublic,
    theyFollowMe,
  ]);

  const updateReviewArray =
    useCallback(
      (
        reviews,
        reviewId
      ) =>
        reviews.map(
          (review) => {
            if (
              String(review?.id) !==
              String(reviewId)
            ) {
              return review;
            }

            const currentlyUpvoted =
              Boolean(
                review?.upvoted
              );

            const currentUpvotes =
              Number(
                review?.upvotes
              ) || 0;

            return {
              ...review,

              upvotes:
                currentlyUpvoted
                  ? Math.max(
                      0,
                      currentUpvotes -
                        1
                    )
                  : currentUpvotes +
                    1,

              upvoted:
                !currentlyUpvoted,
            };
          }
        ),
      []
    );

  const handleUpvote =
    useCallback(
      async (reviewId) => {
        const combined = [
          ...topReviews,
          ...favorites,
          ...mostUpvoted,
          ...activity,
        ];

        const review =
          combined.find(
            (item) =>
              String(item?.id) ===
              String(reviewId)
          );

        if (!review) {
          return;
        }

        try {
          if (
            review?.upvoted
          ) {
            await removeUpvoteFromReview(
              reviewId
            );
          } else {
            await upvoteReview(
              reviewId
            );
          }

          setTopReviews(
            (current) =>
              updateReviewArray(
                current,
                reviewId
              )
          );

          setFavorites(
            (current) =>
              updateReviewArray(
                current,
                reviewId
              )
          );

          setMostUpvoted(
            (current) =>
              updateReviewArray(
                current,
                reviewId
              )
          );

          setActivity(
            (current) =>
              updateReviewArray(
                current,
                reviewId
              )
          );
        } catch (error) {
          console.error(
            "[UserProfiles] Upvote error:",
            error
          );
        }
      },
      [
        activity,
        favorites,
        mostUpvoted,
        topReviews,
        updateReviewArray,
      ]
    );

  const handleDelete =
    useCallback(
      async (reviewId) => {
        const combined = [
          ...topReviews,
          ...favorites,
          ...mostUpvoted,
          ...activity,
        ];

        const review =
          combined.find(
            (item) =>
              String(item?.id) ===
              String(reviewId)
          );

        if (
          !review ||
          !review?.isUser
        ) {
          return;
        }

        try {
          await deleteReview(
            reviewId
          );

          await loadAllReviewsSections();
        } catch (error) {
          console.error(
            "[UserProfiles] Delete error:",
            error
          );
        }
      },
      [
        activity,
        favorites,
        loadAllReviewsSections,
        mostUpvoted,
        topReviews,
      ]
    );

  const handleFollowPress =
    useCallback(async () => {
      if (
        followLoading ||
        !currentUserId ||
        !userId ||
        isSelf
      ) {
        return;
      }

      try {
        setFollowLoading(true);

        if (
            finalButtonLabel === "Following" ||
            finalButtonLabel === "Friends"
          ) {
            const response =
            await unfollowUser(
              currentUserId,
              userId
            );

          await parseResponse(
            response,
            "Unable to unfollow this user."
          );

          setFollowersCount(
            (current) =>
              Math.max(
                0,
                current - 1
              )
          );

          await Promise.all([
            fetchTheirFollowers(),
            fetchMyFollowers(),
          ]);

          return;
        }

        if (isPublic) {
          const response =
            await followUser(
              currentUserId,
              userId
            );

          await parseResponse(
            response,
            "Unable to follow this user."
          );

          setFollowersCount(
            (current) =>
              current + 1
          );

          await Promise.all([
            fetchTheirFollowers(),
            fetchMyFollowers(),
          ]);

          return;
        }

        if (!followRequested) {
          const response =
            await requestFollow(
              currentUserId,
              userId
            );

          await parseResponse(
            response,
            "Unable to send the follow request."
          );

          setFollowRequested(
            true
          );

          if (
            Platform.OS === "web"
          ) {
            window.alert(
              "Your follow request was sent."
            );
          } else {
            Alert.alert(
              "Request sent",
              "Your follow request was sent."
            );
          }
        }
      } catch (error) {
        console.error(
          "[UserProfiles] Follow action error:",
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
            "Unable to update follow status",
            message
          );
        }
      } finally {
        setFollowLoading(false);
      }
    }, [
    currentUserId,
    fetchMyFollowers,
    fetchTheirFollowers,
    finalButtonLabel,
    followLoading,
    followRequested,
    isPublic,
    isSelf,
    parseResponse,
    userId,
  ]);

  const handleSpotifyBadgePress =
    useCallback(() => {
      if (
        Platform.OS === "web"
      ) {
        window.alert(
          "This user has linked their Spotify account."
        );
      } else {
        Alert.alert(
          "Spotify linked",
          "This user has linked their Spotify account."
        );
      }
    }, []);

  const handleAdminBadgePress =
    useCallback(() => {
      if (
        Platform.OS === "web"
      ) {
        window.alert(
          "This user is a Treble administrator or developer."
        );
      } else {
        Alert.alert(
          "Treble administrator",
          "This user is a Treble administrator or developer."
        );
      }
    }, []);

  const avatarSource =
    avatar
      ? {
          uri: avatar,
        }
      : FALLBACK_AVATAR;

  const navigateToSongPage =
    useCallback(
      (track) => {
        const safeTrack = {
          ...track,

          id: String(
            track?.id ||
            track?.listenableId ||
            track?.listenable_id ||
            ""
          ),

          listenableId: String(
            track?.listenableId ||
            track?.listenable_id ||
            track?.id ||
            ""
          ),

          listenable_id: String(
            track?.listenable_id ||
            track?.listenableId ||
            track?.id ||
            ""
          ),

          type: "track",
        };

        /*
         * UserProfiles can be opened from different navigators.
         * Try the current navigator first, then walk upward.
         */
        let currentNavigator =
          navigation;

        while (currentNavigator) {
          try {
            currentNavigator.navigate(
              "SongPage",
              {
                track: safeTrack,
              }
            );

            return;
          } catch (error) {
            currentNavigator =
              currentNavigator.getParent?.();
          }
        }

        Alert.alert(
          "Unable to open song",
          "The Song page could not be opened from this screen."
        );
      },
      [navigation]
    );

  const getTrackFromValue =
    useCallback((value) => {
      const candidates = [
        value,
        value?.song,
        value?.song?.song,
        value?.song?.item_info,
        value?.item_info,
        value?.track,
        value?.track?.item_info,
        value?.listenable,
        value?.music,
        value?.musicData,
      ].filter(Boolean);

      for (const candidate of candidates) {
        const id =
          candidate?.id ||
          candidate?.listenableId ||
          candidate?.listenable_id ||
          candidate?.itemId ||
          candidate?.item_id ||
          candidate?.musicId ||
          candidate?.music_id ||
          value?.listenableId ||
          value?.listenable_id ||
          value?.itemId ||
          value?.item_id ||
          value?.musicId ||
          value?.music_id ||
          "";

        if (!id) {
          continue;
        }

        return {
          ...candidate,

          id: String(id),
          listenableId: String(id),
          listenable_id: String(id),
          type: "track",

          title:
            candidate?.title ||
            candidate?.name ||
            value?.title ||
            value?.songTitle ||
            "Unknown Track",

          name:
            candidate?.name ||
            candidate?.title ||
            value?.title ||
            value?.songTitle ||
            "Unknown Track",

          image:
            candidate?.image ||
            candidate?.coverArt ||
            candidate?.album?.cover_xl ||
            candidate?.album?.cover_big ||
            value?.image ||
            value?.coverArt ||
            "",

          coverArt:
            candidate?.coverArt ||
            candidate?.image ||
            candidate?.album?.cover_xl ||
            candidate?.album?.cover_big ||
            value?.coverArt ||
            value?.image ||
            "",

          artist:
            candidate?.artist ||
            (
              candidate?.artistName
                ? {
                    name:
                      candidate.artistName,
                  }
                : value?.artist ||
                  (
                    value?.artistName
                      ? {
                          name:
                            value.artistName,
                        }
                      : null
                  )
            ),

          artistName:
            candidate?.artistName ||
            candidate?.artist?.name ||
            value?.artistName ||
            value?.artist?.name ||
            "",

          album:
            candidate?.album ||
            value?.album ||
            null,

          preview:
            candidate?.preview ||
            candidate?.previewUrl ||
            value?.preview ||
            value?.previewUrl ||
            "",

          previewUrl:
            candidate?.previewUrl ||
            candidate?.preview ||
            value?.previewUrl ||
            value?.preview ||
            "",
        };
      }

      return null;
    }, []);

  const hydrateTrackInBackground =
    useCallback(
      async (track) => {
        const trackId =
          String(
            track?.id ||
            track?.listenableId ||
            track?.listenable_id ||
            ""
          );

        if (!trackId) {
          return;
        }

        try {
          const response =
            await getSongFromDeezer(
              trackId
            );

          if (!response?.ok) {
            return;
          }

          const deezerTrack =
            await response.json();

          /*
           * Replace the current SongPage parameters when possible.
           * SongPage may also hydrate itself, so this is only an
           * enhancement and never blocks navigation.
           */
          navigation.setParams?.({
            track: {
              ...track,
              ...deezerTrack,

              id: String(
                deezerTrack?.id ||
                trackId
              ),

              listenableId: String(
                deezerTrack?.listenableId ||
                deezerTrack?.id ||
                trackId
              ),

              listenable_id: String(
                deezerTrack?.listenable_id ||
                deezerTrack?.listenableId ||
                deezerTrack?.id ||
                trackId
              ),

              type: "track",
            },
          });
        } catch (error) {
          console.warn(
            "[UserProfiles] Background song hydration failed:",
            error
          );
        }
      },
      [navigation]
    );

  const openLikedSong =
    useCallback(
      (song) => {
        const track =
          getTrackFromValue(song);

        if (!track) {
          Alert.alert(
            "Unable to open song",
            "This song does not have a valid track ID."
          );

          return;
        }

        /*
         * Navigate immediately. Never make the user wait for Deezer.
         */
        navigateToSongPage(track);

        hydrateTrackInBackground(
          track
        );
      },
      [
        getTrackFromValue,
        hydrateTrackInBackground,
        navigateToSongPage,
      ]
    );

  const openReviewSong =
    useCallback(
      (review) => {
        const track =
          getTrackFromValue(review);

        if (!track) {
          Alert.alert(
            "Unable to open song",
            "This review does not contain a valid song."
          );

          return;
        }

        navigateToSongPage(track);

        hydrateTrackInBackground(
          track
        );
      },
      [
        getTrackFromValue,
        hydrateTrackInBackground,
        navigateToSongPage,
      ]
    );


  const renderLikedSongsSection =
    useCallback(
      () => (
        <View style={styles.cardSection}>
          <View style={styles.sectionHeader}>
            <View
              style={
                styles.sectionHeadingGroup
              }
            >
              <Text style={styles.sectionTitle}>
                Liked Songs
              </Text>

              <Text
                style={
                  styles.sectionDescription
                }
              >
                Songs they recently liked
              </Text>
            </View>

            <Text style={styles.sectionCount}>
              {likedSongs.length}
            </Text>
          </View>

          {likedSongs.length === 0 ? (
            <View
              style={
                styles.sectionEmptyBox
              }
            >
              <Text
                style={
                  styles.sectionPlaceholder
                }
              >
                No liked songs yet.
              </Text>
            </View>
          ) : (
            <DraggableProfileRow
              useNativeScroll={!isDesktopWeb}
              contentStyle={
                styles.horizontalLikedList
              }
            >
              {likedSongs.map((song) => {
                const imageUri =
                  song?.image ||
                  song?.coverArt ||
                  song?.album?.cover_xl ||
                  song?.album?.cover_big ||
                  "";

                return (
                  <TouchableOpacity
                    key={String(song.id)}
                    style={[
                      styles.likedSongCard,
                      isCompact &&
                        styles.compactLikedSongCard,
                    ]}
                    activeOpacity={0.82}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${song?.title || song?.name || "song"}`}
                    onPress={() =>
                      openLikedSong(song)
                    }
                  >
                    {imageUri ? (
                      <Image
                        source={{
                          uri: imageUri,
                        }}
                        style={
                          styles.likedSongImage
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.likedSongPlaceholder
                        }
                      >
                        <Text
                          style={
                            styles.likedSongPlaceholderText
                          }
                        >
                          ♪
                        </Text>
                      </View>
                    )}

                    <View
                      style={
                        styles.likedSongInfo
                      }
                    >
                      <Text
                        style={
                          styles.likedSongTitle
                        }
                        numberOfLines={1}
                      >
                        {song?.title ||
                          song?.name ||
                          "Unknown Track"}
                      </Text>

                      <Text
                        style={
                          styles.likedSongArtist
                        }
                        numberOfLines={1}
                      >
                        {song?.artistName ||
                          song?.artist?.name ||
                          ""}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.likedSongHeartBadge
                      }
                    >
                      <Text
                        style={
                          styles.likedSongHeart
                        }
                      >
                        ♥
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </DraggableProfileRow>
          )}
        </View>
      ),
      [
        isCompact,
        isDesktopWeb,
        likedSongs,
        openLikedSong,
      ]
    );

  const renderReviewSection =
    useCallback(
      (
        title,
        reviews,
        emptyMessage
      ) => (
        <View
          style={
            styles.cardSection
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              {title}
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {reviews.length}
            </Text>
          </View>

          {reviews.length === 0 ? (
            <View
              style={
                styles.sectionEmptyBox
              }
            >
              <Text
                style={
                  styles.sectionPlaceholder
                }
              >
                {emptyMessage}
              </Text>
            </View>
          ) : (
            <DraggableProfileRow
              useNativeScroll={
                !isDesktopWeb
              }
              contentStyle={
                styles.horizontalReviewList
              }
            >
              {reviews.map(
                (item, index) => (
                  <TouchableOpacity
                    key={
                      `${title}-${item?.id || index}`
                    }
                    style={
                      styles.reviewSnippetCard
                    }
                    activeOpacity={0.9}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${item?.song?.title || item?.title || "review song"}`}
                    onPress={() =>
                      openReviewSong(item)
                    }
                  >
                    <ReviewCard
                      item={
                        item
                      }
                      avatar={
                        avatar ||
                        FALLBACK_AVATAR
                      }
                      handleUpvote={
                        handleUpvote
                      }
                      handleDelete={
                        handleDelete
                      }
                      navigation={
                        navigation
                      }
                      showReplyInput={false}
                      showComments={false}
                      profileReviewMode
                      onPress={() =>
                        openReviewSong(item)
                      }
                      onSongPress={() =>
                        openReviewSong(item)
                      }
                      onImagePress={() =>
                        openReviewSong(item)
                      }
                    />
                  </TouchableOpacity>
                )
              )}
            </DraggableProfileRow>
          )}
        </View>
      ),
      [
        avatar,
        handleDelete,
        handleUpvote,
        isDesktopWeb,
        navigation,
        openReviewSong,
      ]
    );

  if (loading) {
    return (
      <View
        style={
          styles.loader
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
            styles.loaderText
          }
        >
          Loading reviews...
        </Text>
      </View>
    );
  }

  if (
    errorMessage &&
    !username
  ) {
    return (
      <View
        style={
          styles.loader
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Unable to load profile
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {errorMessage}
        </Text>

        <TouchableOpacity
          style={
            styles.retryButton
          }
          onPress={() =>
            fetchUserData(false)
          }
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            Try Again
          </Text>
        </TouchableOpacity>
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
        <ScrollView
          style={[
            styles.profileScroll,

            isWeb &&
              styles.webProfileScroll,
          ]}
          contentContainerStyle={[
            styles.scrollContainer,

            isDesktopWeb &&
              styles.desktopScrollContainer,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          refreshing={
            refreshing
          }
          onRefresh={() =>
            fetchUserData(true)
          }
        >
          <LinearGradient
            style={[
              styles.profileHeader,

              isCompact &&
                styles.compactProfileHeader,
            ]}
          
            colors={[
              "rgba(53,175,229,0.26)",
              "rgba(37,74,132,0.18)",
              "rgba(255,255,255,0.045)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.profileGlowTop} />
            <View style={styles.profileGlowBottom} />

            <View
              style={
                styles.avatarContainer
              }
            >
              <Image
                key={
                  avatar ||
                  "fallback-avatar"
                }
                source={
                  avatarSource
                }
                style={
                  styles.avatar
                }
                onError={() =>
                  setAvatar(null)
                }
              />

              <View
                style={[
                  styles.privacyBadge,

                  !isPublic &&
                    styles.privateBadge,
                ]}
              >
                <Text
                  style={
                    styles.privacyBadgeText
                  }
                >
                  {isPublic
                    ? "Public"
                    : "Private"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.headerInfo,

                isCompact &&
                  styles.compactHeaderInfo,
              ]}
            >
              <Text style={styles.profileEyebrow}>
                TREBLE COMMUNITY PROFILE
              </Text>

              <View
                style={[
                  styles.usernameRow,
                  isCompact &&
                    styles.compactUsernameRow,
                ]}
              >
                <Text
                  style={
                    styles.username
                  }
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formatUsername(
                    username
                  )}
                </Text>

                <View
                  style={
                    styles.badgeContainer
                  }
                >
                  {isSpotifyLinked ? (
                    <TouchableOpacity
                      onPress={
                        handleSpotifyBadgePress
                      }
                    >
                      <Image
                        source={
                          SPOTIFY_LOGO
                        }
                        style={
                          styles.badgeIcon
                        }
                      />
                    </TouchableOpacity>
                  ) : null}

                  {isAdmin ? (
                    <TouchableOpacity
                      onPress={
                        handleAdminBadgePress
                      }
                      accessibilityRole="button"
                      accessibilityLabel="Treble Admin badge"
                    >
                      <Image
                        source={
                          ADMIN_BADGE
                        }
                        style={
                          styles.badgeIcon
                        }
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <Text
                style={
                  styles.profileLabel
                }
              >
                Treble profile
              </Text>

              <View
                style={
                  styles.statsRow
                }
              >
                <View
                  style={
                    styles.statBox
                  }
                >
                  <Text
                    style={
                      styles.statNumber
                    }
                  >
                    {
                      followersCount
                    }
                  </Text>

                  <Text
                    style={
                      styles.statLabel
                    }
                  >
                    Followers
                  </Text>
                </View>

                <View
                  style={
                    styles.statDivider
                  }
                />

                <View
                  style={
                    styles.statBox
                  }
                >
                  <Text
                    style={
                      styles.statNumber
                    }
                  >
                    {
                      followingCount
                    }
                  </Text>

                  <Text
                    style={
                      styles.statLabel
                    }
                  >
                    Following
                  </Text>
                </View>

                <View
                  style={
                    styles.statDivider
                  }
                />

                <View
                  style={
                    styles.statBox
                  }
                >
                  <Text
                    style={
                      styles.statNumber
                    }
                  >
                    {
                      totalReviews
                    }
                  </Text>

                  <Text
                    style={
                      styles.statLabel
                    }
                  >
                    Reviews
                  </Text>
                </View>
              </View>
            </View>

            {!isSelf ? (
              <View
                style={[
                  styles.followContainer,

                  isCompact &&
                    styles.compactFollowContainer,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.followButton,

                    (
                      finalButtonLabel === "Following" ||
                      finalButtonLabel === "Friends"
                    ) &&
                      styles.followingButton,

                    finalButtonLabel ===
                      "Requested" &&
                      styles.requestedButton,

                    followLoading &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    handleFollowPress
                  }
                  disabled={
                    followLoading ||
                    finalButtonLabel ===
                      "Requested"
                  }
                  activeOpacity={
                    0.8
                  }
                >
                  {followLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                    />
                  ) : (
                    <Text
                      style={
                        styles.followButtonText
                      }
                    >
                      {
                        finalButtonLabel
                      }
                    </Text>
                  )}
                </TouchableOpacity>

                {isFriend ? (
                <Text style={styles.friendText}>
                  ✓ Friends — Music Sharing Enabled
                </Text>
              ) : theyFollowMe && !iAmFollowing ? (
                <Text style={styles.followsYouText}>
                  Follows you
                </Text>
              ) : null}
              </View>
            ) : (
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
            )}
          </LinearGradient>

          {!canViewFullContent ? (
            <View
              style={
                styles.privateContainer
              }
            >
              <View
                style={
                  styles.privateIcon
                }
              >
                <Text
                  style={
                    styles.privateIconText
                  }
                >
                  🔒
                </Text>
              </View>

              <Text
                style={
                  styles.privateText
                }
              >
                This profile is private
              </Text>

              <Text
                style={
                  styles.privateText2
                }
              >
                Send a follow request to view this user’s reviews, favourites, and activity.
              </Text>
            </View>
          ) : (
            <>
              {renderReviewSection(
                "Top Reviews",
                topReviews,
                "No top reviews yet."
              )}

              {renderLikedSongsSection()}

              {renderReviewSection(
                "Favourites",
                favorites,
                "No favourites yet."
              )}

              {renderReviewSection(
                "Most Upvoted",
                mostUpvoted,
                "No upvoted reviews yet."
              )}

              <View
                style={
                  styles.cardSection
                }
              >
                <View
                  style={
                    styles.activityHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Activity
                    </Text>

                    <Text
                      style={
                        styles.activitySubtitle
                      }
                    >
                      Newest reviews first
                    </Text>
                  </View>

                  <View
                    style={
                      styles.activityCountBadge
                    }
                  >
                    <Text
                      style={
                        styles.activityCountText
                      }
                    >
                      {
                        totalReviews
                      }
                    </Text>
                  </View>
                </View>

                {activity.length ===
                0 ? (
                  <View
                    style={
                      styles.sectionEmptyBox
                    }
                  >
                    <Text
                      style={
                        styles.sectionPlaceholder
                      }
                    >
                      No activity found.
                    </Text>
                  </View>
                ) : (
                  <View
                    style={
                      styles.activityContainer
                    }
                  >
                    {activity.map(
                      (
                        item,
                        index
                      ) => (
                        <TouchableOpacity
                          key={`activity-${item?.id || index}`}
                          style={
                            styles.activityReviewWrapper
                          }
                          activeOpacity={0.94}
                          onPress={() =>
                            openReviewSong(item)
                          }
                        >
                          <ReviewCard
                            item={
                              item
                            }
                            avatar={
                              avatar ||
                              FALLBACK_AVATAR
                            }
                            handleUpvote={
                              handleUpvote
                            }
                            handleDelete={
                              handleDelete
                            }
                            navigation={
                              navigation
                            }
                            showReplyInput={false}
                            showComments={false}
                            profileReviewMode
                            onPress={() =>
                              openReviewSong(item)
                            }
                            onSongPress={() =>
                              openReviewSong(item)
                            }
                            onImagePress={() =>
                              openReviewSong(item)
                            }
                          />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
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

    followsYouText: {
  color: "rgba(255,255,255,0.6)",

  fontSize: 12,
  fontWeight: "700",

  marginTop: 8,
},
    mobileHorizontalScroller: {
      width: "100%",
      flexGrow: 0,
    },

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

    loader: {
      flex: 1,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 24,

      backgroundColor:
        colours.background ||
        colours.bluegrey ||
        "#101010",
    },

    loaderText: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 14,

      marginTop: 12,
    },

    errorTitle: {
      color: "#ffffff",

      fontSize: 22,
      fontWeight: "800",

      textAlign: "center",
    },

    errorText: {
      maxWidth: 420,

      color:
        "rgba(255,255,255,0.6)",

      fontSize: 14,
      lineHeight: 21,

      textAlign: "center",

      marginTop: 8,
    },

    retryButton: {
      minWidth: 130,
      height: 42,

      alignItems: "center",
      justifyContent: "center",

      marginTop: 18,

      borderRadius: 21,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    retryButtonText: {
      color: "#ffffff",

      fontSize: 14,
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

      paddingBottom: 0,

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
    bottom: 0,

    minHeight: 0,

    paddingTop: 69,
    paddingBottom: BOTTOM_NAV_HEIGHT,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

    profileScroll: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webProfileScroll: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      WebkitOverflowScrolling:
        "touch",

      scrollbarWidth: "none",
      msOverflowStyle: "none",
    },

    scrollContainer: {
      width: "100%",

      paddingBottom: 45,
    },

    desktopScrollContainer: {
      width: "100%",

      maxWidth:
        MAX_CONTENT_WIDTH,

      alignSelf: "center",
    },

    profileHeader: {
      position: "relative",
      overflow: "hidden",

      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 26,
      marginBottom: 26,

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.30)",

      borderRadius: 25,

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.22,
      shadowRadius: 18,

      elevation: 7,
    },

    profileGlowTop: {
      position: "absolute",
      top: -95,
      right: -50,

      width: 230,
      height: 230,

      borderRadius: 115,

      backgroundColor:
        "rgba(53,175,229,0.13)",
    },

    profileGlowBottom: {
      position: "absolute",
      left: 90,
      bottom: -120,

      width: 220,
      height: 220,

      borderRadius: 110,

      backgroundColor:
        "rgba(103,80,255,0.08)",
    },

    compactProfileHeader: {
      flexDirection: "column",

      alignItems: "center",
    },

    avatarContainer: {
      position: "relative",

      flexShrink: 0,
    },

    avatar: {
      width: 118,
      height: 118,

      borderWidth: 3,
      borderColor:
        "rgba(53,175,229,0.72)",

      borderRadius: 59,

      resizeMode: "cover",

      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    privacyBadge: {
      position: "absolute",

      left: "50%",
      bottom: -9,

      minWidth: 68,
      height: 25,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 10,

      borderWidth: 2,
      borderColor:
        colours.darkblue ||
        "#142334",

      borderRadius: 13,

      transform: [
        {
          translateX: -34,
        },
      ],

      backgroundColor:
        colours.secondaryblue ||
        "#299acb",
    },

    privateBadge: {
      backgroundColor:
        "#777777",
    },

    privacyBadgeText: {
      color: "#ffffff",

      fontSize: 10,
      fontWeight: "800",
    },

    headerInfo: {
      flex: 1,
      minWidth: 0,

      marginLeft: 24,
    },

    /*
     * On mobile the profile header becomes vertical. Reset the
     * desktop left margin and add space below the avatar badge.
     */
    compactHeaderInfo: {
      width: "100%",

      alignItems: "center",

      marginLeft: 0,
      marginTop: 30,
    },

    usernameRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",

      flexWrap: "wrap",
    },

    compactUsernameRow: {
      justifyContent: "center",
    },

    profileEyebrow: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.6,

      marginBottom: 4,
    },

    username: {
      flexShrink: 1,
      minWidth: 0,

      color: "#ffffff",

      fontSize: 29,
      lineHeight: 34,
      fontWeight: "900",
    },

    profileLabel: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 13,

      marginTop: 2,
    },

    badgeContainer: {
      flexDirection: "row",
      alignItems: "center",

      flexShrink: 0,

      marginLeft: 10,
    },

    badgeIcon: {
      width: 27,
      height: 27,

      marginLeft: 6,

      resizeMode: "contain",
    },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",

      marginTop: 19,
    },

    statBox: {
      minWidth: 78,

      alignItems: "flex-start",
    },

    statNumber: {
      color: "#ffffff",

      fontSize: 18,
      fontWeight: "900",
    },

    statLabel: {
      color:
        "rgba(255,255,255,0.5)",

      fontSize: 11,

      marginTop: 2,
    },

    statDivider: {
      width: 1,
      height: 34,

      marginHorizontal: 18,

      backgroundColor:
        "rgba(255,255,255,0.11)",
    },

    followContainer: {
      alignItems: "center",

      flexShrink: 0,

      marginLeft: 20,
    },

    compactFollowContainer: {
      width: "100%",

      marginLeft: 0,
      marginTop: 24,
    },

    followButton: {
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.16)",
      minWidth: 125,
      height: 44,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 20,

      borderRadius: 22,

      backgroundColor:
        colours.lightblue ||
        "#35afe5",
    },

    followingButton: {
      backgroundColor:
        "#237fa9",
    },

    requestedButton: {
      backgroundColor:
        "#777777",
    },

    followButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.55,
    },

    friendText: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 12,
      fontWeight: "800",

      marginTop: 8,
    },

    editProfileButton: {
      minWidth: 125,
      height: 44,

      alignItems: "center",
      justifyContent: "center",

      flexShrink: 0,

      marginLeft: 20,
      paddingHorizontal: 20,

      borderWidth: 1,
      borderColor:
        colours.lightblue ||
        "#35afe5",

      borderRadius: 22,

      backgroundColor:
        "rgba(53,175,229,0.12)",
    },

    editProfileButtonText: {
      color: "#ffffff",

      fontSize: 14,
      fontWeight: "800",
    },

    cardSection: {
      overflow: "hidden",
      width: "100%",

      padding: 20,
      marginBottom: 18,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 18,

      backgroundColor:
        colours.darkblue ||
        "rgba(255,255,255,0.045)",
    },

    sectionHeader: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",

      marginBottom: 14,
    },

    sectionHeadingGroup: {
      flex: 1,
      minWidth: 0,
    },

    sectionDescription: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 3,
    },

    sectionTitle: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 20,
      lineHeight: 26,
      fontWeight: "900",
    },

    sectionCount: {
      minWidth: 30,
      height: 26,

      color: "#ffffff",

      fontSize: 12,
      lineHeight: 26,
      fontWeight: "800",

      textAlign: "center",

      paddingHorizontal: 8,

      borderRadius: 13,

      backgroundColor:
        "rgba(255,255,255,0.1)",
    },

    horizontalReviewList: {
      paddingRight: 12,
    },

    likedSongsSubtitle: {
      color:
        "rgba(255,255,255,0.48)",

      fontSize: 12,

      marginTop: 2,
    },

    horizontalLikedList: {
      paddingRight: 12,
    },

    likedSongCard: {
      position: "relative",

      width: 188,

      flexShrink: 0,

      marginRight: 13,

      overflow: "hidden",

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.42)",

      borderRadius: 14,

      backgroundColor:
        "rgba(12,24,40,0.96)",

      shadowColor:
        colours.lightblue ||
        "#35afe5",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 3,
    },

    compactLikedSongCard: {
      width: 158,
    },

    likedSongImage: {
      width: "100%",
      height: 158,

      resizeMode: "cover",

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    likedSongPlaceholder: {
      width: "100%",
      height: 158,

      alignItems: "center",
      justifyContent: "center",

      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    likedSongPlaceholderText: {
      color:
        "rgba(255,255,255,0.65)",

      fontSize: 42,
    },

    likedSongInfo: {
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 13,
    },

    likedSongTitle: {
      color: "#ffffff",

      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
    },

    likedSongArtist: {
      color:
        "rgba(255,255,255,0.54)",

      fontSize: 12,
      lineHeight: 17,

      marginTop: 2,
    },

    likedSongHeartBadge: {
      position: "absolute",

      top: 9,
      right: 9,

      width: 30,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 15,

      backgroundColor:
        "rgba(0,0,0,0.72)",
    },

    likedSongHeart: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 16,
      lineHeight: 18,
    },

    reviewSnippetCard: {
      width: 340,
      minHeight: 210,

      marginRight: 13,

      borderRadius: 14,
      overflow: "hidden",
    },

    sectionEmptyBox: {
      width: "100%",

      alignItems: "center",
      justifyContent: "center",

      minHeight: 76,

      padding: 15,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.07)",

      borderRadius: 12,

      backgroundColor:
        "rgba(255,255,255,0.025)",
    },

    sectionPlaceholder: {
      color:
        "rgba(255,255,255,0.5)",

      fontSize: 14,
      fontStyle: "italic",

      textAlign: "center",
    },

    activityHeader: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",

      marginBottom: 15,
    },

    activitySubtitle: {
      color:
        "rgba(255,255,255,0.48)",

      fontSize: 12,

      marginTop: 2,
    },

    activityCountBadge: {
      minWidth: 38,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 10,

      borderRadius: 15,

      backgroundColor:
        "rgba(53,175,229,0.15)",
    },

    activityCountText: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 13,
      fontWeight: "900",
    },

    activityContainer: {
      width: "100%",
    },

    activityReviewWrapper: {
      width: "100%",

      marginBottom: 12,
    },

    privateContainer: {
      width: "100%",

      minHeight: 310,

      alignItems: "center",
      justifyContent: "center",

      padding: 28,

      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.1)",

      borderRadius: 18,

      backgroundColor:
        colours.darkblue ||
        "rgba(255,255,255,0.045)",
    },

    privateIcon: {
      width: 68,
      height: 68,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 34,

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    privateIconText: {
      fontSize: 27,
    },

    privateText: {
      color:
        colours.lightblue ||
        "#35afe5",

      fontSize: 21,
      fontWeight: "900",

      marginTop: 18,
    },

    privateText2: {
      maxWidth: 460,

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