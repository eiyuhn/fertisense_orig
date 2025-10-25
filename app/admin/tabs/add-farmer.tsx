// app/admin/tabs/add-farmer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { createFarmer, updateFarmer, listFarmers } from '../../../src/services';

type CropType = '' | 'hybrid' | 'inbred' | 'pareho';
type CropStyle = '' | 'irrigated' | 'rainfed' | 'pareho';

type FormState = {
  name: string;
  farmLocation: string;
  landAreaHa: string; // keep as string for input
  cropType: CropType;
  cropStyle: CropStyle;
};

const EMPTY_FORM: FormState = {
  name: '',
  farmLocation: '',
  landAreaHa: '',
  cropType: '',
  cropStyle: '',
};

export default function AddOrEditFarmer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string; ts?: string }>();

  const rawEdit = params?.edit;
  const editId =
    typeof rawEdit === 'string' && rawEdit.trim() && rawEdit !== 'undefined' && rawEdit !== 'null'
      ? rawEdit.trim()
      : null;
  const isEdit = !!editId;

  const screenKey = useMemo(
    () => (isEdit ? `edit-${editId}` : `new-${params?.ts ?? '0'}`),
    [isEdit, editId, params?.ts]
  );

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; landAreaHa?: string }>({});
  const prevEditIdRef = useRef<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  // Reset form when switching from edit→new
  useFocusEffect(
    React.useCallback(() => {
      if (!isEdit) {
        setForm(EMPTY_FORM);
        setErrors({});
      }
      return () => {};
    }, [isEdit])
  );

  useEffect(() => {
    const prev = prevEditIdRef.current;
    if (prev && !editId) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
    prevEditIdRef.current = editId;
  }, [editId]);

  // Load existing farmer on edit
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isEdit || !editId) return;
      try {
        const all = await listFarmers();
        const one = all.find((x: any) => (x._id || x.id) === editId);
        if (!one) throw new Error('Farmer not found');
        if (!cancelled) {
          setForm({
            name: one.name ?? '',
            farmLocation: one.farmLocation ?? '',
            landAreaHa: (one.landAreaHa ?? one.farmSize ?? '').toString(),
            cropType: (one.cropType ?? '') as CropType,
            cropStyle: (one.cropStyle ?? '') as CropStyle,
          });
          setErrors({});
        }
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert('Error', e?.message || 'Failed to load farmer');
          setForm(EMPTY_FORM);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editId]);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Pangalan ay kailangan.';
    if (form.landAreaHa !== '' && isNaN(Number(form.landAreaHa))) {
      next.landAreaHa = 'Dapat numero (hal. 2 o 2.5).';
    } else if (form.landAreaHa !== '' && Number(form.landAreaHa) < 0) {
      next.landAreaHa = 'Hindi pwedeng negatibo.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;

    const payloadBase = {
      name: form.name.trim(),
      farmLocation: form.farmLocation.trim(),
      landAreaHa: form.landAreaHa === '' || form.landAreaHa == null ? 0 : Number(form.landAreaHa),
      cropType: form.cropType,
      cropStyle: form.cropStyle,
    };

    if (!payloadBase.name) {
      // fallback, though validate() covers this
      Alert.alert('Kulang', 'Paki-lagay ang pangalan ng magsasaka.');
      return;
    }

    try {
      setSaving(true);
      if (isEdit && editId) {
        await updateFarmer(editId, payloadBase);
        Alert.alert('Saved', 'Na-update ang datos ng magsasaka.');
        router.back();
      } else {
        await createFarmer(payloadBase);
        Alert.alert('Saved', 'Nagdagdag ng bagong magsasaka.');
        setForm(EMPTY_FORM);
        setErrors({});
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        'Hindi nasave.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(() => (isEdit ? 'Edit Farmer' : 'Add Farmer'), [isEdit]);

  return (
    <KeyboardAvoidingView
      key={screenKey}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color="#1b5e20" />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Name */}
        <FieldLabel text="Pangalan ng Magsasaka" required />
        <Input
          placeholder="Hal. Juan Dela Cruz"
          value={form.name}
          onChangeText={(v: string) => set('name', v)}
          autoCapitalize="words"
          error={errors.name}
          iconLeft="person"
        />

        {/* Location */}
        <FieldLabel text="Lokasyon ng Sakahan" />
        <Input
          placeholder="Hal. Valencia, Bukidnon"
          value={form.farmLocation}
          onChangeText={(v: string) => set('farmLocation', v)}
          iconLeft="pin"
        />

        {/* Land Area */}
        <FieldLabel text="Laki ng Sakahan" hint="(hectares)" />
        <Input
          placeholder="Hal. 2.5"
          value={form.landAreaHa}
          onChangeText={(v: string) => set('landAreaHa', v.replace(',', '.'))}
          keyboardType="decimal-pad"
          iconLeft="expand"
          unit="ha"
          error={errors.landAreaHa}
        />

        {/* Crop Type */}
        <FieldLabel text="Uri ng Palay" />
        <PickerWrap>
          <Picker
            selectedValue={form.cropType}
            onValueChange={(value: CropType) => set('cropType', value)}
            style={styles.picker}
            dropdownIconColor="#2e7d32"
          >
            <Picker.Item label="Pumili ng uri..." value="" />
            <Picker.Item label="Hybrid" value="hybrid" />
            <Picker.Item label="Inbred" value="inbred" />
            <Picker.Item label="Pareho" value="pareho" />
          </Picker>
        </PickerWrap>

        {/* Crop Style */}
        <FieldLabel text="Estilo ng Pagtatanim" />
        <PickerWrap>
          <Picker
            selectedValue={form.cropStyle}
            onValueChange={(value: CropStyle) => set('cropStyle', value)}
            style={styles.picker}
            dropdownIconColor="#2e7d32"
          >
            <Picker.Item label="Pumili ng estilo..." value="" />
            <Picker.Item label="Irrigated" value="irrigated" />
            <Picker.Item label="Rainfed" value="rainfed" />
            <Picker.Item label="Pareho" value="pareho" />
          </Picker>
        </PickerWrap>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Sticky action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.7 }]} activeOpacity={0.9}>
          <Ionicons name="save" size={18} color="#fff" />
          <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Save Farmer'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ---------- Tiny UI helpers ---------- */
function FieldLabel({ text, required, hint }: { text: string; required?: boolean; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{text}</Text>
      {required && <Text style={styles.requiredDot}> • Required</Text>}
      {hint && <Text style={styles.hint}> {hint}</Text>}
    </View>
  );
}

function Input({
  iconLeft,
  unit,
  error,
  style,
  ...props
}: any) {
  return (
    <View style={[styles.inputWrap, error ? styles.inputError : null]}>
      {iconLeft ? (
        <View style={styles.iconLeft}>
          <Ionicons name={iconLeft as any} size={16} color="#2e7d32" />
        </View>
      ) : null}
      <TextInput {...props} style={[styles.input, style]} placeholderTextColor="#9aa49a" />
      {unit ? (
        <View style={styles.unitChip}>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function PickerWrap({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pickerWrap}>
      {children}
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  /* Layout */
  topBar: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F2EA',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECF7EE',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#1b5e20',
    fontWeight: '800',
    fontSize: 16,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  /* Labels */
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 6,
  },
  labelText: {
    color: '#1b5e20',
    fontWeight: '700',
    fontSize: 13.5,
  },
  requiredDot: {
    color: '#b23b3b',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  hint: {
    color: '#607d60',
    fontSize: 12,
    marginLeft: 6,
  },

  /* Inputs */
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E9E1',
    backgroundColor: '#FAFFFB',
    marginBottom: 8,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    position: 'relative',
  },
  inputError: {
    borderColor: '#e7b0b0',
    backgroundColor: '#FFFBFB',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
  },
  iconLeft: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ECF7EE',
    borderRadius: 999,
    marginLeft: 6,
  },
  unitText: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 12,
  },
  errorText: {
    position: 'absolute',
    bottom: -16,
    left: 10,
    color: '#b22a2a',
    fontSize: 11.5,
  },

  /* Picker */
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#E0E9E1',
    borderRadius: 12,
    backgroundColor: '#FAFFFB',
    marginBottom: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 46,
    color: '#333',
  },

  /* Sticky action bar */
  actionBar: {
    borderTopWidth: 1,
    borderTopColor: '#E9F2EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveBtn: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});
