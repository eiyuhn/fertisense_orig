// src/services.ts
import { api } from './api';

/* ===== Types used by AuthContext ===== */
export type User = {
  _id?: string;
  username?: string;
  name: string;
  email?: string;
  role: 'admin' | 'stakeholder' | 'guest';
  address?: string;
  farmLocation?: string;
  mobile?: string;
  profileImage?: string | null;
  photoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SecurityQuestionPayload = {
  question: string;
  answer: string;
};

export type RegisterPayload = {
  username: string;
  name: string;
  password: string;
  role?: 'admin' | 'stakeholder' | 'guest';
  address?: string;
  farmLocation?: string;
  mobile?: string;
  email: string; // required string, can send '' if none
  securityQuestions?: SecurityQuestionPayload[];
};

export type LoginPayload = { username: string; password: string };

export type LoginResponse = {
  mobile: string | undefined;
  farmLocation: string | undefined;
  address: string | undefined;
  role: 'admin' | 'stakeholder';
  email?: string;
  username?: string;
  name: string;
  token: string;
  user: User;
};

/* ===== Admin: Stakeholders List ===== */
export type StakeholderLite = {
  _id: string;
  username: string;
  name: string;
};

export type StakeholdersResponse = {
  count: number;
  users: StakeholderLite[];
};

// search farmer by code or id
export type GetFarmerParams = { code?: string; id?: string };

/* ===== Add Reading ===== */
export type FertilizerPlanHistory = {
  name?: string;
  cost?: string;
  details?: string[];
};

export type AddReadingParams = {
  farmerId: string;
  N: number;
  P: number;
  K: number;
  ph?: number | null;
  ec?: number | null;
  moisture?: number | null;
  temp?: number | null;
  source?: 'esp32' | 'manual' | string;

  // ✅ stored in MongoDB Reading (for History screen)
  recommendationText?: string;
  englishText?: string;
  fertilizerPlans?: FertilizerPlanHistory[];
  currency?: string;

  // ✅ optional DA fields (safe even if backend ignores)
  daSchedule?: any;
  daCost?: any;
  npkClass?: string;
};

// Standalone reading (no farmerId) – used on STAKEHOLDER side
export type AddStandaloneReadingParams = {
  N: number;
  P: number;
  K: number;
  ph?: number | null;
  ec?: number | null;
  moisture?: number | null;
  temp?: number | null;
  source?: 'esp32' | 'manual' | string;

  // ✅ stored in MongoDB Reading (for History screen)
  recommendationText?: string;
  englishText?: string;
  fertilizerPlans?: FertilizerPlanHistory[];
  currency?: string;

  // ✅ optional DA fields
  daSchedule?: any;
  daCost?: any;
  npkClass?: string;
};

/* ===== Helpers ===== */
function authHeaders(token?: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function makeRandomCode(prefix = 'FS'): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
}

function normalizePlans(plans?: FertilizerPlanHistory[]) {
  if (!Array.isArray(plans)) return undefined;
  return plans.map((p) => ({
    name: p?.name != null ? String(p.name) : '',
    cost: p?.cost != null ? String(p.cost) : '',
    details: Array.isArray(p?.details) ? p.details.map((x) => String(x)) : [],
  }));
}

/* ===== Health / Ping ===== */
export async function pingApi() {
  const { data } = await api.get('/api/health');
  return data;
}

/* ===== Auth ===== */
export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await api.post('/api/auth/login', payload);
  return data;
}

export async function registerApi(payload: RegisterPayload): Promise<LoginResponse> {
  const { data } = await api.post('/api/auth/register', payload);
  return data;
}

export async function meApi(token?: string | null): Promise<User> {
  const { data } = await api.get('/api/auth/me', {
    headers: authHeaders(token || undefined),
  });
  return data;
}

/* ===== Farmers ===== */
export async function listFarmers(token?: string | null): Promise<any[]> {
  const { data } = await api.get('/api/farmers', {
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data : [];
}

export async function getFarmer(params: GetFarmerParams, token?: string | null): Promise<any | null> {
  const { data } = await api.get('/api/farmers', {
    params,
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

/* ===== Admin: Stakeholders List ===== */
export async function getStakeholders(token?: string | null): Promise<StakeholdersResponse> {
  const { data } = await api.get('/api/admin/stakeholders', {
    headers: authHeaders(token || undefined),
  });

  const usersRaw = Array.isArray(data?.users) ? data.users : [];
  return {
    count: Number(data?.count ?? usersRaw.length),
    users: usersRaw.map((u: any) => ({
      _id: String(u?._id || ''),
      username: String(u?.username || ''),
      name: String(u?.name || ''),
    })),
  };
}

export async function createFarmer(body: any, token?: string | null): Promise<any> {
  const { code: _omit, ...rest } = body || {};
  try {
    const { data } = await api.post('/api/farmers', rest, {
      headers: authHeaders(token || undefined),
    });
    return data;
  } catch (e: any) {
    const msg =
      e?.response?.data?.error || e?.response?.data?.message || e?.message || '';
    const status = e?.response?.status ?? 0;
    const looksLikeCodeConflict =
      status === 409 || /code.*exist/i.test(msg) || /farmer code/i.test(msg);
    if (!looksLikeCodeConflict) throw e;
    const retryPayload = { ...rest, code: makeRandomCode() };
    const { data: retried } = await api.post('/api/farmers', retryPayload, {
      headers: authHeaders(token || undefined),
    });
    return retried;
  }
}

export async function updateFarmer(id: string, body: any, token?: string | null): Promise<any> {
  const { code: _omit, ...rest } = body || {};
  const { data } = await api.put(`/api/farmers/${id}`, rest, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function deleteFarmer(id: string, token?: string | null): Promise<any> {
  const { data } = await api.delete(`/api/farmers/${id}`, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

/* ===== Prices (PUBLIC + ADMIN) ===== */
export type AdminPricesDoc = {
  _id?: string;
  currency: string;
  items: {
    [code: string]: {
      label: string;
      pricePerBag: number;
      bagKg: number;
      npk: { N: number; P: number; K: number };
      active: boolean;
    };
  };
  updatedAt?: string;
};

export async function getPublicPrices(): Promise<AdminPricesDoc> {
  const { data } = await api.get('/api/prices');
  return data;
}

export async function getPriceSettings(token?: string | null): Promise<AdminPricesDoc> {
  const { data } = await api.get('/api/prices/admin', {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function putPriceSettings(
  token: string | undefined | null,
  payload: AdminPricesDoc
): Promise<AdminPricesDoc> {
  const { data } = await api.put('/api/prices/admin', payload, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token || undefined),
    },
  });
  return data;
}

/* ===== Readings (Farmer Logs + User-wide history) ===== */
export async function listUserReadings(token?: string | null): Promise<any[]> {
  const { data } = await api.get('/api/readings', {
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data : [];
}

export async function listReadingsByFarmer(farmerId: string, token?: string | null): Promise<any[]> {
  const { data } = await api.get(`/api/readings/farmers/${farmerId}`, {
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data : [];
}

export async function addReading(body: AddReadingParams, token?: string | null): Promise<any> {
  const { farmerId, ...rest } = body;

  const payload: any = {
    farmerId,
    n: Number(rest.N ?? 0),
    p: Number(rest.P ?? 0),
    k: Number(rest.K ?? 0),
    ph: rest.ph != null ? Number(rest.ph) : undefined,
    source: rest.source ?? 'esp32',
  };

  if (rest.moisture != null) payload.moisture = Number(rest.moisture);
  if (rest.ec != null) payload.ec = Number(rest.ec);
  if (rest.temp != null) payload.temp = Number(rest.temp);

  // ✅ pass-through for Mongo history
  if (rest.recommendationText != null) payload.recommendationText = String(rest.recommendationText);
  if (rest.englishText != null) payload.englishText = String(rest.englishText);
  if (rest.currency != null) payload.currency = String(rest.currency);
  const plans = normalizePlans(rest.fertilizerPlans);
  if (plans) payload.fertilizerPlans = plans;

  // ✅ optional DA fields
  if (rest.daSchedule != null) payload.daSchedule = rest.daSchedule;
  if (rest.daCost != null) payload.daCost = rest.daCost;
  if (rest.npkClass != null) payload.npkClass = String(rest.npkClass);

  const { data } = await api.post('/api/readings', payload, {
    headers: authHeaders(token || undefined),
  });

  return data;
}

export async function addStandaloneReading(
  body: AddStandaloneReadingParams,
  token?: string | null
): Promise<any> {
  const payload: any = {
    n: Number(body.N ?? 0),
    p: Number(body.P ?? 0),
    k: Number(body.K ?? 0),
    ph: body.ph != null ? Number(body.ph) : undefined,
    ec: body.ec != null ? Number(body.ec) : undefined,
    moisture: body.moisture != null ? Number(body.moisture) : undefined,
    temp: body.temp != null ? Number(body.temp) : undefined,
    source: body.source ?? 'esp32',
  };

  // ✅ pass-through for Mongo history
  if (body.recommendationText != null) payload.recommendationText = String(body.recommendationText);
  if (body.englishText != null) payload.englishText = String(body.englishText);
  if (body.currency != null) payload.currency = String(body.currency);
  const plans = normalizePlans(body.fertilizerPlans);
  if (plans) payload.fertilizerPlans = plans;

  // ✅ optional DA fields
  if (body.daSchedule != null) payload.daSchedule = body.daSchedule;
  if (body.daCost != null) payload.daCost = body.daCost;
  if (body.npkClass != null) payload.npkClass = String(body.npkClass);

  const { data } = await api.post('/api/readings', payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function updateReading(
  farmerId: string, // unused
  readingId: string,
  body: Partial<AddReadingParams>,
  token?: string | null
): Promise<any> {
  const payload: any = {};

  // ✅ match backend pickReadingNumbers()
  if (body.N !== undefined) payload.n = Number(body.N);
  if (body.P !== undefined) payload.p = Number(body.P);
  if (body.K !== undefined) payload.k = Number(body.K);

  if (body.ph !== undefined) payload.ph = body.ph == null ? null : Number(body.ph);
  if (body.ec !== undefined) payload.ec = body.ec == null ? null : Number(body.ec);
  if (body.moisture !== undefined) payload.moisture = body.moisture == null ? null : Number(body.moisture);
  if (body.temp !== undefined) payload.temp = body.temp == null ? null : Number(body.temp);

  if (body.source !== undefined) payload.source = body.source;

  // ✅ allow updating plan fields too
  if ((body as any).recommendationText !== undefined) payload.recommendationText = String((body as any).recommendationText ?? '');
  if ((body as any).englishText !== undefined) payload.englishText = String((body as any).englishText ?? '');
  if ((body as any).currency !== undefined) payload.currency = String((body as any).currency ?? 'PHP');

  if ((body as any).fertilizerPlans !== undefined) {
    const plans = normalizePlans((body as any).fertilizerPlans);
    payload.fertilizerPlans = plans || [];
  }

  if ((body as any).daSchedule !== undefined) payload.daSchedule = (body as any).daSchedule;
  if ((body as any).daCost !== undefined) payload.daCost = (body as any).daCost;
  if ((body as any).npkClass !== undefined) payload.npkClass = String((body as any).npkClass ?? '');

  const { data } = await api.patch(`/api/readings/${readingId}`, payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function deleteReading(
  farmerId: string, // unused
  readingId: string,
  token?: string | null
): Promise<any> {
  const { data } = await api.delete(`/api/readings/${readingId}`, {
    headers: authHeaders(token || undefined),
  });
  return data;
}


/* ===== Recommendation (OLD normalized / IRRI style) ===== */
export type RecommendPlanRow = {
  key: string;
  label: string;
  bags: number;
  pricePerBag: number;
  subtotal: number;
};

export type RecommendPlan = {
  code: string;
  title: string;
  rows: RecommendPlanRow[];
  total: number;
  currency: string;
};

export type RecommendResponse = {
  ok?: boolean;
  input?: any;
  narrative?: { en?: string; tl?: string };
  plans: RecommendPlan[];
  cheapest?: { code: string; total: number; currency: string } | null;
  currency?: string;
  updatedAt?: string;
};

export type RecommendRequest = {
  n: number;
  p: number;
  k: number;
  ph?: number;
  riceType?: 'HYBRID' | 'INBRED' | string;
  season?: 'WET' | 'DRY' | string;
  soilType?: 'LIGHT' | 'HEAVY' | string;
  areaHa?: number;
};

export async function getRecommendation(
  token: string | undefined | null,
  payload: RecommendRequest
): Promise<RecommendResponse> {
  const { data } = await api.post('/api/recommend', payload as any, {
    headers: authHeaders(token || undefined),
  });

  if (Array.isArray(data?.plans)) {
    return {
      ok: data?.ok,
      input: data?.input,
      narrative: data?.narrative,
      plans: data.plans.map((p: any) => ({
        code: p.code,
        title: p.title,
        rows: (p.rows || []).map((r: any) => ({
          key: r.key,
          label: r.label,
          bags: Number(r.bags || 0),
          pricePerBag: Number(r.pricePerBag || 0),
          subtotal: Number(r.subtotal || 0),
        })),
        total: Number(p.total || 0),
        currency: String(p.currency || data?.currency || 'PHP'),
      })),
      cheapest: data?.cheapest || null,
      currency: data?.currency || 'PHP',
      updatedAt: data?.updatedAt,
    };
  }

  if (Array.isArray(data?.lines)) {
    const plan: RecommendPlan = {
      code: 'legacy',
      title: 'Plan 1',
      rows: data.lines.map((l: any) => ({
        key: l.code,
        label: l.label,
        bags: Number(l.bags || 0),
        pricePerBag: Number(l.pricePerBag || 0),
        subtotal: Number(l.lineCost || 0),
      })),
      total: Number(data.totalCost || 0),
      currency: String(data.currency || 'PHP'),
    };
    return { ok: data?.ok, plans: [plan], updatedAt: data?.updatedAt };
  }

  return { ok: !!data?.ok, plans: [], updatedAt: data?.updatedAt };
}

/* ===== Recommendation (DA + Alternatives, cheapest-first) ===== */

export type DaScheduleLine = { code: string; bags: number };

export type DaSchedule = {
  organic?: DaScheduleLine[];
  basal?: DaScheduleLine[];
  after30DAT?: DaScheduleLine[];
  topdress60DBH?: DaScheduleLine[];
};

export type DaCostRow = {
  phase: string; // "BASAL" | "30 DAT" | "TOPDRESS" etc.
  code: string;
  bags: number;
  pricePerBag: number | null;
  subtotal: number | null;
};

export type DaCost = {
  currency: string;
  rows: DaCostRow[];
  total: number;
};

export type DaPlan = {
  id: string;
  title: string;
  label: string;
  isDa?: boolean;
  isCheapest?: boolean;
  schedule: DaSchedule;
  cost: DaCost | null;
};

export type DaRecommendResponse = {
  ok: boolean;
  crop?: string;
  input?: any;
  classified?: {
    N: 'L' | 'M' | 'H';
    P: 'L' | 'M' | 'H';
    K: 'L' | 'M' | 'H';
    npkClass: string;
  };
  nutrientRequirementKgHa?: { N: number; P: number; K: number };

  // backward compatible (older server)
  schedule?: DaSchedule;
  cost?: DaCost | null;

  // ✅ new response
  plans?: DaPlan[];
  cheapest?: { id: string; total: number; currency: string } | null;

  note?: string;
};

export type DaRecommendRequest = {
  crop?: 'rice_hybrid' | string;
  n?: number | null;
  p?: number | null;
  k?: number | null;
  nClass?: 'L' | 'M' | 'H' | null;
  pClass?: 'L' | 'M' | 'H' | null;
  kClass?: 'L' | 'M' | 'H' | null;
  areaHa?: number;
};

function normalizeDaSchedule(s: any): DaSchedule {
  const normLines = (arr: any): DaScheduleLine[] =>
    Array.isArray(arr)
      ? arr
          .map((x) => ({
            code: String(x?.code ?? ''),
            bags: Number(x?.bags ?? 0),
          }))
          .filter((x) => x.code)
      : [];

  return {
    organic: normLines(s?.organic),
    basal: normLines(s?.basal),
    after30DAT: normLines(s?.after30DAT),
    topdress60DBH: normLines(s?.topdress60DBH),
  };
}

function normalizeDaCost(c: any): DaCost | null {
  if (!c || typeof c !== 'object') return null;

  const rows: DaCostRow[] = Array.isArray(c?.rows)
    ? c.rows.map((r: any) => ({
        phase: String(r?.phase ?? ''),
        code: String(r?.code ?? ''),
        bags: Number(r?.bags ?? 0),
        pricePerBag: r?.pricePerBag == null ? null : Number(r.pricePerBag),
        subtotal: r?.subtotal == null ? null : Number(r.subtotal),
      }))
    : [];

  return {
    currency: String(c?.currency || 'PHP'),
    rows,
    total: Number(c?.total || 0),
  };
}

function normalizeDaPlan(p: any): DaPlan {
  return {
    id: String(p?.id || p?.code || ''),
    title: String(p?.title || 'Fertilizer Plan'),
    label: String(p?.label || 'Plan'),
    isDa: !!p?.isDa,
    isCheapest: !!p?.isCheapest,
    schedule: normalizeDaSchedule(p?.schedule || {}),
    cost: normalizeDaCost(p?.cost),
  };
}

export async function getDaRecommendation(
  token: string | undefined | null,
  payload: DaRecommendRequest
): Promise<DaRecommendResponse> {
  const { data } = await api.post('/api/recommend', payload as any, {
    headers: authHeaders(token || undefined),
  });

  const out: DaRecommendResponse = {
    ok: !!data?.ok,
    crop: data?.crop,
    input: data?.input,
    classified: data?.classified,
    nutrientRequirementKgHa: data?.nutrientRequirementKgHa,
    note: data?.note,

    // backward compatible:
    schedule: data?.schedule ? normalizeDaSchedule(data.schedule) : undefined,
    cost: data?.cost ? normalizeDaCost(data.cost) : null,

    // new:
    plans: Array.isArray(data?.plans) ? data.plans.map(normalizeDaPlan) : undefined,
    cheapest: data?.cheapest
      ? {
          id: String(data.cheapest.id || ''),
          total: Number(data.cheapest.total || 0),
          currency: String(data.cheapest.currency || 'PHP'),
        }
      : null,
  };

  return out;
}

/* ===== Forgot Password via Security Questions (username-based) ===== */
export type SecurityQuestion = { index: number; question: string };

export async function getSecurityQuestionsApi(
  username: string
): Promise<{ questions: SecurityQuestion[] }> {
  const { data } = await api.post('/api/auth/security-questions', { username });
  return data;
}

export async function resetPasswordWithSecurityQuestionApi(params: {
  username: string;
  index: number;
  answer: string;
  newPassword: string;
}) {
  const { data } = await api.post('/api/auth/reset-password', params);
  return data;
}
