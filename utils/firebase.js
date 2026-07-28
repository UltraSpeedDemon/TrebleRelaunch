import { Platform } from "react-native";

import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
} from "firebase/auth";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,

  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,

  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,

  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,

  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

let auth;

try {
  if (Platform.OS === "web") {
    /*
     * Keep the user logged in after refreshing
     * or closing and reopening the browser.
     */
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    /*
     * Native Android/iOS authentication persistence.
     */
    auth = initializeAuth(app, {
      persistence:
        getReactNativePersistence(
          AsyncStorage
        ),
    });
  }
} catch (error) {
  /*
   * Firebase Auth may already be initialized
   * during Expo Fast Refresh.
   */
  auth = getAuth(app);
}

const storage = getStorage(
  app,
  "gs://treblerelaunch.firebasestorage.app"
);

export {
  app,
  auth,
  onAuthStateChanged,
  storage,
};