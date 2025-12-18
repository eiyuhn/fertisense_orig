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
  Platform,
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

type Nutrient = 'N' | 'P' | 'K';
function classifyLevel(nutrient: Nutrient, v?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'N/A';
  const ppm = Math.round(v);
  if (ppm <= 0) return 'N/A';

  if (nutrient === 'N') {
    if (ppm <= 110) return 'LOW';
    if (ppm <= 145) return 'MEDIUM';
    return 'HIGH';
  }
  if (nutrient === 'P') {
    if (ppm <= 315) return 'LOW';
    if (ppm <= 345) return 'MEDIUM';
    return 'HIGH';
  }
  if (ppm <= 150) return 'LOW';
  if (ppm <= 380) return 'MEDIUM';
  return 'HIGH';
}

const NBSP = '\u00A0';
const NBHY = '\u2011';

function displayCodeNoWrap(code: string) {
  return String(code || '').replace(/-/g, NBHY);
}

function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)}${NBSP}bags`;
}

type StageKey = 'ORGANIC' | 'BASAL' | 'AFTER30' | 'TOPDRESS';
type StageMap = Record<StageKey, Record<string, number>>;

function emptyStageMap(): StageMap {
  return { ORGANIC: {}, BASAL: {}, AFTER30: {}, TOPDRESS: {} };
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

function buildScheduleFromPlanDetails(plan?: { name?: string; cost?: string; details?: string[] }) {
  if (!plan) return null;
  const details = normalizeDetails(plan.details);
  if (!details.length) return null;

  const stages = emptyStageMap();
  const totals: Record<string, number> = {};
  let current: StageKey | null = null;

  const detectStage = (line: string): StageKey | null => {
    const s = line.toLowerCase();
    if (s.includes('organic') || s.includes('before planting') || s.includes('pre-plant')) return 'ORGANIC';
    if (s.includes('basal') || s.includes('sa pagtanim') || s.includes('sa pagtanom') || s.includes('pagtanom'))
      return 'BASAL';
    if (s.includes('30') || s.includes('after30') || s.includes('pagkatapos') || s.includes('pagkahuman') || s.includes('ika 30'))
      return 'AFTER30';
    if (s.includes('top dress') || s.includes('topdress') || s.includes('60') || s.includes('dbh') || s.includes('third'))
      return 'TOPDRESS';
    return null;
  };

  const parseLine = (line: string): { code: string; bags: number } | null => {
    const raw = String(line).trim();
    if (!raw) return null;

    let m = raw.match(/^([^:]+):\s*([0-9]+(\.[0-9]+)?)\s*bags?/i);
    if (m) return { code: String(m[1]).trim(), bags: Number(m[2]) };

    m = raw.match(/^(.+?)\s*[-–]\s*([0-9]+(\.[0-9]+)?)\s*bags?/i);
    if (m) return { code: String(m[1]).trim(), bags: Number(m[2]) };

    m = raw.match(/([0-9]{1,2}\s*-\s*[0-9]{1,2}\s*-\s*[0-9]{1,2}).*?([0-9]+(\.[0-9]+)?)\s*bags?/i);
    if (m) return { code: m[1].replace(/\s+/g, ''), bags: Number(m[2]) };

    m = raw.match(/^(organic fertilizer[^:]*)[:\-–]\s*([0-9]+(\.[0-9]+)?)\s*bags?/i);
    if (m) return { code: String(m[1]).trim(), bags: Number(m[2]) };

    return null;
  };

  for (const rawLine of details) {
    const line = String(rawLine).trim();
    if (!line) continue;

    const headerCandidate = line.replace(/:\s*$/, '').trim();
    const st = detectStage(headerCandidate);
    const parsed = parseLine(line);

    if (st && !parsed) {
      current = st;
      continue;
    }

    if (parsed && current) {
      addStage(stages[current], parsed.code, parsed.bags);
      addStage(totals, parsed.code, parsed.bags);
      continue;
    }

    if (parsed && !current) {
      addStage(stages.BASAL, parsed.code, parsed.bags);
      addStage(totals, parsed.code, parsed.bags);
    }
  }

  const any =
    Object.keys(stages.ORGANIC).length ||
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

function buildScheduleFromDaSchedule(item: HistoryItem) {
  const sch = (item as any)?.daSchedule;
  const cost = (item as any)?.daCost;
  const currency = (cost?.currency || item.currency || 'PHP') as string;
  const npkClass = (item as any)?.npkClass ? String((item as any).npkClass) : '';

  if (!sch) return null;

  const stages = emptyStageMap();
  const totals: Record<string, number> = {};

  const organicRaw = pickFirst(sch, ['organic', 'beforePlanting', 'prePlanting', 'organicApplication']);
  const basalRaw = pickFirst(sch, ['basal', 'saPagtanim', 'atPlanting', 'planting', 'basalApplication', 'basalApp']);
  const after30Raw = pickFirst(sch, ['after30DAT', 'after30Dat', 'after30', 'second', 'secondApplication', '30DAT', 'dat30', 'after30Days']);
  const topdressRaw = pickFirst(sch, ['topdress60DBH', 'topdress60dbh', 'topdress', 'third', 'topDress', '60DBH', 'dbh60', 'topdress60']);

  const organic = normalizeStageItems(organicRaw);
  const basal = normalizeStageItems(basalRaw);
  const after30 = normalizeStageItems(after30Raw);
  const topdress = normalizeStageItems(topdressRaw);

  organic.forEach((it) => { addStage(stages.ORGANIC, it.code, it.bags); addStage(totals, it.code, it.bags); });
  basal.forEach((it) => { addStage(stages.BASAL, it.code, it.bags); addStage(totals, it.code, it.bags); });
  after30.forEach((it) => { addStage(stages.AFTER30, it.code, it.bags); addStage(totals, it.code, it.bags); });
  topdress.forEach((it) => { addStage(stages.TOPDRESS, it.code, it.bags); addStage(totals, it.code, it.bags); });

  const totalCostText = cost?.total != null ? `${currency} ${Number(cost.total || 0).toFixed(2)}` : `${currency} 0.00`;
  const any =
    Object.keys(stages.ORGANIC).length ||
    Object.keys(stages.BASAL).length ||
    Object.keys(stages.AFTER30).length ||
    Object.keys(stages.TOPDRESS).length;

  if (!any) return null;
  return { stages, totals, title: `DA Recommendation${npkClass ? ` (${npkClass})` : ''}`, totalCostText };
}

const FERTILIZER_NAMES: Record<string, string> = {
  '46-0-0': 'Urea',
  '21-0-0': 'Ammosul',
  '0-0-60': 'Muriate of Potash (MOP)',
  '18-46-0': 'Diammonium Phosphate (DAP)',
  '16-20-0': 'Ammophos',
  '14-14-14': 'Complete Fertilizer',
  'Organic Fertilizer': 'Organic',
};

export default function HistoryScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    try { parsed = JSON.parse(stored); } catch { return []; }
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr
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
    const created = (r?.createdAt && new Date(r.createdAt)) || (r?.updatedAt && new Date(r.updatedAt)) || new Date();
    let dateStr = 'Unknown Date';
    try { dateStr = created.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch {}

    const pHNum =
      typeof r?.pH === 'number' && Number.isFinite(r.pH) ? r.pH :
      typeof r?.ph === 'number' && Number.isFinite(r.ph) ? r.ph : undefined;

    const phStat = phStatusLabel(pHNum);
    const phStr = pHNum !== undefined ? `${pHNum.toFixed(1)} (${phStat})` : 'N/A';

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
      recommendationText: typeof r?.recommendationText === 'string' ? r.recommendationText : '',
      englishText: typeof r?.englishText === 'string' ? r.englishText : undefined,
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
    return `${(h.date || '').trim()}|${phRound}|${h.n_value}|${h.p_value}|${h.k_value}|${(h.npkClass || '').trim()}`;
  };

  const loadHistory = useCallback(async () => {
    if (!userKey) { setHistory([]); setLoading(false); return; }
    setLoading(true);
    try {
      await migrateLegacyIfNeeded();
      const stored = await AsyncStorage.getItem(userKey);
      const localItems = parseLocalHistory(stored);

      let remoteItems: HistoryItem[] = [];
      if (token) {
        try {
          const remote = await listUserReadings(token);
          if (Array.isArray(remote)) remoteItems = remote.map(mapRemoteReadingToHistory);
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
    } catch {
      Alert.alert('Load Error', 'Could not load history data.');
    } finally {
      setLoading(false);
    }
  }, [migrateLegacyIfNeeded, userKey, token]);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

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

  const STAGES_LABELS: Record<StageKey, string> = {
    ORGANIC: 'Organic Fertilizer (14 - 30 days ayha sa pagtanom)',
    BASAL: 'Sa Pagtanom',
    AFTER30: 'Pagkahuman sa ika 30 na adlaw',
    TOPDRESS: 'Top Dress (60 days ayha sa pag harvest)',
  };

  function parseTitleParts(rawTitle: string) {
    const t = String(rawTitle || '').trim();
    const lower = t.toLowerCase();
    const isCheapest = lower.includes('cheapest');
    const cleaned = t.replace(/[-•|·]\s*cheapest\s*/i, ' ').replace(/\s{2,}/g, ' ').trim();
    return { titleMain: cleaned, isCheapest };
  }

  const renderOnePlanBox = (built: any, boxKey: string) => {
    const { stages, totals, title, totalCostText } = built;

    const { titleMain, isCheapest } = parseTitleParts(title);

    const fertCodes = Array.from(
      new Set([
        ...Object.keys(stages.ORGANIC),
        ...Object.keys(stages.BASAL),
        ...Object.keys(stages.AFTER30),
        ...Object.keys(stages.TOPDRESS),
        ...Object.keys(totals),
      ])
    ).sort((a, b) => a.localeCompare(b));

    if (!fertCodes.length) return null;

    // ✅ show hint only if table has many columns (meaning it will scroll)
    const shouldHint = fertCodes.length >= 3;

    const row = (label: string, map: Record<string, number>, isHeader = false) => (
      <View style={[styles.planRow, isHeader && styles.planHeaderRow]}>
        <View style={styles.planCellStageFixed}>
          <Text style={[styles.stageText, isHeader && styles.planHeaderText]} numberOfLines={isHeader ? 1 : 3}>
            {label}
          </Text>
        </View>

        {fertCodes.map((code) => (
          <View key={`${boxKey}-${label}-${code}`} style={styles.planCellFixed}>
            {isHeader ? (
              <View style={styles.headerCellWrap}>
                <Text style={[styles.planHeaderText, styles.headerCode]} numberOfLines={1}>
                  {displayCodeNoWrap(code)}
                </Text>
                <Text style={styles.headerName} numberOfLines={2}>
                  {FERTILIZER_NAMES[code] || 'Fertilizer'}
                </Text>
              </View>
            ) : (
              <Text style={styles.cellValue} numberOfLines={1}>
                {bagsFmt(map[code] || 0)}
              </Text>
            )}
          </View>
        ))}
      </View>
    );

    return (
      <View key={boxKey} style={styles.planBoxNew}>
        <View style={styles.planHeaderBlock}>
          <View style={styles.planHeaderLine}>
            <Text style={styles.planTitleNew} numberOfLines={2}>
              {titleMain}
            </Text>
            <Text style={styles.planCostNew} numberOfLines={1}>
              {totalCostText}
            </Text>
          </View>

          {isCheapest ? (
            <View style={styles.cheapestRow}>
              <Text style={styles.cheapestChip}>Cheapest</Text>
            </View>
          ) : null}
        </View>

        

        {/* ✅ Horizontal scroll indicator ON */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          indicatorStyle={Platform.OS === 'ios' ? 'black' : undefined}
        >
          <View>
            {row('Stages', {}, true)}
            {row(STAGES_LABELS.ORGANIC, stages.ORGANIC)}
            {row(STAGES_LABELS.BASAL, stages.BASAL)}
            {row(STAGES_LABELS.AFTER30, stages.AFTER30)}
            {row(STAGES_LABELS.TOPDRESS, stages.TOPDRESS)}
            {row('Total Bags', totals)}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderAllPlans = (item: HistoryItem) => {
    const plans = Array.isArray(item.fertilizerPlans) ? item.fertilizerPlans : [];
    const boxes = plans
      .map((p, idx) => {
        const built = buildScheduleFromPlanDetails(p);
        return built ? renderOnePlanBox(built, `${item.id}-plan-${idx}`) : null;
      })
      .filter(Boolean);

    if (boxes.length) return <View style={{ gap: 10 }}>{boxes as any}</View>;

    const builtDa = buildScheduleFromDaSchedule(item);
    return builtDa ? renderOnePlanBox(builtDa, `${item.id}-da`) : null;
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.subText}>pH: {item.ph}</Text>
            <Text style={styles.npkText}>
              N:{classifyLevel('N', item.n_value)} | P:{classifyLevel('P', item.p_value)} | K:{classifyLevel('K', item.k_value)}
            </Text>
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
            {renderAllPlans(item) || <Text style={styles.detailsText}>No plans saved.</Text>}
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

const STAGE_COL_W = 170;
const COL_W = 120;

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
  subText: { fontSize: 12, color: '#666' },
  npkText: { fontSize: 11, color: '#888' },
  deleteButton: { padding: 4 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  seeMoreText: { fontSize: 12, fontWeight: '600', color: '#2e7d32', marginRight: 4 },
  details: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  detailsText: { fontSize: 12, color: '#666' },
  loadingText: { marginTop: 8, color: '#666' },

  planBoxNew: {
    marginTop: 5,
    padding: 8,
    backgroundColor: '#f1f8f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7eadb',
  },

  planHeaderBlock: { marginBottom: 8 },
  planHeaderLine: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  planTitleNew: { flex: 1, fontWeight: 'bold', fontSize: 12, color: '#1b5e20' },
  planCostNew: { fontWeight: 'bold', fontSize: 12, color: '#1b5e20' },
  cheapestRow: { marginTop: 6 },
  cheapestChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#b9dfbf',
    color: '#1b5e20',
    fontWeight: '700',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },

  // ✅ Swipe hint styles
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 6,
    opacity: 0.8,
  },
  scrollHintText: {
    fontSize: 10,
    color: '#2e7d32',
    marginHorizontal: 6,
    fontWeight: '600',
  },

  planRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#dfeee2',
    paddingVertical: 8,
    alignItems: 'center',
  },
  planHeaderRow: { backgroundColor: '#e8f5e9' },

  planCellStageFixed: {
    width: STAGE_COL_W,
    paddingRight: 8,
    justifyContent: 'center',
  },
  stageText: { fontSize: 10, color: '#333' },

  planCellFixed: {
    width: COL_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  planHeaderText: { fontWeight: 'bold', color: '#1b5e20' },
  headerCellWrap: { alignItems: 'center' },
  headerCode: { fontSize: 11, textAlign: 'center' },
  headerName: { fontSize: 9, color: '#444', textAlign: 'center' },
  cellValue: { fontSize: 10, textAlign: 'center' },
});
