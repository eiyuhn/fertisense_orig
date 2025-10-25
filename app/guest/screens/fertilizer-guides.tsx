// app/guest/screens/fertilizer-guides.tsx
import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Type-safe icon name for Ionicons
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Nutrient = {
  id: string;
  title: string;
  desc: string;
  color: string;
  icon: IconName;
  textColor: string;
};

export default function FertilizerGuidesScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  if (!fontsLoaded) return null;

  const nutrients: Nutrient[] = [
    {
      id: '1',
      title: 'Nitrogen (N)',
      desc: 'Encourages leafy growth 🌱. Too much can cause excessive leaves, less grains.',
      color: '#E8F5E9',
      icon: 'leaf-outline',
      textColor: '#2E7D32',
    },
    {
      id: '2',
      title: 'Phosphorus (P)',
      desc: 'Helps roots and early growth 🌾. Apply during planting for best results.',
      color: '#FBE9E7',
      icon: 'trending-up-outline',
      textColor: '#BF360C',
    },
    {
      id: '3',
      title: 'Potassium (K)',
      desc: 'Improves strength and grain quality 💪. Important before flowering.',
      color: '#E3F2FD',
      icon: 'shield-checkmark-outline',
      textColor: '#1565C0',
    },
    {
      id: '4',
      title: '💡 Tip',
      desc: 'Balance matters — overuse harms soil, underuse weakens crops!',
      color: '#FFFDE7',
      icon: 'bulb-outline',
      textColor: '#F9A825',
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fertilizer Guides</Text>
      </View>

      {/* Intro */}
      <View style={styles.introCard}>
        <Ionicons name="information-circle-outline" size={24} color="#2E7D32" />
        <Text style={styles.introText}>
          Many farmers in Valencia, Bukidnon face challenges with applying too
          much or too little fertilizer. This guide helps you apply the right
          type, amount, and timing — for healthier soil and better yields 🌾.
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.sectionDivider}>
        <Ionicons name="flask-outline" size={20} color="#000" />
        <Text style={styles.dividerText}> Essential Nutrients </Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Swipe Nutrients */}
      <FlatList
        data={nutrients}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.nutrientCard, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon} size={28} color={item.textColor} />
            <Text style={[styles.nutrientTitle, { color: item.textColor }]}>{item.title}</Text>
            <Text style={styles.nutrientDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Divider */}
      <View style={styles.sectionDivider}>
        <Ionicons name="time-outline" size={20} color="#000" />
        <Text style={styles.dividerText}> Right Amount & Timing </Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Timing */}
      <View style={styles.timingBox}>
        <View style={styles.timingStep}>
          <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
          <Text style={styles.timingText}>
            <Text style={styles.bold}>Basal Application:</Text> During transplanting or early growth.
          </Text>
        </View>
        <View style={styles.timingStep}>
          <Ionicons name="water-outline" size={20} color="#2E7D32" />
          <Text style={styles.timingText}>
            <Text style={styles.bold}>Mid-Tillering:</Text> Apply balanced NPK when leaves start multiplying.
          </Text>
        </View>
        <View style={styles.timingStep}>
          <Ionicons name="flower-outline" size={20} color="#2E7D32" />
          <Text style={styles.timingText}>
            <Text style={styles.bold}>Before Flowering:</Text> Add Potassium for stronger stems and fuller grains.
          </Text>
        </View>
      </View>

      {/* Best Practices (expand) */}
      <TouchableOpacity
        style={[styles.expandHeader, expanded && styles.expandHeaderActive]}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.expandTitle, expanded ? { color: '#fff' } : { color: '#3E2723' }]}>
          Best Practices
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={expanded ? '#fff' : '#3E2723'} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandContent}>
          {[
            'Test your soil before applying fertilizer.',
            'Avoid applying before heavy rain to prevent waste.',
            'Follow the “4Rs”: Right Source, Right Rate, Right Time, Right Place.',
            'Rotate crops and use organic matter to enrich soil.',
          ].map((t, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={18} color="#3E2723" />
              <Text style={styles.bulletText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Reminder */}
      <View style={styles.reminderCard}>
        <Ionicons name="warning-outline" size={22} color="#F57C00" />
        <Text style={styles.reminderText}>
          💬 Remember: The ideal amount of fertilizer depends on soil type,
          rainfall, and crop variety. Always check soil health for sustainable farming.
        </Text>
      </View>

      {/* CTA (use absolute route; your folder is /guest not /(guest)) */}
      <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/guest/tabs/connect-instructions')}>
        <Text style={styles.ctaText}>🌿 Learn More with FertiSense</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', flexGrow: 1, paddingBottom: 60 },
  header: {
    width: '100%', backgroundColor: '#2E7D32', paddingTop: 60, paddingBottom: 40,
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center', paddingHorizontal: 20,
  },
  backButton: { position: 'absolute', top: 55, left: 20 },
  headerTitle: { fontSize: 22, color: '#fff', fontFamily: 'Poppins_700Bold' },
  introCard: { backgroundColor: '#F1F8E9', borderRadius: 14, margin: 20, padding: 16, flexDirection: 'row', gap: 10 },
  introText: { flex: 1, fontSize: 14, color: '#333', fontFamily: 'Poppins_400Regular' },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 15, marginHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#BDBDBD', marginLeft: 10 },
  dividerText: { fontSize: 16, color: '#000', fontFamily: 'Poppins_600SemiBold', marginLeft: 8 },
  nutrientCard: { width: 230, borderRadius: 16, padding: 16, marginRight: 15, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  nutrientTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', marginTop: 10 },
  nutrientDesc: { fontSize: 13, color: '#555', marginTop: 5, fontFamily: 'Poppins_400Regular' },
  timingBox: { backgroundColor: '#E8F5E9', marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 15 },
  timingStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  timingText: { marginLeft: 10, fontSize: 14, color: '#444', fontFamily: 'Poppins_400Regular' },
  bold: { fontFamily: 'Poppins_600SemiBold' },
  expandHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 25, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#D7CCC8',
  },
  expandHeaderActive: { backgroundColor: '#6D4C41', borderColor: '#5D4037' },
  expandTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  expandContent: { marginHorizontal: 25, marginTop: 15 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bulletText: { marginLeft: 10, fontSize: 13, color: '#444', fontFamily: 'Poppins_400Regular' },
  reminderCard: { backgroundColor: '#FFF8E1', marginHorizontal: 20, marginTop: 25, borderRadius: 14, padding: 16, flexDirection: 'row', gap: 10 },
  reminderText: { flex: 1, fontSize: 13, color: '#5D4037', fontFamily: 'Poppins_400Regular' },
  ctaButton: { marginTop: 35, alignSelf: 'center', backgroundColor: '#2E7D32', paddingVertical: 15, paddingHorizontal: 35, borderRadius: 40, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  ctaText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 15, textAlign: 'center' },
});
