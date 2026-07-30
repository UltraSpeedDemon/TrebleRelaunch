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

const PLACEHOLDER_CONVERSATIONS = [
  {
    id: "1",
    username: "Music Lover",
    lastMessage: "What did you think of that album?",
    time: "2m",
    unread: 2,
    avatar: null,
  },
  {
    id: "2",
    username: "Treble User",
    lastMessage: "I added it to my favourites.",
    time: "1h",
    unread: 0,
    avatar: null,
  },
  {
    id: "3",
    username: "Indie Fan",
    lastMessage: "Send me your newest recommendations!",
    time: "Yesterday",
    unread: 0,
    avatar: null,
  },
];

const FALLBACK_AVATAR =
  require("../images/avatarIcon.png");

export default function Messages({
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

  useEffect(() => {
    if (isDesktopWeb) {
      setMenuOpen(true);
      setSearchOpen(true);
      searchAnimation.setValue(1);
    } else {
      setMenuOpen(false);
      setSearchOpen(false);
      searchAnimation.setValue(0);
    }
  }, [
    isDesktopWeb,
    searchAnimation,
  ]);

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

  const searchTranslateX =
    searchAnimation.interpolate({
      inputRange: [0, 1],

      outputRange: [180, 0],
    });

  const filteredConversations =
    useMemo(() => {
      const normalizedQuery =
        searchQuery
          .trim()
          .toLowerCase();

      if (!normalizedQuery) {
        return PLACEHOLDER_CONVERSATIONS;
      }

      return PLACEHOLDER_CONVERSATIONS.filter(
        (conversation) =>
          conversation.username
            .toLowerCase()
            .includes(
              normalizedQuery
            ) ||
          conversation.lastMessage
            .toLowerCase()
            .includes(
              normalizedQuery
            )
      );
    }, [searchQuery]);

  const openConversation = (
    conversation
  ) => {
    const routeNames =
      navigation
        ?.getState?.()
        ?.routeNames || [];

    if (
      routeNames.includes(
        "Conversation"
      )
    ) {
      navigation.navigate(
        "Conversation",
        {
          conversationId:
            conversation.id,

          userId:
            conversation.userId,

          username:
            conversation.username,
        }
      );

      return;
    }

    if (
      routeNames.includes(
        "Chat"
      )
    ) {
      navigation.navigate(
        "Chat",
        {
          conversationId:
            conversation.id,

          userId:
            conversation.userId,

          username:
            conversation.username,
        }
      );
    }
  };

  const getAvatarSource = (
    avatar
  ) => {
    if (
      avatar &&
      typeof avatar ===
        "string" &&
      avatar !== "None" &&
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
  };

  return (
    <View
      style={[
        styles.container,

        isWeb &&
          styles.webContainer,
      ]}
    >
      {/* Sidebar */}
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

      {/* Page content */}
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
            styles.messagesScroll,

            isWeb &&
              styles.webMessagesScroll,
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
          {/* Page header */}
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
                  Messages
                </Text>

                <Text
                  style={
                    styles.subText
                  }
                >
                  Stay connected with your conversations.
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

                  transform: [
                    {
                      translateX:
                        searchTranslateX,
                    },
                  ],
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
                    "../images/blackSearchIcon.png"
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
                  placeholder="Search messages..."
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

          {/* Message summary */}
          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={
                styles.summaryIconContainer
              }
            >
              <Text
                style={
                  styles.summaryIcon
                }
              >
                ✉
              </Text>
            </View>

            <View
              style={
                styles.summaryInfo
              }
            >
              <Text
                style={
                  styles.summaryTitle
                }
              >
                Your conversations
              </Text>

              <Text
                style={
                  styles.summaryDescription
                }
              >
                View your latest messages and continue chatting with other Treble users.
              </Text>
            </View>
          </View>

          {/* Conversation heading */}
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
              Recent Messages
            </Text>

            <View
              style={
                styles.countBadge
              }
            >
              <Text
                style={
                  styles.countText
                }
              >
                {
                  filteredConversations.length
                }
              </Text>
            </View>
          </View>

          {/* Conversations */}
          {filteredConversations.length >
          0 ? (
            <View
              style={
                styles.conversationList
              }
            >
              {filteredConversations.map(
                (
                  conversation
                ) => (
                  <TouchableOpacity
                    key={
                      conversation.id
                    }
                    style={[
                      styles.conversationCard,

                      isCompact &&
                        styles.compactConversationCard,
                    ]}
                    onPress={() =>
                      openConversation(
                        conversation
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={
                        styles.avatarContainer
                      }
                    >
                      <Image
                        source={getAvatarSource(
                          conversation.avatar
                        )}
                        style={
                          styles.avatar
                        }
                      />

                      <View
                        style={
                          styles.onlineIndicator
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.conversationInfo
                      }
                    >
                      <View
                        style={
                          styles.conversationTopRow
                        }
                      >
                        <Text
                          style={[
                            styles.username,

                            conversation.unread >
                              0 &&
                              styles.unreadUsername,
                          ]}
                          numberOfLines={
                            1
                          }
                        >
                          {
                            conversation.username
                          }
                        </Text>

                        <Text
                          style={
                            styles.messageTime
                          }
                        >
                          {
                            conversation.time
                          }
                        </Text>
                      </View>

                      <View
                        style={
                          styles.messagePreviewRow
                        }
                      >
                        <Text
                          style={[
                            styles.lastMessage,

                            conversation.unread >
                              0 &&
                              styles.unreadMessage,
                          ]}
                          numberOfLines={
                            1
                          }
                        >
                          {
                            conversation.lastMessage
                          }
                        </Text>

                        {conversation.unread >
                        0 ? (
                          <View
                            style={
                              styles.unreadBadge
                            }
                          >
                            <Text
                              style={
                                styles.unreadBadgeText
                              }
                            >
                              {
                                conversation.unread
                              }
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={
                        styles.arrowContainer
                      }
                    >
                      <Text
                        style={
                          styles.arrow
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
                  styles.emptyIcon
                }
              >
                ✉
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No messages found
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                Try searching for a different conversation.
              </Text>
            </View>
          )}

          {/* Placeholder notice */}
          <View
            style={
              styles.placeholderCard
            }
          >
            <Text
              style={
                styles.placeholderTitle
              }
            >
              Messaging backend not connected yet
            </Text>

            <Text
              style={
                styles.placeholderDescription
              }
            >
              The conversation cards currently use placeholder data. Replace the placeholder array with your message API when those endpoints are available.
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Bottom navigation */}
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
        colours.bluegrey,
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

    messagesScroll: {
      flex: 1,
      minHeight: 0,

      width: "100%",
    },

    webMessagesScroll: {
      height: "100%",

      overflowY: "auto",
      overflowX: "hidden",

      WebkitOverflowScrolling:
        "touch",

      overscrollBehaviorY:
        "contain",

      scrollbarWidth: "none",

      msOverflowStyle:
        "none",
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

    summaryCard: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 21,
      marginBottom: 22,

      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 18,

      backgroundColor:
        colours.darkblue,
    },

    summaryIconContainer: {
      width: 66,
      height: 66,

      alignItems: "center",
      justifyContent: "center",

      marginRight: 17,

      borderRadius: 33,

      backgroundColor:
        "rgba(255,255,255,0.07)",
    },

    summaryIcon: {
      color:
        colours.lightblue,

      fontSize: 29,
      fontWeight: "800",
    },

    summaryInfo: {
      flex: 1,
      minWidth: 0,
    },

    summaryTitle: {
      color: "#ffffff",

      fontSize: 19,
      lineHeight: 25,

      fontWeight: "800",
    },

    summaryDescription: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 4,
    },

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

    countBadge: {
      minWidth: 28,
      height: 28,

      alignItems: "center",
      justifyContent: "center",

      marginLeft: 10,

      paddingHorizontal: 8,

      borderRadius: 14,

      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    countText: {
      color: "#ffffff",

      fontSize: 12,
      fontWeight: "800",
    },

    conversationList: {
      width: "100%",
    },

    conversationCard: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      padding: 16,
      marginBottom: 12,

      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.08)",

      borderRadius: 16,

      backgroundColor:
        colours.darkblue,

      shadowColor:
        "#000000",

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity: 0.13,
      shadowRadius: 8,

      elevation: 3,
    },

    compactConversationCard: {
      padding: 14,
    },

    avatarContainer: {
      position: "relative",

      width: 58,
      height: 58,

      marginRight: 14,
    },

    avatar: {
      width: 58,
      height: 58,

      borderRadius: 29,

      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    onlineIndicator: {
      position: "absolute",

      right: 1,
      bottom: 1,

      width: 14,
      height: 14,

      borderWidth: 2,

      borderColor:
        colours.darkblue,

      borderRadius: 7,

      backgroundColor:
        "#46c56b",
    },

    conversationInfo: {
      flex: 1,
      minWidth: 0,
    },

    conversationTopRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      justifyContent:
        "space-between",
    },

    username: {
      flex: 1,
      minWidth: 0,

      color: "#ffffff",

      fontSize: 16,
      lineHeight: 22,

      fontWeight: "700",

      marginRight: 12,
    },

    unreadUsername: {
      fontWeight: "900",
    },

    messageTime: {
      color:
        "rgba(255,255,255,0.43)",

      fontSize: 11,
    },

    messagePreviewRow: {
      width: "100%",

      flexDirection: "row",
      alignItems: "center",

      marginTop: 4,
    },

    lastMessage: {
      flex: 1,
      minWidth: 0,

      color:
        "rgba(255,255,255,0.5)",

      fontSize: 13,
      lineHeight: 18,

      marginRight: 10,
    },

    unreadMessage: {
      color:
        "rgba(255,255,255,0.8)",

      fontWeight: "700",
    },

    unreadBadge: {
      minWidth: 22,
      height: 22,

      alignItems: "center",
      justifyContent: "center",

      paddingHorizontal: 6,

      borderRadius: 11,

      backgroundColor:
        colours.lightblue,
    },

    unreadBadgeText: {
      color: "#ffffff",

      fontSize: 11,
      fontWeight: "900",
    },

    arrowContainer: {
      width: 36,
      height: 36,

      alignItems: "center",
      justifyContent: "center",

      marginLeft: 10,

      borderRadius: 18,

      backgroundColor:
        "rgba(255,255,255,0.05)",
    },

    arrow: {
      color:
        "rgba(255,255,255,0.7)",

      fontSize: 28,
      lineHeight: 29,
    },

    emptyContainer: {
      width: "100%",

      alignItems: "center",
      justifyContent: "center",

      paddingVertical: 70,
      paddingHorizontal: 24,
    },

    emptyIcon: {
      color:
        colours.lightblue,

      fontSize: 44,

      marginBottom: 13,
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

    placeholderCard: {
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

    placeholderTitle: {
      color: "#ffffff",

      fontSize: 16,
      lineHeight: 22,

      fontWeight: "800",
    },

    placeholderDescription: {
      color:
        "rgba(255,255,255,0.48)",

      fontSize: 13,
      lineHeight: 19,

      marginTop: 4,
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