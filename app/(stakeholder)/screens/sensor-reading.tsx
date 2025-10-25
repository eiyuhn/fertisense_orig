import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getNpkFresh, getNpkCached, connectToESP, ESP_SSID } from '../../../src/esp32';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { addReading } from '../../../src/services';

type NpkJson = {
  ok?: boolean;
  ts?: number;
  n?: number;
  p?: number;
  k?: number;
  ph?: number;
  // optional extras the ESP sometimes returns
  ec?: number;
  n_kg_ha?: number;
  p_kg_ha?: number;
  k_kg_ha?: number;
  error?: string;
};

const TOTAL_STEPS = 10;

export default function SensorReadingScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const { setLatestSensorData } = useData();
  const { token } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  const readOnce = useCallback(async (): Promise<NpkJson | null> => {
    // Try a fresh read first; if it fails, fall back to cached
    try {
      const fresh = await getNpkFresh();
      if (fresh?.ok) return fresh as NpkJson;
    } catch (e: any) {
      // ignore, try cached
    }
    try {
      const cached = await getNpkCached();
      if (cached?.ok) return cached as NpkJson;
    } catch (e: any) {
      // ignore, return null
    }
    return null;
  }, []);

  const handleStart = useCallback(async () => {
    setIsReading(true);
    setCurrentStep(0);
    setLastMsg(null);

    // 0) Ensure we’re actually connected to the ESP32 AP
    setLastMsg(`Checking Wi-Fi (${ESP_SSID})…`);
    const ok = await connectToESP();
    if (!ok) {
      setIsReading(false);
      Alert.alert(
        'Hindi makakonekta',
        `Tiyaking nakakonekta sa Wi-Fi “${ESP_SSID}” (password: fertisense). Buksan ang Location (Android), patayin muna ang mobile data, saka subukang muli.`
      );
      return;
    }

    // 1) Collect 10 readings
    const Ns: number[] = [];
    const Ps: number[] = [];
    const Ks: number[] = [];
    const pHs: number[] = [];

    for (let i = 1; i <= TOTAL_STEPS; i++) {
      if (abortRef.current.cancelled) return;
      setCurrentStep(i);
      setLastMsg(`📍 ${i}/${TOTAL_STEPS} - Reading soil…`);

      // a) Do up to 2 tries for each spot
      let data: NpkJson | null = null;
      for (let attempt = 1; attempt <= 2 && !data; attempt++) {
        data = await readOnce();
        if (!data) await new Promise(r => setTimeout(r, 600));
      }

      if (!data) {
        setIsReading(false);
        Alert.alert(
          'Walang nabasang data',
          'Hindi nakakuha ng reading sa sensor. Subukan ilapit ang phone sa device at ulitin.'
        );
        return;
      }

      // b) Push if present
      if (typeof data.n === 'number') Ns.push(data.n);
      if (typeof data.p === 'number') Ps.push(data.p);
      if (typeof data.k === 'number') Ks.push(data.k);
      if (typeof data.ph === 'number') pHs.push(data.ph);

      // c) Tiny pause between spots (ESP loop ~5s; we poke faster thanks to /read)
      await new Promise(r => setTimeout(r, 700));
    }

    // 2) Compute averages (simple mean)
    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    const avgN = avg(Ns);
    const avgP = avg(Ps);
    const avgK = avg(Ks);
    const avgPH = Math.round((avg(pHs) + Number.EPSILON) * 10) / 10;

    // 3) Publish to DataContext (so other screens can show “latest”)
    const stamp = new Date().toISOString();
    setLatestSensorData({
      timestamp: stamp,
      n: avgN,
      p: avgP,
      k: avgK,
      ph: isFinite(avgPH) ? avgPH : undefined,
    });

    // 4) (Optional) Save to backend farmer logs if we have a farmerId + token
    try {
      if (farmerId && token) {
        await addReading(
          {
            farmerId: String(farmerId),
            npk: { N: avgN, P: avgP, K: avgK },
            ph: isFinite(avgPH) ? avgPH : null,
            source: 'esp32',
          },
          token
        );
      }
    } catch {
      // non-fatal; we still move to recommendation
    }

    // 5) Show success, then route to recommendation screen
    setIsComplete(true);
    setLastMsg('Success! Completed soil reading. Please wait for recommendation…');
    setTimeout(() => {
      if (abortRef.current.cancelled) return;
      router.push({
        pathname: '/(stakeholder)/screens/recommendation',
        params: {
          n: String(avgN),
          p: String(avgP),
          k: String(avgK),
          ph: isFinite(avgPH) ? String(avgPH) : '',
          farmerId: String(farmerId ?? ''),
        },
      });
    }, 1200);
  }, [connectToESP, farmerId, readOnce, router, token, setLatestSensorData]);

  // Keep your original UI/branding; only behavior changed.
  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
      />

      {/* Reading Box */}
      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert the Sensor into the Soil</Text>

        <Text style={styles.engSub}>
          The system will take 10 readings from different soil spots, including pH level.
        </Text>
        <Text style={styles.tagalogSub}>
          Kukuha ang sistema ng 10 readings mula sa iba't ibang bahagi ng lupa, kabilang ang pH level.
        </Text>

        {isReading && currentStep <= TOTAL_STEPS && (
          <>
            <ActivityIndicator
              size="large"
              color="#2e7d32"
              style={{ marginTop: 20, marginBottom: 12 }}
            />
            <Text style={styles.readingStep}>
              📍 {currentStep}/{TOTAL_STEPS} - Reading soil...
            </Text>
            {!!lastMsg && (
              <Text style={{ marginTop: 8, color: '#2e7d32' }}>{lastMsg}</Text>
            )}
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

      {/* Start Button */}
      {!isReading && !isComplete && (
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
          <Text style={styles.startText}>  Simulan ang Pagbasa</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  logo: {
    bottom: 12,
    width: 220,
    height: 220,
    resizeMode: 'contain',
    marginBottom: -30,
  },
  readingBox: {
    backgroundColor: '#f1fbf1',
    padding: 26,
    borderRadius: 18,
    width: '100%',
    elevation: 5,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  engSub: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  tagalogSub: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontStyle: 'italic',
    marginBottom: 20,
    marginTop: 6,
  },
  readingStep: {
    fontSize: 16,
    color: '#2e7d32',
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#d1f7d6',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  successText: {
    fontSize: 15,
    color: '#1b5e20',
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    marginTop: 12,
  },
  startButton: {
    marginTop: 28,
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
