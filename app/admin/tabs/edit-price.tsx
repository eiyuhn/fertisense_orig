// app/(admin)/screens/edit-prices.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../../context/AuthContext';
import { getPriceSettings, putPriceSettings } from '../../../src/services';
import type { AdminPricesDoc } from '../../../src/services';

type FertItem = {
  code: string;          // stable key, e.g. "UREA_46_0_0"
  name: string;          // display label, e.g. "Urea (46-0-0)"
  pricePerBag: string;   // as string for TextInput
  unitBagKg?: number;    // usually 50 kg
  enabled?: boolean;     // for future toggling
};

/**
 * Known fertilizers from your LGU table.
 * This is used both for defaults AND for auto-normalizing
 * ugly labels like "UREA_46_0_0" into "Urea (46-0-0)".
 */
const CODE_LABEL_MAP: Record<string, string> = {
  UREA_46_0_0: 'Urea (46-0-0)',
  DAP_18_46_0: 'DAP (18-46-0)',
  MOP_0_0_60: 'MOP (0-0-60)',
  NPK_14_14_14: 'Complete (14-14-14)',
  COMPLETE_14_14_14: 'Complete (14-14-14)', // legacy backend code
  NPK_16_20_0: '16-20-0',
  AMMOSUL_21_0_0: '21-0-0',
};

const DEFAULT_ITEMS: FertItem[] = [
  {
    code: 'UREA_46_0_0',
    name: CODE_LABEL_MAP['UREA_46_0_0'],
    pricePerBag: '1530',
    unitBagKg: 50,
    enabled: true,
  },
  {
    code: 'DAP_18_46_0',
    name: CODE_LABEL_MAP['DAP_18_46_0'],
    pricePerBag: '2380',
    unitBagKg: 50,
    enabled: true,
  },
  {
    code: 'MOP_0_0_60',
    name: CODE_LABEL_MAP['MOP_0_0_60'],
    pricePerBag: '1345',
    unitBagKg: 50,
    enabled: true,
  },
  {
    code: 'NPK_14_14_14',
    name: CODE_LABEL_MAP['NPK_14_14_14'],
    pricePerBag: '1435',
    unitBagKg: 50,
    enabled: true,
  },
  {
    code: 'NPK_16_20_0',
    name: CODE_LABEL_MAP['NPK_16_20_0'],
    pricePerBag: '1335',
    unitBagKg: 50,
    enabled: true,
  },
  {
    code: 'AMMOSUL_21_0_0',
    name: CODE_LABEL_MAP['AMMOSUL_21_0_0'],
    pricePerBag: '680',
    unitBagKg: 50,
    enabled: true,
  },
];

export default function EditPriceScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [items, setItems] = useState<FertItem[]>([]);

  // -------- map server -> UI, with auto-normalization --------
  const fromDocToList = (doc: AdminPricesDoc): FertItem[] => {
    const map = doc?.items || {};
    const sortedEntries = Object.entries(map).sort(([codeA], [codeB]) =>
      codeA.localeCompare(codeB)
    );

    if (sortedEntries.length === 0) {
      // No doc yet → use our LGU defaults
      return DEFAULT_ITEMS;
    }

    return sortedEntries.map(([code, v]) => {
      // If label looks like a code OR we have a nicer label for this code,
      // replace it with the pretty label from CODE_LABEL_MAP.
      const rawLabel = v.label || code;
      const normalizedLabel =
        CODE_LABEL_MAP[code] ??
        (rawLabel.includes('_') ? CODE_LABEL_MAP[code] ?? rawLabel : rawLabel);

      return {
        code,
        name: normalizedLabel,
        pricePerBag: String(v.pricePerBag ?? 0),
        unitBagKg: Number(v.bagKg ?? 50),
        enabled: v.active !== false,
      };
    });
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const doc = (await getPriceSettings(
        token || undefined
      )) as AdminPricesDoc;

      if (!doc || !doc.items) {
        throw new Error('Invalid price document received');
      }

      setCurrency(doc.currency || 'PHP');
      const arr = fromDocToList(doc);
      setItems(arr.length === 0 ? DEFAULT_ITEMS : arr);
    } catch (e: any) {
      console.log('LOAD PRICES ERR:', e?.response?.data || e?.message);
      Alert.alert('Error Loading Prices', 'Using default LGU fertilizers.');
      setCurrency('PHP');
      setItems(DEFAULT_ITEMS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // -------- update a single fertilizer row --------
  const onChangeItem = (idx: number, patch: Partial<FertItem>) => {
    setItems(prev => {
      const next = [...prev];
      const current = prev[idx];
      const updated: FertItem = { ...current, ...patch };

      // allow only numeric + optional decimal in price
      if (patch.pricePerBag !== undefined) {
        const regex = /^\d*\.?\d*$/;
        if (!regex.test(patch.pricePerBag)) {
          updated.pricePerBag = current.pricePerBag;
        }
      }

      next[idx] = updated;
      return next;
    });
  };

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        code: `CUSTOM_${Date.now()}`,
        name: '',
        pricePerBag: '0',
        unitBagKg: 50,
        enabled: true,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // -------- save -> backend --------
  const handleSave = async () => {
    try {
      // basic validation
      for (const [i, it] of items.entries()) {
        if (!it.name.trim()) {
          Alert.alert('Validation', `Please enter a name for item #${i + 1}.`);
          return;
        }
        if (!it.code.trim()) {
          Alert.alert('Validation', `Missing internal code for "${it.name}".`);
          return;
        }
      }

      // check duplicate codes
      const codeSet = new Set<string>();
      for (const it of items) {
        if (codeSet.has(it.code)) {
          Alert.alert(
            'Validation',
            `Duplicate code detected: "${it.code}". Codes must be unique.`
          );
          return;
        }
        codeSet.add(it.code);
      }

      setSaving(true);

      // UI -> server payload
      const payload: AdminPricesDoc = {
        currency: currency || 'PHP',
        items: items.reduce((acc, it) => {
          acc[it.code] = {
            label: it.name.trim(),
            pricePerBag: Number(it.pricePerBag) || 0,
            bagKg: it.unitBagKg ?? 50,
            // NPK values could be used later; keep zero for now
            npk: { N: 0, P: 0, K: 0 },
            active: it.enabled !== false,
          };
          return acc;
        }, {} as AdminPricesDoc['items']),
      };

      await putPriceSettings(token || undefined, payload);
      await load();
      Alert.alert('✅ Saved', 'Fertilizer prices updated.');
      router.back();
    } catch (e: any) {
      console.log(
        'SAVE ERR:',
        e?.response?.status,
        e?.response?.data || e?.message
      );
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const renderListFooter = () => (
    <TouchableOpacity onPress={addItem} style={styles.addBtn}>
      <Ionicons name="add-circle-outline" size={22} color="#2e7d32" />
      <Text style={styles.addText}>Add fertilizer</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading prices…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f7fdf7' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fertilizer Prices</Text>
        <View style={styles.currencyRow}>
          <Text style={styles.headerSubtitle}>Currency:</Text>
          <TextInput
            value={currency}
            onChangeText={setCurrency}
            placeholder="PHP"
            style={styles.currencyInput}
            autoCapitalize="characters"
          />
          <Text style={styles.headerSubtitle}> (₱ per 50kg bag)</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <FlatList
          data={items}
          keyExtractor={(item, index) => item.code + index}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListFooterComponent={renderListFooter}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.nameInputWrapper}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  value={item.name}
                  onChangeText={t => onChangeItem(index, { name: t })}
                  placeholder="Fertilizer Name (e.g. Urea)"
                  style={styles.input}
                />
              </View>

              <View style={styles.priceInputWrapper}>
                <Text style={styles.label}>₱ /bag</Text>
                <TextInput
                  value={item.pricePerBag}
                  onChangeText={t =>
                    onChangeItem(index, { pricePerBag: t })
                  }
                  keyboardType="numeric"
                  placeholder="0.00"
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                onPress={() => removeItem(index)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={20} color="#c62828" />
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={20} color="#fff" />
          <Text style={styles.saveText}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#2e7d32',
    paddingTop: 60,
    paddingBottom: 18,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    position: 'relative',
  },
  backButton: { position: 'absolute', left: 20, top: 60 },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  currencyRow: { flexDirection: 'row', alignItems: 'center' },
  headerSubtitle: { color: '#c8e6c9', fontSize: 14 },
  currencyInput: {
    marginHorizontal: 8,
    minWidth: 70,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff33',
    borderRadius: 6,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 15,
  },
  nameInputWrapper: { flex: 1, marginRight: 10 },
  priceInputWrapper: { width: 100 },
  deleteBtn: {
    marginLeft: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
  },
  addBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e8f5e9',
  },
  addText: { color: '#2e7d32', fontWeight: '700' },
  saveBtn: {
    marginTop: 14,
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
