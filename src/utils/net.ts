// src/utils/net.ts
// Safe network helpers that work even if expo-network isn't built yet.

type ExpoNetwork = {
  getNetworkStateAsync?: () => Promise<{
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
    type?: string | null;
  }>;
  // In newer SDKs there is addNetworkStateListener; we’ll feature-detect it.
  addNetworkStateListener?: (cb: (s: any) => void) => { remove: () => void };
};

let Network: ExpoNetwork | null = null;
function ensureNetwork(): boolean {
  if (Network) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Network = require('expo-network');
    return true;
  } catch {
    console.warn('[net] expo-network not available — using fetch() fallback');
    return false;
  }
}

// Basic online check that works everywhere
export async function isOnline(): Promise<boolean> {
  try {
    if (ensureNetwork() && Network?.getNetworkStateAsync) {
      const s = await Network.getNetworkStateAsync();
      return !!(s?.isConnected && s?.isInternetReachable);
    }
  } catch {}
  // Fallback: try a quick HEAD request
  try {
    const r = await fetch('https://www.google.com', { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

// Subscribe to online status changes. Falls back to polling every 5s.
export function subscribeOnline(handler: (online: boolean) => void): () => void {
  // Fire immediately with current guess
  isOnline().then(handler).catch(() => handler(false));

  if (ensureNetwork() && Network?.addNetworkStateListener) {
    const sub = Network.addNetworkStateListener(async () => {
      handler(await isOnline());
    });
    return () => sub?.remove?.();
  }

  // Fallback: poll
  const id = setInterval(async () => {
    handler(await isOnline());
  }, 5000);
  return () => clearInterval(id);
}
