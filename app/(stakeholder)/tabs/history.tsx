import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../context/AuthContext';

type HistoryItem = {
  id: string;
  date: string;
  ph: string;
  n_value: number;
  p_value: number;
  k_value: number;
  recommendationText: string;
  englishText?: string;
  fertilizerPlans?: Array<{
    name?: string;
    cost?: string;
    details?: string[];
  }>;
};

function normalizeDetails(details?: string[]): string[] {
  if (!details) return [];
  return details.map((d) => (typeof d === 'string' ? d : String(d)));
}

export default function HistoryScreen() {
  const { user } = useAuth();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  const userKey = useMemo(
    () => (user?._id ? `history:${user._id}` : null),
    [user?._id]
  );

  const migrateLegacyIfNeeded = useCallback(async () => {
    if (!userKey) return;
    try {
      const legacyKey = 'history';
      const legacy = await AsyncStorage.getItem(legacyKey);
      const current = await AsyncStorage.getItem(userKey);
      if (legacy && !current) {
        await AsyncStorage.setItem(userKey, legacy);
        await AsyncStorage.removeItem(legacyKey);
        console.log('History migrated successfully.');
      }
    } catch (e) {
      console.warn('History migration skipped:', e);
    }
  }, [userKey]);

  const loadHistory = useCallback(async () => {
    if (!userKey) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await migrateLegacyIfNeeded();
      const stored = await AsyncStorage.getItem(userKey);
      if (!stored) {
        setHistory([]);
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(stored);
        } catch {
          await AsyncStorage.removeItem(userKey);
          setHistory([]);
          return;
        }

        const asArray = Array.isArray(parsed) ? parsed : [];
        const cleaned: HistoryItem[] = asArray.map((h: any) => ({
          id: String(h?.id ?? ''),
          date: String(h?.date ?? 'Unknown Date'),
          ph: String(h?.ph ?? 'N/A'),
          n_value: Number(h?.n_value ?? 0),
          p_value: Number(h?.p_value ?? 0),
          k_value: Number(h?.k_value ?? 0),
          recommendationText: String(h?.recommendationText ?? ''),
          englishText: h?.englishText ? String(h.englishText) : undefined,
          fertilizerPlans: Array.isArray(h?.fertilizerPlans)
            ? h.fertilizerPlans.map((p: any) => ({
                name: p?.name ? String(p.name) : undefined,
                cost: p?.cost ? String(p.cost) : undefined,
                details: normalizeDetails(p?.details),
              }))
            : [],
        }));

        cleaned.sort((a, b) => {
          const getTime = (id: string) => {
            const parts = id.split('_');
            const t = parts.length > 1 ? parseInt(parts[1], 10) : NaN;
            return Number.isFinite(t) ? t : 0;
          };
          return getTime(b.id) - getTime(a.id);
        });

        setHistory(cleaned);
      }
    } catch (err) {
      console.error('Error loading history', err);
      Alert.alert('Load Error', 'Could not load history data.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [migrateLegacyIfNeeded, userKey]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  useEffect(() => {
    setShowReconnectBanner(false);
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = history.filter((h) => h.id !== id);
          setExpandedId((cur) => (cur === id ? null : cur));
          setHistory(updated);
          try {
            if (userKey) {
              await AsyncStorage.setItem(userKey, JSON.stringify(updated));
            }
          } catch (e) {
            console.error('Failed saving after delete', e);
            Alert.alert('Save Error', 'Could not update history after deletion.');
          }
        },
      },
    ]);
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No history yet</Text>
      <Text style={styles.emptyText}>
        Start by connecting your sensor and getting a recommendation.
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isExpanded = expandedId === item.id;
    const nValue = Number.isFinite(item.n_value) ? item.n_value : 0;
    const pValue = Number.isFinite(item.p_value) ? item.p_value : 0;
    const kValue = Number.isFinite(item.k_value) ? item.k_value : 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.date}>{item.date || 'Unknown Date'}</Text>
            <Text style={styles.subText}>pH: {item.ph || 'N/A'}</Text>
            <Text style={styles.npkText}>
              N: {nValue} | P: {pValue} | K: {kValue}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={20} color="#d32f2f" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.seeMoreBtn}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
        >
          <Text style={styles.seeMoreText}>
            {isExpanded ? 'Hide Recommendation' : 'See Recommendation'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#2e7d32"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.details}>
            <Text style={styles.detailsTitle}>Rekomendasyon:</Text>
            <Text style={styles.recommendationDetailsText}>
              {item.recommendationText || 'No recommendation text available.'}
            </Text>
            {!!item.englishText && (
              <Text style={styles.recommendationDetailsTextItalic}>
                ({item.englishText})
              </Text>
            )}

            {!!item.fertilizerPlans?.length && (
              <>
                <Text style={[styles.detailsTitle, { marginTop: 12 }]}>
                  Fertilizer Plans:
                </Text>
                {item.fertilizerPlans.map((plan, idx) => (
                  <View
                    key={`${item.id}-plan-${idx}`}
                    style={styles.planBox}
                  >
                    <View style={styles.planHeader}>
                      <Text style={styles.planName}>
                        {plan.name || `Plan ${idx + 1}`}
                      </Text>
                      <Text style={styles.planCost}>{plan.cost || 'N/A'}</Text>
                    </View>

                    {normalizeDetails(plan.details).length ? (
                      normalizeDetails(plan.details).map((d, i) => (
                        <Text
                          key={`${item.id}-plan-${idx}-line-${i}`}
                          style={styles.detailsText}
                        >
                          • {d}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.detailsText}>
                        No details for this plan.
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {showReconnectBanner && (
        <View style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>
            Back online? Fetching your latest recommendation…
          </Text>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={async () => {
              await loadHistory();
              setShowReconnectBanner(false);
            }}
          >
            <Text style={styles.reconnectBtnText}>I’m Online</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.topArc}>
        <Ionicons name="time-outline" size={26} color="#fff" />
        <Text style={styles.arcTitle}>History</Text>
      </View>

      {loading || !userKey ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={EmptyState}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topArc: {
    backgroundColor: '#2e7d32',
    height: 120,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 30,
    marginBottom: 10,
  },
  arcTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 110 },

  reconnectBanner: {
    backgroundColor: '#e9f7ec',
    borderBottomWidth: StyleSheet.hairlineWidth ?? 1,
    borderBottomColor: '#cfe7d4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reconnectText: { color: '#1b5e20', fontSize: 13 },
  reconnectBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  reconnectBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1, marginRight: 8 },
  date: { fontWeight: 'bold', fontSize: 15, color: '#333', marginBottom: 2 },
  subText: { fontSize: 13, color: '#666' },
  npkText: { fontSize: 12, color: '#888', marginTop: 3 },
  deleteButton: { padding: 4 },

  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    marginRight: 4,
  },

  details: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailsTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
    color: '#1b5e20',
  },
  detailsText: { fontSize: 13, color: '#444', marginBottom: 3 },
  recommendationDetailsText: { fontSize: 13, color: '#444', marginBottom: 2 },
  recommendationDetailsTextItalic: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },

  planBox: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f1f8f2',
    borderRadius: 6,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planName: { fontWeight: '600', fontSize: 13, color: '#333' },
  planCost: { fontWeight: '500', fontSize: 13, color: '#333' },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 4,
  },
  emptyText: { fontSize: 14, color: '#777', textAlign: 'center' },
  loadingText: { color: '#555', marginTop: 8 },
});
