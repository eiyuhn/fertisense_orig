import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { isOnline } from './utils/net';
import { syncAllOfflineUsers } from './sync';

/**
 * Polls connectivity when the app is active.
 * Each time we detect we are online, it syncs offline-only users to server.
 */
export default function AutoSyncOnOnline() {
  const onlineRef = useRef<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAndSync = async () => {
      const online = await isOnline();
      if (!mounted) return;

      const was = onlineRef.current;
      onlineRef.current = online;

      if (online && (was === false || was === null)) {
        try {
          await syncAllOfflineUsers();
          console.log('✅ Offline users synced successfully');
        } catch (err) {
          console.warn('❌ Sync failed, will retry later');
        }
      }
    };

    const startPolling = () => {
      void checkAndSync();
      timerRef.current = setInterval(checkAndSync, 15000);
    };

    const stopPolling = () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') startPolling();
      else stopPolling();
    };

    onAppStateChange(AppState.currentState);
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      stopPolling();
      sub.remove();
    };
  }, []);

  return null;
}
