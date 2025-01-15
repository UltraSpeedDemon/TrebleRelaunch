import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { db, auth } from "../utils/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { saveSession } from "../utils/session";

export default function Register({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      // Create a new user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await saveSession("userUid", user.uid);

      // Update the user's display name with the username
      await updateProfile(auth.currentUser, { displayName: username });

      // Save user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        username: username,
        email: email,
        createdAt: new Date().toISOString(),
      });
  
      Alert.alert('Success', 'User registered successfully!');
      navigation.navigate('Connections'); // Navigate to the Connections screen
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
        secureTextEntry
        value={password}
        onChangeText={(text) => setPassword(text)}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button, // Correctly reference the style object
          { backgroundColor: "#8080E0", opacity: 0.7 }, // Change the background color
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: {
    fontFamily: "sans-serif",
    fontSize: 20,
    color: "#000",
    marginVertical: 5,
  },
  largeText: {
    fontSize: 80,
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 18,
  },
  button: {
    backgroundColor: "#007BFF", // Blue background
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
