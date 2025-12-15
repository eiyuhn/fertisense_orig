// app/(stakeholder)/screens/recommendation.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { moveAsync } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../../context/AuthContext';
import { useFertilizer } from '../../../context/FertilizerContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';

import {
  addReading,
  addStandaloneReading,
  getDaRecommendation,
  getPublicPrices, // ✅ IMPORTANT: use public prices, not admin route
  type DaRecommendResponse,
  type AdminPricesDoc,
} from '../../../src/services';

const SACK_WEIGHT_KG = 50;

type Nutrient = 'N' | 'P' | 'K';

// ---------- helpers ----------
// ✅ DA-style thresholds (sensor-based interpretation)
const classifyLevel = (nutrient: Nutrient, ppm: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
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

const toLMH = (lvl: 'LOW' | 'MEDIUM' | 'HIGH'): 'L' | 'M' | 'H' => {
  if (lvl === 'LOW') return 'L';
  if (lvl === 'MEDIUM') return 'M';
  return 'H';
};

const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

function bagsFmt(b: number) {
  const n = Number.isFinite(b) ? b : 0;
  return `${n.toFixed(2)} bags`;
}

function moneyFmt(v: number) {
  return (v || 0).toFixed(2);
}

function normalizeDetailsFromSchedule(schedule?: any): string[] {
  if (!schedule) return [];
  const out: string[] = [];

  const push = (title: string, arr?: any[]) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    out.push(`${title}:`);
    arr.forEach((x) => {
      const code = String(x?.code ?? '');
      const bags = Number(x?.bags ?? 0);
      const kg = bags * SACK_WEIGHT_KG;
      out.push(`${code}: ${bags.toFixed(2)} bags (${kg.toFixed(1)} kg)`);
    });
  };

  push('Sa Pagtanim', schedule.basal);
  push('Pagkatapos ng 30 araw', schedule.after30DAT);
  push('Top Dress', schedule.topdress60DBH);

  return out;
}

/* =============================
   ✅ LOCAL FALLBACK (3 plans)
   ============================= */

// DA nutrient requirement (kg/ha)
const DA_RICE_HYBRID_REQ = {
  N: { L: 120, M: 90, H: 60 },
  P: { L: 60, M: 45, H: 20 },
  K: { L: 60, M: 45, H: 30 },
} as const;

type Lmh = 'L' | 'M' | 'H';

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

// ✅ map fertilizer dash code -> backend price key
const CODE_TO_PRICE_KEY: Record<string, string> = {
  '46-0-0': 'UREA_46_0_0',
  '18-46-0': 'DAP_18_46_0',
  '16-20-0': 'NPK_16_20_0',
  '0-0-60': 'MOP_0_0_60',
  '14-14-14': 'NPK_14_14_14',
  '21-0-0': 'AMMOSUL_21_0_0',
};

function round2(x: number) {
  return Math.round((Number(x || 0) + Number.EPSILON) * 100) / 100;
}

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

function calcCost(schedule: LocalSchedule, prices: AdminPricesDoc | null): LocalCost | null {
  if (!prices) return null;

  const currency = String((prices as any)?.currency || 'PHP');

  const lines = [
    ...(schedule.basal || []).map((x) => ({ phase: 'BASAL', ...x })),
    ...(schedule.after30DAT || []).map((x) => ({ phase: '30 DAT', ...x })),
    ...(schedule.topdress60DBH || []).map((x) => ({ phase: 'TOPDRESS', ...x })),
  ];

  const rows: LocalCostRow[] = lines.map((l) => {
    const item = getItemByCode(prices, l.code);
    const pricePerBag = item?.pricePerBag ?? null;
    const subtotal = pricePerBag == null ? null : round2(pricePerBag * Number(l.bags || 0));
    return {
      phase: l.phase,
      code: String(l.code),
      bags: Number(l.bags || 0),
      pricePerBag,
      subtotal,
    };
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
  basalMix: Array<{ code: string; role: 'P' | 'K' | 'PK' }>;
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
    else if (b.role === 'K') bags = req.K / (per.K || 1);
    else bags = Math.max(req.P / (per.P || 1), req.K / (per.K || 1));

    bags = round2(bags);

    if (!Number.isFinite(bags) || bags < 0 || bags > 30) return null;

    basal.push({ code: b.code, bags });
    supplied.N += bags * per.N;
    supplied.P += bags * per.P;
    supplied.K += bags * per.K;
  }

  const nPer = nutrientKgPerBag(params.prices, params.nSourceCode)!;
  const remainingN = Math.max(0, req.N - supplied.N);
  let nBagsTotal = remainingN / (nPer.N || 1);

  if (!Number.isFinite(nBagsTotal) || nBagsTotal < 0) nBagsTotal = 0;
  if (nBagsTotal > 60) return null;

  const after30 = round2(nBagsTotal / 2);
  const topdress = round2(nBagsTotal / 2);

  const schedule: LocalSchedule = {
    organic: [],
    basal,
    after30DAT: after30 > 0 ? [{ code: params.nSourceCode, bags: after30 }] : [],
    topdress60DBH: topdress > 0 ? [{ code: params.nSourceCode, bags: topdress }] : [],
  };

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
}): LocalPlan[] {
  const area = Number(args.areaHa || 1);

  const reqKgHa = {
    N: DA_RICE_HYBRID_REQ.N[args.nClass],
    P: DA_RICE_HYBRID_REQ.P[args.pClass],
    K: DA_RICE_HYBRID_REQ.K[args.kClass],
  };

  const daSchedule: LocalSchedule = {
    organic: [],
    basal: Array.isArray(args.resp?.schedule?.basal) ? (args.resp!.schedule!.basal as any) : [],
    after30DAT: Array.isArray(args.resp?.schedule?.after30DAT) ? (args.resp!.schedule!.after30DAT as any) : [],
    topdress60DBH: Array.isArray(args.resp?.schedule?.topdress60DBH) ? (args.resp!.schedule!.topdress60DBH as any) : [],
  };

  const daCost: LocalCost | null =
    args.resp?.cost && typeof args.resp.cost === 'object'
      ? {
          currency: String((args.resp.cost as any)?.currency || (args.prices as any)?.currency || 'PHP'),
          rows: Array.isArray((args.resp.cost as any)?.rows) ? (args.resp.cost as any).rows : [],
          total: Number((args.resp.cost as any)?.total || 0),
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

// validation helpers
function planHasAnyLines(p: any) {
  const s = p?.schedule;
  const all = [
    ...(s?.basal || []),
    ...(s?.after30DAT || []),
    ...(s?.topdress60DBH || []),
  ];
  return Array.isArray(all) && all.length > 0;
}
function planLooksSane(p: any) {
  if (!p || typeof p !== 'object') return false;
  if (!planHasAnyLines(p)) return false;

  const s = p.schedule || {};
  const lines = [
    ...(s?.basal || []),
    ...(s?.after30DAT || []),
    ...(s?.topdress60DBH || []),
  ];

  const totalBags = lines.reduce((sum: number, x: any) => sum + Number(x?.bags || 0), 0);
  if (!Number.isFinite(totalBags)) return false;
  if (totalBags <= 0) return false;
  if (totalBags > 60) return false;
  return true;
}
function serverPlansAreUsable(serverPlans: any[]) {
  if (!Array.isArray(serverPlans) || serverPlans.length < 3) return false;
  const good = serverPlans.filter(planLooksSane);
  return good.length >= 3;
}

export default function RecommendationScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { currency, loading: pricesLoading } = useFertilizer();
  const { result: session } = useReadingSession();

  const farmerId = session?.farmerId ?? '';
  const farmerName = session?.farmerName ?? '';

  const nValue = Number(session?.n ?? 0);
  const pValue = Number(session?.p ?? 0);
  const kValue = Number(session?.k ?? 0);
  const phValue = Number(session?.ph ?? 6.5);

  const phStatus = phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  // ✅ FIX: nutrient-specific LMH
  const levelN = classifyLevel('N', nValue);
  const levelP = classifyLevel('P', pValue);
  const levelK = classifyLevel('K', kValue);

  const nClass = toLMH(levelN);
  const pClass = toLMH(levelP);
  const kClass = toLMH(levelK);

  const [resp, setResp] = React.useState<DaRecommendResponse | null>(null);
  const [loadingRec, setLoadingRec] = React.useState(false);

  const [priceDoc, setPriceDoc] = React.useState<AdminPricesDoc | null>(null);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  // ✅ fetch recommendation + prices together
  const fetchRecommendation = React.useCallback(async () => {
    setLoadingRec(true);
    try {
      const [r, pd] = await Promise.all([
        token
          ? getDaRecommendation(token, {
              crop: 'rice_hybrid',
              nClass,
              pClass,
              kClass,
              areaHa: 1,
            })
          : Promise.resolve(null),

        // ✅ IMPORTANT: prices from PUBLIC endpoint (no admin token needed)
        getPublicPrices().catch(() => null),
      ]);

      setResp(r as any);
      setPriceDoc(pd as any);
      return { r: r as any, pd: pd as any };
    } catch (e: any) {
      console.error('recommendation fetch error:', e?.message || e);
      setResp(null);
      setPriceDoc(null);
      return { r: null, pd: null };
    } finally {
      setLoadingRec(false);
    }
  }, [token, nClass, pClass, kClass]);

  // plans computed from state for display
  const plans = React.useMemo(() => {
    const serverPlans = Array.isArray((resp as any)?.plans) ? (resp as any).plans : null;

    if (serverPlans && serverPlansAreUsable(serverPlans)) {
      const sorted = [...serverPlans].sort((a: any, b: any) => {
        const ta = Number(a?.cost?.total ?? Number.POSITIVE_INFINITY);
        const tb = Number(b?.cost?.total ?? Number.POSITIVE_INFINITY);
        return ta - tb;
      });

      sorted.forEach((p: any) => (p.isCheapest = false));
      if (sorted.length) sorted[0].isCheapest = true;

      return sorted.slice(0, 3);
    }

    return build3PlansFallback({
      resp,
      prices: priceDoc,
      nClass,
      pClass,
      kClass,
      areaHa: 1,
    });
  }, [resp, priceDoc, nClass, pClass, kClass]);

  React.useEffect(() => {
    if (!plans?.length) return;

    const currentExists =
      selectedPlanId != null && plans.some((p: any) => String(p.id) === String(selectedPlanId));

    if (!currentExists) {
      const firstId = String(plans[0]?.id || '');
      if (firstId) setSelectedPlanId(firstId);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = React.useMemo(() => {
    if (!plans.length) return null;
    if (!selectedPlanId) return plans[0];
    return plans.find((p: any) => String(p.id) === String(selectedPlanId)) || plans[0];
  }, [plans, selectedPlanId]);

  const [postStatus, setPostStatus] = React.useState<'pending' | 'saving' | 'saved' | 'failed'>('pending');
  const onceRef = React.useRef(false);
  const isSavingRef = React.useRef(false);

  const persistLocalHistory = React.useCallback(
    async (plansForHistory: any[]) => {
      if (!user?._id) return;
      try {
        const userKey = `history:${user._id}`;
        const date = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const phStr = `${phValue.toFixed(1)} (${phStatus})`;

        const fertilizerPlans =
          Array.isArray(plansForHistory) && plansForHistory.length
            ? plansForHistory.map((p: any) => ({
                name: `${p.label}${p.isCheapest ? ' • Cheapest' : ''}`,
                cost: `${p?.cost?.currency || currency || 'PHP'} ${moneyFmt(Number(p?.cost?.total || 0))}`,
                details: normalizeDetailsFromSchedule(p.schedule),
              }))
            : [];

        const newItem = {
          id: `reading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          date,
          ph: phStr,
          n_value: nValue,
          p_value: pValue,
          k_value: kValue,
          recommendationText: '',
          englishText: '',
          fertilizerPlans,
        };

        const raw = await AsyncStorage.getItem(userKey);
        const prev = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(userKey, JSON.stringify([newItem, ...prev]));
      } catch (e) {
        console.warn('local history save warn:', e);
      }
    },
    [user?._id, nValue, pValue, kValue, phValue, phStatus, currency]
  );

  // ✅ save to backend (fixes: ph field + saves correct snapshot)
  const saveReading = React.useCallback(
    async (plansSnapshot: any[]) => {
      if (postStatus !== 'pending' || isSavingRef.current) return;
      isSavingRef.current = true;
      setPostStatus('saving');

      try {
        const net = await NetInfo.fetch();
        const online =
          net.isInternetReachable === true
            ? true
            : net.isInternetReachable === false
            ? false
            : !!net.isConnected;

        const chosen =
          (selectedPlanId
            ? plansSnapshot?.find((p: any) => String(p.id) === String(selectedPlanId))
            : null) || plansSnapshot?.[0];

        const fertilizerPlans =
          Array.isArray(plansSnapshot) && plansSnapshot.length
            ? plansSnapshot.map((p: any) => ({
                name: `${p.label}${p.isCheapest ? ' • Cheapest' : ''}`,
                cost: `${p?.cost?.currency || currency || 'PHP'} ${moneyFmt(Number(p?.cost?.total || 0))}`,
                details: normalizeDetailsFromSchedule(p.schedule),
              }))
            : [];

        const payload: any = {
          N: nValue,
          P: pValue,
          K: kValue,

          // ✅ FIX: send "ph" not "pH"
          ph: phValue,

          source: 'esp32',
          recommendationText: '',
          englishText: '',
          fertilizerPlans,
          currency: chosen?.cost?.currency || currency || 'PHP',
          daSchedule: chosen?.schedule ?? null,
          daCost: chosen?.cost ?? null,
          npkClass: resp?.classified?.npkClass || `${nClass}${pClass}${kClass}`,
        };

        if (!online || !token) {
          console.warn('Offline or no token: skipping cloud save.');
        } else {
          if (farmerId && isObjectId(farmerId)) {
            await addReading({ ...payload, farmerId }, token);
          } else {
            await addStandaloneReading(payload, token);
          }
        }

        await persistLocalHistory(plansSnapshot || []);
        setPostStatus('saved');
      } catch (e: any) {
        console.error('save error:', e?.message || e);
        await persistLocalHistory(plansSnapshot || []);
        setPostStatus('failed');
        Alert.alert('Save Error', e?.message || 'Could not save reading.');
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      postStatus,
      token,
      farmerId,
      nValue,
      pValue,
      kValue,
      phValue,
      currency,
      resp,
      persistLocalHistory,
      nClass,
      pClass,
      kClass,
      selectedPlanId,
    ]
  );

  // ✅ FIX: do NOT save stale "plans"
  useFocusEffect(
    React.useCallback(() => {
      if (onceRef.current) return;
      onceRef.current = true;

      (async () => {
        const { r, pd } = await fetchRecommendation();

        // build snapshot plans using JUST fetched values (no stale state)
        const serverPlans = Array.isArray((r as any)?.plans) ? (r as any).plans : null;

        let snapshotPlans: any[] = [];
        if (serverPlans && serverPlansAreUsable(serverPlans)) {
          const sorted = [...serverPlans].sort((a: any, b: any) => {
            const ta = Number(a?.cost?.total ?? Number.POSITIVE_INFINITY);
            const tb = Number(b?.cost?.total ?? Number.POSITIVE_INFINITY);
            return ta - tb;
          });
          sorted.forEach((p: any) => (p.isCheapest = false));
          if (sorted.length) sorted[0].isCheapest = true;
          snapshotPlans = sorted.slice(0, 3);
        } else {
          snapshotPlans = build3PlansFallback({
            resp: r as any,
            prices: pd as any,
            nClass,
            pClass,
            kClass,
            areaHa: 1,
          });
        }

        if (snapshotPlans.length) setSelectedPlanId(String(snapshotPlans[0].id));
        await saveReading(snapshotPlans);
      })();
    }, [fetchRecommendation, saveReading, nClass, pClass, kClass])
  );

  // ---- PDF (prints ONLY the selected plan) ----
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
    const filename = `STAKEHOLDER_READING_${ymd.replace(/-/g, '')}.pdf`;

    const plan = selectedPlan as any;
    const cur = plan?.cost?.currency || currency || 'PHP';

    const fertCodes = Array.from(
      new Set([
        ...(plan?.schedule?.basal || []).map((x: any) => String(x.code)),
        ...(plan?.schedule?.after30DAT || []).map((x: any) => String(x.code)),
        ...(plan?.schedule?.topdress60DBH || []).map((x: any) => String(x.code)),
      ])
    );

    const getBags = (stageArr: any[], code: string) => {
      const it = (stageArr || []).find((x: any) => String(x.code) === String(code));
      return it ? Number(it.bags || 0) : 0;
    };

    const headerCols = fertCodes.map((c) => `<th style="text-align:center;">${c}</th>`).join('');

    const stageRow = (label: string, stageArr: any[]) => {
      const cols = fertCodes
        .map((c) => `<td style="text-align:center;">${bagsFmt(getBags(stageArr, c))}</td>`)
        .join('');
      return `<tr><td>${label}</td>${cols}</tr>`;
    };

    const totalRow = () => {
      const totalsByCode: Record<string, number> = {};
      const add = (arr: any[]) =>
        (arr || []).forEach((x: any) => {
          const c = String(x.code);
          totalsByCode[c] = (totalsByCode[c] || 0) + Number(x.bags || 0);
        });

      add(plan?.schedule?.basal);
      add(plan?.schedule?.after30DAT);
      add(plan?.schedule?.topdress60DBH);

      const cols = fertCodes
        .map((c) => `<td style="text-align:center;"><b>${bagsFmt(totalsByCode[c] || 0)}</b></td>`)
        .join('');

      return `<tr><td><b>Total Bags</b></td>${cols}</tr>`;
    };

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; }
            h1 { color: #2e7d32; margin: 0 0 6px; }
            h3 { margin: 18px 0 10px; }
            .box { border:1px solid #ccc; padding:14px; border-radius:8px; background:#f8fff9; }
            table { width:100%; border-collapse:collapse; }
            th, td { border:1px solid #ccc; padding:8px 12px; text-align:left; }
            th { background:#f0f0f0; }
            .hdr { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#2e7d32; color:#fff; border-radius:6px 6px 0 0; }
            .badge { display:inline-block; padding:4px 8px; border-radius:999px; font-size:12px; background:#eef7ee; border:1px solid #cfe7d4; margin-left:8px; }
            .footer { margin-top: 28px; color:#777; text-align:center; font-size:12px; }
          </style>
        </head>
        <body>
          <h1>🌱 Fertilizer Report</h1>
          <p><b>📅 Date:</b> ${ymd}</p>
          <p><b>👤 Farmer:</b> ${farmerName || '(stakeholder account)'}</p>

          <h3>📟 Reading Results</h3>
          <div class="box">
            <p><b>pH:</b> ${phValue.toFixed(1)} (${phStatus})</p>
            <p><b>N:</b> ${levelN} &nbsp; <b>P:</b> ${levelP} &nbsp; <b>K:</b> ${levelK}</p>
            <p><b>Class:</b> ${resp?.classified?.npkClass || `${nClass}${pClass}${kClass}`}</p>
          </div>

          <h3>📌 Fertilizer Plan</h3>
          <div class="hdr">
            <span>${plan.label}${plan.isDa ? ' (DA)' : ''}${plan.isCheapest ? ' • Cheapest' : ''}</span>
            <span>${cur} ${moneyFmt(Number(plan?.cost?.total || 0))}</span>
          </div>

          <table>
            <tr>
              <th>Stages</th>
              ${headerCols}
            </tr>
            ${stageRow('Sa Pagtanom', plan?.schedule?.basal)}
            ${stageRow('Pagkahuman sa ika 30 na adlaw', plan?.schedule?.after30DAT)}
            ${stageRow('Top Dress (60 days ayha sa pag harvest)', plan?.schedule?.topdress60DBH)}
            ${totalRow()}
          </table>

          <div class="footer">FertiSense • ${today.getFullYear()}</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = (FileSystem as any).documentDirectory + filename;
      await moveAsync({ from: uri, to: dest });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Choose where to save your PDF',
        });
      } else {
        Alert.alert('Saved', `File saved to app storage:\n${dest}`);
      }
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
    farmerName,
    phValue,
    phStatus,
    levelN,
    levelP,
    levelK,
    resp,
    nClass,
    pClass,
    kClass,
  ]);

  const loadingAny = pricesLoading || loadingRec;

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

        {!!farmerName && <Text style={styles.readSubtle}>Farmer: {farmerName}</Text>}
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Plans (Cheapest First)</Text>

      {loadingAny && (
        <Text style={{ textAlign: 'center', color: '#888', marginVertical: 10 }}>
          Loading Plans...
        </Text>
      )}

      {!loadingAny && plans.length === 0 && (
        <Text style={{ textAlign: 'center', color: '#888', marginVertical: 10 }}>
          No plans available.
        </Text>
      )}

      {plans.map((p: any) => {
        const isSelected = String(p.id) === String(selectedPlanId);
        const cur = p?.cost?.currency || currency || 'PHP';

        const fertCodes = Array.from(
          new Set([
            ...(p?.schedule?.basal || []).map((x: any) => String(x.code)),
            ...(p?.schedule?.after30DAT || []).map((x: any) => String(x.code)),
            ...(p?.schedule?.topdress60DBH || []).map((x: any) => String(x.code)),
          ])
        );

        const stageBags = (stageArr: any[], code: string) => {
          const it = (stageArr || []).find((x: any) => String(x.code) === String(code));
          return it ? Number(it.bags || 0) : 0;
        };

        const totalsByCode: Record<string, number> = {};
        const addTotals = (arr: any[]) =>
          (arr || []).forEach((x: any) => {
            const c = String(x.code);
            totalsByCode[c] = (totalsByCode[c] || 0) + Number(x.bags || 0);
          });

        addTotals(p?.schedule?.basal);
        addTotals(p?.schedule?.after30DAT);
        addTotals(p?.schedule?.topdress60DBH);

        return (
          <TouchableOpacity
            key={String(p.id)}
            activeOpacity={0.9}
            onPress={() => setSelectedPlanId(String(p.id))}
            style={[styles.table, isSelected && styles.tableSelected]}
          >
            <View style={styles.tableHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableTitle}>
                  {p.label}{' '}
                  {p.isCheapest ? <Text style={styles.badge}>Cheapest</Text> : null}
                  {p.isDa ? <Text style={styles.badge}>DA</Text> : null}
                </Text>
                <Text style={styles.tableSub}>Tap to select this plan for PDF</Text>
              </View>

              <Text style={styles.priceTag}>
                {cur} {moneyFmt(Number(p?.cost?.total || 0))}
              </Text>
            </View>

            {/* header */}
            <View style={styles.tableRow}>
              <Text style={[styles.cellHeader, { flex: 2 }]}>Stages</Text>
              {fertCodes.map((code) => (
                <Text key={`hdr-${p.id}-${code}`} style={styles.cellHeader}>
                  {code}
                </Text>
              ))}
            </View>

            {/* planting */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]}>Sa Pagtanim</Text>
              {fertCodes.map((code) => (
                <Text key={`plant-${p.id}-${code}`} style={styles.cell}>
                  {bagsFmt(stageBags(p?.schedule?.basal, code))}
                </Text>
              ))}
            </View>

            {/* after 30 days */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]}>Pagkatapos ng 30 Araw</Text>
              {fertCodes.map((code) => (
                <Text key={`30d-${p.id}-${code}`} style={styles.cell}>
                  {bagsFmt(stageBags(p?.schedule?.after30DAT, code))}
                </Text>
              ))}
            </View>

            {/* topdress */}
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 2 }]}>Top Dress - 60 days before harvest</Text>
              {fertCodes.map((code) => (
                <Text key={`top-${p.id}-${code}`} style={styles.cell}>
                  {bagsFmt(stageBags(p?.schedule?.topdress60DBH, code))}
                </Text>
              ))}
            </View>

            {/* totals */}
            <View style={[styles.tableRow, styles.tableFooter]}>
              <Text style={[styles.cellHeader, { flex: 2 }]}>Total Bags</Text>
              {fertCodes.map((code) => (
                <Text key={`tot-${p.id}-${code}`} style={styles.cellHeader}>
                  {bagsFmt(totalsByCode[code] || 0)}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.downloadToggle}>
        <Text style={styles.downloadLabel}>Save a copy (selected plan)</Text>
        <TouchableOpacity onPress={handleSavePDF} disabled={pdfBusy || loadingAny}>
          <Text style={[styles.downloadButton, (pdfBusy || loadingAny) && styles.disabledText]}>
            {pdfBusy ? 'Generating…' : '📄 Download PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(stakeholder)/tabs/stakeholder-home')}
      >
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

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
  tableSelected: {
    borderColor: '#2e7d32',
    borderWidth: 2,
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
