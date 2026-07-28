import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Save session data
export async function saveSession(key, value) {
  const stringValue = String(value ?? "");

  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, stringValue);
    return;
  }

  await SecureStore.setItemAsync(key, stringValue);
}

// Get session data
export async function getSession(key) {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
}

// Delete session data
export async function deleteSession(key) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}