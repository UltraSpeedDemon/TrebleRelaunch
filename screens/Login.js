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
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
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
  
      if (isEmail(identifier)) {
        // If it's an email, we'll just use signInWithEmailAndPassword directly
        userEmail = identifier.toLowerCase();
      } else {
        // Otherwise, treat it as a username. Query Firestore for the matching email.
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("usernameLower", "==", identifier.toLowerCase()));
        const querySnapshot = await getDocs(q);
  
        if (querySnapshot.empty) {
          throw new Error("Username not found");
        }
        userEmail = querySnapshot.docs[0].data().email;
      }
  
      const userCredential = await signInWithEmailAndPassword(
        auth,
        userEmail,
        password
      );
      const user = userCredential.user;
  
      // Save UID to SecureStore
      await saveSession("userUid", user.uid);
  
      Alert.alert("Success", "Logged in successfully!");
      navigation.replace("Main");
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
      
      <Text style={styles.text}></Text>
      <Text style={styles.text}></Text>
      <Text style={styles.text}></Text>

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
    fontSize: 100,
    fontFamily: 'Lobster',
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: colours.primaryblue,
    borderWidth: 1,
    fontFamily: 'Domine',
    placeholderFontFamily: 'Domine',
    borderRadius: 10,
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
    fontFamily: 'Domine',
    marginBottom: 20,
    textAlign: "center",
  },
});