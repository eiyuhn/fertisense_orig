import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FailedScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>

      {/* Red Arc Background */}
      <View style={styles.topArc} />

      <Text style={styles.statusText}>Status</Text>

      {/* X Icon */}
      <Image
        source={require('../assets/images/failed.png')}
        style={styles.statusIcon}
        resizeMode="contain"
      />
      <Text style={styles.resultText}>Failed to connect</Text>

      {/* Retry Button */}
      <TouchableOpacity style={styles.button} onPress={() => router.replace('../tabs/connect-instructions')}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  topArc: {
    position: 'absolute',
    top: -40,
    width: '120%',
    height: 150,
    backgroundColor: '#2e7d32',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  statusText: {
    position: 'absolute',
    top: 70,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  }, 
  statusIcon: {
    width: 70,
    height: 70,
    marginBottom: 15,
    bottom: -30
  },
  resultText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 100,
    color: '#333',
    bottom: -35
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    paddingHorizontal: 90,
    borderRadius: 30,
    bottom: -90
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});