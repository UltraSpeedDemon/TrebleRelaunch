import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";

export default function ForgotPassword({ navigate }) {
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    // Handle password reset logic here (e.g., API call)
    console.log(`Password reset requested for ${email}`);
    // Navigate back to login page after submitting
    navigate("Login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Forgot Password</Text>

      <Text style={styles.text}>Enter your email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={(text) => setEmail(text)}
        keyboardType="email-address"
      />

      <Button title="Submit" onPress={handleSubmit} />

      <Button title="Back to Login" onPress={() => navigate("Login")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  text: {
    fontFamily: "sans-serif",
    fontSize: 20,
    color: "#000",
    marginVertical: 5,
  },
  largeText: {
    fontSize: 40,
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
});
