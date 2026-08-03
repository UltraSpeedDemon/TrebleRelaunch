import axios from "axios";

const SPOTIFY_API_URL =
  "https://api.spotify.com/v1";

const spotifyClient =
  axios.create({
    baseURL:
      SPOTIFY_API_URL,

    timeout:
      12000,

    headers: {
      Accept:
        "application/json",
    },
  });

function requireAccessToken(
  accessToken
) {
  const cleanToken =
    String(
      accessToken || ""
    ).trim();

  if (!cleanToken) {
    throw new Error(
      "A Spotify access token is required."
    );
  }

  return cleanToken;
}

function spotifyHeaders(
  accessToken
) {
  const token =
    requireAccessToken(
      accessToken
    );

  return {
    Authorization:
      `Bearer ${token}`,
  };
}

function normalizeSpotifyError(
  error,
  fallbackMessage
) {
  const status =
    error?.response?.status;

  const spotifyMessage =
    error?.response?.data
      ?.error?.message;

  if (status === 401) {
    return new Error(
      "The Spotify session expired. Refresh the Spotify token or reconnect the account."
    );
  }

  if (status === 403) {
    return new Error(
      spotifyMessage ||
        "Spotify denied this request. Check the authorized scopes and Spotify account access."
    );
  }

  if (status === 429) {
    const retryAfter =
      error?.response
        ?.headers?.["retry-after"];

    return new Error(
      retryAfter
        ? `Spotify rate limit reached. Try again in ${retryAfter} seconds.`
        : "Spotify rate limit reached. Please try again shortly."
    );
  }

  return new Error(
    spotifyMessage ||
      error?.message ||
      fallbackMessage
  );
}

/*
 * Retrieve the connected user's profile.
 *
 * Required scopes:
 * - user-read-private
 * - user-read-email
 */
export async function getSpotifyProfile(
  accessToken
) {
  try {
    const response =
      await spotifyClient.get(
        "/me",
        {
          headers:
            spotifyHeaders(
              accessToken
            ),
        }
      );

    return response.data;
  } catch (error) {
    throw normalizeSpotifyError(
      error,
      "Unable to load the Spotify profile."
    );
  }
}

/*
 * Retrieve the user's top tracks.
 *
 * Required scope:
 * - user-top-read
 */
export async function getSpotifyTracks(
  accessToken,
  {
    limit = 20,
    offset = 0,
    timeRange =
      "medium_term",
  } = {}
) {
  try {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          50,
          Number(limit) || 20
        )
      );

    const safeOffset =
      Math.max(
        0,
        Number(offset) || 0
      );

    const allowedTimeRanges =
      new Set([
        "short_term",
        "medium_term",
        "long_term",
      ]);

    const safeTimeRange =
      allowedTimeRanges.has(
        timeRange
      )
        ? timeRange
        : "medium_term";

    const response =
      await spotifyClient.get(
        "/me/top/tracks",
        {
          headers:
            spotifyHeaders(
              accessToken
            ),

          params: {
            limit:
              safeLimit,

            offset:
              safeOffset,

            time_range:
              safeTimeRange,
          },
        }
      );

    return {
      items:
        Array.isArray(
          response.data?.items
        )
          ? response.data.items
          : [],

      next:
        response.data?.next ||
        null,

      previous:
        response.data?.previous ||
        null,

      total:
        Number(
          response.data?.total ||
          0
        ),
    };
  } catch (error) {
    throw normalizeSpotifyError(
      error,
      "Unable to load Spotify top tracks."
    );
  }
}

/*
 * Retrieve playlists owned by or available to the connected user.
 *
 * Required scopes:
 * - playlist-read-private
 * - playlist-read-collaborative
 */
export async function getSpotifyPlaylists(
  accessToken,
  {
    limit = 20,
    offset = 0,
  } = {}
) {
  try {
    const response =
      await spotifyClient.get(
        "/me/playlists",
        {
          headers:
            spotifyHeaders(
              accessToken
            ),

          params: {
            limit:
              Math.max(
                1,
                Math.min(
                  50,
                  Number(limit) ||
                    20
                )
              ),

            offset:
              Math.max(
                0,
                Number(offset) ||
                  0
              ),
          },
        }
      );

    return {
      items:
        Array.isArray(
          response.data?.items
        )
          ? response.data.items
          : [],

      next:
        response.data?.next ||
        null,

      total:
        Number(
          response.data?.total ||
          0
        ),
    };
  } catch (error) {
    throw normalizeSpotifyError(
      error,
      "Unable to load Spotify playlists."
    );
  }
}

/*
 * Retrieve tracks from a Spotify playlist.
 *
 * Required scopes for private/collaborative playlists:
 * - playlist-read-private
 * - playlist-read-collaborative
 */
export async function getPlaylistTracks(
  accessToken,
  playlistId,
  {
    limit = 50,
    offset = 0,
  } = {}
) {
  const cleanPlaylistId =
    String(
      playlistId || ""
    ).trim();

  if (!cleanPlaylistId) {
    throw new Error(
      "A Spotify playlist ID is required."
    );
  }

  try {
    const response =
      await spotifyClient.get(
        `/playlists/${encodeURIComponent(
          cleanPlaylistId
        )}/tracks`,
        {
          headers:
            spotifyHeaders(
              accessToken
            ),

          params: {
            limit:
              Math.max(
                1,
                Math.min(
                  50,
                  Number(limit) ||
                    50
                )
              ),

            offset:
              Math.max(
                0,
                Number(offset) ||
                  0
              ),
          },
        }
      );

    const items =
      Array.isArray(
        response.data?.items
      )
        ? response.data.items
        : [];

    return {
      tracks:
        items
          .map((item) =>
            item?.track
          )
          .filter(Boolean),

      next:
        response.data?.next ||
        null,

      total:
        Number(
          response.data?.total ||
          0
        ),
    };
  } catch (error) {
    throw normalizeSpotifyError(
      error,
      "Unable to load Spotify playlist tracks."
    );
  }
}