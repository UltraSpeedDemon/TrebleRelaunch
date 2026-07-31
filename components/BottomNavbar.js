import React from "react";

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import Icon from "react-native-vector-icons/MaterialIcons";

import colours from "../styles/colours";

const NAV_ITEMS = [
  {
    routeName: "Explore",
    label: "Explore",
    icon: "explore",
    activeIcon: "explore",
  },
  {
    routeName: "Feed",
    label: "Feed",
    icon: "music-note",
    activeIcon: "queue-music",
  },
  {
    routeName: "Profile",
    label: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];

const BottomNavbar = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const currentRoute =
    route?.name || "";

  return (
    <View style={styles.container}>
      <View style={styles.bottomNavBar}>
        {NAV_ITEMS.map((item) => {
          const active =
            currentRoute ===
            item.routeName;

          return (
            <Pressable
              key={item.routeName}
              onPress={() =>
                navigation.navigate(
                  item.routeName
                )
              }
              style={({
                pressed,
                hovered,
              }) => [
                styles.bottomNavItem,

                active &&
                  styles.bottomNavItemActive,

                (pressed || hovered) &&
                  styles.bottomNavItemHovered,
              ]}
            >
              <View
                style={[
                  styles.iconContainer,

                  active &&
                    styles.activeIconContainer,
                ]}
              >
                <Icon
                  name={
                    active
                      ? item.activeIcon
                      : item.icon
                  }
                  size={25}
                  color={
                    active
                      ? "#ffffff"
                      : "rgba(255,255,255,0.52)"
                  }
                />
              </View>

              <Text
                style={[
                  styles.navText,

                  active &&
                    styles.activeNavText,
                ]}
              >
                {item.label}
              </Text>

              {active ? (
                <View
                  style={styles.activeIndicator}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles =
  StyleSheet.create({
    container: {
      width: "100%",

      backgroundColor:
        "rgba(16,16,16,0.97)",

      borderTopWidth: 1,

      borderTopColor:
        "rgba(53,175,229,0.45)",

      paddingTop: 7,

      paddingBottom:
        Platform.OS === "ios"
          ? 20
          : 8,

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: -4,
      },

      shadowOpacity: 0.24,
      shadowRadius: 12,

      elevation: 18,
    },

    bottomNavBar: {
      width: "100%",

      maxWidth: 720,

      alignSelf: "center",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",

      paddingHorizontal: 12,
    },

    bottomNavItem: {
      position: "relative",

      flex: 1,

      minHeight: 57,

      alignItems: "center",
      justifyContent: "center",

      marginHorizontal: 4,

      borderRadius: 15,

      ...(
        Platform.OS === "web"
          ? {
              cursor: "pointer",

              transitionDuration:
                "150ms",

              transitionProperty:
                "background-color, transform",
            }
          : {}
      ),
    },

    bottomNavItemActive: {
      backgroundColor:
        "rgba(53,175,229,0.10)",
    },

    bottomNavItemHovered: {
      backgroundColor:
        "rgba(255,255,255,0.055)",
    },

    iconContainer: {
      width: 34,
      height: 30,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 11,
    },

    activeIconContainer: {
      backgroundColor:
        "rgba(53,175,229,0.15)",
    },

    navText: {
      color:
        "rgba(255,255,255,0.52)",

      fontSize: 10,
      lineHeight: 14,

      fontWeight: "800",

      marginTop: 2,
    },

    activeNavText: {
      color: colours.lightblue,
    },

    activeIndicator: {
      position: "absolute",

      bottom: -7,

      width: 28,
      height: 3,

      borderRadius: 2,

      backgroundColor:
        colours.lightblue,
    },
  });

export default BottomNavbar;
