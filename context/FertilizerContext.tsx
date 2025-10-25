import React, { createContext, useContext, useEffect, useState } from 'react';

export type FertilizerPrices = {
  urea: number;
  ssp: number;
  mop: number;
  dap: number;
  npk: number;
};
export type FertilizerPlan = { label: string; price: number; items: { [key: string]: number } };
export type FertilizerResult = { n: number; p: number; k: number; ph: number; fertilizerPlans: FertilizerPlan[] };
export type PriceUnit = 'perSack' | 'perKg';

type FertilizerContextType = {
  prices: FertilizerPrices;
  setPrices: (p: FertilizerPrices) => void;
  priceUnit: PriceUnit;
  setPriceUnit: (u: PriceUnit) => void;
  result: FertilizerResult | null;
  setResult: (r: FertilizerResult) => void;
};

const defaultPricesPerSack: FertilizerPrices = { urea: 950, ssp: 850, mop: 900, dap: 1100, npk: 950 };

const convertToKg = (sack: FertilizerPrices): FertilizerPrices => {
  const perKg = (v: number) => parseFloat((v / 50).toFixed(2));
  return { urea: perKg(sack.urea), ssp: perKg(sack.ssp), mop: perKg(sack.mop), dap: perKg(sack.dap), npk: perKg(sack.npk) };
};

const FertilizerContext = createContext<FertilizerContextType | null>(null);

export const FertilizerProvider = ({ children }: { children: React.ReactNode }) => {
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('perSack');
  const [prices, setPrices] = useState<FertilizerPrices>(defaultPricesPerSack);
  const [result, setResult] = useState<FertilizerResult | null>(null);

  useEffect(() => {
    setPrices(priceUnit === 'perKg' ? convertToKg(defaultPricesPerSack) : defaultPricesPerSack);
  }, [priceUnit]);

  return (
    <FertilizerContext.Provider value={{ prices, setPrices, priceUnit, setPriceUnit, result, setResult }}>
      {children}
    </FertilizerContext.Provider>
  );
};

export const useFertilizer = () => {
  const ctx = useContext(FertilizerContext);
  if (!ctx) throw new Error('useFertilizer must be used inside FertilizerProvider');
  return ctx;
};
