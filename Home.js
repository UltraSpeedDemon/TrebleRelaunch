import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function Home({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Bass</Text>
      <Text style={styles.text}>Welcome to Bass</Text>

      <Button
        title="Login"onPress={() => navigation.navigate('Login')}/>
      <Button
        title="Register" onPress={() => navigation.navigate('Register')}/>
       <Button 
        title="Restart App" onPress={() => navigation.navigate('Welcome')} />
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
    button: {
      marginVertical: 10,
      fontSize: 30,
    },
  });