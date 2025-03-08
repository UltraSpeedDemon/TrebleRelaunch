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
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { auth } from "../utils/firebase";
import { updateProfile } from "firebase/auth";
import { getUser, updateUser } from "../providers/rest";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Privacy state
  const [isPublic, setIsPublic] = useState(true);

  const isNameChangeDisabled = false;

  // Fetch user data from Orient
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

      // username, email from orientData or fallback
      const finalUsername = orientData.username || currentUser.displayName || "";
      const finalEmail = orientData.email || currentUser.email || "";

      // avatar if present
      const finalAvatar =
        orientData.avatar && orientData.avatar !== "None"
          ? orientData.avatar
          : null;

      setUsername(finalUsername);
      setOriginalUsername(finalUsername);
      setEmail(finalEmail);
      setAvatar(finalAvatar);

      // isPublic
      if (typeof orientData.isPublic === "boolean") {
        setIsPublic(orientData.isPublic);
      } else {
        setIsPublic(true);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Unable to fetch user data.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [navigation])
  );

  // Pick a new avatar
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

  // Save changes to DB
  const handleSave = async () => {
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No user is logged in.");
        return;
      }

      const newUsername = username.trim();

      // Payload for orient
      const orientPayload = {
        username: newUsername.toLowerCase(),
        avatar: avatar || null,
        isPublic: isPublic, // <-- The privacy setting
      };

      const orientResponse = await updateUser(currentUser.uid, orientPayload);
      if (!orientResponse.ok) {
        const data = await orientResponse.json();
        if (orientResponse.status === 409) {
          // conflict => username taken
          throw new Error(data.error || "Username already exists");
        } else {
          throw new Error(data.error || "Failed to update user in OrientDB.");
        }
      }

      // Update Firebase Auth displayName if changed
      if (currentUser.displayName !== newUsername) {
        await updateProfile(currentUser, { displayName: newUsername.toLowerCase() });
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

      {/* Privacy Card/Box */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Privacy</Text>
        <Text style={styles.privacySubtitle}>
          Toggle to make your profile be visible or private to others.
        </Text>

        <View style={styles.privacyRow}>
          {/* text on the RIGHT */}
          <Text style={styles.privacyLabel}>
            {isPublic ? "Public" : "Private"}
          </Text>
          {/* Switch on LEFT */}
          <Switch style={styles.privacySwitch}
            // keep the track gray for both states
            trackColor={{ false: "#767577", true: "#767577" }}
            // the thumb is your lightblue when on
            thumbColor={isPublic ? colours.lightblue : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={(val) => setIsPublic(val)}
            value={isPublic}
          />
        </View>
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

// Styles
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
  button: {
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: colours.lightblue,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 70, // add space above bottomNav
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

  // Privacy Card
  privacyCard: {
    backgroundColor: colours.darkblue,
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  privacyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colours.lightblue,
    marginBottom: 10,
  },
  privacySubtitle: {
    fontSize: 14,
    color: "#aaa",
    marginBottom: 12,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: 190, // space to the right of the text
  },
  privacyLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
