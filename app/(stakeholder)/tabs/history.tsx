import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { listUserReadings, deleteReading } from '../../../src/services';

type HistoryItem = {
  id: string;
  date: string;
  ph: string;
  n_value: number;
  p_value: number;
  k_value: number;

  recommendationText: string;
  englishText?: string;

  fertilizerPlans?: Array<{
    name?: string;
    cost?: string;
    details?: string[];
  }>;

  daSchedule?: any;
  daCost?: any;
  currency?: string;
  npkClass?: string;
};

function normalizeDetails(details?: string[]): string[] {
  if (!details) return [];
  return details.map((d) => (typeof d === 'string' ? d : String(d)));
}

function phStatusLabel(ph?: number | null): string {
  if (typeof ph !== 'number' || !Number.isFinite(ph)) return 'N/A';
  if (ph < 5.5) return 'Acidic';
  if (ph > 7.5) return 'Alkaline';
  return 'Neutral';
}

/* ✅ FIX: nutrient-specific thresholds */
type Nutrient = 'N' | 'P' | 'K';
function classifyLevel(nutrient: Nutrient, v?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'N/A';

  const ppm = Math.round(v);

  // treat 0/negative as N/A (sensor not inserted / failed read)
  if (ppm <= 0) return 'N/A';

  if (nutrient === 'N') {
    if (ppm <= 100) return 'LOW';
    if (ppm <= 200) return 'MEDIUM';
    return 'HIGH'; // >= 201
  }

  if (nutrient === 'P') {
    if (ppm <= 110) return 'LOW';
    if (ppm <= 200) return 'MEDIUM';
    return 'HIGH'; // >= 201
  }

  // K
  if (ppm <= 117) return 'LOW';
  if (ppm <= 275) return 'MEDIUM';
  return 'HIGH'; // >= 276
}

function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}

type StageKey = 'BASAL' | 'AFTER30' | 'TOPDRESS';
type StageMap = Record<StageKey, Record<string, number>>;

function emptyStageMap(): StageMap {
  return { BASAL: {}, AFTER30: {}, TOPDRESS: {} };
}

function addStage(map: Record<string, number>, codeLike: any, bagsLike: any) {
  const c = String(codeLike ?? '').trim();
  if (!c) return;
  const b = Number(bagsLike ?? 0);
  if (!Number.isFinite(b) || b <= 0) return;
  map[c] = (map[c] || 0) + b;
}

function pickFirst<T = any>(obj: any, keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null) return obj[k] as T;
  }
  return undefined;
}

function normalizeStageItems(stage: any): Array<{ code: string; bags: number }> {
  if (!stage) return [];

  if (Array.isArray(stage)) {
    return stage
      .map((it) => {
        const code =
          it?.code ??
          it?.fertilizerCode ??
          it?.key ??
          it?.name ??
          it?.label ??
          it?.fertilizer ??
          it?.type;

        const bags = it?.bags ?? it?.qty ?? it?.quantity ?? it?.sacks ?? it?.bagCount;

        return { code: String(code ?? '').trim(), bags: Number(bags ?? 0) };
      })
      .filter((x) => x.code && Number.isFinite(x.bags) && x.bags > 0);
  }

  if (typeof stage === 'object') {
    return Object.entries(stage)
      .map(([k, v]) => ({ code: String(k).trim(), bags: Number(v ?? 0) }))
      .filter((x) => x.code && Number.isFinite(x.bags) && x.bags > 0);
  }

  return [];
}

/** ✅ Parse schedule from a SINGLE plan's "details" lines */
function buildScheduleFromPlanDetails(plan?: { name?: string; cost?: string; details?: string[] }) {
  if (!plan) return null;

  const details = normalizeDetails(plan.details);
  if (!details.length) return null;

  const stages = emptyStageMap();
  const totals: Record<string, number> = {};

  let current: StageKey | null = null;

  const detectStage = (line: string): StageKey | null => {
    const s = line.toLowerCase();
    if (s.includes('basal') || s.includes('sa pagtanim') || s.includes('pagtanim')) return 'BASAL';
    if (s.includes('30') || s.includes('after30') || s.includes('second') || s.includes('pagkatapos')) return 'AFTER30';
    if (s.includes('top') || s.includes('60') || s.includes('third')) return 'TOPDRESS';
    return null;
  };

  const parseLine = (line: string): { code: string; bags: number } | null => {
    // "0-0-60: 1.50 bags (75.0 kg)" OR "0-0-60: 1.50 bags"
    const m = line.match(/^([^:]+):\s*([0-9]+(\.[0-9]+)?)\s*bags/i);
    if (!m) return null;
    return { code: String(m[1]).trim(), bags: Number(m[2]) };
  };

  for (const raw of details) {
    const line = String(raw).trim();
    if (!line) continue;

    const lineNoColon = line.replace(/:\s*$/, '').trim();
    const st = detectStage(lineNoColon);

    const parsed = parseLine(line);

    if (st && !parsed) {
      current = st;
      continue;
    }

    if (parsed && current) {
      addStage(stages[current], parsed.code, parsed.bags);
      addStage(totals, parsed.code, parsed.bags);
    }
  }

  const any =
    Object.keys(stages.BASAL).length ||
    Object.keys(stages.AFTER30).length ||
    Object.keys(stages.TOPDRESS).length;

  if (!any) return null;

  return {
    stages,
    totals,
    title: plan.name ? String(plan.name) : 'Fertilizer Plan',
    totalCostText: plan.cost ? String(plan.cost) : 'N/A',
  };
}

/** ✅ If plan.details is missing but daSchedule exists, build schedule from daSchedule */
function buildScheduleFromDaSchedule(item: HistoryItem) {
  const sch = (item as any)?.daSchedule;
  const cost = (item as any)?.daCost;
  const currency = (cost?.currency || item.currency || 'PHP') as string;
  const npkClass = (item as any)?.npkClass ? String((item as any).npkClass) : '';

  if (!sch) return null;

  const stages = emptyStageMap();
  const totals: Record<string, number> = {};

  const basalRaw = pickFirst(sch, [
    'basal',
    'saPagtanim',
    'atPlanting',
    'planting',
    'basalApplication',
    'basalApp',
  ]);

  const after30Raw = pickFirst(sch, [
    'after30DAT',
    'after30Dat',
    'after30',
    'second',
    'secondApplication',
    '30DAT',
    'dat30',
    'after30Days',
  ]);

  const topdressRaw = pickFirst(sch, [
    'topdress60DBH',
    'topdress60dbh',
    'topdress',
    'third',
    'topDress',
    '60DBH',
    'dbh60',
    'topdress60',
  ]);

  const basal = normalizeStageItems(basalRaw);
  const after30 = normalizeStageItems(after30Raw);
  const topdress = normalizeStageItems(topdressRaw);

  basal.forEach((it) => {
    addStage(stages.BASAL, it.code, it.bags);
    addStage(totals, it.code, it.bags);
  });
  after30.forEach((it) => {
    addStage(stages.AFTER30, it.code, it.bags);
    addStage(totals, it.code, it.bags);
  });
  topdress.forEach((it) => {
    addStage(stages.TOPDRESS, it.code, it.bags);
    addStage(totals, it.code, it.bags);
  });

  const totalCostText =
    cost?.total != null
      ? `${currency} ${Number(cost.total || 0).toFixed(2)}`
      : `${currency} 0.00`;

  const any =
    Object.keys(stages.BASAL).length ||
    Object.keys(stages.AFTER30).length ||
    Object.keys(stages.TOPDRESS).length;

  if (!any) return null;

  return {
    stages,
    totals,
    title: `DA Recommendation${npkClass ? ` (${npkClass})` : ''}`,
    totalCostText,
  };
}

export default function HistoryScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  const userKey = useMemo(() => (user?._id ? `history:${user._id}` : null), [user?._id]);

  const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

  const migrateLegacyIfNeeded = useCallback(async () => {
    if (!userKey) return;
    try {
      const legacyKey = 'history';
      const legacy = await AsyncStorage.getItem(legacyKey);
      const current = await AsyncStorage.getItem(userKey);
      if (legacy && !current) {
        await AsyncStorage.setItem(userKey, legacy);
        await AsyncStorage.removeItem(legacyKey);
      }
    } catch {}
  }, [userKey]);

  const parseLocalHistory = (stored: string | null): HistoryItem[] => {
    if (!stored) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return [];
    }

    const asArray = Array.isArray(parsed) ? parsed : [];
    return asArray
      .map((h: any) => ({
        id: String(h?.id ?? ''),
        date: String(h?.date ?? 'Unknown Date'),
        ph: String(h?.ph ?? 'N/A'),
        n_value: Number(h?.n_value ?? 0),
        p_value: Number(h?.p_value ?? 0),
        k_value: Number(h?.k_value ?? 0),
        recommendationText: String(h?.recommendationText ?? ''),
        englishText: h?.englishText ? String(h.englishText) : undefined,
        fertilizerPlans: Array.isArray(h?.fertilizerPlans)
          ? h.fertilizerPlans.map((p: any) => ({
              name: p?.name ? String(p.name) : undefined,
              cost: p?.cost ? String(p.cost) : undefined,
              details: normalizeDetails(p?.details),
            }))
          : [],
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
      typeof r?.pH === 'number' && Number.isFinite(r.pH) ? r.pH :
      typeof r?.ph === 'number' && Number.isFinite(r.ph) ? r.ph :
      undefined;

    const phStat = phStatusLabel(pHNum);
    const phStr = pHNum !== undefined ? `${pHNum.toFixed(1)} (${phStat})` : 'N/A';

    const recText = typeof r?.recommendationText === 'string' ? r.recommendationText : '';
    const engText = typeof r?.englishText === 'string' ? r.englishText : undefined;

    const fertPlans =
      Array.isArray(r?.fertilizerPlans) && r.fertilizerPlans.length
        ? r.fertilizerPlans.map((p: any) => ({
            name: p?.name ? String(p.name) : undefined,
            cost: p?.cost ? String(p.cost) : undefined,
            details: normalizeDetails(p?.details),
          }))
        : [];

    return {
      id: String(r?._id ?? `reading_${created.getTime()}`),
      date: dateStr,
      ph: phStr,
      n_value: Number(r?.N ?? r?.n ?? 0),
      p_value: Number(r?.P ?? r?.p ?? 0),
      k_value: Number(r?.K ?? r?.k ?? 0),
      recommendationText: recText || '',
      englishText: engText,
      fertilizerPlans: fertPlans,
      daSchedule: r?.daSchedule,
      daCost: r?.daCost,
      currency: r?.currency,
      npkClass: r?.npkClass,
    };
  };

  const fingerprint = (h: HistoryItem) => {
    const phNum = Number(String(h.ph || '').match(/([0-9]+(\.[0-9]+)?)/)?.[1] || 0);
    const phRound = Number.isFinite(phNum) ? phNum.toFixed(1) : '0.0';
    const n = Number(h.n_value || 0);
    const p = Number(h.p_value || 0);
    const k = Number(h.k_value || 0);
    const c = (h.npkClass || '').trim();
    const d = (h.date || '').trim();
    return `${d}|${phRound}|${n}|${p}|${k}|${c}`;
  };

  const loadHistory = useCallback(async () => {
    if (!userKey) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await migrateLegacyIfNeeded();

      const stored = await AsyncStorage.getItem(userKey);
      const localItems = parseLocalHistory(stored);

      let remoteItems: HistoryItem[] = [];
      if (token) {
        try {
          const remote = await listUserReadings(token);
          if (Array.isArray(remote)) {
            remoteItems = remote.map(mapRemoteReadingToHistory);
          }
        } catch {}
      }

      const map = new Map<string, HistoryItem>();

      for (const h of localItems) map.set(fingerprint(h), h);
      for (const h of remoteItems) map.set(fingerprint(h), h);

      const merged = Array.from(map.values());

      const localsOnly = merged.filter((h) => !isObjectId(h.id));
      await AsyncStorage.setItem(userKey, JSON.stringify(localsOnly));

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
    } catch (err) {
      Alert.alert('Load Error', 'Could not load history data.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [migrateLegacyIfNeeded, userKey, token]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  useEffect(() => {
    setShowReconnectBanner(false);
  }, []);

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

            if (token && isObjectId(id)) {
              await deleteReading('', id, token);
            }

            if (userKey) {
              const localsOnly = updated.filter((h) => !isObjectId(h.id));
              await AsyncStorage.setItem(userKey, JSON.stringify(localsOnly));
            }
          } catch (e) {
            Alert.alert('Delete Error', 'Could not delete this entry. Reloading history...');
            await loadHistory();
          }
        },
      },
    ]);
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No history yet</Text>
      <Text style={styles.emptyText}>
        Start by connecting your sensor and getting a recommendation.
      </Text>
    </View>
  );

  const renderOnePlanBox = (
    built: { stages: StageMap; totals: Record<string, number>; title: string; totalCostText: string },
    boxKey: string
  ) => {
    const { stages, totals, title, totalCostText } = built;

    const fertCodes = Array.from(
      new Set([
        ...Object.keys(stages.BASAL),
        ...Object.keys(stages.AFTER30),
        ...Object.keys(stages.TOPDRESS),
        ...Object.keys(totals),
      ])
    ).sort((a, b) => a.localeCompare(b));

    if (!fertCodes.length) return null;

    const row = (label: string, map: Record<string, number>, isHeader = false) => (
      <View style={[styles.planRow, isHeader && styles.planHeaderRow]}>
        <Text style={[styles.planCellStage, isHeader && styles.planHeaderText]}>{label}</Text>
        {fertCodes.map((code) => (
          <Text
            key={`${boxKey}-${label}-${code}`}
            style={[styles.planCell, isHeader && styles.planHeaderText]}
            numberOfLines={1}
          >
            {isHeader ? code : bagsFmt(map[code] || 0)}
          </Text>
        ))}
      </View>
    );

    return (
      <View key={boxKey} style={styles.planBoxNew}>
        <View style={styles.planTopLine}>
          <Text style={styles.planTitleNew}>{title}</Text>
          <Text style={styles.planCostNew}>{totalCostText}</Text>
        </View>

        {row('Stages', {}, true)}
        {row('Sa Pagtanom', stages.BASAL)}
        {row('Pagkahuman sa ika 30 nga adlaw', stages.AFTER30)}
        {row('Top Dress (60 days ayha sa pag harvest)', stages.TOPDRESS)}
        {row('Total Bags', totals)}
      </View>
    );
  };

  const renderAllPlans = (item: HistoryItem) => {
    const plans = Array.isArray(item.fertilizerPlans) ? item.fertilizerPlans : [];

    const boxes = plans
      .map((p, idx) => {
        const built = buildScheduleFromPlanDetails(p);
        if (!built) return null;
        return renderOnePlanBox(built, `${item.id}-plan-${idx}`);
      })
      .filter(Boolean);

    if (boxes.length) return <View style={{ gap: 10 }}>{boxes as any}</View>;

    const builtDa = buildScheduleFromDaSchedule(item);
    if (builtDa) return renderOnePlanBox(builtDa, `${item.id}-da`);

    return null;
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isExpanded = expandedId === item.id;

    // ✅ FIX: nutrient-specific LMH
    const levelN = classifyLevel('N', item.n_value);
    const levelP = classifyLevel('P', item.p_value);
    const levelK = classifyLevel('K', item.k_value);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.date}>{item.date || 'Unknown Date'}</Text>
            <Text style={styles.subText}>pH: {item.ph || 'N/A'}</Text>
            <Text style={styles.npkText}>
              N: {levelN} | P: {levelP} | K: {levelK}
              {item.npkClass ? `  •  ${item.npkClass}` : ''}
            </Text>
          </View>

          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color="#d32f2f" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.seeMoreBtn}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
        >
          <Text style={styles.seeMoreText}>
            {isExpanded ? 'Hide Fertilizer Plans' : 'See Fertilizer Plans'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#2e7d32"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.details}>
            {renderAllPlans(item) || (
              <Text style={styles.detailsText}>No fertilizer plans saved for this entry.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {showReconnectBanner && (
        <View style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>
            Back online? Fetching your latest recommendation…
          </Text>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={async () => {
              await loadHistory();
              setShowReconnectBanner(false);
            }}
          >
            <Text style={styles.reconnectBtnText}>I’m Online</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.topArc}>
        <Ionicons name="time-outline" size={26} color="#fff" />
        <Text style={styles.arcTitle}>History</Text>
      </View>

      {loading || !userKey ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: (insets.bottom || 0) + 90 }]}
          renderItem={renderItem}
          ListEmptyComponent={EmptyState}
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
    height: 120,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 30,
    marginBottom: 10,
  },
  arcTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 4 },

  list: { paddingHorizontal: 16 },

  reconnectBanner: {
    backgroundColor: '#e9f7ec',
    borderBottomWidth: StyleSheet.hairlineWidth ?? 1,
    borderBottomColor: '#cfe7d4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reconnectText: { color: '#1b5e20', fontSize: 13 },
  reconnectBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  reconnectBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1, marginRight: 8 },
  date: { fontWeight: 'bold', fontSize: 15, color: '#333', marginBottom: 2 },
  subText: { fontSize: 13, color: '#666' },
  npkText: { fontSize: 12, color: '#888', marginTop: 3 },
  deleteButton: { padding: 4 },

  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    marginRight: 4,
  },

  details: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailsText: { fontSize: 13, color: '#444', marginBottom: 3 },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 4,
  },
  emptyText: { fontSize: 14, color: '#777', textAlign: 'center' },
  loadingText: { color: '#555', marginTop: 8 },

  planBoxNew: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f1f8f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7eadb',
  },
  planTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  planTitleNew: { fontWeight: '700', fontSize: 13, color: '#1b5e20', flex: 1 },
  planCostNew: { fontWeight: '700', fontSize: 13, color: '#1b5e20' },

  planRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#dfeee2',
  },
  planHeaderRow: {
    backgroundColor: '#e8f5e9',
  },
  planCellStage: {
    flex: 2,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#2f3b30',
  },
  planCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 11,
    textAlign: 'center',
    color: '#2f3b30',
  },
  planHeaderText: {
    fontWeight: '700',
    color: '#1b5e20',
  },
});
