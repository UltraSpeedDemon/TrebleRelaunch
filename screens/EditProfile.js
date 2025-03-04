import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { auth } from "../utils/firebase";
import { updateProfile } from "firebase/auth";
import { getUser, updateUser } from "../providers/rest"; // Orient endpoints
import * as ImagePicker from "expo-image-picker";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import colours from "../styles/colours";

const LAST_NAME_CHANGE_KEY = "lastNameChange";

export default function EditProfile({ navigation }) {
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(null);
  // Commented out timer state for lock functionality
  // const [lastNameChange, setLastNameChange] = useState(null);
  // const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Commented out: lock feature based on timer.
  // const isNameChangeDisabled = lastNameChange ? timeRemaining > 0 : false;
  const isNameChangeDisabled = false; // Always allow changes

  // Persist lastNameChange (not used now, but left for future reference)
  const persistLastNameChange = async (date) => {
    try {
      await AsyncStorage.setItem(LAST_NAME_CHANGE_KEY, date.toISOString());
    } catch (error) {
      console.error("Error saving lastNameChange:", error);
    }
  };

  // Load persisted lastNameChange (not used now)
  const loadPersistedLastNameChange = async () => {
    try {
      const stored = await AsyncStorage.getItem(LAST_NAME_CHANGE_KEY);
      if (stored) {
        return new Date(stored);
      }
    } catch (error) {
      console.error("Error loading lastNameChange:", error);
    }
    return null;
  };

  // Fetch user data from Orient (primary source)
  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigation.navigate("Home");
        return;
      }
      setLoading(true);

      console.log("[DEBUG] Fetching user data from Orient for UID:", currentUser.uid);
      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error("Failed to fetch user data from OrientDB.");
      }
      const orientData = await orientRes.json();
      console.log("[DEBUG] Orient data:", orientData);

      // If the backend doesn’t have a lastNameChange, we try to load from AsyncStorage.
      // Commented out for now.
      // let finalLastNameChange = null;
      // if (orientData.lastNameChange && orientData.lastNameChange !== "None") {
      //   finalLastNameChange = new Date(orientData.lastNameChange);
      // } else {
      //   finalLastNameChange = await loadPersistedLastNameChange();
      // }

      // Use the user’s name and email from Orient or fallback to Firebase
      const finalUsername = orientData.username || currentUser.displayName || "";
      const finalEmail = orientData.email || currentUser.email || "";

      // For avatar, if backend is "None" or missing, use null
      const finalAvatar =
        orientData.avatar && orientData.avatar !== "None"
          ? orientData.avatar
          : null;

      setUsername(finalUsername);
      setOriginalUsername(finalUsername);
      setEmail(finalEmail);
      setAvatar(finalAvatar);
      // setLastNameChange(finalLastNameChange);
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Unable to fetch user data.");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch user data whenever the screen is focused.
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [navigation])
  );

  // Commented out timer logic
  // useEffect(() => {
  //   let timer;
  //   if (lastNameChange) {
  //     const endTime = lastNameChange.getTime() + 30 * 24 * 60 * 60 * 1000;
  //     const updateTimer = () => {
  //       const now = Date.now();
  //       const diff = endTime - now;
  //       if (diff <= 0) {
  //         setTimeRemaining(0);
  //         clearInterval(timer);
  //       } else {
  //         setTimeRemaining(diff);
  //       }
  //     };
  //     updateTimer();
  //     timer = setInterval(updateTimer, 1000);
  //     return () => clearInterval(timer);
  //   } else {
  //     setTimeRemaining(0);
  //   }
  // }, [lastNameChange]);

  // Format the time as "DD:HH:MM:SS"
  const formatTime = (milliseconds) => {
    let totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    totalSeconds %= 24 * 3600;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  // Pick a new avatar from the image library
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.canceled) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking avatar:", error);
    }
  };

  // Save changes to both Firebase (Firestore + Auth) and OrientDB.
  const handleSave = async () => {
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No user is logged in.");
        return;
      }
      // Commented out lock condition:
      // if (username.trim() !== originalUsername && isNameChangeDisabled) {
      //   Alert.alert("Name Change Restricted", "You can only change your username once every 30 days.");
      //   return;
      // }

      const newUsername = username.trim(); // preserve exact user input case
      // Commented out timer logic:
      // let newTimestamp = lastNameChange;
      // if (newUsername !== originalUsername) {
      //   newTimestamp = new Date();
      // }

      // --- Prepare payload for Orient ---
      const orientPayload = {
        username: newUsername.trim().toLowerCase(),
        avatar: avatar || null,
        // ...(newUsername !== originalUsername && { lastNameChange: newTimestamp.toISOString() }),
      };

      const orientResponse = await updateUser(currentUser.uid, orientPayload);
      if (!orientResponse.ok) {
        const data = await orientResponse.json();

        if (orientResponse.status === 409) {
          // Show the user a message
          throw new Error(data.error || "Username already exists");
        } else {
          // Some other error
          throw new Error(data.error || "Failed to update user in OrientDB.");
        }
      }

      // --- Update Firebase Auth displayName ---
      if (currentUser.displayName !== newUsername) {
        await updateProfile(currentUser, { displayName: newUsername.toLowerCase() });
      }

      // If username changed, update local state.
      if (newUsername !== originalUsername) {
        setOriginalUsername(newUsername);
        // setLastNameChange(newTimestamp);
        // await persistLastNameChange(newTimestamp);
      }

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => navigation.navigate("Profile") },
      ]);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={styles.sideMenu}>
        <Sidebar />
      </View>

      {/* Header Section */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={handlePickAvatar}>
          <Image
            source={avatar ? { uri: avatar } : require("../images/avatarIcon.png")}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.username}>Edit Your Profile</Text>
          <Text style={styles.editInfoText}>Tap the avatar to change your picture</Text>
        </View>
      </View>

      {/* Username Input */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, isNameChangeDisabled && styles.disabledInput]}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
          placeholderTextColor="#aaa"
          editable={!isNameChangeDisabled}
        />
        {/* Timer / lock feature commented out */}
        {/* {isNameChangeDisabled && (
          <>
            <Text style={styles.restrictionText}>
              You can only change your username once every 30 days.
            </Text>
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
          </>
        )} */}
      </View>

      {/* Email Display */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.disabledInput]}
          value={email}
          editable={false}
          selectTextOnFocus={false}
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.button, saving && styles.disabledButton]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>

      {/* Bottom Navigation */}
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
    paddingTop: 120,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  editInfoText: {
    fontSize: 14,
    color: "#aaa",
  },
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 5,
  },
  input: {
    backgroundColor: colours.darkblue,
    color: "#fff",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: "#e0e0e0",
    color: "#999",
  },
  restrictionText: {
    marginTop: 5,
    fontSize: 12,
    color: "#ff0000",
  },
  timerText: {
    marginTop: 2,
    fontSize: 12,
    color: "#ff0000",
    fontWeight: "bold",
  },
  button: {
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: colours.lightblue,
    borderRadius: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#aaa",
  },
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
});
