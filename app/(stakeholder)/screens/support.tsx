import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SupportScreen() {
  const router = useRouter();

  const openEmail = () => {
    Linking.openURL('mailto:fertisensecc@gmail.com?subject=Fertisense Support');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Header */}
      <Text style={styles.header}>Help & Support</Text>
      <Text style={styles.subHeader}>
        We're students building Fertisense with 💚 If you're having trouble, you're in the right place!
      </Text>

      {/* FAQs */}
      <Text style={styles.sectionTitle}>📖 Frequently Asked Questions</Text>

      <View style={styles.faqBox}>
        <Text style={styles.question}>❓ How do I connect my sensor?</Text>
        <Text style={styles.answer}>
          Go to the home screen and tap "Connect to Sensor". Follow the instructions provided.
        </Text>
      </View>

      <View style={styles.faqBox}>
        <Text style={styles.question}>❓ Why is there no data showing?</Text>
        <Text style={styles.answer}>
          Make sure the sensor is on and Bluetooth is enabled. Wait for a successful connection.
        </Text>
      </View>

      <View style={styles.faqBox}>
        <Text style={styles.question}>❓ What kind of fertilizer should I use?</Text>
        <Text style={styles.answer}>
          Once your sensor sends data, Fertisense will give you a tailored recommendation.
        </Text>
      </View>

      {/* Contact Us */}
      <Text style={styles.sectionTitle}>📬 Still need help?</Text>
      <Text style={styles.subHeader}>
        If something isn’t working or you have feedback, feel free to email us!
      </Text>

      <TouchableOpacity style={styles.emailButton} onPress={openEmail}>
        <Ionicons name="mail" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.emailText}>Contact Support</Text>
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        Thank you for using Fertisense — your support means a lot to us as students!
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  subHeader: {
    fontSize: 15,
    color: '#555',
    marginBottom: 25,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  faqBox: {
    backgroundColor: '#f1f8e9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c5e1a5',
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#33691e',
    marginBottom: 6,
    fontFamily: 'Poppins_500Medium',
  },
  answer: {
    fontSize: 14,
    color: '#444',
    fontFamily: 'Poppins_400Regular',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  emailText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
  },
  footerNote: {
    fontSize: 13,
    color: '#888',
    marginTop: 30,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Poppins_400Regular',
  },
});
