// app/admin/tabs/edit-price.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../../context/AuthContext';
import { getPriceSettings, putPriceSettings } from '../../../src/services';

export default function EditPriceScreen() {
  const router = useRouter();
  const { token } = useAuth(); // string | null in some setups → we always pass token || undefined

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI shows ₱ per bag (50 kg), keep three main items as before
  const [currency, setCurrency] = useState<'PHP' | string>('PHP');
  const [urea, setUrea] = useState<string>(''); // UREA_46_0_0
  const [dap, setDap] = useState<string>('');   // DAP_18_46_0
  const [mop, setMop] = useState<string>('');   // MOP_0_0_60

  const load = async () => {
    try {
      setLoading(true);
      const doc = await getPriceSettings(token || undefined);
      setCurrency(doc?.currency ?? 'PHP');

      const items = doc?.items || {};
      const getPrice = (code: string) =>
        items?.[code]?.pricePerBag != null ? String(items[code].pricePerBag) : '';

      setUrea(getPrice('UREA_46_0_0'));
      setDap(getPrice('DAP_18_46_0'));
      setMop(getPrice('MOP_0_0_60'));
    } catch (e: any) {
      console.log('LOAD PRICES ERR:', e?.response?.data || e?.message);
      Alert.alert('Error', 'Failed to load fertilizer prices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        currency: currency || 'PHP',
        items: {
          UREA_46_0_0: { pricePerBag: Number(urea) || 0 },
          DAP_18_46_0: { pricePerBag: Number(dap) || 0 },
          MOP_0_0_60: { pricePerBag: Number(mop) || 0 },
        },
      };

      await putPriceSettings(token || undefined, payload as any);

      // Re-fetch to reflect exactly what’s stored
      const fresh = await getPriceSettings(token || undefined);
      setCurrency(fresh?.currency ?? 'PHP');
      const it = fresh?.items || {};
      setUrea(it?.UREA_46_0_0?.pricePerBag != null ? String(it.UREA_46_0_0.pricePerBag) : '');
      setDap(it?.DAP_18_46_0?.pricePerBag != null ? String(it.DAP_18_46_0.pricePerBag) : '');
      setMop(it?.MOP_0_0_60?.pricePerBag != null ? String(it.MOP_0_0_60.pricePerBag) : '');

      Alert.alert('✅ Saved', 'Fertilizer prices updated.');
      router.back();
    } catch (e: any) {
      console.log('SAVE PRICES ERR:', e?.response?.status, e?.response?.data || e?.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save prices.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading prices…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header (original green style) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fertilizer Prices</Text>
        <Text style={styles.headerSubtitle}>Currency: ₱ {currency} · Per bag</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Urea */}
        <View style={styles.rowCard}>
          <Text style={styles.name}>Urea (46-0-0)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>₱</Text>
            <TextInput
              value={urea}
              onChangeText={setUrea}
              keyboardType="numeric"
              placeholder="0.00"
              style={styles.input}
            />
            <Text style={styles.unit}>/bag</Text>
          </View>
        </View>

        {/* DAP */}
        <View style={styles.rowCard}>
          <Text style={styles.name}>DAP (18-46-0)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>₱</Text>
            <TextInput
              value={dap}
              onChangeText={setDap}
              keyboardType="numeric"
              placeholder="0.00"
              style={styles.input}
            />
            <Text style={styles.unit}>/bag</Text>
          </View>
        </View>

        {/* MOP */}
        <View style={styles.rowCard}>
          <Text style={styles.name}>MOP (0-0-60)</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>₱</Text>
            <TextInput
              value={mop}
              onChangeText={setMop}
              keyboardType="numeric"
              placeholder="0.00"
              style={styles.input}
            />
            <Text style={styles.unit}>/bag</Text>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={20} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fdf7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#2e7d32',
    paddingTop: 60, paddingBottom: 30,
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    alignItems: 'center', marginBottom: 10, position: 'relative',
  },
  backButton: { position: 'absolute', left: 20, top: 60 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: '#c8e6c9', fontSize: 14, marginTop: 5 },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  name: { fontSize: 15, fontWeight: '600', color: '#2e7d32', flex: 1, marginRight: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  currency: { fontSize: 16, color: '#333' },
  input: {
    borderBottomWidth: 1, borderColor: '#ccc',
    paddingVertical: 2, paddingHorizontal: 8,
    width: 90, textAlign: 'right', fontSize: 16,
  },
  unit: { fontSize: 13, color: '#666', marginLeft: 4 },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
