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
    return await fetch(url); // no parse here, let caller .json()
  } catch (e) {
    console.error(e);
  }
}

export async function serverPost(endpoint, body) {
  try {
    return await fetch(`${getServerEndpointBase()}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
//#endregion

// #region User endpoints
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

export async function getRecommendations(userId, { limit = 20, offset = 0 } = {}) {
  try {
    return await serverGet("users/recommendations", { 
      user_id: userId, 
      offset, 
      limit 
    });
  } catch (error) {
    console.error("Error fetching my recommendations:", error);
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

// #region Review endpoints
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
  return await serverGet("review/user", { user_id })
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

export function getServerEndpointBase() {
  if (process.env.NODE_ENV === "development") {
      return process.env.API_TUNNEL_URL ? process.env.API_TUNNEL_URL : `https://127.0.0.1:5000`;
  }
  else {
      return `https://${process.env.API_URL}`;
  }
}
