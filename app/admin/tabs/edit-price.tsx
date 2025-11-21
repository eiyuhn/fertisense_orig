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
  code: string; // unique key e.g. "UREA_46_0_0"
  name: string; // display e.g. "Urea (46-0-0)"  (server: label)
  pricePerBag: string; // Kept as string for text input
  unitBagKg?: number; // default 50          (server: bagKg)
  enabled?: boolean; // for future toggling   (server: active)
};

export default function EditPriceScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [items, setItems] = useState<FertItem[]>([]);

  // map server -> UI
  const fromDocToList = (doc: AdminPricesDoc): FertItem[] => {
    const map = doc?.items || {};
    const sortedEntries = Object.entries(map).sort(([codeA], [codeB]) => codeA.localeCompare(codeB));
    return sortedEntries.map(([code, v]) => ({
      code, name: v.label, pricePerBag: String(v.pricePerBag ?? 0),
      unitBagKg: Number(v.bagKg ?? 50), enabled: v.active !== false,
    }));
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const doc = (await getPriceSettings(token || undefined)) as AdminPricesDoc;
      if (!doc || !doc.items) { throw new Error('Invalid price document received'); }
      setCurrency(doc.currency || 'PHP');
      const arr = fromDocToList(doc);
      const defaultItems = [
        { code: 'UREA_46_0_0', name: 'Urea (46-0-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'DAP_18_46_0', name: 'DAP (18-46-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'MOP_0_0_60', name: 'MOP (0-0-60)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'SSP_0_16_0', name: 'SSP (0-16-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'NPK_14_14_14', name: 'NPK (14-14-14)', pricePerBag: '0', unitBagKg: 50, enabled: true },
      ];
      if (arr.length === 0) { setItems(defaultItems); }
      else { setItems(arr); }
    } catch (e: any) {
      console.log('LOAD PRICES ERR:', e?.response?.data || e?.message);
      Alert.alert('Error Loading Prices', 'Displaying default fertilizers.');
       setItems([ // Set defaults on error
        { code: 'UREA_46_0_0', name: 'Urea (46-0-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'DAP_18_46_0', name: 'DAP (18-46-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'MOP_0_0_60', name: 'MOP (0-0-60)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'SSP_0_16_0', name: 'SSP (0-16-0)', pricePerBag: '0', unitBagKg: 50, enabled: true },
        { code: 'NPK_14_14_14', name: 'NPK (14-14-14)', pricePerBag: '0', unitBagKg: 50, enabled: true },
      ]);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ✅✅✅ FIX: Removed automatic code update logic from here ✅✅✅
  const onChangeItem = (idx: number, patch: Partial<FertItem>) => {
    setItems((prev) => {
      const next = [...prev];
      // Create a temporary newItem based on previous state and the patch
      const newItem = { ...prev[idx], ...patch };

      // Validate price input to allow decimals
      if (patch.pricePerBag !== undefined) {
        const regex = /^\d*\.?\d*$/; // Only numbers and one decimal
        if (!regex.test(patch.pricePerBag)) {
          // If invalid price format, revert price change but keep other changes
          newItem.pricePerBag = prev[idx].pricePerBag;
        }
      }

      // Update the item in the array
      next[idx] = newItem;
      return next;
    });
  };
  // ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

  const addItem = () => {
    setItems((prev) => [...prev, { code: `NEW_ITEM_${Date.now()}`, name: '', pricePerBag: '0', unitBagKg: 50, enabled: true }]);
  };

  const removeItem = (idx: number) => { /* ... (remains same) ... */ };

  // ✅✅✅ FIX: handleSave now ALWAYS generates the final code from the name ✅✅✅
  const handleSave = async () => {
    try {
      // Basic validation
      const codes = new Set<string>();
      for (const it of items) {
        if (!it.name.trim()) { Alert.alert('Validation', `Name needed for item index ${items.indexOf(it)}.`); return; }

        // Generate the code that WILL be saved from the current name
        const finalCode = it.name.trim().replace(/\s+/g, '_').toUpperCase();
        if (!finalCode) { Alert.alert('Validation', `Invalid code for "${it.name}".`); return; }

        // Check for duplicates based on the FINAL code that will be saved
        if (codes.has(finalCode)) { Alert.alert('Validation', `Duplicate name/code generated: "${it.name}" / "${finalCode}". Ensure names are unique.`); return; }
        codes.add(finalCode);
      }

      setSaving(true);

      // UI -> server payload shape (Regenerate codes on save)
      const payload: AdminPricesDoc = {
        currency: currency || 'PHP',
        items: items.reduce((acc, it) => {
           // Always generate the final code from the name during save
           const finalCode = it.name.trim().replace(/\s+/g, '_').toUpperCase();
           acc[finalCode] = { // Use final code as the key
            label: it.name.trim(), // Use trimmed name
            pricePerBag: Number(it.pricePerBag) || 0,
            bagKg: it.unitBagKg ?? 50,
            npk: { N: 0, P: 0, K: 0 }, // Default NPK
            active: it.enabled !== false,
          };
          return acc;
        }, {} as AdminPricesDoc['items']),
      };

      await putPriceSettings(token || undefined, payload);
      await load(); // Reload ensures we get the final codes/order
      Alert.alert('✅ Saved', 'Prices updated.'); router.back();
    } catch (e: any) { console.log('SAVE ERR:', e?.response?.status, e?.response?.data); Alert.alert('Error', e?.response?.data?.error || 'Failed save.'); }
    finally { setSaving(false); }
  };
  // ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅

  const renderListFooter = () => ( <TouchableOpacity onPress={addItem} style={styles.addBtn}><Ionicons name="add-circle-outline" size={22} color="#2e7d32" /><Text style={styles.addText}>Add fertilizer</Text></TouchableOpacity> );

  if (loading) { return ( <View style={styles.center}><ActivityIndicator /><Text style={{ marginTop: 8 }}>Loading prices…</Text></View> ); }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f7fdf7' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
       {/* Header */}
       <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
         <Text style={styles.headerTitle}>Fertilizer Prices</Text>
         <View style={styles.currencyRow}><Text style={styles.headerSubtitle}>Currency:</Text><TextInput value={currency} onChangeText={setCurrency} placeholder="PHP" style={styles.currencyInput} autoCapitalize="characters" /><Text style={styles.headerSubtitle}> (₱ per 50kg bag)</Text></View>
       </View>
       {/* ScrollView + FlatList */}
       <ScrollView contentContainerStyle={styles.scrollContent}>
         <FlatList
           data={items}
           keyExtractor={(item, index) => item.code + index} // Key based on potentially temporary code + index
           scrollEnabled={false}
           ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
           ListFooterComponent={renderListFooter}
           renderItem={({ item, index }) => (
             <View style={styles.card}>
               <View style={styles.nameInputWrapper}><Text style={styles.label}>Name</Text><TextInput value={item.name} onChangeText={(t) => onChangeItem(index, { name: t })} placeholder="Fertilizer Name (e.g. Urea)" style={styles.input} /></View>
               <View style={styles.priceInputWrapper}><Text style={styles.label}>₱ /bag</Text><TextInput value={item.pricePerBag} onChangeText={(t) => onChangeItem(index, { pricePerBag: t })} keyboardType="numeric" placeholder="0.00" style={styles.input} /></View>
               <TouchableOpacity onPress={() => removeItem(index)} style={styles.deleteBtn}><Ionicons name="trash-outline" size={20} color="#c62828" /></TouchableOpacity>
             </View>
           )}
         />
         {/* Save Button */}
         <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
           <Ionicons name="save-outline" size={20} color="#fff" />
           <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
         </TouchableOpacity>
       </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#2e7d32', paddingTop: 60, paddingBottom: 18, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center', position: 'relative' },
  backButton: { position: 'absolute', left: 20, top: 60 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  currencyRow: { flexDirection: 'row', alignItems: 'center' },
  headerSubtitle: { color: '#c8e6c9', fontSize: 14 },
  currencyInput: { marginHorizontal: 8, minWidth: 70, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#ffffff33', borderRadius: 6, color: '#fff', fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 110 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'flex-end', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', paddingVertical: 4, paddingHorizontal: 8, fontSize: 15 },
  nameInputWrapper: { flex: 1, marginRight: 10 },
  priceInputWrapper: { width: 100 },
  deleteBtn: { marginLeft: 8, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffebee' },
  addBtn: { marginTop: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: '#e8f5e9' },
  addText: { color: '#2e7d32', fontWeight: '700' },
  saveBtn: { marginTop: 14, backgroundColor: '#2e7d32', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveText: { color: '#fff', fontWeight: '700' },
});