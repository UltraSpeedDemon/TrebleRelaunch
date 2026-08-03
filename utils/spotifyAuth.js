import * as AuthSession from "expo-auth-session";

/*
 * Public Spotify Client ID.
 *
 * The Client ID is safe to expose in the Expo web bundle.
 * Never add the Spotify Client Secret to an EXPO_PUBLIC variable.
 */
export const SPOTIFY_CLIENT_ID =
  String(
    process.env
      .EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
      ""
  ).trim();

/*
 * Must exactly match the URI registered in the Spotify dashboard.
 */
export const REDIRECT_URI =
  String(
    process.env
      .EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ||
      "https://treblemusic.netlify.app"
  ).trim();

/*
 * These scopes support:
 * - Reading the connected Spotify account
 * - Loading top tracks
 * - Reading private and collaborative playlists
 *
 * Add write/playback scopes later only when those features are built.
 */
const DEFAULT_SPOTIFY_SCOPE =
  [
    "user-read-email",
    "user-read-private",
    "user-top-read",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

export const SPOTIFY_SCOPES =
  String(
    process.env
      .EXPO_PUBLIC_SPOTIFY_SCOPE ||
      DEFAULT_SPOTIFY_SCOPE
  )
    .split(/\s+/)
    .map((scope) =>
      scope.trim()
    )
    .filter(Boolean);

/*
 * Spotify OAuth endpoints used by expo-auth-session.
 */
export const discovery = {
  authorizationEndpoint:
    "https://accounts.spotify.com/authorize",

  tokenEndpoint:
    "https://accounts.spotify.com/api/token",
};

/*
 * Validate configuration before beginning authorization.
 */
export function validateSpotifyConfiguration() {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error(
      "EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing."
    );
  }

  if (!REDIRECT_URI) {
    throw new Error(
      "EXPO_PUBLIC_SPOTIFY_REDIRECT_URI is missing."
    );
  }

  return true;
}

/*
 * Creates the Spotify PKCE request configuration.
 *
 * Connections.js can pass this object into:
 * AuthSession.useAuthRequest(...)
 */
export function getSpotifyAuthRequestConfig() {
  validateSpotifyConfiguration();

  return {
    clientId:
      SPOTIFY_CLIENT_ID,

    redirectUri:
      REDIRECT_URI,

    scopes:
      SPOTIFY_SCOPES,

    responseType:
      AuthSession.ResponseType.Code,

    usePKCE: true,

    codeChallengeMethod:
      AuthSession.CodeChallengeMethod.S256,
  };
}

/*
 * Do not log access or refresh tokens.
 *
 * Your Connections page should save them through your backend/updateUser
 * call rather than keeping them globally in this module.
 */
export const setAccessToken = () => {
  console.warn(
    "[Spotify] setAccessToken is deprecated. Save tokens through the authenticated user update flow."
  );
};

export const setRefreshToken = () => {
  console.warn(
    "[Spotify] setRefreshToken is deprecated. Save tokens through the authenticated user update flow."
  );
};

if (__DEV__) {
  console.log(
    "[Spotify] Redirect URI:",
    REDIRECT_URI
  );

  console.log(
    "[Spotify] Scopes:",
    SPOTIFY_SCOPES.join(" ")
  );
}