import React, {
  useEffect,
} from "react";

import {
  Platform,
} from "react-native";

import {
  NavigationContainer,
} from "@react-navigation/native";

import {
  createStackNavigator,
} from "@react-navigation/stack";

import {
  enableScreens,
} from "react-native-screens";

import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";

import Home from "./screens/Home";
import Login from "./screens/Login";
import Connections from "./screens/Connections";
import ForgotPassword from "./screens/ForgotPassword";
import Register from "./screens/Register";
import Error from "./screens/Error";
import Feed from "./screens/Feed";
import Profile from "./screens/Profile";
import EditProfile from "./screens/EditProfile";
import Settings from "./screens/Settings";
import Groups from "./screens/Groups";
import Messages from "./screens/Messages";
import Notifications from "./screens/Notifications";
import Favourites from "./screens/Favourites";
import FriendsList from "./screens/FriendsList";
import Explore from "./screens/Explore";
import RecentlyViewed from "./screens/RecentlyViewed";
import Search from "./screens/Search";
import CreatePost from "./screens/CreatePost";
import Posts from "./screens/Posts";
import FollowersList from "./screens/FollowersList";
import FollowingList from "./screens/FollowingList";
import UserProfiles from "./screens/UserProfiles";
import SongPage from "./screens/SongPage";
import AlbumPage from "./screens/AlbumPage";
import ArtistPage from "./screens/ArtistPage";
import MusicSwiperTest from "./screens/MusicSwiperTest";
import UpdateReviewPage from "./screens/UpdateReview";
import ArtistListenables from "./screens/ArtistListenables";
import Achievements from "./screens/Achievements";
import Credits from "./screens/Credits";

import {
  MusicSwiper,
} from "./screens/MusicSwiper";

import {
  SongCardSwipe,
} from "./screens/SongCardSwipe";

/*
 * react-native-screens@4.16.0 is already installed in this project.
 * Enable it once here so inactive native screens can be detached.
 */
enableScreens(true);

/*
 * Completes OAuth popup sessions on web.
 *
 * When Spotify redirects back to Treble, this closes the popup and sends
 * the authorization result to the original Connections screen.
 */
WebBrowser.maybeCompleteAuthSession();

SplashScreen.preventAutoHideAsync().catch(() => {
  /*
   * The splash screen may already be prevented from auto-hiding.
   */
});

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,

  /*
   * Removing stack animations reduces extra work and memory pressure
   * when rapidly switching pages on lower-powered mobile devices.
   */
  animationEnabled: false,
  gestureEnabled: false,
  cardShadowEnabled: false,
  cardOverlayEnabled: false,

  cardStyle: {
    flex: 1,
    backgroundColor: "#101010",
  },

  /*
   * Web does not need native-style transition interpolation.
   */
  ...(Platform.OS === "web"
    ? {
        cardStyleInterpolator: () => ({
          cardStyle: {},
        }),
      }
    : {}),
};

function installMobileWebZoomLock() {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return () => {};
  }

  /*
   * Configure the mobile viewport.
   */
  let viewport = document.querySelector(
    'meta[name="viewport"]'
  );

  if (!viewport) {
    viewport =
      document.createElement("meta");

    viewport.setAttribute(
      "name",
      "viewport"
    );

    document.head.appendChild(
      viewport
    );
  }

  viewport.setAttribute(
    "content",
    [
      "width=device-width",
      "initial-scale=1",
      "minimum-scale=1",
      "maximum-scale=1",
      "user-scalable=no",
      "viewport-fit=cover",
    ].join(", ")
  );

  /*
   * Safari automatically zooms focused inputs when their font size is
   * smaller than 16px. This fixes every input from one global location.
   */
  const styleId =
    "treble-mobile-zoom-lock";

  let style =
    document.getElementById(
      styleId
    );

  if (!style) {
    style =
      document.createElement("style");

    style.id = styleId;

    style.textContent = `
      html,
      body,
      #root {
        width: 100%;
        height: 100%;
        min-height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #101010;
      }

      #root {
        min-height: 100vh;
        min-height: 100dvh;
      }

      @media screen and (max-width: 767px) {
        html,
        body,
        #root {
          touch-action: pan-x pan-y;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }

        input,
        textarea,
        select,
        [contenteditable="true"] {
          font-size: 16px !important;
          touch-action: manipulation;
        }

        button,
        a,
        [role="button"] {
          touch-action: manipulation;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  const preventZoom = (event) => {
    event.preventDefault();
  };

  const preventDoubleClickZoom = (
    event
  ) => {
    if (
      window.matchMedia(
        "(max-width: 767px)"
      ).matches
    ) {
      event.preventDefault();
    }
  };

  /*
   * gesturestart/gesturechange are needed for iPhone and iPad Safari.
   */
  document.addEventListener(
    "gesturestart",
    preventZoom,
    {
      passive: false,
    }
  );

  document.addEventListener(
    "gesturechange",
    preventZoom,
    {
      passive: false,
    }
  );

  document.addEventListener(
    "gestureend",
    preventZoom,
    {
      passive: false,
    }
  );

  document.addEventListener(
    "dblclick",
    preventDoubleClickZoom,
    {
      passive: false,
    }
  );

  return () => {
    document.removeEventListener(
      "gesturestart",
      preventZoom
    );

    document.removeEventListener(
      "gesturechange",
      preventZoom
    );

    document.removeEventListener(
      "gestureend",
      preventZoom
    );

    document.removeEventListener(
      "dblclick",
      preventDoubleClickZoom
    );
  };
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Pacifico: require(
      "./assets/fonts/Pacifico-Regular.ttf"
    ),

    Domine: require(
      "./assets/fonts/Domine-VariableFont_wght.ttf"
    ),

    Lobster: require(
      "./assets/fonts/Lobster-Regular.ttf"
    ),

    Lilita: require(
      "./assets/fonts/LilitaOne-Regular.ttf"
    ),
  });

  useEffect(() => {
    return installMobileWebZoomLock();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    SplashScreen.hideAsync().catch((error) => {
      console.warn(
        "[App] Could not hide splash screen:",
        error
      );
    });
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"

        /*
         * This belongs only in App.js.
         *
         * Inactive routes keep their React state, but their native
         * views are detached to reduce mobile memory and rendering.
         */
        detachInactiveScreens={true}

        screenOptions={screenOptions}
      >
        <Stack.Screen
          name="Home"
          component={Home}
        />

        <Stack.Screen
          name="Login"
          component={Login}
        />

        <Stack.Screen
          name="Connections"
          component={Connections}
        />

        <Stack.Screen
          name="Feed"
          component={Feed}
        />

        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPassword}
        />

        <Stack.Screen
          name="Register"
          component={Register}
        />

        <Stack.Screen
          name="Error"
          component={Error}
        />

        <Stack.Screen
          name="Profile"
          component={Profile}
        />

        <Stack.Screen
          name="EditProfile"
          component={EditProfile}
        />

        <Stack.Screen
          name="Settings"
          component={Settings}
        />

        <Stack.Screen
          name="Groups"
          component={Groups}
        />

        <Stack.Screen
          name="Messages"
          component={Messages}
        />

        <Stack.Screen
          name="Notifications"
          component={Notifications}
        />

        <Stack.Screen
          name="Favourites"
          component={Favourites}
        />

        <Stack.Screen
          name="FriendsList"
          component={FriendsList}
        />

        <Stack.Screen
          name="Explore"
          component={Explore}
        />

        <Stack.Screen
          name="CreatePost"
          component={CreatePost}
        />

        <Stack.Screen
          name="Posts"
          component={Posts}
        />

        <Stack.Screen
          name="Search"
          component={Search}
        />

        <Stack.Screen
          name="RecentlyViewed"
          component={RecentlyViewed}
        />

        <Stack.Screen
          name="FollowersList"
          component={FollowersList}
        />

        <Stack.Screen
          name="FollowingList"
          component={FollowingList}
        />

        <Stack.Screen
          name="UserProfiles"
          component={UserProfiles}
        />

        <Stack.Screen
          name="SongPage"
          component={SongPage}
        />

        <Stack.Screen
          name="AlbumPage"
          component={AlbumPage}
        />

        <Stack.Screen
          name="ArtistPage"
          component={ArtistPage}
        />

        <Stack.Screen
          name="MusicSwiper"
          component={MusicSwiper}
        />

        <Stack.Screen
          name="SongCardSwipe"
          component={SongCardSwipe}
        />

        <Stack.Screen
          name="MusicSwiperTest"
          component={MusicSwiperTest}
        />

        <Stack.Screen
          name="UpdateReview"
          component={UpdateReviewPage}
        />

        <Stack.Screen
          name="ArtistListenables"
          component={ArtistListenables}
        />

        <Stack.Screen
          name="Achievements"
          component={Achievements}
        />

        <Stack.Screen
          name="Credits"
          component={Credits}
        />
      </Stack.Navigator>

      <Toast />
    </NavigationContainer>
  );
}
