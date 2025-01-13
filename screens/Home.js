import React from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';

export default function Home({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Treble</Text>
      <Text style={styles.mediumText}>A Music Social Platform</Text>

      <Text style={styles.mediumText}></Text>

       <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          


       <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>

        <Text style={styles.mediumText}></Text>
        <Text style={styles.mediumText}></Text>

        <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#8080E0', opacity: 0.7 }]}
                      onPress = {() => navigation.navigate('Welcome')}
                    >
                      <Text style={styles.buttonText}>Restart App</Text>
        </TouchableOpacity>
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
  largeText: {
    fontSize: 120,
    color: '#000',
    marginBottom: 20,
  },
  mediumText: {
    fontSize: 25,
    color: '#000',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    width: '90%',
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007BFF',
    fontSize: 20,
    borderRadius: 25,
    width: 200,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSpotify: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextLast: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  red: {
    color: 'red',
    fontSize: 28,
    //bold
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  }
});