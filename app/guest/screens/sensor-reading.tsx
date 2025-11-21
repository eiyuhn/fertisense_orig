import React, { useEffect, useCallback, useRef, useState } from 'react';
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
import { useAuth } from '../../../context/AuthContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';

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
};

const TOTAL_STEPS = 10;
// 🔁 minimum time for each spot reading so spinner does a “full circle”
const MIN_READING_DURATION_MS = 3000;

export default function SensorReadingScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const { setLatestSensorData } = useData();
  const { token } = useAuth(); // reserved if needed later
  const { setFromParams } = useReadingSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [readings, setReadings] = useState<NpkJson[]>([]);
  const [isReadingStep, setIsReadingStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Press Start to begin.');

  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    setCurrentStep(0);
    setReadings([]);
    setIsReadingStep(false);
    setStatusMessage('Press Start to begin.');
    abortRef.current.cancelled = false;
    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  const readOnce = useCallback(async (): Promise<NpkJson | null> => {
    try {
      const data = await readNpkFromESP32();
      if (data && typeof data === 'object' && 'ok' in data) {
        return data as NpkJson;
      }
      console.warn('readOnce received invalid data:', data);
      return null;
    } catch (e: any) {
      console.error('Error in readOnce:', e);
      return null;
    }
  }, []);

  const processResultsAndNavigate = useCallback(
    async (allReadings: NpkJson[]) => {
      if (abortRef.current.cancelled) return;
      setCurrentStep(TOTAL_STEPS + 1);
      setStatusMessage('Calculating average...');

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

      const finalResult = {
        n: avgN,
        p: avgP,
        k: avgK,
        ph: Number.isFinite(avgPH) ? avgPH : undefined,
        timestamp: String(Date.now()),
        farmerId: String(farmerId ?? ''),
        readings: allReadings,
      };

      // store in DataContext
      setLatestSensorData(finalResult);

      // also push into ReadingSessionContext (for recommendation screen)
      try {
        await setFromParams({
          n: avgN,
          p: avgP,
          k: avgK,
          ph: Number.isFinite(avgPH) ? avgPH : undefined,
          farmerId: typeof farmerId === 'string' ? farmerId : undefined,
          ts: Date.now(),
        });
      } catch (e) {
        console.warn('[SensorReading] failed to set reading session:', e);
      }

      await new Promise((r) => setTimeout(r, 1000));
      if (abortRef.current.cancelled) return;

      router.push({
        pathname: '/guest/screens/reconnect-prompt',
        params: {
          farmerId: finalResult.farmerId,
          n: String(avgN),
          p: String(avgP),
          k: String(avgK),
          ph: Number.isFinite(avgPH) ? String(avgPH) : '',
        },
      });
    },
    [farmerId, router, setFromParams, setLatestSensorData]
  );

  const handleReadNextStep = useCallback(
    async () => {
      if (isReadingStep || currentStep > TOTAL_STEPS || currentStep === 0) return;
      if (abortRef.current.cancelled) return;

      setIsReadingStep(true);
      const stepToRead = currentStep;
      const startTime = Date.now(); // ⏱ start timer for minimum duration
      setStatusMessage(`${stepToRead}/${TOTAL_STEPS} - Reading soil...`);

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

      // 🔁 ensure spinner runs at least MIN_READING_DURATION_MS
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
        setStatusMessage(`Failed read ${stepToRead}. Press button to try again.`);
        Alert.alert(
          'Walang nabasang data',
          'Hindi nakakuha ng reading. Subukan ilapit ang phone at ulitin.'
        );
        return;
      }
      if (typeof data.n !== 'number' || typeof data.p !== 'number' || typeof data.k !== 'number') {
        setIsReadingStep(false);
        setStatusMessage(`Invalid data ${stepToRead}. Press button to try again.`);
        Alert.alert('Invalid Data', `Incomplete NPK at spot ${stepToRead}.`);
        return;
      }

      const newReadings = [...readings, data];
      setReadings(newReadings);
      const nextStep = stepToRead + 1;

      if (nextStep > TOTAL_STEPS) {
        setIsReadingStep(false);
        processResultsAndNavigate(newReadings);
      } else {
        setCurrentStep(nextStep);
        setStatusMessage(`Read ${stepToRead}/${TOTAL_STEPS} OK. Press for spot ${nextStep}.`);
        setIsReadingStep(false);
      }
    },
    [currentStep, isReadingStep, readOnce, readings, processResultsAndNavigate]
  );

  const handleStart = async () => {
    if (currentStep !== 0 || isReadingStep) return;
    setIsReadingStep(true);
    setStatusMessage(`Checking connection to ${ESP_SSID}...`);
    try {
      await autoConnectToESP32();
      if (abortRef.current.cancelled) return;
      setCurrentStep(1);
      setStatusMessage(`Ready to read spot 1/${TOTAL_STEPS}. Press button.`);
    } catch (err: any) {
      if (abortRef.current.cancelled) return;
      Alert.alert('Connection Error', err.message || `Could not connect.`);
      setStatusMessage('Connection failed. Try Start again.');
    } finally {
      if (!abortRef.current.cancelled) {
        setIsReadingStep(false);
      }
    }
  };

  const displayedStep =
    currentStep === 0
      ? 0
      : currentStep > TOTAL_STEPS
      ? TOTAL_STEPS
      : currentStep;

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
      />
      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert Sensor into Soil</Text>
        <Text style={styles.engSub}>
          Take {TOTAL_STEPS} readings. Press button for each spot.
        </Text>
        <Text style={styles.tagalogSub}>
          Kumuha ng {TOTAL_STEPS} readings. Pindutin ang button kada spot.
        </Text>

        {/* BIG CIRCULAR LOADER */}
        <View style={styles.statusDisplay}>
          <View style={styles.progressCircle}>
            <View style={styles.progressInner}>
              {isReadingStep ? (
                <ActivityIndicator size="small" color="#2e7d32" style={styles.circleSpinner} />
              ) : (
                <Ionicons name="leaf-outline" size={24} color="#2e7d32" style={styles.circleSpinner} />
              )}
              <Text style={styles.progressLabel}>Spot</Text>
              <Text style={styles.progressStep}>
                {displayedStep} / {TOTAL_STEPS}
              </Text>
            </View>
          </View>

          <Text style={styles.statusText}>{statusMessage}</Text>
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
              {isReadingStep ? 'Checking...' : 'Start Reading'}
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
                ? `Reading Spot ${currentStep}...`
                : `Read Spot ${currentStep}/${TOTAL_STEPS}`}
            </Text>
          </TouchableOpacity>
        )}

        {currentStep > TOTAL_STEPS && (
          <TouchableOpacity
            style={[styles.actionButton, styles.disabledButton]}
            disabled
          >
            <ActivityIndicator
              size="small"
              color="#eee"
              style={{ marginRight: 10 }}
            />
            <Text style={[styles.actionButtonText, styles.disabledButtonText]}>
              Processing...
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  logo: { width: 200, height: 200, resizeMode: 'contain', marginBottom: -10 },

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

  // big circle
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

  buttonContainer: {},
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
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  disabledButton: { backgroundColor: '#a5d6a7', elevation: 1 },
  disabledButtonText: { color: '#eee' },
});
