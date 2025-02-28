import React from "react";
import { View, Text, Button, StyleSheet, TouchableOpacity } from "react-native";
import colours from "../styles/colours";
import fontFamily from "../styles/fontFamily";

import { AuthSession } from "expo";
import { SPOTIFY_CLIENT_ID } from "@env";
import { setAccessToken, setRefreshToken } from "../utils/spotifyAuth";
import { discovery } from "../utils/spotifyAuth";



const refreshTokens = async () => {
  if (!refreshToken) return;


  try {
    const refreshResult = await AuthSession.refreshAsync(
      {
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken: refreshToken,
      },
      discovery
    );

    if (refreshResult.accessToken) {
      setAccessToken(refreshResult.accessToken);
      setRefreshToken(refreshResult.refreshToken ?? refreshToken);
      // Sometimes the refresh token can change; if Spotify returns a new one,
      // store that. Otherwise, keep using the old one.
    }
  } catch (error) {
    console.log('Error refreshing token', error);
  }
};



export default function Home({ navigation }) {
  // check if users spotify token is still valid, if not refresh it
  refreshTokens();


  return (
    <View style={styles.container}>
      <Text style={styles.largeText}>Treble</Text>
      <Text style={styles.mediumText}>A Music Social Platform</Text>

      <Text style={styles.mediumText}></Text>

      <TouchableOpacity
         style={[styles.button, { backgroundColor: colours.primaryblue, opacity: 0.7 }]}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colours.primaryblue, opacity: 0.7 }]}
        onPress={() => navigation.navigate("Register")}
      >
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <Text style={styles.mediumText}></Text>
      <Text style={styles.mediumText}></Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colours.secondaryblue, opacity: 0.7 }]}
        onPress={() => navigation.navigate("Welcome")}
      >
        <Text style={styles.buttonText}>Restart App</Text>
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
    fontSize: 120,
    fontFamily: 'Pacifico',
    color: "#000",
    marginBottom: 20,
  },
  mediumText: {
    fontSize: 25,
    fontWeight: "bold",
    fontFamily: 'Domine',
    color: "#000",
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    width: "90%",
    marginBottom: 20,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    fontSize: 20,
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
  buttonTextSpotify: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonTextLast: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
  error: {
    color: "red",
    marginBottom: 20,
    textAlign: "center",
  },
  red: {
    color: "red",
    fontSize: 28,
    //bold
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
});