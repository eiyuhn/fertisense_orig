// app/(stakeholder)/screens/sensor-reading.tsx
import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  autoConnectToESP32,
  readNpkFromESP32,
  ESP_SSID,
} from '../../../src/esp32';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';
import { addStandaloneReading } from '../../../src/services';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Levels = {
  n?: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' | string;
  p?: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' | string;
  k?: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' | string;
};

type NpkJson = {
  ok?: boolean;
  ts?: number;
  n?: number;
  p?: number;
  k?: number;
  ph?: number;
  ec?: number;
  n_kg_ha?: number;
  p_kg_ha?: number;
  k_kg_ha?: number;
  error?: string;
  levels?: Levels; // optional if ESP32 sends it
};

const TOTAL_STEPS = 10;
const MIN_READING_DURATION_MS = 3500; // 3.5 s

type Nutrient = 'N' | 'P' | 'K';

// ✅ DA-style thresholds (sensor-based interpretation)
const classifyLevel = (
  nutrient: Nutrient,
  v?: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'N/A';

  const ppm = Math.round(v);

  // if sensor returns 0 (common when not inserted / error), show N/A (or LOW if you want)
  if (ppm <= 0) return 'N/A';

  if (nutrient === 'N') {
    if (ppm <= 100) return 'LOW';
    if (ppm <= 200) return 'MEDIUM';
    return 'HIGH'; // >= 201
  }

  if (nutrient === 'P') {
    if (ppm <= 110) return 'LOW';
    if (ppm <= 200) return 'MEDIUM';
    return 'HIGH'; // >= 201
  }

  // nutrient === 'K'
  if (ppm <= 117) return 'LOW';
  if (ppm <= 275) return 'MEDIUM';
  return 'HIGH'; // >= 276
};

export default function SensorReadingScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const { setLatestSensorData } = useData();
  const { token, user } = useAuth();
  const { setFromParams } = useReadingSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [readings, setReadings] = useState<NpkJson[]>([]);
  const [isReadingStep, setIsReadingStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Pislita ang Start para magsugod.');

  const [spotResult, setSpotResult] = useState<NpkJson | null>(null);
  const [spotIndex, setSpotIndex] = useState<number | null>(null);

  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    setCurrentStep(0);
    setReadings([]);
    setIsReadingStep(false);
    setStatusMessage('Pislita ang Start para magsugod.');
    setSpotResult(null);
    setSpotIndex(null);
    abortRef.current.cancelled = false;

    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  const readOnce = useCallback(async (): Promise<NpkJson | null> => {
    try {
      console.log('[SensorReading] calling readNpkFromESP32()...');
      const data = await readNpkFromESP32();
      console.log('[SensorReading] raw ESP32 data:', data);

      if (!data || typeof data !== 'object') {
        Alert.alert(
          'Dili Sakto ang Tubag',
          'Ang ESP32 naghatag ug dili sakto nga tubag (dili siya JSON object).'
        );
        return null;
      }

      if ((data as any).ok === false) {
        const errMsg =
          (data as any).error || 'Ang ESP32 nitubag ug ok=false (naay problema sa sensor).';
        Alert.alert('Error sa Sensor', errMsg);
        return null;
      }

      const { n, p, k } = data as any;
      if (typeof n !== 'number' || typeof p !== 'number' || typeof k !== 'number') {
        Alert.alert('Dili Sakto ang Data', 'Wala nibalik ug numero nga NPK values ang ESP32.');
        return null;
      }

      return data as NpkJson;
    } catch (e: any) {
      console.error('[SensorReading] readOnce error:', e);
      Alert.alert(
        'Error sa Pagbasa',
        e?.message || 'Dili mabasa gikan sa ESP32 (network o sensor error).'
      );
      return null;
    }
  }, []);

  const processResultsAndNavigate = useCallback(
    async (allReadings: NpkJson[]) => {
      if (abortRef.current.cancelled) return;
      setCurrentStep(TOTAL_STEPS + 1);
      setStatusMessage('Gikuwenta ang average...');

      const Ns = allReadings.map((r) => r.n).filter((n) => typeof n === 'number') as number[];
      const Ps = allReadings.map((r) => r.p).filter((n) => typeof n === 'number') as number[];
      const Ks = allReadings.map((r) => r.k).filter((n) => typeof n === 'number') as number[];
      const pHs = allReadings.map((r) => r.ph).filter((n) => typeof n === 'number') as number[];

      const avg = (arr: number[]) =>
        arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

      const avgN = avg(Ns);
      const avgP = avg(Ps);
      const avgK = avg(Ks);
      const avgPHRaw = avg(pHs);
      const avgPH = Number.isFinite(avgPHRaw) ? avgPHRaw : NaN;

      const tsNum = Date.now();

      const finalResult = {
        n: avgN,
        p: avgP,
        k: avgK,
        ph: Number.isFinite(avgPH) ? avgPH : undefined,
        timestamp: String(tsNum),
        farmerId: String(farmerId ?? ''),
        readings: allReadings,
      };

      setLatestSensorData(finalResult);

      try {
        if (user?._id) {
          const key = `stakeholder:lastReading:${user._id}`;
          const payload = {
            timestamp: tsNum,
            n: avgN,
            p: avgP,
            k: avgK,
            ph: Number.isFinite(avgPH) ? avgPH : undefined,
          };
          await AsyncStorage.setItem(key, JSON.stringify(payload));
        }
      } catch (e) {
        console.warn('[SensorReading] failed to cache stakeholder last reading:', e);
      }

      try {
        await setFromParams({
          n: avgN,
          p: avgP,
          k: avgK,
          ph: Number.isFinite(avgPH) ? avgPH : undefined,
          farmerId: typeof farmerId === 'string' ? farmerId : undefined,
          ts: tsNum,
        });
      } catch (e) {
        console.warn('[SensorReading] failed to set reading session:', e);
      }

      try {
        if (token) {
          await addStandaloneReading(
            {
              N: avgN,
              P: avgP,
              K: avgK,
              ph: Number.isFinite(avgPH) ? avgPH : undefined,
              source: 'esp32',
            },
            token
          );
        }
      } catch (e) {
        console.warn('[SensorReading] failed to push standalone reading:', e);
      }

      await new Promise((r) => setTimeout(r, 1000));
      if (abortRef.current.cancelled) return;

      router.push({
        pathname: '/(stakeholder)/screens/reconnect-prompt',
        params: {
          farmerId: finalResult.farmerId,
          n: String(avgN),
          p: String(avgP),
          k: String(avgK),
          ph: Number.isFinite(avgPH) ? String(avgPH) : '',
        },
      });
    },
    [farmerId, router, setFromParams, setLatestSensorData, token, user?._id]
  );

  const handleReadNextStep = useCallback(async () => {
    if (isReadingStep || currentStep > TOTAL_STEPS || currentStep === 0) return;
    if (abortRef.current.cancelled) return;

    setSpotResult(null);
    setSpotIndex(null);

    setIsReadingStep(true);
    const stepToRead = currentStep;
    const startTime = Date.now();
    setStatusMessage(`${stepToRead}/${TOTAL_STEPS} - Nagbasa sa yuta...`);

    let data: NpkJson | null = null;
    for (let attempt = 1; attempt <= 2 && !data; attempt++) {
      if (abortRef.current.cancelled) {
        setIsReadingStep(false);
        return;
      }
      data = await readOnce();
      if (!data) await new Promise((r) => setTimeout(r, 600));
    }

    if (abortRef.current.cancelled) {
      setIsReadingStep(false);
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_READING_DURATION_MS) {
      await new Promise((r) => setTimeout(r, MIN_READING_DURATION_MS - elapsed));
      if (abortRef.current.cancelled) {
        setIsReadingStep(false);
        return;
      }
    }

    if (!data) {
      setIsReadingStep(false);
      setStatusMessage(`Napakyas ang pagbasa sa ${stepToRead}. Pislita para mosulay balik.`);
      Alert.alert(
        'Walay nabasang data',
        'Wala mi nakakuha ug reading. Duola ang phone ug sulayi pag-usab.'
      );
      return;
    }

    if (typeof data.n !== 'number' || typeof data.p !== 'number' || typeof data.k !== 'number') {
      setIsReadingStep(false);
      setStatusMessage(`Dili sakto ang data sa ${stepToRead}. Pislita para mosulay balik.`);
      Alert.alert('Dili Sakto ang Data', `Kulangan ang NPK sa spot ${stepToRead}.`);
      return;
    }

    setSpotResult(data);
    setSpotIndex(stepToRead);

    const newReadings = [...readings, data];
    setReadings(newReadings);

    const nextStep = stepToRead + 1;
    if (nextStep > TOTAL_STEPS) {
      setIsReadingStep(false);
      processResultsAndNavigate(newReadings);
    } else {
      setCurrentStep(nextStep);
      setStatusMessage(
        `OK ang pagbasa ${stepToRead}/${TOTAL_STEPS}. Pinduta para sa spot ${nextStep}.`
      );
      setIsReadingStep(false);
    }
  }, [currentStep, isReadingStep, readOnce, readings, processResultsAndNavigate]);

  const handleStart = async () => {
    if (currentStep !== 0 || isReadingStep) return;
    setIsReadingStep(true);
    setStatusMessage(`Gitan-aw ang koneksyon sa ${ESP_SSID}...`);
    try {
      await autoConnectToESP32();
      if (abortRef.current.cancelled) return;
      setCurrentStep(1);
      setStatusMessage(`Andam na para mobasa sa spot 1/${TOTAL_STEPS}. Pislita ang button.`);
    } catch (err: any) {
      if (abortRef.current.cancelled) return;
      Alert.alert('Error sa Koneksyon', err.message || `Dili makakonek.`);
      setStatusMessage('Nawala ang koneksyon. Sulayi ug Start pag-usab.');
    } finally {
      if (!abortRef.current.cancelled) setIsReadingStep(false);
    }
  };

  const displayedStep =
    currentStep === 0 ? 0 : currentStep > TOTAL_STEPS ? TOTAL_STEPS : currentStep;

  const fmtPh = (v: any) => {
    if (v === null || v === undefined) return '0.00';
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };

  const spotLevelN = spotResult?.levels?.n ?? classifyLevel('N', spotResult?.n);
  const spotLevelP = spotResult?.levels?.p ?? classifyLevel('P', spotResult?.p);
  const spotLevelK = spotResult?.levels?.k ?? classifyLevel('K', spotResult?.k);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../../assets/images/fertisense-logo.png')}
          style={styles.logo}
        />

        <View style={styles.readingBox}>
          <Text style={styles.title}>Itusok ang Sensor sa Yuta</Text>
          <Text style={styles.engSub}>
            Kuhaa ang {TOTAL_STEPS} ka readings. Pinduta ang button kada spot.
          </Text>
          

          <View style={styles.statusDisplay}>
            <View style={styles.progressCircle}>
              <View style={styles.progressInner}>
                {isReadingStep ? (
                  <ActivityIndicator
                    size="small"
                    color="#2e7d32"
                    style={styles.circleSpinner}
                  />
                ) : (
                  <Ionicons
                    name="leaf-outline"
                    size={24}
                    color="#2e7d32"
                    style={styles.circleSpinner}
                  />
                )}
                <Text style={styles.progressLabel}>Spot</Text>
                <Text style={styles.progressStep}>
                  {displayedStep} / {TOTAL_STEPS}
                </Text>
              </View>
            </View>

            <Text style={styles.statusText}>{statusMessage}</Text>

            {spotResult && spotIndex !== null && (
              <View style={styles.spotResultBox}>
                <Text style={styles.spotResultTitle}>Resulta sa Spot {spotIndex}</Text>

                <Text style={styles.spotResultLine}>Nitrogen (N): {String(spotLevelN)}</Text>
                <Text style={styles.spotResultLine}>Posporus (P): {String(spotLevelP)}</Text>
                <Text style={styles.spotResultLine}>Potassium (K): {String(spotLevelK)}</Text>

                <Text style={styles.spotResultLine}>💧 pH: {fmtPh(spotResult.ph)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {currentStep === 0 && (
            <TouchableOpacity
              style={[styles.actionButton, isReadingStep && styles.disabledButton]}
              onPress={handleStart}
              disabled={isReadingStep}
            >
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={isReadingStep ? '#eee' : '#fff'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  isReadingStep && styles.disabledButtonText,
                ]}
              >
                {isReadingStep ? 'Gisusi...' : 'Sugdi ang Pagbasa'}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep > 0 && currentStep <= TOTAL_STEPS && (
            <TouchableOpacity
              style={[styles.actionButton, isReadingStep && styles.disabledButton]}
              onPress={handleReadNextStep}
              disabled={isReadingStep}
            >
              <Ionicons
                name="radio-button-on-outline"
                size={22}
                color={isReadingStep ? '#eee' : '#fff'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  isReadingStep && styles.disabledButtonText,
                ]}
              >
                {isReadingStep
                  ? `Nagbasa sa Spot ${currentStep}...`
                  : `Basaha ang Spot ${currentStep}/${TOTAL_STEPS}`}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep > TOTAL_STEPS && (
            <TouchableOpacity style={[styles.actionButton, styles.disabledButton]} disabled>
              <ActivityIndicator size="small" color="#eee" style={{ marginRight: 10 }} />
              <Text style={[styles.actionButtonText, styles.disabledButtonText]}>
                Ginaproseso...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: '#ffffffff',
  },
  logo: { width: 120, height: 200, resizeMode: 'contain', marginBottom: -10 },

  readingBox: {
    backgroundColor: '#f1fbf1',
    padding: 26,
    borderRadius: 18,
    width: '100%',
    elevation: 5,
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 12,
  },
  engSub: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 6 },
  tagalogSub: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },

  statusDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },

  progressCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    borderColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  progressInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e9f7ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSpinner: {
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  progressStep: {
    fontSize: 18,
    color: '#1b5e20',
    fontWeight: '800',
    marginTop: 2,
  },

  statusText: {
    fontSize: 16,
    color: '#2e7d32',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
  },

  spotResultBox: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cde9cf',
    width: '90%',
  },
  spotResultTitle: {
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 4,
    textAlign: 'center',
  },
  spotResultLine: {
    fontSize: 14,
    color: '#1b5e20',
    marginTop: 2,
  },

  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    minWidth: 250,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: { backgroundColor: '#a5d6a7', elevation: 1 },
  disabledButtonText: { color: '#eee' },
});
