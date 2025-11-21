// context/SelectedFarmerContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SelFarmer = { _id: string; name?: string | null } | null;
type Ctx = {
  selectedFarmer: SelFarmer;
  setSelectedFarmer: (f: SelFarmer) => Promise<void>;
  clearSelectedFarmer: () => Promise<void>;
  loading: boolean;
};

const SelectedFarmerContext = createContext<Ctx>({
  selectedFarmer: null,
  setSelectedFarmer: async () => {},
  clearSelectedFarmer: async () => {},
  loading: true,
});

const KEY = 'selectedFarmer';

export function SelectedFarmerProvider({ children }: { children: React.ReactNode }) {
  const [selectedFarmer, setSel] = useState<SelFarmer>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setSel(JSON.parse(raw));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setSelectedFarmer = useCallback(async (f: SelFarmer) => {
    setSel(f);
    if (f) await AsyncStorage.setItem(KEY, JSON.stringify(f));
    else await AsyncStorage.removeItem(KEY);
  }, []);

  const clearSelectedFarmer = useCallback(async () => {
    setSel(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  return (
    <SelectedFarmerContext.Provider value={{ selectedFarmer, setSelectedFarmer, clearSelectedFarmer, loading }}>
      {children}
    </SelectedFarmerContext.Provider>
  );
}

export const useSelectedFarmer = () => useContext(SelectedFarmerContext);
