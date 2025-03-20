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
import { auth } from "../utils/firebase";
import { updateProfile } from "firebase/auth";
import { getUser, updateUser } from "../providers/rest";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import BottomNavbar from "../components/BottomNavbar";
import Sidebar from "../components/Sidebar";
import colours from "../styles/colours";

const LAST_NAME_CHANGE_KEY = "lastNameChange";

export default function EditProfile({ navigation }) {
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [email, setEmail] = useState("");
  // We'll store the avatar as a base64 data URI (string)
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const isNameChangeDisabled = false;

  // State for the crop modal
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  // Fetch user data from Orient
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
        console.log(
          "[DEBUG] Found avatar in DB (first 50 chars):",
          finalAvatar.substring(0, 50) + "..."
        );
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

  // Pick a new avatar image
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset.width !== 512 || asset.height !== 512) {
          setImageToCrop(asset);
          setShowCropModal(true);
        } else {
          let mimeType = "image/jpeg";
          if (asset.uri && asset.uri.endsWith(".png")) {
            mimeType = "image/png";
          }
          const base64Avatar = `data:${mimeType};base64,${asset.base64}`;
          console.log(
            "[DEBUG] Picked avatar (first 50 chars):",
            base64Avatar.substring(0, 50) + "..."
          );
          setAvatar(base64Avatar);
        }
      }
    } catch (error) {
      console.error("Error picking avatar:", error);
    }
  };

  // Save profile changes including the new avatar to OrientDB
  const handleSave = async () => {
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No user is logged in.");
        return;
      }
      const newUsername = username.trim();

      console.log(
        "[DEBUG] Avatar payload on save:",
        avatar ? avatar.substring(0, 50) + "..." : "null"
      );

      // Construct payload only if avatar is nonempty
      const orientPayload = {
        username: newUsername.toLowerCase(),
        avatar: avatar && avatar.length > 0 ? avatar : null,
        isPublic: isPublic,
      };

      console.log("[DEBUG] Update payload:", orientPayload);

      const orientResponse = await updateUser(currentUser.uid, orientPayload);
      if (!orientResponse.ok) {
        const data = await orientResponse.json();
        if (orientResponse.status === 409) {
          throw new Error(data.error || "Username already exists");
        } else {
          throw new Error(data.error || "Failed to update user in OrientDB.");
        }
      }

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
              <Button
                title="Crop to 512x512"
                onPress={async () => {
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
                    let mimeType = "image/jpeg";
                    if (uri && uri.endsWith(".png")) {
                      mimeType = "image/png";
                    }
                    const base64Avatar = `data:${mimeType};base64,${result.base64}`;
                    console.log(
                      "[DEBUG] Cropped avatar (first 50 chars):",
                      base64Avatar.substring(0, 50) + "..."
                    );
                    setAvatar(base64Avatar);

                    // Immediately update the DB with the new avatar
                    const currentUser = auth.currentUser;
                    if (currentUser) {
                      const orientPayload = { avatar: base64Avatar };
                      const orientResponse = await updateUser(currentUser.uid, orientPayload);
                      if (!orientResponse.ok) {
                        const data = await orientResponse.json();
                        throw new Error(data.error || "Failed to update avatar in OrientDB.");
                      }
                      console.log("[DEBUG] Avatar update response OK.");
                    }
                    setShowCropModal(false);
                    Alert.alert("Success", "Avatar updated successfully!");
                  } catch (cropError) {
                    console.error("Error cropping image:", cropError);
                    Alert.alert("Error", "Failed to crop image. Please try again.");
                  }
                }}
              />
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

      {/* Privacy Card */}
      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Privacy</Text>
        <Text style={styles.privacySubtitle}>
          Toggle to make your profile visible or private to others.
        </Text>
        <View style={styles.privacyRow}>
          <Text style={styles.privacyLabel}>{isPublic ? "Public" : "Private"}</Text>
          <Switch
            style={styles.privacySwitch}
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
