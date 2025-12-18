import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function SelectOptionsScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();

  const [riceType, setRiceType] = useState<string | null>(null);
  const [soilType, setSoilType] = useState('');
  const [season, setSeason] = useState('');

  // ✅ only these 3 are required now
  const allSelected = riceType && soilType && season;

  const handleProceed = () => {
    router.push({
      pathname: '/guest/screens/sensor-reading',
      params: { farmerId: String(farmerId ?? '') },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farm Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Pumili ng mga impormasyon tungkol sa iyong sakahan upang makabuo ng tamang rekomendasyon.
        </Text>

        {/* URI NG PALAY (HYBRID ONLY) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌾 Klase sa Humay</Text>
          <View style={styles.optionsRow}>
            {['Hybrid'].map((type) => {
              const selected = riceType === type.toLowerCase();
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setRiceType(type.toLowerCase())}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* URI NG LUPA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧱 Klase sa Yuta</Text>
          <View style={[styles.pickerWrapper, soilType !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={soilType}
              onValueChange={setSoilType}
              style={[
                Platform.OS === 'android' ? styles.picker : {},
                soilType !== '' && styles.selectedPickerText,
              ]}
            >
              <Picker.Item label="Pumili..." value="" />
              <Picker.Item label="Light Soils" value="light soils" />
              <Picker.Item label="Med-Heavy Soils" value="med-heavy soils" />
            </Picker>
          </View>
        </View>

        {/* PANAHON */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⛅ Panahon sa Pagtanom</Text>
          <View style={[styles.pickerWrapper, season !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={season}
              onValueChange={setSeason}
              style={[
                Platform.OS === 'android' ? styles.picker : {},
                season !== '' && styles.selectedPickerText,
              ]}
            >
              <Picker.Item label="Pumili..." value="" />
              <Picker.Item label="Wet Season" value="wet season" />
              <Picker.Item label="Dry Season" value="dry season" />
            </Picker>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Proceed Button */}
      <TouchableOpacity
        style={[styles.proceedButton, !allSelected && styles.disabledButton]}
        disabled={!allSelected}
        onPress={handleProceed}
      >
        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
        <Text style={styles.proceedText}> Magpadayun</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Styles unchanged
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5fff5',
  },
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
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  description: {
    fontSize: 14,
    color: '#444',
    marginBottom: 20,
    paddingBottom: 9,
    textAlign: 'center',
    fontStyle: 'italic',
  },
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
  cardTitle: {
    fontSize: 15,
    color: '#2e7d32',
    marginBottom: 11,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#a5d6a7',
    borderColor: '#1b5e20',
  },
  chipText: {
    color: '#2e7d32',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#1b5e20',
    fontWeight: '700',
  },
  pickerWrapper: {
    borderWidth: 1.3,
    borderColor: '#2e7d32',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0fdf4',
    height: 50,
    justifyContent: 'center',
  },
  pickerSelected: {
    backgroundColor: '#d9f7dc',
    borderColor: '#1b5e20',
  },
  picker: {},
  selectedPickerText: {
    color: '#1b5e20',
    fontWeight: 'bold',
  },
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
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  proceedText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 5,
  },
});
