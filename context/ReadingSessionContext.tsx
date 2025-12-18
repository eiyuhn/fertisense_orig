// context/ReadingSessionContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RiceVariety = 'hybrid' | 'inbred';
export type SoilClass = 'light' | 'medHeavy';
export type Season = 'wet' | 'dry';

type FarmOptions = {
  variety?: RiceVariety;
  soilClass?: SoilClass;
  season?: Season;
};

type ReadingResult = {
  n: number;
  p: number;
  k: number;
  ph?: number;
  ts: number;
  farmerId?: string;
  farmerName?: string;

  variety?: RiceVariety;
  soilClass?: SoilClass;
  season?: Season;
} | null;

type SetFromParamsInput = {
  n?: string | number;
  p?: string | number;
  k?: string | number;
  ph?: string | number;
  farmerId?: string;
  farmerName?: string;
  ts?: number;

  variety?: RiceVariety;
  soilClass?: SoilClass;
  season?: Season;
};

type SetFarmOptionsInput = FarmOptions & {
  farmerId?: string;
  farmerName?: string;
};

type Ctx = {
  result: ReadingResult;
  setResult: (r: ReadingResult) => Promise<void>;
  setFromParams: (params: SetFromParamsInput) => Promise<void>;
  setFarmOptions: (opts: SetFarmOptionsInput) => Promise<void>;
  clear: () => Promise<void>;
  loading: boolean;
};

const ReadingSessionCtx = createContext<Ctx>({
  result: null,
  setResult: async () => {},
  setFromParams: async () => {},
  setFarmOptions: async () => {},
  clear: async () => {},
  loading: true,
});

const KEY = 'readingSession:last';

const toNum = (x: any): number | undefined => {
  if (x === '' || x == null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeVariety = (v: any): RiceVariety | undefined => {
  const s = String(v || '').toLowerCase();
  if (s === 'hybrid') return 'hybrid';
  if (s === 'inbred') return 'inbred';
  return undefined;
};

const normalizeSoil = (v: any): SoilClass | undefined => {
  const s = String(v || '').toLowerCase();
  if (s === 'light') return 'light';
  if (s === 'medheavy' || s === 'med_heavy' || s === 'med-heavy') return 'medHeavy';
  return undefined;
};

const normalizeSeason = (v: any): Season | undefined => {
  const s = String(v || '').toLowerCase();
  if (s === 'wet') return 'wet';
  if (s === 'dry') return 'dry';
  return undefined;
};

export const ReadingSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [result, setRes] = useState<ReadingResult>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback(async (r: ReadingResult) => {
    try {
      if (r) await AsyncStorage.setItem(KEY, JSON.stringify(r));
      else await AsyncStorage.removeItem(KEY);
    } catch (e) {
      console.warn('[ReadingSession] persist error:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) {
          setRes(null);
          return;
        }

        const parsed: any = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          setRes(null);
          return;
        }

        const n = toNum(parsed.n);
        const p = toNum(parsed.p);
        const k = toNum(parsed.k);
        const ph = toNum(parsed.ph);

        const ts =
          typeof parsed.ts === 'number' && Number.isFinite(parsed.ts) ? parsed.ts : Date.now();

        setRes({
          n: n ?? 0,
          p: p ?? 0,
          k: k ?? 0,
          ph: ph ?? undefined,
          ts,
          farmerId: typeof parsed.farmerId === 'string' ? parsed.farmerId : undefined,
          farmerName: typeof parsed.farmerName === 'string' ? parsed.farmerName : undefined,
          variety: normalizeVariety(parsed.variety),
          soilClass: normalizeSoil(parsed.soilClass),
          season: normalizeSeason(parsed.season),
        });
      } catch (e) {
        console.warn('[ReadingSession] load error:', e);
        setRes(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setResult = useCallback(
    async (r: ReadingResult) => {
      setRes(r);
      await persist(r);
    },
    [persist]
  );

  /**
   * ✅ KEY FIX:
   * When a NEW reading is written (n/p/k or ts provided), we DO NOT carry over old farmerName/farmerId
   * unless explicitly provided. This stops "admin name showing" permanently.
   */
  const setFromParams = useCallback(
    async (params: SetFromParamsInput) => {
      setRes((prev) => {
        const prevObj = prev && typeof prev === 'object' ? prev : null;

        const n = toNum(params.n);
        const p = toNum(params.p);
        const k = toNum(params.k);
        const ph = toNum(params.ph);

        const incomingHasNewReading =
          n !== undefined || p !== undefined || k !== undefined || ph !== undefined || params.ts !== undefined;

        const merged: ReadingResult = {
          n: n ?? (prevObj?.n ?? 0),
          p: p ?? (prevObj?.p ?? 0),
          k: k ?? (prevObj?.k ?? 0),
          ph: ph ?? (prevObj?.ph ?? undefined),
          ts: params.ts ?? prevObj?.ts ?? Date.now(),

          // ✅ if new reading and no farmerId/name passed => clear stale
          farmerId:
            params.farmerId !== undefined
              ? params.farmerId
              : incomingHasNewReading
              ? undefined
              : prevObj?.farmerId,

          farmerName:
            params.farmerName !== undefined
              ? params.farmerName
              : incomingHasNewReading
              ? undefined
              : prevObj?.farmerName,

          variety: params.variety ?? prevObj?.variety,
          soilClass: params.soilClass ?? prevObj?.soilClass,
          season: params.season ?? prevObj?.season,
        };

        // persist async (safe outside UI)
        persist(merged);
        return merged;
      });
    },
    [persist]
  );

  /**
   * ✅ Farm options update should NOT introduce stale farmerName either.
   * If opts.farmerName not provided, keep prev (because this is NOT a new reading).
   */
  const setFarmOptions = useCallback(
    async (opts: SetFarmOptionsInput) => {
      setRes((prev) => {
        const prevObj = prev && typeof prev === 'object' ? prev : null;

        const merged: ReadingResult = {
          n: prevObj?.n ?? 0,
          p: prevObj?.p ?? 0,
          k: prevObj?.k ?? 0,
          ph: prevObj?.ph ?? undefined,
          ts: prevObj?.ts ?? Date.now(),

          farmerId: opts.farmerId ?? prevObj?.farmerId,
          farmerName: opts.farmerName ?? prevObj?.farmerName,

          variety: opts.variety ?? prevObj?.variety,
          soilClass: opts.soilClass ?? prevObj?.soilClass,
          season: opts.season ?? prevObj?.season,
        };

        persist(merged);
        return merged;
      });
    },
    [persist]
  );

  const clear = useCallback(async () => {
    setRes(null);
    await persist(null);
  }, [persist]);

  return (
    <ReadingSessionCtx.Provider
      value={{ result, setResult, setFromParams, setFarmOptions, clear, loading }}
    >
      {children}
    </ReadingSessionCtx.Provider>
  );
};

export const useReadingSession = () => useContext(ReadingSessionCtx);
