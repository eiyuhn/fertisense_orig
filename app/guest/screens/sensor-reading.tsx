import React, { useEffect, useState } from 'react';

// --- Mocks for missing imports ---

// Mock React Native components with web equivalents
const View = ({ style, children }: { style?: any; children: React.ReactNode }) => <div style={style}>{children}</div>;
const Text = ({ style, children }: { style?: any; children: React.ReactNode }) => <p style={style}>{children}</p>;
const Image = ({ style, source }: { style?: any; source: { uri: string } }) => <img style={style} src={source.uri} alt="logo" />;
const TouchableOpacity = ({ style, children, onPress }: { style?: any; children: React.ReactNode; onPress: () => void }) => (
  <button style={{ ...style, cursor: 'pointer', border: 'none', background: 'none' }} onClick={onPress}>
    {children}
  </button>
);
const ActivityIndicator = ({ style }: { style?: any }) => <div style={{...style, display: 'inline-block', border: '4px solid rgba(0, 0, 0, 0.1)', borderLeftColor: '#2e7d32', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite'}}></div>;

// Mock Ionicons
const Ionicons = ({ name, size, color }: { name: string; size: number; color: string }) => {
  let icon = '❓';
  if (name === 'checkmark-circle') icon = '✅';
  if (name === 'hardware-chip-outline') icon = '🎛️';
  return <span style={{ fontSize: size, color: color, verticalAlign: 'middle' }}>{icon}</span>;
};

// Mock the Alert API
const Alert = {
  alert: (title: string, message: string) => {
    console.warn(`ALERT: ${title} - ${message}`);
    // In a real web app, you'd use a modal here, not window.alert
    // window.alert(`${title}\n\n${message}`); 
  },
};

// Mock functions from external files
const autoConnectToESP32 = async () => {
  console.log('Mock: autoConnectToESP32() called');
  // Simulate a delay
  await new Promise(res => setTimeout(res, 500));
};

const readNpkFromESP32 = async () => {
  console.log('Mock: readNpkFromESP32() called');
  // Simulate a delay and return mock data
  await new Promise(res => setTimeout(res, 500));
  const mockData = {
    ok: true,
    ts: Date.now(),
    ec: 120 + Math.floor(Math.random() * 50),
    n: 50 + Math.floor(Math.random() * 20),
    p: 20 + Math.floor(Math.random() * 10),
    k: 30 + Math.floor(Math.random() * 10),
    ph: 6.0 + Math.random(),
  };
  return mockData;
};

// Mock context
const useReadingSession = () => ({
  setResult: (result: any) => {
    console.log('Mock: setResult called with:', result);
  },
});

// Mock router
const useRouter = () => ({
  push: (path: string) => {
    console.log(`Mock: router.push to ${path}`);
    // In a real web app, you might use window.location.href
  },
});
// --- End of Mocks ---


export default function SensorReadingScreen() {
  const router = useRouter();
  const { setResult } = useReadingSession();

  const [currentStep, setCurrentStep] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [readings, setReadings] = useState<any[]>([]);

  const doOneRead = async () => {
    try {
      if (currentStep === 0) await autoConnectToESP32();
      const res: any = await readNpkFromESP32();
      if (!res?.ok) throw new Error(res?.error || 'No data');
      return res;
    } catch (err: any) {
      const message = (err instanceof Error) ? err.message : 'Failed to read from ESP32';
      throw new Error(message);
    }
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isReading && currentStep < 10) {
      timeout = setTimeout(async () => {
        try {
          const r = await doOneRead();
          const newReadings = [...readings, r];
          setReadings(newReadings);
          setCurrentStep((s) => s + 1);

          if (newReadings.length === 10) {
            const arr = newReadings;
            const avg = (k: string) =>
              arr.reduce((a: number, v: any) => a + Number(v[k] || 0), 0) /
              arr.length;

            const N = +avg('n').toFixed(1);
            const P = +avg('p').toFixed(1);
            const K = +avg('k').toFixed(1);
            const pH = +avg('ph').toFixed(1);

            setReadings([]);
            setIsComplete(true);
            setResult({ n: N, p: P, k: K, ph: pH, ts: Date.now() });

            setTimeout(() => {
              router.push('/guest/screens/recommendation');
            }, 1200);
          }
        } catch (err: any) {
          const message = (err instanceof Error) ? err.message : 'Please connect to ESP32-NPK Wi-Fi before reading.';
          Alert.alert(
            'Connection Error',
            message
          );
          setIsReading(false);
          setCurrentStep(0);
        }
      }, 1000);
    }
    return () => clearTimeout(timeout);
  }, [isReading, currentStep, router, setResult, readings]);

  const handleStart = () => {
    setReadings([]);
    setIsReading(true);
    setCurrentStep(0);
  };

  // Mock placeholder for the image
  const logoSource = { uri: 'https://placehold.co/220x220/ffffff/2e7d32?text=FertiSense&font=inter' };

  return (
    <View style={styles.container}>
      <Image
        source={logoSource}
        style={styles.logo}
      />
      <View style={styles.readingBox}>
        <Text style={styles.title}>Insert the Sensor into the Soil</Text>
        <Text style={styles.engSub}>
          The system will take 10 readings from different soil spots, including
          pH level.
        </Text>
        <Text style={styles.tagalogSub}>
          Kukuha ang sistema ng 10 readings mula sa iba't ibang bahagi ng lupa,
          kabilang ang pH level.
        </Text>

        {isReading && currentStep <= 10 && (
          <>
            <ActivityIndicator style={{ marginTop: 20, marginBottom: 12 }} />
            <Text style={styles.readingStep}>
              📍 {currentStep}/10 - Reading soil...
            </Text>
          </>
        )}

        {isComplete && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={50} color="#2e7d32" />
            <Text style={styles.successText}>
              Success! Completed soil reading. Please wait for
              recommendation...
            </Text>
          </View>
        )}
      </View>

      {!isReading && !isComplete && (
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
          <span style={styles.startText}>  Simulan ang Pagbasa</span>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Converted StyleSheet to plain CSS-in-JS objects for web
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
    alignItems: 'center',
    paddingTop: 60,
    paddingLeft: 24,
    paddingRight: 24,
    justifyContent: 'flex-start',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box' as 'border-box',
    width: '100%',
    maxWidth: '400px',
    margin: '0 auto',
  },
  logo: {
    bottom: 12,
    width: 220,
    height: 220,
    objectFit: 'contain' as 'contain',
    marginBottom: -30,
  },
  readingBox: {
    backgroundColor: '#f1fbf1',
    padding: 26,
    borderRadius: 18,
    width: '100%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    alignItems: 'center',
    boxSizing: 'border-box' as 'border-box',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center' as 'center',
    marginBottom: 20,
    marginTop: 0,
  },
  engSub: { fontSize: 15, color: '#555', textAlign: 'center' as 'center', margin: 0 },
  tagalogSub: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center' as 'center',
    fontStyle: 'italic',
    marginBottom: 20,
    marginTop: 6,
  },
  readingStep: { fontSize: 16, color: '#2e7d32', textAlign: 'center' as 'center', margin: 0 },
  successBox: {
    backgroundColor: '#d1f7d6',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    boxSizing: 'border-box' as 'border-box',
  },
  successText: {
    fontSize: 15,
    color: '#1b5e20',
    textAlign: 'center' as 'center',
    marginTop: 12,
    marginBlock: 0,
  },
  startButton: {
    marginTop: 28,
    backgroundColor: '#2e7d32',
    display: 'flex',
    flexDirection: 'row' as 'row',
    padding: '14px 32px',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  startText: { color: '#fff', fontSize: 16, marginLeft: 8 },
};

