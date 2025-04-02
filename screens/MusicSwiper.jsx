import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Image, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions 
} from "react-native";
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Audio } from "expo-av";
import { setRecommendationServed, like, postRecommendations, } from "../providers/rest";
import { auth } from "../utils/firebase"; // Add this import
import colours from "../styles/colours";

const { width, height } = Dimensions.get('window');

export function MusicSwiper({ songs }) {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [loadingSound, setLoadingSound] = useState(false); // Prevent overlapping playback
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-30deg', '0deg', '30deg'],
  });
  const leftOpacity = useRef(new Animated.Value(0)).current;
  const rightOpacity = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const currentSong = songs[currentIndex];
  const [sound, setSound] = useState(null);

  useEffect(() => {
    const playPreview = async () => {
      if (loadingSound) return; // Prevent multiple sound loads
      setLoadingSound(true);

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      if (currentSong?.audioUrl) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: currentSong.audioUrl },
            { shouldPlay: true, isLooping: true, isMuted }
          );
          setSound(newSound);
        } catch (error) {
          console.error("Error playing preview:", error);
        }
      }

      setLoadingSound(false);
    };

    playPreview();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [currentIndex, currentSong?.audioUrl, isMuted]);

  useFocusEffect(
    React.useCallback(() => {
      // Cleanup sound when the view is unfocused
      return () => {
        if (sound) {
          sound.unloadAsync();
          setSound(null);
        }
      };
    }, [sound])
  );

  // 1) Create an Animated.Value for the opacity (1 means fully opaque)
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 2) Animate the opacity from 1 to 0 over 1000 ms
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: true, // improves performance
    }).start();
  }, [fadeAnim]);

  const handleSwipe = async (direction) => {
    if (loadingSound) return; // Prevent swiping while sound is loading

    const currentSong = songs[currentIndex];
    if (!currentSong) return;

    if (direction === "right") {
      // Like the song
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          like(currentUser.uid, currentSong.id, "track")
          .then(() => {
            return postRecommendations(
              currentUser.uid,
              currentSong.id,
              "track",
              currentSong.title || "",
              currentSong.artist || ""
            );
          })
          .catch((error) => {
            console.error("Error liking or posting recommendations:", error);
          });
        }
      } catch (error) {
        console.error("Error liking song:", error);
      }
    } else if (direction === "left") {
      // Mark the recommendation as served (future implementation)
      // try {
      //   const currentUser = auth.currentUser;
      //   if (currentUser) {
      //     await setRecommendationServed(currentUser.uid, currentSong.id);
      //   }
      // } catch (error) {
      //   console.error("Error marking recommendation as served:", error);
      // }
    } 

    // Move to the next song
    Animated.timing(translateX, {
      toValue: direction === "left" ? -300 : 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % songs.length;
        translateX.setValue(0);
        return newIndex;
      });
    });

    Animated.timing(direction === "left" ? leftOpacity : rightOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(direction === "left" ? leftOpacity : rightOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleTouchStart = (e) => {
    startXRef.current = e.nativeEvent.pageX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    currentXRef.current = e.nativeEvent.pageX;
    const deltaX = currentXRef.current - startXRef.current;
    if (Math.abs(deltaX) > 50) {
      handleSwipe(deltaX > 0 ? "right" : "left");
      isDraggingRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const handleMuteToggle = () => {
    setIsMuted((prev) => !prev);
  };

  if (!currentSong) return null;

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.mainText, { opacity: fadeAnim }]}>
        Swipe To Find New Songs!
      </Animated.Text>
      <Animated.View style={[styles.gradientContainer, { opacity: leftOpacity }]}>
        <LinearGradient
          colors={['rgba(255, 0, 0, 0.5)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fullScreenGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.gradientContainer, { opacity: rightOpacity }]}>
        <LinearGradient
          colors={['transparent', 'rgba(0, 255, 0, 0.5)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fullScreenGradient}
        />
      </Animated.View>
      <Animated.View
        style={[styles.card, { transform: [{ translateX }, { rotate }] }]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image source={currentSong.albumArt} style={styles.image} />
        <Text style={styles.title}>{currentSong.title}</Text>
        <Text style={styles.artist}>{currentSong.artist}</Text>
      </Animated.View>
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={() => handleSwipe("left")} style={styles.button}>
          <FontAwesome name="thumbs-down" size={32} color="red" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMuteToggle} style={styles.button}>
          <FontAwesome name={isMuted ? "volume-off" : "volume-up"} size={32} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSwipe("right")} style={styles.button}>
          <FontAwesome name="thumbs-up" size={32} color="green" />
        </TouchableOpacity>
      </View>
      {/* Back button at the bottom */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={24} color="#fff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colours.background,
  },
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  fullScreenGradient: {
    flex: 1,
  },
  card: {
    borderColor: "red", borderWidth: 2,
    width: '90%',
    margin: 10,
    padding: 10,
    backgroundColor: colours.foreground,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    height: '60%',
  },
  image: {
    width: 280,
    height: 280,
    resizeMode: "cover",
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
    color: colours.white
  },
  mainText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colours.white
  },
  artist: {
    fontSize: 18,
    color: "#666",
    marginTop: 5,
    color: colours.white
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  button: {
    padding: 10,
  },
  backButtonContainer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "bold",
  },
});

export default MusicSwiper;
