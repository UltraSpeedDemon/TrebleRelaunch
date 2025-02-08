// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_API_KEY } from "@env";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "musicapp-c7e76.firebaseapp.com",
  projectId: "musicapp-c7e76",
  storageBucket: "musicapp-c7e76.firebasestorage.app",
  messagingSenderId: "528654628068",
  appId: "1:528654628068:web:a148457e14cf080f2768f1",
  measurementId: "G-RB3BN3CTNE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Check if analytics is supported
isSupported().then((supported) => {
  if (supported) {
    const analytics = getAnalytics(app);
    console.log("Analytics initialized!");
  } else {
    console.warn("Analytics not supported in this environment.");
  }
});

export const db = getFirestore(app);
export { auth, onAuthStateChanged };