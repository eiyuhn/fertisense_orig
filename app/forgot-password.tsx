// app/forgot-password-username.tsx
import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getSecurityQuestionsApi } from '../src/services';

export default function ForgotPasswordUsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter your username.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const res = await getSecurityQuestionsApi(trimmed);
      if (!res.questions || res.questions.length === 0) {
        setError('No security questions found for this user.');
        return;
      }

      // Navigate to step 2 with username + questions as params
      router.push({
        pathname: '/forgot-password-questions',
        params: {
          username: trimmed,
          questions: JSON.stringify(res.questions),
        },
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e?.message ?? 'Failed to fetch questions.';
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your username so we can show your security questions.
        </Text>

        <Text style={styles.label}>Username *</Text>
        <TextInput
          style={styles.input}
          placeholder="yourusername"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, busy && { opacity: 0.7 }]}
          onPress={handleNext}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Checking…' : 'Next'}
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#555',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 3,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 15,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8,
  },
});
