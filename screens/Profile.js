import React, { useState, useEffect } from 'react';
import {View,Text,StyleSheet,Image,TouchableOpacity,Alert,ActivityIndicator} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Profile({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;

        if (currentUser) {
          const displayName = currentUser.displayName || '';
          setEmail(currentUser.email || '');

          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username || displayName);
            setAvatar(userData.avatar || null);
          } else {
            setUsername(displayName);
          }
        } else {
          navigation.navigate('Home'); // Redirect to Login if no user is logged in
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert('Error', 'Unable to fetch user data.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }
    // Function to handle logging out
    const handleLogout = async () => {
        try {
          await signOut(auth);
          navigation.navigate('Home'); // Navigate to login screen
        } catch (error) {
          Alert.alert('Error', 'Failed to log out. Please try again.');
          console.error('Logout error:', error);
        }
      };

  return (
    <View style={styles.container}>
      {/* Go Back Button with Image */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
        <Image
          source={require('../images/arrowLeftIcon.png')} // Place your go back icon image here
          style={styles.goBackImage}
        />
      </TouchableOpacity>
      {/* Avatar */}
      <Image
        source={avatar ? { uri: avatar } : require('../images/avatarIcon.png')}
        style={styles.avatar}
      />

      {/* Username */}
      <Text style={styles.username}>{username}</Text>

      {/* Email */}
      <Text style={styles.email}>{email}</Text>

      {/* Edit Profile Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('EditProfile')}
      >
        <Text style={styles.buttonText}>Edit Profile</Text>
      </TouchableOpacity>

       {/* Logout Button */}
       <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
      {/* Bottom Navigation Bar (Hotbar) */}
             <View style={styles.bottomNavBar}>
             <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.bottomNavItem}>
                <Image source={require('../images/messagesIcon.png')} style={styles.bottomMessagesIcon} />
                <Text style={styles.bottomMessagesText}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.bottomNavItem}>
                <Image source={require('../images/homeIcon.png')} style={styles.bottomNavIcon} />
                <Text style={styles.bottomNavText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Favourites')} style={styles.bottomNavItem}>
                <Image source={require('../images/favouritesIcon2.png')} style={styles.bottomNavIcon} />
                <Text style={styles.bottomNavText}>Favourites</Text>
              </TouchableOpacity>
            </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 70,
    alignItems: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  email: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#FF0000',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
},
goBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
    zIndex: 1,
},
goBackImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
},
 bottomNavBar: {
     position: 'absolute',
    bottom: 0,
    width: '150%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 10,
},
bottomNavItem: {
    flex: 1,
    alignItems: 'center',
},
bottomNavIcon: {
    width: 25,
        height: 25,
        resizeMode: 'contain',
      },
      bottomMessagesIcon: {
        width: 50,
        height: 50,
        bottom: 12,
      },
      bottomMessagesText: {
        bottom: 25,
        fontSize: 12,
        color: '#555',
      },
      bottomNavText: {
        fontSize: 12,
        color: '#555',
      },
});
