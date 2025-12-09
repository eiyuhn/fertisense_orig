// app/admin/tabs/logs.tsx
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
  Platform,
  StatusBar,
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
  farmerId?: string;
  createdAt?: string;
  // backend may send either npk.N or top-level N,P,K or lower n,p,k
  npk?: { N?: number; P?: number; K?: number };
  N?: number;
  P?: number;
  K?: number;
  n?: number;
  p?: number;
  k?: number;
  ph?: number | null;
  pH?: number | null;
  ec?: number | null;
  moisture?: number | null;
  temp?: number | null;
  updatedAt?: string;
};

const GREEN = '#1b5e20';
const CARD_BORDER = '#e7ece9';
const TEXT_PRIMARY = '#1b1b1b';
const TEXT_MUTED = '#636e65';

const FARMERS_CACHE_KEY = 'fertisense:farmers';
const READINGS_CACHE_PREFIX = 'fertisense:readings:'; // + farmerId

const getFarmerId = (f: Farmer) => f._id || f.id || '';
const getReadingId = (r: Reading) => r._id || r.id || '';

// ---------- AsyncStorage helpers ----------
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
  try {
    await AsyncStorage.setItem(FARMERS_CACHE_KEY, JSON.stringify(farmers));
  } catch {}
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
  try {
    await AsyncStorage.setItem(READINGS_CACHE_PREFIX + fid, JSON.stringify(readings));
  } catch {}
}

async function removeFarmerFromCache(fid: string): Promise<void> {
  try {
    const list = await getFarmersCache();
    const next = list.filter((f) => getFarmerId(f) !== fid);
    await setFarmersCache(next);
    await AsyncStorage.removeItem(READINGS_CACHE_PREFIX + fid);
  } catch {}
}

// helper to pull numbers from several possible fields
const pickReadingN = (r?: Reading | null) => r?.npk?.N ?? r?.N ?? r?.n;
const pickReadingP = (r?: Reading | null) => r?.npk?.P ?? r?.P ?? r?.p;
const pickReadingK = (r?: Reading | null) => r?.npk?.K ?? r?.K ?? r?.k;
const pickReadingPh = (r?: Reading | null) => r?.ph ?? r?.pH ?? null;

export default function LogsScreen() {
  const router = useRouter();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [latest, setLatest] = useState<Record<string, Reading | null>>({});
  const [readingsByFarmer, setReadingsByFarmer] = useState<
    Record<string, Reading[]>
  >({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // ---- Network status ----
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    });
    NetInfo.fetch().then((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    });
    return () => sub && sub();
  }, []);

  // ---- Load farmers + readings (local first, then server) ----
  const loadFarmersAndLatest = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1) LOCAL FIRST
      const fsLocal = await getFarmersCache();
      if (fsLocal.length) setFarmers(fsLocal);

      const localLatestMap: Record<string, Reading | null> = {};
      const localAllMap: Record<string, Reading[]> = {};

      for (const f of fsLocal) {
        const fid = getFarmerId(f);
        const rsLocal = await getReadingsCache(fid);
        rsLocal.sort(
          (a, b) =>
            new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
            new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
        );
        localAllMap[fid] = rsLocal;
        localLatestMap[fid] = rsLocal[0] ?? null;
      }
      if (Object.keys(localAllMap).length) {
        setReadingsByFarmer((prev) => ({ ...prev, ...localAllMap }));
      }
      if (Object.keys(localLatestMap).length) {
        setLatest((prev) => ({ ...prev, ...localLatestMap }));
      }

      // 2) ONLINE REFRESH
      if (isOnline) {
        const fs = await listFarmersApi();
        setFarmers(fs);
        await setFarmersCache(fs);

        const onlineLatestMap: Record<string, Reading | null> = {};
        const onlineAllMap: Record<string, Reading[]> = {};

        for (const f of fs) {
          const fid = getFarmerId(f);

          try {
            let rs = await listReadingsApi(fid);
            if (!Array.isArray(rs)) rs = [];

            if (rs.length === 0) {
              // no readings in backend → keep whatever we had locally
              const rsLocal = await getReadingsCache(fid);
              rsLocal.sort(
                (a, b) =>
                  new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
                  new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
              );
              onlineAllMap[fid] = rsLocal;
              onlineLatestMap[fid] = rsLocal[0] ?? null;
              await setReadingsCache(fid, rsLocal);
            } else {
              rs.sort(
                (a, b) =>
                  new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
                  new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
              );
              onlineAllMap[fid] = rs;
              onlineLatestMap[fid] = rs[0] ?? null;
              await setReadingsCache(fid, rs);
            }
          } catch {
            // network error → fall back to local
            const rsLocal = await getReadingsCache(fid);
            rsLocal.sort(
              (a, b) =>
                new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
                new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
            );
            onlineAllMap[fid] = rsLocal;
            onlineLatestMap[fid] = rsLocal[0] ?? null;
          }
        }

        setReadingsByFarmer((prev) => ({ ...prev, ...onlineAllMap }));
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
    router.push({
      pathname: '/admin/tabs/connect-instructions',
      params: { farmerId: fid, farmerName: f.name },
    });
  };

  const onEdit = (f: Farmer) => {
    const fid = getFarmerId(f);
    router.push({
      pathname: '/admin/tabs/add-farmer',
      params: { edit: fid, ts: Date.now().toString() },
    });
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
          setReadingsByFarmer((prev) => {
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
              Alert.alert(
                'Error',
                e?.response?.data?.error ??
                  e?.message ??
                  'Failed to delete farmer online.'
              );
            }
          } else {
            Alert.alert(
              'Offline',
              'Removed locally. It will remain removed in this device cache.'
            );
          }
        },
      },
    ]);
  };

  const onDeleteLatestReading = async (f: Farmer) => {
    const fid = getFarmerId(f);
    const currentLatest = latest[fid];
    if (!currentLatest) return;
    const rid = getReadingId(currentLatest);

    Alert.alert('Delete Reading', 'Delete the latest reading for this farmer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // 1️⃣ Update front-end state + cache immediately
          setReadingsByFarmer((prev) => {
            const list = prev[fid] || [];
            const filtered = list.filter(
              (r) => getReadingId(r) !== rid
            );
            // update latest based on filtered
            setLatest((old) => ({
              ...old,
              [fid]: filtered[0] ?? null,
            }));
            // persist filtered list to AsyncStorage
            setReadingsCache(fid, filtered);
            return { ...prev, [fid]: filtered };
          });

          // 2️⃣ If offline, stop here
          if (!isOnline || !rid) {
            if (!isOnline) {
              Alert.alert('Offline', 'Removed from local cache.');
            }
            return;
          }

          // 3️⃣ Try deleting on backend + re-sync from server
          try {
            await deleteReadingApi(fid, rid);

            try {
              let rs = await listReadingsApi(fid);
              if (!Array.isArray(rs)) rs = [];

              rs.sort(
                (a, b) =>
                  new Date(b.createdAt ?? b.updatedAt ?? 0).getTime() -
                  new Date(a.createdAt ?? a.updatedAt ?? 0).getTime()
              );

              setReadingsByFarmer((prev) => ({
                ...prev,
                [fid]: rs,
              }));
              setLatest((prev) => ({
                ...prev,
                [fid]: rs[0] ?? null,
              }));
              await setReadingsCache(fid, rs);
            } catch {
              // ignore re-sync errors; front-end state is already consistent
            }

            Alert.alert('Deleted', 'Latest reading removed.');
          } catch (e: any) {
            Alert.alert(
              'Error',
              e?.response?.data?.error ??
                e?.message ??
                'Failed to delete reading online.'
            );
          }
        },
      },
    ]);
  };

  const sortedFarmers = useMemo(() => {
    const copy = [...farmers];
    copy.sort((a, b) =>
      sortAsc
        ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    );
    return copy;
  }, [farmers, sortAsc]);

  const HeaderBar = () => (
    <View style={styles.headerBar}>
      <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Farmer Logs</Text>
      <TouchableOpacity
        onPress={() => setSortAsc((s) => !s)}
        style={[styles.headerIcon, { opacity: 0.95 }]}
      >
        <Ionicons name="swap-vertical" size={20} color="#fff" />
        <Text style={styles.headerSortText}>A-Z</Text>
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.listHeaderWrap}>
      <HeaderBar />
      <View style={styles.onlineRow}>
        <View
          style={[
            styles.onlineDot,
            { backgroundColor: isOnline ? '#6ecf78' : '#ff6b6b' },
          ]}
        />
        <Text style={styles.onlineText}>
          {isOnline ? 'Online' : 'Offline cache'}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item: f }: { item: Farmer }) => {
    const fid = getFarmerId(f);
    const r = latest[fid];
    const open = !!expanded[fid];

    const allForFarmer = readingsByFarmer[fid] || [];
    const totalCount = allForFarmer.length;

    // normalized values for display
    const phVal = pickReadingPh(r);
    const nVal = pickReadingN(r);
    const pVal = pickReadingP(r);
    const kVal = pickReadingK(r);

    return (
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.cardTop}>
          <Text style={styles.farmerName}>👩‍🌾 {f.name}</Text>

          {/* RIGHT ICONS: Reading (left) → Edit → Delete */}
          <View style={styles.rightIcons}>
            <TouchableOpacity onPress={() => onConnect(f)} style={styles.iconTap}>
              <Ionicons name="scan-circle-outline" size={18} color={GREEN} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => onEdit(f)} style={styles.iconTap}>
              <Ionicons name="pencil" size={18} color={GREEN} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDeleteFarmer(f)}
              style={styles.iconTap}
            >
              <Ionicons name="trash" size={18} color="#d32f2f" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Detail rows */}
        {!!f.farmLocation && (
          <Text style={styles.detailRow}>
            📍 Lokasyon: <Text style={styles.bold}>{f.farmLocation}</Text>
          </Text>
        )}
        {!!f.farmSize && (
          <Text style={styles.detailRow}>
            📏 Sukat: <Text style={styles.bold}>{f.farmSize} hectares</Text>
          </Text>
        )}
        {!!f.palayType && (
          <Text style={styles.detailRow}>
            🌾 Uri: <Text style={styles.bold}>{f.palayType}</Text>
          </Text>
        )}
        {!!f.farmType && (
          <Text style={styles.detailRow}>
            💧 Paraan: <Text style={styles.bold}>{f.farmType}</Text>
          </Text>
        )}

        <View style={styles.thinDivider} />

        {/* Tingnan Pa row */}
        <TouchableOpacity onPress={() => toggleExpand(fid)} style={styles.moreRow}>
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={GREEN}
          />
          <Text style={styles.moreText}>Tingnan Pa</Text>
        </TouchableOpacity>

        {/* Expanded area */}
        {open && (
          <View style={styles.expandedBox}>
            <Text style={styles.expTitle}>🧪 Huling Reading</Text>
            <Text style={styles.expRow}>
              🗓 Petsa:{' '}
              {r?.createdAt
                ? new Date(r.createdAt).toLocaleDateString()
                : '—'}
            </Text>
            <Text style={styles.expRow}>💧 pH: {fmtPh(phVal)}</Text>
            <Text style={styles.expRow}>🌿 N: {fmt(nVal)}</Text>
            <Text style={styles.expRow}>🌱 P: {fmt(pVal)}</Text>
            <Text style={styles.expRow}>🥬 K: {fmt(kVal)}</Text>

            <Text style={[styles.expRow, { marginTop: 8, fontWeight: '700' }]}>
              📊 Total readings: {totalCount}
            </Text>

            {/* 🔽 ALL readings list (latest first) */}
            <View style={styles.allBox}>
              <Text style={styles.allTitle}>All readings (latest first)</Text>
              {totalCount === 0 && (
                <Text style={styles.noReadingText}>
                  Walang reading pa para sa farmer na ito.
                </Text>
              )}
              {totalCount > 0 &&
                allForFarmer.map((rr, idx) => (
                  <View key={getReadingId(rr) || idx.toString()} style={styles.allRow}>
                    <Text style={styles.allIndex}>
                      #{idx + 1}{' '}
                      {idx === 0 ? (
                        <Text style={styles.latestTag}>(latest)</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.allDate}>
                      🗓{' '}
                      {rr.createdAt
                        ? new Date(rr.createdAt).toLocaleDateString()
                        : '—'}
                    </Text>
                    <Text style={styles.allLine}>
                      N: {fmt(pickReadingN(rr))} | P: {fmt(pickReadingP(rr))} | K:{' '}
                      {fmt(pickReadingK(rr))}
                    </Text>
                    <Text style={styles.allLine}>
                      pH: {fmtPh(pickReadingPh(rr))}
                    </Text>
                  </View>
                ))}
            </View>

            <View style={styles.expActions}>
              {r ? (
                <TouchableOpacity
                  onPress={() => onDeleteLatestReading(f)}
                  style={styles.deleteLatestBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#d32f2f" />
                  <Text style={styles.deleteLatestText}>Delete latest</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noReadingText}>
                  Walang reading pa para sa farmer na ito.
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const keyExtractor = (f: Farmer) => getFarmerId(f);

  const empty = useMemo(
    () => (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: TEXT_MUTED }}>
          Wala pang farmers. Magdagdag mula sa Home.
        </Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedFarmers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 110,
          paddingTop:
            0 + (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0),
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadFarmersAndLatest} />
        }
      />
    </View>
  );
}

// generic formatter (NPK etc.)
function fmt(v: any) {
  if (v === null || v === undefined) return '0';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '0';
}

// pH with two decimals, e.g. "5.40"
function fmtPh(v: any) {
  if (v === null || v === undefined) return '0.00';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f5' },

  // Header bar
  headerBar: {
    backgroundColor: GREEN,
    height: 56,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 52,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'left',
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSortText: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },

  listHeaderWrap: { paddingHorizontal: 4 },
  onlineRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 6,
    marginBottom: 8,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rightIcons: { flexDirection: 'row', gap: 10 },
  iconTap: { padding: 6 },

  farmerName: { fontSize: 18, fontWeight: '800', color: GREEN },

  detailRow: { marginTop: 6, color: TEXT_PRIMARY, fontSize: 14 },
  bold: { fontWeight: '600' },

  thinDivider: {
    height: 1,
    backgroundColor: '#eaeaea',
    marginTop: 10,
    marginBottom: 6,
  },

  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moreText: { color: GREEN, fontWeight: '700' },

  expandedBox: {
    marginTop: 10,
    backgroundColor: '#f7fff7',
    borderWidth: 1,
    borderColor: '#dfeee0',
    borderRadius: 12,
    padding: 10,
  },
  expTitle: { fontWeight: '800', color: GREEN, marginBottom: 6 },
  expRow: { color: '#1b5e20', marginTop: 2 },

  allBox: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
  },
  allTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 4,
  },
  allRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  allIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#455a64',
  },
  latestTag: { color: '#2e7d32', fontSize: 11, fontWeight: '700' },
  allDate: { fontSize: 12, color: '#607d8b' },
  allLine: { fontSize: 12, color: '#2e7d32' },

  expActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  deleteLatestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  deleteLatestText: { color: '#d32f2f', fontWeight: '600' },
  noReadingText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
