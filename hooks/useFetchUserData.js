import { useState, useEffect } from 'react';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { SPOTIFY_CLIENT_ID } from '@env';

import { discovery, REDIRECT_URI } from '../utils/spotifyAuth';

import * as AuthSession from 'expo-auth-session'; // Ensure AuthSession is imported correctly

const useFetchUserData = () => {
    const [username, setUsername] = useState('');
    const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
    const [spotifyAccessToken, setSpotifyAccessToken] = useState("");
    const [spotifyRefreshToken, setSpotifyRefreshToken] = useState("");
    const [loading, setLoading] = useState("");
    
    const navigation = useNavigation();

    const fetchUserData = async () => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                navigation.navigate('Home');
                return;
            }

            const displayName = currentUser.displayName;
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnapshot = await getDoc(userDocRef);

            if (userSnapshot.exists()) {
                const userData = userSnapshot.data();
                setUsername(userData.username || displayName);
                if (userData.spotifyAccessToken && userData.spotifyRefreshToken) {
                    setSpotifyAccessToken(userData.spotifyAccessToken)
                    setSpotifyRefreshToken(userData.spotifyRefreshToken)
                    setIsSpotifyLinked(true)
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false)
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    return { username, isSpotifyLinked, spotifyAccessToken, spotifyRefreshToken, loading };
};

export default useFetchUserData;