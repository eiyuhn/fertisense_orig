import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { connectToESP } from '../../../src/esp32';

export default function ConnectInstructionsScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    try {
      setBusy(true);
      const ok = await connectToESP();
      if (!ok) {
        Alert.alert(
          'Hindi makakonekta',
          'Tiyaking konektado sa Wi-Fi “ESP32-NPK” (password: fertisense), i-ON ang Location (Android), patayin muna ang mobile data, at subukang muli.'
        );
        return;
      }
      router.push({
        // stakeholder select-options lives under the route group
        pathname: '/(stakeholder)/screens/select-options' as const,
        params: { farmerId: String(farmerId ?? '') },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Logo */}
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={styles.title}>Connect to Device</Text>

      {/* Instruction Box */}
      <View style={styles.box}>
        <Text style={styles.boxIntro}>
          Bago makita ang datos, ikonekta muna ang device sa iyong cellphone.
        </Text>

        {/* Step 1 */}
        <View style={styles.stepRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../../assets/images/power.png')}
              style={styles.iconPower}
            />
          </View>
          <Text style={styles.stepText}>I-on ang iyong sensor device.</Text>
        </View>

        {/* Step 2 */}
        <View style={styles.stepRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../../assets/images/bluetooth.png')}
              style={styles.iconBluetooth}
            />
          </View>
          <Text style={styles.stepText}>Buksan ang Wi-Fi / Location ng iyong cellphone.</Text>
        </View>

        {/* Step 3 */}
        <View style={styles.stepRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../../assets/images/sensor.png')}
              style={styles.iconSensor}
            />
          </View>
          <Text style={styles.stepText}>Pindutin ang ‘Connect’ upang hanapin ang device.</Text>
        </View>

        {/* Step 4 */}
        <View style={styles.stepRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../../assets/images/rice.png')}
              style={styles.iconRiceType}
            />
          </View>
          <Text style={styles.stepText}>
            Pumili kung anong uri ng palay ang iyong itatanim.
          </Text>
        </View>

        {/* Step 5 */}
        <View style={styles.stepRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../../assets/images/check.png')}
              style={styles.iconCheck}
            />
          </View>
          <Text style={styles.stepText}>
            Hintaying kumonekta o makita ang ‘Successful’ na status.
          </Text>
        </View>
      </View>

      {/* Proceed Button */}
      <TouchableOpacity style={styles.button} onPress={onConnect} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Connecting…' : 'Connect'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flexGrow: 1,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 55,
    left: 20,
    zIndex: 10,
  },
  logo: {
    width: 190,
    height: 180,
    marginBottom: -20,
    marginTop: 10,
    top: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 15,
  },
  box: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 19,
    backgroundColor: '#f5fdf5',
    marginBottom: 40,
  },
  boxIntro: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 25,
    marginTop: 5,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconWrapper: {
    width: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepText: {
    fontSize: 16,
    color: '#444',
    flex: 1,
    flexWrap: 'wrap',
  },
  iconPower: { width: 25, height: 25, resizeMode: 'contain' },
  iconBluetooth: { width: 24, height: 24, resizeMode: 'contain' },
  iconSensor: { width: 30, height: 30, resizeMode: 'contain' },
  iconRiceType: { width: 20, height: 27, resizeMode: 'contain' },
  iconCheck: { width: 30, height: 40, resizeMode: 'contain' },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 13,
    paddingHorizontal: 100,
    borderRadius: 50,
    alignSelf: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
