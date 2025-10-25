import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      question: 'How do I connect my device to the app?',
      answer:
        'Go to “Connect to Sensor”, turn on your Bluetooth, and press Connect. Make sure your IoT device is powered on and within range.',
    },
    {
      question: 'Why am I not getting any readings?',
      answer:
        'Ensure the sensor is properly inserted into the soil and connected. You may need to restart the device if it disconnects.',
    },
    {
      question: 'Can I use the app without an internet connection?',
      answer:
        'Yes, you can still take readings offline. However, saving or syncing your logs requires internet access.',
    },
    {
      question: 'What do I do if fertilizer recommendations seem inaccurate?',
      answer:
        'The readings depend on your soil type and calibration. Double-check your sensor placement and soil depth for best results.',
    },
    {
      question: 'How often should I recalibrate the sensor?',
      answer:
        'For accuracy, recalibrate your IoT sensor every planting season or when soil conditions change significantly.',
    },
  ];

  // Filter FAQs by search
  const filteredFaqs = faqs.filter((item) =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Help & Support</Text>
        <Text style={styles.subText}>Find answers or contact us for assistance</Text>
      </View>

      {/* BODY */}
      <ScrollView contentContainerStyle={styles.body}>
        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#666" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search for help..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* FAQ SECTION */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((item, index) => (
            <Animated.View key={index} entering={FadeInUp.delay(100 * index).springify()}>
              <TouchableOpacity
                style={styles.faqCard}
                onPress={() => toggleExpand(index)}
                activeOpacity={0.8}
              >
                <View style={styles.faqRow}>
                  <Text style={styles.question}>{item.question}</Text>
                  <Ionicons
                    name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#2e7d32"
                  />
                </View>

                {expandedIndex === index && (
                  <Animated.View entering={FadeInDown.springify()}>
                    <Text style={styles.answer}>{item.answer}</Text>
                  </Animated.View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        ) : (
          <Text style={styles.noResultsText}>No results found for “{searchQuery}”.</Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FLOATING BUTTON */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <Ionicons name="mail-outline" size={28} color="#fff" />
      </TouchableOpacity>

      {/* MODAL */}
      <Modal
        transparent
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Support</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setModalVisible(false);
                console.log('Email us pressed');
                Alert.alert(
                  'Contact Support',
                  'This would open the email app of the user in the final version.'
                );
              }}
            >
              <Ionicons name="mail-outline" size={24} color="#2e7d32" />
              <Text style={styles.modalText}>Email Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, { marginTop: 10 }]}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close-outline" size={24} color="#b71c1c" />
              <Text style={[styles.modalText, { color: '#b71c1c' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#2e7d32',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 22,
    borderBottomRightRadius: 100,
  },
  backButton: {
    position: 'absolute',
    top: 65,
    left: 20,
  },
  headerText: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginTop: 50,
  },
  subText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#e8f5e9',
    marginTop: 2,
  },
  body: { padding: 20, paddingBottom: 100 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f8e9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: -10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#05a20aff',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: '#f9fbe7',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dcedc8',
    elevation: 2,
  },
  faqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  question: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#33691e',
    flex: 1,
    marginRight: 8,
  },
  answer: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#444',
    lineHeight: 20,
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#888',
    marginTop: 10,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    backgroundColor: '#2e7d32',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#2e7d32',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
    color: '#2e7d32',
    marginLeft: 10,
  },
});