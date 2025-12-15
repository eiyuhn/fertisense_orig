// src/localUsers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Reading } from '../context/DataContext';

export type LocalUser = {
  username: string;
  name: string;
  password: string;
  role: 'stakeholder' | 'admin';
  address?: string;
  farmLocation?: string;
  mobile?: string;
  profileImage?: string | null;
  offlineOnly?: boolean;
};

const PREFIX = 'localUser:';

export async function getLocalUser(username: string): Promise<LocalUser | null> {
  const raw = await AsyncStorage.getItem(`${PREFIX}${username}`);
  return raw ? (JSON.parse(raw) as LocalUser) : null;
}

export async function setLocalUser(user: LocalUser): Promise<void> {
  await AsyncStorage.setItem(`${PREFIX}${user.username}`, JSON.stringify(user));
}

export async function upsertLocalUserMirror(
  user: Omit<LocalUser, 'password'>,
  password: string,
  offlineOnly: boolean
) {
  const newUser: LocalUser = { ...user, password, offlineOnly };
  await AsyncStorage.setItem(`${PREFIX}${user.username}`, JSON.stringify(newUser));
}

export async function getAllLocalUsers(): Promise<LocalUser[]> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith(PREFIX));
  if (ours.length === 0) return [];
  const entries = await AsyncStorage.multiGet(ours);

  const users: LocalUser[] = [];
  for (const [, val] of entries) {
    if (!val) continue;
    try {
      users.push(JSON.parse(val) as LocalUser);
    } catch {}
  }
  return users;
}

export async function getOfflineOnlyUsers(): Promise<LocalUser[]> {
  const all = await getAllLocalUsers();
  return all.filter((u) => u.offlineOnly === true);
}

/* ===========================
   ✅ Guest Offline History
   =========================== */
const GUEST_READINGS_KEY = 'fertisense_guest_readings_v1';

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function listGuestReadings(): Promise<Reading[]> {
  const raw = await AsyncStorage.getItem(GUEST_READINGS_KEY);
  const items = safeJson<Reading[]>(raw, []);
  return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function addGuestReading(reading: Reading): Promise<void> {
  const current = await listGuestReadings();
  const updated = [reading, ...current].slice(0, 200);
  await AsyncStorage.setItem(GUEST_READINGS_KEY, JSON.stringify(updated));
}

export async function deleteGuestReadingByIndex(index: number): Promise<void> {
  const current = await listGuestReadings();
  const updated = current.filter((_, i) => i !== index);
  await AsyncStorage.setItem(GUEST_READINGS_KEY, JSON.stringify(updated));
}

export async function clearGuestReadings(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_READINGS_KEY);
}
