import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PersonalInformationScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top Arc */}
      <View style={styles.topArc} />

      {/* Back Button */}
     <TouchableOpacity style={styles.backButton} onPress={() => router.push('/admin/tabs/admin-profile')}>
     <Ionicons name="arrow-back" size={24} color="#fff" />
     </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Personal Information</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>Francen Sellote</Text>

          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>Department of Agriculture</Text>

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>sellote.francen519@gmail.com</Text>

          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>+63 936 732 8984</Text>
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
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2e7d32',
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
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginTop: 16,
  },
  value: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
  },
});
