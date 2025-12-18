// app/guest/screens/recommendation.tsx
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

import { useReadingSession, type RiceVariety, type SoilClass, type Season } from '../../../context/ReadingSessionContext';
import { useData } from '../../../context/DataContext';
import { addGuestReading } from '../../../src/localUsers';

import { getPublicPrices, type AdminPricesDoc } from '../../../src/services';

const ORGANIC_FERT_CODE = 'Organic Fertilizer';
const ORGANIC_BAGS_PER_HA = 10;
const BAG_KG = 50;

type Nutrient = 'N' | 'P' | 'K';
type Lmh = 'L' | 'M' | 'H';

// ✅ FINAL Table 4.5 thresholds (same as stakeholder)
const THRESH = {
  N: { L: 110, M: 145 },
  P: { L: 315, M: 345 },
  K: { L: 150, M: 380 },
} as const;

const classifyLevel = (nutrient: Nutrient, ppm: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A' => {
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
  return 'L';
};

function asArray<T = any>(arr: any): T[] {
  return Array.isArray(arr) ? (arr as T[]) : [];
}
function round2(x: number) {
  return Math.round((Number(x || 0) + Number.EPSILON) * 100) / 100;
}
function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}
function moneyFmt(v: number) {
  return (v || 0).toFixed(2);
}

/** ✅ Fertilizer full names */
const FERTILIZER_NAMES: Record<string, string> = {
  '46-0-0': 'Urea',
  '21-0-0': 'Ammosul',
  '0-0-60': 'Muriate of Potash (MOP)',
  '18-46-0': 'Diammonium Phosphate (DAP)',
  '16-20-0': 'Ammophos',
  '14-14-14': 'Complete Fertilizer',
  [ORGANIC_FERT_CODE]: 'Organic Fertilizer',
};

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
  isCheapest?: boolean;
  schedule: LocalSchedule;
  cost: LocalCost | null;
};

// ✅ mapping to your backend price keys (for COST only)
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

// ✅ Organic MUST be in organic column only
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
  // ✅ OFFLINE: no prices => no cost shown
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
      return { phase: l.phase, code: String(l.code), bags: Number(l.bags || 0), pricePerBag: null, subtotal: null };
    }
    const item = getItemByCode(prices, l.code);
    const pricePerBag = item?.pricePerBag ?? null;
    const subtotal = pricePerBag == null ? null : round2(pricePerBag * Number(l.bags || 0));
    return { phase: l.phase, code: String(l.code), bags: Number(l.bags || 0), pricePerBag, subtotal };
  });

  const total = round2(rows.reduce((s, r) => s + (r.subtotal || 0), 0));
  return { currency, rows, total };
}

function planHasRealFertilizer(plan: LocalPlan): boolean {
  const s = plan?.schedule || {};
  const all = [...asArray(s.basal), ...asArray(s.after30DAT), ...asArray(s.topdress60DBH)];
  return all.some((x: any) => String(x?.code) !== ORGANIC_FERT_CODE && Number(x?.bags || 0) > 0);
}

function markCheapestAmongReal(plans: LocalPlan[]) {
  plans.forEach((p) => (p.isCheapest = false));
  const real = plans.filter(planHasRealFertilizer);

  // ✅ If offline (no cost), do not mark cheapest
  const allNoCost = real.every((p) => p?.cost == null);
  if (allNoCost) return;

  real.sort((a, b) => {
    const ta = Number(a?.cost?.total ?? Number.POSITIVE_INFINITY);
    const tb = Number(b?.cost?.total ?? Number.POSITIVE_INFINITY);
    return ta - tb;
  });

  if (real.length) {
    const cheapestId = String(real[0].id);
    const hit = plans.find((p) => String(p.id) === cheapestId);
    if (hit) hit.isCheapest = true;
  }
}

/**
 * ✅ REQUIREMENTS TABLE (same structure as stakeholder)
 */
type ReqTable = Record<Nutrient, Record<Lmh, number>>;

const REQ: Record<RiceVariety, Record<SoilClass, Record<Season, ReqTable>>> = {
  hybrid: {
    light: {
      wet: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
      dry: {
        N: { L: 140, M: 110, H: 80 }, // placeholder
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
    },
    medHeavy: {
      wet: {
        N: { L: 110, M: 80, H: 50 }, // placeholder
        P: { L: 70, M: 50, H: 30 },
        K: { L: 70, M: 50, H: 30 },
      },
      dry: {
        N: { L: 120, M: 90, H: 60 }, // placeholder
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
        N: { L: 120, M: 90, H: 60 }, // placeholder
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
    },
    medHeavy: {
      wet: {
        N: { L: 90, M: 60, H: 30 }, // placeholder
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
      dry: {
        N: { L: 100, M: 70, H: 40 }, // placeholder
        P: { L: 60, M: 40, H: 20 },
        K: { L: 60, M: 40, H: 20 },
      },
    },
  },
};

function getRequirementKgHa(args: {
  variety: RiceVariety;
  soilClass: SoilClass;
  season: Season;
  nClass: Lmh;
  pClass: Lmh;
  kClass: Lmh;
}): { N: number; P: number; K: number } {
  const t = REQ?.[args.variety]?.[args.soilClass]?.[args.season] ?? REQ.hybrid.light.wet;
  return {
    N: Number(t.N[args.nClass] ?? 0),
    P: Number(t.P[args.pClass] ?? 0),
    K: Number(t.K[args.kClass] ?? 0),
  };
}

/**
 * ✅ FRONTEND BAG SOLVER
 * bags = targetKg / (gradeDecimal * 50)
 */
const GRADE = {
  '14-14-14': { N: 0.14, P: 0.14, K: 0.14 },
  '16-20-0': { N: 0.16, P: 0.20, K: 0.0 },
  '46-0-0': { N: 0.46, P: 0.0, K: 0.0 },
  '18-46-0': { N: 0.18, P: 0.46, K: 0.0 },
  '0-0-60': { N: 0.0, P: 0.0, K: 0.60 },
  '21-0-0': { N: 0.21, P: 0.0, K: 0.0 },
} as const;

function bagsFor(targetKg: number, gradeDec: number) {
  if (!gradeDec || gradeDec <= 0) return 0;
  return targetKg / (gradeDec * BAG_KG);
}
function suppliedKg(bags: number, gradeDec: number) {
  return bags * BAG_KG * gradeDec;
}

/**
 * ✅ PLAN 1: 14-14-14 + 16-20-0 + Urea
 */
function buildPlan_Complete_Ammophos_Urea(
  req: { N: number; P: number; K: number },
  areaHa: number,
  prices: AdminPricesDoc | null
): LocalPlan {
  const area = Number(areaHa || 1);
  const targetN = req.N * area;
  const targetP = req.P * area;
  const targetK = req.K * area;

  const b141414 = round2(bagsFor(targetK, GRADE['14-14-14'].K));
  const nFrom141414 = suppliedKg(b141414, GRADE['14-14-14'].N);
  const pFrom141414 = suppliedKg(b141414, GRADE['14-14-14'].P);

  const remP = Math.max(0, targetP - pFrom141414);
  const remN_afterA = Math.max(0, targetN - nFrom141414);

  const b16200 = round2(remP <= 0 ? 0 : bagsFor(remP, GRADE['16-20-0'].P));
  const nFrom16200 = suppliedKg(b16200, GRADE['16-20-0'].N);

  const remN_final = Math.max(0, remN_afterA - nFrom16200);
  const bUreaTotal = round2(remN_final <= 0 ? 0 : bagsFor(remN_final, GRADE['46-0-0'].N));
  const halfUrea = round2(bUreaTotal / 2);

  let schedule: LocalSchedule = {
    organic: [],
    basal: [
      ...(b141414 > 0 ? [{ code: '14-14-14', bags: b141414 }] : []),
      ...(b16200 > 0 ? [{ code: '16-20-0', bags: b16200 }] : []),
    ],
    after30DAT: halfUrea > 0 ? [{ code: '46-0-0', bags: halfUrea }] : [],
    topdress60DBH: halfUrea > 0 ? [{ code: '46-0-0', bags: halfUrea }] : [],
  };

  schedule = ensureOrganic(schedule, area);
  const cost = calcCost(schedule, prices);

  return {
    id: 'PLAN_COMPLETE_AMMOPHOS_UREA',
    title: 'Fertilizer Plan',
    label: 'Option (14-14-14 + 16-20-0 + Urea)',
    schedule,
    cost,
  };
}

/**
 * ✅ PLAN 2: DAP + MOP + Urea
 */
function buildPlan_DAP_MOP_UREA(
  req: { N: number; P: number; K: number },
  areaHa: number,
  prices: AdminPricesDoc | null
): LocalPlan {
  const area = Number(areaHa || 1);
  const targetN = req.N * area;
  const targetP = req.P * area;
  const targetK = req.K * area;

  const bMop = round2(bagsFor(targetK, GRADE['0-0-60'].K));
  const bDap = round2(bagsFor(targetP, GRADE['18-46-0'].P));
  const nFromDap = suppliedKg(bDap, GRADE['18-46-0'].N);

  const remN = Math.max(0, targetN - nFromDap);
  const bUreaTotal = round2(remN <= 0 ? 0 : bagsFor(remN, GRADE['46-0-0'].N));
  const halfUrea = round2(bUreaTotal / 2);

  let schedule: LocalSchedule = {
    organic: [],
    basal: [
      ...(bDap > 0 ? [{ code: '18-46-0', bags: bDap }] : []),
      ...(bMop > 0 ? [{ code: '0-0-60', bags: bMop }] : []),
    ],
    after30DAT: halfUrea > 0 ? [{ code: '46-0-0', bags: halfUrea }] : [],
    topdress60DBH: halfUrea > 0 ? [{ code: '46-0-0', bags: halfUrea }] : [],
  };

  schedule = ensureOrganic(schedule, area);
  const cost = calcCost(schedule, prices);

  return {
    id: 'PLAN_DAP_MOP_UREA',
    title: 'Fertilizer Plan',
    label: 'Option (DAP + MOP + Urea)',
    schedule,
    cost,
  };
}

/**
 * ✅ PLAN 3: 16-20-0 + MOP + Ammosul
 */
function buildPlan_16200_MOP_AMMOSUL(
  req: { N: number; P: number; K: number },
  areaHa: number,
  prices: AdminPricesDoc | null
): LocalPlan {
  const area = Number(areaHa || 1);
  const targetN = req.N * area;
  const targetP = req.P * area;
  const targetK = req.K * area;

  const bMop = round2(bagsFor(targetK, GRADE['0-0-60'].K));
  const b16200 = round2(bagsFor(targetP, GRADE['16-20-0'].P));
  const nFrom16200 = suppliedKg(b16200, GRADE['16-20-0'].N);

  const remN = Math.max(0, targetN - nFrom16200);
  const bAmmTotal = round2(remN <= 0 ? 0 : bagsFor(remN, GRADE['21-0-0'].N));
  const halfAmm = round2(bAmmTotal / 2);

  let schedule: LocalSchedule = {
    organic: [],
    basal: [
      ...(b16200 > 0 ? [{ code: '16-20-0', bags: b16200 }] : []),
      ...(bMop > 0 ? [{ code: '0-0-60', bags: bMop }] : []),
    ],
    after30DAT: halfAmm > 0 ? [{ code: '21-0-0', bags: halfAmm }] : [],
    topdress60DBH: halfAmm > 0 ? [{ code: '21-0-0', bags: halfAmm }] : [],
  };

  schedule = ensureOrganic(schedule, area);
  const cost = calcCost(schedule, prices);

  return {
    id: 'PLAN_16200_MOP_AMMOSUL',
    title: 'Fertilizer Plan',
    label: 'Option (16-20-0 + MOP + Ammosul)',
    schedule,
    cost,
  };
}

function build3FrontendPlans(args: {
  prices: AdminPricesDoc | null;
  reqKgHa: { N: number; P: number; K: number };
  areaHa: number;
}): LocalPlan[] {
  const p1 = buildPlan_Complete_Ammophos_Urea(args.reqKgHa, args.areaHa, args.prices);
  const p2 = buildPlan_DAP_MOP_UREA(args.reqKgHa, args.areaHa, args.prices);
  const p3 = buildPlan_16200_MOP_AMMOSUL(args.reqKgHa, args.areaHa, args.prices);

  let plans = [p1, p2, p3].filter((p) => planHasRealFertilizer(p));

  // ✅ If online with prices: sort by cost; if offline: keep stable order
  const canSort = plans.some((p) => p?.cost?.total != null);
  if (canSort) {
    plans.sort((a, b) => {
      const ta = a.cost?.total ?? Number.POSITIVE_INFINITY;
      const tb = b.cost?.total ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }

  const top3 = plans.slice(0, 3);
  markCheapestAmongReal(top3);
  return top3;
}

// ✅ uniform table sizing
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
  const hasCost = !!p?.cost;
  const cur = (p?.cost?.currency || currency || 'PHP') as string;

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

          <View style={styles.badgeRow}>
            {p.isCheapest ? <Text style={styles.badge}>Cheapest</Text> : null}
            {!hasCost ? <Text style={styles.badge}>Offline: price unavailable</Text> : null}
          </View>

          <Text style={styles.tableSub}>Tap Select to choose this plan for PDF</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          {hasCost ? (
            <Text style={styles.priceTag}>
              {cur} {moneyFmt(Number(p?.cost?.total || 0))}
            </Text>
          ) : null}

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

export default function GuestRecommendationScreen() {
  const router = useRouter();
  const { result: session } = useReadingSession();
  const { addReading } = useData();

  // ✅ options from session (same pattern as stakeholder)
  const variety: RiceVariety = session?.variety ?? 'hybrid';
  const soilClass: SoilClass = session?.soilClass ?? 'light';
  const season: Season = session?.season ?? 'wet';
  const areaHa = 1;

  const nValue = Number(session?.n ?? 0);
  const pValue = Number(session?.p ?? 0);
  const kValue = Number(session?.k ?? 0);
  const phValue = Number(session?.ph ?? 6.5);
  const sessionTs = Number(session?.ts ?? 0);

  const displayName = String(session?.farmerName || 'Guest').trim();

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

  const neededKgHa = React.useMemo(() => {
    return getRequirementKgHa({ variety, soilClass, season, nClass, pClass, kClass });
  }, [variety, soilClass, season, nClass, pClass, kClass]);

  const [plansState, setPlansState] = React.useState<LocalPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);
  const [currency, setCurrency] = React.useState<string | null>('PHP');

  const isSavingRef = React.useRef(false);
  const lastSavedKeyRef = React.useRef<string>('');
  const lastLoadedSessionKeyRef = React.useRef<string>('');
  const inFlightRef = React.useRef(false);

  const persistGuestHistory = React.useCallback(
    async (plansForHistory: LocalPlan[], selectedId?: string | null) => {
      try {
        const date = new Date().toISOString();

        const fertilizerPlans =
          Array.isArray(plansForHistory) && plansForHistory.length
            ? plansForHistory.map((p: any, idx: number) => ({
                name: `Fertilization Recommendation Option ${idx + 1}${p.isCheapest ? ' • Cheapest' : ''}`,
                cost: p?.cost
                  ? `${p?.cost?.currency || currency || 'PHP'} ${moneyFmt(Number(p?.cost?.total || 0))}`
                  : 'Price unavailable (offline)',
                details: [],
              }))
            : [];

        const plansSnapshot =
          Array.isArray(plansForHistory) && plansForHistory.length
            ? plansForHistory.map((p) => ({
                id: String(p.id),
                label: String(p.label || ''),
                isCheapest: !!p.isCheapest,
                schedule: p.schedule,
                cost: p.cost,
              }))
            : [];

        const reading: any = {
          name: displayName || 'Guest',
          code: 'GUEST',
          date,
          n: nValue,
          p: pValue,
          k: kValue,
          ph: phValue,

          fertilizerPlans,
          plansSnapshot,
          selectedPlanId: selectedId ? String(selectedId) : null,

          neededKgHa: {
            N: Number(neededKgHa?.N || 0),
            P: Number(neededKgHa?.P || 0),
            K: Number(neededKgHa?.K || 0),
          },

          recommendation: [
            `FertiSense Recommendation\nN=${levelN}, P=${levelP}, K=${levelK}\nNeeded (kg/ha): N ${neededKgHa.N} • P ${neededKgHa.P} • K ${neededKgHa.K}\nSelected: ${variety} • ${soilClass} • ${season}`,
          ],

          variety,
          soilClass,
          season,
        };

        addReading(reading);
        await addGuestReading(reading);
      } catch (e) {
        console.warn('guest local save warn:', e);
      }
    },
    [addReading, currency, displayName, kValue, levelK, levelN, levelP, nValue, neededKgHa, pValue, phValue, soilClass, season, variety]
  );

  const saveOncePerSession = React.useCallback(
    async (plansSnapshot: LocalPlan[], selectedId?: string | null) => {
      const saveKey = `guest:${sessionTs || 'notime'}:${nValue}:${pValue}:${kValue}:${phValue}:${variety}:${soilClass}:${season}`;
      if (lastSavedKeyRef.current === saveKey) return;
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      try {
        await persistGuestHistory(plansSnapshot || [], selectedId ?? null);
        lastSavedKeyRef.current = saveKey;
      } finally {
        isSavingRef.current = false;
      }
    },
    [kValue, nValue, pValue, phValue, persistGuestHistory, season, sessionTs, soilClass, variety]
  );

  const fetchAndBuildPlans = React.useCallback(async () => {
    setLoadingPlans(true);

    try {
      const net = await NetInfo.fetch();
      const online =
        net.isInternetReachable === true ? true : net.isInternetReachable === false ? false : !!net.isConnected;

      const pd = online ? await getPublicPrices().catch(() => null) : null;

      const cur = String((pd as any)?.currency || 'PHP');
      setCurrency(cur);

      const localPlans = build3FrontendPlans({
        prices: pd as any,
        reqKgHa: neededKgHa,
        areaHa,
      });

      setPlansState(localPlans);

      const firstId = localPlans?.[0]?.id ? String(localPlans[0].id) : null;
      setSelectedPlanId((prev) => {
        if (prev && localPlans.some((p: any) => String(p.id) === String(prev))) return prev;
        return firstId;
      });

      await saveOncePerSession(localPlans, firstId);
      return localPlans;
    } catch (e: any) {
      console.error('guest fetch/build plans error:', e?.message || e);
      setPlansState([]);
      return [];
    } finally {
      setLoadingPlans(false);
    }
  }, [areaHa, neededKgHa, saveOncePerSession]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        if (sessionInvalid) return;
        if (inFlightRef.current) return;

        const sessionKey = `guest:${sessionTs}:${nValue}:${pValue}:${kValue}:${phValue}:${nClass}${pClass}${kClass}:${variety}:${soilClass}:${season}`;
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
    }, [fetchAndBuildPlans, sessionInvalid, sessionTs, nValue, pValue, kValue, phValue, nClass, pClass, kClass, variety, soilClass, season])
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
        const nm = (FERTILIZER_NAMES[c] || 'Fertilizer').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cc = String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<th style="text-align:center;">
                  <div class="code">${cc}</div>
                  <div class="name">${nm}</div>
                </th>`;
      })
      .join('');

    const stageRow = (label: string, stageArr: any[] | undefined) => {
      const cols = fertCodes.map((c) => `<td class="bags">${bagsFmt(getBags(stageArr, c))}</td>`).join('');
      return `<tr><td>${label}</td>${cols}</tr>`;
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

      const cols = fertCodes.map((c) => `<td class="bags"><b>${bagsFmt(totalsByCode[c] || 0)}</b></td>`).join('');
      return `<tr><td><b>Total Bags</b></td>${cols}</tr>`;
    };

    const idx = Math.max(0, plans.findIndex((p: any) => String(p.id) === String(plan.id)));
    const optionLabel = `Fertilization Recommendation Option ${idx + 1}`;

    const hasCost = !!plan?.cost;

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
            .muted { color:#666; font-size:12px; }
          </style>
        </head>
        <body>
          <h1>🌱 Fertilizer Report</h1>
          <p><b>📅 Date:</b> ${ymd}</p>
          <p><b>👤 Farmer:</b> ${String(displayName || 'Guest').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>

          <h3>📟 Reading Results</h3>
          <div class="box">
            <p><b>pH:</b> ${phValue.toFixed(1)} (${phStatus})</p>
            <p><b>N:</b> ${levelN} &nbsp; <b>P:</b> ${levelP} &nbsp; <b>K:</b> ${levelK}</p>
            <p><b>Nutrients needed (kg/ha):</b> N ${neededKgHa.N} • P ${neededKgHa.P} • K ${neededKgHa.K}</p>
            <p><b>Selected:</b> ${variety} • ${soilClass} • ${season}</p>
          </div>

          <h3>📌 Fertilizer Plan</h3>
          <div class="hdr">
            <span>${optionLabel}${plan.isCheapest ? ' • Cheapest' : ''}</span>
            <span>${hasCost ? `${cur} ${moneyFmt(Number(plan?.cost?.total || 0))}` : 'Price unavailable (offline)'}</span>
          </div>

          <table>
            <tr>
              <th style="text-align:left;">Stages</th>
              ${headerCols}
            </tr>
            ${stageRow('Organic Fertilizer (14 - 30 days ayha sa pagtanom)', fixedSchedule.organic)}
            ${stageRow('Sa Pagtanom', fixedSchedule.basal)}
            ${stageRow('Pagkahuman sa ika 30 na adlaw', fixedSchedule.after30DAT)}
            ${stageRow('Top Dress (60 days ayha sa pag harvest)', fixedSchedule.topdress60DBH)}
            ${totalRow()}
          </table>

          <p class="muted">Note: If you generated this PDF offline, fertilizer prices may be unavailable.</p>
          <div class="footer">FertiSense • ${today.getFullYear()}</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing not available', `PDF created at:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save / Share PDF',
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
    neededKgHa,
    variety,
    soilClass,
    season,
    plans,
  ]);

  if (sessionInvalid) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={require('../../../assets/images/fertisense-logo.png')} style={styles.logo as any} resizeMode="contain" />
        <View style={styles.readBox}>
          <Text style={styles.readTitle}>⚠️ Invalid Reading</Text>
          <Text style={styles.readLine}>Please go back and read again. The app received 0/invalid NPK values.</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => router.replace('/guest/screens/sensor-reading')}>
          <Text style={styles.buttonText}>Back to Sensor Reading</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={require('../../../assets/images/fertisense-logo.png')} style={styles.logo as any} resizeMode="contain" />

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

        <Text style={styles.readSubtle}>
          Nutrients needed (kg/ha): N {neededKgHa.N} • P {neededKgHa.P} • K {neededKgHa.K}
        </Text>

        <Text style={styles.readSubtle}>
          Selected: {String(variety)} • {String(soilClass)} • {String(season)}
        </Text>

        {!!displayName && <Text style={styles.readSubtle}>Farmer: {displayName}</Text>}
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilization Recommendation Options</Text>

      {loadingPlans && (
        <Text style={{ textAlign: 'center', color: '#888', marginVertical: 10 }}>Loading Plans...</Text>
      )}

      {!loadingPlans && plans.length === 0 && (
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

        <TouchableOpacity onPress={handleSavePDF} disabled={pdfBusy || loadingPlans}>
          <Text style={[styles.downloadButton, (pdfBusy || loadingPlans) && styles.disabledText]}>
            {pdfBusy ? 'Generating…' : '📄 Download PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/guest/tabs/guest-home')}>
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

  progressTrack: { height: 5, backgroundColor: '#e6e6e6', borderTopWidth: 1, borderTopColor: '#ddd' },
  progressThumb: { height: 5, backgroundColor: '#2e7d32' },

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
