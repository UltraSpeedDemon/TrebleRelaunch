import React, { useState, useEffect } from 'react';
import {View,Text,StyleSheet,Image,TouchableOpacity,Alert,ActivityIndicator} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import colours from '../styles/colours';
import Sidebar from '../components/Sidebar';
import BottomNavbar from '../components/BottomNavbar';

// This code can be uncommented to demonstrate how to receive a response from the local dev API.
// import { getHelloWorld } from '../providers/rest';

export default function Profile({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // This code can be uncommented to demonstrate how to receive a response from the local dev API.
  // const [helloWorld, setHelloWorld] = useState(null);

  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState("../images/avatarIcon.png");

  const noAvatar = require('../images/avatarIcon.png');

  const basicAvatar = '../images/avatarIcon.png';

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

  // This code can be uncommented to demonstrate how to receive a response from the local dev API.
  // async function getStuff() {
  //   const response = await getHelloWorld()
  //   const json = await response.json()
  //   setHelloWorld(json["message"])
  // }

  // useEffect(() => {
  //   getStuff();
  // }, [])

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
       <View style={styles.sideMenu}>
              {/* Sidebar */}
              <Sidebar />
        </View>

      {/* Avatar */}
      <Image
        source={avatar ? { uri: avatar } : noAvatar}
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
          {/* Bottom Navigation Bar */}
          <View style={styles.bottomNavBar}>
              <BottomNavbar />
            </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
    alignItems: "center",
    paddingTop: 70,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
  },
  email: {
    fontSize: 16,
    color: "#555",
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: "#BB0000",
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  goBackButton: {
    position: "absolute",
    top: 50,
    left: 20,
    padding: 10,
    zIndex: 1,
  },
  goBackImage: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    left: 100,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});