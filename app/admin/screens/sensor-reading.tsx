// app/(admin)/screens/sensor-reading.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Production imports (same as stakeholder) ---
import {
  autoConnectToESP32,
  readNpkFromESP32,
  ESP_SSID,
} from '../../../src/esp32';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { listFarmers } from '../../../src/services';

type Farmer = { _id: string; name: string };

type Levels = {
  n?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  p?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  k?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
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
  levels?: Levels;
};

const TOTAL_STEPS = 10;
const MIN_READING_DURATION_MS = 3500;

// ✅ Same thresholds as stakeholder screen
const classifyLevel = (v?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'N/A';
  if (v <= 117) return 'LOW';
  if (v <= 235) return 'MEDIUM';
  return 'HIGH';
};

export default function AdminSensorReadingScreen() {
  const router = useRouter();

  // 👇 Accept BOTH `farmerName` and `name` (for safety)
  const {
    farmerId: paramFarmerId,
    farmerName: paramFarmerName,
    name: paramName,
  } = useLocalSearchParams<{
    farmerId?: string;
    farmerName?: string;
    name?: string;
  }>();

  const initialFarmerId = paramFarmerId ?? '';
  const initialFarmerName =
    (paramFarmerName as string) || (paramName as string) || '';

  const { setLatestSensorData } = useData();
  const { token } = useAuth();

  // ---------- Farmer selection ----------
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [filter, setFilter] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selectedFarmerId, setSelectedFarmerId] =
    useState<string>(initialFarmerId);
  const [selectedFarmerName, setSelectedFarmerName] =
    useState<string>(initialFarmerName);

  const loadFarmers = useCallback(
    async () => {
      try {
        const data = await listFarmers(token);
        const list = (Array.isArray(data) ? data : []) as Farmer[];
        setFarmers(list);

        // If we have an ID but no name yet, try to resolve name from the list
        if (initialFarmerId && !selectedFarmerName) {
          const f = list.find((x) => x._id === initialFarmerId);
          if (f) {
            setSelectedFarmerId(f._id);
            setSelectedFarmerName(f.name);
          }
        }
      } catch (e) {
        console.error('listFarmers error:', e);
        Alert.alert(
          'Cannot load farmers',
          'Farmers could not be loaded from the server. ' +
            'If you are connected to the ESP32 Wi-Fi, go back to Home and select a farmer while online.'
        );
      }
    },
    [token, initialFarmerId, selectedFarmerName]
  );

  // ⛔ Only auto-load when we don't already have a preselected farmerId.
  useEffect(() => {
    if (!initialFarmerId) {
      loadFarmers();
    }
  }, [loadFarmers, initialFarmerId]);

  const filteredFarmers = farmers.filter((f) =>
    f.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  const chooseFarmer = (f: Farmer) => {
    setSelectedFarmerId(f._id);
    setSelectedFarmerName(f.name);
    setPickerOpen(false);
  };

  // Lazy-load farmers when opening picker
  const handleOpenFarmerPicker = async () => {
    if (farmers.length === 0) {
      await loadFarmers();
    }
    setPickerOpen(true);
  };

  // ---------- Reading state ----------
  const [currentStep, setCurrentStep] = useState(0);
  const [readings, setReadings] = useState<NpkJson[]>([]);
  const [isReadingStep, setIsReadingStep] = useState(false);
  const [statusMessage, setStatusMessage] =
    useState<string>('Select a farmer to begin.');
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  // 👇 Spot result (like stakeholder, but admin)
  const [spotResult, setSpotResult] = useState<NpkJson | null>(null);
  const [spotIndex, setSpotIndex] = useState<number | null>(null);

  const abortRef = useRef<{ cancelled: boolean }>({
    cancelled: false,
  });

  useEffect(() => {
    setCurrentStep(0);
    setReadings([]);
    setIsReadingStep(false);
    setStatusMessage('Select a farmer to begin.');
    setIsInitialLoad(false);
    setSpotResult(null);
    setSpotIndex(null);
    abortRef.current.cancelled = false;
    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  // Small helpers to format display like stakeholder
  const fmt = (v: any) => {
    if (v === null || v === undefined) return '0';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '0';
  };
  const fmtPh = (v: any) => {
    if (v === null || v === undefined) return '0.00';
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };

  const spotLevelN = spotResult?.levels?.n ?? classifyLevel(spotResult?.n);
  const spotLevelP = spotResult?.levels?.p ?? classifyLevel(spotResult?.p);
  const spotLevelK = spotResult?.levels?.k ?? classifyLevel(spotResult?.k);

  // ---------- ESP32 read helpers ----------
  const readOnce = useCallback(async (): Promise<NpkJson | null> => {
    try {
      const data = await readNpkFromESP32();
      if (!data || typeof data !== 'object') {
        console.warn('readOnce received invalid data:', data);
        return null;
      }
      if ((data as any).ok === false) {
        console.warn('ESP32 responded with ok=false:', data);
        return data as NpkJson;
      }
      return data as NpkJson;
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

      const Ns = allReadings
        .map((r) => r.n)
        .filter((n) => typeof n === 'number') as number[];
      const Ps = allReadings
        .map((r) => r.p)
        .filter((p) => typeof p === 'number') as number[];
      const Ks = allReadings
        .map((r) => r.k)
        .filter((k) => typeof k === 'number') as number[];
      const pHs = allReadings
        .map((r) => r.ph)
        .filter((ph) => typeof ph === 'number') as number[];

      const avg = (arr: number[]) =>
        arr.length
          ? Math.round(
              (arr.reduce((a, b) => a + b, 0) / arr.length) * 10
            ) / 10
          : 0;

      const avgN = avg(Ns);
      const avgP = avg(Ps);
      const avgK = avg(Ks);
      const avgPH =
        Math.round((avg(pHs) + Number.EPSILON) * 10) / 10;

      const finalResult = {
        n: avgN,
        p: avgP,
        k: avgK,
        ph: Number.isFinite(avgPH) ? avgPH : undefined,
        timestamp: String(Date.now()),
        farmerId: selectedFarmerId,
        farmerName: selectedFarmerName,
        readings: allReadings,
      };

      setLatestSensorData(finalResult);

      await new Promise((r) => setTimeout(r, 900));
      if (abortRef.current.cancelled) return;

      router.push({
        pathname: '/admin/screens/reconnect-prompt',
        params: {
          farmerId: finalResult.farmerId,
          name: finalResult.farmerName ?? '',
          n: String(avgN),
          p: String(avgP),
          k: String(avgK),
          ph: String(avgPH),
        },
      });
    },
    [
      router,
      selectedFarmerId,
      selectedFarmerName,
      setLatestSensorData,
    ]
  );

  const handleReadNextStep = useCallback(
    async () => {
      if (!selectedFarmerId) {
        Alert.alert(
          'Select Farmer',
          'Please choose a farmer before reading.'
        );
        return;
      }
      if (
        isReadingStep ||
        currentStep > TOTAL_STEPS ||
        currentStep === 0
      )
        return;
      if (abortRef.current.cancelled) return;

      setIsReadingStep(true);
      const stepToRead = currentStep;

      // Clear previous spot result when starting a new read
      setSpotResult(null);
      setSpotIndex(null);

      setStatusMessage(
        `📍 ${stepToRead}/${TOTAL_STEPS} - Reading soil...`
      );

      const startTime = Date.now();

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

      // Enforce minimum reading duration (same as stakeholder)
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_READING_DURATION_MS) {
        await new Promise((r) =>
          setTimeout(r, MIN_READING_DURATION_MS - elapsed)
        );
        if (abortRef.current.cancelled) {
          setIsReadingStep(false);
          return;
        }
      }

      if (!data) {
        setIsReadingStep(false);
        setStatusMessage(
          `Failed read ${stepToRead}. Press button to try again.`
        );
        Alert.alert('No Data', 'Walang nabasang data. Subukan ulit.');
        return;
      }
      if (
        typeof data.n !== 'number' ||
        typeof data.p !== 'number' ||
        typeof data.k !== 'number'
      ) {
        setIsReadingStep(false);
        setStatusMessage(
          `Invalid data ${stepToRead}. Press button to try again.`
        );
        Alert.alert(
          'Invalid Data',
          `Incomplete NPK at spot ${stepToRead}.`
        );
        return;
      }

      // Save spot result + index for display (like stakeholder)
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
          `Read ${stepToRead}/${TOTAL_STEPS} OK. Press for spot ${nextStep}.`
        );
        setIsReadingStep(false);
      }
    },
    [
      selectedFarmerId,
      isReadingStep,
      currentStep,
      readOnce,
      readings,
      processResultsAndNavigate,
    ]
  );

  const handleStart = async () => {
    if (!selectedFarmerId) {
      Alert.alert(
        'Select Farmer',
        'Please choose a farmer to continue.'
      );
      return;
    }
    if (currentStep !== 0 || isReadingStep || isInitialLoad) return;

    setIsReadingStep(true);
    setIsInitialLoad(true);
    setStatusMessage(`Checking connection to ${ESP_SSID}...`);

    try {
      await autoConnectToESP32();
      if (abortRef.current.cancelled) return;

      setStatusMessage('Preparing sensor, please wait...');
      await new Promise((r) => setTimeout(r, 3200));
      if (abortRef.current.cancelled) return;

      setCurrentStep(1);
      setStatusMessage(
        `Ready to read spot 1/${TOTAL_STEPS}. Press button.`
      );
    } catch (err: any) {
      if (abortRef.current.cancelled) return;
      Alert.alert(
        'Connection Error',
        err?.message || 'Could not connect.'
      );
      setStatusMessage('Connection failed. Try Start again.');
    } finally {
      if (!abortRef.current.cancelled) {
        setIsReadingStep(false);
        setIsInitialLoad(false);
      }
    }
  };

  const displayedStep =
    currentStep === 0
      ? 0
      : currentStep > TOTAL_STEPS
      ? TOTAL_STEPS
      : currentStep;

  // ---------- UI ----------
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../../assets/images/fertisense-logo.png')}
          style={styles.logo}
        />

        {/* Farmer info */}
        <View style={styles.selectorBox}>
          <Text style={styles.selectorLabel}>Reading for</Text>
          <View style={styles.selectorRow}>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedFarmerName || '— none —'}
            </Text>

            {!selectedFarmerId && (
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={handleOpenFarmerPicker}
              >
                <Ionicons
                  name="people-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.selectorBtnText}>Choose</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Reading box – now very close to stakeholder design */}
        <View style={styles.readingBox}>
          <Text style={styles.title}>Insert Sensor into Soil</Text>
          <Text style={styles.engSub}>
            Take {TOTAL_STEPS} readings. Press the button for each
            spot.
          </Text>
          <Text style={styles.tagalogSub}>
            Kumuha ng {TOTAL_STEPS} readings. Pindutin ang button
            kada spot.
          </Text>

          <View style={styles.statusDisplay}>
            <View style={styles.progressCircle}>
              <View style={styles.progressInner}>
                {isReadingStep || isInitialLoad ? (
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

            {/* 👇 Spot result + LOW/MEDIUM/HIGH like stakeholder */}
            {spotResult && spotIndex !== null && (
              <View style={styles.spotResultBox}>
                <Text style={styles.spotResultTitle}>
                  Result for Spot {spotIndex}
                </Text>
                <Text style={styles.spotResultLine}>
                  🌿 Nitrogen N: {fmt(spotResult.n)}
                </Text>
                <Text style={styles.spotResultLine}>
                  🌱 Phosporus P: {fmt(spotResult.p)}
                </Text>
                <Text style={styles.spotResultLine}>
                  🥬 Potassium K: {fmt(spotResult.k)}
                </Text>
                <Text style={styles.spotResultLine}>
                  💧 pH: {fmtPh(spotResult.ph)}
                </Text>
                <Text style={styles.spotResultLine}>
                  📊 Level – N: {spotLevelN}   P: {spotLevelP}   K:{' '}
                  {spotLevelK}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {currentStep === 0 && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                (isReadingStep || isInitialLoad) &&
                  styles.disabledButton,
              ]}
              onPress={handleStart}
              disabled={isReadingStep || isInitialLoad}
            >
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={
                  isReadingStep || isInitialLoad ? '#eee' : '#fff'
                }
              />
              <Text
                style={[
                  styles.actionButtonText,
                  (isReadingStep || isInitialLoad) &&
                    styles.disabledButtonText,
                ]}
              >
                {isReadingStep || isInitialLoad
                  ? 'Connecting...'
                  : 'Start Reading'}
              </Text>
            </TouchableOpacity>
          )}

          {currentStep > 0 && currentStep <= TOTAL_STEPS && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                isReadingStep && styles.disabledButton,
              ]}
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
              style={[
                styles.actionButton,
                styles.disabledButton,
              ]}
              disabled
            >
              <ActivityIndicator
                size="small"
                color="#eee"
                style={{ marginRight: 10 }}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  styles.disabledButtonText,
                ]}
              >
                Processing...
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Farmer Picker Modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a Farmer</Text>
            <TextInput
              placeholder="Search name..."
              placeholderTextColor="#888"
              style={styles.searchInput}
              value={filter}
              onChangeText={setFilter}
            />
            <FlatList
              data={filteredFarmers}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.farmerRow}
                  onPress={() => chooseFarmer(item)}
                >
                  <Text style={styles.farmerName}>
                    {item.name}
                  </Text>
                  <Text style={styles.farmerId}>
                    {item._id}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: 'center',
                    color: '#666',
                    paddingVertical: 16,
                  }}
                >
                  No matches
                </Text>
              }
            />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setPickerOpen(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    width: 180,
    height: 180,
    resizeMode: 'contain',
    marginBottom: -4,
  },

  selectorBox: {
    width: '100%',
    backgroundColor: '#eef7ee',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  selectorLabel: {
    color: '#2e7d32',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 14,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorValue: {
    color: '#333',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  selectorBtn: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorBtnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },

  readingBox: {
    backgroundColor: '#f1fbf1',
    padding: 24,
    borderRadius: 18,
    width: '100%',
    elevation: 3,
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 12,
  },
  engSub: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 6,
  },
  tagalogSub: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 18,
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

  // Spot result like stakeholder
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
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
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
  disabledButton: {
    backgroundColor: '#a5d6a7',
    elevation: 1,
  },
  disabledButtonText: {
    color: '#eee',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#2e7d32',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    color: '#222',
  },
  farmerRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  farmerName: { color: '#222', fontWeight: '600' },
  farmerId: { color: '#666', fontSize: 12 },
  closeBtn: {
    marginTop: 12,
    backgroundColor: '#e8f5e9',
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: {
    textAlign: 'center',
    color: '#2e7d32',
    fontWeight: '700',
  },
});
