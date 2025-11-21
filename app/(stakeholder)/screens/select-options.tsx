import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router'; // Import useLocalSearchParams
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
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>(); // Get farmerId if passed

  const [riceType, setRiceType] = useState<string | null>(null);
  const [cropStyle, setCropStyle] = useState('');
  const [soilType, setSoilType] = useState('');
  const [season, setSeason] = useState('');

  const allSelected = riceType && cropStyle && soilType && season;

  const handleProceed = () => {
    // Pass farmerId along to the sensor reading screen
    router.push({
        pathname: '/(stakeholder)/screens/sensor-reading',
        params: { farmerId: String(farmerId ?? '') } // Pass farmerId
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        {/* Adjusted back button to go back in navigation history */}
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farm Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Pumili ng mga impormasyon tungkol sa iyong sakahan upang makabuo ng tamang rekomendasyon.
        </Text>

        {/* URI NG PALAY */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌾 Uri ng Palay</Text>
          <View style={styles.optionsRow}>
            {['Hybrid', 'Inbred', 'Pareho'].map((type) => {
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

        {/* ESTILO NG SAKAHAN */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💧 Estilo ng Sakahan</Text>
          <View style={[styles.pickerWrapper, cropStyle !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={cropStyle}
              onValueChange={setCropStyle}
              style={[Platform.OS === 'android' ? styles.picker : {}, cropStyle !== '' && styles.selectedPickerText]}
            >
              <Picker.Item label="Pumili..." value="" />
              <Picker.Item label="Irrigated" value="irrigated" />
              <Picker.Item label="Rainfed" value="rainfed" />
              <Picker.Item label="Pareho" value="pareho" />
            </Picker>
          </View>
        </View>

        {/* URI NG LUPA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧱 Uri ng Lupa</Text>
          <View style={[styles.pickerWrapper, soilType !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={soilType}
              onValueChange={setSoilType}
              style={[Platform.OS === 'android' ? styles.picker : {}, soilType !== '' && styles.selectedPickerText]}
            >
              <Picker.Item label="Pumili..." value="" />
              <Picker.Item label="Light Soils" value="light soils" />
              <Picker.Item label="Med-Heavy Soils" value="med-heavy soils" />
            </Picker>
          </View>
        </View>

        {/* PANAHON */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⛅ Panahon ng Pagtatanim</Text>
          <View style={[styles.pickerWrapper, season !== '' && styles.pickerSelected]}>
            <Picker
              selectedValue={season}
              onValueChange={setSeason}
              style={[Platform.OS === 'android' ? styles.picker : {}, season !== '' && styles.selectedPickerText]}
            >
              <Picker.Item label="Pumili..." value="" />
              <Picker.Item label="Wet Season" value="wet season" />
              <Picker.Item label="Dry Season" value="dry season" />
            </Picker>
          </View>
        </View>

        {/* Spacer to push content up from button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Proceed Button */}
      <TouchableOpacity
        style={[styles.proceedButton, !allSelected && styles.disabledButton]}
        disabled={!allSelected}
        onPress={handleProceed} // Use the handler function
      >
        <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
        <Text style={styles.proceedText}> Magpatuloy</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Styles are unchanged from your version
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5fff5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    paddingTop: Platform.OS === 'android' ? 25 : 60, // Adjust top padding
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
    marginRight: 30, // Adjust to center title properly with back button
    // fontFamily: 'Poppins_700Bold', // Assuming font is loaded
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120, // Ensure space above proceed button
  },
  description: {
    fontSize: 14,
    color: '#444',
    marginBottom: 20,
    paddingBottom: 9,
    textAlign: 'center',
    fontStyle: 'italic',
    // fontFamily: 'Poppins_400Regular', // Assuming font is loaded
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
    // fontFamily: 'Poppins_600SemiBold', // Assuming font is loaded
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
    // fontFamily: 'Poppins_500Medium', // Assuming font is loaded
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#1b5e20', // Darker text on selected
    // fontFamily: 'Poppins_700Bold', // Assuming font is loaded
    fontWeight: '700',
  },
  pickerWrapper: {
    borderWidth: 1.3,
    borderColor: '#2e7d32',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0fdf4',
    height: 50, // Fixed height
    justifyContent: 'center', // Center picker vertically
  },
  pickerSelected: {
    backgroundColor: '#d9f7dc',
    borderColor: '#1b5e20',
  },
  picker: {
    // height: 50, // Height is controlled by wrapper
    // paddingHorizontal: 10, // Padding might not work consistently
    // fontFamily: 'Poppins_400Regular', // Font might not work
  },
  selectedPickerText: {
    color: '#1b5e20',
    fontWeight: 'bold', // Make selected item bold
    // fontFamily: 'Poppins_600SemiBold', // Font might not work
  },
  proceedButton: {
    position: 'absolute',
    // bottom: 70, // Adjust if needed with nav bar
    bottom: Platform.OS === 'ios' ? 90 : 70, // Adjust for iOS safe area / Android nav bar
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
    marginLeft: 5, // Add space after icon
  },
});