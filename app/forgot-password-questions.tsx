// app/forgot-password-questions.tsx
import React, { useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  resetPasswordWithSecurityQuestionApi,
  type SecurityQuestion,
} from '../src/services';

export default function ForgotPasswordQuestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    username?: string;
    questions?: string;
  }>();

  const username = (params.username || '').toString();
  const questions: SecurityQuestion[] = useMemo(() => {
    try {
      if (!params.questions) return [];
      return JSON.parse(params.questions as string);
    } catch {
      return [];
    }
  }, [params.questions]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    questions.length ? questions[0].index : null
  );
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!username) {
      setError('Missing username.');
      return;
    }
    if (selectedIndex == null) {
      setError('Please choose a question.');
      return;
    }
    if (!answer.trim()) {
      setError('Please enter your answer.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await resetPasswordWithSecurityQuestionApi({
        username,
        index: selectedIndex,
        answer: answer.trim(),
        newPassword,
      });

      Alert.alert('Success', 'Password reset successful. Please log in.', [
        {
          text: 'OK',
          onPress: () => router.replace('/login'),
        },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ??
        e?.message ??
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/forgot-password-username')}
        >
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>

        <Text style={styles.title}>Answer a Security Question</Text>
        <Text style={styles.subtitle}>
          Choose one question and answer it to set a new password for{' '}
          <Text style={{ fontWeight: '700' }}>{username}</Text>.
        </Text>

        {questions.map(q => (
          <TouchableOpacity
            key={q.index}
            style={styles.questionRow}
            onPress={() => setSelectedIndex(q.index)}
          >
            <Ionicons
              name={
                selectedIndex === q.index ? 'radio-button-on' : 'radio-button-off'
              }
              size={20}
              color="#2e7d32"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.questionText}>{q.question}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>Your Answer *</Text>
        <TextInput
          style={styles.input}
          placeholder="Type your answer"
          value={answer}
          onChangeText={setAnswer}
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
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, busy && { opacity: 0.7 }]}
          onPress={handleReset}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Resetting…' : 'Reset Password'}
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
    marginBottom: 18,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  label: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 3,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 12,
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
