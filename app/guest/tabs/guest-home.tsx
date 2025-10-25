import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const getFormattedDate = () => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  } as const;
  return new Date().toLocaleDateString('en-PH', options);
};

export default function GuestHome() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={['#6d4c41', '#4e342e']} style={styles.headerSection}>
        {/* Quit button */}
        <View style={styles.quitWrapper}>
          <Pressable onPress={() => router.replace('/')}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.quitText}>Sign Out</Text>
              <Ionicons name="exit-outline" size={22} color="#fff8e1" style={{ marginLeft: 4 }} />
            </View>
          </Pressable>
        </View>

        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.headerText}>
          Welcome,
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.boldHeaderText}>
          Guest 🌱
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.dateText}>
          {getFormattedDate()}
        </Animated.Text>
      </LinearGradient>

      {/* BODY */}
      <View style={styles.cardWrapper}>
        {/* CONNECT TO SENSOR */}
        <Text style={styles.sectionLabel}>⚡ Quick Action</Text>
        <Animated.View entering={FadeInUp.delay(500).springify()}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: '#e6f4ea' }]}
            onPress={() => router.push('/guest/tabs/connect-instructions')}
          >
            <View style={styles.iconWrapper}>
              <Image
                source={require('../../../assets/images/connect-sensor.png')}
                style={styles.sensorImage}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: '#2e7d32' }]}>Connect to Sensor</Text>
              <Text style={styles.cardSubtitle}>
                Measure soil NPK and preview fertilizer recommendations.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#2e7d32" />
          </TouchableOpacity>
        </Animated.View>

        {/* FERTILIZER GUIDES */}
        <Text style={styles.sectionLabel}>📖 Fertilizer Guides</Text>
        <Animated.View entering={FadeInUp.delay(700).springify()}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: '#fff3e0' }]}
            onPress={() => router.push('/guest/screens/fertilizer-guides')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="book-outline" size={40} color="#ef6c00" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: '#e65100' }]}>Fertilizer Guides</Text>
              <Text style={styles.cardSubtitle}>
                Learn how to avoid overfertilization and apply just the right amount.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#e65100" />
          </TouchableOpacity>
        </Animated.View>

        {/* HELP & SUPPORT */}
        <Text style={styles.sectionLabel}>❓ Help & Support</Text>
        <Animated.View entering={FadeInUp.delay(900).springify()}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: '#e3f2fd' }]}
            onPress={() => router.push('/guest/screens/help')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name="help-circle-outline" size={40} color="#1565c0" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: '#1565c0' }]}>Need Help?</Text>
              <Text style={styles.cardSubtitle}>View FAQs or contact support.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#1565c0" />
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 60 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff' },
  headerSection: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 23,
    borderBottomRightRadius: 100,
    alignItems: 'flex-start',
  },
  // Quit styles
  quitWrapper: {
    position: 'absolute',
    top: 62,
    right: 20,
    zIndex: 10,
  },
  quitText: {
    fontSize: 14,
    color: '#fff8e1',
    fontFamily: 'Poppins_500Medium',
  },
  headerText: { fontSize: 20, color: '#f5f5f5', fontFamily: 'Poppins_400Regular' },
  boldHeaderText: { fontSize: 31, color: '#fff8e1', fontFamily: 'Poppins_700Bold' },
  dateText: { fontSize: 13, color: '#d7ccc8', fontFamily: 'Poppins_400Regular', marginTop: 4 },
  cardWrapper: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#3e2723',
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
  sensorImage: { width: 90, height: 90, bottom: -4.5, resizeMode: 'contain' },
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', marginBottom: 3 },
  cardSubtitle: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#444' },
});