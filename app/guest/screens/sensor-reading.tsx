import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { autoConnectToESP32, readNpkFromESP32, ESP_SSID } from '../../../src/esp32';
import { useData } from '../../../context/DataContext';

/* ===============================
   DA-style LMH classification
   (IDENTICAL to Stakeholder)
   =============================== */

type Nutrient = 'N' | 'P' | 'K';
type LmhText = 'Low' | 'Medium' | 'High' | '—';

function classifyLevel(nutrient: Nutrient, ppm: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  const v = Number(ppm);
  if (!Number.isFinite(v) || v <= 0) return 'LOW';
  const x = Math.round(v);

  if (nutrient === 'N') {
    if (x <= 100) return 'LOW';
    if (x <= 200) return 'MEDIUM';
    return 'HIGH';
  }

  if (nutrient === 'P') {
    if (x <= 110) return 'LOW';
    if (x <= 200) return 'MEDIUM';
    return 'HIGH';
  }

  // K
  if (x <= 117) return 'LOW';
  if (x <= 275) return 'MEDIUM';
  return 'HIGH';
}

function toText(lvl: 'LOW' | 'MEDIUM' | 'HIGH'): LmhText {
  if (lvl === 'LOW') return 'Low';
  if (lvl === 'MEDIUM') return 'Medium';
  return 'High';
}

/* =============================== */

type NpkJson = {
  ok?: boolean;
  ts?: number;
  n?: number;
  p?: number;
  k?: number;
  ph?: number;
  ec?: number;
  error?: string;
};

const TOTAL_STEPS = 10;
const MIN_READING_DURATION_MS = 3000;

function avg(arr: number[]) {
  return arr.length
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    : 0;
}

export default function SensorReadingScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const { setLatestSensorData } = useData();

  const [currentStep, setCurrentStep] = useState(0);
  const [readings, setReadings] = useState<NpkJson[]>([]);
  const [isReadingStep, setIsReadingStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Press Start to begin.');

  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    abortRef.current.cancelled = false;
    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  const readOnce = useCallback(async (): Promise<NpkJson | null> => {
    try {
      const data = await readNpkFromESP32();
      if (data && typeof data === 'object' && 'ok' in data) return data as NpkJson;
      return null;
    } catch {
      return null;
    }
  }, []);

  /* ===============================
     LIVE AVERAGE + LMH SUMMARY
     =============================== */
  const liveSummary = useMemo(() => {
    const Ns = readings.map(r => r.n).filter(x => typeof x === 'number') as number[];
    const Ps = readings.map(r => r.p).filter(x => typeof x === 'number') as number[];
    const Ks = readings.map(r => r.k).filter(x => typeof x === 'number') as number[];
    const pHs = readings.map(r => r.ph).filter(x => typeof x === 'number') as number[];

    const avgN = avg(Ns);
    const avgP = avg(Ps);
    const avgK = avg(Ks);
    const avgPH = avg(pHs);

    return {
      count: readings.length,
      avgN,
      avgP,
      avgK,
      avgPH,
      nText: readings.length ? toText(classifyLevel('N', avgN)) : '—',
      pText: readings.length ? toText(classifyLevel('P', avgP)) : '—',
      kText: readings.length ? toText(classifyLevel('K', avgK)) : '—',
    };
  }, [readings]);

  const processResultsAndNavigate = useCallback(
    async (allReadings: NpkJson[]) => {
      const Ns = allReadings.map(r => r.n).filter(x => typeof x === 'number') as number[];
      const Ps = allReadings.map(r => r.p).filter(x => typeof x === 'number') as number[];
      const Ks = allReadings.map(r => r.k).filter(x => typeof x === 'number') as number[];
      const pHs = allReadings.map(r => r.ph).filter(x => typeof x === 'number') as number[];

      const avgN = avg(Ns);
      const avgP = avg(Ps);
      const avgK = avg(Ks);
      const avgPH = avg(pHs);

      const finalResult = {
        n: avgN,
        p: avgP,
        k: avgK,
        ph: Number.isFinite(avgPH) ? avgPH : undefined,
        timestamp: String(Date.now()),
        farmerId: String(farmerId ?? ''),
        readings: allReadings,
      };

      setLatestSensorData(finalResult);

      router.push({
        pathname: '/guest/screens/recommendation',
        params: {
          farmerId: finalResult.farmerId,
          n: String(avgN),
          p: String(avgP),
          k: String(avgK),
          ph: Number.isFinite(avgPH) ? String(avgPH) : '',
        },
      });
    },
    [farmerId, router, setLatestSensorData]
  );

  const handleReadNextStep = useCallback(async () => {
    if (isReadingStep || currentStep === 0 || currentStep > TOTAL_STEPS) return;

    setIsReadingStep(true);
    setStatusMessage(`Reading spot ${currentStep}/${TOTAL_STEPS}...`);

    const startTime = Date.now();
    const data = await readOnce();

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_READING_DURATION_MS) {
      await new Promise(r => setTimeout(r, MIN_READING_DURATION_MS - elapsed));
    }

    if (!data || typeof data.n !== 'number' || typeof data.p !== 'number' || typeof data.k !== 'number') {
      Alert.alert('Invalid Reading', 'Please retry this spot.');
      setIsReadingStep(false);
      return;
    }

    const newReadings = [...readings, data];
    setReadings(newReadings);

    if (currentStep + 1 > TOTAL_STEPS) {
      processResultsAndNavigate(newReadings);
    } else {
      setCurrentStep(currentStep + 1);
      setStatusMessage(`Spot ${currentStep} OK. Ready for next.`);
    }

    setIsReadingStep(false);
  }, [currentStep, isReadingStep, readings, readOnce, processResultsAndNavigate]);

  const handleStart = async () => {
    setIsReadingStep(true);
    setStatusMessage(`Connecting to ${ESP_SSID}...`);

    try {
      await autoConnectToESP32();
      setCurrentStep(1);
      setStatusMessage('Ready to read spot 1.');
    } catch {
      Alert.alert('Connection Error', 'Could not connect to sensor.');
      setStatusMessage('Connection failed.');
    } finally {
      setIsReadingStep(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../../assets/images/fertisense-logo.png')} style={styles.logo} />

      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert Sensor into Soil</Text>

        {liveSummary.count > 0 && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>
              Current Average ({liveSummary.count}/{TOTAL_STEPS})
            </Text>
            <Text>N: {liveSummary.avgN} ({liveSummary.nText})</Text>
            <Text>P: {liveSummary.avgP} ({liveSummary.pText})</Text>
            <Text>K: {liveSummary.avgK} ({liveSummary.kText})</Text>
            <Text>pH: {Number.isFinite(liveSummary.avgPH) ? liveSummary.avgPH : '-'}</Text>
          </View>
        )}

        <Text style={styles.statusText}>{statusMessage}</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={currentStep === 0 ? handleStart : handleReadNextStep}
          disabled={isReadingStep}
        >
          {isReadingStep ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>
              {currentStep === 0 ? 'Start Reading' : `Read Spot ${currentStep}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', backgroundColor: '#fff' },
  logo: { width: 120, height: 180, resizeMode: 'contain' },
  readingBox: { width: '100%', backgroundColor: '#f1fbf1', padding: 20, borderRadius: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32', textAlign: 'center' },
  summaryBox: { marginVertical: 14, padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  summaryTitle: { fontWeight: 'bold', marginBottom: 6 },
  statusText: { textAlign: 'center', marginVertical: 12 },
  actionButton: {
    backgroundColor: '#2e7d32',
    padding: 14,
    borderRadius: 40,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
