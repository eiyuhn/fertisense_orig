// context/FertilizerContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  getPublicPrices,
  getPriceSettings,
  AdminPricesDoc,
} from '../src/services';
import { useAuth } from './AuthContext';

export type AdminPriceItem = {
  label: string;
  pricePerBag: number;
  bagKg?: number;
  npk?: { N?: number; P?: number; K?: number };
  active?: boolean;
};

export type AdminPricesMap = { [code: string]: AdminPriceItem };

export type FertilizerResult = {
  n: number;
  p: number;
  k: number;
  ph: number;
  fertilizerPlans: any[];
};

type FertilizerContextType = {
  prices: AdminPricesMap | null;
  currency: string;
  updatedAt?: string;
  loading: boolean;
  error: string | null;
  refetchPrices: () => Promise<void>;
  result: FertilizerResult | null;
  setResult: (r: FertilizerResult | null) => void;
};

const FertilizerContext = createContext<FertilizerContextType | null>(null);

/**
 * Normalize AdminPricesDoc -> simple map + currency
 * Handles both:
 *   - plain object: { UREA_46_0_0: {...}, ... }
 *   - mongoose Map: doc.items.entries()
 */
function normalize(
  doc?: AdminPricesDoc | null
): { prices: AdminPricesMap; currency: string; updatedAt?: string } {
  const out: AdminPricesMap = {};
  if (!doc) return { prices: out, currency: 'PHP' };

  let entries: [string, any][] = [];

  const maybeItems: any = doc.items;
  if (maybeItems && typeof maybeItems === 'object') {
    if (typeof (maybeItems as any).entries === 'function') {
      // Mongoose Map / Map-like
      entries = Array.from((maybeItems as any).entries());
    } else {
      // Plain JS object
      entries = Object.entries(maybeItems);
    }
  }

  for (const [code, v] of entries) {
    const item = v || {};
    out[String(code)] = {
      label: item.label ?? String(code),
      pricePerBag: Number(item.pricePerBag ?? 0),
      bagKg: Number(item.bagKg ?? 50),
      npk: {
        N: Number(item?.npk?.N ?? 0),
        P: Number(item?.npk?.P ?? 0),
        K: Number(item?.npk?.K ?? 0),
      },
      active: !!item.active,
    };
  }

  return {
    prices: out,
    currency: doc.currency || 'PHP',
    updatedAt: doc.updatedAt,
  };
}

export const FertilizerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, token } = useAuth();

  const [prices, setPrices] = useState<AdminPricesMap | null>(null);
  const [currency, setCurrency] = useState<string>('PHP');
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FertilizerResult | null>(null);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin gets private prices, stakeholder gets public prices
      const doc: AdminPricesDoc =
        user?.role === 'admin'
          ? await getPriceSettings(token)
          : await getPublicPrices();

      const norm = normalize(doc);
      setPrices(norm.prices);
      setCurrency(norm.currency || 'PHP');
      setUpdatedAt(norm.updatedAt);
    } catch (err: any) {
      console.error('Failed to fetch fertilizer prices:', err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load prices';
      setError(errorMsg);
      setPrices({});
      setCurrency('PHP');
      setUpdatedAt(undefined);
    } finally {
      setLoading(false);
    }
  }, [user?.role, token]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return (
    <FertilizerContext.Provider
      value={{
        prices,
        currency,
        updatedAt,
        loading,
        error,
        refetchPrices: fetchPrices,
        result,
        setResult,
      }}
    >
      {children}
    </FertilizerContext.Provider>
  );
};

export const useFertilizer = () => {
  const ctx = useContext(FertilizerContext);
  if (!ctx)
    throw new Error('useFertilizer must be used inside FertilizerProvider');
  return ctx;
};
