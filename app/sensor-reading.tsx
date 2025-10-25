import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import WifiManager from 'react-native-wifi-reborn';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { connectToESP, getNpkFresh } from '../src/esp32';
import { api } from '../src/api';

type Point = { n:number; p:number; k:number; ph?:number; ts:number };

export default function SensorReadingScreen() {
  const router = useRouter();
  const { farmerId: farmerIdParam } = useLocalSearchParams<{ farmerId?: string }>();
  const farmerId = String(farmerIdParam ?? '');

  const [currentStep, setCurrentStep] = useState(0);   // 0..10
  const [isReading, setIsReading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);

  const doOneRead = useCallback(async () => {
    try {
      setIsReading(true);

      // Ensure we’re really on ESP AP and it responds
      const ok = await connectToESP();
      if (!ok) throw new Error('Walang sagot mula sa ESP32-NPK. Siguruhing nakakonecta at patayin ang mobile data.');

      // Fresh read from /read (returns { ok, n, p, k, ph, ... })
      const res: any = await getNpkFresh();
      if (!res?.ok) throw new Error(res?.error || 'Sensor error');

      const pt: Point = {
        n: Number(res.n ?? res.N ?? 0),
        p: Number(res.p ?? res.P ?? 0),
        k: Number(res.k ?? res.K ?? 0),
        ph: res.ph != null ? Number(res.ph) : undefined,
        ts: Date.now(),
      };

      setPoints(prev => {
        const next = [...prev, pt];
        setCurrentStep(next.length); // 1..10
        return next;
      });
    } catch (e:any) {
      Alert.alert('Basahin ang sensor', e?.message || 'Walang sagot mula sa sensor. Siguraduhing naka-connect sa ESP32-NPK.');
    } finally {
      setIsReading(false);
    }
  }, []);

  const uploadBatchAndGo = useCallback(async () => {
    try {
      setIsReading(true);

      // Disconnect from ESP AP so upload can use mobile data/normal Wi-Fi
      try {
        const ssid = await WifiManager.getCurrentWifiSSID().catch(() => '');
        if (ssid === 'ESP32-NPK') {
          await WifiManager.disconnect();
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch {}

      // NOTE: Your backend batch route is custom; keeping your path.
      if (farmerId && points.length === 10) {
        await api.post(`/api/readings/farmers/${farmerId}/batch`, {
          points,
          meta: { label: '10-point soil sample', device: 'ESP32-NPK' },
        });
      }

      setIsComplete(true);
      setTimeout(() => {
        router.push({ pathname: '/screens/recommendation', params: { farmerId } });
      }, 800);
    } catch (e:any) {
      Alert.alert('Upload error', 'Please reconnect to the internet (turn off ESP Wi-Fi) then try again.');
      setIsComplete(true);
      setTimeout(() => {
        router.push({ pathname: '/screens/recommendation', params: { farmerId } });
      }, 800);
    } finally {
      setIsReading(false);
    }
  }, [farmerId, points, router]);

  useEffect(() => {
    if (currentStep === 10 && !isComplete) uploadBatchAndGo();
  }, [currentStep, isComplete, uploadBatchAndGo]);

  const handleStart = () => {
    if (currentStep >= 10 || isReading) return;
    if (currentStep === 0) doOneRead();
  };
  const handleNext = () => {
    if (currentStep >= 10 || isReading) return;
    doOneRead();
  };

  const stepLabel =
    currentStep === 0
      ? 'Handa nang magsimula.'
      : `${currentStep}/10 - ${isReading ? 'Reading soil...' : 'Saved. Ilipat ang probe sa susunod na lugar.'}`;

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/fertisense-logo.png')} style={styles.logo} />

      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert the Sensor into the Soil</Text>
        <Text style={styles.engSub}>The system will take 10 readings from different soil spots, including pH level.</Text>
        <Text style={styles.tagalogSub}>Kukuha ang sistema ng 10 readings mula sa iba't ibang bahagi ng lupa, kabilang ang pH level.</Text>

        {isReading && <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 20, marginBottom: 12 }} />}

        {!isComplete && <Text style={styles.readingStep}>📍 {stepLabel}</Text>}

        {isComplete && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={50} color="#2e7d32" />
            <Text style={styles.successText}>Success! Completed soil reading. Please wait for recommendation...</Text>
          </View>
        )}
      </View>

      {!isComplete && (
        <>
          {currentStep === 0 ? (
            <TouchableOpacity style={styles.startButton} onPress={handleStart} disabled={isReading}>
              <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
              <Text style={styles.startText}>  Simulan ang Pagbasa</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startButton} onPress={handleNext} disabled={isReading || currentStep >= 10}>
              <Ionicons name="refresh-outline" size={22} color="#fff" />
              <Text style={styles.startText}>  Magbasa muli ({currentStep}/10)</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffffff', alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, justifyContent: 'flex-start' },
  logo: { bottom: 12, width: 220, height: 220, resizeMode: 'contain', marginBottom: -30 },
  readingBox: { backgroundColor: '#f1fbf1', padding: 26, borderRadius: 18, width: '100%', elevation: 5, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center', marginBottom: 20 },
  engSub: { fontSize: 15, color: '#555', textAlign: 'center' },
  tagalogSub: { fontSize: 13, color: '#555', textAlign: 'center', fontStyle: 'italic', marginBottom: 20, marginTop: 6 },
  readingStep: { fontSize: 16, color: '#2e7d32', textAlign: 'center' },
  successBox: { backgroundColor: '#d1f7d6', padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 20, width: '100%' },
  successText: { fontSize: 15, color: '#1b5e20', textAlign: 'center', marginTop: 12 },
  startButton: { marginTop: 28, backgroundColor: '#2e7d32', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  startText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
