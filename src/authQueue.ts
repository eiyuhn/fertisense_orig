// =============================================================
// File: app/src/authQueue.ts
// Purpose: AsyncStorage queues for offline registration & updates
// =============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PENDING_REGS = 'auth:queue:registrations';
const KEY_PENDING_UPS  = 'auth:queue:profileUpdates';

export type PendingRegistration = {
  payload: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'stakeholder' | 'guest';
    address?: string;
    farmLocation?: string;
    mobile?: string;
  };
  createdAt: string; // ISO
};

export type PendingProfileUpdate = {
  fields: Record<string, any>;
  updatedAt: string; // ISO
};

async function parseJSON<T>(raw: string | null, fallback: T): Promise<T> {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// Registrations
export async function loadPendingRegistrations(): Promise<PendingRegistration[]> {
  const raw = await AsyncStorage.getItem(KEY_PENDING_REGS);
  return parseJSON<PendingRegistration[]>(raw, []);
}
export async function savePendingRegistrations(items: PendingRegistration[]): Promise<void> {
  await AsyncStorage.setItem(KEY_PENDING_REGS, JSON.stringify(items));
}

// Profile updates
export async function loadPendingProfileUpdates(): Promise<PendingProfileUpdate[]> {
  const raw = await AsyncStorage.getItem(KEY_PENDING_UPS);
  return parseJSON<PendingProfileUpdate[]>(raw, []);
}
export async function savePendingProfileUpdates(items: PendingProfileUpdate[]): Promise<void> {
  await AsyncStorage.setItem(KEY_PENDING_UPS, JSON.stringify(items));
}

// Utility
export async function clearAllAuthQueues(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_PENDING_REGS, KEY_PENDING_UPS]);
}
