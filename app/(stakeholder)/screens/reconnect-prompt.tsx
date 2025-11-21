// app/(stakeholder)/screens/reconnect-prompt.tsx

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useReadingSession } from '../../../context/ReadingSessionContext';

type Params = {
  n?: string;
  p?: string;
  k?: string;
  ph?: string;
  farmerId?: string;
  farmerName?: string;
};

export default function ReconnectPromptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const { setFromParams } = useReadingSession();

  useEffect(() => {
    (async () => {
      try {
        await setFromParams({
          n: params.n,
          p: params.p,
          k: params.k,
          ph: params.ph,
          farmerId: params.farmerId,
          farmerName: params.farmerName,
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
      <Text style={styles.title}>Internet Connection Required</Text>
      <Text style={styles.instruction}>
        Natapos na ang pagbasa ng sensor.
        <Text style={styles.bold}>
          {' '}
          Kailangan mong bumalik sa inyong normal na Wi-Fi (na may internet){' '}
        </Text>
        upang maipadala ang datos at makuha ang rekomendasyon.
      </Text>
      <Text style={styles.instructionNote}>
        1. Disconnect mula sa <Text style={styles.bold}>"ESP32-NPK"</Text> Wi-Fi.
      </Text>
      <Text style={styles.instructionNote}>
        2. Kumonekta sa isang <Text style={styles.bold}>Internet-Enabled</Text> Wi-Fi.
      </Text>

      <TouchableOpacity style={styles.actionButton} onPress={handleProceed}>
        <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
        <Text style={styles.actionButtonText}>I-connect at Magpatuloy</Text>
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
  bold: {
    fontWeight: 'bold',
  },
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
