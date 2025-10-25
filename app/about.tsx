// app/about.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.topArc} />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/admin/tabs/admin-profile')}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About FertiSense</Text>
        <Text style={styles.subtitle}>
          Empowering agriculture with smart fertilizer management.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>What is FertiSense?</Text>
          <Text style={styles.text}>
            FertiSense is a mobile app that helps farmers determine the right fertilizer to use based on actual soil conditions.
            By connecting to a sensor device, the app measures the levels of Nitrogen (N), Phosphorus (P), Potassium (K), and soil moisture.
          </Text>
          <Text style={styles.text}>
            You'll receive fertilizer recommendations based on the measured results — no more guessing what to apply in your field.
          </Text>
          <Text style={styles.text}>
            No account is needed. Simply tap "Guest Log In" and start analyzing soil right away.
          </Text>
          <Text style={styles.text}>
            This app aims to help Filipino farmers save on fertilizer, avoid overuse, and improve their harvests.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Ano ang FertiSense?</Text>
          <Text style={styles.text}>
            Ang FertiSense ay isang mobile app na tumutulong sa mga magsasaka na malaman ang tamang abono na dapat gamitin base sa aktwal na kalagayan ng lupa.
            Sa pamamagitan ng koneksyon sa sensor device, sinusukat ng app ang antas ng Nitrogen (N), Phosphorus (P), Potassium (K), at halumigmig ng lupa (soil moisture).
          </Text>
          <Text style={styles.text}>
            Makakatanggap ka ng rekomendasyon ng abono base sa resulta ng sukat, kaya hindi mo na kailangang hulaan kung ano ang dapat ilagay sa palayan.
          </Text>
          <Text style={styles.text}>
            Hindi mo na kailangan ng account. Pindutin lang ang "Guest Log In" at maaari ka nang magsukat agad ng lupa.
          </Text>
          <Text style={styles.text}>
            Layunin ng app na makatulong sa mga magsasakang Pilipino na makatipid sa abono, maiwasan ang sobrang paggamit, at mapaganda ang ani.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.footer}>
            Version: 1.0.0{"\n"}
            Developed by: FertiSense Team{"\n"}
            Year: 2025
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topArc: {
    height: 100,
    backgroundColor: '#2e7d32',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'absolute',
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 55,
    left: 20,
    zIndex: 10,
  },
  content: {
    paddingTop: 120,
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#f1f8f2',
    padding: 20,
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
    marginTop: 20,
  },
  text: {
    fontSize: 15,
    color: '#333',
    marginBottom: 14,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#b5d8b8',
    marginVertical: 20,
  },
  footer: {
    fontSize: 13,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
});
