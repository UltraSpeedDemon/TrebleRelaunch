import { View, Text, StyleSheet } from 'react-native';
import HorizontalRule from './HorizontalRule';

const SectionDivider = ({ title, nonfirst=true }) => {
    return (
      <View style={[nonfirst && styles.nonFirst, styles.divider]}>
        {title && (
          <Text style={styles.title}>{title}</Text>
        )}
        <HorizontalRule />
      </View>
    );
  };
  
  const styles = StyleSheet.create({
    divider: {
      paddingHorizontal: 20,
    },
    nonFirst: {
      marginTop: 25
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 2,
      paddingLeft: 2.5,
    },
  });
  
  export default SectionDivider;