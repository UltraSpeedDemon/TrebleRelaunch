import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { SPOTIFY_CLIENT_ID } from '@env';

// 1) Discovery object tells expo-auth-session how to interact with the provider
export const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// 2) Define the scopes your app needs
export const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-library-modify',
  'user-follow-read',
  'user-follow-modify',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-read-playback-position'
];

// (Optional) If you want to define your redirect URL explicitly, you can do so here.
// Otherwise, `makeRedirectUri()` can be used for a managed Expo project.
export const REDIRECT_URI = AuthSession.makeRedirectUri({
  // useProxy: true,
  scheme: 'musicadvancedproject',
  path: 'redirect',
});

// Define and export setAccessToken and setRefreshToken functions
export const setAccessToken = (token) => {
  // Implement your logic to set the access token
  console.log("Access Token set:", token);
};

export const setRefreshToken = (token) => {
  // Implement your logic to set the refresh token
  console.log("Refresh Token set:", token);
};

// Print the redirect URI
console.log("REDIRECT_URI:", REDIRECT_URI);


