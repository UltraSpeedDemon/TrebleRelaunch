import React from 'react';

import { View, Text, Button, StyleSheet } from 'react-native';

export default function Login({ navigate }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the Login Screen</Text>
      <Button title="Back to Home" onPress={() => navigate('Home')} />
      <Button title="Restart App" onPress={() => navigate('Welcome')} />
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fff',
    },
    text: {
      fontFamily: 'sans-serif',
      fontSize: 30,
      color: '#000',
    },
    largeText: {
      fontSize: 100,
      color: '#000',
    },
  });
