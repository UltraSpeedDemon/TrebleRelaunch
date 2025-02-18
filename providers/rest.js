//#region Local server request handlers
export async function serverGet(endpoint, params=null) {
    let url = `${getServerEndpointBase()}/${endpoint}`
    try {
        if (params) {
            const urlParams = new URLSearchParams(params).toString()
            url += `?${urlParams}`
        }

        return await fetch(url)
    }
    catch (e) {
        console.error(e);
    }
}

export async function serverPost(endpoint, body) {
    try {
        return await fetch(`${getServerEndpointBase()}/${endpoint}`, {
            method: "POST",
            body: body
        })
    }
    catch (e) {
        console.error(e)
    }
}
//#endregion

//#region Custom request functions
export async function getHelloWorld() {
    return await serverGet("test");
}

export async function postSearchResults(input, type="album,track,artist,user", limit="10", strict="on", order="RANKING") {
    // return await serverGet("test");
    // return await serverGet("search");
    return await serverGet("search", {
        input,
        type,
        limit,
        strict,
        order
    });
}
//#endregion

export function getServerEndpointBase() {
    if (process.env.NODE_ENV === "development") {
        return process.env.API_TUNNEL_URL ? process.env.API_TUNNEL_URL : `https://127.0.0.1:5000`;
    }
    else {
        return `https://${process.env.API_URL}`;
    }
}