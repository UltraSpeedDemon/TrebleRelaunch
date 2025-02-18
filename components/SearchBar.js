
import {
    View,
    TextInput,
    StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import colours from "../styles/colours";

const SearchBar = () => {
    const navigation = useNavigation();

    return (
        <View style={styles.searchBar}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search for Songs..."
                selectionColor="#fff"
                placeholderTextColor="#aaa"
                onSubmitEditing={(e) => {
                    navigation.push("Search", {
                        searchQuery: e.nativeEvent.text
                    })
                }}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    searchBar: {
      position: "absolute",
      width: "70%",
      height: 40,
      top: 70,
      left: "15%",
      borderRadius: 8,
      justifyContent: "center",
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colours.lightblue,
      backgroundColor: colours.darkblue,
    },
    searchInput: {
      fontSize: 16,
      color: "#fff",
    }
})

export default SearchBar;
