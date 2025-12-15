// app/guest/screens/recommendation.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useData, type FertilizerPlan } from '../../../context/DataContext';
import { addGuestReading } from '../../../src/localUsers';

type Nutrient = 'N' | 'P' | 'K';
type LmhWord = 'LOW' | 'MEDIUM' | 'HIGH';
type Lmh = 'L' | 'M' | 'H';

type ScheduleLine = { code: string; bags: number };
type Schedule = {
  basal: ScheduleLine[];
  after30DAT: ScheduleLine[];
  topdress60DBH: ScheduleLine[];
};

// ---------- helpers ----------
function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}

// ✅ SAME threshold logic as stakeholder
const classifyLevel = (nutrient: Nutrient, ppm: number): LmhWord => {
  const v = Number(ppm);
  if (!Number.isFinite(v) || v <= 0) return 'LOW';

  const x = Math.round(v);

  if (nutrient === 'N') {
    if (x <= 100) return 'LOW';
    if (x <= 200) return 'MEDIUM';
    return 'HIGH';
  }

  if (nutrient === 'P') {
    if (x <= 110) return 'LOW';
    if (x <= 200) return 'MEDIUM';
    return 'HIGH';
  }

  // K
  if (x <= 117) return 'LOW';
  if (x <= 275) return 'MEDIUM';
  return 'HIGH';
};

const toLMH = (lvl: LmhWord): Lmh => (lvl === 'LOW' ? 'L' : lvl === 'MEDIUM' ? 'M' : 'H');

function safeKey(n: Lmh, p: Lmh, k: Lmh) {
  return `${n}${p}${k}` as keyof typeof DA_MAP;
}

// ✅ YOUR EXACT backend DA schedules (offline copy)
const DA_MAP: Record<string, Schedule> = {
  LLL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LLM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LLH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },

  LML: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LMM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LMH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },

  LHL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LHM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },
  LHH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 2.0 }], topdress60DBH: [{ code: '46-0-0', bags: 2.0 }] },

  MLL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MLM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MLH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },

  MML: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MMM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MMH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },

  MHL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MHM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },
  MHH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.5 }], topdress60DBH: [{ code: '46-0-0', bags: 1.5 }] },

  HLL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HLM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HLH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.5 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },

  HML: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HMM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HMH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '18-46-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },

  HHL: { basal: [{ code: '0-0-60', bags: 2.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HHM: { basal: [{ code: '0-0-60', bags: 1.5 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
  HHH: { basal: [{ code: '0-0-60', bags: 1.0 }, { code: '16-20-0', bags: 2.0 }], after30DAT: [{ code: '46-0-0', bags: 1.0 }], topdress60DBH: [{ code: '46-0-0', bags: 1.0 }] },
};

export default function GuestRecommendationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ n?: string; p?: string; k?: string; ph?: string }>();

  const { addReading } = useData();

  const nValue = toNum(params.n);
  const pValue = toNum(params.p);
  const kValue = toNum(params.k);

  const phValueRaw = params.ph ? toNum(params.ph, NaN) : NaN;
  const phValue = Number.isFinite(phValueRaw) ? phValueRaw : 6.5;

  const phStatus = phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  const levelN = classifyLevel('N', nValue);
  const levelP = classifyLevel('P', pValue);
  const levelK = classifyLevel('K', kValue);

  const nClass = toLMH(levelN);
  const pClass = toLMH(levelP);
  const kClass = toLMH(levelK);

  const npkClass = `${nClass}${pClass}${kClass}`;

  const schedule: Schedule = useMemo(() => {
    const key = safeKey(nClass, pClass, kClass) as any;
    const found = (DA_MAP as any)[key] as Schedule | undefined;
    // Fallback (should never happen if map complete)
    return (
      found || {
        basal: [],
        after30DAT: [],
        topdress60DBH: [],
      }
    );
  }, [nClass, pClass, kClass]);

  const fertCodes = useMemo(() => {
    const set = new Set<string>();
    (schedule.basal || []).forEach((x) => set.add(String(x.code)));
    (schedule.after30DAT || []).forEach((x) => set.add(String(x.code)));
    (schedule.topdress60DBH || []).forEach((x) => set.add(String(x.code)));
    return Array.from(set);
  }, [schedule]);

  const stageBags = (stageArr: ScheduleLine[], code: string) => {
    const it = (stageArr || []).find((x) => String(x.code) === String(code));
    return it ? Number(it.bags || 0) : 0;
  };

  const totalsByCode = useMemo(() => {
    const t: Record<string, number> = {};
    const add = (arr: ScheduleLine[]) =>
      (arr || []).forEach((x) => {
        const c = String(x.code);
        t[c] = (t[c] || 0) + Number(x.bags || 0);
      });
    add(schedule.basal);
    add(schedule.after30DAT);
    add(schedule.topdress60DBH);
    return t;
  }, [schedule]);

  // Save to history (offline)
  const fertilizerPlansForHistory: FertilizerPlan[] = useMemo(() => {
    const out: FertilizerPlan[] = [];
    const pushStage = (stage: string, arr: ScheduleLine[]) => {
      (arr || []).forEach((x) => {
        out.push({
          stage,
          type: String(x.code),
          amount: bagsFmt(Number(x.bags || 0)),
          price: 0, // offline (no price)
        });
      });
    };
    pushStage('Sa Pagtanim', schedule.basal);
    pushStage('Pagkatapos ng 30 Araw', schedule.after30DAT);
    pushStage('Top Dress', schedule.topdress60DBH);
    return out;
  }, [schedule]);

  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    (async () => {
      try {
        const date = new Date().toISOString();

        if (!schedule || (!schedule.basal.length && !schedule.after30DAT.length && !schedule.topdress60DBH.length)) {
          Alert.alert('No Plan', `No DA schedule found for class ${npkClass}.`);
        }

        const reading = {
          name: 'Guest',
          code: 'GUEST',
          date,
          n: nValue,
          p: pValue,
          k: kValue,
          ph: phValue,
          recommendation: [
            `DA Recommendation (Offline)\nClass: ${npkClass}\nN=${levelN}, P=${levelP}, K=${levelK}`,
            `DA Recommendation (Offline)\nClass: ${npkClass}\nN=${levelN}, P=${levelP}, K=${levelK}`,
          ],
          fertilizerPlans: fertilizerPlansForHistory,
        };

        addReading(reading);
        await addGuestReading(reading);
      } catch (e: any) {
        console.error(e);
        Alert.alert('Save Error', e?.message || 'Could not save guest reading.');
      }
    })();
  }, [
    addReading,
    fertilizerPlansForHistory,
    kValue,
    levelK,
    levelN,
    levelP,
    nValue,
    npkClass,
    pValue,
    phValue,
    schedule,
  ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo as any}
        resizeMode="contain"
      />

      {/* READING RESULTS */}
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

        <Text style={styles.readSubtle}>Class: {npkClass} • DA (Offline)</Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Plan (DA Recommendation)</Text>

      {/* ONE PLAN TABLE (same design as stakeholder) */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tableTitle}>
              DA Recommendation <Text style={styles.badge}>DA</Text>
            </Text>
            <Text style={styles.tableSub}>Offline mode • No pricing</Text>
          </View>

          <Text style={styles.priceTag}>OFFLINE</Text>
        </View>

        {/* header */}
        <View style={styles.tableRow}>
          <Text style={[styles.cellHeader, { flex: 2 }]}>Stages</Text>
          {fertCodes.map((code) => (
            <Text key={`hdr-${code}`} style={styles.cellHeader}>
              {code}
            </Text>
          ))}
        </View>

        {/* planting */}
        <View style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 2 }]}>Sa Pagtanim</Text>
          {fertCodes.map((code) => (
            <Text key={`plant-${code}`} style={styles.cell}>
              {bagsFmt(stageBags(schedule.basal, code))}
            </Text>
          ))}
        </View>

        {/* after 30 days */}
        <View style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 2 }]}>Pagkatapos ng 30 Araw</Text>
          {fertCodes.map((code) => (
            <Text key={`30d-${code}`} style={styles.cell}>
              {bagsFmt(stageBags(schedule.after30DAT, code))}
            </Text>
          ))}
        </View>

        {/* topdress */}
        <View style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 2 }]}>Top Dress</Text>
          {fertCodes.map((code) => (
            <Text key={`top-${code}`} style={styles.cell}>
              {bagsFmt(stageBags(schedule.topdress60DBH, code))}
            </Text>
          ))}
        </View>

        {/* totals */}
        <View style={[styles.tableRow, styles.tableFooter]}>
          <Text style={[styles.cellHeader, { flex: 2 }]}>Total Bags</Text>
          {fertCodes.map((code) => (
            <Text key={`tot-${code}`} style={styles.cellHeader}>
              {bagsFmt(totalsByCode[code] || 0)}
            </Text>
          ))}
        </View>
      </View>


      <TouchableOpacity style={styles.button} onPress={() => router.replace('/guest/tabs/guest-home')}>
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ✅ SAME styles as stakeholder recommendation screen
const styles = StyleSheet.create({
  container: {
    padding: 23,
    backgroundColor: '#fff',
    flexGrow: 1,
    paddingBottom: 80,
  },
  logo: { width: 120, height: 200, alignSelf: 'center', marginBottom: -30 },

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
  readSubtle: { fontSize: 12, color: '#666', marginTop: 4 },
  bold: { fontWeight: 'bold' },

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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f0f0f0',
    padding: 10,
    gap: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: 'bold' },
  tableSub: { fontSize: 11, color: '#666', marginTop: 2 },

  badge: {
    fontSize: 11,
    color: '#1b5e20',
    backgroundColor: '#eef7ee',
    borderColor: '#cfe7d4',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  priceTag: {
    backgroundColor: '#5D9239',
    color: '#fff',
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    fontSize: 13,
    alignSelf: 'flex-start',
  },

  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd' },
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

  buttonAlt: {
    borderWidth: 2,
    borderColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  buttonAltText: {
    color: '#2e7d32',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },

  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 6,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});
