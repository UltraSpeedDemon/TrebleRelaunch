import * as AuthSession from "expo-auth-session";

/*
 * Public Spotify Client ID.
 *
 * A Client ID may be included in an Expo web/mobile bundle.
 * Never place the Spotify Client Secret in the app.
 */
export const SPOTIFY_CLIENT_ID =
  String(
    process.env
      .EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
      ""
  ).trim();

/*
 * This must exactly match the Redirect URI registered in Spotify.
 */
export const REDIRECT_URI =
  String(
    process.env
      .EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ||
      "https://treblemusic.netlify.app"
  ).trim();

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

export const discovery = {
  authorizationEndpoint:
    "https://accounts.spotify.com/authorize",

  tokenEndpoint:
    "https://accounts.spotify.com/api/token",
};

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
 * Spotify's show_dialog=true forces Spotify to display authorization
 * again instead of immediately reusing the previous approval.
 *
 * This is important after unlinking because it gives the user a fresh
 * Spotify connection screen and the opportunity to use another account.
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

    extraParams: {
      show_dialog: "true",
    },
  };
}

/*
 * Tokens are persisted through Treble's authenticated backend endpoints.
 * Never print access or refresh tokens.
 */
export const setAccessToken = () => {
  console.warn(
    "[Spotify] setAccessToken is deprecated. Save tokens through the authenticated backend."
  );
};

export const setRefreshToken = () => {
  console.warn(
    "[Spotify] setRefreshToken is deprecated. Save tokens through the authenticated backend."
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
