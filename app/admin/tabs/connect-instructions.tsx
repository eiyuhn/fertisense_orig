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
import { connectToESP } from '../../../src/esp32';

const logo = require('../../../assets/images/fertisense-logo.png'); // kept as-is
const green = '#2e7d32';

export default function ConnectInstructions() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    try {
      setBusy(true);
      const ok = await connectToESP();
      if (!ok) {
        Alert.alert(
          'Hindi makakonekta',
          'Tiyaking nakakonekta sa Wi-Fi “ESP32-NPK” (password: fertisense), i-ON ang Location (Android), patayin muna ang mobile data, at subukan muli.'
        );
        return;
      }

      // ✅ routes unchanged
      router.push({
        pathname: '/select-options' as const,
        params: { farmerId: String(farmerId ?? '') },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: '#fff' }}>
      {/* Floating Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#333" />
      </TouchableOpacity>

      {/* Brand */}
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Connect to Device</Text>
      <Text style={styles.date}>
        {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {/* Instructions Card */}
      <View style={styles.card}>
        <Text style={styles.cardIntro}>
          Bago makita ang datos, ikonekta muna ang device sa iyong cellphone.
        </Text>

        <View style={styles.stepRow}>
          <Text style={styles.stepIcon}>⏻</Text>
          <Text style={styles.stepText}>I-on ang iyong sensor device.</Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepIcon}>📶</Text>
          <Text style={styles.stepText}>
            Buksan ang Wi-Fi at hanapin ang <Text style={styles.bold}>“ESP32-NPK”</Text>. Password:{' '}
            <Text style={styles.bold}>fertisense</Text>
          </Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepIcon}>🔌</Text>
          <Text style={styles.stepText}>
            Pindutin ang <Text style={styles.bold}>‘Connect’</Text> upang makipag-ugnayan sa sensor.
          </Text>
        </View>

        <View style={styles.stepRow}>
          <Text style={styles.stepIcon}>🌾</Text>
          <Text style={styles.stepText}>
            Ilipat ang probe sa lupa ayon sa tagubilin sa susunod na screen.
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
    width: 190,
    height: 140,
    marginTop: 12,
    marginBottom: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: green,
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

  stepIcon: {
    width: 26,
    textAlign: 'center',
    fontSize: 18,
  },

  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#434343',
    lineHeight: 21,
  },

  bold: { fontWeight: '800' },

  cta: {
    backgroundColor: green,
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
