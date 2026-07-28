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

import * as SplashScreen from "expo-splash-screen";
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
import { MusicSwiper } from "./screens/MusicSwiper";
import { SongCardSwipe } from "./screens/SongCardSwipe";
import MusicSwiperTest from "./screens/MusicSwiperTest";
import UpdateReviewPage from "./screens/UpdateReview";
import ArtistListenables from "./screens/ArtistListenables";

SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash screen may already be prevented from auto-hiding.
});

const Stack = createStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Pacifico: require("./assets/fonts/Pacifico-Regular.ttf"),
    Domine: require("./assets/fonts/Domine-VariableFont_wght.ttf"),
    Lobster: require("./assets/fonts/Lobster-Regular.ttf"),
    Lilita: require("./assets/fonts/LilitaOne-Regular.ttf"),
  });

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
        screenOptions={{
          headerShown: false,
          animation: "none",

          /*
           * Prevent browser-style transition animations
           * when running through React Native Web.
           */
          ...(Platform.OS === "web"
            ? {
                cardStyleInterpolator: () => ({
                  cardStyle: {},
                }),
              }
            : {}),
        }}
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
      </Stack.Navigator>

      <Toast />
    </NavigationContainer>
  );
}