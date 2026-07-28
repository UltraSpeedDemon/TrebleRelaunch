import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const DESKTOP_SIDEBAR_WIDTH = 280;
const BOTTOM_NAV_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 900;

const SAMPLE_GROUPS = [
  {
    id: "new-releases",
    name: "New Releases",
    description:
      "Discuss the newest albums, singles, and artists.",
    members: 0,
  },
  {
    id: "music-recommendations",
    name: "Music Recommendations",
    description:
      "Share your favourite songs and discover something new.",
    members: 0,
  },
  {
    id: "album-reviews",
    name: "Album Reviews",
    description:
      "Talk about albums, ratings, and your latest reviews.",
    members: 0,
  },
];

export default function Groups({
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

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchAnimation] =
    useState(
      new Animated.Value(0)
    );

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
   * Keep the search field open on desktop.
   */
  useEffect(() => {
    if (isDesktopWeb) {
      setSearchOpen(true);

      searchAnimation.setValue(1);
    }
  }, [
    isDesktopWeb,
    searchAnimation,
  ]);

  /*
   * Toggle the animated search field on mobile.
   */
  const toggleSearch = () => {
    if (isDesktopWeb) {
      return;
    }

    const nextOpen =
      !searchOpen;

    setSearchOpen(nextOpen);

    Animated.timing(
      searchAnimation,
      {
        toValue:
          nextOpen ? 1 : 0,

        duration: 250,

        useNativeDriver: false,
      }
    ).start();

    if (!nextOpen) {
      setSearchQuery("");
    }
  };

  const searchWidth =
    searchAnimation.interpolate({
      inputRange: [0, 1],

      outputRange: [
        "0%",
        "100%",
      ],
    });

  const searchOpacity =
    searchAnimation.interpolate({
      inputRange: [0, 1],

      outputRange: [0, 1],
    });

  const filteredGroups =
    useMemo(() => {
      const normalizedQuery =
        searchQuery
          .trim()
          .toLowerCase();

      if (!normalizedQuery) {
        return SAMPLE_GROUPS;
      }

      return SAMPLE_GROUPS.filter(
        (group) =>
          group.name
            .toLowerCase()
            .includes(
              normalizedQuery
            ) ||
          group.description
            .toLowerCase()
            .includes(
              normalizedQuery
            )
      );
    }, [searchQuery]);

  const openGroup = (group) => {
    /*
     * This attempts to open a future GroupPage screen.
     * Until that route is added, the cards can remain visual only.
     */
    if (
      navigation
        ?.getState?.()
        ?.routeNames?.includes(
          "GroupPage"
        )
    ) {
      navigation.navigate(
        "GroupPage",
        {
          group,
          groupId: group.id,
        }
      );
    }
  };

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
            styles.groupsScroll,
            isWeb &&
              styles.webGroupsScroll,
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
            <View
              style={
                styles.titleRow
              }
            >
              <View
                style={
                  styles.titleContainer
                }
              >
                <Text
                  style={
                    styles.header
                  }
                >
                  Community
                </Text>

                <Text
                  style={
                    styles.subText
                  }
                >
                  Connect with people who share your taste in music.
                </Text>
              </View>

              {!isDesktopWeb ? (
                <TouchableOpacity
                  style={
                    styles.searchIconButton
                  }
                  onPress={
                    toggleSearch
                  }
                  activeOpacity={0.8}
                >
                  <Image
                    source={require(
                      "../images/searchIcon.png"
                    )}
                    style={
                      styles.searchIcon
                    }
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <Animated.View
              style={[
                styles.searchBarContainer,

                !isDesktopWeb && {
                  width:
                    searchWidth,

                  opacity:
                    searchOpacity,
                },

                isDesktopWeb &&
                  styles.desktopSearchBarContainer,
              ]}
              pointerEvents={
                searchOpen ||
                isDesktopWeb
                  ? "auto"
                  : "none"
              }
            >
              <View
                style={
                  styles.searchBar
                }
              >
                <Image
                  source={require(
                    "../images/searchIcon.png"
                  )}
                  style={
                    styles.searchFieldIcon
                  }
                />

                <TextInput
                  style={
                    styles.searchInput
                  }
                  value={
                    searchQuery
                  }
                  onChangeText={
                    setSearchQuery
                  }
                  placeholder="Search communities"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />

                {searchQuery ? (
                  <TouchableOpacity
                    style={
                      styles.clearButton
                    }
                    onPress={() =>
                      setSearchQuery(
                        ""
                      )
                    }
                  >
                    <Text
                      style={
                        styles.clearButtonText
                      }
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Animated.View>
          </View>

          {/* COMMUNITY INTRO */}
          <View
            style={
              styles.heroCard
            }
          >
            <View
              style={
                styles.heroIconContainer
              }
            >
              <Text
                style={
                  styles.heroIcon
                }
              >
                ♪
              </Text>
            </View>

            <View
              style={
                styles.heroTextContainer
              }
            >
              <Text
                style={
                  styles.heroTitle
                }
              >
                Find your music community
              </Text>

              <Text
                style={
                  styles.heroDescription
                }
              >
                Join conversations about artists, albums, recommendations, and everything music.
              </Text>
            </View>
          </View>

          {/* GROUPS TITLE */}
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
              Discover Groups
            </Text>

            <Text
              style={
                styles.sectionCount
              }
            >
              {filteredGroups.length}
            </Text>
          </View>

          {/* GROUP CARDS */}
          {filteredGroups.length >
          0 ? (
            <View
              style={[
                styles.groupsGrid,

                isCompact &&
                  styles.compactGroupsGrid,
              ]}
            >
              {filteredGroups.map(
                (group) => (
                  <TouchableOpacity
                    key={
                      group.id
                    }
                    style={[
                      styles.groupCard,

                      isDesktopWeb &&
                        styles.desktopGroupCard,
                    ]}
                    onPress={() =>
                      openGroup(
                        group
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={
                        styles.groupIconContainer
                      }
                    >
                      <Text
                        style={
                          styles.groupIcon
                        }
                      >
                        ♫
                      </Text>
                    </View>

                    <View
                      style={
                        styles.groupInfo
                      }
                    >
                      <Text
                        style={
                          styles.groupName
                        }
                      >
                        {group.name}
                      </Text>

                      <Text
                        style={
                          styles.groupDescription
                        }
                      >
                        {
                          group.description
                        }
                      </Text>

                      <Text
                        style={
                          styles.groupMembers
                        }
                      >
                        {group.members}{" "}
                        {group.members ===
                        1
                          ? "member"
                          : "members"}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.groupArrowContainer
                      }
                    >
                      <Text
                        style={
                          styles.groupArrow
                        }
                      >
                        ›
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              )}
            </View>
          ) : (
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
                No groups found
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                Try searching for a different community.
              </Text>
            </View>
          )}

          {/* COMING SOON */}
          <View
            style={
              styles.comingSoonCard
            }
          >
            <Text
              style={
                styles.comingSoonTitle
              }
            >
              More community features are coming
            </Text>

            <Text
              style={
                styles.comingSoonDescription
              }
            >
              Group creation, memberships, posts, and community discussions can be connected to your backend next.
            </Text>
          </View>
        </ScrollView>
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
      colours.background ||
      colours.bluegrey,
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
     PAGE CONTENT
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

    paddingTop: 25,
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

    paddingTop: 72,
    paddingHorizontal: 12,

    overflow: "hidden",
  },

  groupsScroll: {
    flex: 1,
    minHeight: 0,

    width: "100%",
  },

  webGroupsScroll: {
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

    paddingBottom: 50,
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

  titleRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  titleContainer: {
    flex: 1,
    minWidth: 0,
  },

  header: {
    color:
      colours.lightblue,

    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
  },

  subText: {
    color:
      "rgba(255,255,255,0.58)",

    fontSize: 14,
    lineHeight: 20,

    marginTop: 3,
  },

  /* =====================================================
     SEARCH
  ===================================================== */

  searchIconButton: {
    width: 46,
    height: 46,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 12,

    borderRadius: 23,

    backgroundColor:
      "rgba(255,255,255,0.06)",
  },

  searchIcon: {
    width: 24,
    height: 24,

    resizeMode: "contain",
  },

  searchBarContainer: {
    overflow: "hidden",

    alignSelf: "flex-start",

    marginTop: 15,
  },

  desktopSearchBarContainer: {
    width: "100%",

    opacity: 1,
  },

  searchBar: {
    width: "100%",
    minHeight: 48,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 14,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",

    borderRadius: 24,

    backgroundColor:
      colours.darkblue,
  },

  searchFieldIcon: {
    width: 20,
    height: 20,

    resizeMode: "contain",

    marginRight: 10,

    opacity: 0.65,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,

    color: "#ffffff",

    fontSize: 15,

    paddingVertical: 11,

    outlineStyle: "none",
  },

  clearButton: {
    width: 32,
    height: 32,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 7,

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  clearButtonText: {
    color: "#ffffff",

    fontSize: 22,
    lineHeight: 24,
  },

  /* =====================================================
     HERO
  ===================================================== */

  heroCard: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    padding: 22,
    marginBottom: 22,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",

    borderRadius: 18,

    backgroundColor:
      colours.darkblue,
  },

  heroIconContainer: {
    width: 70,
    height: 70,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 18,

    borderRadius: 35,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  heroIcon: {
    color:
      colours.lightblue,

    fontSize: 35,
    fontWeight: "800",
  },

  heroTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  heroTitle: {
    color: "#ffffff",

    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },

  heroDescription: {
    color:
      "rgba(255,255,255,0.52)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 4,
  },

  /* =====================================================
     SECTION HEADER
  ===================================================== */

  sectionHeader: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",

    marginBottom: 13,
  },

  sectionTitle: {
    color: "#ffffff",

    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },

  sectionCount: {
    minWidth: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 10,
    paddingHorizontal: 8,
    paddingTop: 5,

    borderRadius: 14,

    color: "#ffffff",

    fontSize: 12,
    fontWeight: "800",

    textAlign: "center",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  /* =====================================================
     GROUP CARDS
  ===================================================== */

  groupsGrid: {
    width: "100%",
  },

  compactGroupsGrid: {
    width: "100%",
  },

  groupCard: {
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
    shadowOpacity: 0.13,
    shadowRadius: 8,

    elevation: 3,
  },

  desktopGroupCard: {
    maxWidth: 800,

    alignSelf: "center",
  },

  groupIconContainer: {
    width: 54,
    height: 54,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 14,

    borderRadius: 27,

    backgroundColor:
      "rgba(255,255,255,0.07)",
  },

  groupIcon: {
    color:
      colours.lightblue,

    fontSize: 25,
    fontWeight: "800",
  },

  groupInfo: {
    flex: 1,
    minWidth: 0,
  },

  groupName: {
    color: "#ffffff",

    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },

  groupDescription: {
    color:
      "rgba(255,255,255,0.52)",

    fontSize: 13,
    lineHeight: 18,

    marginTop: 3,
  },

  groupMembers: {
    color:
      colours.lightblue,

    fontSize: 12,
    fontWeight: "700",

    marginTop: 7,
  },

  groupArrowContainer: {
    width: 36,
    height: 36,

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 10,

    borderRadius: 18,

    backgroundColor:
      "rgba(255,255,255,0.05)",
  },

  groupArrow: {
    color:
      "rgba(255,255,255,0.7)",

    fontSize: 28,
    lineHeight: 29,
  },

  /* =====================================================
     EMPTY
  ===================================================== */

  emptyContainer: {
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 70,
    paddingHorizontal: 24,
  },

  emptyTitle: {
    color: "#ffffff",

    fontSize: 20,
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
     COMING SOON
  ===================================================== */

  comingSoonCard: {
    width: "100%",

    padding: 20,
    marginTop: 8,

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.07)",

    borderRadius: 16,

    backgroundColor:
      "rgba(255,255,255,0.035)",
  },

  comingSoonTitle: {
    color: "#ffffff",

    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },

  comingSoonDescription: {
    color:
      "rgba(255,255,255,0.48)",

    fontSize: 13,
    lineHeight: 19,

    marginTop: 4,
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