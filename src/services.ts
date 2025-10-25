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

export type GetFarmerParams = { code: string };

export type AddReadingParams = {
  farmerId: string;
  npk: { N: number; P: number; K: number };
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

// small helper for conflict fallback (client-generated code)
function makeRandomCode(prefix = 'FS'): string {
  // e.g. "FS-X7K9C"
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
}

/* ===== Health / Ping (optional but handy) ===== */
export async function pingApi() {
  const { data } = await api.get('/api/health');
  return data; // { ok: true } if you implemented it
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
  const { data } = await api.get('/api/auth/me', { headers: authHeaders(token || undefined) });
  return data;
}

/* ===== Farmers ===== */
export async function listFarmers(token?: string | null): Promise<any[]> {
  const { data } = await api.get('/api/farmers', { headers: authHeaders(token || undefined) });
  return Array.isArray(data) ? data : [];
}

export async function getFarmer(params: GetFarmerParams, token?: string | null): Promise<any | null> {
  const { data } = await api.get('/api/farmers', {
    params,
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

/**
 * Create Farmer (conflict-safe)
 * 1) First attempt: send NO `code` (let backend auto-generate)
 * 2) If server says code already exists, retry ONCE with a random code
 *    to avoid name/slug collisions on the server’s auto-generation.
 */
export async function createFarmer(body: any, token?: string | null): Promise<any> {
  // never send incoming code from UI
  const { code: _omit, ...rest } = body || {};

  try {
    const { data } = await api.post('/api/farmers', rest, {
      headers: authHeaders(token || undefined),
    });
    return data;
  } catch (e: any) {
    const msg =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      '';
    const status = e?.response?.status ?? 0;

    const looksLikeCodeConflict =
      status === 409 || /code.*exist/i.test(msg) || /farmer code/i.test(msg);

    if (!looksLikeCodeConflict) {
      // Not a code collision → bubble up original error
      throw e;
    }

    // Retry ONCE with a generated code
    const retryPayload = { ...rest, code: makeRandomCode() };
    const { data: retried } = await api.post('/api/farmers', retryPayload, {
      headers: authHeaders(token || undefined),
    });
    return retried;
  }
}

/**
 * Update Farmer
 * – Never send `code` from client; if backend allows code edits, handle server-side.
 */
export async function updateFarmer(id: string, body: any, token?: string | null): Promise<any> {
  const { code: _omit, ...rest } = body || {};
  const { data } = await api.put(`/api/farmers/${id}`, rest, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function deleteFarmer(id: string, token?: string | null): Promise<any> {
  const { data } = await api.delete(`/api/farmers/${id}`, { headers: authHeaders(token || undefined) });
  return data;
}

/* ===== Admin Price Settings (matches your backend) =====
   Backend routes:
   GET  /api/prices/admin/prices
   PUT  /api/prices/admin/prices
*/
export type AdminPricesDoc = {
  id: string;
  currency: string; // 'PHP'
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

// Get current admin prices
export async function getPriceSettings(token?: string | null): Promise<AdminPricesDoc> {
  const { data } = await api.get('/api/prices/admin/prices', {
    headers: authHeaders(token || undefined),
  });
  return data;
}

// Update (upsert) admin prices
export async function putPriceSettings(
  token: string | undefined | null,
  payload: any // e.g., { currency?: string, items?: { CODE: { pricePerBag?: number, ... } } }
): Promise<AdminPricesDoc> {
  const { data } = await api.put('/api/prices/admin/prices', payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

/* ===== Readings (Farmer Logs) ===== */
export async function listReadingsByFarmer(farmerId: string, token?: string | null): Promise<any[]> {
  const { data } = await api.get(`/api/farmers/${farmerId}/readings`, {
    headers: authHeaders(token || undefined),
  });
  return Array.isArray(data) ? data : [];
}

export async function addReading(body: AddReadingParams, token?: string | null): Promise<any> {
  const { farmerId, ...rest } = body;
  const { data } = await api.post(`/api/farmers/${farmerId}/readings`, rest, {
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
  if (body.npk) payload.npk = body.npk;
  if (body.ph !== undefined) payload.ph = body.ph;
  if (body.ec !== undefined) payload.ec = body.ec;
  if (body.moisture !== undefined) payload.moisture = body.moisture;
  if (body.temp !== undefined) payload.temp = body.temp;
  if (body.source !== undefined) payload.source = body.source;

  const { data } = await api.patch(`/api/farmers/${farmerId}/readings/${readingId}`, payload, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

export async function deleteReading(
  farmerId: string,
  readingId: string,
  token?: string | null
): Promise<any> {
  const { data } = await api.delete(`/api/farmers/${farmerId}/readings/${readingId}`, {
    headers: authHeaders(token || undefined),
  });
  return data;
}

/* ===== Recommendation (uses live prices) =====
   Backend route:
   POST /api/recommend
   Body: { areaHa?: number, targets?: { N?: number; P?: number; K?: number; P2O5?: number; K2O?: number } }
*/
export async function getRecommendation(
  token: string | undefined | null,
  payload: {
    areaHa?: number;
    targets?: { N?: number; P?: number; K?: number; P2O5?: number; K2O?: number };
  }
) {
  const { data } = await api.post('/api/recommend', payload as any, {
    headers: authHeaders(token || undefined),
  });
  return data as {
    ok?: boolean;
    areaHa: number;
    currency: string;
    unit?: 'bag';
    lines: Array<{
      code: string;
      label: string;
      pricePerBag: number;
      bags: number;
      lineCost: number;
    }>;
    totalCost: number;
    leftover?: { N: number; P: number; K: number };
    updatedAt?: string;
  };
}
