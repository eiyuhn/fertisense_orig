import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { getStakeholders, type StakeholderLite } from '../../../src/services';

// ✅ Match your floating Admin Tab Bar styling
const TAB_BAR_HEIGHT = 70;
const TAB_BAR_EXTRA_SPACE = 24; // extra breathing space above the tab bar

export default function StakeholdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<StakeholderLite[]>([]);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('Missing token');
      if (user?.role !== 'admin') throw new Error('Admin only');

      const data = await getStakeholders(token);
      setItems(data.users || []);
    } catch (e: any) {
      setItems([]);
      setError(
        e?.response?.data?.error || e?.message || 'Failed to load stakeholders'
      );
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      return (
        (x.username || '').toLowerCase().includes(q) ||
        (x.name || '').toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  // ✅ ensures last card clears the floating tab bar
  const bottomPadding =
    Math.max(insets.bottom, 12) + TAB_BAR_HEIGHT + TAB_BAR_EXTRA_SPACE;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Stakeholders
          </Text>

          <TouchableOpacity onPress={load} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#555" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search username or full name..."
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
              placeholderTextColor="#888"
            />
            {!!query && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={18} color="#777" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            keyExtractor={(x) => x._id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
            ListHeaderComponent={
              <Text style={styles.countText}>
                Total stakeholders: {filtered.length}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.muted}>No stakeholders found.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name || '(no name)'}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username || '(no username)'}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    backgroundColor: '#0d5213ff',
    paddingBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  searchWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  searchBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#222', marginLeft: 8 },
  clearBtn: { marginLeft: 8 },

  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  countText: { marginBottom: 10, color: '#555', fontWeight: '600' },

  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  muted: { marginTop: 10, color: '#666', textAlign: 'center' },
  errorText: { color: '#b00020', textAlign: 'center' },

  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#f8fff9',
  },
  name: { fontSize: 15, fontWeight: '700', color: '#1b1b1b' },
  username: { marginTop: 4, fontSize: 13, color: '#2e7d32', fontWeight: '600' },
});
