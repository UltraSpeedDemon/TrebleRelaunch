import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { saveSession } from "../utils/session";
import colours from "../styles/colours";

export default function Login({ navigation }) {
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    try {
      setError(null); // Reset error state
      let email = identifier;

      // Check if identifier is not an email (assume it's a username)
      if (!identifier.includes("@")) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", identifier));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("Username not found");
        }

        // Extract the email associated with the username
        email = querySnapshot.docs[0].data().email;
      }

      // Authenticate user with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save UID to SecureStore for session
      await saveSession("userUid", user.uid);

      Alert.alert('Success', 'Logged in successfully!');
      navigation.navigate('Connections'); // Navigate to Connections on successful login
    } catch (err) {
      setError(err.message); // Show error message
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Login</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Username or Email"
        placeholderTextColor={colours.darkgrey}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colours.darkgrey}
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colours.secondaryblue, opacity: 0.7 }]}
        onPress={() => navigation.navigate("Register")}
      >
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colours.bluegrey,
    padding: 20,
  },
  mediumText: {
    fontSize: 25,
    color: "#000",
    marginBottom: 20,
  },
  largeText: {
    fontSize: 80,
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: colours.secondaryblue,
    borderWidth: 1,
    borderRadius: 10,
    width: "90%",
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: colours.primaryblue,
    borderRadius: 25,
    width: 200,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  error: {
    color: "red",
    marginBottom: 20,
    textAlign: "center",
  },
});