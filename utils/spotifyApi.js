import axios from "axios";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";

// Fetch top tracks or playlist tracks from Spotify
export const getSpotifyTracks = async (accessToken) => {
  try {
    const response = await axios.get(`${SPOTIFY_API_URL}/me/top/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data.items; // Extract tracks
  } catch (error) {
    console.error("Error fetching Spotify tracks:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch playlist tracks from Spotify
export const getPlaylistTracks = async (accessToken, playlistId) => {
  try {
    const response = await axios.get(`${SPOTIFY_API_URL}/playlists/${playlistId}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data.items.map((item) => item.track); // Extract tracks
  } catch (error) {
    console.error("Error fetching playlist tracks:", error.response?.data || error.message);
    throw error;
  }
};