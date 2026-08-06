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
  setPersistence,
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
let authReady;

if (Platform.OS === "web") {
  auth = getAuth(app);

  authReady = setPersistence(
    auth,
    browserLocalPersistence
  ).catch((error) => {
    console.warn(
      "[Firebase] Could not enable browser persistence:",
      error
    );
  });
} else {
  try {
    auth = initializeAuth(app, {
      persistence:
        getReactNativePersistence(
          AsyncStorage
        ),
    });
  } catch {
    auth = getAuth(app);
  }

  authReady = Promise.resolve();
}

const storage = getStorage(
  app,
  "gs://treblerelaunch.firebasestorage.app"
);

export {
  app,
  auth,
  authReady,
  onAuthStateChanged,
  storage,
};
