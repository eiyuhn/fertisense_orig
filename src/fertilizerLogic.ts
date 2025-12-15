// src/fertilizerLogic.ts
import { AdminPricesDoc, RecommendPlan, RecommendPlanRow, RecommendResponse } from './services';
import { classifyNutrient } from '../constants/npkThresholds';

/* ---------------- Types ---------------- */

export type NutrientRating = 'L' | 'M' | 'H';

export type RiceVariety = 'hybrid' | 'inbred';
export type SoilClass = 'light' | 'medHeavy';
export type Season = 'wet' | 'dry';

export type RiceRecommendInput = {
  nPpm: number;   // For N: this is actually the sensor's N index / %OM-based value
  pPpm: number;
  kPpm: number;
  ph?: number | null;
  areaHa?: number;
  variety?: RiceVariety;
  soilClass?: SoilClass;
  season?: Season;
  pricesDoc: AdminPricesDoc;
};

/* ---------------- 1. Classification (sensor → L/M/H) ---------------- */

// N: use the new OM-based thresholds from npkThresholds.ts
export function classifyN(nValue: number): NutrientRating {
  const res = classifyNutrient('N', nValue);
  return res ? res.code : 'M'; // default to Medium if something is off
}

// P: still using your original DA-style thresholds
// (you can switch this to classifyNutrient('P', ...) once you fill P ranges)
export function classifyP(pPpm: number): NutrientRating {
  if (pPpm < 15) return 'L';
  if (pPpm <= 30) return 'M';
  return 'H';
}

// K: use the new 0–117 / >117–235 / >235 ppm thresholds
export function classifyK(kPpm: number): NutrientRating {
  const res = classifyNutrient('K', kPpm);
  return res ? res.code : 'M';
}

/* ---------------- 2. Target kg/ha table (from your booklet) ---------------- */

type NpkTargetRow = {
  N: Record<NutrientRating, number>;
  P: Record<NutrientRating, number>;
  K: Record<NutrientRating, number>;
};

type RiceTable = {
  [variety in RiceVariety]: {
    [soil in SoilClass]: {
      [s in Season]: NpkTargetRow;
    };
  };
};

// NOTE: Feel free to adjust these values if your scanned table says slightly different numbers.
export const RICE_TARGETS: RiceTable = {
  hybrid: {
    light: {
      wet: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 70,  M: 50, H: 30 },
        K: { L: 80,  M: 50, H: 30 },
      },
      dry: {
        N: { L: 140, M: 110, H: 80 },
        P: { L: 80,  M: 60,  H: 30 },
        K: { L: 90,  M: 70,  H: 50 },
      },
    },
    medHeavy: {
      wet: {
        // This row matches closely your 110-70-70 example
        N: { L: 110, M: 80, H: 50 },
        P: { L: 70,  M: 50, H: 30 },
        K: { L: 70,  M: 50, H: 30 },
      },
      dry: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 70,  M: 50, H: 30 },
        K: { L: 80,  M: 60, H: 40 },
      },
    },
  },
  inbred: {
    light: {
      wet: {
        N: { L: 100, M: 70, H: 40 },
        P: { L: 60,  M: 40, H: 20 },
        K: { L: 60,  M: 40, H: 20 },
      },
      dry: {
        N: { L: 120, M: 90, H: 60 },
        P: { L: 60,  M: 40, H: 20 },
        K: { L: 60,  M: 40, H: 20 },
      },
    },
    medHeavy: {
      wet: {
        N: { L: 90,  M: 60, H: 30 },
        P: { L: 60,  M: 40, H: 20 },
        K: { L: 60,  M: 40, H: 20 },
      },
      dry: {
        N: { L: 100, M: 70, H: 40 },
        P: { L: 60,  M: 40, H: 20 },
        K: { L: 60,  M: 40, H: 20 },
      },
    },
  },
};

export function getTargetKgPerHa(
  variety: RiceVariety,
  soilClass: SoilClass,
  season: Season,
  nRating: NutrientRating,
  pRating: NutrientRating,
  kRating: NutrientRating,
) {
  const row = RICE_TARGETS[variety][soilClass][season];
  return {
    Nkg: row.N[nRating],
    Pkg: row.P[pRating],
    Kkg: row.K[kRating],
  };
}

/* ---------------- 3. Read fertilizer products from AdminPricesDoc ---------------- */

export type FertilizerProduct = {
  code: string;
  label: string;
  pricePerBag: number;
  bagKg: number;
  Npct: number;
  Ppct: number;
  Kpct: number;
};

export function extractProducts(doc: AdminPricesDoc): FertilizerProduct[] {
  const out: FertilizerProduct[] = [];
  const items = doc.items || {};
  for (const [code, v] of Object.entries(items)) {
    if (!v) continue;
    const npk = v.npk || { N: 0, P: 0, K: 0 };
    out.push({
      code,
      label: v.label ?? code,
      pricePerBag: Number(v.pricePerBag ?? 0),
      bagKg: v.bagKg ?? 50,
      Npct: npk.N ?? 0,
      Ppct: npk.P ?? 0,
      Kpct: npk.K ?? 0,
    });
  }
  return out;
}

function kgPerBag(prod: FertilizerProduct, nutrient: 'N' | 'P' | 'K'): number {
  const pct = nutrient === 'N' ? prod.Npct : nutrient === 'P' ? prod.Ppct : prod.Kpct;
  return (pct / 100) * prod.bagKg;
}

function costPerKgNutrient(prod: FertilizerProduct, nutrient: 'N' | 'P' | 'K'): number {
  const kg = kgPerBag(prod, nutrient);
  return kg > 0 ? prod.pricePerBag / kg : Number.POSITIVE_INFINITY;
}

export type SelectedFerts = {
  balanced?: FertilizerProduct;
  nOnly?: FertilizerProduct;
  kOnly?: FertilizerProduct;
};

export function selectFertilizers(products: FertilizerProduct[]): SelectedFerts {
  let balanced: FertilizerProduct | undefined;
  let nOnly: FertilizerProduct | undefined;
  let kOnly: FertilizerProduct | undefined;

  for (const p of products) {
    const hasN = p.Npct > 0;
    const hasP = p.Ppct > 0;
    const hasK = p.Kpct > 0;

    if (hasN && hasP && hasK) {
      // balanced: choose cheapest per kg P (P is limiting)
      if (!balanced || costPerKgNutrient(p, 'P') < costPerKgNutrient(balanced, 'P')) {
        balanced = p;
      }
    }

    if (hasN && !hasP && !hasK) {
      if (!nOnly || costPerKgNutrient(p, 'N') < costPerKgNutrient(nOnly, 'N')) {
        nOnly = p;
      }
    }

    if (!hasN && !hasP && hasK) {
      if (!kOnly || costPerKgNutrient(p, 'K') < costPerKgNutrient(kOnly, 'K')) {
        kOnly = p;
      }
    }
  }

  return { balanced, nOnly, kOnly };
}

/* ---------------- 4. Balanced-first plan (base on P, then N-only, then K-only) ---------------- */

export type ComputedPlan = {
  rows: { product: FertilizerProduct; bags: number }[];
  supplied: { Nkg: number; Pkg: number; Kkg: number };
  totalCost: number;
};

export function computeBalancedPlan(
  targetNkg: number,
  targetPkg: number,
  targetKkg: number,
  ferts: SelectedFerts,
): ComputedPlan {
  const rows: { product: FertilizerProduct; bags: number }[] = [];
  let Nsup = 0;
  let Psup = 0;
  let Ksup = 0;
  let totalCost = 0;

  const roundBags = (x: number) => Math.round(x * 100) / 100; // 2 decimal places

  if (!ferts.balanced || !ferts.nOnly || !ferts.kOnly) {
    // If we don't have enough fertilizer types, return empty plan
    return {
      rows: [],
      supplied: { Nkg: 0, Pkg: 0, Kkg: 0 },
      totalCost: 0,
    };
  }

  // 1) Use balanced to satisfy all P
  const b = ferts.balanced;
  const PkgPerBag = kgPerBag(b, 'P') || 0.0001;
  let bagsBalanced = roundBags(targetPkg / PkgPerBag);

  Nsup += bagsBalanced * kgPerBag(b, 'N');
  Psup += bagsBalanced * kgPerBag(b, 'P');
  Ksup += bagsBalanced * kgPerBag(b, 'K');
  totalCost += bagsBalanced * b.pricePerBag;
  rows.push({ product: b, bags: bagsBalanced });

  // 2) Remaining N & K
  let remainingN = Math.max(0, targetNkg - Nsup);
  let remainingK = Math.max(0, targetKkg - Ksup);

  // 3) N-only fertilizer
  const nF = ferts.nOnly;
  const NkgBagN = kgPerBag(nF, 'N') || 0.0001;
  let bagsN = roundBags(remainingN / NkgBagN);

  Nsup += bagsN * NkgBagN;
  totalCost += bagsN * nF.pricePerBag;
  if (bagsN > 0) rows.push({ product: nF, bags: bagsN });

  // 4) K-only fertilizer
  const kF = ferts.kOnly;
  const KkgBagK = kgPerBag(kF, 'K') || 0.0001;
  let bagsK = roundBags(remainingK / KkgBagK);

  Ksup += bagsK * KkgBagK;
  totalCost += bagsK * kF.pricePerBag;
  if (bagsK > 0) rows.push({ product: kF, bags: bagsK });

  return {
    rows,
    supplied: { Nkg: Nsup, Pkg: Psup, Kkg: Ksup },
    totalCost,
  };
}



/* ---------------- 5. High-level function: from soil ppm → RecommendResponse ---------------- */

export function buildRiceRecommendation(input: RiceRecommendInput): RecommendResponse {
  const {
    nPpm,
    pPpm,
    kPpm,
    ph,
    areaHa = 1,
    variety = 'hybrid',
    soilClass = 'medHeavy',
    season = 'wet',
    pricesDoc,
  } = input;

  const nRating = classifyN(nPpm);
  const pRating = classifyP(pPpm);
  const kRating = classifyK(kPpm);

  const { Nkg, Pkg, Kkg } = getTargetKgPerHa(
    variety,
    soilClass,
    season,
    nRating,
    pRating,
    kRating,
  );

  const totalN = Nkg * areaHa;
  const totalP = Pkg * areaHa;
  const totalK = Kkg * areaHa;

  const products = extractProducts(pricesDoc);
  const ferts = selectFertilizers(products);

  const planResult = computeBalancedPlan(totalN, totalP, totalK, ferts);

  const rows: RecommendPlanRow[] = planResult.rows.map((r) => ({
    key: r.product.code,
    label: r.product.label,
    bags: r.bags,
    pricePerBag: r.product.pricePerBag,
    subtotal: r.bags * r.product.pricePerBag,
  }));

  const currency = pricesDoc.currency || 'PHP';

  const plan: RecommendPlan = {
    code: 'rice_balanced',
    title: 'Rice Fertilizer Plan (Balanced-first)',
    rows,
    total: planResult.totalCost,
    currency,
  };

  // Narrative (Tagalog + English)
  const narrativeTL =
    `Base sa soil test: N=${nPpm.toFixed(1)} ppm, P=${pPpm.toFixed(1)} ppm, ` +
    `K=${kPpm.toFixed(1)} ppm.\n` +
    `Ang lupa ay may antas na N=${nRating}, P=${pRating}, K=${kRating}. ` +
    `Para sa ${variety.toUpperCase()} rice (${season} season, ${soilClass === 'medHeavy' ? 'medium-heavy' : 'light'} soil) ` +
    `inirerekomenda ang humigit-kumulang ${totalN.toFixed(0)} kg N, ` +
    `${totalP.toFixed(0)} kg P at ${totalK.toFixed(0)} kg K bawat ${areaHa} ha.`;

  const narrativeEN =
    `Soil test readings are N=${nPpm.toFixed(1)} ppm, P=${pPpm.toFixed(1)} ppm, ` +
    `K=${kPpm.toFixed(1)} ppm.\n` +
    `This corresponds to N=${nRating}, P=${pRating}, K=${kRating} soil fertility. ` +
    `For ${variety} rice in the ${season} season on ${soilClass === 'medHeavy' ? 'medium-heavy' : 'light'} soil, ` +
    `the recommended application is about ${totalN.toFixed(0)} kg N, ` +
    `${totalP.toFixed(0)} kg P and ${totalK.toFixed(0)} kg K for ${areaHa} ha.`;

  return {
    ok: true,
    input: {
      nPpm,
      pPpm,
      kPpm,
      ph,
      areaHa,
      variety,
      soilClass,
      season,
      ratings: { N: nRating, P: pRating, K: kRating },
      targetsPerHa: { Nkg, Pkg, Kkg },
    },
    narrative: { tl: narrativeTL, en: narrativeEN },
    plans: [plan],
    cheapest: { code: plan.code, total: plan.total, currency },
    updatedAt: new Date().toISOString(),
  };
  
}

// ================================
// ✅ Simple wrapper used by the app screens
// (Guest/Stakeholder can both call this)
// ================================
export function generateFertilizerPlan(args: {
  n: number;
  p: number;
  k: number;
  ph?: number | null;

  areaHa?: number;
  variety?: RiceVariety;
  soilClass?: SoilClass;
  season?: Season;

  pricesDoc: AdminPricesDoc;
}) {
  const resp = buildRiceRecommendation({
    nPpm: args.n,
    pPpm: args.p,
    kPpm: args.k,
    ph: args.ph ?? undefined,
    areaHa: args.areaHa ?? 1,
    variety: args.variety ?? 'hybrid',
    soilClass: args.soilClass ?? 'medHeavy',
    season: args.season ?? 'wet',
    pricesDoc: args.pricesDoc,
  });

  // Convert RecommendResponse -> UI-friendly plans
  const fertilizerPlans = (resp.plans || []).map((p) => ({
    name: p.title,
    cost: String(Math.round((p.total ?? 0) * 100) / 100),
    details: (p.rows || []).map((r) => {
      const bags = Math.round((r.bags ?? 0) * 100) / 100;
      const subtotal = Math.round((r.subtotal ?? 0) * 100) / 100;
      return `${bags} bag(s) - ${r.label} | ${resp.cheapest?.currency ?? 'PHP'} ${r.pricePerBag}/bag | Subtotal: ${resp.cheapest?.currency ?? 'PHP'} ${subtotal}`;
    }),
  }));

  return {
    recommendationText: resp.narrative?.tl ?? '',
    englishText: resp.narrative?.en ?? '',
    fertilizerPlans,
    raw: resp, // optional if you want to use ratings/targets later
  };
}
