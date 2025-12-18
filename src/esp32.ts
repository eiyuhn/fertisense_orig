// src/esp32.ts
import NetInfo from '@react-native-community/netinfo';

export const ESP_SSID = 'Fertisense_AP';
export const ESP_BASE_URL = 'http://192.168.4.1';

/**
 * Internal: fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * ✅ The ONLY reliable check:
 * We must confirm ESP32 is reachable at 192.168.4.1 by hitting its endpoints.
 */
export async function ensureEsp32Reachable(opts?: { timeoutMs?: number }): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 2500;

  // Quick sanity: if device has no network route at all, fail early
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    throw new Error('No network connection detected. Please enable Wi-Fi.');
  }

  const tryPath = async (path: string) => {
    const res = await fetchWithTimeout(`${ESP_BASE_URL}${path}`, timeoutMs);
    if (!res.ok) throw new Error(`${path} status ${res.status}`);
    return true;
  };

  // ✅ Try common endpoints in order
  try {
    await tryPath('/npk');
    return;
  } catch (_) {
    // ignore
  }

  try {
    await tryPath('/read');
    return;
  } catch (_) {
    // ignore
  }

  try {
    await tryPath('/all');
    return;
  } catch (_) {
    // ignore
  }

  throw new Error(
    `ESP32 not reachable at ${ESP_BASE_URL}. Make sure you are connected to "${ESP_SSID}" Wi-Fi.`
  );
}

/**
 * ✅ Connect button uses this.
 * This MUST throw if user is not on ESP32 AP.
 */
export async function autoConnectToESP32(): Promise<void> {
  await ensureEsp32Reachable({ timeoutMs: 2500 });
}

/**
 * Reads NPK (and other sensor values) from ESP32.
 */
export async function readNpkFromESP32(): Promise<any> {
  await ensureEsp32Reachable({ timeoutMs: 2500 });
  const res = await fetchWithTimeout(`${ESP_BASE_URL}/npk`, 3500);
  if (!res.ok) throw new Error(`ESP32 /npk failed: ${res.status}`);
  return await res.json();
}

/**
 * Your sensor-reading imports readNowFromESP32.
 * Keep it as the “main read” function.
 */
export async function readNowFromESP32(): Promise<any> {
  // prefer /read if your firmware returns full object there
  // fallback to /npk if /read doesn’t exist
  await ensureEsp32Reachable({ timeoutMs: 2500 });

  try {
    const res = await fetchWithTimeout(`${ESP_BASE_URL}/read`, 3500);
    if (!res.ok) throw new Error(`/read failed: ${res.status}`);
    return await res.json();
  } catch {
    return await readNpkFromESP32();
  }
}
