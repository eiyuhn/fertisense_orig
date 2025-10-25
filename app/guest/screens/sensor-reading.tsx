import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { useReadingSession } from '../../../context/ReadingSessionContext';

// ✅ import helpers instead of Axios + IP
import { autoConnectToESP32, readNpkFromESP32 } from '../../../src/esp32';

export default function SensorReadingScreen() {
  const router = useRouter();
  const { setResult } = useReadingSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const doOneRead = async () => {
    try {
      // 1️⃣ connect (only once on first read)
      if (currentStep === 0) await autoConnectToESP32();
      // 2️⃣ fetch reading
      const res: any = await readNpkFromESP32();
      if (!res?.ok) throw new Error(res?.error || 'No data');
      return res;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to read from ESP32');
    }
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isReading && currentStep < 10) {
      timeout = setTimeout(async () => {
        try {
          const r = await doOneRead();
          (global as any).__reads = [...((global as any).__reads || []), r];
          setCurrentStep((s) => s + 1);

          if ((global as any).__reads.length === 10) {
            const arr = (global as any).__reads;
            const avg = (k: string) =>
              arr.reduce((a: number, v: any) => a + Number(v[k] || 0), 0) / arr.length;

            const N = +avg('n').toFixed(1);
            const P = +avg('p').toFixed(1);
            const K = +avg('k').toFixed(1);
            const pH = +avg('ph').toFixed(1);

            (global as any).__reads = [];
            setIsComplete(true);

            // ✅ save to context
            setResult({ n: N, p: P, k: K, ph: pH, ts: Date.now() });

            setTimeout(() => {
              router.push('/guest/screens/recommendation');
            }, 1200);
          }
        } catch (err: any) {
          Alert.alert(
            'Connection Error',
            err?.message || 'Please connect to ESP32-NPK Wi-Fi before reading.'
          );
          setIsReading(false);
          setCurrentStep(0);
        }
      }, 1000);
    }
    return () => clearTimeout(timeout);
  }, [isReading, currentStep, router, setResult]);

  const handleStart = () => {
    (global as any).__reads = [];
    setIsReading(true);
    setCurrentStep(0);
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
      />
      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert the Sensor into the Soil</Text>
        <Text style={styles.engSub}>
          The system will take 10 readings from different soil spots, including pH level.
        </Text>
        <Text style={styles.tagalogSub}>
          Kukuha ang sistema ng 10 readings mula sa iba't ibang bahagi ng lupa, kabilang ang pH level.
        </Text>

        {isReading && currentStep <= 10 && (
          <>
            <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 20, marginBottom: 12 }} />
            <Text style={styles.readingStep}>📍 {currentStep}/10 - Reading soil...</Text>
          </>
        )}

        {isComplete && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={50} color="#2e7d32" />
            <Text style={styles.successText}>
              Success! Completed soil reading. Please wait for recommendation...
            </Text>
          </View>
        )}
      </View>

      {!isReading && !isComplete && (
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
          <Text style={styles.startText}>  Simulan ang Pagbasa</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// (Keep your same styles)
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
  startText: { color: '#fff', fontSize: 16 },
});
