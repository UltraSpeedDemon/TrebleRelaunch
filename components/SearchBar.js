import React, {
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

import {
  useNavigation,
} from "@react-navigation/native";

import Icon from "react-native-vector-icons/MaterialIcons";

import colours from "../styles/colours";

const DESKTOP_BREAKPOINT = 768;

const SearchBar = () => {
  const navigation = useNavigation();

  const { width } =
    useWindowDimensions();

  const isDesktopWeb =
    Platform.OS === "web" &&
    width >= DESKTOP_BREAKPOINT;

  const placeholderText =
    isDesktopWeb
      ? "Search for Songs, Albums, Artists and Friends"
      : "Search for Music";

  const [searchQuery, setSearchQuery] =
    useState("");

  const [focused, setFocused] =
    useState(false);

  const cleanedQuery =
    searchQuery.trim();

  const submitSearch = () => {
    if (!cleanedQuery) {
      return;
    }

    navigation.push("Search", {
      searchQuery: cleanedQuery,
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <View
      style={[
        styles.searchShell,
        focused &&
          styles.searchShellFocused,
      ]}
    >
      <View style={styles.searchIconWrap}>
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
        onChangeText={setSearchQuery}
        onFocus={() =>
          setFocused(true)
        }
        onBlur={() =>
          setFocused(false)
        }
        style={styles.searchInput}
        placeholder={placeholderText}
        placeholderTextColor="rgba(255,255,255,0.38)"
        selectionColor={
          colours.lightblue
        }
        returnKeyType="search"
        onSubmitEditing={submitSearch}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
      />

      {searchQuery.length > 0 ? (
        <Pressable
          onPress={clearSearch}
          style={({ pressed, hovered }) => [
            styles.clearButton,

            (pressed || hovered) &&
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
        onPress={submitSearch}
        disabled={!cleanedQuery}
        style={({ pressed, hovered }) => [
          styles.submitButton,

          !cleanedQuery &&
            styles.submitButtonDisabled,

          cleanedQuery &&
            (pressed || hovered) &&
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
  );
};

const styles =
  StyleSheet.create({
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
              maxWidth: 1040,
              marginHorizontal: "auto",

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

      fontSize: 15,
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
  });

export default SearchBar;
