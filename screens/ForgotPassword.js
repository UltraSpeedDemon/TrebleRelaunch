import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert } from "react-native";
import { auth } from "../utils/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import colours from "../styles/colours";

export default function ForgotPassword({ navigation }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);

  const handleResetPassword = () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    sendPasswordResetEmail(auth, email)
      .then(() => {
        Alert.alert("Success", "Password reset email sent! Please check your inbox.");
        navigation.navigate("Login"); // Redirect to Login page
      })
      .catch((error) => {
        console.error("Error sending reset email:", error);
        Alert.alert("Error", "Failed to send password reset email. Please try again.");
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Forgot Password?</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor={colours.darkgrey}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
        <Text style={styles.buttonText}>Send Reset Link</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colours.secondaryblue, opacity: 0.7 }]}
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
    backgroundColor: colours.bluegrey,
    padding: 20,
  },
  largeText: {
    fontSize: 50,
    fontFamily: 'Lobster',
    color: "#000",
    marginBottom: 40,
  },
  input: {
    height: 50,
    borderColor: colours.primaryblue,
    borderWidth: 1,
    fontFamily: 'Domine',
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