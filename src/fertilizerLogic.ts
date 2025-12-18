import { AdminPricesDoc, RecommendPlan, RecommendPlanRow, RecommendResponse } from './services';

/* ---------------- Types (Standard) ---------------- */
export type NutrientRating = 'L' | 'M' | 'H';
export type RiceVariety = 'hybrid' | 'inbred';
export type SoilClass = 'light' | 'medHeavy';
export type Season = 'wet' | 'dry';

export type RiceRecommendInput = {
  nPpm: number; pPpm: number; kPpm: number;
  ph?: number | null; areaHa?: number;
  variety?: RiceVariety; soilClass?: SoilClass;
  season?: Season; pricesDoc: AdminPricesDoc;
};

/* ---------------- 1. Classification & Tables (unchanged thresholds you provided) ---------------- */
export function classifyN(nValue: number): NutrientRating {
  if (nValue < 110) return 'L';
  if (nValue <= 145) return 'M';
  return 'H';
}
export function classifyP(pPpm: number): NutrientRating {
  if (pPpm < 280) return 'L';
  if (pPpm <= 345) return 'M';
  return 'H';
}
export function classifyK(kPpm: number): NutrientRating {
  if (kPpm < 150) return 'L';
  if (kPpm <= 350) return 'M';
  return 'H';
}

export const RICE_TARGETS: any = {
  hybrid: {
    light: {
      wet: { N: { L: 120, M: 90, H: 60 }, P: { L: 70, M: 50, H: 30 }, K: { L: 70, M: 50, H: 30 } },
      dry: { N: { L: 140, M: 110, H: 80 }, P: { L: 70, M: 50, H: 30 }, K: { L: 70, M: 50, H: 30 } },
    },
    medHeavy: {
      wet: { N: { L: 110, M: 80, H: 50 }, P: { L: 70, M: 50, H: 30 }, K: { L: 70, M: 50, H: 30 } },
      dry: { N: { L: 120, M: 90, H: 60 }, P: { L: 70, M: 50, H: 30 }, K: { L: 70, M: 50, H: 30 } },
    },
  },
  inbred: {
    light: {
      wet: { N: { L: 100, M: 70, H: 40 }, P: { L: 60, M: 40, H: 20 }, K: { L: 60, M: 40, H: 20 } },
      dry: { N: { L: 120, M: 90, H: 60 }, P: { L: 60, M: 40, H: 20 }, K: { L: 60, M: 40, H: 20 } },
    },
    medHeavy: {
      wet: { N: { L: 90, M: 60, H: 30 }, P: { L: 60, M: 40, H: 20 }, K: { L: 60, M: 40, H: 20 } },
      dry: { N: { L: 100, M: 70, H: 40 }, P: { L: 60, M: 40, H: 20 }, K: { L: 60, M: 40, H: 20 } },
    },
  },
};

export function getTargetKgPerHa(
  variety: RiceVariety, soilClass: SoilClass, season: Season,
  nRating: NutrientRating, pRating: NutrientRating, kRating: NutrientRating
) {
  const row = RICE_TARGETS[variety][soilClass][season];
  return { Nkg: row.N[nRating], Pkg: row.P[pRating], Kkg: row.K[kRating] };
}

/* ---------------- 2. Database Reader ---------------- */
export type FertilizerProduct = {
  code: string; label: string; pricePerBag: number;
  bagKg: number; Npct: number; Ppct: number; Kpct: number;
  active?: boolean;
};

export function extractProducts(doc: AdminPricesDoc): FertilizerProduct[] {
  const out: FertilizerProduct[] = [];
  const items = doc.items || {};
  for (const [code, v] of Object.entries(items)) {
    if (!v) continue;
    const npk = v.npk || { N: 0, P: 0, K: 0 };
    const active = (v as any).active !== false;
    out.push({
      code,
      label: (v as any).label ?? code,
      pricePerBag: Number((v as any).pricePerBag ?? 0),
      bagKg: Number((v as any).bagKg ?? 50),
      Npct: Number((npk as any).N ?? 0),
      Ppct: Number((npk as any).P ?? 0),
      Kpct: Number((npk as any).K ?? 0),
      active,
    });
  }
  // keep only “usable” items
  return out.filter(p => p.active !== false && p.pricePerBag >= 0 && p.bagKg > 0);
}

/* ---------------- 3. Cost helpers (IMPORTANT FIX) ---------------- */

function kgPerBag(p: FertilizerProduct, nutrient: 'N'|'P'|'K'): number {
  const pct = nutrient === 'N' ? p.Npct : nutrient === 'P' ? p.Ppct : p.Kpct;
  if (!pct || pct <= 0) return 0;
  return (pct / 100) * p.bagKg;
}

function costPerKg(p: FertilizerProduct, nutrient: 'N'|'P'|'K'): number {
  const kg = kgPerBag(p, nutrient);
  if (kg <= 0) return Number.POSITIVE_INFINITY;
  return p.pricePerBag / kg;
}

/**
 * Pick best source by LOWEST cost per kg of nutrient.
 * Optionally avoid products that add “other nutrients” (reduce overshoot).
 */
function pickBestSource(
  inventory: FertilizerProduct[],
  nutrient: 'N'|'P'|'K',
  opts?: { avoidCross?: boolean }
): FertilizerProduct | null {
  const list = inventory.filter(p => kgPerBag(p, nutrient) > 0);
  if (!list.length) return null;

  const scored = list
    .map(p => {
      const cpk = costPerKg(p, nutrient);
      let penalty = 0;

      if (opts?.avoidCross) {
        // penalize cross nutrients so P source doesn’t accidentally dump lots of N/K, etc.
        if (nutrient !== 'N') penalty += (p.Npct > 0 ? 0.3 : 0);
        if (nutrient !== 'P') penalty += (p.Ppct > 0 ? 0.3 : 0);
        if (nutrient !== 'K') penalty += (p.Kpct > 0 ? 0.3 : 0);
      }

      return { p, score: cpk * (1 + penalty) };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.p ?? null;
}

function roundBags(b: number): number {
  // show 2 decimals, but never 0.009 nonsense
  return Math.ceil(b * 100) / 100;
}

/* ---------------- 4. Solver (FIXED) ---------------- */

export type ComputedPlan = {
  rows: { product: FertilizerProduct; bags: number }[];
  totalCost: number;
  supplied: { N: number; P: number; K: number };
};

function addOrMergeRow(
  rows: { product: FertilizerProduct; bags: number }[],
  product: FertilizerProduct,
  bags: number
) {
  if (bags <= 0) return;
  const existing = rows.find(r => r.product.code === product.code);
  if (existing) existing.bags += bags;
  else rows.push({ product, bags });
}

/**
 * GENERIC FILLER LOGIC (improved):
 * - Optionally uses a base fertilizer first
 * - Then fills remaining gaps using CHEAPEST per-kg sources (not highest %)
 * - Uses avoidCross for P/K picks to reduce overshooting
 */
function solveWithBase(
  reqN: number, reqP: number, reqK: number,
  baseFertilizer: FertilizerProduct | null,
  inventory: FertilizerProduct[]
): ComputedPlan {
  const rows: { product: FertilizerProduct; bags: number }[] = [];

  let supN = 0, supP = 0, supK = 0;
  let totalCost = 0;

  // Step 1: base fertilizer (if given)
  if (baseFertilizer) {
    // choose the dominant nutrient of the base based on which requirement exists
    // If complete (NPK), use it to cover P first (common agronomy: P basal), else K, else N.
    const dominatesP = baseFertilizer.Ppct > 0 && reqP > 0;
    const dominatesK = baseFertilizer.Kpct > 0 && reqK > 0;

    let nutrient: 'P' | 'K' | 'N' = 'N';
    if (dominatesP) nutrient = 'P';
    else if (dominatesK) nutrient = 'K';
    else nutrient = 'N';

    const perBag = kgPerBag(baseFertilizer, nutrient);
    if (perBag > 0) {
      const need = nutrient === 'N' ? reqN : nutrient === 'P' ? reqP : reqK;
      const bags = need / perBag;

      addOrMergeRow(rows, baseFertilizer, bags);
      totalCost += bags * baseFertilizer.pricePerBag;

      supN += bags * kgPerBag(baseFertilizer, 'N');
      supP += bags * kgPerBag(baseFertilizer, 'P');
      supK += bags * kgPerBag(baseFertilizer, 'K');
    }
  }

  // Step 2: Fill remaining gaps (K -> P -> N)
  const remK = Math.max(0, reqK - supK);
  if (remK > 0) {
    const kSource = pickBestSource(inventory, 'K', { avoidCross: true });
    if (kSource) {
      const bags = remK / kgPerBag(kSource, 'K');
      addOrMergeRow(rows, kSource, bags);
      totalCost += bags * kSource.pricePerBag;
      supN += bags * kgPerBag(kSource, 'N');
      supP += bags * kgPerBag(kSource, 'P');
      supK += bags * kgPerBag(kSource, 'K');
    }
  }

  const remP = Math.max(0, reqP - supP);
  if (remP > 0) {
    const pSource = pickBestSource(inventory, 'P', { avoidCross: true });
    if (pSource) {
      const bags = remP / kgPerBag(pSource, 'P');
      addOrMergeRow(rows, pSource, bags);
      totalCost += bags * pSource.pricePerBag;
      supN += bags * kgPerBag(pSource, 'N');
      supP += bags * kgPerBag(pSource, 'P');
      supK += bags * kgPerBag(pSource, 'K');
    }
  }

  const remN = Math.max(0, reqN - supN);
  if (remN > 0) {
    const nSource = pickBestSource(inventory, 'N', { avoidCross: false });
    if (nSource) {
      const bags = remN / kgPerBag(nSource, 'N');
      addOrMergeRow(rows, nSource, bags);
      totalCost += bags * nSource.pricePerBag;
      supN += bags * kgPerBag(nSource, 'N');
      supP += bags * kgPerBag(nSource, 'P');
      supK += bags * kgPerBag(nSource, 'K');
    }
  }

  // Round bags
  rows.forEach(r => (r.bags = roundBags(r.bags)));

  // Recompute total with rounded bags (so display = saved total)
  totalCost = rows.reduce((sum, r) => sum + r.bags * r.product.pricePerBag, 0);

  return { rows, totalCost, supplied: { N: supN, P: supP, K: supK } };
}

/* ---------------- 5. Fixed “Classic” recipes (2 more options) ---------------- */

function findByHint(inventory: FertilizerProduct[], hints: string[]): FertilizerProduct | null {
  const upperHints = hints.map(h => h.toUpperCase());
  const match = inventory.find(p => upperHints.some(h => p.code.toUpperCase().includes(h) || p.label.toUpperCase().includes(h)));
  return match || null;
}

function solveClassicNPk(
  reqN: number, reqP: number, reqK: number,
  np: FertilizerProduct | null, // e.g., DAP 18-46-0
  k: FertilizerProduct | null,  // e.g., MOP 0-0-60
  n: FertilizerProduct | null,  // e.g., Urea 46-0-0 or Ammosul 21-0-0
  inventory: FertilizerProduct[]
): ComputedPlan {
  const rows: { product: FertilizerProduct; bags: number }[] = [];
  let supN = 0, supP = 0, supK = 0;

  // Fill P first using NP fertilizer (basal)
  if (np && kgPerBag(np, 'P') > 0 && reqP > 0) {
    const bags = reqP / kgPerBag(np, 'P');
    addOrMergeRow(rows, np, bags);
    supN += bags * kgPerBag(np, 'N');
    supP += bags * kgPerBag(np, 'P');
    supK += bags * kgPerBag(np, 'K');
  }

  // Fill K using K fertilizer
  const remK = Math.max(0, reqK - supK);
  if (remK > 0) {
    const kSrc = k && kgPerBag(k, 'K') > 0 ? k : pickBestSource(inventory, 'K', { avoidCross: true });
    if (kSrc) {
      const bags = remK / kgPerBag(kSrc, 'K');
      addOrMergeRow(rows, kSrc, bags);
      supN += bags * kgPerBag(kSrc, 'N');
      supP += bags * kgPerBag(kSrc, 'P');
      supK += bags * kgPerBag(kSrc, 'K');
    }
  }

  // Fill N using N fertilizer
  const remN = Math.max(0, reqN - supN);
  if (remN > 0) {
    const nSrc = n && kgPerBag(n, 'N') > 0 ? n : pickBestSource(inventory, 'N');
    if (nSrc) {
      const bags = remN / kgPerBag(nSrc, 'N');
      addOrMergeRow(rows, nSrc, bags);
      supN += bags * kgPerBag(nSrc, 'N');
      supP += bags * kgPerBag(nSrc, 'P');
      supK += bags * kgPerBag(nSrc, 'K');
    }
  }

  rows.forEach(r => (r.bags = roundBags(r.bags)));
  const totalCost = rows.reduce((sum, r) => sum + r.bags * r.product.pricePerBag, 0);
  return { rows, totalCost, supplied: { N: supN, P: supP, K: supK } };
}

/* ---------------- 6. Recommendation Builder ---------------- */

export function buildRiceRecommendation(input: RiceRecommendInput): RecommendResponse {
  const {
    nPpm, pPpm, kPpm, ph,
    areaHa = 1,
    variety = 'hybrid',
    soilClass = 'medHeavy',
    season = 'wet',
    pricesDoc
  } = input;

  const nRating = classifyN(nPpm);
  const pRating = classifyP(pPpm);
  const kRating = classifyK(kPpm);

  const { Nkg, Pkg, Kkg } = getTargetKgPerHa(variety, soilClass, season, nRating, pRating, kRating);

  const totalN = Nkg * areaHa;
  const totalP = Pkg * areaHa;
  const totalK = Kkg * areaHa;

  const inventory = extractProducts(pricesDoc);
  const currency = pricesDoc.currency || 'PHP';

  // Identify archetypes dynamically
  const completeTypes = inventory.filter(p => p.Npct > 0 && p.Ppct > 0 && p.Kpct > 0);
  // pick the “best” complete by cheapest cost-per-total-nutrient kg
  const bestComplete = completeTypes
    .map(p => {
      const totalKg = kgPerBag(p, 'N') + kgPerBag(p, 'P') + kgPerBag(p, 'K');
      const score = totalKg > 0 ? p.pricePerBag / totalKg : Number.POSITIVE_INFINITY;
      return { p, score };
    })
    .sort((a, b) => a.score - b.score)[0]?.p ?? null;

  const npTypes = inventory.filter(p => p.Npct > 0 && p.Ppct > 0 && p.Kpct === 0);
  // pick cheapest cost per kg of P (since NP is mostly for basal P)
  const bestNP = npTypes.sort((a, b) => costPerKg(a, 'P') - costPerKg(b, 'P'))[0] ?? null;

  // Classic products (if present)
  const dap = findByHint(inventory, ['DAP_18_46_0', '18-46-0', 'DAP']);
  const mop = findByHint(inventory, ['MOP_0_0_60', '0-0-60', 'MOP']);
  const urea = findByHint(inventory, ['UREA_46_0_0', '46-0-0', 'UREA']);
  const ammosul = findByHint(inventory, ['AMMOSUL_21_0_0', '21-0-0', 'AMMOSUL']);

  const plans: RecommendPlan[] = [];

  // Option A: Complete base
  if (bestComplete) {
    const r = solveWithBase(totalN, totalP, totalK, bestComplete, inventory);
    plans.push({
      code: 'opt_a_complete',
      title: `Option A: ${bestComplete.label} Base`,
      rows: formatRows(r.rows, currency),
      total: r.totalCost,
      currency,
    });
  }

  // Option B: NP base (ammophos-like)
  if (bestNP) {
    const r = solveWithBase(totalN, totalP, totalK, bestNP, inventory);
    plans.push({
      code: 'opt_b_npbase',
      title: `Option B: ${bestNP.label} Base`,
      rows: formatRows(r.rows, currency),
      total: r.totalCost,
      currency,
    });
  }

  // Option C: High efficiency (no base; cheapest-per-kg sources)
  {
    const r = solveWithBase(totalN, totalP, totalK, null, inventory);
    plans.push({
      code: 'opt_c_efficiency',
      title: 'Option C: High Efficiency Mix',
      rows: formatRows(r.rows, currency),
      total: r.totalCost,
      currency,
    });
  }

  // ✅ Option D: Classic DAP + MOP + Urea
  {
    const r = solveClassicNPk(totalN, totalP, totalK, dap, mop, urea, inventory);
    plans.push({
      code: 'opt_d_dap_mop_urea',
      title: 'Option D: DAP + MOP + Urea (Classic)',
      rows: formatRows(r.rows, currency),
      total: r.totalCost,
      currency,
    });
  }

  // ✅ Option E: Classic DAP + MOP + Ammosul
  {
    const r = solveClassicNPk(totalN, totalP, totalK, dap, mop, ammosul, inventory);
    plans.push({
      code: 'opt_e_dap_mop_ammosul',
      title: 'Option E: DAP + MOP + Ammosul (Classic)',
      rows: formatRows(r.rows, currency),
      total: r.totalCost,
      currency,
    });
  }

  // Deduplicate identical row-sets (so inventory-limited cases don’t show repeats)
  const uniquePlans = plans.filter((p, idx, arr) => {
    const key = JSON.stringify(p.rows);
    return idx === arr.findIndex(x => JSON.stringify(x.rows) === key);
  });

  // Cheapest plan
  const sorted = [...uniquePlans].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
  const cheapest = sorted[0] || uniquePlans[0];

  const narrativeTL = `Target: ${totalN.toFixed(0)}kg N, ${totalP.toFixed(0)}kg P, ${totalK.toFixed(0)}kg K. (${variety}, ${soilClass}, ${season}, ${areaHa} ha)`;
  const narrativeEN = `Target: ${totalN.toFixed(0)}kg N, ${totalP.toFixed(0)}kg P, ${totalK.toFixed(0)}kg K. (${variety}, ${soilClass}, ${season}, ${areaHa} ha)`;

  return {
    ok: true,
    input: {
      nPpm, pPpm, kPpm, ph, areaHa, variety, soilClass, season,
      ratings: { N: nRating, P: pRating, K: kRating },
      targetsPerHa: { Nkg, Pkg, Kkg },
    },
    narrative: { tl: narrativeTL, en: narrativeEN },
    plans: uniquePlans,
    cheapest: { code: cheapest?.code, total: cheapest?.total ?? 0, currency },
    updatedAt: new Date().toISOString(),
  };
}

/* ---------------- 7. Row formatter (keeps your UI compatible) ---------------- */

function formatRows(
  rows: { product: FertilizerProduct; bags: number }[],
  currency: string
): RecommendPlanRow[] {
  return rows.map(r => {
    const bags = roundBags(r.bags);
    const subtotal = bags * (r.product.pricePerBag ?? 0);
    return {
      key: r.product.code,
      label: r.product.label,
      bags,
      pricePerBag: r.product.pricePerBag,
      subtotal: Math.round(subtotal * 100) / 100,
      currency,
    } as any;
  });
}

/* ---------------- 8. Wrapper used by your screens (same output shape as before) ---------------- */

export function generateFertilizerPlan(args: {
  n: number; p: number; k: number; ph?: number | null;
  areaHa?: number; variety?: RiceVariety; soilClass?: SoilClass; season?: Season;
  pricesDoc: AdminPricesDoc;
}) {
  const resp = buildRiceRecommendation({
    nPpm: args.n, pPpm: args.p, kPpm: args.k, ph: args.ph ?? undefined,
    areaHa: args.areaHa ?? 1,
    variety: args.variety ?? 'hybrid',
    soilClass: args.soilClass ?? 'medHeavy',
    season: args.season ?? 'wet',
    pricesDoc: args.pricesDoc,
  });

  const fertilizerPlans = (resp.plans || []).map((p) => ({
    name: p.title,
    cost: String(Math.round((p.total ?? 0) * 100) / 100),
    details: (p.rows || []).map((r: any) => {
      const bags = Math.round((r.bags ?? 0) * 100) / 100;
      const subtotal = Math.round((r.subtotal ?? 0) * 100) / 100;
      const perBag = Math.round((r.pricePerBag ?? 0) * 100) / 100;
      return `${bags} bag(s) - ${r.label} | ${resp.cheapest?.currency ?? 'PHP'} ${perBag}/bag | Subtotal: ${subtotal}`;
    }),
  }));

  return {
    recommendationText: resp.narrative?.tl ?? '',
    englishText: resp.narrative?.en ?? '',
    fertilizerPlans,
    raw: resp,
  };
}
