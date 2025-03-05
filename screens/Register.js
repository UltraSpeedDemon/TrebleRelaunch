import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { auth } from "../utils/firebase";
import { createUser } from "../providers/rest";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { saveSession } from "../utils/session";
import colours from "../styles/colours";


export default function Register({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);

  const handlePickAvatar = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
  
      if (!result.canceled) {
        setAvatar(result.assets[0].uri);
      }
    };

    const handleRegister = async () => {
      try {
        // Validate input fields
        if (!username || !email || !password) {
          throw new Error("Please fill out all fields");
        }
    
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error("Please enter a valid email");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        if (username.length < 3) {
          throw new Error("Username must be at least 3 characters");
        }
    
        // Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
    
        // Save the username as displayName in Firebase Auth
        await updateProfile(auth.currentUser, { displayName: username.trim().toLowerCase() });
    
        const payload = {
          userId: user.uid,
          username: username.trim().toLowerCase(),
          email: email,
          avatar: avatar, 
          isPublic: true, // Update this with a checkbox in the UI later
          spotifyAccessToken: "",
          spotifyIsLinked: false,
          spotifyRefreshToken: "",
          createdAt: new Date().toISOString(),
        };
    
        // Call your Orient endpoint to create the user record
        const response = await createUser(payload);
        const data = await response.json();
        if (!response.ok) {
          // The server route returns 409 if username is taken
          if (response.status === 409) {
            throw new Error(data.error || "Username already exists");
          }
          // Otherwise, some other error
          throw new Error(data.error || "Error creating user in backend");
        }

        //duplicate email
        if (response.status === 409) {
          throw new Error("Email already exists");
        }
    
        // Save the user session and navigate to the main screen
        await saveSession("userUid", user.uid);
        navigation.replace("Feed");
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    };
  

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Register</Text>


      <Text style={styles.text}>Username</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderRadius: 10, // Adjust the radius to your preference
            width: 300, // Static width
            height: 50, // Static height
          },
        ]}
        placeholder="Enter your username"
        placeholderTextColor={colours.darkgrey}
        value={username}
        onChangeText={(text) => setUsername(text)}
      />

      <Text style={styles.text}>Email</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderRadius: 10, // Adjust the radius to your preference
            width: 300, // Static width
            height: 50, // Static height
          },
        ]}
        placeholder="Enter your email"
        placeholderTextColor={colours.darkgrey}
        value={email}
        onChangeText={(text) => setEmail(text)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.text}>Password</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderRadius: 10, // Adjust the radius to your preference
            width: 300, // Static width
            height: 50, // Static height
          },
        ]}
        placeholder="Enter your password"
        placeholderTextColor={colours.darkgrey}
        secureTextEntry
        value={password}
        onChangeText={(text) => setPassword(text)}
      />
      <Text style={styles.text}></Text>

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button, // Correctly reference the style object
          { backgroundColor: colours.secondaryblue, opacity: 0.7 }, // Change the background color
        ]}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.buttonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.bluegrey,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontFamily: "sans-serif",
    fontSize: 20,
    color: "#000",
    marginVertical: 5,
  },
  largeText: {
    fontSize: 80,
    fontFamily: 'Lobster',
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: colours.secondaryblue, // Primary blue color
    borderWidth: 1,
    width: "100%",
    fontFamily: 'Domine',
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 18,
  },
  button: {
    backgroundColor: colours.navbarBlue, // Primary blue color
    borderRadius: 25, // Rounded corners
    width: 200, // Static width
    height: 50, // Static height
    justifyContent: "center", // Center text vertically
    alignItems: "center", // Center text horizontally
    marginVertical: 10, // Add some margin
  },
  buttonText: {
    color: "#FFFFFF", // White text
    fontSize: 16, // Font size
    fontWeight: "bold", // Optional bold text
  },
});