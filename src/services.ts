// src/services.ts
import { api } from './api';

/* ===== Types used by AuthContext ===== */
export type User = {
  _id?: string;
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

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'stakeholder' | 'guest';
  address?: string;
  farmLocation?: string;
  mobile?: string;
};

export type LoginPayload = { email: string; password: string };

export type LoginResponse = {
  mobile: string | undefined;
  farmLocation: string | undefined;
  address: string | undefined;
  role: 'admin' | 'stakeholder';
  email: string;
  name: string;
  token: string;
  user: User;
};

// search farmer by code or id
export type GetFarmerParams = { code?: string; id?: string };

/* ===== Add Reading ===== */
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
};

/* ===== Helpers ===== */
function authHeaders(token?: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function makeRandomCode(prefix = 'FS'): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
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

export async function getFarmer(
  params: GetFarmerParams,
  token?: string | null
): Promise<any | null> {
  const { data } = await api.get('/api/farmers', {
    params,
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
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

export async function updateFarmer(
  id: string,
  body: any,
  token?: string | null
): Promise<any> {
  const { code: _omit, ...rest } = body || {};
  const { data } = await api.put(`/api/farmers/${id}`, rest, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function deleteFarmer(
  id: string,
  token?: string | null
): Promise<any> {
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

export async function getPriceSettings(
  token?: string | null
): Promise<AdminPricesDoc> {
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

/* ===== Readings (Farmer Logs) ===== */
export async function listReadingsByFarmer(
  farmerId: string,
  token?: string | null
): Promise<any[]> {
  const { data } = await api.get(`/api/farmers/${farmerId}/readings`, {
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data : [];
}

/* === addReading sends {points:[...]} for addReadingBatch (ADMIN flow) === */
export async function addReading(
  body: AddReadingParams,
  token?: string | null
): Promise<any> {
  const { farmerId, ...rest } = body;

  const cleanPoint = {
    N: Number(rest.N ?? 0),
    P: Number(rest.P ?? 0),
    K: Number(rest.K ?? 0),
    ph: rest.ph != null ? Number(rest.ph) : undefined,
    ec: rest.ec != null ? Number(rest.ec) : undefined,
    moisture: rest.moisture != null ? Number(rest.moisture) : undefined,
    temp: rest.temp != null ? Number(rest.temp) : undefined,
    source: rest.source ?? 'manual',
  };

  const payload = { points: [cleanPoint], meta: { client: 'app', version: 1 } };

  const { data } = await api.post(`/api/farmers/${farmerId}/readings`, payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

/* === Standalone reading (no farmerId) → POST /api/readings (STAKEHOLDER) === */
export async function addStandaloneReading(
  body: AddStandaloneReadingParams,
  token?: string | null
): Promise<any> {
  const payload: any = {
    // match pickReadingNumbers in readingController
    n: Number(body.N ?? 0),
    p: Number(body.P ?? 0),
    k: Number(body.K ?? 0),
    ph: body.ph != null ? Number(body.ph) : undefined,
    ec: body.ec != null ? Number(body.ec) : undefined,
    moisture: body.moisture != null ? Number(body.moisture) : undefined,
    temp: body.temp != null ? Number(body.temp) : undefined,
    source: body.source ?? 'esp32',
  };

  const { data } = await api.post('/api/readings', payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function updateReading(
  farmerId: string,
  readingId: string,
  body: Partial<AddReadingParams>,
  token?: string | null
): Promise<any> {
  const payload: any = {};
  if (body.N !== undefined) payload.N = body.N;
  if (body.P !== undefined) payload.P = body.P;
  if (body.K !== undefined) payload.K = body.K;
  if (body.ph !== undefined) payload.ph = body.ph;
  if (body.ec !== undefined) payload.ec = body.ec;
  if (body.moisture !== undefined) payload.moisture = body.moisture;
  if (body.temp !== undefined) payload.temp = body.temp;
  if (body.source !== undefined) payload.source = body.source;

  const { data } = await api.patch(
    `/api/farmers/${farmerId}/readings/${readingId}`,
    payload,
    { headers: authHeaders(token || undefined) }
  );
  return data;
}

export async function deleteReading(
  farmerId: string,
  readingId: string,
  token?: string | null
): Promise<any> {
  const { data } = await api.delete(
    `/api/farmers/${farmerId}/readings/${readingId}`,
    {
      headers: authHeaders(token || undefined),
    }
  );
  return data;
}

/* ===== Recommendation (normalized) ===== */

/** Row in a server plan */
export type RecommendPlanRow = {
  key: string;
  label: string;
  bags: number;
  pricePerBag: number;
  subtotal: number;
};

/** Normalized plan shape (what callers will always receive) */
export type RecommendPlan = {
  code: string;
  title: string;
  rows: RecommendPlanRow[];
  total: number;
  currency: string;
};

/** Final normalized response (always has `plans`) */
export type RecommendResponse = {
  ok?: boolean;
  input?: any;
  narrative?: { en?: string; tl?: string };
  plans: RecommendPlan[];
  cheapest?: { code: string; total: number; currency: string } | null;
  currency?: string;
  updatedAt?: string;
};

/** Payload for /api/recommend
 *  Matches the new IRRI-based controller:
 *  expects n, p, k (ppm), optional ph, riceType, season, soilType, areaHa
 */
export type RecommendRequest = {
  n: number; // N in ppm from sensor
  p: number; // P in ppm from sensor
  k: number; // K in ppm from sensor
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

  // new shape (plans present)
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

  // legacy mapping (lines → single plan)
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

  // safe empty
  return { ok: !!data?.ok, plans: [], updatedAt: data?.updatedAt };
}
