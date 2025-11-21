// app/admin/tabs/connect-instructions.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

export default function ConnectInstructionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const farmerId = (params.farmerId as string) || '';
  const farmerName = (params.farmerName as string) || 'No Farmer Selected';

  const handleStartReading = () => {
    if (!farmerId) {
      router.replace('/admin/screens/select-options');
      return;
    }
    // ✅ FUNCTIONALITY RETAINED
    router.replace({
      pathname: '/admin/screens/select-options',
      params: { farmerId, farmerName },
    });
  };

  const handleCancel = () => {
    router.replace('/admin/tabs/logs');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
     

      {/* Logo */}
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={styles.title}>Connect to Device</Text>

      {/* Farmer chip (kept) */}
      <View style={styles.farmerChip}>
        <Ionicons name="person-circle" size={18} color="#2e7d32" />
        <Text style={styles.farmerChipText}>Reading for: </Text>
        <Text style={styles.farmerChipName}>{farmerName}</Text>
      </View>

      {/* Instruction card */}
      <View style={styles.card}>
        <Text style={styles.lead}>
          Bago makita ang datos, ikonekta muna ang device sa iyong cellphone.
        </Text>

        <InstructionRow icon="power" text="I-on ang iyong sensor device." />
        <InstructionRow icon="wifi" text="Buksan ang Wi-Fi / Location ng iyong cellphone." />
        <InstructionRow icon="swap-horizontal" text="Pindutin ang ‘Connect’ upang hanapin ang device." />
        <InstructionRow icon="leaf" text="Ilagay ang sensor sa lupa para sa susunod na hakbang." />
        <InstructionRow icon="checkmark-circle" text="Hintaying kumonekta o makita ang ‘Successful’ na status." />
      </View>

      {/* Connect button */}
      <TouchableOpacity style={styles.cta} onPress={handleStartReading} activeOpacity={0.85}>
        <Text style={styles.ctaText}>Connect</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InstructionRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.bullet}>
        <Ionicons name={icon} size={20} color="#2e7d32" />
      </View>
      <Text style={rowStyles.text}>{text}</Text>
    </View>
  );
}

const GREEN = '#2e7d32';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 40, alignItems: 'center' },
  back: {
    position: 'absolute',
    top: 22,
    left: 16,
    zIndex: 10,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    elevation: 2,
  },
  logo: { width: 200, height: 70, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: GREEN, marginBottom: 16 },
  farmerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef7ef',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a5d6a7',
    marginBottom: 16,
  },
  farmerChipText: { fontSize: 12, color: '#455a64' },
  farmerChipName: { fontSize: 13, fontWeight: '700', color: '#1b5e20' },

  card: {
    width: '100%',
    backgroundColor: '#f7fbf7',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: GREEN,
    padding: 18,
    marginBottom: 28,
  },
  lead: {
    fontSize: 14,
    color: '#2b2b2b',
    lineHeight: 20,
    marginBottom: 14,
    textAlign: 'center',
  },

  cta: {
    width: '90%',
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f2e8',
    marginRight: 10,
  },
  text: { flex: 1, fontSize: 14, color: '#333', lineHeight: 20 },
});
