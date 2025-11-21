import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView, // We will change this to View
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

// (Optional) theme import kept, but the design uses fixed values for a pixel-perfect match
// import { COLORS, SIZES, FONTS } from '../../../src/theme';

// --- TYPES ---
type CropType = '' | 'hybrid' | 'inbred' | 'pareho';
type CropStyle = '' | 'irrigated' | 'rainfed' | 'pareho';

type FormState = {
  name: string;
  farmLocation: string;
  landAreaHa: string;
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

type ErrorState = {
  name?: string;
  farmLocation?: string;
  landAreaHa?: string;
  cropType?: string;
  cropStyle?: string;
};

export default function AddOrEditFarmer() {
  const router = useRouter();

  // --- ROUTE / MODE ---
  const params = useLocalSearchParams<{ edit?: string; ts?: string }>();
  const rawEdit = params?.edit;
  const editId =
    typeof rawEdit === 'string' &&
    rawEdit.trim() &&
    rawEdit !== 'undefined' &&
    rawEdit !== 'null'
      ? rawEdit.trim()
      : null;
  const isEdit = !!editId;

  const screenKey = useMemo(
    () => (isEdit ? `edit-${editId}` : `new-${params?.ts ?? '0'}`),
    [isEdit, editId, params?.ts]
  );

  // --- STATE ---
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ErrorState>({});
  const prevEditIdRef = useRef<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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
        const one = all.find(
          (x: any) => (x._id || x.id || '').toString() === editId
        );
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
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  const validate = () => {
    const next: ErrorState = {};
    if (!form.name.trim()) next.name = 'Pangalan ay kailangan.';
    if (!form.farmLocation.trim())
      next.farmLocation = 'Lokasyon ay kailangan.';
    if (!form.landAreaHa.trim()) {
      next.landAreaHa = 'Laki ng sakahan ay kailangan.';
    } else if (isNaN(Number(form.landAreaHa))) {
      next.landAreaHa = 'Dapat numero (hal. 2 o 2.5).';
    } else if (Number(form.landAreaHa) <= 0) {
      next.landAreaHa = 'Hindi pwedeng zero o negatibo.';
    }
    if (!form.cropType) next.cropType = 'Uri ng palay ay kailangan.';
    if (!form.cropStyle) next.cropStyle = 'Estilo ng pagtatanim ay kailangan.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = async () => {
    if (!validate()) {
      Alert.alert('Kulang ang Impormasyon', 'Pakikumpleto ang lahat ng field.');
      return;
    }

    const payloadBase = {
      name: form.name.trim(),
      farmLocation: form.farmLocation.trim(),
      landAreaHa: Number(form.landAreaHa),
      cropType: form.cropType,
      cropStyle: form.cropStyle,
    };

    try {
      setSaving(true);
      if (isEdit && editId) {
        await updateFarmer(editId, payloadBase);
        setShowSuccessModal(true);
      } else {
        await createFarmer(payloadBase);
        setShowSuccessModal(true);
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

  const closeModal = () => {
    setShowSuccessModal(false);
    if (isEdit) {
      router.back();
    } else {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  };

  const isFormValid = useMemo(() => {
    return !!(
      form.name &&
      form.farmLocation &&
      form.landAreaHa &&
      form.cropType &&
      form.cropStyle &&
      !saving
    );
  }, [form, saving]);

  // --- UI (Friend’s design cloned) ---
  return (
    <KeyboardAvoidingView
      key={screenKey}
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Farmer Data' : 'Add a Farmer Data'}
        </Text>
      </View>

      {/* Form */}
      {/* ✅ FIX: Changed ScrollView to View */}
      <View style={styles.form}>
        {/* Name */}
        <Text style={styles.label}>👤 Pangalan ng Magsasaka</Text>
        <TextInput
          style={[styles.input, errors.name ? styles.inputError : null]}
          value={form.name}
          onChangeText={(v) => set('name', v)}
          placeholder="Hal. Juan Dela Cruz"
          placeholderTextColor="#aaa"
          autoCapitalize="words"
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

        {/* Location */}
        <Text style={styles.label}>📍 Lokasyon ng Sakahan</Text>
        <TextInput
          style={[styles.input, errors.farmLocation ? styles.inputError : null]}
          value={form.farmLocation}
          onChangeText={(v) => set('farmLocation', v)}
          placeholder="Hal. Valencia, Bukidnon"
          placeholderTextColor="#aaa"
        />
        {errors.farmLocation ? (
          <Text style={styles.errorText}>{errors.farmLocation}</Text>
        ) : null}

        {/* Land Area */}
        <Text style={styles.label}>📏 Laki ng Sakahan (hectares)</Text>
        <TextInput
          style={[styles.input, errors.landAreaHa ? styles.inputError : null]}
          value={form.landAreaHa}
          onChangeText={(v) => set('landAreaHa', v.replace(/[^0-9.]/g, ''))}
          placeholder="Hal. 2.5"
          keyboardType="numeric"
          placeholderTextColor="#aaa"
        />
        {errors.landAreaHa ? (
          <Text style={styles.errorText}>{errors.landAreaHa}</Text>
        ) : null}

        {/* Crop Type */}
        <Text style={styles.label}>🌾 Uri ng Palay</Text>
        <View
          style={[
            styles.pickerWrapper, // ✅ FIX: Style modified below
            errors.cropType ? styles.inputError : null,
          ]}
        >
          <Picker
            selectedValue={form.cropType}
            onValueChange={(value: CropType) => set('cropType', value)}
            style={styles.picker} // ✅ FIX: Style modified below
            dropdownIconColor="#2e7d32"
          >
            <Picker.Item label="Pumili..." value="" />
            <Picker.Item label="Hybrid" value="hybrid" />
            <Picker.Item label="Inbred" value="inbred" />
            <Picker.Item label="Pareho" value="pareho" />
          </Picker>
        </View>
        {errors.cropType ? (
          <Text style={styles.errorText}>{errors.cropType}</Text>
        ) : null}

        {/* Crop Style */}
        <Text style={styles.label}>💧 Estilo ng Pagtatanim</Text>
        <View
          style={[
            styles.pickerWrapper, // ✅ FIX: Style modified below
            errors.cropStyle ? styles.inputError : null,
          ]}
        >
          <Picker
            selectedValue={form.cropStyle}
            onValueChange={(value: CropStyle) => set('cropStyle', value)}
            style={styles.picker} // ✅ FIX: Style modified below
            dropdownIconColor="#2e7d32"
          >
            <Picker.Item label="Pumili..." value="" />
            <Picker.Item label="Irrigated" value="irrigated" />
            <Picker.Item label="Rainfed" value="rainfed" />
            <Picker.Item label="Pareho" value="pareho" />
          </Picker>
        </View>
        {errors.cropStyle ? (
          <Text style={styles.errorText}>{errors.cropStyle}</Text>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton, // ✅ FIX: Style modified below
            (!isFormValid || saving) && { backgroundColor: '#aaa' },
          ]}
          onPress={onSave}
          disabled={!isFormValid || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveText}>
            💾 {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Farmer'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showSuccessModal}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {isEdit ? 'Farmer Updated!' : 'Farmer Added!'}
            </Text>
            <Text style={styles.modalMessage}>
              👤 {form.name}
              {'\n'}📍 {form.farmLocation}
            </Text>
            <Pressable style={styles.modalButton} onPress={closeModal}>
              <Text style={styles.modalButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// --- STYLES: cloned from friend’s design (fonts/colors/spacing) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5fff5' },
  header: {
    backgroundColor: '#2e7d32',
    paddingTop: 70,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 55,
    bottom: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
  },
  form: {
    paddingHorizontal: 22,
    paddingTop: 16, // ✅ FIX: Reduced from 22
    paddingBottom: 110, // ✅ FIX: Space for the nav bar
    // Note: If this still overflows on small phones, add flex: 1
    // and justifyContent: 'center' to space items out
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8, // ✅ FIX: Reduced from 10
    fontFamily: 'Poppins_600SemiBold',
  },
  input: {
    borderWidth: 1.3,
    borderColor: '#c1e1c1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16, // ✅ FIX: Reduced from 20
    backgroundColor: '#fff',
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#333',
  },
  inputError: {
    borderColor: '#d32f2f',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: -12, // ✅ FIX: Adjusted from -14
    marginBottom: 12, // ✅ FIX: Adjusted from 14
    marginLeft: 4,
    fontFamily: 'Poppins_400Regular',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#c1e1c1',
    borderRadius: 10,
    marginBottom: 16, // ✅ FIX: Reduced from 20
    backgroundColor: '#fff',
    justifyContent: 'center',
    height: 50, // ✅ FIX: Added fixed height to match input
  },
  picker: {
    // height: 47, // ❌ REMOVED: This was causing the text to be cut
    fontFamily: 'Poppins_400Regular',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    elevation: 4,
    // top: 30, // ❌ REMOVED: This caused the large gap
    marginTop: 24, // ✅ FIX: Added a normal margin
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Poppins_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
    elevation: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2e7d32',
    fontFamily: 'Poppins_700Bold',
  },
  modalMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    color: '#444',
    fontFamily: 'Poppins_400Regular',
  },
  modalButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 60,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
});