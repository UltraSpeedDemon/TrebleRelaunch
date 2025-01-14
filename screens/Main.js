import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { saveSession } from '../utils/session';

export default function Main({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Treble</Text>
      <Text style={styles.mediumText}>Connect with Friends!</Text>
        <Text style={styles.mediumText}></Text>
       <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Hub')}>
                           <Text style={styles.buttonText}>Connections</Text>
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