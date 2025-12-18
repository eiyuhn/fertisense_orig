// app/(admin)/tabs/logs.tsx
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';

import {
  deleteFarmer as deleteFarmerApi,
  deleteReading as deleteReadingApi,
  listFarmers as listFarmersApi,
  listReadingsByFarmer as listReadingsApi,
} from '../../../src/services';

import { useReadingSession } from '../../../context/ReadingSessionContext';
import { useAuth } from '../../../context/AuthContext';

type Farmer = {
  _id?: string;
  id?: string;
  name: string;
  farmLocation?: string;
  farmSize?: number;
  farmType?: string;
  palayType?: string;
  plantingStyle?: string;
  updatedAt?: string;
};

type FertilizerPlan = {
  name?: string;
  cost?: string;
  details?: string[];
};

type Reading = {
  _id?: string;
  id?: string;
  farmerId?: string;
  createdAt?: string;
  updatedAt?: string;

  npk?: { N?: number; P?: number; K?: number };
  N?: number;
  P?: number;
  K?: number;
  n?: number;
  p?: number;
  k?: number;

  ph?: number | null;
  pH?: number | null;

  ec?: number | null;
  moisture?: number | null;
  temp?: number | null;

  fertilizerPlans?: FertilizerPlan[];
  recommendationText?: string;
  englishText?: string;
  currency?: string;
  npkClass?: string;

  daSchedule?: any;
  daCost?: any;
};

const GREEN = '#1b5e20';
const CARD_BORDER = '#e7ece9';
const TEXT_PRIMARY = '#1b1b1b';
const TEXT_MUTED = '#636e65';

const FARMERS_CACHE_KEY = 'fertisense:farmers';
const READINGS_CACHE_PREFIX = 'fertisense:readings:'; // + farmerId

// ✅ Correct Expo Router paths (always absolute)
const ROUTE_CONNECT = '/admin/tabs/connect-instructions';
const ROUTE_ADD_FARMER = '/admin/tabs/add-farmer';
const ROUTE_RECOMMENDATION = '/admin/screens/recommendation';

const getFarmerId = (f: Farmer) => f._id || f.id || '';
const getReadingId = (r: Reading) => r._id || r.id || '';

async function getFarmersCache(): Promise<Farmer[]> {
  try {
    const raw = await AsyncStorage.getItem(FARMERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setFarmersCache(farmers: Farmer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(farmers));
  } catch {}
}

async function getReadingsCache(fid: string): Promise<Reading[]> {
  try {
    const raw = await AsyncStorage.getItem(READINGS_CACHE_PREFIX + fid);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setReadingsCache(fid: string, readings: Reading[]): Promise<void> {
  try {
    await AsyncStorage.setItem(READINGS_CACHE_PREFIX + fid, JSON.stringify(readings));
  } catch {}
}

async function removeFarmerFromCache(fid: string): Promise<void> {
  try {
    const list = await getFarmersCache();
    const next = list.filter((f) => getFarmerId(f) !== fid);
    await setFarmersCache(next);
    await AsyncStorage.removeItem(READINGS_CACHE_PREFIX + fid);
  } catch {}
}

/* ================================
   ✅ UPDATED LMH (ppm thresholds)
   ================================ */
const THRESH = {
  N: { L: 110, M: 145 },
  P: { L: 315, M: 345 },
  K: { L: 150, M: 380 },
} as const;

type Nutrient = keyof typeof THRESH;
type LMH = 'Low' | 'Medium' | 'High' | 'N/A';

function classifyLevel(nutrient: Nutrient, ppm: any): LMH {
  const v = Number(ppm);
  if (!Number.isFinite(v) || v <= 0) return 'N/A';

  const x = Math.round(v);
  const t = THRESH[nutrient];

  if (x < t.L) return 'Low';
  if (x <= t.M) return 'Medium';
  return 'High';
}

const lmhN = (ppm: any) => classifyLevel('N', ppm);
const lmhP = (ppm: any) => classifyLevel('P', ppm);
const lmhK = (ppm: any) => classifyLevel('K', ppm);

const pickReadingN = (r?: Reading | null) => r?.npk?.N ?? r?.N ?? r?.n;
const pickReadingP = (r?: Reading | null) => r?.npk?.P ?? r?.P ?? r?.p;
const pickReadingK = (r?: Reading | null) => r?.npk?.K ?? r?.K ?? r?.k;
const pickReadingPh = (r?: Reading | null) => r?.ph ?? r?.pH ?? null;

function sortByNewest(arr: Reading[]) {
  return [...arr].sort(
    (a, b) =>
      new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
      new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
  );
}

function getPlans(r?: Reading | null): FertilizerPlan[] {
  if (!r) return [];
  const p = (r as any)?.fertilizerPlans;
  return Array.isArray(p) ? p : [];
}

/* =========================================================
   ✅ TABLE BUILDERS (robust)
   ========================================================= */

function normalizeDetails(details?: string[]): string[] {
  if (!Array.isArray(details)) return [];
  return details
    .map((d) => String(d ?? '').trim())
    .filter(Boolean)
    .map((d) => d.replace(/^•\s*/, '').replace(/^\-\s*/, '').trim());
}

type StageKey = 'ORGANIC' | 'BASAL' | 'AFTER30' | 'TOPDRESS';
type StageMap = Record<StageKey, Record<string, number>>;

function emptyStageMap(): StageMap {
  return { ORGANIC: {}, BASAL: {}, AFTER30: {}, TOPDRESS: {} };
}

function addAmount(map: Record<string, number>, code: string, bags: number) {
  const b = Number(bags ?? 0);
  if (!Number.isFinite(b)) return;
  map[code] = (map[code] || 0) + b;
}

function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}

/**
 * ✅ SUPER-ROBUST fertilizer line parsing:
 * Supports:
 * - "46-0-0: 2"
 * - "46-0-0 - 2 bags"
 * - "46–0–0 = 2.50"
 * - "UREA_46_0_0: 2"
 * - "At Planting: 0-0-60: 2 bags"
 * - "Organic: 14-14-14: 1"
 */
function parseFertLineLoose(line: string): { code: string; bags: number } | null {
  const s = String(line)
    .trim()
    .replace(/^•\s*/, '')
    .replace(/^\-\s*/, '')
    .trim();

  // 1) NPK dash code
  const npk = s.match(
    /([0-9]{1,2}\s*[-–]\s*[0-9]{1,2}\s*[-–]\s*[0-9]{1,2})\s*(?:[:=\-]\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:bag|bags)?/i
  );
  if (npk) {
    const code = String(npk[1]).replace(/\s*/g, '').replace(/–/g, '-');
    const bags = Number(npk[2]);
    return { code, bags: Number.isFinite(bags) ? bags : 0 };
  }

  // 2) coded IDs like UREA_46_0_0
  const coded = s.match(
    /([A-Z]{2,}_[0-9]{1,2}_[0-9]{1,2}_[0-9]{1,2})\s*(?:[:=\-]\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:bag|bags)?/i
  );
  if (coded) {
    const code = String(coded[1]).trim();
    const bags = Number(coded[2]);
    return { code, bags: Number.isFinite(bags) ? bags : 0 };
  }

  return null;
}

function detectStage(line: string): StageKey | null {
  const s = String(line).toLowerCase();

  if (s.includes('organic') || s.includes('org')) return 'ORGANIC';

  if (
    s.includes('basal') ||
    s.includes('at planting') ||
    s.includes('planting') ||
    s.includes('sa pagtanim') ||
    s.includes('pagtanim') ||
    s.includes('pag tanom')
  ) {
    return 'BASAL';
  }

  if (s.includes('after 30') || s.includes('30 days') || s.includes('ika 30') || s.includes('30 na adlaw')) {
    return 'AFTER30';
  }

  if (s.includes('top dress') || s.includes('topdress') || s.includes('dbh') || s.includes('60')) {
    return 'TOPDRESS';
  }

  return null;
}

function buildTableFromPlanDetails(plan: FertilizerPlan) {
  const details = normalizeDetails(plan.details);
  const stages = emptyStageMap();
  const totals: Record<string, number> = {};
  const codeSet = new Set<string>();

  let currentStage: StageKey | null = null;

  for (const raw of details) {
    const line = String(raw).trim();
    if (!line) continue;

    const st = detectStage(line.replace(/:\s*$/, '').trim());
    if (st && !parseFertLineLoose(line)) {
      currentStage = st;
      continue;
    }

    const parsed = parseFertLineLoose(line);
    if (parsed) {
      const { code, bags } = parsed;

      codeSet.add(code);

      const inlineStage = detectStage(line);
      const stageToUse: StageKey = inlineStage || currentStage || 'BASAL';

      addAmount(stages[stageToUse], code, bags);
      addAmount(totals, code, bags);
    }
  }

  const fertCodes = Array.from(codeSet).sort((a, b) => a.localeCompare(b));
  const hasAny = fertCodes.length > 0;
  const hasRaw = details.length > 0;

  for (const code of fertCodes) {
    if (stages.ORGANIC[code] == null) stages.ORGANIC[code] = 0;
    if (stages.BASAL[code] == null) stages.BASAL[code] = 0;
    if (stages.AFTER30[code] == null) stages.AFTER30[code] = 0;
    if (stages.TOPDRESS[code] == null) stages.TOPDRESS[code] = 0;
    if (totals[code] == null) totals[code] = 0;
  }

  return { fertCodes, stages, totals, hasAny, rawDetails: details, hasRaw };
}

function pickFirst(obj: any, keys: string[]) {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
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

        const c = String(code ?? '').trim().replace(/\s*/g, '');
        const b = Number(bags ?? 0);

        return { code: c, bags: Number.isFinite(b) ? b : 0 };
      })
      .filter((x) => x.code);
  }
  if (typeof stage === 'object') {
    return Object.entries(stage).map(([k, v]) => ({
      code: String(k).trim().replace(/\s*/g, ''),
      bags: Number(v ?? 0),
    }));
  }
  return [];
}

// Fallback builder if fertilizerPlans missing: convert daSchedule → pseudo plan.details
function buildPseudoPlansFromDaSchedule(r: Reading): FertilizerPlan[] {
  const sch = (r as any)?.daSchedule;
  if (!sch) return [];

  const organicRaw = pickFirst(sch, ['organic', 'org', 'organicFertilizer']);
  const basalRaw = pickFirst(sch, ['basal', 'saPagtanim', 'atPlanting', 'planting', 'basalApplication', 'basalApp']);
  const after30Raw = pickFirst(sch, ['after30DAT', 'after30Dat', 'after30', 'second', 'secondApplication', '30DAT']);
  const topdressRaw = pickFirst(sch, ['topdress60DBH', 'topdress60dbh', 'topdress', 'third', 'topDress', '60DBH']);

  const organic = normalizeStageItems(organicRaw);
  const basal = normalizeStageItems(basalRaw);
  const after30 = normalizeStageItems(after30Raw);
  const topdress = normalizeStageItems(topdressRaw);

  const lines: string[] = [];
  lines.push('Organic Fertilizer:');
  organic.forEach((it) => lines.push(`${it.code}: ${Number(it.bags || 0).toFixed(2)} bags`));

  lines.push('At Planting:');
  basal.forEach((it) => lines.push(`${it.code}: ${Number(it.bags || 0).toFixed(2)} bags`));

  lines.push('After 30 Days:');
  after30.forEach((it) => lines.push(`${it.code}: ${Number(it.bags || 0).toFixed(2)} bags`));

  lines.push('Top Dress:');
  topdress.forEach((it) => lines.push(`${it.code}: ${Number(it.bags || 0).toFixed(2)} bags`));

  const currency = ((r as any)?.daCost?.currency || r.currency || 'PHP') as string;
  const totalCost = Number((r as any)?.daCost?.total ?? 0);
  const costText = `${currency} ${Number.isFinite(totalCost) ? totalCost.toFixed(2) : '0.00'}`;

  const npkClass = (r?.npkClass ? String(r.npkClass) : '').trim();
  const title = `Saved Recommendation${npkClass ? ` • ${npkClass}` : ''}`;

  return [{ name: title, cost: costText, details: lines }];
}

function fmtPh(v: any) {
  if (v === null || v === undefined) return '0.00';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

const toNum = (v: any): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

// ✅ universal safe caller (handles different services signatures)
async function callApi<T = any>(fn: any, args: any[]): Promise<T> {
  if (typeof fn !== 'function') throw new Error('Service function not found');
  try {
    return await fn(...args);
  } catch (e) {
    if (args.length >= 1) {
      try {
        return await fn(...args.filter((x) => x !== undefined && x !== null));
      } catch (e2) {
        throw e2;
      }
    }
    throw e;
  }
}

/* =========================================================
   ✅ Stakeholder-style horizontal table UI helpers
   ========================================================= */
const STAGE_COL_W = 190;
const COL_W = 130;

const FERTILIZER_NAMES: Record<string, string> = {
  '46-0-0': 'Urea',
  '21-0-0': 'Ammosul',
  '0-0-60': 'Muriate of Potash (MOP)',
  '18-46-0': 'Diammonium Phosphate (DAP)',
  '16-20-0': 'Ammophos',
  '14-14-14': 'Complete Fertilizer',
  'Organic Fertilizer': 'Organic Fertilizer',
};

function ScrollProgress({ progress01 }: { progress01: number }) {
  const p = Math.max(0, Math.min(1, Number(progress01 || 0)));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressThumb, { width: `${Math.max(15, p * 100)}%` }]} />
    </View>
  );
}

function PlanTableCardAdmin({
  plan,
  idx,
  currencyFallback,
  readingId,
}: {
  plan: FertilizerPlan;
  idx: number;
  currencyFallback?: string | null;
  readingId: string;
}) {
  const { fertCodes, stages, totals, hasAny, rawDetails, hasRaw } = buildTableFromPlanDetails(plan);

  const optionLabel = `Fertilization Recommendation Option ${idx + 1}`;
  const contentWidth = STAGE_COL_W + fertCodes.length * COL_W;

  const [progress01, setProgress01] = React.useState(0);

  const safeCost = String(plan?.cost || '').trim();
  const safeTitle = String(plan?.name || `Plan ${idx + 1}`).trim();

  if (!hasAny) {
    return (
      <View style={styles.planBoxNew}>
        <View style={styles.planTopLine}>
          <Text style={styles.planTitleNew}>{safeTitle}</Text>
          <Text style={styles.planCostNew}>{safeCost}</Text>
        </View>

        <Text style={styles.detailsText}>Could not build a table from this plan (format not recognized).</Text>

        {hasRaw ? (
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.detailsText, { fontWeight: '700' }]}>Raw details:</Text>
            {rawDetails.slice(0, 30).map((d, i) => (
              <Text key={`${readingId}-${idx}-raw-${i}`} style={[styles.detailsText, { marginBottom: 2 }]}>
                • {d}
              </Text>
            ))}
            {rawDetails.length > 30 ? <Text style={styles.recHint}>Showing first 30 lines only.</Text> : null}
          </View>
        ) : (
          <Text style={styles.recHint}>No details found in this plan.</Text>
        )}
      </View>
    );
  }

  const stageBags = (map: Record<string, number>, code: string) => Number(map?.[code] || 0);

  const rowStage = (label: string, map: Record<string, number>) => (
    <View style={styles.tableRow}>
      <View style={styles.stageCell}>
        <Text style={styles.stageText}>{label}</Text>
      </View>
      {fertCodes.map((code) => (
        <View key={`${readingId}-${idx}-${label}-${code}`} style={styles.fertCell}>
          <Text style={styles.bagsText} numberOfLines={1}>
            {bagsFmt(stageBags(map, code))}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tableTitle}>{optionLabel}</Text>
          <Text style={[styles.detailsText, { marginTop: 2 }]} numberOfLines={1}>
            {safeTitle}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceTag} numberOfLines={1}>
            {safeCost || `${currencyFallback || 'PHP'} 0.00`}
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
              <View key={`${readingId}-${idx}-hdr-${code}`} style={styles.fertHeaderCell}>
                <Text style={styles.headerCodeText} numberOfLines={1}>
                  {code}
                </Text>
                <Text style={styles.headerNameText} numberOfLines={2}>
                  {FERTILIZER_NAMES[code] || 'Fertilizer'}
                </Text>
              </View>
            ))}
          </View>

          {rowStage('Organic', stages.ORGANIC)}
          {rowStage('At Planting', stages.BASAL)}
          {rowStage('After 30 Days', stages.AFTER30)}
          {rowStage('Top Dress', stages.TOPDRESS)}

          <View style={[styles.tableRow, styles.tableFooter]}>
            <View style={[styles.stageCell, styles.stageFooterCell]}>
              <Text style={styles.totalStageText}>Total Bags</Text>
            </View>
            {fertCodes.map((code) => (
              <View key={`${readingId}-${idx}-tot-${code}`} style={[styles.fertCell, styles.footerFertCell]}>
                <Text style={styles.totalBagsText} numberOfLines={1}>
                  {bagsFmt(Number(totals?.[code] || 0))}
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

export default function LogsScreen() {
  const router = useRouter();
  const { setFromParams } = useReadingSession();
  const { token } = useAuth();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [latest, setLatest] = useState<Record<string, Reading | null>>({});
  const [readingsByFarmer, setReadingsByFarmer] = useState<Record<string, Reading[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const [recOpenLatest, setRecOpenLatest] = useState<Record<string, boolean>>({});
  const [recOpenReading, setRecOpenReading] = useState<Record<string, boolean>>({});

  const toggleLatestRec = (fid: string) => setRecOpenLatest((s) => ({ ...s, [fid]: !s[fid] }));
  const toggleReadingRec = (key: string) => setRecOpenReading((s) => ({ ...s, [key]: !s[key] }));

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
    });
    return () => sub && sub();
  }, []);

  const loadFarmersAndLatest = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1) load local first (fast)
      const fsLocal = await getFarmersCache();
      if (fsLocal.length) setFarmers(fsLocal);

      const localLatestMap: Record<string, Reading | null> = {};
      const localAllMap: Record<string, Reading[]> = {};

      for (const f of fsLocal) {
        const fid = getFarmerId(f);
        if (!fid) continue;
        const rsLocal = sortByNewest(await getReadingsCache(fid));
        localAllMap[fid] = rsLocal;
        localLatestMap[fid] = rsLocal[0] ?? null;
      }

      if (Object.keys(localAllMap).length) setReadingsByFarmer((prev) => ({ ...prev, ...localAllMap }));
      if (Object.keys(localLatestMap).length) setLatest((prev) => ({ ...prev, ...localLatestMap }));

      // 2) if online, refresh from API
      if (isOnline && token) {
        const fs = await callApi<Farmer[]>(listFarmersApi as any, [token]);
        if (Array.isArray(fs)) {
          setFarmers(fs);
          await setFarmersCache(fs);

          const onlineLatestMap: Record<string, Reading | null> = {};
          const onlineAllMap: Record<string, Reading[]> = {};

          for (const f of fs) {
            const fid = getFarmerId(f);
            if (!fid) continue;

            try {
              let rs = await callApi<Reading[]>(listReadingsApi as any, [fid, token]);
              if (!Array.isArray(rs)) rs = [];
              rs = sortByNewest(rs);

              onlineAllMap[fid] = rs;
              onlineLatestMap[fid] = rs[0] ?? null;
              await setReadingsCache(fid, rs);
            } catch {
              const rsLocal = sortByNewest(await getReadingsCache(fid));
              onlineAllMap[fid] = rsLocal;
              onlineLatestMap[fid] = rsLocal[0] ?? null;
            }
          }

          setReadingsByFarmer((prev) => ({ ...prev, ...onlineAllMap }));
          setLatest(onlineLatestMap);
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, token]);

  useEffect(() => {
    loadFarmersAndLatest();
  }, [loadFarmersAndLatest]);

  useFocusEffect(
    useCallback(() => {
      loadFarmersAndLatest();
    }, [loadFarmersAndLatest])
  );

  const toggleExpand = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  // ✅ CONNECT button from Logs -> Admin Connect Instructions (passes farmer)
  const onConnect = (f: Farmer) => {
    const fid = getFarmerId(f);
    router.push({
      pathname: ROUTE_CONNECT as any,
      params: { farmerId: fid, farmerName: f.name },
    });
  };

  const onEdit = (f: Farmer) => {
    const fid = getFarmerId(f);
    router.push({
      pathname: ROUTE_ADD_FARMER as any,
      params: { edit: fid, ts: Date.now().toString() },
    });
  };

  // ✅ Open recommendation using a saved reading (sets ReadingSessionContext)
  const openRecommendationForReading = useCallback(
    async (f: Farmer, r: Reading) => {
      const fid = getFarmerId(f);
      const farmerName = (f?.name || '').trim();

      const n = toNum(pickReadingN(r));
      const p = toNum(pickReadingP(r));
      const k = toNum(pickReadingK(r));
      const ph = toNum(pickReadingPh(r));

      const ts = r?.createdAt
        ? new Date(r.createdAt).getTime()
        : r?.updatedAt
        ? new Date(r.updatedAt).getTime()
        : Date.now();

      if (!n && !p && !k) {
        Alert.alert('No Reading', 'This reading has no valid NPK values.');
        return;
      }

      try {
        await setFromParams({
          n,
          p,
          k,
          ph,
          farmerId: String(fid || r?.farmerId || ''),
          farmerName,
          ts,
        });

        router.push(ROUTE_RECOMMENDATION as any);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to open recommendation.');
      }
    },
    [router, setFromParams]
  );

  const onDeleteFarmer = (f: Farmer) => {
    const fid = getFarmerId(f);
    Alert.alert('Delete Farmer', `Delete "${f.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setFarmers((prev) => prev.filter((x) => getFarmerId(x) !== fid));
          setLatest((prev) => {
            const copy = { ...prev };
            delete copy[fid];
            return copy;
          });
          setReadingsByFarmer((prev) => {
            const copy = { ...prev };
            delete copy[fid];
            return copy;
          });
          await removeFarmerFromCache(fid);

          if (isOnline && token) {
            try {
              await callApi(deleteFarmerApi as any, [fid, token]);
              Alert.alert('Deleted', `${f.name} removed.`);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Failed to delete farmer online.');
            }
          } else {
            Alert.alert('Offline', 'Removed locally. It will remain removed in this device cache.');
          }
        },
      },
    ]);
  };

  const onDeleteLatestReading = async (f: Farmer) => {
    const fid = getFarmerId(f);
    const currentLatest = latest[fid];
    if (!currentLatest) return;
    const rid = getReadingId(currentLatest);

    Alert.alert('Delete Reading', 'Delete the latest reading for this farmer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setReadingsByFarmer((prev) => {
            const list = prev[fid] || [];
            const filtered = list.filter((r) => getReadingId(r) !== rid);

            setLatest((old) => ({ ...old, [fid]: filtered[0] ?? null }));
            setReadingsCache(fid, filtered);
            return { ...prev, [fid]: filtered };
          });

          if (!isOnline || !token || !rid) {
            Alert.alert('Offline', 'Removed from local cache.');
            return;
          }

          try {
            try {
              await callApi(deleteReadingApi as any, [fid, rid, token]);
            } catch {
              await callApi(deleteReadingApi as any, [rid, token]);
            }

            try {
              let rs = await callApi<Reading[]>(listReadingsApi as any, [fid, token]);
              if (!Array.isArray(rs)) rs = [];
              rs = sortByNewest(rs);

              setReadingsByFarmer((prev) => ({ ...prev, [fid]: rs }));
              setLatest((prev) => ({ ...prev, [fid]: rs[0] ?? null }));
              await setReadingsCache(fid, rs);
            } catch {}

            Alert.alert('Deleted', 'Latest reading removed.');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Failed to delete reading online.');
          }
        },
      },
    ]);
  };

  const sortedFarmers = useMemo(() => {
    const copy = [...farmers];
    copy.sort((a, b) =>
      sortAsc
        ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    );
    return copy;
  }, [farmers, sortAsc]);

  const HeaderBar = () => (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Farmer Logs</Text>
      <TouchableOpacity onPress={() => setSortAsc((s) => !s)} style={[styles.headerIcon, { opacity: 0.95 }]}>
        <Ionicons name="swap-vertical" size={20} color="#fff" />
        <Text style={styles.headerSortText}>{sortAsc ? 'A-Z' : 'Z-A'}</Text>
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.listHeaderWrap}>
      <HeaderBar />
      <View style={styles.onlineRow}>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#6ecf78' : '#ff6b6b' }]} />
        <Text style={styles.onlineText}>{isOnline ? 'Online' : 'Offline cache'}</Text>
      </View>
    </View>
  );

  const PlansDropdown = ({
    title,
    reading,
    open,
    onToggle,
  }: {
    title: string;
    reading: Reading | null;
    open: boolean;
    onToggle: () => void;
  }) => {
    if (!reading) return <Text style={styles.noRecText}>No recommendation saved.</Text>;

    let plans = getPlans(reading);
    if (!plans.length) plans = buildPseudoPlansFromDaSchedule(reading);
    if (!plans.length) return <Text style={styles.noRecText}>No recommendation saved.</Text>;

    const rid = getReadingId(reading) || 'rid';

    return (
      <View style={styles.recWrap}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.9} style={styles.recHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="leaf" size={16} color="#2e7d32" />
            <Text style={styles.recHeaderTitle}>{title}</Text>
            <Text style={styles.recCount}>({plans.length})</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#2e7d32" />
        </TouchableOpacity>

        {open && (
          <View style={styles.recBody}>
            {plans.slice(0, 3).map((p, i) => {
              const boxKey = `${rid}-${i}-${p?.name || 'plan'}`;
              return (
                <View key={boxKey} style={{ marginBottom: 10 }}>
                  <PlanTableCardAdmin
                    plan={p}
                    idx={i}
                    currencyFallback={(reading as any)?.currency || 'PHP'}
                    readingId={rid}
                  />
                </View>
              );
            })}

            {plans.length > 3 && <Text style={styles.recHint}>Showing first 3 plans only.</Text>}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item: f }: { item: Farmer }) => {
    const fid = getFarmerId(f);
    const r = latest[fid];
    const open = !!expanded[fid];

    const allForFarmer = readingsByFarmer[fid] || [];
    const totalCount = allForFarmer.length;

    const phVal = pickReadingPh(r);
    const nVal = pickReadingN(r);
    const pVal = pickReadingP(r);
    const kVal = pickReadingK(r);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.farmerName}>{f.name}</Text>

          <View style={styles.rightIcons}>
            <TouchableOpacity onPress={() => onConnect(f)} style={styles.iconTap}>
              <Ionicons name="scan-circle-outline" size={18} color={GREEN} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onEdit(f)} style={styles.iconTap}>
              <Ionicons name="pencil" size={18} color={GREEN} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onDeleteFarmer(f)} style={styles.iconTap}>
              <Ionicons name="trash" size={18} color="#d32f2f" />
            </TouchableOpacity>
          </View>
        </View>

        {!!f.farmLocation && (
          <Text style={styles.detailRow}>
            📍 Location: <Text style={styles.bold}>{f.farmLocation}</Text>
          </Text>
        )}
        {!!f.farmSize && (
          <Text style={styles.detailRow}>
            📏 Area: <Text style={styles.bold}>{f.farmSize} hectares</Text>
          </Text>
        )}
        {!!f.palayType && (
          <Text style={styles.detailRow}>
            🌾 Variety: <Text style={styles.bold}>{f.palayType}</Text>
          </Text>
        )}
        {!!f.farmType && (
          <Text style={styles.detailRow}>
            💧 Method: <Text style={styles.bold}>{f.farmType}</Text>
          </Text>
        )}

        <View style={styles.thinDivider} />

        <TouchableOpacity onPress={() => toggleExpand(fid)} style={styles.moreRow}>
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={GREEN} />
          <Text style={styles.moreText}>View More</Text>
        </TouchableOpacity>

        {open && (
          <View style={styles.expandedBox}>
            <Text style={styles.expTitle}>🧪 Latest Reading</Text>
            <Text style={styles.expRow}>
              🗓 Date: {r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.expRow}>💧 pH: {fmtPh(phVal)}</Text>
            <Text style={styles.expRow}>Nitrogen (N): {lmhN(nVal)}</Text>
            <Text style={styles.expRow}>Phosphorus (P): {lmhP(pVal)}</Text>
            <Text style={styles.expRow}>Potassium (K): {lmhK(kVal)}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity
                style={styles.openRecBtn}
                onPress={() => {
                  if (!r) {
                    Alert.alert('No Reading', 'No latest reading available.');
                    return;
                  }
                  openRecommendationForReading(f, r);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={styles.openRecText}>Open Recommendation</Text>
              </TouchableOpacity>
            </View>

            <PlansDropdown
              title="Fertilizer Plans"
              reading={r ?? null}
              open={!!recOpenLatest[fid]}
              onToggle={() => toggleLatestRec(fid)}
            />

            <Text style={[styles.expRow, { marginTop: 8, fontWeight: '700' }]}>Total readings: {totalCount}</Text>

            <View style={styles.allBox}>
              <Text style={styles.allTitle}>All readings (latest first)</Text>

              {totalCount === 0 && <Text style={styles.noReadingText}>No readings yet for this farmer.</Text>}

              {totalCount > 0 &&
                allForFarmer.map((rr, idx) => {
                  const rid = getReadingId(rr) || `idx_${idx}`;
                  const key = `${fid}:${rid}`;

                  return (
                    <View key={rid} style={styles.allRow}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.allIndex}>
                          #{idx + 1} {idx === 0 ? <Text style={styles.latestTag}>(latest)</Text> : null}
                        </Text>

                        <TouchableOpacity
                          style={styles.openRecBtnSmall}
                          onPress={() => openRecommendationForReading(f, rr)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="open-outline" size={14} color="#fff" />
                          <Text style={styles.openRecTextSmall}>Open</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.allDate}>🗓 {rr.createdAt ? new Date(rr.createdAt).toLocaleDateString() : '—'}</Text>

                      <Text style={styles.allLine}>
                        N: {lmhN(pickReadingN(rr))} | P: {lmhP(pickReadingP(rr))} | K: {lmhK(pickReadingK(rr))}
                      </Text>

                      <Text style={styles.allLine}>pH: {fmtPh(pickReadingPh(rr))}</Text>

                      <PlansDropdown
                        title="Fertilizer Plans"
                        reading={rr}
                        open={!!recOpenReading[key]}
                        onToggle={() => toggleReadingRec(key)}
                      />
                    </View>
                  );
                })}
            </View>

            <View style={styles.expActions}>
              {r ? (
                <TouchableOpacity onPress={() => onDeleteLatestReading(f)} style={styles.deleteLatestBtn}>
                  <Ionicons name="trash-outline" size={18} color="#d32f2f" />
                  <Text style={styles.deleteLatestText}>Delete latest</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noReadingText}>No readings yet for this farmer.</Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const keyExtractor = (f: Farmer) => getFarmerId(f) || `farmer_${f.name}`;

  const empty = useMemo(
    () => (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: TEXT_MUTED }}>No farmers yet. Add one from Home.</Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedFarmers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={empty}
        refreshing={refreshing}
        onRefresh={loadFarmersAndLatest}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 110,
          paddingTop: Platform.OS === 'android' ? Math.max(0, (StatusBar.currentHeight || 0) - 8) : 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f5' },

  headerBar: {
    backgroundColor: GREEN,
    height: 56,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 52,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'left',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSortText: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },

  listHeaderWrap: { paddingHorizontal: 4 },
  onlineRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 6,
    marginBottom: 8,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rightIcons: { flexDirection: 'row', gap: 10 },
  iconTap: { padding: 6 },

  farmerName: { fontSize: 18, fontWeight: '800', color: GREEN },

  detailRow: { marginTop: 6, color: TEXT_PRIMARY, fontSize: 14 },
  bold: { fontWeight: '600' },

  thinDivider: {
    height: 1,
    backgroundColor: '#eaeaea',
    marginTop: 10,
    marginBottom: 6,
  },

  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moreText: { color: GREEN, fontWeight: '700' },

  expandedBox: {
    marginTop: 10,
    backgroundColor: '#f7fff7',
    borderWidth: 1,
    borderColor: '#dfeee0',
    borderRadius: 12,
    padding: 10,
  },
  expTitle: { fontWeight: '800', color: GREEN, marginBottom: 6 },
  expRow: { color: '#1b5e20', marginTop: 2 },

  openRecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  openRecText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  openRecBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  openRecTextSmall: { color: '#fff', fontWeight: '800', fontSize: 11 },

  recWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#dfeee0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  recHeader: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#eef7ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#2e7d32' },
  recCount: { fontSize: 12, fontWeight: '700', color: '#607d8b' },
  recBody: { padding: 10, backgroundColor: '#ffffff' },

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

  detailsText: { fontSize: 13, color: '#444', marginBottom: 3 },
  recHint: { fontSize: 11, color: TEXT_MUTED, fontStyle: 'italic', marginTop: 6 },
  noRecText: { marginTop: 8, fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic' },

  allBox: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
  },
  allTitle: { fontSize: 13, fontWeight: '700', color: '#2e7d32', marginBottom: 4 },
  allRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  allIndex: { fontSize: 12, fontWeight: '700', color: '#455a64' },
  latestTag: { color: '#2e7d32', fontSize: 11, fontWeight: '700' },
  allDate: { fontSize: 12, color: '#607d8b' },
  allLine: { fontSize: 12, color: '#2e7d32' },

  expActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  deleteLatestBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8 },
  deleteLatestText: { color: '#d32f2f', fontWeight: '600' },
  noReadingText: { fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },

  // ✅ Stakeholder-style horizontal plan table (prevents cut text)
  table: { marginTop: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f0f0f0',
    padding: 10,
    gap: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: 'bold' },

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

  stageCell: { width: STAGE_COL_W, padding: 10, justifyContent: 'center' },
  stageHeaderCell: { backgroundColor: '#e8f5e9' },
  stageFooterCell: { backgroundColor: '#d1f7d6' },

  fertHeaderCell: {
    width: COL_W,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
  },
  fertCell: { width: COL_W, padding: 10, alignItems: 'center', justifyContent: 'center' },

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
