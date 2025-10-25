import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { autoConnectToESP32, readNpkFromESP32 } from '../src/esp32';
import { api } from '../src/api';

type Npk = { ok: boolean; ec: number; n: number; p: number; k: number; ph: number; ts?: number; error?: string };
type Point = { n: number; p: number; k: number; ph?: number; ts?: number };

export default function NPKReadingsScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Npk | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      // 1️⃣ Auto-connect to ESP32 Wi-Fi
      await autoConnectToESP32();

      // 2️⃣ Read live NPK data
      const res: any = await readNpkFromESP32();

      // 3️⃣ Adapt response (JSON or text)
      if (typeof res === 'string') {
        try {
          const json = JSON.parse(res);
          setData(json);
        } catch {
          Alert.alert('Response Error', 'Hindi valid JSON ang sagot ng sensor.');
        }
      } else {
        setData(res);
      }

      if (!res.ok) {
        Alert.alert('Basahin ang sensor', res.error || 'Walang sagot mula sa sensor.');
      }
    } catch (err: any) {
      Alert.alert('Hindi makakonekta', err?.message || 'I-connect ang Wi-Fi sa ESP32-NPK at subukan muli.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const n = data?.ok ? data.n : undefined;
  const p = data?.ok ? data.p : undefined;
  const k = data?.ok ? data.k : undefined;
  const ph = data?.ok ? data.ph?.toFixed(1) : '--';

  async function onMainButton() {
    if (busy) return;
    if (!data?.ok) {
      Alert.alert('Walang datos', 'Pindutin muna para basahin ang sensor.');
      return;
    }

    const pt: Point = { n: data.n, p: data.p, k: data.k, ph: data.ph, ts: Date.now() };
    const next = [...points, pt];
    setPoints(next);

    if (next.length < 10) {
      Alert.alert(`Nai-save: ${next.length}/10`, 'Ilipat ang probe sa susunod na lugar at magbasa muli.');
      await load();
      return;
    }

    if (!farmerId) {
      Alert.alert('Missing farmer', 'Walang farmerId sa ruta.');
      return;
    }

    try {
      setBusy(true);
      await api.post(`/api/readings/farmers/${farmerId}/batch`, {
        points: next,
        meta: { label: '10-point soil sample', device: 'ESP32-NPK' },
      });
      setPoints([]);
      router.push({ pathname: '/screens/recommendation', params: { farmerId: String(farmerId) } });
    } catch (e: any) {
      Alert.alert('Upload error', e?.response?.data?.message || e?.message || 'Hindi ma-upload ang batch.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/fertisense-logo.png')} style={styles.logo} resizeMode="contain" />

      <View style={styles.npkContainer}>
        <View style={[styles.npkBox, { backgroundColor: '#2e7d32' }]}>
          <Text style={styles.npkLabel}>N</Text>
          <Text style={styles.npkValue}>{n ?? '--'}</Text>
          <Text style={styles.npkUnit}>mg/kg</Text>
        </View>

        <View style={[styles.npkBox, { backgroundColor: '#e0a52e' }]}>
          <Text style={styles.npkLabel}>P</Text>
          <Text style={styles.npkValue}>{p ?? '--'}</Text>
          <Text style={styles.npkUnit}>mg/kg</Text>
        </View>

        <View style={[styles.npkBox, { backgroundColor: '#2e7d32' }]}>
          <Text style={styles.npkLabel}>K</Text>
          <Text style={styles.npkValue}>{k ?? '--'}</Text>
          <Text style={styles.npkUnit}>mg/kg</Text>
        </View>
      </View>

      <Text style={styles.moistureLabel}>Soil Moisture</Text>
      <View style={styles.moistureBarBackground}>
        <View style={styles.moistureBarFill} />
      </View>
      <Text style={styles.moisturePercent}>42%</Text>
      <Text style={{ marginTop: -40, marginBottom: 50, color: '#333' }}>pH: {ph}</Text>

      <TouchableOpacity style={styles.recommendButton} onPress={onMainButton} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.recommendText}>
            {points.length < 10
              ? `Kunin ang Rekomendasyon (${points.length}/10)`
              : 'Kunin ang Rekomendasyon'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 30, alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 25 },
  logo: { width: 250, height: 150, marginBottom: 30 },
  npkContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 60 },
  npkBox: { flex: 1, height: 230, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  npkLabel: { fontSize: 30, color: '#fff', fontWeight: 'bold', bottom: 25 },
  npkValue: { fontSize: 20, color: '#fff', marginVertical: 0 },
  npkUnit: { fontSize: 13, color: '#fff' },
  moistureLabel: { fontSize: 19, alignSelf: 'flex-start', fontWeight: 'bold', marginBottom: 9, color: '#333' },
  moistureBarBackground: { height: 10, width: '100%', backgroundColor: '#ccc', borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  moistureBarFill: { height: '100%', width: '42%', backgroundColor: '#2e7d32' },
  moisturePercent: { alignSelf: 'flex-start', fontSize: 30, fontWeight: 'bold', color: '#2e7d32', marginBottom: 60 },
  recommendButton: { backgroundColor: '#2e7d32', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30 },
  recommendText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
