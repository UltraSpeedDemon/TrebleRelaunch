import { useState, useEffect } from 'react';
import { auth } from '../utils/firebase';
import { useNavigation } from '@react-navigation/native';
import { getUser } from '../providers/rest'; // Orient endpoint

const useFetchUserData = () => {
  const [username, setUsername] = useState('');
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [spotifyAccessToken, setSpotifyAccessToken] = useState('');
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState('');
  const [loading, setLoading] = useState(true);  
  // isPublic from DB
  const [isPublic, setIsPublic] = useState(true);
  
  const navigation = useNavigation();

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigation.navigate('Home');
        return;
      }
      const displayName = currentUser.displayName;
      
      // Fetch user data from Orient using the getUser endpoint
      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error('Failed to fetch user data from OrientDB.');
      }
      const userData = await orientRes.json();
      
      setIsPublic(userData.isPublic);
      setUsername(userData.username || displayName);
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
  }, []);

  return { username, isSpotifyLinked, spotifyAccessToken, spotifyRefreshToken, loading, isPublic };
};

export default useFetchUserData;
