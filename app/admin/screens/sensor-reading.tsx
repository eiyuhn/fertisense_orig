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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

// --- Production imports (same as stakeholder) ---
import {
  autoConnectToESP32,
  readNpkFromESP32,
  ESP_SSID,
} from '../../../src/esp32';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { listFarmers } from '../../../src/services';  // ✅ use listFarmers

type Farmer = { _id: string; name: string };

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

export default function AdminSensorReadingScreen() {
  const router = useRouter();
  const { farmerId: paramFarmerId } =
    useLocalSearchParams<{ farmerId?: string }>();

  const { setLatestSensorData } = useData();
  const { token } = useAuth();

  // ---------- Farmer selection ----------
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [filter, setFilter] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [selectedFarmerId, setSelectedFarmerId] = useState<string>(
    paramFarmerId ?? ''
  );
  const [selectedFarmerName, setSelectedFarmerName] =
    useState<string>('');

  const loadFarmers = useCallback(async () => {
    try {
      const data = await listFarmers(token); // ✅ use existing service
      const list = (Array.isArray(data)
        ? data
        : []) as Farmer[];

      setFarmers(list);

      if (paramFarmerId) {
        const f = list.find((x) => x._id === paramFarmerId);
        if (f) setSelectedFarmerName(f.name);
      }
    } catch (e) {
      console.error('listFarmers error:', e);
      Alert.alert(
        'Error',
        'Could not load farmers from the server.'
      );
    }
  }, [token, paramFarmerId]);

  useEffect(() => {
    loadFarmers();
  }, [loadFarmers]);

  const filteredFarmers = farmers.filter((f) =>
    f.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  const chooseFarmer = (f: Farmer) => {
    setSelectedFarmerId(f._id);
    setSelectedFarmerName(f.name);
    setPickerOpen(false);
  };

  // ---------- Reading state ----------
  const [currentStep, setCurrentStep] = useState(0);
  const [readings, setReadings] = useState<NpkJson[]>([]);
  const [isReadingStep, setIsReadingStep] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Select a farmer to begin.'
  );

  const abortRef = useRef<{ cancelled: boolean }>({
    cancelled: false,
  });

  useEffect(() => {
    setCurrentStep(0);
    setReadings([]);
    setIsReadingStep(false);
    setStatusMessage('Select a farmer to begin.');
    abortRef.current.cancelled = false;
    return () => {
      abortRef.current.cancelled = true;
    };
  }, []);

  // ---------- ESP32 read helpers ----------
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

      // save in context before switching Wi-Fi
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

  const handleReadNextStep = useCallback(async () => {
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
    setStatusMessage(
      `📍 ${stepToRead}/${TOTAL_STEPS} - Reading soil...`
    );

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

    if (!data) {
      setIsReadingStep(false);
      setStatusMessage(
        `Failed read ${stepToRead}. Press button to try again.`
      );
      Alert.alert(
        'No Data',
        'Walang nabasang data. Subukan ulit.'
      );
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
  }, [
    selectedFarmerId,
    isReadingStep,
    currentStep,
    readOnce,
    readings,
    processResultsAndNavigate,
  ]);

  const handleStart = async () => {
    if (!selectedFarmerId) {
      Alert.alert(
        'Select Farmer',
        'Please choose a farmer to continue.'
      );
      return;
    }
    if (currentStep !== 0 || isReadingStep) return;

    setIsReadingStep(true);
    setStatusMessage(`Checking connection to ${ESP_SSID}...`);
    try {
      await autoConnectToESP32();
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
      if (!abortRef.current.cancelled) setIsReadingStep(false);
    }
  };

  // ---------- UI ----------
  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
      />

      {/* Farmer selector */}
      <View style={styles.selectorBox}>
        <Text style={styles.selectorLabel}>Select Farmer</Text>
        <View style={styles.selectorRow}>
          <Text style={styles.selectorValue}>
            {selectedFarmerName
              ? `${selectedFarmerName} (${selectedFarmerId})`
              : '— none —'}
          </Text>
          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => setPickerOpen(true)}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color="#fff"
            />
            <Text style={styles.selectorBtnText}>
              {selectedFarmerId ? 'Change' : 'Choose'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reading box */}
      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert Sensor into Soil</Text>
        <Text style={styles.engSub}>
          Take {TOTAL_STEPS} readings. Press button for each spot.
        </Text>
        <Text style={styles.tagalogSub}>
          Kumuha ng {TOTAL_STEPS} readings. Pindutin ang button
          kada spot.
        </Text>
        <View style={styles.statusDisplay}>
          {isReadingStep && (
            <ActivityIndicator
              size="large"
              color="#2e7d32"
              style={styles.activityIndicator}
            />
          )}
          {currentStep >= 0 &&
            currentStep <= TOTAL_STEPS + 1 && (
              <Text style={styles.statusText}>
                {statusMessage}
              </Text>
            )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {currentStep === 0 && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              isReadingStep && styles.disabledButton,
            ]}
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
            style={[styles.actionButton, styles.disabledButton]}
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
                  <Text style={styles.farmerName}>{item.name}</Text>
                  <Text style={styles.farmerId}>{item._id}</Text>
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
    </View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: -10,
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
    marginBottom: 20,
  },
  statusDisplay: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  activityIndicator: { marginBottom: 12 },
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
