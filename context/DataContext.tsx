// context/DataContext.tsx
import React, { createContext, ReactNode, useContext, useState } from 'react';

/* ---------- Types ---------- */
export type FertilizerPlan = {
  stage: string;
  type: string;
  amount: string;
  price: number;
};

export type SensorData = {
  timestamp: string;
  n: number;
  p: number;
  k: number;
  ph?: number;

  // 👇 added so admin recommendation & logs can use them
  farmerId?: string;
  farmerName?: string;

  // optional raw spot readings if you store them
  readings?: any[];
};

export type Reading = {
  name: string;
  code: string;
  date: string;
  n: number;
  p: number;
  k: number;
  ph?: number;
  recommendation?: string[];        // [filipino, english]
  sensorData?: SensorData[];
  fertilizerPlans?: FertilizerPlan[];
  backendFarmerId?: string;
  FarmerName?: string;
  readings?: any[];
};

export type Farmer = {
  id: string;                       // local id (uuid or server fallback)
  backendId?: string;               // Mongo _id
  name: string;
  code: string;
  location: string;
  farmSize: string;
  riceType: string;
  cropStyle: string;
};

type DataContextType = {
  readings: Reading[];
  setReadings: React.Dispatch<React.SetStateAction<Reading[]>>;
  addReading: (reading: Reading) => void;

  farmers: Farmer[];
  setFarmers: React.Dispatch<React.SetStateAction<Farmer[]>>;
  addFarmer: (farmer: Farmer) => void;

  latestSensorData: SensorData | null;
  setLatestSensorData: React.Dispatch<React.SetStateAction<SensorData | null>>;
};

/* ---------- Context ---------- */
const DataContext = createContext<DataContextType | undefined>(undefined);

/* ---------- Provider ---------- */
export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [latestSensorData, setLatestSensorData] = useState<SensorData | null>(null);

  const addReading = (reading: Reading) =>
    setReadings(prev => [...prev, reading]);

  const addFarmer = (farmer: Farmer) => {
    setFarmers(prev => [farmer, ...prev]); // newest first
  };

  return (
    <DataContext.Provider
      value={{
        readings,
        setReadings,
        addReading,
        farmers,
        setFarmers,
        addFarmer,
        latestSensorData,
        setLatestSensorData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

/* ---------- Hook ---------- */
export const useData = (): DataContextType => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
};
