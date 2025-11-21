// =============================================================
// File: app/admin/tabs/admin-home.tsx
// Purpose: Admin home with "Quick Actions" title + "View Logs" directly below (left-aligned).
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { BASE_URL } from '../../../src/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const sensorImg = require('../../../assets/images/connect-sensor.png');
const farmerImg = require('../../../assets/images/farmer-data.png');
const priceImg = require('../../../assets/images/ferti-price.png');

const getFormattedDate = () => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  } as const;
  return new Date().toLocaleDateString('en-PH', options);
};

export default function AdminHomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { farmerId } = useLocalSearchParams<{ farmerId?: string }>();
  const { user, logout } = useAuth();
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());

  useEffect(() => setImageTimestamp(Date.now()), [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      navigation.setOptions({ gestureEnabled: false });
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        e.preventDefault();
        Alert.alert(
          'Confirm Logout',
          'You must log out to leave the application. Do you want to log out now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: async () => {
                await logout();
                router.replace('/login');
              },
            },
          ]
        );
      });
      return () => unsubscribe();
    }, [user, navigation, logout, router])
  );

  const goConnectGuided = () => {
    const fid = typeof farmerId === 'string' ? farmerId : '';
    const next = encodeURIComponent('/sensor-reading');
    const fidQ = encodeURIComponent(fid);
    router.push(`/admin/tabs/connect-instructions?next=${next}&farmerId=${fidQ}`);
  };

  const buildPhotoUrl = (u?: string | null) => {
    if (!u) return null;
    const raw = u.startsWith('http') ? u : `${BASE_URL}${u}`;
    return `${raw}?t=${imageTimestamp}`;
  };
  const fullPhotoUrl = buildPhotoUrl(user?.photoUrl);
  const profileSource = fullPhotoUrl ? { uri: fullPhotoUrl } : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      overScrollMode="never"
      contentInsetAdjustmentBehavior="never"
      scrollIndicatorInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => router.push('/admin/tabs/admin-profile')}
        >
          {profileSource ? (
            <Image key={imageTimestamp} source={profileSource} style={styles.profilePic} />
          ) : (
            <View style={[styles.profilePic, styles.defaultAvatar]}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.headerText}>Welcome,</Text>
        <Text style={styles.boldHeaderText}>{user?.name || 'Admin'}!</Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>

      {/* ===== Main content ===== */}
      <View style={styles.cardWrapper}>
        {/* Quick Actions title */}
        <View style={styles.quickActionsRow}>
          <Text style={styles.sectionLabel}>
            <Text>📌 </Text>
            Quick Actions
          </Text>
        </View>

        {/* View Logs button below, left-aligned */}
        <TouchableOpacity
          style={styles.viewLogsButton}
          onPress={() => router.push('/admin/tabs/logs')}
          activeOpacity={0.9}
        >
          <Ionicons name="list-outline" size={16} color="#fff" style={styles.manageIcon} />
          <Text style={styles.viewLogsText}>View Logs</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Cards */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#deebd8ff' }]}
          onPress={goConnectGuided}
          activeOpacity={0.9}
        >
          <View style={styles.imageWrapper}>
            <Image source={sensorImg} style={styles.sensorImage} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#2e7d32' }]}>Connect to Sensor</Text>
            <Text style={[styles.cardSubtitle, { color: '#333' }]}>Measure NPK Soil</Text>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-forward" size={20} color="#2e7d32" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#5D9239' }]}
          onPress={() =>
            router.push({
              pathname: '/admin/tabs/add-farmer',
              params: { new: '1', ts: Date.now().toString() },
            })
          }
          activeOpacity={0.9}
        >
          <View style={styles.imageWrapper}>
            <Image source={farmerImg} style={styles.farmerImage} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#fff' }]}>Add a Farmer Data</Text>
            <Text style={[styles.cardSubtitle, { color: '#fff' }]}>Register a farmer</Text>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.lastCard, { backgroundColor: '#00691D' }]}
          onPress={() => router.push('./edit-price')}
          activeOpacity={0.9}
        >
          <View style={styles.imageWrapper}>
            <Image source={priceImg} style={styles.priceImage} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#fff' }]}>Edit Fertilizer Price</Text>
            <Text style={[styles.cardSubtitle, { color: '#fff' }]}>Modify fertilizer price</Text>
          </View>
          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingBottom: 0 },
  headerSection: {
    backgroundColor: '#0d5213ff',
    paddingTop: 70,
    paddingBottom: 16,
    paddingHorizontal: 23,
    borderBottomRightRadius: 125,
  },
  profileRow: { position: 'absolute', top: 72, right: 25 },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  defaultAvatar: { backgroundColor: '#999', justifyContent: 'center', alignItems: 'center' },
  headerText: { fontSize: 18, color: '#fff', marginBottom: 2 },
  boldHeaderText: { fontSize: 32, color: '#fff', fontWeight: '700' },
  dateText: { fontSize: 13, color: '#b7cab6ff' },

  cardWrapper: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 680,
  },

  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },

  viewLogsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    elevation: 2,
    marginTop: 2,
    marginBottom: 6,
  },
  manageIcon: { marginRight: 6 },
  viewLogsText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  divider: {
    height: 1.5,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    elevation: 9,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minHeight: 90,
  },
  lastCard: { marginBottom: 0 },
  imageWrapper: {
    width: 100,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sensorImage: { width: 100, height: 100, borderRadius: 10, resizeMode: 'cover' },
  farmerImage: { width: 120, height: 95, borderRadius: 10, resizeMode: 'cover' },
  priceImage: { width: 110, height: 72, borderRadius: 10, resizeMode: 'cover' },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, marginLeft: 4 },
  cardSubtitle: { fontSize: 14, marginLeft: 4 },
  arrowCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
