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
import { auth } from "../utils/firebase";
import { getUserByUsername } from "../providers/rest";
import { saveSession } from "../utils/session";
import colours from "../styles/colours";

export default function Login({ navigation }) {
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);


  function isEmail(input) {
    // Very minimal check:
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  }

  const handleLogin = async () => {
    try {
      setError(null);
  
      let userEmail = identifier;
  
      if (!isEmail(identifier)) {
        console.log("[DEBUG] Looking up user by username:", identifier);
        const response = await getUserByUsername(identifier.toLowerCase());
        if (!response.ok) {
          throw new Error("Failed to fetch user by username from backend.");
        }
        const users = await response.json();
        if (!users || users.length === 0) {
          throw new Error("Username not found");
        }
        userEmail = users[0].email;
      } else {
        userEmail = identifier.toLowerCase();
      }

      // Authenticate user with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        userEmail,
        password
      );
      const user = userCredential.user;

      // Save UID to SecureStore for session
      await saveSession("userUid", user.uid);
  
      navigation.replace("Feed");
    } catch (err) {
      setError("Invalid username or password.");
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Login</Text>

      <Text style={styles.text}></Text>


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

      <Text style={styles.mediumText}></Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colours.secondaryblue, opacity: 0.7 }]}
        onPress={() => navigation.navigate("ForgotPassword")}
      >
        <Text style={styles.buttonText}>Forgot Password?</Text>
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
    fontFamily: 'Lobster',
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: colours.secondaryblue,
    borderWidth: 1,
    fontFamily: 'Domine',
    placeholderFontFamily: 'Domine',
    borderRadius: 10,
    fontFamily: 'Domine',
    width: "90%",
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: colours.navbarBlue,
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