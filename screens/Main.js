import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { saveSession } from '../utils/session';

export default function Main({ navigation }) {
    const [username, setUsername] = useState(null);
      const [loading, setLoading] = useState(true);
    
      useEffect(() => {
        const fetchUserData = async () => {
          try {
            // Get the current user from Firebase Auth
            const currentUser = auth.currentUser;
    
            if (currentUser) {
              // Option 1: Use the displayName from Firebase Auth
              const displayName = currentUser.displayName;
              setUsername(displayName);
    
              // Option 2 (Optional): Fetch additional user data from Firestore
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setUsername(userData.username); // Use Firestore username if available
              }
            } else {
              navigation.navigate('Home'); // Redirect to Login if no user is logged in
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          } finally {
            setLoading(false);
          }
        };

    fetchUserData();
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Welcome, {username}!</Text>
    </View>
  );
}
