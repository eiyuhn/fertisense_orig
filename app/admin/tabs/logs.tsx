// app/admin/tabs/farmer-logs.tsx
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  deleteFarmer as deleteFarmerApi,
  deleteReading as deleteReadingApi,
  listFarmers as listFarmersApi,
  listReadingsByFarmer as listReadingsApi,
} from '../../../src/services';

type Farmer = {
  _id?: string;
  id?: string;
  name: string;
  farmLocation?: string;
  farmSize?: number;
  farmType?: string;
  palayType?: string;
  plantingStyle?: string;
  updatedAt?: string;
};

type Reading = {
  _id?: string;
  id?: string;
  farmerId: string;
  createdAt: string;
  npk?: { N?: number; P?: number; K?: number };
  ph?: number | null;
  ec?: number | null;
  moisture?: number | null;
  temp?: number | null;
  updatedAt?: string;
};

const FARMERS_CACHE_KEY = 'fertisense:farmers';
const READINGS_CACHE_PREFIX = 'fertisense:readings:'; // + farmerId

const getFarmerId = (f: Farmer) => f._id || f.id || '';
const getReadingId = (r: Reading) => r._id || r.id || '';

async function getFarmersCache(): Promise<Farmer[]> {
  try {
    const raw = await AsyncStorage.getItem(FARMERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function setFarmersCache(farmers: Farmer[]): Promise<void> {
  try { await AsyncStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(farmers)); } catch {}
}
async function getReadingsCache(fid: string): Promise<Reading[]> {
  try {
    const raw = await AsyncStorage.getItem(READINGS_CACHE_PREFIX + fid);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function setReadingsCache(fid: string, readings: Reading[]): Promise<void> {
  try { await AsyncStorage.setItem(READINGS_CACHE_PREFIX + fid, JSON.stringify(readings)); } catch {}
}
async function removeFarmerFromCache(fid: string): Promise<void> {
  try {
    const list = await getFarmersCache();
    const next = list.filter(f => getFarmerId(f) !== fid);
    await setFarmersCache(next);
    await AsyncStorage.removeItem(READINGS_CACHE_PREFIX + fid);
  } catch {}
}
async function removeLatestReadingFromCache(fid: string): Promise<void> {
  try {
    const list = await getReadingsCache(fid);
    if (!list.length) return;
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    list.shift();
    await setReadingsCache(fid, list);
  } catch {}
}

export default function LogsScreen() {
  const router = useRouter();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [latest, setLatest] = useState<Record<string, Reading | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    });
    NetInfo.fetch().then(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    });
    return () => sub && sub();
  }, []);

  const loadFarmersAndLatest = useCallback(async () => {
    setRefreshing(true);
    try {
      // local first
      const fsLocal = await getFarmersCache();
      if (fsLocal.length) setFarmers(fsLocal);

      const localLatestMap: Record<string, Reading | null> = {};
      for (const f of fsLocal) {
        const fid = getFarmerId(f);
        const rsLocal = await getReadingsCache(fid);
        rsLocal.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        localLatestMap[fid] = rsLocal[0] ?? null;
      }
      if (Object.keys(localLatestMap).length) {
        setLatest(prev => ({ ...prev, ...localLatestMap }));
      }

      // online refresh
      if (isOnline) {
        const fs = await listFarmersApi();
        setFarmers(fs);
        await setFarmersCache(fs);

        const onlineLatestMap: Record<string, Reading | null> = {};
        for (const f of fs) {
          const fid = getFarmerId(f);
          try {
            let rs = await listReadingsApi(fid);
            if (!Array.isArray(rs)) rs = [];
            rs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onlineLatestMap[fid] = rs[0] ?? null;
            await setReadingsCache(fid, rs);
          } catch {
            const rsLocal = await getReadingsCache(fid);
            rsLocal.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onlineLatestMap[fid] = rsLocal[0] ?? null;
          }
        }
        setLatest(onlineLatestMap);
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadFarmersAndLatest();
  }, [loadFarmersAndLatest]);

  useFocusEffect(
    useCallback(() => {
      loadFarmersAndLatest();
    }, [loadFarmersAndLatest])
  );

  const toggleExpand = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const onConnect = (f: Farmer) => {
    const fid = getFarmerId(f);
    router.push({ pathname: '/admin/tabs/connect-instructions', params: { farmerId: fid } }); // use id, not code
  };

  const onEdit = (f: Farmer) => {
    const fid = getFarmerId(f);
    router.push({ pathname: '/admin/tabs/add-farmer', params: { edit: fid, ts: Date.now().toString() } });
  };

  const onDeleteFarmer = (f: Farmer) => {
    const fid = getFarmerId(f);
    Alert.alert('Delete Farmer', `Delete "${f.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setFarmers((prev) => prev.filter((x) => getFarmerId(x) !== fid));
          setLatest((prev) => {
            const copy = { ...prev };
            delete copy[fid];
            return copy;
          });
          await removeFarmerFromCache(fid);

          if (isOnline) {
            try {
              await deleteFarmerApi(fid);
              Alert.alert('Deleted', `${f.name} removed.`);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Failed to delete farmer online.');
            }
          } else {
            Alert.alert('Offline', 'Removed locally. It will remain removed in this device cache.');
          }
        },
      },
    ]);
  };

  const onDeleteLatestReading = async (f: Farmer) => {
    const fid = getFarmerId(f);
    const r = latest[fid];
    if (!r) return;
    const rid = getReadingId(r);

    Alert.alert('Delete Reading', 'Delete the latest reading for this farmer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLatest((prev) => ({ ...prev, [fid]: null }));
          await removeLatestReadingFromCache(fid);

          if (isOnline) {
            try {
              await deleteReadingApi(fid, rid);
              try {
                let rs = await listReadingsApi(fid);
                if (!Array.isArray(rs)) rs = [];
                rs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                await setReadingsCache(fid, rs);
                setLatest((prev) => ({ ...prev, [fid]: rs[0] ?? null }));
              } catch {}
              Alert.alert('Deleted', 'Latest reading removed.');
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Failed to delete reading online.');
            }
          } else {
            Alert.alert('Offline', 'Removed from local cache.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: f }: { item: Farmer }) => {
    const fid = getFarmerId(f);
    const r = latest[fid];
    const open = !!expanded[fid];

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.farmerName}>👨‍🌾 {f.name}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onEdit(f)}>
              <Ionicons name="pencil" size={20} color="#2e7d32" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConnect(f)}>
              <Ionicons name="wifi" size={20} color="#2e7d32" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDeleteFarmer(f)}>
              <Ionicons name="trash" size={20} color="#c62828" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 6 }}>
          {!!f.farmLocation && (
            <Text style={styles.detail}>📍 Lokasyon: <Text style={styles.detailBold}>{f.farmLocation}</Text></Text>
          )}
          {!!f.farmSize && (
            <Text style={styles.detail}>📐 Sukat: <Text style={styles.detailBold}>{f.farmSize} hectares</Text></Text>
          )}
          {!!f.palayType && (
            <Text style={styles.detail}>🌾 Uri: <Text style={styles.detailBold}>{f.palayType}</Text></Text>
          )}
          {!!f.farmType && (
            <Text style={styles.detail}>💧 Paraan: <Text style={styles.detailBold}>{f.farmType}</Text></Text>
          )}
        </View>

        <TouchableOpacity onPress={() => toggleExpand(fid)} style={styles.moreRow}>
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color="#ff9800" />
          <Text style={styles.moreText}>{open ? 'Itago' : 'Tingnan Pa'}</Text>
        </TouchableOpacity>

        {open && (
          <View style={styles.readingBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.readingTitle}>🧪 Huling Reading</Text>
              {r ? (
                <TouchableOpacity onPress={() => onDeleteLatestReading(f)} style={{ padding: 6 }}>
                  <Ionicons name="trash" size={18} color="#c62828" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.readingDate}>
              🗓 Petsa: {r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.readingLine}>💧 pH: {fmt(r?.ph)}</Text>
            <Text style={styles.readingLine}>🌿 Nitrogen (N): {fmt(r?.npk?.N)}</Text>
            <Text style={styles.readingLine}>🌱 Phosphorus (P): {fmt(r?.npk?.P)}</Text>
            <Text style={styles.readingLine}>🥬 Potassium (K): {fmt(r?.npk?.K)}</Text>
            {!r && <Text style={styles.readingNote}>📫 Walang abono na nakarehistro para sa log na ito.</Text>}
          </View>
        )}
      </View>
    );
  };

  const keyExtractor = (f: Farmer) => getFarmerId(f);

  const empty = useMemo(
    () => (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#666' }}>Wala pang farmers. Magdagdag mula sa Home.</Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={farmers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadFarmersAndLatest} />
        }
      />
    </View>
  );
}

function fmt(v: any) {
  if (v === null || v === undefined) return '0';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '0';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  farmerName: { fontSize: 18, fontWeight: '800', color: '#2e7d32' },
  actions: { flexDirection: 'row', gap: 14, alignItems: 'center' },

  detail: { fontSize: 14, color: '#333', marginTop: 4 },
  detailBold: { fontWeight: '600' },

  moreRow: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e6e6',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moreText: { color: '#2e7d32', fontWeight: '700' },

  readingBox: {
    marginTop: 10,
    backgroundColor: '#eaf5e8',
    borderColor: '#b9dfb6',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  readingTitle: { fontSize: 16, fontWeight: '800', color: '#2e7d32', marginBottom: 6 },
  readingDate: { color: '#1b5e20', marginBottom: 6 },
  readingLine: { color: '#1b5e20', marginTop: 2 },
  readingNote: { color: '#4e6b4e', marginTop: 8, fontStyle: 'italic' },
});
