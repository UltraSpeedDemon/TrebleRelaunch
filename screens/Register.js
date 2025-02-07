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
import { db, auth } from "../utils/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, query as fsQuery, where, getDocs, doc, setDoc } from "firebase/firestore";
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
      // Check if any fields are empty
      if (!username || !email || !password) {
        throw new Error("Please fill out all fields");
      }

      //check if email is valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email");
      }

      // Check if password is at least 6 characters
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Check if username is at least 3 characters
      if (username.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }

      // Check if username is already taken
      const usersRef = collection(db, "users");
    const userQuery1 = fsQuery(usersRef, where("usernameLower", "==", username.toLowerCase()));
    const querySnapshot1 = await getDocs(userQuery1);

    if (!querySnapshot1.empty) {
      throw new Error("Username is already taken");
    }

    // Check if email is already taken
    const userQuery2 = fsQuery(usersRef, where("emailLower", "==", email.toLowerCase()));
    const querySnapshot2 = await getDocs(userQuery2);
    
    if (!querySnapshot2.empty) {
      throw new Error("Email is already taken");
    }



      // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save username/displayName
    await updateProfile(auth.currentUser, { displayName: username });

    // Create user doc in Firestore
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      usernameLower: username.toLowerCase(),
      email: email,
      emailLower: email.toLowerCase(),
      avatar,
      createdAt: new Date().toISOString(),
    });

    // Save session and navigate
    await saveSession("userUid", user.uid);
    Alert.alert("Success", "User registered successfully!");
    navigation.replace("Main");
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
    fontFamily: 'Domine',
    fontWeight: 'bold',
    fontSize: 20,
    color: "#000",
    marginVertical: 5,
  },
  largeText: {
    fontSize: 100,
    fontFamily: 'Lobster',
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: colours.secondaryblue, // Primary blue color
    borderWidth: 1,
    fontFamily: 'Domine',
    width: "100%",
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