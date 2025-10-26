// src/esp32.ts
import { Platform, PermissionsAndroid, Permission } from 'react-native'; // <-- Import Permission type
import NetInfo from '@react-native-community/netinfo';
import WifiManager from 'react-native-wifi-reborn';

export const ESP_SSID = 'ESP32-NPK';
export const ESP_PASS = 'fertisense';
export const ESP_BASE = 'http://192.168.4.1'; // <-- No typos

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function askRuntimePerms() {
  if (Platform.OS !== 'android') return;

  // Android 10+ needs location; Android 13+ also wants NEARBY_WIFI_DEVICES
  // --- THIS IS THE FIX ---
  // Use the 'Permission' type instead of 'string'
  const perms: Permission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];
  // --- END OF FIX ---

  // Some devices label this differently; ignore if not found
  if ((PermissionsAndroid as any).PERMISSIONS.NEARBY_WIFI_DEVICES) {
    // --- THIS IS THE FIX ---
    // Cast the string to Permission
    perms.push(
      (PermissionsAndroid as any).PERMISSIONS.NEARBY_WIFI_DEVICES as Permission
    );
    // --- END OF FIX ---
  }

  for (const p of perms) {
    try {
      await PermissionsAndroid.request(p);
      // If denied, we still continue; WifiManager may throw and we show a helpful error then.
    } catch {}
  }
}

async function currentSSID(): Promise<string> {
  try {
    if (!WifiManager || typeof WifiManager.getCurrentWifiSSID !== 'function') {
      throw new Error(
        'Wi-Fi module is missing in this build. Rebuild with EAS and the react-native-wifi-reborn plugin.'
      );
    }
    const ssid = await WifiManager.getCurrentWifiSSID();
    return ssid || '';
  } catch {
    return '';
  }
}

async function pingRoot(timeoutMs = 1500) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${ESP_BASE}/`, { signal: ctrl.signal });
    clearTimeout(id);
    return r.ok;
  } catch {
    clearTimeout(id);
    return false;
  }
}

export async function autoConnectToESP32(): Promise<void> {
  await askRuntimePerms();

  // If already on ESP SSID, just verify reachability
  let ssid = await currentSSID();
  if (ssid === ESP_SSID) {
    const ok = await pingRoot();
    if (ok) return;
  }

  if (!WifiManager) {
    throw new Error(
      'Wi-Fi module unavailable. Ensure react-native-wifi-reborn is installed and the app is built with EAS.'
    );
  }

  // Try programmatic connect where supported
  const canProtected =
    typeof (WifiManager as any).connectToProtectedSSID === 'function';
  const canOpen = typeof (WifiManager as any).connectToSSID === 'function';

  if (!canProtected && !canOpen) {
    throw new Error(
      'This Android version blocks programmatic Wi-Fi connect. Join "ESP32-NPK" in Settings, then return here.'
    );
  }

  try {
    if (canProtected) {
      await (WifiManager as any).connectToProtectedSSID(ESP_SSID, ESP_PASS, false);
    } else {
      await (WifiManager as any).connectToSSID(ESP_SSID);
    }
  } catch (err: any) {
    // Common failure: location OFF, or OS denies connect
    throw new Error(
      'Hindi makakonekta (cannot connect). Please enable Location and manually join "ESP32-NPK" in Wi-Fi settings, then try again.'
    );
  }

  // Wait for the OS to actually switch networks
  await sleep(1500);

  // Double-check: some devices report SSID as <unknown ssid>
  for (let i = 0; i < 6; i++) {
    ssid = await currentSSID();
    if (ssid === ESP_SSID) break;
    await sleep(500);
  }

  // Give captive-portal/handoff a moment
  await sleep(500);

  // Final sanity: is the AP reachable?
  const ok = await pingRoot(2000);
  if (!ok) {
    throw new Error(
      'Connected to Wi-Fi but ESP32 is unreachable. Stay on "ESP32-NPK" and try again.'
    );
  }
}

export async function readNpkFromESP32(): Promise<any> {
  // Optional: check network type; if on cellular, this will fail anyway
  const state = await NetInfo.fetch();
  if (state.type !== 'wifi') {
    // Not fatal—maybe NetInfo is slow—but warn early
  }

  // This timeout MUST be longer than the sensor's 1000ms timeout
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 5000); // 5-second timeout
  try {
    // --- THIS IS THE FIX ---
    // Change /npk to /read to force a NEW sensor reading
    const res = await fetch(`${ESP_BASE}/read`, {
    // --- END OF FIX ---
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        // This will now throw the "HTTP 504" error
        throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json?.ok) {
      // This will show "Timeout - no response from sensor" in your alert
      throw new Error(json?.error || 'ESP32 returned an error');
    }
    return json; // { ok, n, p, k, ph, ... }
  } finally {
    clearTimeout(id);
  }
}

