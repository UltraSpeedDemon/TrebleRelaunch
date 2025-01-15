import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, Alert, Image } from 'react-native';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function SettingsScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [darkMode, setDarkMode] = useState(false);
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

  const handleSaveSettings = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          username: username.trim(),
          darkMode: darkMode, // Store dark mode preference
        });

        if (currentUser.displayName !== username.trim()) {
          await currentUser.updateProfile({
            displayName: username.trim(),
          });
        }

        Alert.alert('Success', 'Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleLogout = () => {
    auth.signOut()
      .then(() => {
        navigation.navigate('Home'); // Redirect to Login page
      })
      .catch((error) => {
        console.error('Logout Error:', error);
        Alert.alert('Error', 'Failed to log out. Please try again.');
      });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
          {/* Go Back Button with Image */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
            <Image
              source={require('../images/arrowLeftIcon.png')} // Place your go back icon image here
              style={styles.goBackImage}
            />
            </TouchableOpacity>

        {/* Username */}
        <Text style={styles.largeText}>Settings</Text>
        
      {/* Username */}
      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter your username"
      />

      {/* Email (read-only) */}
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, styles.disabledInput]}
        value={email}
        editable={false}
        selectTextOnFocus={false}
      />

      {/* Dark Mode Toggle */}
      <Text style={styles.label}>Dark Mode</Text>
      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Enable Dark Mode</Text>
        <Switch
          value={darkMode}
          onValueChange={(value) => setDarkMode(value)}
          trackColor={{ true: '#4CAF50', false: '#ccc' }}
          thumbColor={darkMode ? '#fff' : '#f4f3f4'}
        />
      </View>

      {/* Save Settings Button */}
      <TouchableOpacity style={styles.button} onPress={handleSaveSettings}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
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
    padding: 30,
    backgroundColor: '#f9f9f9',
    paddingTop: 90, // Added padding from top to lower the content
  },
  largeText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    left: 80,
},
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
    marginTop: 20, // Added marginTop to space out from previous element
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  disabledInput: {
    backgroundColor: '#e0e0e0',
    color: '#999',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
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
        width: '118%',
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