// app/src/sync.ts
import NetInfo from '@react-native-community/netinfo';
import { registerApi, loginApi } from './services';
import {
  getLocalUser,
  getOfflineOnlyUsers,
  upsertLocalUserMirror,
} from './localUsers';

/** Promote one offline-only account to server and mirror back locally. */
export async function trySyncOfflineAccount(email: string, password: string) {
  const local = await getLocalUser(email);
  if (!local) throw new Error('No offline user to sync.');
  if (local.password !== password) throw new Error('Offline password mismatch.');
  if (!local.offlineOnly) {
    // already synced before
    return await loginApi({ email, password });
  }

  // 1) create on server
  try {
    await registerApi({
      name: local.name,
      email: local.email,
      password: local.password,
      role: local.role,
      address: local.address,
      farmLocation: local.farmLocation,
      mobile: local.mobile,
    });
  } catch (e: any) {
    if (e?.response?.status === 409) {
      throw new Error('This email already exists on the server with a different password.');
    }
    throw e;
  }

  // 2) log in to get canonical server user
  const apiUser = await loginApi({ email, password });

  // 3) mirror locally as synced
  await upsertLocalUserMirror(
    {
      name: apiUser.name ?? local.name,
      email: apiUser.email as string,
      role: apiUser.role as 'stakeholder' | 'admin',
      address: apiUser.address ?? local.address,
      farmLocation: apiUser.farmLocation ?? local.farmLocation,
      mobile: apiUser.mobile ?? local.mobile,
      profileImage: null,
      offlineOnly: false,
    },
    password,
    false
  );

  return apiUser;
}

/** Sync every offline-only user to server. */
export async function syncAllOfflineUsers(): Promise<number> {
  const offlineUsers = await getOfflineOnlyUsers();
  let success = 0;
  for (const u of offlineUsers) {
    try {
      await trySyncOfflineAccount(u.email, u.password);
      success++;
    } catch {
      // ignore errors, continue with next
    }
  }
  return success;
}

/** ✅ Public helper used by app/_layout.tsx */
export async function syncOnce(): Promise<void> {
  // Only attempt when online
  const state = await NetInfo.fetch();
  const online = !!state.isConnected && !!state.isInternetReachable;
  if (!online) return;

  try {
    await syncAllOfflineUsers();
  } catch {
    // swallow to avoid crashing boot/foreground
  }
}
