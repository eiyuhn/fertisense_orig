// app/login.tsx
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
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setBusy(true);
      setError('');

      // ✅ get fresh user immediately from login()
      const { user: loggedInUser } = await login({ email: trimmedEmail, password });

      const role = (loggedInUser?.role || '').toLowerCase();
      if (role === 'admin') {
        router.replace('/admin/tabs/admin-home'); // admin: add farmer, edit price, logs
      } else {
        router.replace('/(stakeholder)/tabs/stakeholder-home');
      }

      Alert.alert('Success', 'Logged in!');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <Image source={require('../assets/images/fertisense-logo.png')} style={styles.logo} resizeMode="contain" />

        <View style={styles.tabContainer}>
          <Text style={styles.tabActive}>Log In</Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.tabInactive}>Sign Up</Text>
          </TouchableOpacity>
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
        <View style={styles.passwordInputContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="********"
            secureTextEntry={!showPassword}
            value={password}
            autoCapitalize="none"
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#999" style={{ marginRight: 10 }} />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={[styles.loginButton, busy && { opacity: 0.7 }]} onPress={handleLogin} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Logging in…' : 'Log In'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1, justifyContent: 'center' },
  backButton: { position: 'absolute', top: 85, left: 25, zIndex: 10 },
  logo: { width: 220, height: 220, alignSelf: 'center', marginTop: -160, marginBottom: -20 },
  tabContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  tabActive: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32', borderBottomWidth: 2, borderBottomColor: '#2e7d32', paddingBottom: 1 },
  tabInactive: { fontSize: 15, color: '#999', marginLeft: 16, paddingBottom: 3 },
  label: { fontSize: 14, marginBottom: 3, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 9 },
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 9 },
  passwordInput: { flex: 1, padding: 12, fontSize: 14 },
  loginButton: { backgroundColor: '#2e7d32', paddingVertical: 14, borderRadius: 50, marginTop: 10 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },
  errorText: { color: 'red', textAlign: 'center', fontSize: 13, marginBottom: 8 },
});
