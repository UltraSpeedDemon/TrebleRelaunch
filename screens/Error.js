import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function ErrorPage({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Oops! Something went wrong.</Text>
      <Text style={styles.text}>We encountered an error. Please try again later.</Text>

      <Button
        title="Go to Home"
        onPress = {() => navigation.navigate('Home')}
      />
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
    fontSize: 30,
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 20,
    color: '#000',
    marginBottom: 40,
    textAlign: 'center',
  },
});