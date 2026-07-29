import React, {
  useState,
} from "react";

import {
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useNavigation } from "@react-navigation/native";

import colours from "../styles/colours";

const SearchBar = () => {
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] =
    useState("");

  const submitSearch = () => {
    const cleanedQuery =
      searchQuery.trim();

    if (!cleanedQuery) {
      return;
    }

    navigation.push("Search", {
      searchQuery: cleanedQuery,
    });
  };

  return (
    <View style={styles.searchBar}>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        placeholder="Search for Songs, Artists, Albums, and Users!"
        placeholderTextColor="#aaa"
        selectionColor="#ffffff"
        returnKeyType="search"
        onSubmitEditing={submitSearch}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    /*
     * Do not use absolute positioning here.
     * Feed.js already positions the entire header
     * at the top of the screen.
     */
    width: "100%",
    height: 42,

    alignSelf: "stretch",
    justifyContent: "center",

    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.lightblue,

    paddingHorizontal: 14,

    backgroundColor:
      colours.darkblue,

    ...(
      Platform.OS === "web"
        ? {
            maxWidth: 1040,
            marginHorizontal: "auto",
          }
        : {}
    ),
  },

  searchInput: {
    width: "100%",
    height: "100%",

    color: "#ffffff",

    fontSize: 16,

    paddingVertical: 0,
    paddingHorizontal: 0,

    outlineStyle: "none",
  },
});

export default SearchBar;