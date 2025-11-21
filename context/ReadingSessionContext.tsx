import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ReadingResult = {
  n: number;
  p: number;
  k: number;
  ph?: number;
  ts: number;
  farmerId?: string;
  farmerName?: string;
} | null;

type SetFromParamsInput = {
  n?: string | number;
  p?: string | number;
  k?: string | number;
  ph?: string | number;
  farmerId?: string;
  farmerName?: string;
  ts?: number;
};

type Ctx = {
  result: ReadingResult;
  setResult: (r: ReadingResult) => Promise<void>;
  setFromParams: (params: SetFromParamsInput) => Promise<void>;
  clear: () => Promise<void>;
  loading: boolean;
};

const ReadingSessionCtx = createContext<Ctx>({
  result: null,
  setResult: async () => {},
  setFromParams: async () => {},
  clear: async () => {},
  loading: true,
});

const KEY = 'readingSession:last';

const toNum = (x: any): number | undefined => {
  if (x === '' || x == null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
};

export const ReadingSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [result, setRes] = useState<ReadingResult>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed: any = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const n = toNum(parsed.n);
            const p = toNum(parsed.p);
            const k = toNum(parsed.k);
            const ph = toNum(parsed.ph);
            const ts =
              typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)
                ? parsed.ts
                : Date.now();

            setRes({
              n: n ?? 0,
              p: p ?? 0,
              k: k ?? 0,
              ph: ph ?? undefined,
              ts,
              farmerId:
                typeof parsed.farmerId === 'string' ? parsed.farmerId : undefined,
              farmerName:
                typeof parsed.farmerName === 'string'
                  ? parsed.farmerName
                  : undefined,
            });
          } else {
            setRes(null);
          }
        }
      } catch (e) {
        console.warn('[ReadingSession] failed to load last reading:', e);
        setRes(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setResult = useCallback(async (r: ReadingResult) => {
    setRes(r);
    try {
      if (r) {
        await AsyncStorage.setItem(KEY, JSON.stringify(r));
      } else {
        await AsyncStorage.removeItem(KEY);
      }
    } catch (e) {
      console.warn('[ReadingSession] failed to persist reading:', e);
    }
  }, []);

  const setFromParams = useCallback(
    async (params: SetFromParamsInput) => {
      const n = toNum(params.n);
      const p = toNum(params.p);
      const k = toNum(params.k);
      const ph = toNum(params.ph);

      const rec: ReadingResult = {
        n: n ?? 0,
        p: p ?? 0,
        k: k ?? 0,
        ph: ph ?? undefined,
        ts: params.ts ?? Date.now(),
        farmerId: params.farmerId,
        farmerName: params.farmerName,
      };

      await setResult(rec);
    },
    [setResult]
  );

  const clear = useCallback(async () => {
    setRes(null);
    try {
      await AsyncStorage.removeItem(KEY);
    } catch (e) {
      console.warn('[ReadingSession] failed to clear storage:', e);
    }
  }, []);

  return (
    <ReadingSessionCtx.Provider
      value={{ result, setResult, setFromParams, clear, loading }}
    >
      {children}
    </ReadingSessionCtx.Provider>
  );
};

export const useReadingSession = () => useContext(ReadingSessionCtx);
