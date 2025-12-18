// =============================================================
// app/(stakeholder)/screens/recommendation.tsx
// LOGIC FIX ONLY — DESIGN UNCHANGED
// =============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../../context/AuthContext';
import { useFertilizer } from '../../../context/FertilizerContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';

import {
  addReading,
  addStandaloneReading,
  getDaRecommendation,
  getPublicPrices,
  type DaRecommendResponse,
  type AdminPricesDoc,
} from '../../../src/services';

/* =============================================================
   CONSTANTS & HELPERS (UNCHANGED)
============================================================= */

type Nutrient = 'N' | 'P' | 'K';
type Lmh = 'L' | 'M' | 'H';

const THRESH = {
  N: { L: 110, M: 145 },
  P: { L: 315, M: 345 },
  K: { L: 150, M: 380 },
} as const;

const classifyLevel = (nutrient: Nutrient, ppm: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' => {
  const v = Number(ppm);
  if (!Number.isFinite(v) || v <= 0) return 'N/A';
  const t = THRESH[nutrient];
  if (v < t.L) return 'LOW';
  if (v <= t.M) return 'MEDIUM';
  return 'HIGH';
};

const toLMH_SAFE = (lvl: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A'): Lmh =>
  lvl === 'HIGH' ? 'H' : lvl === 'MEDIUM' ? 'M' : 'L';

/* =============================================================
   DA NUTRIENT REQUIREMENT (kg/ha)
============================================================= */

const DA_RICE_HYBRID_REQ = {
  N: { L: 120, M: 90, H: 60 },
  P: { L: 70, M: 50, H: 20 },
  K: { L: 70, M: 50, H: 30 },
} as const;

/* =============================================================
   MAIN SCREEN
============================================================= */

export default function RecommendationScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { currency, loading: pricesLoading } = useFertilizer();
  const { result: session } = useReadingSession();

  const displayName = (user?.name || user?.username || session?.farmerName || '').trim();

  const nValue = Number(session?.n ?? 0);
  const pValue = Number(session?.p ?? 0);
  const kValue = Number(session?.k ?? 0);
  const phValue = Number(session?.ph ?? 6.5);

  const phStatus = phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  const levelN = classifyLevel('N', nValue);
  const levelP = classifyLevel('P', pValue);
  const levelK = classifyLevel('K', kValue);

  const nClass = toLMH_SAFE(levelN);
  const pClass = toLMH_SAFE(levelP);
  const kClass = toLMH_SAFE(levelK);

  /* =============================================================
     ✅ NEW: Nutrients Needed (kg/ha)
  ============================================================= */

  const nutrientNeeded = {
    N: DA_RICE_HYBRID_REQ.N[nClass],
    P: DA_RICE_HYBRID_REQ.P[pClass],
    K: DA_RICE_HYBRID_REQ.K[kClass],
  };

  /* =============================================================
     UI (DESIGN UNCHANGED)
  ============================================================= */

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo as any}
        resizeMode="contain"
      />

      {/* ================= Reading Results ================= */}
      <View style={styles.readBox}>
        <Text style={styles.readTitle}>📟 Reading Results</Text>

        <Text style={styles.readLine}>
          <Text style={styles.bold}>pH:</Text> {phValue.toFixed(1)} ({phStatus})
        </Text>

        <Text style={styles.readLine}>
          <Text style={styles.bold}>N:</Text> {levelN}{'  '}
          <Text style={styles.bold}>P:</Text> {levelP}{'  '}
          <Text style={styles.bold}>K:</Text> {levelK}
        </Text>

        {/* ✅ NEW — nutrients needed (LOGIC ONLY) */}
        <Text style={styles.readSubtle}>
          Nutrients needed (kg/ha):
        </Text>
        <Text style={styles.readSubtle}>
          N: {nutrientNeeded.N} &nbsp; P: {nutrientNeeded.P} &nbsp; K: {nutrientNeeded.K}
        </Text>

        {!!displayName && <Text style={styles.readSubtle}>Farmer: {displayName}</Text>}
      </View>

      {/* ⬇️ EVERYTHING ELSE BELOW IS UNCHANGED ⬇️ */}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Fertilization Recommendation Options</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(stakeholder)/tabs/stakeholder-home')}
      >
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* =============================================================
   STYLES (UNCHANGED)
============================================================= */

const styles = StyleSheet.create({
  container: { padding: 23, backgroundColor: '#fff', flexGrow: 1, paddingBottom: 80 },
  logo: { width: 120, height: 200, alignSelf: 'center', marginBottom: -30 },

  readBox: { backgroundColor: '#eef7ee', padding: 14, borderRadius: 10, marginBottom: 14 },
  readTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 },
  readLine: { fontSize: 14, color: '#222', marginBottom: 2 },
  readSubtle: { fontSize: 12, color: '#666', marginTop: 4 },
  bold: { fontWeight: 'bold' },

  divider: { height: 1, backgroundColor: '#000', marginVertical: 20, borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },

  button: { backgroundColor: '#2e7d32', paddingVertical: 14, borderRadius: 50, marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
});
