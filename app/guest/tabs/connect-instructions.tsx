// app/guest/screens/connect-instructions.tsx

import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Ensure this path is correct based on your project structure
import { autoConnectToESP32, readNpkFromESP32 } from '../../../src/esp32'; 

// 🔒 Your images are in ROOT: /assets/images (not app/assets)
const logo      = require('../../../assets/images/fertisense-logo.png');
const icPower  = require('../../../assets/images/power.png');
const icWifi   = require('../../../assets/images/connect-wifi.png');
const icSensor = require('../../../assets/images/sensor.png');
const icRice   = require('../../../assets/images/rice.png');
const icCheck  = require('../../../assets/images/check.png');

const GREEN = '#2e7d32';

export default function ConnectInstructions() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      // 1) Scan nearby networks and connect to ESP32 AP
      await autoConnectToESP32();

      // 2) Quick sanity fetch to ensure routing goes to 192.168.4.1
      //    (If your ESP returns text, this still works.)
      await readNpkFromESP32();

      // 3) Navigate to your next screen
      router.push({
        pathname: '/guest/screens/select-options' as const,
        params: { farmerId: String(farmerId ?? '') },
      });
    } catch (err: any) {
      Alert.alert(
        'Hindi makakonekta',
        err?.message ??
          'Tiyaking nakakonekta sa Wi-Fi “ESP32-NPK”, naka-ON ang Location (Android), at subukan muli.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    // ✅ FIX: Guest users should navigate to guest home, not admin home.
    else router.push('/guest/tabs/guest-home'); 
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: '#fff' }}>
      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={22} color="#333" />
      </TouchableOpacity>

      {/* Brand */}
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Connect to Device</Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {/* Instructions */}
      {/* Instructions */}
<View style={styles.card}>
  <Text style={styles.cardIntro}>
    Ayha makita ang datos, ikonekta una ang device sa imong cellphone.
  </Text>

  <View style={styles.stepRow}>
    <View style={styles.iconWrap}>
      <Image source={icPower} style={styles.icon} />
    </View>
    <Text style={styles.stepText}>
      I-on ang imong sensor device.
    </Text>
  </View>

  <View style={styles.stepRow}>
    <View style={styles.iconWrap}>
      <Image source={icWifi} style={styles.icon} />
    </View>
    <Text style={styles.stepText}>
      I-on ang Wi-Fi ug pangitaa ang <Text style={styles.bold}>“ESP32-NPK”</Text>. 
    </Text>
  </View>

  <View style={styles.stepRow}>
    <View style={styles.iconWrap}>
      <Image source={icSensor} style={styles.icon} />
    </View>
    <Text style={styles.stepText}>
      Pinduta ang <Text style={styles.bold}>“Connect”</Text> aron makakonek sa sensor.
    </Text>
  </View>

  <View style={styles.stepRow}>
    <View style={styles.iconWrap}>
      <Image source={icRice} style={styles.icon} />
    </View>
    <Text style={styles.stepText}>
      Pilia kung unsang klase sa humay ang imong itanom.
    </Text>
  </View>

  <View style={styles.stepRow}>
    <View style={styles.iconWrap}>
      <Image source={icCheck} style={styles.iconTall} />
    </View>
    <Text style={styles.stepText}>
      Hulata nga makakonek ug makita ang <Text style={styles.bold}>“Successful”</Text> nga status.
    </Text>
  </View>
</View>


      {/* CTA */}
      <TouchableOpacity
        style={[styles.cta, busy && { opacity: 0.9 }]}
        onPress={onConnect}
        disabled={busy}
        activeOpacity={0.9}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Connect</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },

  backBtn: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    zIndex: 10,
  },

  logo: {
    width: 110,
    height: 140,
    marginTop: 12,
    marginBottom: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: GREEN,
    marginBottom: 2,
    letterSpacing: 0.2,
  },

  date: {
    fontSize: 12.5,
    color: '#6d6d6d',
    marginBottom: 14,
  },

  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cfe9d2',
    backgroundColor: '#f6fbf7',
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
    marginBottom: 20,
  },

  cardIntro: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },

  iconWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },

  icon: { width: 22, height: 22, resizeMode: 'contain' },
  iconTall: { width: 24, height: 30, resizeMode: 'contain' },

  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#434343',
    lineHeight: 21,
  },

  bold: { fontWeight: '800' },

  cta: {
    backgroundColor: GREEN,
    paddingVertical: 13,
    paddingHorizontal: 100,
    borderRadius: 999,
    alignSelf: 'center',
    elevation: 0,
  },

  ctaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15.5,
    letterSpacing: 0.2,
  },
});