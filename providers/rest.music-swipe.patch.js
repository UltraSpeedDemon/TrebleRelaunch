/*
 * Merge these exports into your existing providers/rest.js.
 * Do not replace the rest of that file if it contains other Treble API calls.
 */

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_TUNNEL_URL ||
  ""
).replace(/\/$/, "");

function requireApiUrl() {
  if (!API_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is missing. Set it to the DigitalOcean backend URL."
    );
  }

  return API_URL;
}

export function getRecommendations(
  userId,
  {
    limit = 12,
    offset = 0,
    refresh = false,
  } = {}
) {
  const baseUrl = requireApiUrl();
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
    offset: String(offset),
    refresh: String(Boolean(refresh)),
    _ts: String(Date.now()),
  });

  return fetch(
    `${baseUrl}/users/recommendations?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    }
  );
}

export function getSongFromDeezer(
  trackId,
  { refresh = false } = {}
) {
  const baseUrl = requireApiUrl();
  const params = new URLSearchParams({
    q: String(trackId),
    type: "track",
    refresh: String(Boolean(refresh)),
    _ts: String(Date.now()),
  });

  // This endpoint already exists in the supplied Treble backend.
  return fetch(
    `${baseUrl}/deezer?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    }
  );
}

export function setRecommendationServed(
  userId,
  recommendationId
) {
  const baseUrl = requireApiUrl();

  return fetch(`${baseUrl}/users/recommendations/served`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      user_id: String(userId),
      recommendation_id: String(recommendationId),
    }),
  });
}
