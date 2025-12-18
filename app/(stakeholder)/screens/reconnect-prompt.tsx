// app/(stakeholder)/screens/reconnect-prompt.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useReadingSession } from '../../../context/ReadingSessionContext';
import { ESP_SSID } from '../../../src/esp32';
type Params = {
  n?: string;
  p?: string;
  k?: string;
  ph?: string;
  farmerId?: string;
  farmerName?: string;
};

const toNum = (v: any): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default function ReconnectPromptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const { setFromParams } = useReadingSession();

  useEffect(() => {
    (async () => {
      try {
        await setFromParams({
          n: toNum(params.n),
          p: toNum(params.p),
          k: toNum(params.k),
          ph: toNum(params.ph),
          farmerId: typeof params.farmerId === 'string' ? params.farmerId : undefined,
          farmerName: typeof params.farmerName === 'string' ? params.farmerName : undefined,
          ts: Date.now(),
        });
      } catch (e) {
        console.warn('[ReconnectPrompt] failed to set reading session:', e);
      }
    })();
  }, [params, setFromParams]);

  const handleProceed = () => {
    router.replace('/(stakeholder)/screens/recommendation');
  };

  return (
    <View style={styles.container}>
      <Ionicons
        name="cloud-offline-outline"
        size={80}
        color="#E53935"
        style={{ marginBottom: 20 }}
      />

      <Text style={styles.title}>Kinahanglan og Internet Connection</Text>

      <Text style={styles.instruction}>
        Nahuman na ang pagbasa sa sensor.
        <Text style={styles.bold}>
          {' '}
          Kinahanglan ka mobalik sa imong normal nga Wi-Fi (nga naay internet){' '}
        </Text>
        aron ma-upload ang datos ug makuha ang rekomendasyon.
      </Text>

      <Text style={styles.instructionNote}>
        1. I-disconnect ang <Text style={styles.bold}>"Fertisense_AP"</Text> nga Wi-Fi.
      </Text>

      <Text style={styles.instructionNote}>
        2. Ikonek ang cellphone sa usa ka <Text style={styles.bold}>Wi-Fi nga naay Internet</Text>.
      </Text>

      <TouchableOpacity style={styles.actionButton} onPress={handleProceed}>
        <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
        <Text style={styles.actionButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 15,
    textAlign: 'center',
  },
  instruction: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  instructionNote: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  bold: { fontWeight: 'bold' },
  actionButton: {
    marginTop: 40,
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
