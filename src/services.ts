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
  email: string; // ✅ required string again (we’ll send '')
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

export async function registerApi(
  payload: RegisterPayload
): Promise<LoginResponse> {
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

export async function createFarmer(
  body: any,
  token?: string | null
): Promise<any> {
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

export async function addReading(
  body: AddReadingParams,
  token?: string | null
): Promise<any> {
  const { farmerId, ...rest } = body;

  const payload: any = {
    n: Number(rest.N ?? 0),
    p: Number(rest.P ?? 0),
    k: Number(rest.K ?? 0),
    ph: rest.ph != null ? Number(rest.ph) : undefined,
    source: rest.source ?? 'esp32',
  };

  if (rest.moisture != null) payload.moisture = Number(rest.moisture);
  if (rest.ec != null) payload.ec = Number(rest.ec);
  if (rest.temp != null) payload.temp = Number(rest.temp);

  const { data } = await api.post(
    `/api/farmers/${farmerId}/readings`,
    payload,
    {
      headers: authHeaders(token || undefined),
    }
  );

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
