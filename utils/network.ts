// utils/network.ts
import { BASE_URL } from '../src/api';

const TIMEOUT = 3000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]) as Promise<T>;
}

export async function isOnline(): Promise<boolean> {
  try {
    const r1 = await withTimeout(fetch(`${BASE_URL}/health`, { method: 'GET', cache: 'no-store' }));
    if ((r1 as Response).ok) return true;
  } catch {}
  try {
    const r2 = await withTimeout(fetch('https://www.google.com/generate_204', { method: 'GET', cache: 'no-store' }));
    return (r2 as Response).ok;
  } catch {}
  return false;
}
