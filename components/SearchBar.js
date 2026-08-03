import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useNavigation,
} from "@react-navigation/native";

import Icon from "react-native-vector-icons/MaterialIcons";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;
const SEARCH_HISTORY_KEY =
  "treble_search_history_v1";
const MAX_HISTORY_ITEMS = 3;

const SearchBar = () => {
  const navigation =
    useNavigation();

  const { width } =
    useWindowDimensions();

  const blurTimerRef =
    useRef(null);

  const isDesktopWeb =
    Platform.OS === "web" &&
    width >= DESKTOP_BREAKPOINT;

  const placeholderText =
    isDesktopWeb
      ? "Search for Songs, Albums, Artists and Friends"
      : "Search for Music";

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    focused,
    setFocused,
  ] = useState(false);

  const [
    searchHistory,
    setSearchHistory,
  ] = useState([]);

  const cleanedQuery =
    searchQuery.trim();

  const loadSearchHistory =
    useCallback(async () => {
      try {
        const raw =
          await AsyncStorage.getItem(
            SEARCH_HISTORY_KEY
          );

        const parsed =
          raw
            ? JSON.parse(raw)
            : [];

        setSearchHistory(
          Array.isArray(parsed)
            ? parsed
                .map(String)
                .filter(Boolean)
                .slice(
                  0,
                  MAX_HISTORY_ITEMS
                )
            : []
        );
      } catch (error) {
        console.warn(
          "[SearchBar] Could not load search history:",
          error
        );
      }
    }, []);

  useEffect(() => {
    loadSearchHistory();

    return () => {
      if (blurTimerRef.current) {
        clearTimeout(
          blurTimerRef.current
        );
      }
    };
  }, [loadSearchHistory]);

  const saveSearchTerm =
    useCallback(
      async (query) => {
        const clean =
          String(query || "").trim();

        if (!clean) {
          return;
        }

        const nextHistory = [
          clean,
          ...searchHistory.filter(
            (item) =>
              item.toLowerCase() !==
              clean.toLowerCase()
          ),
        ].slice(
          0,
          MAX_HISTORY_ITEMS
        );

        setSearchHistory(
          nextHistory
        );

        try {
          await AsyncStorage.setItem(
            SEARCH_HISTORY_KEY,
            JSON.stringify(
              nextHistory
            )
          );
        } catch (error) {
          console.warn(
            "[SearchBar] Could not save search history:",
            error
          );
        }
      },
      [searchHistory]
    );

  const runSearch =
    useCallback(
      async (query) => {
        const clean =
          String(query || "").trim();

        if (!clean) {
          return;
        }

        setSearchQuery(clean);

        await saveSearchTerm(
          clean
        );

        setFocused(false);

        navigation.push(
          "Search",
          {
            searchQuery: clean,
          }
        );
      },
      [
        navigation,
        saveSearchTerm,
      ]
    );

  const submitSearch = () => {
    runSearch(cleanedQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const removeHistoryItem =
    useCallback(
      async (itemToRemove) => {
        const nextHistory =
          searchHistory.filter(
            (item) =>
              item !==
              itemToRemove
          );

        setSearchHistory(
          nextHistory
        );

        try {
          await AsyncStorage.setItem(
            SEARCH_HISTORY_KEY,
            JSON.stringify(
              nextHistory
            )
          );
        } catch (error) {
          console.warn(
            "[SearchBar] Could not update search history:",
            error
          );
        }
      },
      [searchHistory]
    );

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(
        blurTimerRef.current
      );
    }

    setFocused(true);
    loadSearchHistory();
  };

  const handleBlur = () => {
    blurTimerRef.current =
      setTimeout(() => {
        setFocused(false);
      }, 170);
  };

  const showHistory =
    focused &&
    !cleanedQuery &&
    searchHistory.length > 0;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.searchShell,
          focused &&
            styles.searchShellFocused,
          showHistory &&
            styles.searchShellWithHistory,
        ]}
      >
        <View
          style={
            styles.searchIconWrap
          }
        >
          <Icon
            name="search"
            size={22}
            color={
              focused
                ? "#ffffff"
                : colours.lightblue
            }
          />
        </View>

        <TextInput
          value={searchQuery}
          onChangeText={
            setSearchQuery
          }
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={
            styles.searchInput
          }
          placeholder={
            placeholderText
          }
          placeholderTextColor="rgba(255,255,255,0.38)"
          selectionColor={
            colours.lightblue
          }
          returnKeyType="search"
          onSubmitEditing={
            submitSearch
          }
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
        />

        {searchQuery.length >
        0 ? (
          <Pressable
            onPress={clearSearch}
            style={({
              pressed,
              hovered,
            }) => [
              styles.clearButton,

              (pressed ||
                hovered) &&
                styles.clearButtonActive,
            ]}
            hitSlop={8}
          >
            <Icon
              name="close"
              size={18}
              color="rgba(255,255,255,0.70)"
            />
          </Pressable>
        ) : null}

        <Pressable
          onPress={
            submitSearch
          }
          disabled={!cleanedQuery}
          style={({
            pressed,
            hovered,
          }) => [
            styles.submitButton,

            !cleanedQuery &&
              styles.submitButtonDisabled,

            cleanedQuery &&
              (pressed ||
                hovered) &&
              styles.submitButtonActive,
          ]}
        >
          <Icon
            name="arrow-forward"
            size={19}
            color={
              cleanedQuery
                ? "#ffffff"
                : "rgba(255,255,255,0.28)"
            }
          />

          {isDesktopWeb ? (
            <Text
              style={[
                styles.submitButtonText,

                !cleanedQuery &&
                  styles.submitButtonTextDisabled,
              ]}
            >
              Search
            </Text>
          ) : null}
        </Pressable>
      </View>

      {showHistory ? (
        <View
          style={
            styles.historyPopup
          }
        >
          <View
            style={
              styles.historyHeader
            }
          >
            <Text
              style={
                styles.historyHeading
              }
            >
              Recent searches
            </Text>

            <Text
              style={
                styles.historyHint
              }
            >
              Last 3
            </Text>
          </View>

          {searchHistory.map(
            (historyItem) => (
              <Pressable
                key={historyItem}
                onPress={() =>
                  runSearch(
                    historyItem
                  )
                }
                style={({
                  pressed,
                  hovered,
                }) => [
                  styles.historyRow,

                  (pressed ||
                    hovered) &&
                    styles.historyRowActive,
                ]}
              >
                <View
                  style={
                    styles.historyIcon
                  }
                >
                  <Icon
                    name="history"
                    size={17}
                    color={
                      colours.lightblue
                    }
                  />
                </View>

                <Text
                  style={
                    styles.historyText
                  }
                  numberOfLines={1}
                >
                  {historyItem}
                </Text>

                <Pressable
                  onPress={(
                    event
                  ) => {
                    event?.stopPropagation?.();

                    removeHistoryItem(
                      historyItem
                    );
                  }}
                  style={
                    styles.historyRemove
                  }
                  hitSlop={8}
                >
                  <Icon
                    name="close"
                    size={16}
                    color="rgba(255,255,255,0.48)"
                  />
                </Pressable>
              </Pressable>
            )
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles =
  StyleSheet.create({
    wrapper: {
      position: "relative",

      width: "100%",

      zIndex: 500,
      elevation: 20,

      ...(
        Platform.OS === "web"
          ? {
              maxWidth: 1040,
              marginHorizontal:
                "auto",
            }
          : {}
      ),
    },

    searchShell: {
      width: "100%",
      minHeight: 52,

      flexDirection: "row",
      alignItems: "center",

      alignSelf: "stretch",

      paddingLeft: 8,
      paddingRight: 6,
      paddingVertical: 5,

      borderRadius: 17,

      backgroundColor:
        "rgba(255,255,255,0.045)",

      borderWidth: 1,

      borderColor:
        "rgba(255,255,255,0.09)",

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.16,
      shadowRadius: 12,

      elevation: 4,

      ...(
        Platform.OS === "web"
          ? {
              transitionDuration:
                "160ms",

              transitionProperty:
                "border-color, background-color, box-shadow",
            }
          : {}
      ),
    },

    searchShellFocused: {
      backgroundColor:
        "rgba(0,180,255,0.075)",

      borderColor:
        "rgba(53,175,229,0.72)",

      shadowColor:
        colours.lightblue,

      shadowOpacity: 0.16,
    },

    searchShellWithHistory: {
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },

    searchIconWrap: {
      width: 38,
      height: 38,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 12,

      backgroundColor:
        "rgba(255,255,255,0.055)",

      marginRight: 9,
    },

    searchInput: {
      flex: 1,
      minWidth: 0,

      height: 40,

      color: "#ffffff",

      /*
       * 16px prevents automatic mobile Safari input zoom.
       */
      fontSize: 16,
      lineHeight: 20,

      paddingVertical: 0,
      paddingHorizontal: 0,

      outlineStyle: "none",
    },

    clearButton: {
      width: 34,
      height: 34,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 10,

      marginHorizontal: 4,

      ...(
        Platform.OS === "web"
          ? {
              cursor: "pointer",
            }
          : {}
      ),
    },

    clearButtonActive: {
      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    submitButton: {
      minWidth: 40,
      minHeight: 40,

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",

      gap: 6,

      paddingHorizontal:
        Platform.OS === "web"
          ? 14
          : 10,

      borderRadius: 12,

      backgroundColor:
        colours.lightblue,

      ...(
        Platform.OS === "web"
          ? {
              cursor: "pointer",
            }
          : {}
      ),
    },

    submitButtonActive: {
      transform: [
        {
          translateY: -1,
        },
      ],

      opacity: 0.92,
    },

    submitButtonDisabled: {
      backgroundColor:
        "rgba(255,255,255,0.06)",
    },

    submitButtonText: {
      color: "#ffffff",

      fontSize: 12,
      fontWeight: "900",

      letterSpacing: 0.3,
    },

    submitButtonTextDisabled: {
      color:
        "rgba(255,255,255,0.28)",
    },

    historyPopup: {
      position: "absolute",

      top: 58,
      left: 0,
      right: 0,

      zIndex: 600,
      elevation: 24,

      padding: 8,

      borderRadius: 15,

      backgroundColor:
        "rgba(27,27,30,0.995)",

      borderWidth: 1,
      borderColor:
        "rgba(53,175,229,0.28)",

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.34,
      shadowRadius: 20,
    },

    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      paddingHorizontal: 10,
      paddingTop: 5,
      paddingBottom: 7,
    },

    historyHeading: {
      color:
        "rgba(255,255,255,0.72)",

      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.4,
    },

    historyHint: {
      color:
        "rgba(255,255,255,0.34)",

      fontSize: 10,
      fontWeight: "700",
    },

    historyRow: {
      minHeight: 43,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 8,

      borderRadius: 11,
    },

    historyRowActive: {
      backgroundColor:
        "rgba(53,175,229,0.11)",
    },

    historyIcon: {
      width: 31,
      height: 31,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 10,

      backgroundColor:
        "rgba(53,175,229,0.10)",

      marginRight: 9,
    },

    historyText: {
      flex: 1,
      minWidth: 0,

      color: "#ffffff",

      fontSize: 13,
      fontWeight: "700",
    },

    historyRemove: {
      width: 30,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 9,
    },
  });

export default SearchBar;
