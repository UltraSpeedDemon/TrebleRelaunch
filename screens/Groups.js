import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { db } from '../utils/firebase'; // Ensure this path is correct
import { collection, getDocs } from 'firebase/firestore';

export default function Groups({ navigation }) {
  return (
        <View style={styles.container}>
              {/* Bottom Navigation Bar (Hotbar) */}
                     <View style={styles.bottomNavBar}>
                     <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.bottomNavItem}>
                        <Image source={require('../images/messagesIcon.png')} style={styles.bottomMessagesIcon} />
                        <Text style={styles.bottomMessagesText}>Messages</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.bottomNavItem}>
                        <Image source={require('../images/homeIcon.png')} style={styles.bottomNavIcon} />
                        <Text style={styles.bottomNavText}>Home</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => navigation.navigate('Favourites')} style={styles.bottomNavItem}>
                        <Image source={require('../images/favouritesIcon2.png')} style={styles.bottomNavIcon} />
                        <Text style={styles.bottomNavText}>Favourites</Text>
                      </TouchableOpacity>
                    </View>
            </View>
      );
      }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  itemText: {
    fontSize: 16,
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    width: '112%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 10,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
  },
  bottomNavIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  bottomMessagesIcon: {
    width: 50,
    height: 50,
    bottom: 12,
  },
  bottomMessagesText: {
    bottom: 25,
    fontSize: 12,
    color: '#555',
  },
  bottomNavText: {
    fontSize: 12,
    color: '#555',
  },
});