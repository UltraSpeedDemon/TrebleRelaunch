// /providers/rest.js
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

export function getServerEndpointBase() {
  // NOTE: Adjust logic or remove if you'd prefer a simple config
  if (process.env.NODE_ENV === "development") {
    return process.env.API_TUNNEL_URL
      ? process.env.API_TUNNEL_URL
      : `http://127.0.0.1:5000`;
  } else {
    return `https://${process.env.API_URL}`;
  }
}
