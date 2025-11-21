// app/(stakeholder)/screens/recommendation.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { moveAsync } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* app contexts */
import { useAuth } from '../../../context/AuthContext';
import { useFertilizer } from '../../../context/FertilizerContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';

/* services */
import {
  addReading,
  addStandaloneReading,
  getRecommendation,
} from '../../../src/services';

/* ------------------ constants ------------------ */
const SACK_WEIGHT_KG = 50;
const TARGET_N_KG_HA = 120;
const TARGET_P_KG_HA = 40;
const TARGET_K_KG_HA = 80;

const priceOf = (
  prices: Record<string, any> | null | undefined,
  code: string
) => prices?.[code]?.pricePerBag ?? 0;
const labelOf = (
  prices: Record<string, any> | null | undefined,
  code: string
) => prices?.[code]?.label ?? code;

const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

/* Types for server plans */
type ServerPlanRow = {
  key: string;
  label: string;
  bags: number;
  pricePerBag: number;
  subtotal: number;
};
type ServerPlan = {
  code: string;
  title: string;
  rows: ServerPlanRow[];
  total: number;
  currency: string;
};

export default function RecommendationScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    prices: adminPrices,
    currency,
    loading: pricesLoading,
    refetchPrices,
  } = useFertilizer();
  const { result: session } = useReadingSession();

  /* ------- resolve live values from ReadingSession ------- */
  const farmerId = session?.farmerId ?? ''; // optional
  const farmerName = session?.farmerName ?? '';
  const nValue = session?.n ?? 0;
  const pValue = session?.p ?? 0;
  const kValue = session?.k ?? 0;
  const phValue = session?.ph ?? 6.5;
  const phStatus =
    phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  /* ------- narrative ------- */
  const recommendationText =
    `Base sa datos, ang lupa ay nangangailangan ng` +
    `${nValue < TARGET_N_KG_HA ? ' Nitrogen' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' Phosphorus' : ''}` +
    `${kValue < TARGET_K_KG_HA ? ' Potassium' : ''}. ` +
    `Gumamit ng` +
    `${nValue < TARGET_N_KG_HA ? ' Urea' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' SSP o DAP' : ''}.`;

  const englishText =
    `Based on the reading, the soil requires` +
    `${nValue < TARGET_N_KG_HA ? ' Nitrogen' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' Phosphorus' : ''}` +
    `${kValue < TARGET_K_KG_HA ? ' Potassium' : ''}. ` +
    `Use` +
    `${nValue < TARGET_N_KG_HA ? ' Urea' : ''}` +
    `${pValue < TARGET_P_KG_HA ? ' SSP/DAP' : ''}.`;

  /* ------- client-side plan math (kg/ha → kg fertilizer) ------- */
  const calculateFertilizerNeeded = (needKg: number, pct: number) =>
    needKg <= 0 || pct === 0 ? 0 : needKg / (pct / 100);

  const fertilizerAmounts = React.useMemo(() => {
    const dN = Math.max(0, TARGET_N_KG_HA - nValue);
    const dP = Math.max(0, TARGET_P_KG_HA - pValue);
    const dK = Math.max(0, TARGET_K_KG_HA - kValue);

    // Plan 1: UREA + SSP + MOP
    const ureaKg = calculateFertilizerNeeded(dN, 46);
    const sspKg = calculateFertilizerNeeded(dP, 16);
    const mopKg = calculateFertilizerNeeded(dK, 60);

    // Plan 2: DAP + UREA + MOP
    const dapKg = calculateFertilizerNeeded(dP, 46);
    const dN_after_dap = Math.max(0, dN - dapKg * 0.18);
    const urea2Kg = calculateFertilizerNeeded(dN_after_dap, 46);
    const mop2Kg = calculateFertilizerNeeded(dK, 60);

    // Plan 3: NPK 14-14-14 + UREA
    const npkBase = Math.max(dN / 0.14, dP / 0.14, dK / 0.14);
    const npkKg = Math.ceil(npkBase);
    const dN_after_npk = Math.max(0, dN - npkKg * 0.14);
    const urea3Kg = calculateFertilizerNeeded(dN_after_npk, 46);

    return {
      plan1: { UREA_46_0_0: ureaKg, SSP_0_16_0: sspKg, MOP_0_0_60: mopKg },
      plan2: { DAP_18_46_0: dapKg, UREA_46_0_0: urea2Kg, MOP_0_0_60: mop2Kg },
      plan3: { NPK_14_14_14: npkKg, UREA_46_0_0: urea3Kg },
    } as Record<string, Record<string, number>>;
  }, [nValue, pValue, kValue]);

  const clientPlans = React.useMemo(() => {
    const entries = Object.entries(fertilizerAmounts);
    return entries.map(([key, items], idx) => {
      const total = Object.entries(items).reduce((sum, [code, kg]) => {
        const bags = Math.ceil((kg as number) / SACK_WEIGHT_KG);
        return sum + bags * priceOf(adminPrices, code);
      }, 0);
      return { key, items, total, idx };
    });
  }, [fertilizerAmounts, adminPrices]);

  /* ------- cloud + server plans ------- */
  const [postStatus, setPostStatus] = React.useState<
    'pending' | 'saving' | 'saved' | 'failed'
  >('pending');
  const onceRef = React.useRef(false);
  const isFetchingRef = React.useRef(false);
  const [serverPlans, setServerPlans] = React.useState<ServerPlan[] | null>(
    null
  );
  const [serverNarrative, setServerNarrative] = React.useState<{
    en?: string;
    tl?: string;
  } | null>(null);

  const persistLocalHistory = React.useCallback(async () => {
    if (!user?._id) return;
    try {
      const userKey = `history:${user._id}`;
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const phStr = `${phValue.toFixed(1)} (${phStatus})`;

      const historyPlans = clientPlans.map(({ items, total }, idx) => {
        const details = Object.entries(items).map(([code, kg]) => {
          const bags = Math.ceil((kg as number) / SACK_WEIGHT_KG);
          return `${labelOf(adminPrices, code)}: ${bags} bags (${(
            kg as number
          ).toFixed(2)} kg)`;
        });
        return {
          name: `Recommendation ${idx + 1}`,
          cost: `${currency} ${total.toFixed(2)}`,
          details,
        };
      });

      const newItem = {
        id: `reading_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        date,
        ph: phStr,
        n_value: nValue,
        p_value: pValue,
        k_value: kValue,
        recommendationText,
        englishText,
        fertilizerPlans: historyPlans,
      };

      const raw = await AsyncStorage.getItem(userKey);
      const prev = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(userKey, JSON.stringify([newItem, ...prev]));
    } catch (e) {
      console.warn('local history save warn:', e);
    }
  }, [
    user?._id,
    clientPlans,
    adminPrices,
    currency,
    nValue,
    pValue,
    kValue,
    phValue,
    phStatus,
    recommendationText,
    englishText,
  ]);

  const saveAndFetch = React.useCallback(async () => {
    if (postStatus !== 'pending' || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setPostStatus('saving');

    try {
      const net = await NetInfo.fetch();
      const online =
        net.isInternetReachable === true
          ? true
          : net.isInternetReachable === false
          ? false
          : !!net.isConnected;

      if (!online) {
        console.warn('Offline: skipping cloud save.');
      } else if (!token) {
        console.warn('Missing token: skipping cloud save.');
      } else {
        // ✅ If we have a valid farmerId, use farmer-based logging (admin-style)
        if (farmerId && isObjectId(farmerId)) {
          await addReading(
            {
              farmerId,
              N: nValue,
              P: pValue,
              K: kValue,
              ph: phValue,
              source: 'esp32',
            },
            token
          );
        } else {
          // ✅ Normal STAKEHOLDER path: standalone /api/readings (no farmerId)
          await addStandaloneReading(
            {
              N: nValue,
              P: pValue,
              K: kValue,
              ph: phValue,
              source: 'esp32',
            },
            token
          );
        }

        // optional: fetch server (LGU) plans
       // optional: fetch server (LGU) plans
try {
  const rec = await getRecommendation(token, {
    n: nValue,
    p: pValue,
    k: kValue,
    ph: phValue,
    areaHa: 1,
    // you can add these later if backend supports them:
    // riceType: 'HYBRID',
    // season: 'WET',
    // soilType: 'LIGHT',
  });

  if (Array.isArray(rec?.plans)) {
    setServerPlans(rec.plans as ServerPlan[]);
  }
  if (rec?.narrative) {
    setServerNarrative(rec.narrative as { en?: string; tl?: string });
  }
} catch (e) {
  console.warn('[recommendation] fetch warn:', e);
}

      }

      await persistLocalHistory();
      setPostStatus('saved');
    } catch (e: any) {
      console.error('save error:', e?.message || e);
      await persistLocalHistory();
      setPostStatus('failed');
      Alert.alert('Save Error', e?.message || 'Could not save reading.');
    } finally {
      isFetchingRef.current = false;
    }
  }, [
    postStatus,
    token,
    farmerId,
    nValue,
    pValue,
    kValue,
    phValue,
    persistLocalHistory,
  ]);

  useFocusEffect(
    React.useCallback(() => {
      if (!onceRef.current) {
        onceRef.current = true;
        refetchPrices?.();
        saveAndFetch();
      }
    }, [refetchPrices, saveAndFetch])
  );

  /* ------- PDF (guarded) ------- */
  const [pdfBusy, setPdfBusy] = React.useState(false);

  const handleSavePDF = React.useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);

    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);
    const filename = `STAKEHOLDER_READING_${ymd.replace(/-/g, '')}.pdf`;

    const money = (v: number) =>
      (v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const clientHtml = clientPlans
      .map(({ items, total }, idx) => {
        const rows = Object.entries(items)
          .map(([code, kg]) => {
            const totalBags = Math.ceil((kg as number) / SACK_WEIGHT_KG);
            const price = priceOf(adminPrices, code);
            const subtotal = totalBags * price;
            return `<tr><td>${labelOf(
              adminPrices,
              code
            )}</td><td style="text-align:right;">${totalBags} bags (${(
              kg as number
            ).toFixed(
              2
            )} kg)</td><td style="text-align:right;">${currency} ${money(
              subtotal
            )}</td></tr>`;
          })
          .join('');
        return `
          <div style="margin-top:18px;">
            <div class="hdr">
              <span>Client Plan ${idx + 1}</span>
              <span>${currency} ${money(total)}</span>
            </div>
            <table>
              <tr><th>Fertilizer</th><th style="text-align:right;">Amount (Bags/kg)</th><th style="text-align:right;">Subtotal</th></tr>
              ${rows}
            </table>
          </div>
        `;
      })
      .join('');

    const serverHtml = (serverPlans ?? [])
      .map((p, idx) => {
        const rows = p.rows
          .map(
            (r) =>
              `<tr><td>${r.label}</td><td style="text-align:right;">${
                r.bags
              } bags</td><td style="text-align:right;">${currency} ${money(
                r.subtotal
              )}</td></tr>`
          )
          .join('');
        return `
          <div style="margin-top:18px;">
            <div class="hdr">
              <span>LGU Plan ${idx + 1}</span>
              <span>${currency} ${money(p.total)}</span>
            </div>
            <table>
              <tr><th>Fertilizer</th><th style="text-align:right;">Bags</th><th style="text-align:right;">Subtotal</th></tr>
              ${rows}
            </table>
          </div>
        `;
      })
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; }
            h1 { color: #2e7d32; margin: 0 0 6px; }
            h3 { margin: 20px 0 10px; }
            .box { border:1px solid #ccc; padding:14px; border-radius:8px; background:#f8fff9; }
            table { width:100%; border-collapse:collapse; }
            th, td { border:1px solid #ccc; padding:8px 12px; text-align:left; }
            th { background:#f0f0f0; }
            .hdr { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#2e7d32; color:#fff; border-radius:6px 6px 0 0; }
            .footer { margin-top: 28px; color:#777; text-align:center; font-size:12px; }
          </style>
        </head>
        <body>
          <h1>🌱 Fertilizer Report</h1>
          <p><b>📅 Date:</b> ${ymd}</p>
          <p><b>👤 Farmer:</b> ${farmerName || '(stakeholder account)'}</p>

          <h3>📟 Reading Results</h3>
          <div class="box">
            <p><b>pH:</b> ${phValue.toFixed(1)} (${phStatus})</p>
            <p><b>N:</b> ${nValue} &nbsp; <b>P:</b> ${pValue} &nbsp; <b>K:</b> ${kValue}</p>
          </div>

          <h3>📋 Recommendation</h3>
          <div class="box">
            <p>${recommendationText}</p>
            <p style="font-style:italic;color:#555;">${englishText}</p>
          </div>

          <h3>✅ Client Plans</h3>
          ${clientHtml}

          ${
            (serverPlans?.length ?? 0) > 0
              ? `<h3>🏛️ LGU Plans</h3>${serverHtml}`
              : ''
          }

          <div class="footer">Report • ${today.getFullYear()}</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = (FileSystem as any).documentDirectory + filename;
      await moveAsync({ from: uri, to: dest });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Choose where to save your PDF',
        });
      } else {
        Alert.alert('Saved', `File saved to app storage:\n${dest}`);
      }
    } catch (err: any) {
      console.error('PDF error:', err);
      Alert.alert('PDF Error', err?.message ?? 'Could not generate PDF.');
    } finally {
      setPdfBusy(false);
    }
  }, [
    pdfBusy,
    adminPrices,
    clientPlans,
    serverPlans,
    currency,
    farmerName,
    nValue,
    pValue,
    kValue,
    phValue,
    phStatus,
    recommendationText,
    englishText,
  ]);

  /* ------------------ UI ------------------ */
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* READING RESULTS */}
      <View style={styles.readBox}>
        <Text style={styles.readTitle}>📟 Reading Results</Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>pH:</Text> {phValue.toFixed(1)} (
          {phStatus})
        </Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>N:</Text> {nValue}{'  '}
          <Text style={styles.bold}>P:</Text> {pValue}{'  '}
          <Text style={styles.bold}>K:</Text> {kValue}
        </Text>
        {!!farmerName && (
          <Text style={styles.readSubtle}>Farmer: {farmerName}</Text>
        )}
      </View>

      {/* NARRATIVE */}
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationTitle}>
          Rekomendasyon:{' '}
          <Text style={{ fontStyle: 'italic' }}>(Recommendation)</Text>
        </Text>
        <Text style={styles.recommendationText}>{recommendationText}</Text>
        <Text style={styles.englishText}>{englishText}</Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Recommendations</Text>

      {pricesLoading && (
        <Text
          style={{
            textAlign: 'center',
            color: '#888',
            marginVertical: 10,
          }}
        >
          Loading Prices...
        </Text>
      )}

      {/* CLIENT PLANS */}
      {clientPlans.map(({ key, items, total }, idx) => (
        <View key={key} style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>Client Plan – {idx + 1}</Text>
            <Text style={styles.priceTag}>
              {currency} {(total || 0).toFixed(2)}
            </Text>
          </View>

          {/* header row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Stages</Text>
            {Object.keys(items).map((code) => (
              <Text key={`hdr-${code}`} style={styles.cellHeader}>
                {labelOf(adminPrices, code)}
              </Text>
            ))}
          </View>

          {/* planting row: half of Urea, full P/K */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>Sa Pagtanim</Text>
            {Object.entries(items).map(([code, kg]) => {
              const totalBags = Math.ceil((kg as number) / SACK_WEIGHT_KG);
              const bagsAtPlanting = code.includes('UREA')
                ? Math.round(totalBags / 2)
                : totalBags;
              return (
                <Text key={`plant-${code}`} style={styles.cell}>
                  {bagsAtPlanting}
                </Text>
              );
            })}
          </View>

          {/* 30d row: remaining Urea */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>
              Pagkatapos ng 30 Araw
            </Text>
            {Object.entries(items).map(([code, kg]) => {
              const totalBags = Math.ceil((kg as number) / SACK_WEIGHT_KG);
              const bagsAt30Days = code.includes('UREA')
                ? totalBags - Math.round(totalBags / 2)
                : 0;
              return (
                <Text key={`30d-${code}`} style={styles.cell}>
                  {bagsAt30Days}
                </Text>
              );
            })}
          </View>

          {/* totals */}
          <View style={[styles.tableRow, styles.tableFooter]}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Total Bags</Text>
            {Object.entries(items).map(([code, kg]) => (
              <Text key={`tot-${code}`} style={styles.cellHeader}>
                {Math.ceil((kg as number) / SACK_WEIGHT_KG)}
              </Text>
            ))}
          </View>
        </View>
      ))}

      {/* SERVER (LGU) PLANS */}
      {(serverPlans?.length ?? 0) > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
            LGU Plans (Server)
          </Text>
          {serverNarrative?.tl && (
            <Text style={styles.narrativeTL}>{serverNarrative.tl}</Text>
          )}
          {serverNarrative?.en && (
            <Text style={styles.narrativeEN}>{serverNarrative.en}</Text>
          )}

          {serverPlans!.map((p, idx) => (
            <View key={p.code} style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableTitle}>LGU Plan – {idx + 1}</Text>
                <Text style={styles.priceTag}>
                  {currency} {(p.total || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.cellHeader, { flex: 2 }]}>Fertilizer</Text>
                <Text style={styles.cellHeader}>Bags</Text>
                <Text style={styles.cellHeader}>Subtotal</Text>
              </View>
              {p.rows.map((r) => (
                <View key={`${p.code}-${r.key}`} style={styles.tableRow}>
                  <Text style={[styles.cell, { flex: 2 }]}>{r.label}</Text>
                  <Text style={styles.cell}>{r.bags}</Text>
                  <Text style={styles.cell}>
                    {currency} {r.subtotal.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}

      <View style={styles.downloadToggle}>
        <Text style={styles.downloadLabel}>Save a copy</Text>
        <TouchableOpacity
          onPress={handleSavePDF}
          disabled={pdfBusy || pricesLoading}
        >
          <Text
            style={[
              styles.downloadButton,
              (pdfBusy || pricesLoading) && styles.disabledText,
            ]}
          >
            {pdfBusy ? 'Generating…' : '📄 Download PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(stakeholder)/tabs/stakeholder-home')}
      >
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ------------------ styles ------------------ */
const styles = StyleSheet.create({
  container: {
    padding: 23,
    backgroundColor: '#fff',
    flexGrow: 1,
    paddingBottom: 80,
  },
  logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: -30 },

  readBox: {
    backgroundColor: '#eef7ee',
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  readTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 },
  readLine: { fontSize: 14, color: '#222', marginBottom: 2 },
  readSubtle: { fontSize: 12, color: '#666', marginTop: 4 },
  bold: { fontWeight: 'bold' },

  recommendationBox: {
    borderColor: '#4CAF50',
    borderWidth: 1.5,
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#f8fff9',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  recommendationText: { fontSize: 14, marginBottom: 8, color: '#222' },
  englishText: { fontSize: 13, color: '#555', fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: '#000', marginVertical: 20, borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },

  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
  },
  tableTitle: { fontSize: 14, fontWeight: 'bold' },
  priceTag: {
    backgroundColor: '#5D9239',
    color: '#fff',
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 13,
  },

  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd' },
  cellHeader: {
    flex: 1,
    padding: 10,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#e8f5e9',
  },
  cell: { flex: 1, padding: 10, fontSize: 12, textAlign: 'center' },
  tableFooter: { backgroundColor: '#d1f7d6' },

  downloadToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    borderTopWidth: 3,
    borderColor: '#417d44ff',
    paddingVertical: 10,
  },
  downloadLabel: { color: '#444', fontSize: 13 },
  downloadButton: { fontSize: 15, color: '#550909', fontWeight: 'bold' },
  disabledText: { color: '#aaa' },

  narrativeTL: { fontSize: 13, color: '#333', marginBottom: 6 },
  narrativeEN: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 10,
  },

  button: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 20,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});
