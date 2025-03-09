//#region Local server request handlers
export async function serverGet(endpoint, params = null) {
    let url = `${await getServerEndpointBase()}/${endpoint}`;
    try {
        if (params) {
            const urlParams = new URLSearchParams(params).toString();
            url += `?${urlParams}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
        }
        return response;
    } catch (e) {
        console.error(e);
        throw new Error(`Network request failed: ${e.message}`);
    }
}

export async function serverPost(endpoint, body) {
    try {
        const response = await fetch(`${await getServerEndpointBase()}/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Failed to post data to ${endpoint}: ${response.statusText}`);
        }
        return response;
    } catch (e) {
        console.error(e);
        throw new Error(`Network request failed: ${e.message}`);
    }
}

export async function serverPut(endpoint, body) {
    try {
        const response = await fetch(`${await getServerEndpointBase()}/${endpoint}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Failed to put data to ${endpoint}: ${response.statusText}`);
        }
        return response;
    } catch (e) {
        console.error(e);
        throw new Error(`Network request failed: ${e.message}`);
    }
}
//#endregion

//#region Custom request functions
export async function getHelloWorld() {
    return await serverGet("test");
}

export async function postSearchResults(input, userId, type="album,track,artist,user", limit="10", strict="on", order="RANKING") {
    // return await serverGet("test");
    // return await serverGet("search");
    return await serverGet("search", {
        input,
        type,
        limit,
        strict,
        order,
        userId
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

// #endregion
  
// #region metadata endpoints

export async function populateMetadata(reviewType, id) {
  // Build the query parameters
  const params = { reviewType, id };
  
  // Call the test_populate endpoint
  return await serverGet("metadata/populate", params);
}
  


// #endregion

export async function getServerEndpointBase() {
    
    // return "https://treble-api-l9qo6.ondigitalocean.app/";

    // if local server available use that, if not query the digital ocean server
    if (process.env.REACT_APP_LOCAL_SERVER) {
        return "http://localhost:5000";
    }
    return "https://treble-api-l9qo6.ondigitalocean.app/";
}