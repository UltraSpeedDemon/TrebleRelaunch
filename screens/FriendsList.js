import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image} from 'react-native';
import { db } from '../utils/firebase'; // Ensure this path is correct
import { collection, getDocs } from 'firebase/firestore';

export default function FriendsList({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users', 'userId', 'friends'));
        const friendsList = querySnapshot.docs.map(doc => doc.data());
        setFriends(friendsList);
      } catch (err) {
        setError('Failed to fetch friends');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.name}</Text>
            {/* Add more friend details here */}
          </View>
        )}
      />
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
    width: '100%',
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