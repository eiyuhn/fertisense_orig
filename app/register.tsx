// app/register.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import {
  getLocalUser,
  setLocalUser,
  upsertLocalUserMirror,
  type LocalUser,
} from '../src/localUsers';
import { isOnline } from '../utils/network';

const cap = (s: string) =>
  s
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

export default function RegisterScreen() {
  const router = useRouter();
  const { register, login } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 🔙 Make Android back button / gesture always go to /login
  useFocusEffect(
    React.useCallback(() => {
      const handleBack = () => {
        router.replace('/login');
        return true; // block default behavior
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBack
      );

      return () => subscription.remove();
    }, [router])
  );

  const handleRegister = async () => {
    const payload: LocalUser = {
      name: cap(name.trim()),
      email: email.trim().toLowerCase(),
      password,
      role: 'stakeholder',
      address: cap(address.trim()),
      farmLocation: cap(farmLocation.trim()),
      mobile: mobile.trim().replace(/[^0-9]/g, ''),
      profileImage: null,
      offlineOnly: true,
    };

    if (
      !payload.name ||
      !payload.address ||
      !payload.farmLocation ||
      !payload.mobile ||
      !payload.email ||
      !password ||
      !confirmPassword
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const online = await isOnline();

      if (online) {
        // Explicitly pass a clean object with all required fields for the backend
        await register({
          name: payload.name,
          email: payload.email,
          password: payload.password, // Server should handle hashing this
          role: 'stakeholder',
          address: payload.address,
          farmLocation: payload.farmLocation,
          mobile: payload.mobile,
        });

        await upsertLocalUserMirror(
          {
            name: payload.name,
            email: payload.email,
            role: 'stakeholder',
            address: payload.address,
            farmLocation: payload.farmLocation,
            mobile: payload.mobile,
            profileImage: null,
            offlineOnly: false,
          },
          password,
          false
        );

        Alert.alert('Success', 'Account created!');
        router.replace('/(stakeholder)/tabs/stakeholder-home');
        return;
      }

      // Offline flow
      const exists = await getLocalUser(payload.email);
      if (exists) {
        setError('Account already exists offline.');
        return;
      }

      await setLocalUser(payload);
      await login({ email: payload.email, password: payload.password } as any);

      Alert.alert('Success', 'Account created offline. Will sync when online.');
      router.replace('/(stakeholder)/tabs/stakeholder-home');
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e.message ?? 'Failed to register.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* 🔙 Back arrow always sends to /login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <Image
          source={require('../assets/images/fertisense-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.tabInactive}>Log In</Text>
          </TouchableOpacity>
          <Text style={styles.tabActive}>Sign Up</Text>
        </View>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Juan Dela Cruz"
          value={name}
          onChangeText={t => setName(cap(t))}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Brgy. Poblacion"
              value={address}
              onChangeText={t => setAddress(cap(t))}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Farm Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="Valencia City"
              value={farmLocation}
              onChangeText={t => setFarmLocation(cap(t))}
            />
          </View>
        </View>

        <Text style={styles.label}>Mobile Number *</Text>
        <View style={styles.mobileRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>+63</Text>
          </View>
          <TextInput
            style={styles.mobileInput}
            placeholder="9123456789"
            keyboardType="phone-pad"
            maxLength={10}
            value={mobile}
            onChangeText={setMobile}
          />
        </View>

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.registerButton, busy && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Creating…' : 'Create Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  logo: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    marginTop: -40,
    marginBottom: -30,
  },
  tabContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  tabActive: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginLeft: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#2e7d32',
    paddingBottom: 1,
  },
  tabInactive: { fontSize: 15, color: '#999', paddingBottom: 3 },
  label: { fontSize: 14, marginBottom: 3, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 9,
  },
  row: { flexDirection: 'row', marginBottom: 9 },
  mobileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  prefixBox: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  prefixText: { fontSize: 14, color: '#333' },
  mobileInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 10,
  },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  errorText: { color: 'red', textAlign: 'center', fontSize: 13, marginBottom: 8 },
});
