// src/utils/esp32.ts
import { Platform, PermissionsAndroid } from "react-native";
import type { Permission } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import WifiManager from "react-native-wifi-reborn";

const ESP_SSID = "ESP32-NPK";        // <-- change if your SSID is different
const ESP_PASSWORD = "";             // empty = open AP
const ESP_URL = "http://192.168.4.1/npk";

// Ask only for DANGEROUS runtime permissions. ACCESS_WIFI_STATE/CHANGE_WIFI_STATE are normal
// permissions and do not go through requestMultiple (doing so caused your TS error).
export async function ensureWifiScanPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const toRequest: Permission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  // Android 13+ Nearby Wi-Fi Devices (if available on this SDK)
  if ((PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES) {
    toRequest.push(
      (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES as Permission
    );
  }

  const res = await PermissionsAndroid.requestMultiple(toRequest);
  return Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
}

// Auto-scan then connect to the ESP32 AP
export async function autoConnectToESP32(ssid: string = ESP_SSID): Promise<void> {
  const ok = await ensureWifiScanPermissions();
  if (!ok) throw new Error("Location/Wi-Fi permissions not granted.");

  // Turn Wi-Fi on if it is off (Android only)
  const enabled = await WifiManager.isEnabled();
  if (!enabled) {
    await WifiManager.setEnabled(true);
  }

  // Scan (use reScanAndLoadWifiList on Android; loadWifiList on iOS)
  let list: Array<any> = [];
  if (Platform.OS === "android") {
    list = await WifiManager.reScanAndLoadWifiList();
  } else {
    list = await WifiManager.loadWifiList();
  }

  const found = list.find((w: any) => (w.SSID || "").trim() === ssid);
  if (!found) {
    throw new Error(`Wi-Fi "${ssid}" not found. Turn ON Location and try again.`);
  }

  // Connect: provide the 4th argument (isHidden) to satisfy the TS signature
  if (ESP_PASSWORD) {
    await WifiManager.connectToProtectedSSID(ssid, ESP_PASSWORD, false, false);
  } else {
    await WifiManager.connectToSSID(ssid);
  }

  // Wait until we actually have a Wi-Fi IP on that SSID
  let connected = false;
  for (let i = 0; i < 14; i++) { // ~7s max
    const s = await NetInfo.fetch();
    if (
      s.type === "wifi" &&
      s.isConnected &&
      ((s.details as any)?.ssid?.replace(/"/g, "") === ssid ||
        (s.details as any)?.bssid) // some Androids omit ssid string
    ) {
      connected = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!connected) throw new Error("Connected to Wi-Fi but no IP yet. Try again.");
}

// Force routing over Wi-Fi (no-internet AP) then read /npk
export async function readNpkFromESP32(url: string = ESP_URL): Promise<any> {
  // Some Android versions have forceWifiUsageWithOptions; fall back to forceWifiUsage
  const forceWithOptions = (WifiManager as any).forceWifiUsageWithOptions;
  const forceBasic = (WifiManager as any).forceWifiUsage;

  try {
    if (Platform.OS === "android") {
      if (typeof forceWithOptions === "function") {
        await forceWithOptions(true, { noInternet: true });
      } else if (typeof forceBasic === "function") {
        await forceBasic(true);
      }
    }

    // Short timeout so we surface errors quickly
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`ESP32 responded ${res.status}`);
    }

    // Handle either JSON or text payloads
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      return txt; // plain text from ESP32
    }
  } finally {
    if (Platform.OS === "android") {
      try {
        if (typeof forceWithOptions === "function") {
          await forceWithOptions(false);
        } else if (typeof forceBasic === "function") {
          await forceBasic(false);
        }
      } catch {}
    }
  }
}
