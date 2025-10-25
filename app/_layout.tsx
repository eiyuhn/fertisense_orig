// app/_layout.tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { syncOnce } from '../src/sync';

import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { FertilizerProvider } from '../context/FertilizerContext';
import { ReadingSessionProvider } from '../context/ReadingSessionContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let appStateSub: { remove: () => void } | undefined;

    (async () => {
      if (fontsLoaded) await SplashScreen.hideAsync();

      try { await syncOnce(); } catch {}

      timer = setInterval(async () => {
        try { await syncOnce(); } catch {}
      }, 15000);

      appStateSub = AppState.addEventListener('change', async (state) => {
        if (state === 'active') {
          try { await syncOnce(); } catch {}
        }
      });
    })();

    return () => {
      if (timer) clearInterval(timer);
      appStateSub?.remove?.();
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DataProvider>
          <FertilizerProvider>
            {/* ✅ Make the reading session available to all screens */}
            <ReadingSessionProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </ReadingSessionProvider>
          </FertilizerProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
