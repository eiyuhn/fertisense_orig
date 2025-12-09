// app/admin/tabs/connect-instructions.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

const ESP32_SSID = 'ESP32-NPK';      // 👈 change if your ESP32 uses a different SSID
// const ESP32_PASSWORD = '';        // only needed if your AP has a password

export default function ConnectInstructionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const farmerId = (params.farmerId as string) || '';
  const farmerName = (params.farmerName as string) || 'No Farmer Selected';

  const [isConnecting, setIsConnecting] = React.useState(false);

  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message: 'FertiSense needs location to scan and connect to your ESP32 Wi-Fi.',
        buttonPositive: 'OK',
      }
    );

    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Location permission denied');
    }
  };

  const ensureConnectedToESP32 = async () => {
    // 1) Android permission
    await requestLocationPermission();

    // 2) Check if already connected
    let currentSSID: string | null = null;
    try {
      currentSSID = await WifiManager.getCurrentWifiSSID();
    } catch (e) {
      // some Android versions throw here, we just ignore and continue
      currentSSID = null;
    }

    if (currentSSID === ESP32_SSID) {
      // already connected
      return;
    }

    // 3) Try to connect to ESP32 AP
    // If your AP is open (no password):
    await WifiManager.connectToSSID(ESP32_SSID);

    // If your AP has password, use this instead:
    // await WifiManager.connectToProtectedSSID(ESP32_SSID, ESP32_PASSWORD, false);
  };

  const handleStartReading = async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);

      // 🔗 First, ensure Wi-Fi is connected to the ESP32 AP
      await ensureConnectedToESP32();

      // ✅ After successful connection, go to select-options
      if (!farmerId) {
        router.replace('/admin/screens/select-options');
        return;
      }

      router.replace({
        pathname: '/admin/screens/select-options',
        params: { farmerId, farmerName },
      });
    } catch (error: any) {
      console.error('ESP32 connect error:', error?.message || error);
      Alert.alert(
        'Connection failed',
        'Hindi makakonekta sa sensor. Siguraduhing naka-ON ang device, at piliin sa Wi-Fi list ang "ESP32-NPK" kung lumabas ito.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCancel = () => {
    router.replace('/admin/tabs/logs');
  };

  const handleChangeFarmer = () => {
    // Just go back to previous screen where you chose the farmer
    router.back();
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

      {/* Farmer chip with "Change" option */}
      <View style={styles.farmerChip}>
        <Ionicons name="person-circle" size={18} color="#2e7d32" />
        <Text style={styles.farmerChipText}>Reading for: </Text>
        <Text style={styles.farmerChipName}>{farmerName}</Text>

        <TouchableOpacity onPress={handleChangeFarmer} style={styles.changeButton}>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Instruction card */}
      <View style={styles.card}>
        <Text style={styles.lead}>
          Bago makita ang datos, ikonekta muna ang device sa iyong cellphone.
        </Text>

        <InstructionRow icon="power" text="I-on ang iyong sensor device." />
        <InstructionRow icon="wifi" text="Buksan ang Wi-Fi / Location ng iyong cellphone." />
        <InstructionRow
          icon="swap-horizontal"
          text="Pindutin ang ‘Connect’ upang hanapin at kumonekta sa device."
        />
        <InstructionRow icon="leaf" text="Ilagay ang sensor sa lupa para sa susunod na hakbang." />
        <InstructionRow
          icon="checkmark-circle"
          text="Hintaying kumonekta o makita ang ‘Successful’ na status."
        />
      </View>

      {/* Connect button */}
      <TouchableOpacity
        style={[styles.cta, isConnecting && { opacity: 0.7 }]}
        onPress={handleStartReading}
        activeOpacity={0.85}
        disabled={isConnecting}
      >
        <Text style={styles.ctaText}>{isConnecting ? 'Connecting…' : 'Connect'}</Text>
      </TouchableOpacity>

      {/* Optional cancel button (if you want to use it somewhere) */}
      {/* 
      <TouchableOpacity style={[styles.cta, { backgroundColor: '#ccc', marginTop: 12 }]} onPress={handleCancel}>
        <Text style={[styles.ctaText, { color: '#333' }]}>Cancel</Text>
      </TouchableOpacity>
      */}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef7ef',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a5d6a7',
    marginBottom: 16,
  },
  farmerChipText: { fontSize: 12, color: '#455a64', marginRight: 4 },
  farmerChipName: { fontSize: 13, fontWeight: '700', color: '#1b5e20', marginRight: 8 },
  changeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#dcedc8',
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#33691e',
  },

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
