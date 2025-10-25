// src/api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const RAW_BASE =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string) ||
  "https://fertisense-backend.onrender.com";

export const BASE_URL = RAW_BASE.replace(/\/+$/, "");

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

export function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SECURE_KEY = "authToken";

export async function setToken(token?: string) {
  if (token) {
    await SecureStore.setItemAsync(SECURE_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    await SecureStore.deleteItemAsync(SECURE_KEY);
    delete (api.defaults.headers.common as any).Authorization;
  }
}

export async function loadToken() {
  const saved = await SecureStore.getItemAsync(SECURE_KEY);
  if (saved) api.defaults.headers.common.Authorization = `Bearer ${saved}`;
}
loadToken().catch(() => {});

// ---- HARD GUARD: never send `code` to /api/farmers writes ----
api.interceptors.request.use((config) => {
  try {
    const url = (config.url || "").toLowerCase();
    const method = (config.method || "get").toLowerCase();

    const isFarmerWrite =
      url.startsWith("/api/farmers") && ["post", "put", "patch"].includes(method);

    if (isFarmerWrite && config.data && typeof config.data === "object") {
      // shallow clone and strip code
      const d = { ...(config.data as any) };
      if ("code" in d) delete d.code;
      config.data = d;
      // helpful for debugging:
      // console.log("[REQ scrubbed]", method, url, d);
    }
  } catch {}
  return config;
});

// @ts-ignore
if (__DEV__) console.log("[API] BASE_URL =", BASE_URL);
