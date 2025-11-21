// app/(guest)/screens/recommendation.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useReadingSession } from '../../../context/ReadingSessionContext';

/**
 * Assumptions:
 * - ReadingSessionContext already contains the last averaged reading:
 *   { n, p, k, ph, ts }
 * - n, p, k are treated as "available nutrient level" for 1 ha
 *   (you can decide if they're ppm or kg/ha; the targets are in kg/ha).
 */

// 50 kg per bag
const SACK_WEIGHT_KG = 50;

// IRRI-like targets for hybrid rice, wet season (example defaults)
const TARGET_N_KG_HA = 120;
const TARGET_P_KG_HA = 40;
const TARGET_K_KG_HA = 80;

// Map fertilizer code → human label for display
const fertilizerLabel = (code: string): string => {
  switch (code) {
    case 'UREA_46_0_0':
      return 'Urea (46-0-0)';
    case 'SSP_0_16_0':
      return 'SSP (0-16-0)';
    case 'MOP_0_0_60':
      return 'MOP (0-0-60)';
    case 'DAP_18_46_0':
      return 'DAP (18-46-0)';
    case 'NPK_14_14_14':
      return '14-14-14';
    default:
      return code;
  }
};

// Utility: compute how many kg of a fertilizer are needed to supply `needKg` of a nutrient
const calculateFertilizerNeeded = (needKg: number, pct: number): number => {
  if (needKg <= 0 || pct <= 0) return 0;
  return needKg / (pct / 100); // e.g. need 40 kg P, 16% P → 40 / 0.16 = 250 kg SSP
};

export default function GuestRecommendationScreen() {
  const router = useRouter();
  const { result } = useReadingSession();

  if (!result) {
    Alert.alert(
      'No Reading',
      'Wala pang soil reading. Paki-ulit ang proseso ng pagkuha ng reading.'
    );
    // You can redirect the guest back to select-options or home
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No reading found. Please go back and read the soil first.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/guest/screens/select-options')}
        >
          <Text style={styles.buttonText}>Back to Options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nValue = result.n ?? 0;
  const pValue = result.p ?? 0;
  const kValue = result.k ?? 0;
  const phValue = result.ph ?? 6.5;

  const phStatus =
    phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  // --------- Narrative text (Tagalog + English) ----------
  const recommendationText =
    `Base sa soil reading, ang lupa ay nangangailangan pa ng` +
    `${nValue < TARGET_N_KG_HA ? ' Nitrogen' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' Phosphorus' : ''}` +
    `${kValue < TARGET_K_KG_HA ? ' Potassium' : ''}. ` +
    `Inirerekomenda na gumamit ng angkop na pataba (Urea, SSP/DAP, MOP, o 14-14-14) ` +
    `ayon sa pangangailangan ng lupa.`;

  const englishText =
    `Based on the soil reading, the soil still needs` +
    `${nValue < TARGET_N_KG_HA ? ' Nitrogen' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' Phosphorus' : ''}` +
    `${kValue < TARGET_K_KG_HA ? ' Potassium' : ''}. ` +
    `It is recommended to apply suitable fertilizers (Urea, SSP/DAP, MOP, or 14-14-14) ` +
    `based on the soil requirement.`;

  // --------- Client-side plan math (kg/ha) ----------
  // For now we assume nValue, pValue, kValue are "current supply" vs target in kg/ha
  const dN = Math.max(0, TARGET_N_KG_HA - nValue);
  const dP = Math.max(0, TARGET_P_KG_HA - pValue);
  const dK = Math.max(0, TARGET_K_KG_HA - kValue);

  // Plan 1: UREA + SSP + MOP
  const ureaKg = calculateFertilizerNeeded(dN, 46); // 46% N
  const sspKg = calculateFertilizerNeeded(dP, 16); // 16% P2O5 (simplified)
  const mopKg = calculateFertilizerNeeded(dK, 60); // 60% K2O (simplified)

  // Plan 2: DAP + UREA + MOP
  const dapKg = calculateFertilizerNeeded(dP, 46); // 46% P in DAP
  const nFromDap = dapKg * 0.18; // DAP ~18% N
  const dN_after_dap = Math.max(0, dN - nFromDap);
  const urea2Kg = calculateFertilizerNeeded(dN_after_dap, 46);
  const mop2Kg = calculateFertilizerNeeded(dK, 60);

  // Plan 3: NPK 14-14-14 + UREA
  // Choose NPK amount so it meets the "highest" need among N, P, K
  const npkBase = Math.max(
    dN / 0.14,
    dP / 0.14,
    dK / 0.14
  );
  const npkKg = npkBase > 0 ? Math.ceil(npkBase) : 0;
  const dN_after_npk = Math.max(0, dN - npkKg * 0.14);
  const urea3Kg = calculateFertilizerNeeded(dN_after_npk, 46);

  const clientPlans: {
    key: string;
    title: string;
    items: Record<string, number>;
  }[] = [
    {
      key: 'plan1',
      title: 'Plan 1 – Urea + SSP + MOP',
      items: {
        UREA_46_0_0: ureaKg,
        SSP_0_16_0: sspKg,
        MOP_0_0_60: mopKg,
      },
    },
    {
      key: 'plan2',
      title: 'Plan 2 – DAP + Urea + MOP',
      items: {
        DAP_18_46_0: dapKg,
        UREA_46_0_0: urea2Kg,
        MOP_0_0_60: mop2Kg,
      },
    },
    {
      key: 'plan3',
      title: 'Plan 3 – 14-14-14 + Urea',
      items: {
        NPK_14_14_14: npkKg,
        UREA_46_0_0: urea3Kg,
      },
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* READING RESULTS */}
      <View style={styles.readBox}>
        <Text style={styles.readTitle}>📟 Reading Results (Guest)</Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>pH:</Text> {phValue.toFixed(1)} ({phStatus})
        </Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>N:</Text> {nValue}{'  '}
          <Text style={styles.bold}>P:</Text> {pValue}{'  '}
          <Text style={styles.bold}>K:</Text> {kValue}
        </Text>
        <Text style={styles.readSubtle}>
          Note: Values are per hectare basis (interpretation depends on your calibration).
        </Text>
      </View>

      {/* NARRATIVE */}
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationTitle}>
          Rekomendasyon:{' '}
          <Text style={{ fontStyle: 'italic' }}>(Recommendation)</Text>
        </Text>
        <Text style={styles.recommendationText}>{recommendationText}</Text>
        <Text style={styles.englishText}>{englishText}</Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Plans (Guest)</Text>

      {/* CLIENT PLANS – no prices, only bags distribution */}
      {clientPlans.map((plan, idx) => (
        <View key={plan.key} style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>{plan.title}</Text>
            <Text style={styles.planTag}>Plan {idx + 1}</Text>
          </View>

          {/* Header row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Stages</Text>
            {Object.keys(plan.items).map((code) => (
              <Text key={`hdr-${code}`} style={styles.cellHeader}>
                {fertilizerLabel(code)}
              </Text>
            ))}
          </View>

          {/* Planting: half of Urea + full P/K */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>Sa Pagtanim</Text>
            {Object.entries(plan.items).map(([code, kg]) => {
              const totalBags = Math.ceil((kg || 0) / SACK_WEIGHT_KG);
              const bagsAtPlanting = code.includes('UREA')
                ? Math.round(totalBags / 2)
                : totalBags;
              return (
                <Text key={`plant-${code}`} style={styles.cell}>
                  {bagsAtPlanting}
                </Text>
              );
            })}
          </View>

          {/* 30 days after transplanting: remaining Urea */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>
              Pagkatapos ng 30 Araw
            </Text>
            {Object.entries(plan.items).map(([code, kg]) => {
              const totalBags = Math.ceil((kg || 0) / SACK_WEIGHT_KG);
              const bagsAt30Days = code.includes('UREA')
                ? totalBags - Math.round(totalBags / 2)
                : 0;
              return (
                <Text key={`30d-${code}`} style={styles.cell}>
                  {bagsAt30Days}
                </Text>
              );
            })}
          </View>

          {/* Total bags row */}
          <View style={[styles.tableRow, styles.tableFooter]}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Total Bags</Text>
            {Object.entries(plan.items).map(([code, kg]) => (
              <Text key={`tot-${code}`} style={styles.cellHeader}>
                {Math.ceil((kg || 0) / SACK_WEIGHT_KG)}
              </Text>
            ))}
          </View>
        </View>
      ))}

      {/* BACK TO GUEST HOME */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(guest)/screens/guest-home')}
        // 🔼 Adjust this route to your actual guest home path
      >
        <Text style={styles.buttonText}>Back to Guest Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ------------------ styles ------------------ */
const styles = StyleSheet.create({
  container: {
    padding: 23,
    backgroundColor: '#fff',
    flexGrow: 1,
    paddingBottom: 80,
  },
  logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: -30 },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 16,
  },

  readBox: {
    backgroundColor: '#eef7ee',
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  readTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
  },
  readLine: { fontSize: 14, color: '#222', marginBottom: 2 },
  readSubtle: { fontSize: 11, color: '#666', marginTop: 4 },
  bold: { fontWeight: 'bold' },

  recommendationBox: {
    borderColor: '#4CAF50',
    borderWidth: 1.5,
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#f8fff9',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  recommendationText: { fontSize: 14, marginBottom: 8, color: '#222' },
  englishText: { fontSize: 13, color: '#555', fontStyle: 'italic' },

  divider: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: 20,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },

  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: 'bold', flex: 1, flexWrap: 'wrap' },
  planTag: {
    backgroundColor: '#5D9239',
    color: '#fff',
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 13,
  },

  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  cellHeader: {
    flex: 1,
    padding: 10,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#e8f5e9',
  },
  cell: { flex: 1, padding: 10, fontSize: 12, textAlign: 'center' },
  tableFooter: { backgroundColor: '#d1f7d6' },

  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 20,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});
