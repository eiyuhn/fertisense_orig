// app/(admin)/screens/select-options.tsx
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useReadingSession } from '../../../context/ReadingSessionContext';
import { ensureEsp32Reachable, ESP_SSID } from '../../../src/esp32';

export default function AdminSelectOptionsScreen() {
  const router = useRouter();

  const { farmerId, farmerName } = useLocalSearchParams<{ farmerId?: string; farmerName?: string }>();
  const { setFarmOptions } = useReadingSession();

  const [riceType, setRiceType] = useState<'hybrid' | 'inbred' | ''>('');
  const [soilType, setSoilType] = useState('');
  const [season, setSeason] = useState('');

  const allSelected = riceType && soilType && season;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          await ensureEsp32Reachable({ timeoutMs: 2000 });
        } catch (e: any) {
          if (cancelled) return;
          Alert.alert('Not Connected', e?.message || `Please connect to "${ESP_SSID}" first.`);
          router.replace({
            pathname: '/admin/screens/connect-instructions' as const,
            params: { farmerId: String(farmerId ?? ''), farmerName: String(farmerName ?? '') },
          });
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [router, farmerId, farmerName])
  );

  const normalizeSoilClass = (v: string): 'light' | 'medHeavy' => {
    const s = String(v || '').toLowerCase();
    if (s.includes('light')) return 'light';
    return 'medHeavy';
  };

  const normalizeSeason = (v: string): 'wet' | 'dry' => {
    const s = String(v || '').toLowerCase();
    if (s.includes('wet')) return 'wet';
    return 'dry';
  };

  const handleProceed = async () => {
    try {
      await ensureEsp32Reachable({ timeoutMs: 2500 });
    } catch (e: any) {
      Alert.alert('Connection Required', e?.message || `Please connect to "${ESP_SSID}" then try again.`);
      return;
    }

    // ✅ MATCH stakeholder: block if incomplete
    if (!riceType || !soilType || !season) {
      Alert.alert('Incomplete', 'Please select all (rice type, soil type, season).');
      return;
    }

    await setFarmOptions({
      variety: riceType as 'hybrid' | 'inbred',
      soilClass: normalizeSoilClass(soilType),
      season: normalizeSeason(season),
      farmerId: String(farmerId ?? ''),
      farmerName: String(farmerName ?? '').trim(),
    });

    router.push({
      pathname: '/admin/screens/sensor-reading',
      params: { farmerId: String(farmerId ?? ''), farmerName: String(farmerName ?? '') },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: '/admin/screens/connect-instructions' as const,
              params: { farmerId: String(farmerId ?? ''), farmerName: String(farmerName ?? '') },
            })
          }
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Farm Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Select the farm details to generate an accurate fertilizer recommendation.
        </Text>

        {!!String(farmerName ?? '').trim() && (
          <Text style={styles.farmerLine}>Selected farmer: {String(farmerName ?? '').trim()}</Text>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌾 Rice Variety</Text>
          <View style={styles.optionsRow}>
            {(['Hybrid', 'Inbred'] as const).map((type) => {
              const val = type.toLowerCase() as 'hybrid' | 'inbred';
              const selected = riceType === val;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setRiceType(val)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧱 Soil Type</Text>
          <View style={[styles.pickerWrapper, soilType !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={soilType}
              onValueChange={setSoilType}
              style={[Platform.OS === 'android' ? styles.picker : undefined]}
            >
              <Picker.Item label="Select..." value="" />
              <Picker.Item label="Light Soils" value="light soils" />
              <Picker.Item label="Med-Heavy Soils" value="med-heavy soils" />
            </Picker>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⛅ Planting Season</Text>
          <View style={[styles.pickerWrapper, season !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={season}
              onValueChange={setSeason}
              style={[Platform.OS === 'android' ? styles.picker : undefined]}
            >
              <Picker.Item label="Select..." value="" />
              <Picker.Item label="Wet Season" value="wet season" />
              <Picker.Item label="Dry Season" value="dry season" />
            </Picker>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.proceedButton, !allSelected && styles.disabledButton]}
        disabled={!allSelected}
        onPress={handleProceed}
      >
        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
        <Text style={styles.proceedText}>Proceed</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5fff5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    paddingTop: Platform.OS === 'android' ? 25 : 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    elevation: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 30,
  },
  scrollContent: { padding: 24, paddingBottom: 120 },
  description: {
    fontSize: 14,
    color: '#444',
    marginBottom: 10,
    paddingBottom: 9,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  farmerLine: { textAlign: 'center', color: '#1b5e20', fontWeight: '700', marginBottom: 14 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#2e7d32',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, color: '#2e7d32', marginBottom: 11, fontWeight: '600' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#a5d6a7', borderColor: '#1b5e20' },
  chipText: { color: '#2e7d32', fontWeight: '500' },
  chipTextSelected: { color: '#1b5e20', fontWeight: '700' },
  pickerWrapper: {
    borderWidth: 1.3,
    borderColor: '#2e7d32',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0fdf4',
    height: 50,
    justifyContent: 'center',
  },
  pickerSelected: { backgroundColor: '#d9f7dc', borderColor: '#1b5e20' },
  picker: { height: 50, width: '100%' },

  proceedButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    gap: 8,
  },
  proceedText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabledButton: { backgroundColor: '#aaa' },
});
