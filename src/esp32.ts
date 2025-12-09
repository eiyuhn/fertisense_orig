// src/esp32.ts
import { Platform, PermissionsAndroid, Permission } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import WifiManager from 'react-native-wifi-reborn';

export const ESP_SSID = 'ESP32-NPK';
export const ESP_PASS = 'fertisense';
export const ESP_BASE = 'http://192.168.4.1';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ask for runtime permissions needed to use Wi-Fi APIs on Android.
 * (Location + NEARBY_WIFI_DEVICES on Android 13+)
 */
async function askRuntimePerms() {
  if (Platform.OS !== 'android') return;

  const perms: Permission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  // Android 13+ NEARBY_WIFI_DEVICES (if available)
  if ((PermissionsAndroid as any).PERMISSIONS.NEARBY_WIFI_DEVICES) {
    perms.push(
      (PermissionsAndroid as any).PERMISSIONS.NEARBY_WIFI_DEVICES as Permission
    );
  }

  for (const p of perms) {
    try {
      await PermissionsAndroid.request(p);
    } catch {
      // ignore; we'll fail later if really blocked
    }
  }
}

/**
 * Get current connected SSID (empty string if unknown / error).
 */
async function currentSSID(): Promise<string> {
  try {
    if (!WifiManager || typeof WifiManager.getCurrentWifiSSID !== 'function') {
      throw new Error(
        'Wi-Fi module is missing. Rebuild with EAS and react-native-wifi-reborn.'
      );
    }
    const ssid = await WifiManager.getCurrentWifiSSID();
    return ssid || '';
  } catch (e) {
    console.log('currentSSID error:', e);
    return '';
  }
}

/**
 * Quick connectivity check to ESP32 using GET / (always exists in your firmware).
 */
async function pingESP(timeoutMs = 1500): Promise<boolean> {
  const hasAbort = typeof AbortController !== 'undefined';
  const ctrl = hasAbort ? new AbortController() : null;

  const id = setTimeout(() => {
    if (ctrl) ctrl.abort();
  }, timeoutMs);

  try {
    const res = await fetch(`${ESP_BASE}/`, {
      signal: ctrl ? ctrl.signal : undefined,
    });
    clearTimeout(id);
    console.log('pingESP status:', res.status);
    return res.ok;
  } catch (e) {
    clearTimeout(id);
    console.log('pingESP error:', e);
    return false;
  }
}

/**
 * Ensure the phone is actually connected to the ESP32 AP and that
 * 192.168.4.1 is reachable.
 */
export async function autoConnectToESP32(): Promise<void> {
  console.log('autoConnectToESP32: starting…');

  await askRuntimePerms();

  // 1) Already on ESP SSID?
  let ssid = await currentSSID();
  console.log('Current SSID before connect:', ssid);

  if (ssid === ESP_SSID) {
    const ok = await pingESP();
    if (ok) {
      console.log('Already on ESP32 and reachable.');
      return;
    }
  }

  if (!WifiManager) {
    throw new Error(
      'Wi-Fi module unavailable. Ensure react-native-wifi-reborn is installed and app is built with EAS.'
    );
  }

  const canProtected =
    typeof (WifiManager as any).connectToProtectedSSID === 'function';
  const canOpen = typeof (WifiManager as any).connectToSSID === 'function';

  if (!canProtected && !canOpen) {
    throw new Error(
      'This Android version blocks programmatic Wi-Fi connect. Join "ESP32-NPK" in Settings, then return to the app.'
    );
  }

  // 2) Try to connect programmatically
  try {
    console.log('Connecting to ESP32 SSID…');
    if (canProtected) {
      await (WifiManager as any).connectToProtectedSSID(
        ESP_SSID,
        ESP_PASS,
        false
      );
    } else {
      await (WifiManager as any).connectToSSID(ESP_SSID);
    }
  } catch (err) {
    console.log('connectToSSID error:', err);
    throw new Error(
      'Hindi makakonekta. Please enable Location and manually join "ESP32-NPK" in Wi-Fi settings, then try again.'
    );
  }

  // 3) Wait for the OS to switch networks
  await sleep(1500);

  // 4) Poll SSID a few times – some devices delay reporting
  for (let i = 0; i < 6; i++) {
    ssid = await currentSSID();
    console.log(`SSID poll ${i}:`, ssid);
    if (ssid === ESP_SSID) break;
    await sleep(500);
  }

  // 5) Final connectivity check
  const ok = await pingESP(2000);
  if (!ok) {
    throw new Error(
      'Connected to Wi-Fi but ESP32 is unreachable. Stay on "ESP32-NPK" and try again. (Tip: turn OFF mobile data while reading NPK.)'
    );
  }

  console.log('autoConnectToESP32: success.');
}

/**
 * Read NPK + pH from ESP32 using GET /read (your firmware’s endpoint).
 * Returns the JSON from your firmware:
 * { ok, ts, n, p, k, ph, levels: {n,p,k}, raw: [...] }
 */
export async function readNpkFromESP32(): Promise<any> {
  const state = await NetInfo.fetch();
  console.log('NetInfo state:', state.type, state.details);

  if (state.type !== 'wifi') {
    console.log('Warning: not on Wi-Fi; request may fail.');
  }

  const hasAbort = typeof AbortController !== 'undefined';
  const ctrl = hasAbort ? new AbortController() : null;

  const id = setTimeout(() => {
    if (ctrl) ctrl.abort();
  }, 5000); // 5s timeout

  try {
    console.log('Fetching from ESP32 /read…');

    const res = await fetch(`${ESP_BASE}/read`, {
      signal: ctrl ? ctrl.signal : undefined,
      headers: { Accept: 'application/json' },
    });

    console.log('ESP32 HTTP status:', res.status);

    const text = await res.text();
    console.log('ESP32 raw body:', text);

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON from ESP32');
    }

    if (!res.ok) {
      // HTTP error (still not a true "network error")
      throw new Error(`HTTP ${res.status}: ${json?.error || 'Unknown error'}`);
    }

    if (!json?.ok) {
      // Sensor-level / Modbus error from firmware
      throw new Error(json?.error || 'ESP32 returned ok=false');
    }

    return json;
  } catch (err: any) {
    console.log('readNpkFromESP32 error object:', err);
    throw err;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Convenience helper: connect to ESP32 (if needed) + read NPK in one call.
 */
export async function ensureESPAndReadNPK(): Promise<any> {
  await autoConnectToESP32();
  return await readNpkFromESP32();
}
