import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

export default function Register({ navigate }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = () => {
    // In this case, we'll navigate to the ErrorPage when the register button is clicked
    console.log(`Registering user: ${username}, Email: ${email}`);
    // Navigate to ErrorPage as per the request
    navigate('ErrorPage');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Register</Text>

      <Text style={styles.text}>Username</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        value={username}
        onChangeText={(text) => setUsername(text)}
      />

      <Text style={styles.text}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={(text) => setEmail(text)}
        keyboardType="email-address"
      />

      <Text style={styles.text}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={(text) => setPassword(text)}
      />

      <Button title="Register" onPress={() => navigate('Error')} />

      <Button title="Back to Login" onPress={() => navigate('Login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  text: {
    fontFamily: 'sans-serif',
    fontSize: 20,
    color: '#000',
    marginVertical: 5,
  },
  largeText: {
    fontSize: 80,
    color: '#000',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 18,
  },
});