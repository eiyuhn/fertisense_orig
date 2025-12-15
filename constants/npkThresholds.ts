// constants/npkThresholds.ts

export type Nutrient = 'N' | 'P' | 'K';
export type NutrientLevelCode = 'L' | 'M' | 'H';

export interface ThresholdRange {
  code: NutrientLevelCode;     // 'L' | 'M' | 'H'
  label: string;               // 'Low' | 'Medium' | 'High'
  min: number | null;          // inclusive lower bound
  max: number | null;          // inclusive upper bound, null = no upper limit
  unit: string;                // '%OM', 'ppm', etc.
}

export const NPK_THRESHOLDS: Record<Nutrient, ThresholdRange[]> = {
  /* NITROGEN – based on % Organic Matter (OM) */
  N: [
    { code: 'L', label: 'Low',    min: 0,   max: 1.7, unit: '%OM' },   // 0–1.7
    { code: 'M', label: 'Medium', min: 1.7, max: 3.0, unit: '%OM' },   // >1.7–3.0
    { code: 'H', label: 'High',   min: 3.0, max: null, unit: '%OM' },  // >3.0
  ],

  /* PHOSPHORUS – fill these once you have the DA/sensor table */
  P: [
    // { code: 'L', label: 'Low',    min: 0,  max: 15,  unit: 'ppm' },
    // { code: 'M', label: 'Medium', min: 15, max: 30,  unit: 'ppm' },
    // { code: 'H', label: 'High',   min: 30, max: null, unit: 'ppm' },
  ],

  /* POTASSIUM – sensor values in ppm */
  K: [
    { code: 'L', label: 'Low',    min: 0,   max: 117, unit: 'ppm' },   // 0–117
    { code: 'M', label: 'Medium', min: 117, max: 235, unit: 'ppm' },   // >117–235
    { code: 'H', label: 'High',   min: 235, max: null, unit: 'ppm' },  // >235
  ],
};

/** Classify a nutrient value into its L/M/H range */
export function classifyNutrient(
  nutrient: Nutrient,
  value: number
): ThresholdRange | null {
  const ranges = NPK_THRESHOLDS[nutrient];
  if (!ranges || ranges.length === 0) return null;

  for (const r of ranges) {
    const aboveMin = r.min === null ? true : value >= r.min;
    const belowMax = r.max === null ? true : value <= r.max;
    if (aboveMin && belowMax) return r;
  }
  return null;
}
