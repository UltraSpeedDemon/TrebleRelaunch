import { useState, useEffect } from 'react';
import { auth } from '../utils/firebase';
import { useNavigation } from '@react-navigation/native';
import { getUser } from '../providers/rest'; // your backend endpoint

const useFetchUserData = () => {
  const [username, setUsername] = useState('');
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState('');
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  // NEW: store avatar in state
  const [avatar, setAvatar] = useState(null);

  const navigation = useNavigation();

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigation.navigate('Home');
        return;
      }

      const displayName = currentUser.displayName;

      // Fetch user data from your backend
      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error('Failed to fetch user data from backend.');
      }
      const userData = await orientRes.json();

      // Populate local state from the returned user data
      setIsPublic(userData.isPublic);
      setUsername(userData.username || displayName);
      
      // Set the avatar field (could be null, data URI, or URL)
      setAvatar(userData.avatar || null);

      // If user has Spotify tokens, mark them as linked
      if (userData.spotifyAccessToken && userData.spotifyRefreshToken) {
        setSpotifyAccessToken(userData.spotifyAccessToken);
        setSpotifyRefreshToken(userData.spotifyRefreshToken);
        setIsSpotifyLinked(true);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    // Optionally: add [] or [navigation] depending on your needs
  }, []);

  return {
    username,
    isSpotifyLinked,
    spotifyAccessToken,
    spotifyRefreshToken,
    loading,
    isPublic,
    avatar,              // <--- return avatar for consumers
  };
};

export default useFetchUserData;
