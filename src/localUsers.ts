// src/localUsers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const ours = keys.filter(k => k.startsWith(PREFIX));
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
  return all.filter(u => u.offlineOnly === true);
}
