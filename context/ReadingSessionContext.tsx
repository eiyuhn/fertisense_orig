// context/ReadingSessionContext.tsx
import React, { createContext, useContext, useState } from 'react';

type ReadingResult = { n: number; p: number; k: number; ph?: number; ts: number } | null;

const ReadingSessionCtx = createContext<{
  result: ReadingResult;
  setResult: (r: ReadingResult) => void;
}>({
  result: null,
  setResult: () => {},
});

export const ReadingSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [result, setResult] = useState<ReadingResult>(null);
  return (
    <ReadingSessionCtx.Provider value={{ result, setResult }}>
      {children}
    </ReadingSessionCtx.Provider>
  );
};

export const useReadingSession = () => useContext(ReadingSessionCtx);
