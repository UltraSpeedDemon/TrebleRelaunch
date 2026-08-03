// /providers/rest.js
import { auth } from '../utils/firebase';

//#region Local server request handlers
export async function serverGet(endpoint, params = null) {
  let url = `${getServerEndpointBase()}/${endpoint}`;
  try {
    if (params) {
      const urlParams = new URLSearchParams(params).toString();
      url += `?${urlParams}`;
    }
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "ngrok-skip-browser-warning": "true",
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
    });
  } catch (e) {
    console.error(e);
  }
}

  export async function serverPost(endpoint, body) {
    const url = `${getServerEndpointBase()}/${endpoint}`;

    console.log("[serverPost] URL:", url);
    console.log("[serverPost] Endpoint:", endpoint);
    console.log("[serverPost] Body:", body);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(body),
      });

      console.log(
        "[serverPost] Response:",
        endpoint,
        response.status
      );

      return response;
    } catch (error) {
      console.error(
        `[serverPost] Request failed for ${endpoint}:`,
        error
      );

      throw error;
    }
  }

export async function serverPut(endpoint, body) {
  try {
    return await fetch(`${getServerEndpointBase()}/${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function serverDelete(endpoint, body) {
  try {
    return await fetch(`${getServerEndpointBase()}/${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(e);
  }
}
//#endregion

//#region Custom request functions
export async function getHelloWorld() {
  return await serverGet("test");
}

export async function postSearchResults(
  input,
  userId,
  type = "album,track,artist,user",
  limit = "10",
  strict = "on",
  order = "RANKING"
) {
  return await serverGet("search", {
    input,
    type,
    limit,
    strict,
    order,
    userId,
  });
}

// Merge these functions into your existing providers/rest.js.
// Keep your existing API_URL/API helper names if they differ.

const songRefreshRequestsInFlight =
  new Map();

export async function getSongFromDeezer(
  trackId,
  {
    refresh = false,
    forceRefresh = false,
  } = {}
) {
  if (!trackId) {
    throw new Error(
      "getSongFromDeezer requires a Deezer track ID."
    );
  }

  const id =
    String(trackId);

  const requestKey =
    `${id}:${forceRefresh ? "force" : refresh ? "refresh" : "cached"}`;

  if (
    songRefreshRequestsInFlight.has(
      requestKey
    )
  ) {
    return await songRefreshRequestsInFlight.get(
      requestKey
    );
  }

  const request =
    serverGet(
      "search/getSongFromDeezer",
      {
        listenable_id: id,
        refresh:
          refresh
            ? "true"
            : "false",
        force_refresh:
          forceRefresh
            ? "true"
            : "false",
        _ts: String(Date.now()),
      }
    ).finally(() => {
      songRefreshRequestsInFlight.delete(
        requestKey
      );
    });

  songRefreshRequestsInFlight.set(
    requestKey,
    request
  );

  return await request;
}

/*
 * Resolve a track for playback. The first request uses Treble's cache.
 * A forced Deezer refresh is intentionally NOT made here; the player
 * performs that only after a real audio load/play error.
 */
export async function getCachedPlayableTrack(
  trackId
) {
  const response =
    await getSongFromDeezer(
      trackId,
      {
        refresh: true,
        forceRefresh: false,
      }
    );

  if (!response?.ok) {
    throw new Error(
      `Unable to load track ${trackId}.`
    );
  }

  return await response.json();
}

export async function forceRefreshPlayableTrack(
  trackId
) {
  const response =
    await getSongFromDeezer(
      trackId,
      {
        refresh: true,
        forceRefresh: true,
      }
    );

  if (!response?.ok) {
    let message =
      `Unable to refresh track ${trackId}.`;

    try {
      const body =
        await response.json();

      message =
        body?.error ||
        body?.message ||
        message;
    } catch {}

    throw new Error(message);
  }

  return await response.json();
}

//#region User endpoints
export async function createUser(userData) {
  return await serverPost("users/", userData);
}

export async function getUser(userId) {
  return await serverGet(`users/${userId}`);
}

export async function getUserByUsername(username) {
  return await serverGet("users/", { username });
}

export async function updateUser(userId, userData) {
  return await serverPut(`users/${userId}`, userData);
}

export async function connectSpotify(
  userId,
  spotifyConnection
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error(
      "You must be signed in to connect Spotify."
    );
  }

  if (
    String(currentUser.uid) !==
    String(userId)
  ) {
    throw new Error(
      "You cannot connect Spotify for another user."
    );
  }

  const idToken =
    await currentUser.getIdToken();

  return await serverPost(
    `users/${encodeURIComponent(
      userId
    )}/spotify/connect`,
    {
      ...(spotifyConnection || {}),
      id_token: idToken,
    }
  );
}

export async function disconnectSpotify(
  userId
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error(
      "You must be signed in to unlink Spotify."
    );
  }

  if (
    String(currentUser.uid) !==
    String(userId)
  ) {
    throw new Error(
      "You cannot unlink Spotify for another user."
    );
  }

  const idToken =
    await currentUser.getIdToken();

  return await serverDelete(
    `users/${encodeURIComponent(
      userId
    )}/spotify`,
    {
      id_token: idToken,
    }
  );
}

export async function followUser(follower_id, followed_id) {
  return await serverPost("users/follow", { follower_id, followed_id });
}

export async function unfollowUser(follower_id, followed_id) {
  return await serverPost("users/unfollow", { follower_id, followed_id });
}

export async function getFollowers(userId) {
  return await serverGet(`users/${userId}/followers`);
}

export async function getFollowing(userId) {
  return await serverGet(`users/${userId}/following`);
}

export async function getFriends(userId) {
  return await serverGet(`users/${userId}/friends`);
}

export async function like(userId, musicId, type) {
  return await serverPost("users/like", { user_id: userId, music_id: musicId, type: type });
}

export async function unlike(userId, musicId, type) {
  return await serverPost("users/unlike", { user_id: userId, music_id: musicId, type: type });
}

export async function getLike(userId, musicId, type) {
  return await serverGet("users/like", { user_id: userId, music_id: musicId, type: type });
}

export async function getUserLikes(userId) {
  if (!userId) {
    throw new Error(
      "getUserLikes requires a user ID."
    );
  }

  return await serverGet(
    `users/${encodeURIComponent(userId)}/likes`
  );
}

export async function getRecommendations(
  userId,
  {
    limit = 20,
    offset = 0,
    refresh = false,
  } = {}
) {
  if (!userId) {
    throw new Error(
      "getRecommendations requires a user ID."
    );
  }

  return await serverGet(
    "users/recommendations",
    {
      user_id: userId,
      offset,
      limit,
      refresh: refresh ? "true" : "false",
    }
  );
}

export async function postRecommendations(
  userId,
  musicId,
  type,
  name,
  artistName,
  reason = "like"
) {
  return await serverPost(
    "users/recommendations",
    {
      user_id: userId,
      music_id: String(musicId),
      type: type || "track",
      name: name || "",
      artist_name: artistName || "",
      reason,
    }
  );
}

// New endpoints for the four review sections:
export async function getUserTopReviews(userId) {
  return serverGet(`users/${userId}/top-reviews`);
}

export async function getUserFavorites(userId) {
  return serverGet(`users/${userId}/favorites`);
}

export async function getUserMostUpvoted(userId) {
  return serverGet(`users/${userId}/most-upvoted`);
}

export async function getUserActivity(userId) {
  return serverGet(`users/${userId}/activity`);
}



export async function share(
  userId,
  item_rid,
  item_id,
  comment = "",
  type = "track",
  itemData = null
) {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("You must be signed in to share music.");
  }

  if (!userId || !item_id) {
    throw new Error("A friend and music item are required.");
  }

  return await serverPost("users/share", {
    user_id: String(userId),
    item_id: String(item_id),
    item_rid: item_rid ? String(item_rid) : null,
    comment: String(comment || "").trim(),
    share_by: currentUser.uid,
    type: String(type || "track").toLowerCase(),
    item_data: itemData || null,
  });
}

export async function getSharedItems(userId)
{
  return await serverGet("users/share", { user_id: userId });
}

export async function getFriendReviews(user_id, cutoff_date) {
  return await serverGet("users/friend_reviews", { user_id, cutoff_date });
}

export async function setRecommendationServed(userId, recId) {
  return await serverPost("users/serve_recommendation", {
    user_id: userId,
    song_rid: recId,
    served: true,
  });
}


export async function createFeedPost(
  post
) {
  const currentUser =
    auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error(
      "You must be signed in to create a post."
    );
  }

  const idToken =
    await currentUser.getIdToken();

  return await serverPost(
    "feed/posts",
    {
      ...post,
      id_token: idToken,
    }
  );
}

export async function getFeedPosts(
  userId,
  {
    limit = 20,
    offset = 0,
  } = {}
) {
  if (!userId) {
    throw new Error(
      "getFeedPosts requires a user ID."
    );
  }

  return await serverGet(
    "feed/posts",
    {
      user_id:
        String(userId),
      limit:
        String(limit),
      offset:
        String(offset),
      _ts:
        String(Date.now()),
    }
  );
}

export async function getTimeline(userId, { limit = 20, offset = 0, refresh = false} = {}) {
  try {
    return await serverGet("users/timeline", { 
      user_id: userId, 
      offset, 
      limit,
      refresh
    });
  } catch (error) {
    console.error("Error fetching my timeline:", error);
  }
}

export async function saveRecentlyViewed(userId, item) {
  const itemInfo = item?.item_info || item || {};

  const itemId =
    itemInfo.id ||
    itemInfo.listenableId ||
    itemInfo.listenable_id;

  if (!userId || !itemId) {
    throw new Error(
      "saveRecentlyViewed requires a user ID and item ID."
    );
  }

  return await serverPost("users/recently-viewed", {
    user_id: userId,
    item_id: String(itemId),
    listenable_id: String(itemId),
    type: itemInfo.type || "track",

    name:
      itemInfo.name ||
      itemInfo.title ||
      "Unknown Item",

    title:
      itemInfo.title ||
      itemInfo.name ||
      "Unknown Item",

    artist: itemInfo.artist || null,
    album: itemInfo.album || null,

    image:
      itemInfo.image ||
      itemInfo.coverArt ||
      itemInfo.album?.cover_xl ||
      itemInfo.album?.cover_big ||
      "",

    coverArt:
      itemInfo.coverArt ||
      itemInfo.image ||
      itemInfo.album?.cover_xl ||
      itemInfo.album?.cover_big ||
      "",

    preview:
      itemInfo.preview ||
      itemInfo.previewUrl ||
      itemInfo.playbackUrl ||
      "",
  });
}

export async function getRecentlyViewed(userId, limit = 30) {
  return await serverGet(
    `users/${encodeURIComponent(userId)}/recently-viewed`,
    { limit }
  );
}

export async function clearRecentlyViewed(userId) {
  return await serverDelete(
    `users/${encodeURIComponent(userId)}/recently-viewed`
  );
}

// #region Follow Request endpoints
export async function requestFollow(follower_id, followed_id) {
  // Notice the POST to /users/requestFollow
  return await serverPost("users/requestFollow", { follower_id, followed_id });
}

export async function getFollowRequests(userId) {
  return await serverGet(`users/${userId}/followRequests`);
}

export async function respondFollowRequest(followed_id, follower_id, accept) {
  return await serverPost("users/respondFollowRequest", {
    followed_id,
    follower_id,
    accept,
  });
}
// #endregion

// =====================================================
// Notification endpoints
// =====================================================

export async function getNotifications(userId) {
  return await serverGet(`users/${userId}/notifications`);
}

export async function markNotificationsRead(
  userId,
  notificationIds
) {
  return await serverPost(
    "users/markNotificationsRead",
    {
      user_id: userId,
      notification_ids: notificationIds,
    }
  );
}



//#region metadata endpoints
export async function populateMetadata(reviewType, id) {
  const params = { reviewType, id };
  return await serverGet("metadata/populate", params);
}
//#endregion


// #endregion

//#region Review endpoints
async function getCurrentUserIdToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Cannot submit review because the user is not logged in."
    );
  }

  console.log(
    "[Reviews] Authenticated user:",
    currentUser.uid
  );

  const idToken = await currentUser.getIdToken(true);

  if (!idToken) {
    throw new Error(
      "Firebase did not return an authentication token."
    );
  }

  return idToken;
}

export async function createReview(review) {
  console.log("[createReview] Started:", review);

  const idToken = await getCurrentUserIdToken();

  console.log(
    "[createReview] Token received. Sending request."
  );

  return await serverPost("review", {
    ...review,
    id_token: idToken,
  });
}

export async function getReviews(listenableId) {
  const idToken = await getCurrentUserIdToken();

  return await serverPost("review/reviews", {
    listenable_id: String(listenableId),
    id_token: idToken,
  });
}

export async function getUserReview(userId) {
  const idToken = await getCurrentUserIdToken();

  return await serverPost("review/user", {
    user_id: userId,
    id_token: idToken,
  });
}

export async function upvoteReview(rid) {
  const idToken = await getCurrentUserIdToken();

  return await serverPost("review/upvote", {
    rid,
    id_token: idToken,
  });
}

export async function removeUpvoteFromReview(rid) {
  const idToken = await getCurrentUserIdToken();

  return await serverPost("review/removeUpvote", {
    rid,
    id_token: idToken,
  });
}

export async function deleteReview(rid) {
  const idToken = await getCurrentUserIdToken();

  return await serverDelete("review", {
    rid,
    id_token: idToken,
  });
}

export async function updateReview(
  rid,
  emoji,
  hearted,
  message,
  rating
) {
  const idToken = await getCurrentUserIdToken();

  return await serverPut("review/update", {
    rid,
    id_token: idToken,
    emoji,
    hearted,
    message,
    rating,
  });
}


export async function getReviewById(rid) {
  return await serverGet("review/getReview", { rid })
}
// #endregion

//#region Album endpoints
export async function getAlbumSongs(
  albumId
) {
  return await serverGet(
    "album/songs",
    {
      listenable_id: String(albumId),
    }
  );
}

export async function getAlbumSummary(
  albumId
) {
  return await serverGet(
    "album/summary",
    {
      listenable_id: String(albumId),
    }
  );
}

export async function getReviewSong(userId, rid) {
  return await serverGet("review/reviewSong", { userId, rid });
}

//#region Artist endpoints
export async function getArtistSongs(artist_id, page) {
  return await serverGet("artist/songs", { artist_id, page })
}
//#endregion

export async function getArtistTracks(
  artistId,
  limit = 50
) {
  if (!artistId) {
    throw new Error(
      "getArtistTracks requires an artist ID."
    );
  }

  return await serverGet(
    `artists/${encodeURIComponent(
      artistId
    )}/tracks`,
    {
      limit,
    }
  );
}

export async function getArtistAlbums(
  artistId,
  limit = 50
) {
  if (!artistId) {
    throw new Error(
      "getArtistAlbums requires an artist ID."
    );
  }

  return await serverGet(
    `artists/${encodeURIComponent(
      artistId
    )}/albums`,
    {
      limit,
    }
  );
}


// =====================================================
// Achievement endpoints
// =====================================================

export async function getAchievements(userId) {
  if (!userId) {
    throw new Error(
      "getAchievements requires a user ID."
    );
  }

  return await serverGet(
    `users/${encodeURIComponent(
      userId
    )}/achievements`
  );
}

/*
 * Record an achievement event.
 *
 * Call this when a song actually begins playing.
 * A song ID is stored only once per user, so restarting
 * the same song does not falsely increase progress.
 */
export async function trackAchievementEvent(
  userId,
  eventType,
  itemId,
  metadata = {}
) {
  if (!userId || !eventType) {
    throw new Error(
      "trackAchievementEvent requires a user ID and event type."
    );
  }

  return await serverPost(
    "users/achievements/event",
    {
      user_id: String(userId),
      event_type: String(eventType),
      item_id:
        itemId !== undefined &&
        itemId !== null
          ? String(itemId)
          : "",
      metadata:
        metadata &&
        typeof metadata === "object"
          ? metadata
          : {},
    }
  );
}

export async function trackSongListened(
  userId,
  song
) {
  const songId =
    song?.id ||
    song?.listenableId ||
    song?.listenable_id;

  if (!songId) {
    throw new Error(
      "trackSongListened requires a song ID."
    );
  }

  return await trackAchievementEvent(
    userId,
    "song_listened",
    songId,
    {
      title:
        song?.title ||
        song?.name ||
        "",
      artistName:
        song?.artist?.name ||
        song?.artistName ||
        "",
    }
  );
}


export function getServerEndpointBase() {
  const productionUrl =
    process.env.EXPO_PUBLIC_API_URL;

  const tunnelUrl =
    process.env.EXPO_PUBLIC_API_TUNNEL_URL;

  const fallbackLocalUrl =
    "http://10.0.0.80:5000";

  /*
   * Always prefer the permanent DigitalOcean backend.
   * The tunnel is only a fallback for local development.
   */
  const endpoint =
    productionUrl ||
    tunnelUrl ||
    fallbackLocalUrl;

  console.log(
    "[REST] API endpoint:",
    endpoint
  );

  if (!endpoint) {
    throw new Error(
      "No backend API URL is configured."
    );
  }

  return endpoint.replace(
    /\/+$/,
    ""
  );
}


export async function getComments(review_id) {
  const idToken =
    await getCurrentUserIdToken();

  return await serverPost(
    "post/getPostsByReview",
    {
      review_id,
      reviewId: review_id,
      id_token: idToken,
    }
  );
}

export async function deleteComment(post_id) {
  const idToken =
    await getCurrentUserIdToken();

  return await serverPost(
    "post/deletePost",
    {
      post_id,
      postId: post_id,
      replyId: post_id,
      id_token: idToken,
    }
  );
}

export async function addComment(
  author_id,
  review_id,
  message
) {
  const idToken =
    await getCurrentUserIdToken();

  /*
   * author_id is kept in the function signature for compatibility
   * with older callers. The backend identifies the reply author
   * securely from the Firebase token.
   */
  return await serverPost(
    "post/addPost",
    {
      author_id,
      review_id,
      reviewId: review_id,
      message,
      id_token: idToken,
    }
  );
}


// /users/top-songs/likes
export async function getTopSongs(userId) {
  return await serverGet(`users/top-songs/likes`);
}

// /users/top-songs/reviews
export async function getTopReviews(userId) {
  return await serverGet(`users/top-songs/reviews`);
}

// /users/recommended-songs?user_id={uid}
export async function getRecommendedSongs(userId) {
  return await serverGet(`users/recommended-songs`, { user_id: userId });
}
