// app/(stakeholder)/screens/connect-instructions.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { autoConnectToESP32, ESP_SSID } from '../../../src/esp32';

export default function ConnectInstructionsScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const insets = useSafeAreaInsets();

  async function handleConnect() {
    if (busy) return;

    setBusy(true);
    setStatusMessage(`Connecting to ${ESP_SSID}...`);

    try {
      await autoConnectToESP32();

      setStatusMessage('Connected to ESP32 successfully!');
      await new Promise((r) => setTimeout(r, 400));

      router.push({
        pathname: '/(stakeholder)/screens/select-options' as const,
        params: { farmerId: String(farmerId ?? '') },
      });
    } catch (err: any) {
      setStatusMessage('');
      Alert.alert(
        'Connection Error',
        err?.message ||
          `Not connected to "${ESP_SSID}". Please connect to the ESP32 Wi-Fi first, then press Connect.`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <Image
          source={require('../../../assets/images/fertisense-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Connect to Device</Text>

        <View style={styles.card}>
          <Text style={styles.lead}>
            Ayha makita ang datos, ikonekta una ang device sa imong cellphone.
          </Text>

          <InstructionRow icon="power" text="I-on ang imong sensor device." />
          <InstructionRow icon="wifi" text={`I-on ang Wi-Fi ug pangitaa ang "${ESP_SSID}".`} />
          <InstructionRow icon="swap-horizontal" text="Pinduta ang ‘Connect’ aron makakonek sa sensor." />
          <InstructionRow icon="leaf" text="Pilia ang options sa humay (hybrid/inbred, yuta, season)." />
          <InstructionRow icon="analytics" text="Human sa pagbasa, ang NPK i-classify as LOW/MEDIUM/HIGH para sa recommendation." />

          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaDisabled]}
            onPress={handleConnect}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <>
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Connecting…</Text>
              </>
            ) : (
              <>
                <Ionicons name="wifi" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.ctaText}>Connect</Text>
              </>
            )}
          </TouchableOpacity>

          {statusMessage !== '' && <Text style={styles.statusText}>{statusMessage}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InstructionRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.bullet}>
        <Ionicons name={icon} size={20} color="#2e7d32" />
      </View>
      <Text style={rowStyles.text}>{text}</Text>
    </View>
  );
}

const GREEN = '#2e7d32';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 70 },
  logo: { width: 120, height: 78, marginBottom: 10, marginTop: -40 },
  title: { fontSize: 20, fontWeight: '700', color: GREEN, marginBottom: 16 },
  card: {
    width: '100%',
    backgroundColor: '#f7fbf7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: GREEN,
    padding: 18,
    marginBottom: 28,
  },
  lead: { fontSize: 14, color: '#2b2b2b', lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  cta: {
    marginTop: 10,
    width: '100%',
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  ctaDisabled: { backgroundColor: '#a5d6a7' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  statusText: { textAlign: 'center', color: GREEN, fontSize: 13, marginTop: 10 },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f2e8',
    marginRight: 10,
  },
  text: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
});
