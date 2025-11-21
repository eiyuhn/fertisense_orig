// app/admin/screens/reconnect-prompt.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';

type Params = {
  farmerId?: string;
  name?: string;
  n?: string;
  p?: string;
  k?: string;
  ph?: string;
};

export default function AdminReconnectPromptScreen() {
  const router = useRouter();
  const { farmerId, name, n, p, k, ph } = useLocalSearchParams<Params>();

  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  const goToRecommendation = useCallback(() => {
    // ⛳️ Adjust this path if your admin recommendation file has another route
    router.replace({
      pathname: '/admin/screens/recommendation',
      params: {
        farmerId: farmerId ?? '',
        name: name ?? '',
        n: n ?? '0',
        p: p ?? '0',
        k: k ?? '0',
        ph: ph ?? '0',
      },
    });
  }, [router, farmerId, name, n, p, k, ph]);

  const checkConnectionOnce = useCallback(async () => {
    setChecking(true);
    try {
      const state = await NetInfo.fetch();
      const online =
        !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        goToRecommendation();
      }
    } catch (err) {
      console.error('NetInfo error:', err);
      Alert.alert(
        'Network Check Failed',
        'Hindi ma-check ang internet connection. Subukan ulit.'
      );
    } finally {
      setChecking(false);
    }
  }, [goToRecommendation]);

  useEffect(() => {
    // initial check + subscribe
    checkConnectionOnce();

    const unsub = NetInfo.addEventListener((state) => {
      const online =
        !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        goToRecommendation();
      }
    });

    return () => unsub();
  }, [checkConnectionOnce, goToRecommendation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
      />
      <View style={styles.card}>
        <Text style={styles.title}>Reconnect to Internet</Text>
        <Text style={styles.subtitle}>
          Step 2 of 2 – Tapos na ang pagbabasa sa ESP32-NPK.
        </Text>
        <Text style={styles.body}>
          1. Lumabas sa <Text style={styles.bold}>ESP32-NPK</Text>{' '}
          Wi-Fi.{'\n'}
          2. Kumonekta sa{' '}
          <Text style={styles.bold}>normal Wi-Fi</Text> o{' '}
          <Text style={styles.bold}>mobile data</Text>.{'\n'}
          3. Kapag may internet na, automatic kang dadalhin sa
          fertilizer recommendation page.
        </Text>

        <View style={styles.statusBox}>
          <Ionicons
            name={isOnline ? 'cloud-done' : 'cloud-offline'}
            size={28}
            color={isOnline ? '#2e7d32' : '#d32f2f'}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.statusText}>
              Status:{' '}
              <Text style={styles.bold}>
                {isOnline ? 'Online' : 'Walang internet'}
              </Text>
            </Text>
            <Text style={styles.statusSub}>
              {checking
                ? 'Checking connection...'
                : isOnline
                ? 'Internet OK, loading recommendation...'
                : 'Pakisigurong nakabalik na sa Wi-Fi / data.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={checkConnectionOnce}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="wifi"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.buttonText}>
                I’m Connected – Check Again
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={goToRecommendation}
        >
          <Text style={styles.secondaryText}>
            Skip check (I know I’m online)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: -10,
  },
  card: {
    width: '100%',
    backgroundColor: '#f5fbf5',
    borderRadius: 18,
    padding: 22,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2e7d32',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 14,
    color: '#333',
    marginBottom: 18,
    lineHeight: 20,
  },
  bold: { fontWeight: '700' },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
  },
  statusText: { fontSize: 14, color: '#2e7d32' },
  statusSub: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#2e7d32',
    fontSize: 13,
    fontWeight: '600',
  },
});
