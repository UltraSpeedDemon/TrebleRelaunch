import React, { useState, useCallback } from "react";
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
  Modal,
  Button,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { auth, storage } from "../utils/firebase";  // <-- import storage from your config
import { updateProfile } from "firebase/auth";
import { ref, uploadString, uploadBytes, getDownloadURL } from "firebase/storage"; // <-- for uploading to Firebase Storage
import { getUser, updateUser } from "../providers/rest"; // <-- your OrientDB REST calls
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import colours from "../styles/colours";

export default function EditProfile({ navigation }) {
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState(null);   // We'll store the download URL from Firebase
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  // 1. Fetch user data from OrientDB
  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigation.navigate("Home");
        return;
      }
      setLoading(true);
      console.log("[DEBUG] Fetching user data for UID:", currentUser.uid);

      const orientRes = await getUser(currentUser.uid);
      if (!orientRes.ok) {
        throw new Error("Failed to fetch user data from OrientDB.");
      }
      const orientData = await orientRes.json();
      console.log("[DEBUG] Orient data:", orientData);

      const finalUsername = orientData.username || currentUser.displayName || "";
      const finalEmail = orientData.email || currentUser.email || "";
      const finalAvatar =
        orientData.avatar && orientData.avatar !== "None"
          ? orientData.avatar
          : null;

      setUsername(finalUsername);
      setOriginalUsername(finalUsername);
      setEmail(finalEmail);
      if (finalAvatar) {
        console.log("[DEBUG] Found avatar in DB:", finalAvatar);
        setAvatar(finalAvatar);
      }
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

  // 2. Pick a new avatar image
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true, // needed for uploadString base64
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        await uploadAvatarToFirebase(asset);
        // If it's not 512x512, ask user to crop
        // if (asset.width !== 512 || asset.height !== 512) {
        //   setImageToCrop(asset);
        //   setShowCropModal(true);
        // } else {
        //   // If it's already 512x512, go ahead and upload
        //   await uploadAvatarToFirebase(asset);
        // }
      }
    } catch (error) {
      console.error("Error picking avatar:", error);
    }
  };

const uploadAvatarToFirebase = async (asset) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No user is logged in.");
    }

    let mimeType = "image/jpeg";
    if (asset.uri && asset.uri.endsWith(".png")) {
      mimeType = "image/png";
    }

    // Convert the data URL to a Blob using fetch.
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    // Create a storage reference for the avatar (e.g., avatars/USER_ID.jpg).
    const storageRef = ref(storage, `avatars/${currentUser.uid}.jpg`);

    // Upload the Blob to Firebase Storage.
    await uploadBytes(storageRef, blob, { contentType: mimeType });

    // Retrieve the download URL.
    const downloadURL = await getDownloadURL(storageRef);
    console.log("[DEBUG] Firebase Storage download URL:", downloadURL);

    // Update the user's record in OrientDB with the avatar URL.
    const orientPayload = { avatar: downloadURL };
    const orientResponse = await updateUser(currentUser.uid, orientPayload);
    if (!orientResponse.ok) {
      const data = await orientResponse.json();
      throw new Error(data.error || "Failed to update avatar in OrientDB.");
    }
    console.log("[DEBUG] OrientDB avatar update successful.");

    // Optionally update local state with the new URL.
    setAvatar(downloadURL);
    Alert.alert("Success", "Avatar updated successfully!");
  } catch (error) {
    console.error("Error uploading avatar:", error);
    Alert.alert("Error", error.message);
  }
};


  // 4. Crop if needed, then upload
  const handleCropAndUpload = async () => {
    try {
      const { uri, width, height } = imageToCrop;
      const cropWidth = 512;
      const cropHeight = 512;
      const originX = Math.max((width - cropWidth) / 2, 0);
      const originY = Math.max((height - cropHeight) / 2, 0);
      const actions = [
        { crop: { originX, originY, width: cropWidth, height: cropHeight } },
      ];

      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        base64: true,
      });
      console.log("[DEBUG] Cropped base64 (first 50 chars):", result.base64.substring(0, 50));

      // Upload the cropped image
      await uploadAvatarToFirebase({ uri: result.uri });

      setShowCropModal(false);
    } catch (cropError) {
      console.error("Error cropping image:", cropError);
      Alert.alert("Error", "Failed to crop image. Please try again.");
    }
  };

  // 5. Save other profile data (username, isPublic)
  const handleSave = async () => {
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No user is logged in.");
        return;
      }

      const newUsername = username.trim().toLowerCase();

      const orientPayload = {
        username: newUsername,
        avatar: avatar || null,
        isPublic,
      };

      const orientResponse = await updateUser(currentUser.uid, orientPayload);
      if (!orientResponse.ok) {
        const data = await orientResponse.json();
        if (orientResponse.status === 409) {
          throw new Error(data.error || "Username already exists");
        } else {
          throw new Error(data.error || "Failed to update user in OrientDB.");
        }
      }

      // Update Firebase Auth displayName if needed
      if (currentUser.displayName !== newUsername) {
        await updateProfile(currentUser, { displayName: newUsername });
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
      {/* Crop Modal */}
      <Modal
        visible={showCropModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCropModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crop Your Avatar</Text>
            {imageToCrop && (
              <Image
                source={{ uri: imageToCrop.uri }}
                style={styles.cropImage}
                resizeMode="contain"
              />
            )}
            <Text style={styles.modalInstructions}>
              Your selected image is not 512x512. Please crop it to 512x512.
            </Text>
            <View style={styles.modalButtons}>
              <Button title="Crop to 512x512" onPress={handleCropAndUpload} />
              <Button title="Cancel" onPress={() => setShowCropModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

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
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
          placeholderTextColor="#aaa"
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

      {/* Privacy Card */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Privacy</Text>
        <Text style={styles.privacySubtitle}>
          Toggle to make your profile visible or private to others.
        </Text>
        <View style={styles.privacyRow}>
          <Text style={styles.privacyLabel}>{isPublic ? "Public" : "Private"}</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#767577" }}
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
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Changes"}</Text>
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
  button: {
    marginHorizontal: 20,
    padding: 15,
    backgroundColor: colours.lightblue,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 70,
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
    marginRight: 190,
  },
  privacyLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  cropImage: {
    width: 300,
    height: 300,
    marginBottom: 10,
  },
  modalInstructions: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});
