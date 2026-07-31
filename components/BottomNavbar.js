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
                  size={29}
                  color={
                    active
                      ? "#ffffff"
                      : "rgba(255,255,255,0.58)"
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
                  style={
                    styles.activeIndicator
                  }
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
        "rgba(16,16,16,0.98)",

      borderTopWidth: 1,

      borderTopColor:
        "rgba(53,175,229,0.50)",

      paddingTop: 9,

      paddingBottom:
        Platform.OS === "ios"
          ? 23
          : 11,

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: -5,
      },

      shadowOpacity: 0.28,
      shadowRadius: 14,

      elevation: 20,
    },

    bottomNavBar: {
      width: "100%",

      maxWidth: 780,

      alignSelf: "center",

      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",

      paddingHorizontal: 14,
    },

    bottomNavItem: {
      position: "relative",

      flex: 1,

      minHeight: 66,

      alignItems: "center",
      justifyContent: "center",

      marginHorizontal: 5,

      borderRadius: 17,

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
        "rgba(53,175,229,0.12)",
    },

    bottomNavItemHovered: {
      backgroundColor:
        "rgba(255,255,255,0.065)",
    },

    iconContainer: {
      width: 40,
      height: 36,

      alignItems: "center",
      justifyContent: "center",

      borderRadius: 12,
    },

    activeIconContainer: {
      backgroundColor:
        "rgba(53,175,229,0.18)",
    },

    navText: {
      color:
        "rgba(255,255,255,0.58)",

      fontSize: 12,
      lineHeight: 16,

      fontWeight: "800",

      marginTop: 3,
    },

    activeNavText: {
      color: colours.lightblue,
    },

    activeIndicator: {
      position: "absolute",

      bottom: -9,

      width: 34,
      height: 4,

      borderRadius: 2,

      backgroundColor:
        colours.lightblue,
    },
  });

export default BottomNavbar;
