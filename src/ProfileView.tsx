// app/src/ProfileView.tsx
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getLocalUser } from './localUsers';

type Props = { mode: 'admin' | 'stakeholder' };

export default function ProfileView({ mode }: Props) {
  const { user } = useAuth();
  const [u, setU] = useState(user ?? null);

  // Refresh from local mirror on focus so offline changes appear
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!user?.email) return;
        const local = await getLocalUser(user.email);
        if (!cancelled && local) setU(prev => ({ ...(prev ?? {}), ...local }));
      })();
      return () => { cancelled = true; };
    }, [user?.email])
  );

  if (!u) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#333' }}>No user session.</Text>
      </View>
    );
  }

  const avatar = u.profileImage
    ? { uri: u.profileImage }
    : require('../assets/images/profile-pic.png');

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topArc} />
      <View style={styles.profileSection}>
        <Image source={avatar} style={styles.profilePic} />
        <Text style={styles.name}>{u.name || '—'}</Text>
        <Text style={styles.roleTag}>{(u.role || mode).toUpperCase()}</Text>
      </View>

      <View style={styles.card}>
        <Field label="Email" value={u.email || '—'} />
        <Field label="Mobile" value={u.mobile ? `+63${u.mobile}` : '—'} />
        <Field label="Address" value={u.address || '—'} />
        <Field label="Farm Location" value={u.farmLocation || '—'} />
      </View>

      <Text style={styles.note}>
        Works offline. Changes sync silently when you’re online.
      </Text>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  topArc: { height: 120, backgroundColor: '#2e7d32', position: 'absolute', width: '100%', zIndex: -1 },
  profileSection: { marginTop: 70, alignItems: 'center', marginBottom: 16 },
  profilePic: { width: 110, height: 110, borderRadius: 55, borderColor: '#fff', borderWidth: 3 },
  name: { fontSize: 21, fontWeight: 'bold', marginTop: 12, color: '#000' },
  roleTag: {
    marginTop: 4, fontSize: 12, fontWeight: '600', color: '#2e7d32',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#e8f5e9',
  },
  card: {
    marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e3e3e3',
    padding: 14, backgroundColor: '#fafafa',
  },
  fieldRow: { marginBottom: 10 },
  fieldLabel: { color: '#666', fontSize: 12, marginBottom: 2 },
  fieldValue: { color: '#222', fontSize: 14, fontWeight: '600' },
  note: { marginTop: 16, color: '#777', fontSize: 12, textAlign: 'center' },
});
