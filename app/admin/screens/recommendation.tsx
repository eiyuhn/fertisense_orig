// app/(admin)/screens/recommendation.tsx
// ✅ ADMIN recommendation screen (NOT stakeholder)
// - Shows SELECTED farmer (from ReadingSessionContext), not admin user
// - Saves reading to Mongo via addReading({ farmerId, ... }) when possible
// - Builds 3 plans (DA + 2 alternatives) with organic included
// - Stores fertilizerPlans.details so Admin Logs can build tables
// - Generates PDF using expo-print + expo-sharing (no moveAsync needed)

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

const SACK_WEIGHT_KG = 50;

const ORGANIC_FERT_CODE = 'Organic Fertilizer';
const ORGANIC_BAGS_PER_HA = 10;

// ================================
// ✅ LMH thresholds (ppm)
// ================================
type Nutrient = 'N' | 'P' | 'K';
type Lmh = 'L' | 'M' | 'H';

const THRESH = {
  N: { L: 110, M: 145 },
  P: { L: 315, M: 345 },
  K: { L: 150, M: 380 },
} as const;

const classifyLevel = (
  nutrient: Nutrient,
  ppm: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' => {
  const v = Number(ppm);
  if (!Number.isFinite(v) || v <= 0) return 'N/A';
  const x = Math.round(v);

  const t = THRESH[nutrient];
  if (x < t.L) return 'LOW';
  if (x <= t.M) return 'MEDIUM';
  return 'HIGH';
};

const toLMH_SAFE = (lvl: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A'): Lmh => {
  if (lvl === 'LOW') return 'L';
  if (lvl === 'MEDIUM') return 'M';
  if (lvl === 'HIGH') return 'H';
  return 'L'; // fallback
};

const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

// ================================
// ✅ Utilities
// ================================
function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}
function moneyFmt(v: number) {
  return (Number(v || 0) || 0).toFixed(2);
}
function asArray<T = any>(arr: any): T[] {
  return Array.isArray(arr) ? (arr as T[]) : [];
}
function round2(x: number) {
  return Math.round((Number(x || 0) + Number.EPSILON) * 100) / 100;
}
const safeText = (s: any) =>
  String(s ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// ================================
// ✅ Fertilizer names for UI + PDF
// ================================
const FERTILIZER_NAMES: Record<string, string> = {
  '46-0-0': 'Urea',
  '21-0-0': 'Ammosul',
  '0-0-60': 'Muriate of Potash (MOP)',
  '18-46-0': 'Diammonium Phosphate (DAP)',
  '16-20-0': 'Ammophos',
  '14-14-14': 'Complete Fertilizer',
  [ORGANIC_FERT_CODE]: 'Organic Fertilizer',
};

// ================================
// ✅ Local schedule / cost types
// ================================
type LocalScheduleLine = { code: string; bags: number };

type LocalSchedule = {
  organic?: LocalScheduleLine[];
  basal?: LocalScheduleLine[];
  after30DAT?: LocalScheduleLine[];
  topdress60DBH?: LocalScheduleLine[];
};

type LocalCostRow = {
  phase: string;
  code: string;
  bags: number;
  pricePerBag: number | null;
  subtotal: number | null;
};

type LocalCost = {
  currency: string;
  rows: LocalCostRow[];
  total: number;
};

type LocalPlan = {
  id: string;
  title: string;
  label: string;
  isDa?: boolean;
  isCheapest?: boolean;
  schedule: LocalSchedule;
  cost: LocalCost | null;
};

// ================================
// ✅ Required nutrients table (kg/ha)
// ================================
type Variety = 'hybrid' | 'inbred';
type SoilClass = 'light' | 'medHeavy';
type Season = 'wet' | 'dry';

const RICE_REQ = {
  hybrid: {
    light: {
      wet: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
      dry: {
        N: { L: 140, M: 110, H: 80 },
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
    },
    medHeavy: {
      wet: {
        N: { L: 110, M: 80, H: 50 },
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
      dry: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
    },
  },
  inbred: {
    light: {
      wet: {
        N: { L: 100, M: 70, H: 40 },
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
      dry: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
    },
    medHeavy: {
      wet: {
        N: { L: 90, M: 60, H: 30 },
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
      dry: {
        N: { L: 100, M: 70, H: 40 },
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
    },
  },
} as const;

function requiredNutrientsKgHa(
  variety: Variety,
  soil: SoilClass,
  season: Season,
  n: Lmh,
  p: Lmh,
  k: Lmh
) {
  const row = RICE_REQ[variety][soil][season];
  return { N: row.N[n], P: row.P[p], K: row.K[k] };
}

// ================================
// ✅ Price mapping (matches your backend PriceSettings keys)
// ================================
const CODE_TO_PRICE_KEY: Record<string, string> = {
  '46-0-0': 'UREA_46_0_0',
  '18-46-0': 'DAP_18_46_0',
  '16-20-0': 'NPK_16_20_0',
  '0-0-60': 'MOP_0_0_60',
  '14-14-14': 'NPK_14_14_14',
  '21-0-0': 'AMMOSUL_21_0_0',
};

function getItemByCode(prices: AdminPricesDoc | null, dashCode: string) {
  const key = CODE_TO_PRICE_KEY[String(dashCode)];
  if (!prices || !key) return null;
  return (prices as any)?.items?.[key] ?? null;
}

function nutrientKgPerBag(prices: AdminPricesDoc | null, dashCode: string) {
  const it = getItemByCode(prices, dashCode);
  if (!it) return null;

  const bagKg = Number(it.bagKg || 50);
  const pctN = Number(it.npk?.N || 0);
  const pctP = Number(it.npk?.P || 0);
  const pctK = Number(it.npk?.K || 0);

  return {
    bagKg,
    N: bagKg * (pctN / 100),
    P: bagKg * (pctP / 100),
    K: bagKg * (pctK / 100),
    pricePerBag: Number(it.pricePerBag || 0),
  };
}

function ensureOrganic(schedule: LocalSchedule, areaHa: number) {
  const area = Number(areaHa || 1);
  const want = round2(ORGANIC_BAGS_PER_HA * area);

  const existing = asArray<LocalScheduleLine>(schedule.organic);
  const hasOrganic = existing.some((x) => String(x?.code) === ORGANIC_FERT_CODE);
  if (hasOrganic) return schedule;

  return {
    ...schedule,
    organic: [{ code: ORGANIC_FERT_CODE, bags: want }, ...existing],
  };
}

function calcCost(schedule: LocalSchedule, prices: AdminPricesDoc | null): LocalCost | null {
  if (!prices) return null;
  const currency = String((prices as any)?.currency || 'PHP');

  const lines = [
    ...asArray(schedule.organic).map((x) => ({ phase: 'ORGANIC', ...x })),
    ...asArray(schedule.basal).map((x) => ({ phase: 'BASAL', ...x })),
    ...asArray(schedule.after30DAT).map((x) => ({ phase: '30 DAT', ...x })),
    ...asArray(schedule.topdress60DBH).map((x) => ({ phase: 'TOPDRESS', ...x })),
  ];

  const rows: LocalCostRow[] = lines.map((l) => {
    if (String(l.code) === ORGANIC_FERT_CODE) {
      return {
        phase: l.phase,
        code: String(l.code),
        bags: Number(l.bags || 0),
        pricePerBag: null,
        subtotal: null,
      };
    }

    const item = getItemByCode(prices, l.code);
    const pricePerBag = item?.pricePerBag ?? null;
    const subtotal = pricePerBag == null ? null : round2(pricePerBag * Number(l.bags || 0));
    return { phase: l.phase, code: String(l.code), bags: Number(l.bags || 0), pricePerBag, subtotal };
  });

  const total = round2(rows.reduce((s, r) => s + (r.subtotal || 0), 0));
  return { currency, rows, total };
}

function buildAltPlan(params: {
  id: string;
  label: string;
  reqKgHa: { N: number; P: number; K: number };
  prices: AdminPricesDoc | null;
  areaHa?: number;
  basalMix: Array<{ code: string; role: 'P' | 'K' }>;
  nSourceCode: string;
}): LocalPlan | null {
  const area = Number(params.areaHa || 1);

  const req = {
    N: Number(params.reqKgHa.N || 0) * area,
    P: Number(params.reqKgHa.P || 0) * area,
    K: Number(params.reqKgHa.K || 0) * area,
  };

  const checkCodes = [...params.basalMix.map((b) => b.code), params.nSourceCode];
  for (const c of checkCodes) {
    const n = nutrientKgPerBag(params.prices, c);
    if (!n) return null;
  }

  let supplied = { N: 0, P: 0, K: 0 };
  const basal: LocalScheduleLine[] = [];

  for (const b of params.basalMix) {
    const per = nutrientKgPerBag(params.prices, b.code)!;

    let bags = 0;
    if (b.role === 'P') bags = req.P / (per.P || 1);
    else bags = req.K / (per.K || 1);

    bags = round2(bags);
    if (!Number.isFinite(bags) || bags < 0 || bags > 60) return null;

    basal.push({ code: b.code, bags });
    supplied.N += bags * per.N;
    supplied.P += bags * per.P;
    supplied.K += bags * per.K;
  }

  const nPer = nutrientKgPerBag(params.prices, params.nSourceCode)!;
  const remainingN = Math.max(0, req.N - supplied.N);
  let nBagsTotal = remainingN / (nPer.N || 1);

  if (!Number.isFinite(nBagsTotal) || nBagsTotal < 0) nBagsTotal = 0;
  if (nBagsTotal > 120) return null;

  const after30 = round2(nBagsTotal / 2);
  const topdress = round2(nBagsTotal / 2);

  let schedule: LocalSchedule = {
    organic: [],
    basal,
    after30DAT: after30 > 0 ? [{ code: params.nSourceCode, bags: after30 }] : [],
    topdress60DBH: topdress > 0 ? [{ code: params.nSourceCode, bags: topdress }] : [],
  };

  schedule = ensureOrganic(schedule, area);
  const cost = calcCost(schedule, params.prices);

  return {
    id: params.id,
    title: 'Fertilizer Plan',
    label: params.label,
    isDa: false,
    isCheapest: false,
    schedule,
    cost,
  };
}

function build3PlansFallback(args: {
  resp: DaRecommendResponse | null;
  prices: AdminPricesDoc | null;
  nClass: Lmh;
  pClass: Lmh;
  kClass: Lmh;
  areaHa?: number;
  variety: Variety;
  soilClass: SoilClass;
  season: Season;
}): LocalPlan[] {
  const area = Number(args.areaHa || 1);

  const reqKgHa = requiredNutrientsKgHa(
    args.variety,
    args.soilClass,
    args.season,
    args.nClass,
    args.pClass,
    args.kClass
  );

  let daSchedule: LocalSchedule = {
    organic: [],
    basal: asArray((args.resp as any)?.schedule?.basal),
    after30DAT: asArray((args.resp as any)?.schedule?.after30DAT),
    topdress60DBH: asArray((args.resp as any)?.schedule?.topdress60DBH),
  };

  daSchedule = ensureOrganic(daSchedule, area);

  const daCost: LocalCost | null =
    (args.resp as any)?.cost && typeof (args.resp as any).cost === 'object'
      ? {
          currency: String((args.resp as any)?.cost?.currency || (args.prices as any)?.currency || 'PHP'),
          rows: Array.isArray((args.resp as any)?.cost?.rows) ? (args.resp as any).cost.rows : [],
          total: Number((args.resp as any)?.cost?.total || 0),
        }
      : calcCost(daSchedule, args.prices);

  const daPlan: LocalPlan = {
    id: 'DA_RULE',
    title: 'Fertilizer Plan',
    label: 'DA Recommendation',
    isDa: true,
    isCheapest: false,
    schedule: daSchedule,
    cost: daCost,
  };

  const altA = buildAltPlan({
    id: 'ALT_DAP_MOP_UREA',
    label: 'Alternative (DAP + MOP + Urea)',
    reqKgHa,
    prices: args.prices,
    areaHa: area,
    basalMix: [
      { code: '18-46-0', role: 'P' },
      { code: '0-0-60', role: 'K' },
    ],
    nSourceCode: '46-0-0',
  });

  const altB = buildAltPlan({
    id: 'ALT_16_20_0_MOP_AMMOSUL',
    label: 'Alternative (16-20-0 + MOP + Ammosul)',
    reqKgHa,
    prices: args.prices,
    areaHa: area,
    basalMix: [
      { code: '16-20-0', role: 'P' },
      { code: '0-0-60', role: 'K' },
    ],
    nSourceCode: '21-0-0',
  });

  const raw = [daPlan, altA, altB].filter(Boolean) as LocalPlan[];

  raw.sort((a, b) => {
    const ta = a.cost?.total ?? Number.POSITIVE_INFINITY;
    const tb = b.cost?.total ?? Number.POSITIVE_INFINITY;
    return ta - tb;
  });

  if (raw.length) raw[0].isCheapest = true;
  return raw.slice(0, 3);
}

function scheduleToDetailsLines(s: LocalSchedule): string[] {
  const lines: string[] = [];

  const pushStage = (title: string, arr?: LocalScheduleLine[]) => {
    lines.push(`${title}:`);
    asArray(arr).forEach((it) => {
      const code = String(it?.code || '').trim();
      const bags = Number(it?.bags || 0);
      if (!code) return;
      lines.push(`${code}: ${bags.toFixed(2)} bags`);
    });
  };

  pushStage('Organic', s.organic);
  pushStage('Basal', s.basal);
  pushStage('After 30 Days', s.after30DAT);
  pushStage('Top Dress', s.topdress60DBH);

  return lines;
}

// ================================
// ✅ Table UI constants
// ================================
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

function PlanTableCard({
  p,
  idx,
  currency,
  selectedPlanId,
  setSelectedPlanId,
}: {
  p: any;
  idx: number;
  currency: string | null;
  selectedPlanId: string | null;
  setSelectedPlanId: (v: string) => void;
}) {
  const isSelected = String(p.id) === String(selectedPlanId);
  const cur = p?.cost?.currency || currency || 'PHP';

  const fixedSchedule = ensureOrganic(
    {
      organic: asArray(p?.schedule?.organic),
      basal: asArray(p?.schedule?.basal),
      after30DAT: asArray(p?.schedule?.after30DAT),
      topdress60DBH: asArray(p?.schedule?.topdress60DBH),
    },
    1
  );

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
    <View style={[styles.table, isSelected && styles.tableSelected]}>
      <View style={styles.tableHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tableTitle}>{optionLabel}</Text>
          <View style={styles.badgeRow}>{p.isCheapest ? <Text style={styles.badge}>Cheapest</Text> : null}</View>
          <Text style={styles.tableSub}>Tap Select to choose this plan for PDF</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <Text style={styles.priceTag}>
            {cur} {moneyFmt(Number(p?.cost?.total || 0))}
          </Text>

          <Pressable
            onPress={() => setSelectedPlanId(String(p.id))}
            style={[styles.selectBtn, isSelected && styles.selectBtnActive]}
          >
            <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
              {isSelected ? 'Selected' : 'Select'}
            </Text>
          </Pressable>
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
              <Text style={styles.stageText}>Organic Fertilizer (14–30 days before planting)</Text>
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
              <Text style={styles.stageText}>Basal (At Planting)</Text>
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
              <Text style={styles.stageText}>After 30 Days</Text>
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
              <Text style={styles.stageText}>Top Dress (60 days before harvest)</Text>
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

export default function AdminRecommendationScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { currency, loading: pricesLoading } = useFertilizer();
  const { result: session } = useReadingSession();

  // ✅ Farmer identity MUST come from session (selected farmer)
  const farmerId = String(session?.farmerId ?? '');
  const farmerName = String(session?.farmerName ?? '').trim();

  const displayName = (farmerName || user?.name || user?.username || 'FertiSense Admin').trim();

  const nValue = Number(session?.n ?? 0);
  const pValue = Number(session?.p ?? 0);
  const kValue = Number(session?.k ?? 0);
  const phValue = Number(session?.ph ?? 6.5);
  const sessionTs = Number(session?.ts ?? 0);

  const variety = (session?.variety as Variety) || 'hybrid';
  const soilClass = (session?.soilClass as SoilClass) || 'light';
  const season = (session?.season as Season) || 'wet';

  const phStatus = phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  const sessionInvalid =
    !Number.isFinite(nValue) ||
    !Number.isFinite(pValue) ||
    !Number.isFinite(kValue) ||
    (nValue === 0 && pValue === 0 && kValue === 0);

  const levelN = classifyLevel('N', nValue);
  const levelP = classifyLevel('P', pValue);
  const levelK = classifyLevel('K', kValue);

  const nClass = toLMH_SAFE(levelN);
  const pClass = toLMH_SAFE(levelP);
  const kClass = toLMH_SAFE(levelK);

  const reqKgHa = requiredNutrientsKgHa(variety, soilClass, season, nClass, pClass, kClass);

  const [resp, setResp] = React.useState<DaRecommendResponse | null>(null);
  const [plansState, setPlansState] = React.useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  const isSavingRef = React.useRef(false);
  const lastSavedKeyRef = React.useRef<string>('');
  const lastLoadedSessionKeyRef = React.useRef<string>('');
  const inFlightRef = React.useRef(false);

  const persistLocalHistory = React.useCallback(
    async (plansForHistory: any[]) => {
      if (!user?._id) return;
      try {
        const userKey = `admin:history:${user._id}`;
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const phStr = `${phValue.toFixed(1)} (${phStatus})`;

        const fertilizerPlans =
          Array.isArray(plansForHistory) && plansForHistory.length
            ? plansForHistory.map((p: any, idx: number) => {
                const fixed = ensureOrganic(
                  {
                    organic: asArray(p?.schedule?.organic),
                    basal: asArray(p?.schedule?.basal),
                    after30DAT: asArray(p?.schedule?.after30DAT),
                    topdress60DBH: asArray(p?.schedule?.topdress60DBH),
                  },
                  1
                );
                return {
                  name: `Fertilization Recommendation Option ${idx + 1}${p.isCheapest ? ' • Cheapest' : ''}`,
                  cost: `${p?.cost?.currency || currency || 'PHP'} ${moneyFmt(Number(p?.cost?.total || 0))}`,
                  details: scheduleToDetailsLines(fixed),
                };
              })
            : [];

        const newItem = {
          id: `admin_reading_${sessionTs || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          date,
          ph: phStr,
          n_value: nValue,
          p_value: pValue,
          k_value: kValue,
          recommendationText: '',
          englishText: '',
          fertilizerPlans,
          selection: { crop: 'Rice', variety, soilClass, season },
          requiredNutrientsKgHa: reqKgHa,

          // ✅ store farmer context for local history use
          farmerId: farmerId || '',
          farmerName: displayName || '',
        };

        const raw = await AsyncStorage.getItem(userKey);
        const prev = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(userKey, JSON.stringify([newItem, ...prev]));
      } catch (e) {
        console.warn('admin local history save warn:', e);
      }
    },
    [
      user?._id,
      nValue,
      pValue,
      kValue,
      phValue,
      phStatus,
      currency,
      sessionTs,
      variety,
      soilClass,
      season,
      reqKgHa,
      farmerId,
      displayName,
    ]
  );

  const saveReading = React.useCallback(
    async (plansSnapshot: any[], selectedId?: string | null, respSnapshot?: any) => {
      const saveKey = `${user?._id || 'nouser'}:${sessionTs || 'notime'}:${nValue}:${pValue}:${kValue}:${phValue}:${variety}:${soilClass}:${season}:${farmerId}`;
      if (lastSavedKeyRef.current === saveKey) return;
      if (isSavingRef.current) return;

      isSavingRef.current = true;

      try {
        const net = await NetInfo.fetch();
        const online =
          net.isInternetReachable === true ? true : net.isInternetReachable === false ? false : !!net.isConnected;

        const chosen =
          (selectedId ? plansSnapshot?.find((p: any) => String(p.id) === String(selectedId)) : null) ||
          plansSnapshot?.[0];

        const fertilizerPlans =
          Array.isArray(plansSnapshot) && plansSnapshot.length
            ? plansSnapshot.map((p: any, idx: number) => {
                const fixed = ensureOrganic(
                  {
                    organic: asArray(p?.schedule?.organic),
                    basal: asArray(p?.schedule?.basal),
                    after30DAT: asArray(p?.schedule?.after30DAT),
                    topdress60DBH: asArray(p?.schedule?.topdress60DBH),
                  },
                  1
                );

                return {
                  name: `Fertilization Recommendation Option ${idx + 1}${p.isCheapest ? ' • Cheapest' : ''}`,
                  cost: `${p?.cost?.currency || currency || 'PHP'} ${moneyFmt(Number(p?.cost?.total || 0))}`,
                  details: scheduleToDetailsLines(fixed),
                };
              })
            : [];

        const npkClassText = respSnapshot?.classified?.npkClass || `${nClass}${pClass}${kClass}`;

        const payload: any = {
          N: nValue,
          P: pValue,
          K: kValue,
          ph: phValue,
          source: 'esp32',
          recommendationText: '',
          englishText: '',
          fertilizerPlans,
          currency: chosen?.cost?.currency || currency || 'PHP',
          daSchedule: chosen?.schedule ?? null,
          daCost: chosen?.cost ?? null,
          npkClass: npkClassText,

          selection: { crop: 'Rice', variety, soilClass, season },
          requiredNutrientsKgHa: reqKgHa,
        };

        // ✅ ADMIN: must save with farmerId when valid
        if (online && token) {
          if (farmerId && isObjectId(farmerId)) {
            await addReading({ ...payload, farmerId }, token);
          } else {
            // fallback if farmerId missing (still save something)
            await addStandaloneReading(payload, token);
          }
        } else {
          console.warn('Offline or no token: skipping cloud save.');
        }

        await persistLocalHistory(plansSnapshot || []);
        lastSavedKeyRef.current = saveKey;
      } catch (e: any) {
        console.error('admin save error:', e?.message || e);
        await persistLocalHistory(plansSnapshot || []);
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      user?._id,
      sessionTs,
      nValue,
      pValue,
      kValue,
      phValue,
      token,
      farmerId,
      currency,
      persistLocalHistory,
      nClass,
      pClass,
      kClass,
      variety,
      soilClass,
      season,
      reqKgHa,
    ]
  );

  const fetchAndBuildPlans = React.useCallback(async () => {
    setLoadingPlans(true);
    try {
      const [r, pd] = await Promise.all([
        token
          ? getDaRecommendation(token, {
              crop: 'rice_hybrid', // server-side DA rules (still used)
              nClass,
              pClass,
              kClass,
              areaHa: 1,
            }).catch(() => null)
          : Promise.resolve(null),
        getPublicPrices().catch(() => null),
      ]);

      setResp(r as any);

      const serverPlans = Array.isArray((r as any)?.plans) ? (r as any).plans : null;

      let snapshotPlans: any[] = [];
      if (serverPlans && serverPlans.length >= 3) {
        const sorted = [...serverPlans].sort((a: any, b: any) => {
          const ta = Number(a?.cost?.total ?? Number.POSITIVE_INFINITY);
          const tb = Number(b?.cost?.total ?? Number.POSITIVE_INFINITY);
          return ta - tb;
        });

        snapshotPlans = sorted
          .map((p: any) => {
            const s = p?.schedule || {};
            const schedule: LocalSchedule = {
              organic: asArray(s.organic),
              basal: asArray(s.basal),
              after30DAT: asArray(s.after30DAT),
              topdress60DBH: asArray(s.topdress60DBH),
            };
            const fixed = ensureOrganic(schedule, 1);
            return { ...p, schedule: fixed };
          })
          .slice(0, 3);

        snapshotPlans.forEach((p: any) => (p.isCheapest = false));
        if (snapshotPlans.length) snapshotPlans[0].isCheapest = true;
      } else {
        snapshotPlans = build3PlansFallback({
          resp: r as any,
          prices: pd as any,
          nClass,
          pClass,
          kClass,
          areaHa: 1,
          variety,
          soilClass,
          season,
        });
      }

      setPlansState(snapshotPlans);

      const firstId = snapshotPlans?.[0]?.id ? String(snapshotPlans[0].id) : null;
      setSelectedPlanId((prev) => {
        if (prev && snapshotPlans.some((p: any) => String(p.id) === String(prev))) return prev;
        return firstId;
      });

      await saveReading(snapshotPlans, firstId, r);
      return snapshotPlans;
    } catch (e: any) {
      console.error('admin fetch/build plans error:', e?.message || e);
      setPlansState([]);
      return [];
    } finally {
      setLoadingPlans(false);
    }
  }, [token, nClass, pClass, kClass, saveReading, variety, soilClass, season]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        if (sessionInvalid) return;
        if (inFlightRef.current) return;

        const sessionKey = `${user?._id || 'nouser'}:${sessionTs}:${nValue}:${pValue}:${kValue}:${phValue}:${nClass}${pClass}${kClass}:${variety}:${soilClass}:${season}:${farmerId}`;
        if (lastLoadedSessionKeyRef.current === sessionKey) return;

        inFlightRef.current = true;
        lastLoadedSessionKeyRef.current = sessionKey;

        try {
          await fetchAndBuildPlans();
        } finally {
          inFlightRef.current = false;
        }
      })();

      return () => {};
    }, [
      fetchAndBuildPlans,
      sessionInvalid,
      user?._id,
      sessionTs,
      nValue,
      pValue,
      kValue,
      phValue,
      nClass,
      pClass,
      kClass,
      variety,
      soilClass,
      season,
      farmerId,
    ])
  );

  const plans = plansState;

  const selectedPlan = React.useMemo(() => {
    if (!plans.length) return null;
    if (!selectedPlanId) return plans[0];
    return plans.find((p: any) => String(p.id) === String(selectedPlanId)) || plans[0];
  }, [plans, selectedPlanId]);

  const [pdfBusy, setPdfBusy] = React.useState(false);

  const handleSavePDF = React.useCallback(async () => {
    if (pdfBusy) return;
    if (!selectedPlan) {
      Alert.alert('No Plan', 'No fertilizer plan available yet.');
      return;
    }

    setPdfBusy(true);

    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);
    const filename = `ADMIN_READING_${ymd.replace(/-/g, '')}.pdf`; // (used in share dialog name)

    const plan = selectedPlan as any;
    const cur = plan?.cost?.currency || currency || 'PHP';

    const fixedSchedule = ensureOrganic(
      {
        organic: asArray(plan?.schedule?.organic),
        basal: asArray(plan?.schedule?.basal),
        after30DAT: asArray(plan?.schedule?.after30DAT),
        topdress60DBH: asArray(plan?.schedule?.topdress60DBH),
      },
      1
    );

    const fertCodes = Array.from(
      new Set([
        ...asArray(fixedSchedule.organic).map((x: any) => String(x.code)),
        ...asArray(fixedSchedule.basal).map((x: any) => String(x.code)),
        ...asArray(fixedSchedule.after30DAT).map((x: any) => String(x.code)),
        ...asArray(fixedSchedule.topdress60DBH).map((x: any) => String(x.code)),
      ])
    );

    const getBags = (stageArr: any[] | undefined, code: string) => {
      const a = asArray(stageArr);
      const it = a.find((x: any) => String(x.code) === String(code));
      return it ? Number(it.bags || 0) : 0;
    };

    const headerCols = fertCodes
      .map((c) => {
        const nm = safeText(FERTILIZER_NAMES[c] || 'Fertilizer');
        const cc = safeText(c);
        return `<th style="text-align:center;">
                  <div class="code">${cc}</div>
                  <div class="name">${nm}</div>
                </th>`;
      })
      .join('');

    const stageRow = (label: string, stageArr: any[] | undefined) => {
      const cols = fertCodes.map((c) => `<td class="bags">${bagsFmt(getBags(stageArr, c))}</td>`).join('');
      return `<tr><td>${safeText(label)}</td>${cols}</tr>`;
    };

    const totalRow = () => {
      const totalsByCode: Record<string, number> = {};
      const add = (arr?: any[]) =>
        asArray(arr).forEach((x: any) => {
          const c = String(x.code);
          totalsByCode[c] = (totalsByCode[c] || 0) + Number(x.bags || 0);
        });

      add(fixedSchedule.organic);
      add(fixedSchedule.basal);
      add(fixedSchedule.after30DAT);
      add(fixedSchedule.topdress60DBH);

      const cols = fertCodes
        .map((c) => `<td class="bags"><b>${bagsFmt(totalsByCode[c] || 0)}</b></td>`)
        .join('');
      return `<tr><td><b>Total Bags</b></td>${cols}</tr>`;
    };

    const farmerLabel = safeText(displayName || '(selected farmer)');
    const idx = Math.max(0, plans.findIndex((p: any) => String(p.id) === String(plan.id)));
    const optionLabel = `Fertilization Recommendation Option ${idx + 1}`;

    const selectionLabel = `Rice • ${String(variety).toUpperCase()} • ${
      soilClass === 'light' ? 'LIGHT' : 'MED-HEAVY'
    } SOILS • ${String(season).toUpperCase()} SEASON`;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; }
            h1 { color: #2e7d32; margin: 0 0 6px; }
            h3 { margin: 18px 0 10px; }
            .box { border:1px solid #ccc; padding:14px; border-radius:8px; background:#f8fff9; }
            table { width:100%; border-collapse:collapse; table-layout: fixed; }
            th, td { border:1px solid #ccc; padding:8px 10px; vertical-align:middle; }
            th { background:#e8f5e9; }
            .hdr { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#2e7d32; color:#fff; border-radius:6px 6px 0 0; }
            .footer { margin-top: 28px; color:#777; text-align:center; font-size:12px; }
            .code { font-weight:700; color:#1b5e20; white-space:nowrap; }
            .name { font-weight:400; color:#2f3b30; font-size:11px; line-height:1.2; word-break:keep-all; hyphens:none; }
            .bags { text-align:center; white-space:nowrap; }
          </style>
        </head>
        <body>
          <h1>🌱 Fertilizer Report</h1>
          <p><b>Date:</b> ${safeText(ymd)}</p>
          <p><b>Farmer:</b> ${farmerLabel}</p>
          <p><b>Selected Options:</b> ${safeText(selectionLabel)}</p>

          <h3>📟 Reading Results</h3>
          <div class="box">
            <p><b>pH:</b> ${safeText(phValue.toFixed(1))} (${safeText(phStatus)})</p>
            <p><b>N:</b> ${safeText(levelN)} &nbsp; <b>P:</b> ${safeText(levelP)} &nbsp; <b>K:</b> ${safeText(levelK)}</p>
            <p><b>Class:</b> ${safeText((resp as any)?.classified?.npkClass || `${nClass}${pClass}${kClass}`)}</p>
            <p><b>Required nutrients (kg/ha):</b> N=${safeText(reqKgHa.N)}, P=${safeText(reqKgHa.P)}, K=${safeText(reqKgHa.K)}</p>
          </div>

          <h3>📌 Fertilizer Plan</h3>
          <div class="hdr">
            <span>${safeText(optionLabel)}${plan.isCheapest ? ' • Cheapest' : ''}</span>
            <span>${safeText(cur)} ${safeText(moneyFmt(Number(plan?.cost?.total || 0)))}</span>
          </div>

          <table>
            <tr>
              <th style="text-align:left;">Stages</th>
              ${headerCols}
            </tr>
            ${stageRow('Organic Fertilizer (14–30 days before planting)', fixedSchedule.organic)}
            ${stageRow('Basal (At Planting)', fixedSchedule.basal)}
            ${stageRow('After 30 Days', fixedSchedule.after30DAT)}
            ${stageRow('Top Dress (60 days before harvest)', fixedSchedule.topdress60DBH)}
            ${totalRow()}
          </table>

          <div class="footer">FertiSense • ${today.getFullYear()}</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', `PDF created at:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      console.error('PDF error:', err);
      Alert.alert('PDF Error', err?.message ?? 'Could not generate PDF.');
    } finally {
      setPdfBusy(false);
    }
  }, [
    pdfBusy,
    selectedPlan,
    currency,
    displayName,
    phValue,
    phStatus,
    levelN,
    levelP,
    levelK,
    resp,
    nClass,
    pClass,
    kClass,
    plans,
    variety,
    soilClass,
    season,
    reqKgHa,
  ]);

  const loadingAny = pricesLoading || loadingPlans;

  if (sessionInvalid) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../../../assets/images/fertisense-logo.png')}
          style={styles.logo as any}
          resizeMode="contain"
        />
        <View style={styles.readBox}>
          <Text style={styles.readTitle}>⚠️ Invalid Reading</Text>
          <Text style={styles.readLine}>Please go back and read again. The app received 0/invalid NPK values.</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => router.replace('/admin/screens/sensor-reading')}>
          <Text style={styles.buttonText}>Back to Sensor Reading</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const selectionLabel = `Rice • ${String(variety).toUpperCase()} • ${
    soilClass === 'light' ? 'LIGHT' : 'MED-HEAVY'
  } SOILS • ${String(season).toUpperCase()} SEASON`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo as any}
        resizeMode="contain"
      />

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

        <Text style={styles.readSubtle}>Farmer: {displayName}</Text>
        <Text style={styles.readSubtle}>Selected Options: {selectionLabel}</Text>
        <Text style={styles.readSubtle}>
          Required (kg/ha): N={reqKgHa.N}, P={reqKgHa.P}, K={reqKgHa.K}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Fertilization Recommendation Options</Text>

      {loadingAny && <Text style={{ textAlign: 'center', color: '#888', marginVertical: 10 }}>Loading Plans...</Text>}

      {!loadingAny && plans.length === 0 && (
        <Text style={{ textAlign: 'center', color: '#888', marginVertical: 10 }}>No plans available.</Text>
      )}

      {plans.map((p: any, idx: number) => (
        <PlanTableCard
          key={String(p.id)}
          p={p}
          idx={idx}
          currency={currency}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={(v) => setSelectedPlanId(v)}
        />
      ))}

      <View style={styles.downloadToggle}>
        <Text style={styles.downloadLabel}>Save a copy (selected plan)</Text>

        <TouchableOpacity onPress={handleSavePDF} disabled={pdfBusy || loadingAny}>
          <Text style={[styles.downloadButton, (pdfBusy || loadingAny) && styles.disabledText]}>
            {pdfBusy ? 'Generating…' : '📄 Download PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/admin/tabs/admin-home')}>
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

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

  table: { marginBottom: 16, borderWidth: 1, borderColor: '#ccc', borderRadius: 10, overflow: 'hidden' },
  tableSelected: { borderColor: '#2e7d32', borderWidth: 2 },

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

  selectBtn: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  selectBtnActive: { backgroundColor: '#2e7d32' },
  selectBtnText: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32' },
  selectBtnTextActive: { color: '#fff' },

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

  downloadToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    borderTopWidth: 3,
    borderColor: '#417d44ff',
    paddingVertical: 10,
  },
  downloadLabel: { color: '#444', fontSize: 13 },
  downloadButton: { fontSize: 15, color: '#550909', fontWeight: 'bold' },
  disabledText: { color: '#aaa' },

  button: { backgroundColor: '#2e7d32', paddingVertical: 14, borderRadius: 50, marginTop: 20, marginBottom: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
});
