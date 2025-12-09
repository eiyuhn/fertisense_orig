// app/forgot-password.tsx
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { requestPasswordReset, resetPasswordApi } from '../src/services';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleRequestCode = async () => {
    const e = email.trim().toLowerCase();
    const m = mobile.trim().replace(/[^0-9]/g, '');

    if (!e || !m) {
      setError('Please enter both email and mobile number.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      const res = await requestPasswordReset(e, m);

      // In dev, res.testCode may be present for debugging
      if (res?.testCode) {
        console.log('Password reset TEST CODE:', res.testCode);
      }

      Alert.alert(
        'Code Sent',
        'A reset code has been sent to your mobile number.'
      );
      setStep('verify');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err.message ??
        'Failed to request reset.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const e = email.trim().toLowerCase();
    const m = mobile.trim().replace(/[^0-9]/g, '');

    if (!code || !newPassword || !confirm) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setBusy(true);
      setError('');

      await resetPasswordApi(e, m, code.trim(), newPassword);

      Alert.alert('Success', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err.message ??
        'Failed to reset password.';
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
        {/* Back → always go back to login */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        {/* Same logo as login/register */}
        <Image
          source={require('../assets/images/fertisense-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Tabs row for consistency */}
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.tabInactive}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/register')}>
            <Text style={styles.tabInactive}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter the email and mobile number you used when creating your account.
        </Text>

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

        {step === 'request' && (
          <>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, busy && { opacity: 0.7 }]}
              onPress={handleRequestCode}
              disabled={busy}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Sending code…' : 'Send Reset Code'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={[styles.subtitle, { marginTop: 16 }]}>
              Enter the code you received and choose a new password.
            </Text>

            <Text style={styles.label}>Reset Code *</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />

            <Text style={styles.label}>New Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="********"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.label}>Confirm New Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="********"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, busy && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={busy}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Updating…' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </>
        )}
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
    top: 85,
    left: 25,
    zIndex: 10,
  },
  logo: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    marginTop: -160,
    marginBottom: -20,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tabInactive: {
    fontSize: 15,
    color: '#999',
    marginHorizontal: 8,
    paddingBottom: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
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
    marginBottom: 9,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  prefixBox: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  prefixText: {
    fontSize: 14,
    color: '#333',
  },
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
  primaryButton: {
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
