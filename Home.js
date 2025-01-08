import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function Home({ navigate }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This is the Home Screen</Text>
      <Button title="Go to Login" onPress={() => navigate('Login')} />
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