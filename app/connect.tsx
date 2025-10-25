import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { connectToESP } from '../src/esp32';

export default function ConnectScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    const ok = await connectToESP();
    setBusy(false);
    if (ok) {
      router.push('/success'); // or '/sensor-reading?farmerId=...' from your farmer context
    } else {
      Alert.alert(
        'Hindi makakonekta',
        'Buksan ang Location (Android), tiyaking nasa Wi-Fi na “ESP32-NPK” (password: fertisense), at subukang muli.'
      );
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <Image
        source={require('../assets/images/connect-img.png')}
        style={styles.connectImage}
        resizeMode="contain"
      />

      <Text style={styles.heading}>Pindutin ang “Connect”</Text>

      <Image
        source={require('../assets/images/error.png')}
        style={styles.warningIcon}
        resizeMode="contain"
      />
      <Text style={styles.warningText}>
        Siguraduhing nasa 10–30 meters lang ang layo ng iyong cellphone mula sa sensor.
      </Text>

      <TouchableOpacity style={styles.connectButton} onPress={onConnect} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectText}>Connect</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  backButton: { position: 'absolute', top: 90, left: 25, zIndex: 10 },
  connectImage: { width: 220, height: 220, marginBottom: 30, marginTop: -30 },
  heading: { fontSize: 24, fontWeight: '600', marginBottom: 50, marginTop: -30 },
  warningIcon: { width: 35, height: 30, marginBottom: 8 },
  warningText: { fontSize: 17, textAlign: 'center', color: '#444', marginBottom: 80, paddingHorizontal: 12 },
  connectButton: { backgroundColor: '#2e7d32', paddingVertical: 13, paddingHorizontal: 100, borderRadius: 30 },
  connectText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
