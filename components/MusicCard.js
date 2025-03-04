import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '@rneui/base';
import colours from '../styles/colours';

const MusicCard = ({ id, image, name, artist, album, onFollow, isFollowing, userCard, canFollow }) => {
  return (
    <TouchableOpacity activeOpacity={0.7}>
      <Card containerStyle={styles.cardContainer} wrapperStyle={styles.wrapper}>
        <Card.Image
          source={{ uri: image }}
          style={styles.image}
        />
        <View style={[styles.musicInfo, userCard && styles.userMusicInfo]}>
          {name && <Text style={styles.title}>{name}</Text>}
          {artist && <Text style={styles.artist}>{artist}</Text>}
          {album && <Text style={styles.album}>{album}</Text>}
          
        </View>
        {canFollow && onFollow && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={onFollow}
          >
            <Text style={styles.followButtonText}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    backgroundColor: "#fff", // White container
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 5,
  },
  musicInfo: {
    width: '80%',
  },
  userMusicInfo: {
    width: '46%', 
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  artist: {
    fontSize: 12.5,
  },
  album: {
    fontSize: 10,
    color: "#222"
  },
  followButton: {
    backgroundColor: colours.navbarBlue,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: 100,
    alignItems: 'center',
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: colours.lightblue,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default MusicCard;
