import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from "react-native";
import Sidebar from "../components/Sidebar";
import BottomNavbar from "../components/BottomNavbar";
import colours from "../styles/colours";
import { auth, db } from '../utils/firebase';
import { doc, getDoc, updateDoc } from "firebase/firestore"; // Firebase Firestore imports

export default function Settings({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;

        if (currentUser) {
          const displayName = currentUser.displayName || "";
          setEmail(currentUser.email || "");

          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username || displayName);
            setDarkMode(userData.darkMode || false); // Get dark mode preference from Firestore
          } else {
            setUsername(displayName);
          }
        } else {
          navigation.navigate("Home"); // Redirect to Login if no user is logged in
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Unable to fetch user data.");
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
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          username: username.trim(),
          darkMode: darkMode, // Store dark mode preference
        });

        if (currentUser.displayName !== username.trim()) {
          await currentUser.updateProfile({
            displayName: username.trim(),
          });
        }

        Alert.alert("Success", "Settings saved successfully!");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const handleLogout = () => {
    auth.signOut()
      .then(() => {
        navigation.navigate("Home"); // Redirect to Login page
      })
      .catch((error) => {
        console.error("Logout Error:", error);
        Alert.alert("Error", "Failed to log out. Please try again.");
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
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar menuOpen={false} setMenuOpen={() => {}} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
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
          style={[styles.inputEmail, styles.disabledInput]}
          value={email}
          color={colours.darkblue}
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
            trackColor={{ true: "#4CAF50", false: "#ccc" }}
            thumbColor={darkMode ? "#fff" : "#f4f3f4"}
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
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <BottomNavbar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colours.bluegrey,
    flex: 1,
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  largeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: colours.lightblue,
  },
  label: {
    fontSize: 16,
    color: colours.darkblue,
    marginTop: 20,
  },
  input: {
    width: "80%",
    height: 40,
    borderColor: colours.lightblue,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  inputEmail: {
    backgroundColor: "#f5f5f5", 
    width: "80%",
    height: 40,
    borderColor: colours.lightblue,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    marginTop: 10,
  },
  disabledInput: {
    backgroundColor: "#f5f5f5",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "80%",
    marginTop: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: colours.darkblue,
  },
  button: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: colours.lightblue,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  logoutButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: "red",
    borderRadius: 8,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
  },
});