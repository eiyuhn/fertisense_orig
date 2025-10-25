// =============================================================
// File: app/admin/tabs/admin-profile.tsx
// Purpose: Admin profile screen with account info & settings
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, token, refreshMe, logout } = useAuth();
  const [pushNotif, setPushNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshMe();
    }, [token, refreshMe])
  );

  const name = user?.name || '—';
  const email = user?.email || '—';
  const mobile = user?.mobile || '—';
  const address = user?.address || '—';
  const farmLocation = user?.farmLocation || '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topArc} />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.profileSection}>
        <Image
          source={require('../../../assets/images/profile-pic.png')}
          style={styles.profilePic}
        />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.box}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/personal-info')}>
            <Ionicons name="person-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Personal Information</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Mobile" value={mobile} />
          <InfoRow icon="home-outline" label="Address" value={address} />
          <InfoRow icon="map-outline" label="Farm Location" value={farmLocation} />
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.box}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Push Notifications</Text>
            <Switch
              value={pushNotif}
              onValueChange={setPushNotif}
              style={styles.switch}
              trackColor={{ false: '#ccc', true: '#a5d6a7' }}
              thumbColor={pushNotif ? '#2e7d32' : '#f4f3f4'}
            />
          </View>
          <View style={styles.row}>
            <Ionicons name="megaphone-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Promotional Notifications</Text>
            <Switch
              value={promoNotif}
              onValueChange={setPromoNotif}
              style={styles.switch}
              trackColor={{ false: '#ccc', true: '#a5d6a7' }}
              thumbColor={promoNotif ? '#2e7d32' : '#f4f3f4'}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>More</Text>
        <View style={styles.box}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/about')}>
            <Ionicons name="information-circle-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#2e7d32" />
      <Text style={[styles.label, { flex: 0.6 }]}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#222', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topArc: {
    height: 120,
    backgroundColor: '#2e7d32',
    position: 'absolute',
    width: '100%',
    zIndex: -1,
  },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  profileSection: { marginTop: 70, alignItems: 'center', marginBottom: 18 },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderColor: '#fff',
    borderWidth: 3,
  },
  name: { fontSize: 21, fontWeight: 'bold', marginTop: 12, color: '#000' },
  email: { fontSize: 14, color: '#555', marginTop: 2 },
  content: { paddingHorizontal: 21 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
    marginTop: 6,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 17,
    shadowColor: '#0F9334',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 },
  label: { marginLeft: 6, fontSize: 16, color: '#333', flex: 1 },
  switch: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] },
});
