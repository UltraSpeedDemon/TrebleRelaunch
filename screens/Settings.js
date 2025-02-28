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
import { auth } from '../utils/firebase';
import { getUser, updateUser } from "../providers/rest";
import { updateProfile } from "firebase/auth";

export default function Settings({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;

        if (currentUser) {
          console.log("[DEBUG] Fetching user data from Orient for UID:", currentUser.uid);
          const response = await getUser(currentUser.uid);
          if (!response.ok) {
            throw new Error("Failed to fetch user data from backend.");
          }
          const userData = await response.json();
          console.log("[DEBUG] Received user data from OrientDB:", userData);
          setUsername(userData.username || currentUser.displayName || "");
          setEmail(userData.email || currentUser.email || "");
          // Assuming Orient stores a darkMode field for the user's preference
          //setDarkMode(userData.darkMode || false);
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
        const payload = {
          username: username.trim(),
          //darkMode: darkMode, // Save dark mode preference
        };

        console.log("[DEBUG] Updating settings with payload:", payload);
        const response = await updateUser(currentUser.uid, payload);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update settings on backend.");
        }
        console.log("[DEBUG] Settings updated successfully for UID:", currentUser.uid);

        // Optionally update Firebase Auth profile if display name changed
        if (currentUser.displayName !== username.trim()) {
          await updateProfile(currentUser, { displayName: username.trim() });
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
        <Sidebar />
      </View>

      {/* Settings Header */}
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.subHeader}>Manage your preferences</Text>

      {/* Username Section */}
      <View style={styles.settingCard}>
        <Text style={styles.settingLabel}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
        />
      </View>

      {/* Email Section */}
      <View style={styles.settingCard}>
        <Text style={styles.settingLabel}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={email}
          editable={false}
          selectTextOnFocus={false}
        />
      </View>

      {/* Dark Mode Section */}
      <View style={styles.settingCard}>
        <Text style={styles.settingLabel}>Dark Mode</Text>
        <View style={styles.switchContainer}>
          <Switch
            value={darkMode}
            onValueChange={(value) => setDarkMode(value)}
            trackColor={{ true: "#4CAF50", false: "#ccc" }}
            thumbColor={darkMode ? "#fff" : "#f4f3f4"}
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
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
    paddingHorizontal: 20,
    paddingTop: 140,
  },
  sideMenu: {
    position: "absolute",
    top: 40,
    right: 525,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
},
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  subHeader: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 20,
  },
  settingCard: {
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#333",
  },
  disabledInput: {
    backgroundColor: "#e0e0e0",
    color: "#999",
  },
  switchContainer: {
    alignItems: "flex-start",
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: colours.lightblue,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: "center",
    marginBottom: 15,
  },
  logoutButton: {
    backgroundColor: "red",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "112%",
  },
});
