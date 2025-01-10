import * as SecureStore from 'expo-secure-store';

// Save data to secure storage
export async function saveSession(key, value) {
  await SecureStore.setItemAsync(key, value);
}

// Get data from secure storage
export async function getSession(key) {
  return await SecureStore.getItemAsync(key);
}

// Delete session data
export async function deleteSession(key) {
  await SecureStore.deleteItemAsync(key);
}
