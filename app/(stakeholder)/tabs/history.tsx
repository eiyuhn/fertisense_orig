// app/(stakeholder)/screens/history.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { listUserReadings, deleteReading } from '../../../src/services';

type LocalScheduleLine = { code: string; bags: number };
type LocalSchedule = {
  organic?: LocalScheduleLine[];
  basal?: LocalScheduleLine[];
  after30DAT?: LocalScheduleLine[];
  topdress60DBH?: LocalScheduleLine[];
};

type LocalCost = {
  currency: string;
  total: number;
};

type PlanSnapshot = {
  id: string;
  label?: string;
  isCheapest?: boolean;
  schedule: LocalSchedule;
  cost: LocalCost | null;
};

type HistoryItem = {
  id: string;
  date: string;
  ph: string;
  n_value: number;
  p_value: number;
  k_value: number;

  // ✅ NEW: nutrients needed kg/ha
  neededKgHa?: { N: number; P: number; K: number };

  // ✅ NEW: selected options
  variety?: string;
  soilClass?: string;
  season?: string;

  recommendationText: string;
  englishText?: string;

  fertilizerPlans?: Array<{
    name?: string;
    cost?: string;
    details?: string[];
  }>;

  // ✅ NEW (from Recommendation persistLocalHistory) -> contains ALL options
  plansSnapshot?: PlanSnapshot[];
  selectedPlanId?: string | null;

  // backend / misc (old or remote)
  daSchedule?: any;
  daCost?: any;
  currency?: string;
  npkClass?: string;
};

type Nutrient = 'N' | 'P' | 'K';
function classifyLevel(nutrient: Nutrient, v?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'N/A';
  const ppm = Math.round(v);
  if (ppm <= 0) return 'N/A';

  // same thresholds as your recommendation
  if (nutrient === 'N') {
    if (ppm < 110) return 'LOW';
    if (ppm <= 145) return 'MEDIUM';
    return 'HIGH';
  }
  if (nutrient === 'P') {
    if (ppm < 315) return 'LOW';
    if (ppm <= 345) return 'MEDIUM';
    return 'HIGH';
  }
  if (ppm < 150) return 'LOW';
  if (ppm <= 380) return 'MEDIUM';
  return 'HIGH';
}

function asArray<T = any>(arr: any): T[] {
  return Array.isArray(arr) ? (arr as T[]) : [];
}

function moneyFmt(v: number) {
  return (v || 0).toFixed(2);
}

function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}

const ORGANIC_FERT_CODE = 'Organic Fertilizer';

const FERTILIZER_NAMES: Record<string, string> = {
  '46-0-0': 'Urea',
  '21-0-0': 'Ammosul',
  '0-0-60': 'Muriate of Potash (MOP)',
  '18-46-0': 'Diammonium Phosphate (DAP)',
  '16-20-0': 'Ammophos',
  '14-14-14': 'Complete Fertilizer',
  [ORGANIC_FERT_CODE]: 'Organic Fertilizer',
};

const STAGE_COL_W = 190;
const COL_W = 130;

function ScrollProgress({ progress01 }: { progress01: number }) {
  const p = Math.max(0, Math.min(1, Number(progress01 || 0)));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressThumb, { width: `${Math.max(15, p * 100)}%` }]} />
    </View>
  );
}

function normalizePlanToSchedule(p: PlanSnapshot) {
  const s = p?.schedule || {};
  return {
    organic: asArray(s.organic),
    basal: asArray(s.basal),
    after30DAT: asArray(s.after30DAT),
    topdress60DBH: asArray(s.topdress60DBH),
  } as LocalSchedule;
}

function PlanTableCardHistory({
  p,
  idx,
  currency,
}: {
  p: PlanSnapshot;
  idx: number;
  currency: string | null;
}) {
  const cur = p?.cost?.currency || currency || 'PHP';
  const fixedSchedule = normalizePlanToSchedule(p);

  const fertCodes = Array.from(
    new Set([
      ...asArray(fixedSchedule.organic).map((x: any) => String(x.code)),
      ...asArray(fixedSchedule.basal).map((x: any) => String(x.code)),
      ...asArray(fixedSchedule.after30DAT).map((x: any) => String(x.code)),
      ...asArray(fixedSchedule.topdress60DBH).map((x: any) => String(x.code)),
    ])
  );

  const stageBags = (stageArr: any[] | undefined, code: string) => {
    const a = asArray(stageArr);
    const it = a.find((x: any) => String(x.code) === String(code));
    return it ? Number(it.bags || 0) : 0;
  };

  const totalsByCode: Record<string, number> = {};
  const addTotals = (arr?: any[]) =>
    asArray(arr).forEach((x: any) => {
      const c = String(x.code);
      totalsByCode[c] = (totalsByCode[c] || 0) + Number(x.bags || 0);
    });

  addTotals(fixedSchedule.organic);
  addTotals(fixedSchedule.basal);
  addTotals(fixedSchedule.after30DAT);
  addTotals(fixedSchedule.topdress60DBH);

  const optionLabel = `Fertilization Recommendation Option ${idx + 1}`;
  const contentWidth = STAGE_COL_W + fertCodes.length * COL_W;

  const [progress01, setProgress01] = React.useState(0);

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tableTitle}>{optionLabel}</Text>
          <View style={styles.badgeRow}>
            {p.isCheapest ? <Text style={styles.badge}>Cheapest</Text> : null}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceTag}>
            {cur} {moneyFmt(Number(p?.cost?.total || 0))}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const max = Math.max(1, contentSize.width - layoutMeasurement.width);
          const pr = Math.max(0, Math.min(1, contentOffset.x / max));
          setProgress01(pr);
        }}
        scrollEventThrottle={16}
      >
        <View style={{ minWidth: contentWidth }}>
          <View style={[styles.tableRow, styles.headerRow]}>
            <View style={[styles.stageCell, styles.stageHeaderCell]}>
              <Text style={styles.stageHeaderText}>Stages</Text>
            </View>

            {fertCodes.map((code) => (
              <View key={`hdr-${p.id}-${code}`} style={styles.fertHeaderCell}>
                <Text style={styles.headerCodeText} numberOfLines={1}>
                  {code}
                </Text>
                <Text style={styles.headerNameText} numberOfLines={2}>
                  {FERTILIZER_NAMES[code] || 'Fertilizer'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tableRow}>
            <View style={styles.stageCell}>
              <Text style={styles.stageText}>Organic Fertilizer (14 - 30 days ayha sa pagtanom)</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`org-${p.id}-${code}`} style={styles.fertCell}>
                <Text style={styles.bagsText} numberOfLines={1}>
                  {bagsFmt(stageBags(fixedSchedule.organic, code))}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tableRow}>
            <View style={styles.stageCell}>
              <Text style={styles.stageText}>Sa Pagtanom</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`basal-${p.id}-${code}`} style={styles.fertCell}>
                <Text style={styles.bagsText} numberOfLines={1}>
                  {bagsFmt(stageBags(fixedSchedule.basal, code))}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tableRow}>
            <View style={styles.stageCell}>
              <Text style={styles.stageText}>Pagkahuman sa ika 30 na adlaw</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`30-${p.id}-${code}`} style={styles.fertCell}>
                <Text style={styles.bagsText} numberOfLines={1}>
                  {bagsFmt(stageBags(fixedSchedule.after30DAT, code))}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tableRow}>
            <View style={styles.stageCell}>
              <Text style={styles.stageText}>Top Dress (60 days ayha sa pag harvest)</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`top-${p.id}-${code}`} style={styles.fertCell}>
                <Text style={styles.bagsText} numberOfLines={1}>
                  {bagsFmt(stageBags(fixedSchedule.topdress60DBH, code))}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.tableRow, styles.tableFooter]}>
            <View style={[styles.stageCell, styles.stageFooterCell]}>
              <Text style={styles.totalStageText}>Total Bags</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`tot-${p.id}-${code}`} style={[styles.fertCell, styles.footerFertCell]}>
                <Text style={styles.totalBagsText} numberOfLines={1}>
                  {bagsFmt(totalsByCode[code] || 0)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {fertCodes.length >= 3 ? <ScrollProgress progress01={progress01} /> : null}
    </View>
  );
}

export default function HistoryScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userKey = useMemo(() => (user?._id ? `history:${user._id}` : null), [user?._id]);
  const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

  const fingerprint = (h: Partial<HistoryItem>) => {
    const date = String(h?.date || '').trim();
    const phNum = Number(String(h?.ph || '').match(/([0-9]+(\.[0-9]+)?)/)?.[1] || 0);
    const phRound = Number.isFinite(phNum) ? phNum.toFixed(1) : '0.0';
    const n = Number(h?.n_value ?? 0);
    const p = Number(h?.p_value ?? 0);
    const k = Number(h?.k_value ?? 0);

    const variety = String(h?.variety || '').trim();
    const soilClass = String(h?.soilClass || '').trim();
    const season = String(h?.season || '').trim();

    return `${date}|${phRound}|${n}|${p}|${k}|${variety}|${soilClass}|${season}`;
  };

  const parseLocalHistory = (stored: string | null): HistoryItem[] => {
    if (!stored) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return [];
    }
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr
      .map((h: any) => ({
        id: String(h?.id ?? ''),
        date: String(h?.date ?? 'Unknown Date'),
        ph: String(h?.ph ?? 'N/A'),
        n_value: Number(h?.n_value ?? 0),
        p_value: Number(h?.p_value ?? 0),
        k_value: Number(h?.k_value ?? 0),

        neededKgHa: h?.neededKgHa
          ? { N: Number(h.neededKgHa.N || 0), P: Number(h.neededKgHa.P || 0), K: Number(h.neededKgHa.K || 0) }
          : undefined,

        variety: h?.variety ? String(h.variety) : undefined,
        soilClass: h?.soilClass ? String(h.soilClass) : undefined,
        season: h?.season ? String(h.season) : undefined,

        recommendationText: String(h?.recommendationText ?? ''),
        englishText: h?.englishText ? String(h.englishText) : undefined,

        fertilizerPlans: Array.isArray(h?.fertilizerPlans) ? h.fertilizerPlans : [],
        plansSnapshot: Array.isArray(h?.plansSnapshot) ? h.plansSnapshot : [],
        selectedPlanId: h?.selectedPlanId ?? null,

        daSchedule: h?.daSchedule,
        daCost: h?.daCost,
        currency: h?.currency,
        npkClass: h?.npkClass,
      }))
      .filter((x) => x.id);
  };

  const mapRemoteReadingToHistory = (r: any): HistoryItem => {
    const created =
      (r?.createdAt && new Date(r.createdAt)) ||
      (r?.updatedAt && new Date(r.updatedAt)) ||
      new Date();

    let dateStr = 'Unknown Date';
    try {
      dateStr = created.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {}

    const pHNum =
      typeof r?.pH === 'number' && Number.isFinite(r.pH)
        ? r.pH
        : typeof r?.ph === 'number' && Number.isFinite(r.ph)
        ? r.ph
        : undefined;

    const phStatus =
      typeof pHNum === 'number' && Number.isFinite(pHNum)
        ? pHNum < 5.5
          ? 'Acidic'
          : pHNum > 7.5
          ? 'Alkaline'
          : 'Neutral'
        : 'N/A';

    const phStr = pHNum !== undefined ? `${pHNum.toFixed(1)} (${phStatus})` : 'N/A';

    return {
      id: String(r?._id ?? `reading_${created.getTime()}`),
      date: dateStr,
      ph: phStr,
      n_value: Number(r?.N ?? r?.n ?? 0),
      p_value: Number(r?.P ?? r?.p ?? 0),
      k_value: Number(r?.K ?? r?.k ?? 0),

      // backend may or may not have these
      neededKgHa: r?.neededKgHa
        ? { N: Number(r.neededKgHa.N || 0), P: Number(r.neededKgHa.P || 0), K: Number(r.neededKgHa.K || 0) }
        : undefined,

      variety: r?.variety ? String(r.variety) : undefined,
      soilClass: r?.soilClass ? String(r.soilClass) : undefined,
      season: r?.season ? String(r.season) : undefined,

      recommendationText: typeof r?.recommendationText === 'string' ? r.recommendationText : '',
      englishText: typeof r?.englishText === 'string' ? r.englishText : undefined,

      fertilizerPlans: Array.isArray(r?.fertilizerPlans) ? r.fertilizerPlans : [],

      // remote usually does NOT have all options
      plansSnapshot: Array.isArray(r?.plansSnapshot) ? r.plansSnapshot : [],
      selectedPlanId: r?.selectedPlanId ?? null,

      daSchedule: r?.daSchedule,
      daCost: r?.daCost,
      currency: r?.currency,
      npkClass: r?.npkClass,
    };
  };

  const loadHistory = useCallback(async () => {
    if (!userKey) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem(userKey);
      const localItems = parseLocalHistory(stored);

      let remoteItems: HistoryItem[] = [];
      if (token) {
        try {
          const remote = await listUserReadings(token);
          if (Array.isArray(remote)) remoteItems = remote.map(mapRemoteReadingToHistory);
        } catch {}
      }

      // ✅ Merge by fingerprint and prefer the item that has ALL options (plansSnapshot)
      const map = new Map<string, HistoryItem>();
      const put = (h: HistoryItem) => {
        const key = fingerprint(h);
        const prev = map.get(key);
        if (!prev) {
          map.set(key, h);
          return;
        }
        const prevHas = (prev.plansSnapshot?.length || 0) > 0;
        const curHas = (h.plansSnapshot?.length || 0) > 0;
        if (!prevHas && curHas) map.set(key, h);
      };

      localItems.forEach(put);
      remoteItems.forEach(put);

      const merged = Array.from(map.values());

      // Save only locals back
      const localsOnly = merged.filter((h) => !isObjectId(h.id));
      await AsyncStorage.setItem(userKey, JSON.stringify(localsOnly));

      // Sort newest-ish
      merged.sort((a, b) => {
        const getTimeFromId = (id: string): number => {
          if (id.startsWith('reading_')) {
            const parts = id.split('_');
            const maybeTs = parts[1] ? parseInt(parts[1], 10) : NaN;
            if (Number.isFinite(maybeTs)) return maybeTs;
          }
          if (/^[a-f0-9]{24}$/i.test(id)) {
            const tsHex = id.slice(0, 8);
            const seconds = parseInt(tsHex, 16);
            if (Number.isFinite(seconds)) return seconds * 1000;
          }
          return 0;
        };
        return getTimeFromId(b.id) - getTimeFromId(a.id);
      });

      setHistory(merged);
    } catch {
      Alert.alert('Load Error', 'Could not load history data.');
    } finally {
      setLoading(false);
    }
  }, [userKey, token]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = history.filter((h) => h.id !== id);
            setExpandedId((cur) => (cur === id ? null : cur));
            setHistory(updated);

            if (token && isObjectId(id)) await deleteReading('', id, token);

            if (userKey) {
              const localsOnly = updated.filter((h) => !isObjectId(h.id));
              await AsyncStorage.setItem(userKey, JSON.stringify(localsOnly));
            }
          } catch {
            Alert.alert('Delete Error', 'Could not delete. Reloading...');
            await loadHistory();
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isExpanded = expandedId === item.id;

    const plansSnap = Array.isArray(item.plansSnapshot) ? item.plansSnapshot : [];

    // If old entry: fallback to chosen schedule only
    const fallbackOne: PlanSnapshot[] =
      !plansSnap.length && item.daSchedule
        ? [
            {
              id: 'CHOSEN',
              label: 'Chosen Plan',
              isCheapest: false,
              schedule: item.daSchedule,
              cost: item.daCost || null,
            },
          ]
        : [];

    const plansToRender = plansSnap.length ? plansSnap : fallbackOne;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.subText}>pH: {item.ph}</Text>

            <Text style={styles.npkText}>
              N:{classifyLevel('N', item.n_value)} | P:{classifyLevel('P', item.p_value)} | K:{classifyLevel('K', item.k_value)}
            </Text>

            {/* ✅ SHOW nutrients needed */}
            {item.neededKgHa ? (
              <Text style={styles.metaText}>
                Nutrients needed (kg/ha): N {Number(item.neededKgHa.N || 0)} • P {Number(item.neededKgHa.P || 0)} • K {Number(item.neededKgHa.K || 0)}
              </Text>
            ) : null}

            {/* ✅ SHOW selected options */}
            {(item.variety || item.soilClass || item.season) ? (
              <Text style={styles.metaText}>
                Selected: {String(item.variety || '')} • {String(item.soilClass || '')} • {String(item.season || '')}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#d32f2f" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.seeMoreBtn} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          <Text style={styles.seeMoreText}>{isExpanded ? 'Hide Fertilizer Plans' : 'See Fertilizer Plans'}</Text>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#2e7d32" />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.details}>
            {plansToRender.length ? (
              <View style={{ gap: 12 }}>
                {plansToRender.map((p, idx) => (
                  <PlanTableCardHistory
                    key={`${item.id}-${p.id}-${idx}`}
                    p={p}
                    idx={idx}
                    currency={item.currency || null}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.detailsText}>No plans saved.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topArc}>
        <Ionicons name="time-outline" size={26} color="#fff" />
        <Text style={styles.arcTitle}>History</Text>
      </View>

      {loading || !userKey ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: (insets.bottom || 0) + 90 }]}
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text>No history yet</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topArc: {
    backgroundColor: '#2e7d32',
    height: 100,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  arcTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  list: { paddingHorizontal: 12, paddingTop: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  date: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  subText: { fontSize: 12, color: '#666', marginTop: 2 },
  npkText: { fontSize: 11, color: '#888', marginTop: 2 },
  metaText: { fontSize: 11, color: '#666', marginTop: 4 },
  deleteButton: { padding: 4 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  seeMoreText: { fontSize: 12, fontWeight: '600', color: '#2e7d32', marginRight: 4 },
  details: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  detailsText: { fontSize: 12, color: '#666' },
  loadingText: { marginTop: 8, color: '#666' },

  table: { marginBottom: 6, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f0f0f0',
    padding: 10,
    gap: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: 'bold' },

  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  badge: {
    fontSize: 11,
    color: '#1b5e20',
    backgroundColor: '#eef7ee',
    borderColor: '#cfe7d4',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
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
  headerRow: { backgroundColor: '#e8f5e9' },

  stageCell: { width: 190, padding: 10, justifyContent: 'center' },
  stageHeaderCell: { backgroundColor: '#e8f5e9' },
  stageFooterCell: { backgroundColor: '#d1f7d6' },

  fertHeaderCell: {
    width: 130,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
  },
  fertCell: { width: 130, padding: 10, alignItems: 'center', justifyContent: 'center' },

  stageHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#1b5e20', textAlign: 'left' },
  stageText: { fontSize: 12, color: '#222', textAlign: 'left' },

  headerCodeText: { fontSize: 12, fontWeight: '800', color: '#1b5e20', textAlign: 'center' },
  headerNameText: { marginTop: 2, fontSize: 10, color: '#2f3b30', textAlign: 'center', lineHeight: 13 },

  bagsText: { fontSize: 12, color: '#222', textAlign: 'center' },

  tableFooter: { backgroundColor: '#d1f7d6' },
  footerFertCell: { backgroundColor: '#d1f7d6' },
  totalStageText: { fontSize: 12, fontWeight: 'bold', color: '#111', textAlign: 'left' },
  totalBagsText: { fontSize: 12, fontWeight: 'bold', color: '#111', textAlign: 'center' },

  progressTrack: {
    height: 5,
    backgroundColor: '#e6e6e6',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  progressThumb: {
    height: 5,
    backgroundColor: '#2e7d32',
  },
});
