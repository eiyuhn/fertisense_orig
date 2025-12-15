// =============================================================
// File: app/admin/tabs/select-options.tsx
// Purpose: Select farm options (non-scrollable, button lower)
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';


const soilTypeOptions = [
  { label: 'Pumili...', value: '', enabled: false },
  { label: 'Light Soils', value: 'light soils' },
  { label: 'Med-Heavy Soils', value: 'med-heavy soils' },
];

const seasonOptions = [
  { label: 'Pumili...', value: '', enabled: false },
  { label: 'Wet Season', value: 'wet season' },
  { label: 'Dry Season', value: 'dry season' },
];

export default function SelectOptionsScreen() {
  const router = useRouter();
  const { farmerId, farmerName } = useLocalSearchParams<{
    farmerId?: string;
    farmerName?: string;
  }>();

  const [riceType, setRiceType] = useState('');
 
  const [soilType, setSoilType] = useState('');
  const [season, setSeason] = useState('');

  const allSelected = riceType && soilType && season;

  const renderItems = (
    opts: { label: string; value: string; enabled?: boolean }[]
  ) =>
    opts.map((o) => (
      <Picker.Item
        key={`${o.label}-${o.value}`}
        label={o.label}
        value={o.value}
        enabled={o.enabled ?? true}
      />
    ));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/admin/tabs/connect-instructions',
              params: { farmerId, farmerName },
            })
          }
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farm Details</Text>
        {/* right-side spacer for centered title */}
        <View style={{ width: 24 }} />
      </View>

      {/* Body (non-scrollable) */}
      <View style={styles.body}>
        <Text style={styles.selectedFarmerText}>
          Selected Farmer: {farmerName || 'N/A'}
        </Text>
        <Text style={styles.description}>
          Pumili ng mga impormasyon tungkol sa iyong sakahan upang makabuo ng
          tamang rekomendasyon.
        </Text>

        {/* Content grid; compact spacing to fit all on screen */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌾 Uri ng Palay</Text>
          <View style={styles.optionsRow}>
            {['Hybrid', 'Inbred', 'Pareho'].map((type) => {
              const value = type.toLowerCase();
              const selected = riceType === value;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setRiceType(value)}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>


        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧱 Uri ng Lupa</Text>
          <View
            style={[styles.pickerWrapper, soilType !== '' && styles.pickerSelected]}
          >
            <Picker
              selectedValue={soilType}
              onValueChange={(v) => setSoilType(String(v))}
              style={[styles.picker, soilType !== '' && styles.selectedPickerText]}
            >
              {renderItems(soilTypeOptions)}
            </Picker>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⛅ Panahon ng Pagtatanim</Text>
          <View
            style={[styles.pickerWrapper, season !== '' && styles.pickerSelected]}
          >
            <Picker
              selectedValue={season}
              onValueChange={(v) => setSeason(String(v))}
              style={[styles.picker, season !== '' && styles.selectedPickerText]}
            >
              {renderItems(seasonOptions)}
            </Picker>
          </View>
        </View>
      </View>

      {/* Footer button (lower than before) */}
      <TouchableOpacity
        style={[styles.proceedButton, !allSelected && styles.disabledButton]}
        disabled={!allSelected}
        onPress={() =>
          router.push({
            pathname: '/admin/screens/sensor-reading',
            params: {
              farmerId: String(farmerId ?? ''),
              farmerName: String(farmerName ?? ''),
            },
          })
        }
      >
        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
        <Text style={styles.proceedText}>  Magpatuloy</Text>
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
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    elevation: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Body fills the remaining space (no ScrollView)
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 0,
  },

  selectedFarmerText: {
    fontSize: 15,
    color: '#ff9800',
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#444',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
    elevation: 1,
  },
  cardTitle: { fontSize: 14, color: '#2e7d32', marginBottom: 8, fontWeight: '600' },

  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.2,
    borderColor: '#2e7d32',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#a5d6a7', borderColor: '#1b5e20' },
  chipText: { color: '#2e7d32', fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '700' },

  pickerWrapper: {
    borderWidth: 1.2,
    borderColor: '#2e7d32',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0fdf4',
  },
  pickerSelected: { backgroundColor: '#d9f7dc', borderColor: '#1b5e20' },
  picker: { height: 58, paddingHorizontal: 8 },
  selectedPickerText: { color: '#1b5e20', fontWeight: 'bold' },

  // Button anchored near the bottom (lower than before)
  proceedButton: {
    position: 'absolute',
    bottom: 60, // was 70; now closer to screen bottom
    left: 18,
    right: 18,
    flexDirection: 'row',
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  disabledButton: { backgroundColor: '#aaa' },
  proceedText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
