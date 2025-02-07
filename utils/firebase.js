// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getRedirectResult,
  getAuthFromPersistence,
  initializeAuth,
  getReactNativePersistence
} from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { FIREBASE_API_KEY } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});