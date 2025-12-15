// =============================================================
// File: app/(stakeholder)/tabs/stakeholder-home.tsx
// Purpose: Stakeholder home screen with quick actions.
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { BASE_URL } from '../../../src/api';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const sensorImg = require('../../../assets/images/connect-sensor.png');

const getFormattedDate = () => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  } as const;
  return new Date().toLocaleDateString('en-PH', options);
};

type StakeholderReading = {
  timestamp: string | number;
  n: number;
  p: number;
  k: number;
  ph?: number | null;
};

export default function StakeholderHome() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    (user as any)?.photoUrl || null
  );
  const [imgKey, setImgKey] = useState<number>(Date.now());

  const [lastReading, setLastReading] = useState<StakeholderReading | null>(
    null
  );

  // Refresh profile + last reading whenever this tab is focused
  useFocusEffect(
    useCallback(() => {
      const url = (user as any)?.photoUrl || null;
      setProfileImageUrl(url);
      setImgKey(Date.now());

      let isActive = true;

      const loadLastReading = async () => {
        if (!user?._id) {
          if (isActive) setLastReading(null);
          return;
        }
        const key = `stakeholder:lastReading:${user._id}`;
        try {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) {
            if (isActive) setLastReading(null);
            return;
          }
          const parsed = JSON.parse(raw);
          if (isActive && parsed && typeof parsed === 'object') {
            setLastReading(parsed as StakeholderReading);
          }
        } catch (e) {
          console.warn('[stakeholder-home] loadLastReading error:', e);
          if (isActive) setLastReading(null);
        }
      };

      loadLastReading();

      return () => {
        isActive = false;
      };
    }, [user?._id])
  );

  const buildPhotoUrl = (u?: string | null) => {
    if (!u) return null;
    const raw = u.startsWith('http') ? u : `${BASE_URL}${u}`;
    return `${raw}?t=${imgKey}`;
  };
  const fullPhotoUrl = buildPhotoUrl(profileImageUrl);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 120, // 👈 enough space for tab bar + last card
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.headerText}>Welcome,</Text>
              <Text style={styles.boldHeaderText}>
                {user?.name || 'Stakeholder'}!
              </Text>
              <Text style={styles.dateText}>{getFormattedDate()}</Text>
            </View>

            {/* Profile avatar → Profile screen */}
            <TouchableOpacity
              style={styles.profileContainer}
              onPress={() =>
                router.push('/(stakeholder)/tabs/stakeholder-profile')
              }
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {fullPhotoUrl ? (
                <Image
                  key={imgKey}
                  source={{ uri: fullPhotoUrl }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.defaultAvatarStyle}>
                  <Ionicons name="person" size={30} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* BODY */}
        <View style={styles.cardWrapper}>
          <SectionLabel text="📌 Available Actions" />
          <ActionCard
            color="#e6f4ea"
            icon={<Image source={sensorImg} style={styles.sensorImage} />}
            title="Connect to Sensor"
            subtitle="Measure NPK Soil"
            onPress={() =>
              router.push('/(stakeholder)/tabs/connect-instructions')
            }
            iconColor="#2e7d32"
          />

          <SectionLabel text="📊 Farm Insights" />
          {lastReading ? (
            <InfoCard
              color="#fce4ec"
              imageUri="https://cdn-icons-png.flaticon.com/512/2906/2906278.png"
              title={`Latest Reading: ${new Date(
                lastReading.timestamp
              ).toLocaleString('en-PH')}`}
              subtitle={`N: ${lastReading.n} | P: ${lastReading.p} | K: ${
                lastReading.k
              }${
                lastReading.ph !== undefined && lastReading.ph !== null
                  ? ` | pH: ${lastReading.ph}`
                  : ''
              }`}
            />
          ) : (
            <InfoCard
              color="#fce4ec"
              imageUri="https://cdn-icons-png.flaticon.com/512/2906/2906278.png"
              title="No sensor data yet"
              subtitle="Once you connect your sensor and get readings, insights will appear here."
              buttonLabel="📡 Connect Sensor"
              onButtonPress={() =>
                router.push('/(stakeholder)/tabs/connect-instructions')
              }
            />
          )}

          <SectionLabel text="❓ Help & Support" />
          <ActionCard
            color="#e3f2fd"
            icon={
              <Ionicons
                name="help-circle-outline"
                size={40}
                color="#1565c0"
              />
            }
            title="Need Help?"
            subtitle="View FAQs or contact support."
            onPress={() => router.push('/(stakeholder)/screens/support')}
            iconColor="#1565c0"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Reusable Section Label */
const SectionLabel = ({ text }: { text: string }) => (
  <Text style={styles.sectionLabel}>{text}</Text>
);

/* Reusable Action Card */
const ActionCard = ({
  color,
  icon,
  title,
  subtitle,
  onPress,
  iconColor,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  iconColor: string;
}) => (
  <TouchableOpacity
    style={[styles.card, { backgroundColor: color }]}
    onPress={onPress}
  >
    <View style={styles.iconWrapper}>{icon}</View>
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, { color: iconColor }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: '#444' }]}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={22} color={iconColor} />
  </TouchableOpacity>
);

/* Reusable Info Card */
const InfoCard = ({
  color,
  imageUri,
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
}: {
  color: string;
  imageUri?: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}) => (
  <View style={[styles.infoBox, { backgroundColor: color }]}>
    {imageUri && <Image source={{ uri: imageUri }} style={styles.emptyImage} />}
    <Text style={styles.infoText}>{title}</Text>
    {subtitle && <Text style={styles.subInfoText}>{subtitle}</Text>}
    {buttonLabel && onButtonPress && (
      <TouchableOpacity style={styles.ctaButton} onPress={onButtonPress}>
        <Text style={styles.ctaText}>{buttonLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1, // 👈 allows scrolling when content is taller than screen
    backgroundColor: '#fff',
  },

  headerSection: {
    backgroundColor: '#0d5213',
    paddingTop: 40,
    paddingBottom: 25,
    paddingHorizontal: 23,
    borderBottomRightRadius: 100,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeTextContainer: { flexShrink: 1 },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarStyle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#388e3c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  headerText: {
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Poppins_400Regular',
    lineHeight: 28,
  },
  boldHeaderText: {
    fontSize: 31,
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
    lineHeight: 34,
  },
  dateText: {
    fontSize: 13,
    color: '#cde6d4',
    fontFamily: 'Poppins_400Regular',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
  },

  cardWrapper: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#000',
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  iconWrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sensorImage: {
    width: 90,
    height: 90,
    bottom: -4.5,
    resizeMode: 'contain',
  },
  cardContent: {
    paddingLeft: 13,
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },

  infoBox: {
    padding: 20,
    borderRadius: 18,
    marginBottom: 25,
    alignItems: 'center',
    elevation: 2,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subInfoText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Poppins_400Regular',
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  emptyImage: {
    width: 80,
    height: 100,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: '#2e7d32',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
});
