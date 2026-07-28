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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useIsFocused,
} from "@react-navigation/native";

import { auth } from "../utils/firebase";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import ReviewCard from "../components/Review";

import colours from "../styles/colours";

import {
  deleteReview,
  getFollowers,
  getFriends,
  getReviewSong,
  getUser,
  getUserActivity,
  getUserFavorites,
  getUserMostUpvoted,
  getUserTopReviews,
  removeUpvoteFromReview,
  upvoteReview,
} from "../providers/rest";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const MAX_PROFILE_WIDTH = 1050;

export default function Profile({
  navigation,
}) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";

  const isDesktopWeb =
    isWeb &&
    width >= DESKTOP_BREAKPOINT;

  const isMobileWeb =
    isWeb &&
    width < DESKTOP_BREAKPOINT;

  const isCompact = width < 620;

  const isFocused = useIsFocused();

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [username, setUsername] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [followers, setFollowers] =
    useState(0);

  const [following, setFollowing] =
    useState(0);

  const [
    isSpotifyLinked,
    setIsSpotifyLinked,
  ] = useState(false);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [avatar, setAvatar] =
    useState(null);

  const noAvatar =
    require("../images/avatarIcon.png");

  const [topReviews, setTopReviews] =
    useState([]);

  const [favorites, setFavorites] =
    useState([]);

  const [
    mostUpvoted,
    setMostUpvoted,
  ] = useState([]);

  const [activity, setActivity] =
    useState([]);

  const [
    totalReviews,
    setTotalReviews,
  ] = useState(0);

  /*
   * Keep the menu permanently open on desktop.
   * Mobile starts with the menu closed.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  }, [isDesktopWeb]);

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

  /*
   * Retrieve music details belonging to a review.
   */
  const enrichReviewsWithSong =
    useCallback(async (reviews) => {
      if (!Array.isArray(reviews)) {
        return [];
      }

      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        return reviews;
      }

      return Promise.all(
        reviews.map(async (review) => {
          if (review?.song) {
            return review;
          }

          try {
            const response =
              await getReviewSong(
                currentUser.uid,
                review.id
              );

            if (!response?.ok) {
              return review;
            }

            const songData =
              await response.json();

            return {
              ...review,
              song: songData,
            };
          } catch (error) {
            console.error(
              "[Profile] Review enrichment error:",
              error
            );

            return review;
          }
        })
      );
    }, []);

  const loadReviewSections =
    useCallback(async () => {
      const currentUser =
        auth.currentUser;

      if (!currentUser?.uid) {
        setTopReviews([]);
        setFavorites([]);
        setMostUpvoted([]);
        setActivity([]);
        setTotalReviews(0);

        return;
      }

      try {
        const [
          topResponse,
          favoritesResponse,
          upvotedResponse,
          activityResponse,
        ] = await Promise.all([
          getUserTopReviews(
            currentUser.uid
          ),
          getUserFavorites(
            currentUser.uid
          ),
          getUserMostUpvoted(
            currentUser.uid
          ),
          getUserActivity(
            currentUser.uid
          ),
        ]);

        if (topResponse?.ok) {
          const topData =
            await topResponse.json();

          const enrichedTop =
            await enrichReviewsWithSong(
              Array.isArray(topData)
                ? topData
                : []
            );

          setTopReviews(enrichedTop);
        } else {
          setTopReviews([]);
        }

        if (favoritesResponse?.ok) {
          const favoritesData =
            await favoritesResponse.json();

          const enrichedFavorites =
            await enrichReviewsWithSong(
              Array.isArray(
                favoritesData
              )
                ? favoritesData
                : []
            );

          setFavorites(
            enrichedFavorites
          );
        } else {
          setFavorites([]);
        }

        if (upvotedResponse?.ok) {
          const upvotedData =
            await upvotedResponse.json();

          const enrichedUpvoted =
            await enrichReviewsWithSong(
              Array.isArray(
                upvotedData
              )
                ? upvotedData
                : []
            );

          setMostUpvoted(
            enrichedUpvoted
          );
        } else {
          setMostUpvoted([]);
        }

        if (activityResponse?.ok) {
          const activityData =
            await activityResponse.json();

          const rawActivity =
            Array.isArray(activityData)
              ? activityData
              : [];

          const enrichedActivity =
            await enrichReviewsWithSong(
              rawActivity
            );

          setActivity(
            enrichedActivity
          );

          setTotalReviews(
            rawActivity.length
          );
        } else {
          setActivity([]);
          setTotalReviews(0);
        }
      } catch (error) {
        console.error(
          "[Profile] Review-section error:",
          error
        );

        setTopReviews([]);
        setFavorites([]);
        setMostUpvoted([]);
        setActivity([]);
        setTotalReviews(0);
      }
    }, [enrichReviewsWithSong]);

  const loadProfile =
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
            "Failed to fetch user data."
          );
        }

        const userData =
          await response.json();

        setUsername(
          userData?.username ||
            currentUser.displayName ||
            "User"
        );

        setEmail(
          userData?.email ||
            currentUser.email ||
            ""
        );

        setFollowers(
          Number(
            userData?.followersCount ||
              0
          )
        );

        setFollowing(
          Number(
            userData?.followingCount ||
              0
          )
        );

        setIsSpotifyLinked(
          Boolean(
            userData?.spotifyAccessToken
          )
        );

        setIsAdmin(
          Boolean(userData?.isAdmin)
        );

        if (
          userData?.avatar &&
          userData.avatar !== "None" &&
          (
            userData.avatar.startsWith(
              "data:"
            ) ||
            userData.avatar.startsWith(
              "http"
            )
          )
        ) {
          setAvatar(userData.avatar);
        } else {
          setAvatar(null);
        }

        await loadReviewSections();
      } catch (error) {
        console.error(
          "[Profile] Load error:",
          error
        );

        Alert.alert(
          "Unable to load profile",
          error?.message ||
            "Please try again."
        );
      } finally {
        setLoading(false);
      }
    }, [
      loadReviewSections,
      navigation,
    ]);

  useEffect(() => {
    if (isFocused) {
      loadProfile();
    }
  }, [
    isFocused,
    loadProfile,
  ]);

  /*
   * Update follower/following counts independently.
   */
  useEffect(() => {
    let mounted = true;

    const fetchSocialCounts =
      async () => {
        const currentUser =
          auth.currentUser;

        if (!currentUser?.uid) {
          return;
        }

        try {
          const [
            followersResponse,
            followingResponse,
          ] = await Promise.all([
            getFollowers(
              currentUser.uid
            ),
            getFriends(
              currentUser.uid
            ),
          ]);

          if (
            mounted &&
            followersResponse?.ok
          ) {
            const followerData =
              await followersResponse.json();

            setFollowers(
              Array.isArray(
                followerData
              )
                ? followerData.length
                : 0
            );
          }

          if (
            mounted &&
            followingResponse?.ok
          ) {
            const followingData =
              await followingResponse.json();

            setFollowing(
              Array.isArray(
                followingData
              )
                ? followingData.length
                : 0
            );
          }
        } catch (error) {
          console.error(
            "[Profile] Social-count error:",
            error
          );
        }
      };

    fetchSocialCounts();

    return () => {
      mounted = false;
    };
  }, []);

  const updateReviewArray =
    useCallback(
      (
        reviewArray,
        reviewId
      ) => {
        return reviewArray.map(
          (reviewItem) => {
            if (
              reviewItem.id !==
              reviewId
            ) {
              return reviewItem;
            }

            const currentUpvotes =
              Number(
                reviewItem.upvotes ||
                  0
              );

            return {
              ...reviewItem,

              upvoted:
                !reviewItem.upvoted,

              upvotes:
                reviewItem.upvoted
                  ? Math.max(
                      0,
                      currentUpvotes -
                        1
                    )
                  : currentUpvotes +
                    1,
            };
          }
        );
      },
      []
    );

  const handleUpvote =
    useCallback(
      async (reviewId) => {
        const combinedReviews = [
          ...topReviews,
          ...favorites,
          ...mostUpvoted,
          ...activity,
        ];

        const existingReview =
          combinedReviews.find(
            (reviewItem) =>
              reviewItem.id ===
              reviewId
          );

        if (!existingReview) {
          return;
        }

        try {
          const response =
            existingReview.upvoted
              ? await removeUpvoteFromReview(
                  reviewId
                )
              : await upvoteReview(
                  reviewId
                );

          if (
            response &&
            response.ok === false
          ) {
            throw new Error(
              "Unable to update review."
            );
          }

          setTopReviews(
            (currentReviews) =>
              updateReviewArray(
                currentReviews,
                reviewId
              )
          );

          setFavorites(
            (currentReviews) =>
              updateReviewArray(
                currentReviews,
                reviewId
              )
          );

          setMostUpvoted(
            (currentReviews) =>
              updateReviewArray(
                currentReviews,
                reviewId
              )
          );

          setActivity(
            (currentReviews) =>
              updateReviewArray(
                currentReviews,
                reviewId
              )
          );
        } catch (error) {
          console.error(
            "[Profile] Upvote error:",
            error
          );

          Alert.alert(
            "Unable to update review",
            error?.message ||
              "Please try again."
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
        const combinedReviews = [
          ...topReviews,
          ...favorites,
          ...mostUpvoted,
          ...activity,
        ];

        const existingReview =
          combinedReviews.find(
            (reviewItem) =>
              reviewItem.id ===
              reviewId
          );

        if (!existingReview) {
          return;
        }

        if (
          !existingReview.isUser
        ) {
          Alert.alert(
            "Unable to delete",
            "You can only delete your own reviews."
          );

          return;
        }

        Alert.alert(
          "Delete Review?",
          "Are you sure you want to delete this review?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Delete",
              style: "destructive",

              onPress: async () => {
                try {
                  const response =
                    await deleteReview(
                      reviewId
                    );

                  if (
                    response &&
                    response.ok ===
                      false
                  ) {
                    throw new Error(
                      "Unable to delete review."
                    );
                  }

                  await loadReviewSections();
                } catch (error) {
                  console.error(
                    "[Profile] Delete error:",
                    error
                  );

                  Alert.alert(
                    "Unable to delete review",
                    error?.message ||
                      "Please try again."
                  );
                }
              },
            },
          ]
        );
      },
      [
        activity,
        favorites,
        loadReviewSections,
        mostUpvoted,
        topReviews,
      ]
    );

  const handleSpotifyBadgePress =
    useCallback(() => {
      Alert.alert(
        "Spotify Connected",
        "Your account is linked to Spotify."
      );
    }, []);

  const handleAdminBadgePress =
    useCallback(() => {
      Alert.alert(
        "Admin Account",
        "This account has administrator or developer access."
      );
    }, []);

  const renderHorizontalReview =
    useCallback(
      ({ item }) => (
        <View
          style={[
            styles.reviewSnippetCard,
            isCompact &&
              styles.compactReviewSnippetCard,
          ]}
        >
          <ReviewCard
            item={item}
            avatar={
              avatar
                ? {
                    uri: avatar,
                  }
                : noAvatar
            }
            handleUpvote={
              handleUpvote
            }
            handleDelete={
              handleDelete
            }
            navigation={navigation}
            showReplyInput={false}
            showComments={false}
          />
        </View>
      ),
      [
        avatar,
        handleDelete,
        handleUpvote,
        isCompact,
        navigation,
        noAvatar,
      ]
    );

  const renderReviewSection =
    useCallback(
      ({
        title,
        description,
        data,
        emptyText,
      }) => (
        <View style={styles.cardSection}>
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionHeadingGroup
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                {title}
              </Text>

              {description ? (
                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  {description}
                </Text>
              ) : null}
            </View>

            <Text
              style={styles.sectionCount}
            >
              {data.length}
            </Text>
          </View>

          {data.length === 0 ? (
            <View
              style={
                styles.sectionEmptyState
              }
            >
              <Text
                style={
                  styles.sectionPlaceholder
                }
              >
                {emptyText}
              </Text>
            </View>
          ) : (
            <FlatList
              data={data}
              horizontal
              renderItem={
                renderHorizontalReview
              }
              keyExtractor={(
                item,
                index
              ) =>
                String(
                  item?.id ||
                    `${title}-${index}`
                )
              }
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.horizontalReviewList
              }
              nestedScrollEnabled
              removeClippedSubviews={
                false
              }
            />
          )}
        </View>
      ),
      [renderHorizontalReview]
    );

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
          style={styles.loadingText}
        >
          Loading profile...
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
          isDesktop={isDesktopWeb}
        />
      </View>

      {/* =====================================================
          PROFILE CONTENT
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
          nestedScrollEnabled
        >
          {/* PROFILE HEADER */}
          <View
            style={[
              styles.profileHeader,
              isCompact &&
                styles.compactProfileHeader,
            ]}
          >
            <View
              style={[
                styles.profileMainRow,
                isCompact &&
                  styles.compactProfileMainRow,
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(
                    "EditProfile"
                  )
                }
                activeOpacity={0.8}
              >
                <Image
                  source={
                    avatar
                      ? {
                          uri: avatar,
                        }
                      : noAvatar
                  }
                  style={[
                    styles.avatar,
                    isCompact &&
                      styles.compactAvatar,
                  ]}
                />
              </TouchableOpacity>

              <View
                style={
                  styles.headerInfo
                }
              >
                <Text
                  style={
                    styles.username
                  }
                  numberOfLines={1}
                >
                  {formatUsername(
                    username
                  )}
                </Text>

                {email ? (
                  <Text
                    style={
                      styles.email
                    }
                    numberOfLines={1}
                  >
                    {email}
                  </Text>
                ) : null}

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
                      style={
                        styles.badgeButton
                      }
                    >
                      <Image
                        source={require("../images/spotifyLogo.png")}
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
                      style={
                        styles.badgeButton
                      }
                    >
                      <Image
                        source={require("../images/adminBadge.png")}
                        style={
                          styles.badgeIcon
                        }
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {!isCompact ? (
                <TouchableOpacity
                  style={
                    styles.editButton
                  }
                  onPress={() =>
                    navigation.navigate(
                      "EditProfile"
                    )
                  }
                >
                  <Text
                    style={
                      styles.editButtonText
                    }
                  >
                    Edit Profile
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* SOCIAL STATS */}
            <View
              style={
                styles.socialStatsRow
              }
            >
              <TouchableOpacity
                style={
                  styles.statButton
                }
                onPress={() =>
                  navigation.navigate(
                    "FollowersList"
                  )
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {followers}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Followers
                </Text>
              </TouchableOpacity>

              <View
                style={
                  styles.statDivider
                }
              />

              <TouchableOpacity
                style={
                  styles.statButton
                }
                onPress={() =>
                  navigation.navigate(
                    "FollowingList"
                  )
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {following}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Following
                </Text>
              </TouchableOpacity>

              <View
                style={
                  styles.statDivider
                }
              />

              <View
                style={
                  styles.statButton
                }
              >
                <Text
                  style={
                    styles.statNumber
                  }
                >
                  {totalReviews}
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

            {isCompact ? (
              <TouchableOpacity
                style={[
                  styles.editButton,
                  styles.compactEditButton,
                ]}
                onPress={() =>
                  navigation.navigate(
                    "EditProfile"
                  )
                }
              >
                <Text
                  style={
                    styles.editButtonText
                  }
                >
                  Edit Profile
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* REVIEW SECTIONS */}
          {renderReviewSection({
            title: "Top Reviews",
            description:
              "Your strongest reviews",
            data: topReviews,
            emptyText:
              "No top reviews yet.",
          })}

          {renderReviewSection({
            title: "Favourites",
            description:
              "Reviews you marked as favourites",
            data: favorites,
            emptyText:
              "No favourite reviews yet.",
          })}

          {renderReviewSection({
            title: "Most Upvoted",
            description:
              "Reviews with the most community support",
            data: mostUpvoted,
            emptyText:
              "No upvoted reviews yet.",
          })}

          {/* LATEST ACTIVITY */}
          <View
            style={[
              styles.cardSection,
              styles.activitySection,
            ]}
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={
                  styles.sectionHeadingGroup
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Latest Activity
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  Newest to oldest
                </Text>
              </View>

              <Text
                style={
                  styles.sectionCount
                }
              >
                {totalReviews}
              </Text>
            </View>

            {activity.length === 0 ? (
              <View
                style={
                  styles.activityEmptyState
                }
              >
                <Text
                  style={
                    styles.activityEmptyTitle
                  }
                >
                  No activity yet
                </Text>

                <Text
                  style={
                    styles.sectionPlaceholder
                  }
                >
                  Start reviewing songs, albums, and artists.
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
                    <View
                      key={String(
                        item?.id ||
                          `activity-${index}`
                      )}
                      style={
                        styles.activityReviewWrapper
                      }
                    >
                      <ReviewCard
                        item={item}
                        avatar={
                          avatar
                            ? {
                                uri: avatar,
                              }
                            : noAvatar
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
                        showReplyInput={
                          false
                        }
                        showComments={
                          false
                        }
                      />
                    </View>
                  )
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* MOBILE BOTTOM NAVIGATION */}
      <View
        style={[
          styles.bottomNavBar,
          isDesktopWeb && styles.desktopBottomNavBar,
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
desktopBottomNavBar: {
  left: DESKTOP_SIDEBAR_WIDTH,
  width: `calc(100% - ${DESKTOP_SIDEBAR_WIDTH}px)`,
},
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
     PAGE CONTENT AND SCROLLING
  ===================================================== */

  pageContent: {
    flex: 1,
    minHeight: 0,

    paddingBottom: 74,

    overflow: "hidden",
  },

  desktopPageContent: {
    position: "absolute",

    top: 0,
    left:
      DESKTOP_SIDEBAR_WIDTH,
    right: 0,
    bottom: 0,

    minHeight: 0,

    paddingTop: 24,
    paddingLeft: 28,
    paddingRight: 28,

    overflow: "hidden",
  },

  mobilePageContent: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 72,

    minHeight: 0,

    paddingTop: 70,
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

    overscrollBehaviorY:
      "contain",

    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },

  scrollContainer: {
    width: "100%",

    paddingBottom: 115,
  },

  desktopScrollContainer: {
    width: "100%",
    maxWidth:
      MAX_PROFILE_WIDTH,

    alignSelf: "center",

    paddingBottom: 65,
  },

  /* =====================================================
     PROFILE HEADER
  ===================================================== */

  profileHeader: {
    width: "100%",

    padding: 22,
    marginBottom: 18,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,

    elevation: 5,
  },

  compactProfileHeader: {
    padding: 16,

    borderRadius: 15,
  },

  profileMainRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
  },

  compactProfileMainRow: {
    alignItems: "flex-start",
  },

  avatar: {
    width: 104,
    height: 104,

    marginRight: 20,

    borderRadius: 52,

    borderWidth: 3,
    borderColor:
      "rgba(255,255,255,0.1)",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  compactAvatar: {
    width: 78,
    height: 78,

    marginRight: 14,

    borderRadius: 39,
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  username: {
    color:
      colours.lightblue,

    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
  },

  email: {
    color:
      "rgba(255,255,255,0.57)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 9,

    gap: 7,
  },

  badgeButton: {
    width: 33,
    height: 33,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 17,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  badgeIcon: {
    width: 23,
    height: 23,

    resizeMode: "contain",
  },

  editButton: {
    minHeight: 43,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 18,
    paddingVertical: 10,

    borderRadius: 22,

    backgroundColor:
      colours.lightblue,
  },

  compactEditButton: {
    width: "100%",

    marginTop: 16,
  },

  editButtonText: {
    color: "#ffffff",

    fontSize: 14,
    fontWeight: "800",
  },

  /* =====================================================
     PROFILE STATISTICS
  ===================================================== */

  socialStatsRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    marginTop: 21,
    paddingTop: 17,

    borderTopWidth: 1,
    borderTopColor:
      "rgba(255,255,255,0.1)",
  },

  statButton: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 8,
  },

  statNumber: {
    color: "#ffffff",

    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
  },

  statLabel: {
    color:
      "rgba(255,255,255,0.56)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 34,

    backgroundColor:
      "rgba(255,255,255,0.12)",
  },

  /* =====================================================
     PROFILE SECTIONS
  ===================================================== */

  cardSection: {
    width: "100%",

    padding: 18,
    marginBottom: 17,

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

  sectionHeader: {
    width: "100%",

    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",

    marginBottom: 13,
  },

  sectionHeadingGroup: {
    flex: 1,
    minWidth: 0,

    paddingRight: 12,
  },

  sectionTitle: {
    color:
      colours.lightblue,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },

  sectionDescription: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 12,
    lineHeight: 17,

    marginTop: 2,
  },

  sectionCount: {
    minWidth: 31,
    height: 31,

    color: "#ffffff",

    fontSize: 12,
    lineHeight: 31,
    fontWeight: "800",

    textAlign: "center",

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  sectionEmptyState: {
    minHeight: 76,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 16,

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  sectionPlaceholder: {
    color:
      "rgba(255,255,255,0.6)",

    fontSize: 14,
    lineHeight: 20,

    textAlign: "center",
  },

  horizontalReviewList: {
    paddingRight: 4,
  },

  reviewSnippetCard: {
    width: 340,

    marginRight: 13,
  },

  compactReviewSnippetCard: {
    width: 285,
  },

  /* =====================================================
     ACTIVITY
  ===================================================== */

  activitySection: {
    marginBottom: 0,
  },

  activityContainer: {
    width: "100%",
  },

  activityReviewWrapper: {
    width: "100%",

    marginBottom: 13,
  },

  activityEmptyState: {
    minHeight: 130,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    borderRadius: 12,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  activityEmptyTitle: {
    color: "#ffffff",

    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",

    marginBottom: 5,
  },

  /* =====================================================
     MOBILE NAVIGATION
  ===================================================== */

  bottomNavBar: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 90,
  },
});