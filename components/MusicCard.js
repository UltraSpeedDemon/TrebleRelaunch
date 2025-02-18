import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '@rneui/base';
import colours from '../styles/colours';

const MusicCard = ({ id, image, name, artist, album }) => {
  return (
    <TouchableOpacity activeOpacity={0.7}>
      <Card style={styles.musicCard} wrapperStyle={styles.wrapper}>
        <Card.Image
          source={{ uri: image }}
          style={styles.image}
        />
        <View style={styles.musicInfo}>
          {name && <Text style={styles.title}>{name}</Text>}
          {artist && <Text style={styles.artist}>{artist}</Text>}
          {album && <Text style={styles.album}>{album}</Text>}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  image: {
    width: 50,
    height: 50,
  },
  musicInfo: {
    width: '80%',
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
});

export default MusicCard;
