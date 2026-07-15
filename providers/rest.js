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
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
  });
  } catch (e) {
    console.error(e);
  }
}

export async function serverPost(endpoint, body) {
  try {
    return await fetch(`${getServerEndpointBase()}/${endpoint}`, {
      method: "POST",
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

export async function getSongFromDeezer(listenable_id) {
  return await serverGet("search/getSongFromDeezer", { listenable_id });
}
//#endregion

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

export async function postRecommendations(userId, musicId, type, name, artistName) {
  try {
    const response = await serverPost("users/recommendations", {
      user_id: userId,
      music_id: musicId,
      type: type,
      name: name,
      artist_name: artistName
    });
    return response;
  } catch (error) {
    console.error("postRecommendations error:", error);
    throw error;
  }
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

export async function getRecommendations(userId, { limit = 20, offset = 0, refresh = false } = {}) {
  try {
    return await serverGet("users/recommendations", { 
      user_id: userId, 
      offset, 
      limit,
      refresh
    });
  } catch (error) {
    console.error("Error fetching my recommendations:", error);
  }
}

export async function share(userId, item_rid, item_id, comment, type) {
  return await serverPost("users/share", { 
    user_id: userId, 
    item_id: item_id,
    item_rid: item_rid, 
    comment: comment || '', 
    share_by: auth.currentUser.uid,
    type: type
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

//#region metadata endpoints
export async function populateMetadata(reviewType, id) {
  const params = { reviewType, id };
  return await serverGet("metadata/populate", params);
}
//#endregion


// #endregion

//#region Review endpoints
export async function createReview(review) {
  // decoded_token = auth.verify_id_token(request['id_token'])
  // listenable_id = request['track_id']
  // emoji = request['emoji'] or None
  // hearted = request['hearted'] or False
  // message = request['message']
  // rating = request['rating']
  id_token = await auth.currentUser.getIdToken()
  return await serverPost("review", {...review, id_token })
}

export async function getReviews(listenable_id) {
  id_token = await auth.currentUser.getIdToken()
  return await serverPost("review/reviews", { listenable_id, id_token })
}

export async function getUserReview(user_id) {
  id_token = await auth.currentUser.getIdToken()
  return await serverPost("review/user", { user_id, id_token })
}

export async function upvoteReview(rid) {
  id_token = await auth.currentUser.getIdToken()
  return await serverPost("review/upvote", { rid, id_token })
}

export async function removeUpvoteFromReview(rid) {
  id_token = await auth.currentUser.getIdToken()
  return await serverPost("review/removeUpvote", { rid, id_token })
}

export async function deleteReview(rid) {
  id_token = await auth.currentUser.getIdToken()
  return await serverDelete("review", { rid, id_token })
}

export async function updateReview(rid, emoji, hearted, message, rating) {
  id_token = await auth.currentUser.getIdToken()
  return await serverPut("review/update", { rid, id_token, emoji, hearted, message, rating })
}

export async function getReviewById(rid) {
  return await serverGet("review/getReview", { rid })
}
// #endregion

//#region Album endpoints
export async function getAlbumSongs(listenable_id) {
  return await serverGet("album/songs", { listenable_id })
}

export async function getAlbumSummary(listenable_id) {
  return await serverGet("album/summary", { listenable_id })
}

export async function getReviewSong(userId, rid) {
  return await serverGet("review/reviewSong", { userId, rid });
}

//#region Artist endpoints
export async function getArtistSongs(artist_id, page) {
  return await serverGet("artist/songs", { artist_id, page })
}

export async function getArtistAlbums(artist_id, page) {
  return await serverGet("artist/albums", { artist_id, page })
}
//#endregion

export function getServerEndpointBase() {
  const tunnelUrl = process.env.EXPO_PUBLIC_API_TUNNEL_URL;
  const productionUrl = process.env.EXPO_PUBLIC_API_URL;

  console.log("API endpoint:", tunnelUrl || productionUrl);

  if (__DEV__) {
    if (!tunnelUrl) {
      console.warn(
        "EXPO_PUBLIC_API_TUNNEL_URL is missing from the .env file"
      );
    }

    return tunnelUrl || "http://10.0.0.80:5000";
  }

  return productionUrl;
}


export async function getComments(review_id, user_rid) {
  return await serverPost("post/getPostsByReview", {review_id, user_rid})
}

export async function deleteComment(post_id) {
  return await serverDelete("post/deletePost", {post_id})
}

export async function addComment(author_id, review_id, message) {
  return await serverPost("post/addPost",{author_id, review_id, message})
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