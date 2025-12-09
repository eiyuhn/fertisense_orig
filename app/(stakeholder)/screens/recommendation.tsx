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

import { useAuth } from '../../../context/AuthContext';
import { useFertilizer } from '../../../context/FertilizerContext';
import { useReadingSession } from '../../../context/ReadingSessionContext';

import {
  addReading,
  addStandaloneReading,
} from '../../../src/services';

const SACK_WEIGHT_KG = 50;

// ------------- classification thresholds (ppm) -------------
const classifyLevel = (ppm: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (ppm < 117) return 'LOW';     // 0–116.9
  if (ppm <= 235) return 'MEDIUM'; // 117–235
  return 'HIGH';                   // >235
};

// ------------- helpers for prices / labels -------------
const priceOf = (
  prices: Record<string, any> | null | undefined,
  code: string | null | undefined
) => (code && prices?.[code]?.pricePerBag) ?? 0;

const labelOf = (
  prices: Record<string, any> | null | undefined,
  code: string | null | undefined
) => {
  if (!code) return 'Unknown';
  return prices?.[code]?.label ?? code;
};

// find fertilizer code automatically by looking at label + code text
const findFertCode = (
  prices: Record<string, any> | null | undefined,
  patterns: string[]
): string | null => {
  if (!prices) return null;
  const entries = Object.entries(prices);
  const lowerPatterns = patterns.map(p => p.toLowerCase());

  for (const [code, item] of entries) {
    const haystack = `${code} ${item?.label ?? ''}`.toLowerCase();
    if (lowerPatterns.some(p => haystack.includes(p))) {
      return code;
    }
  }
  return null;
};

const isObjectId = (s?: string) => !!s && /^[a-f0-9]{24}$/i.test(s);

// ------------- main component -------------
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

  // ------- resolve live values from ReadingSession -------
  const farmerId = session?.farmerId ?? '';
  const farmerName = session?.farmerName ?? '';
  const nValue = session?.n ?? 0; // ppm
  const pValue = session?.p ?? 0; // ppm
  const kValue = session?.k ?? 0; // ppm
  const phValue = session?.ph ?? 6.5;
  const phStatus =
    phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  // NPK levels (LOW / MEDIUM / HIGH)
  const levelN = classifyLevel(nValue);
  const levelP = classifyLevel(pValue);
  const levelK = classifyLevel(kValue);

  // ------- nutrient text (which elements are LOW?) -------
  const neededNutrients: string[] = [];
  if (levelN === 'LOW') neededNutrients.push('Nitrogen');
  if (levelP === 'LOW') neededNutrients.push('Phosphorus');
  if (levelK === 'LOW') neededNutrients.push('Potassium');

  const neededStrEN =
    neededNutrients.length === 0
      ? 'no major additional nutrients'
      : neededNutrients.join(', ').replace(/, ([^,]*)$/, ' and $1');

  const neededStrTL =
    neededNutrients.length === 0
      ? 'walay kulang nga nutriyente'
      : neededNutrients.join(', ').replace(/, ([^,]*)$/, ' ug $1');

  // ------- narrative (local + English) -------
  const recommendationText =
    `Base sa datos, ang lupa ay nangangalangan og ${neededStrTL}. ` +
    `Gamiton ang mga rekomendadong LGU fertilizer options sa ubos para sa 1 ka ektarya sa Hybrid rice.`;

  const englishText =
    `Based on the reading, the soil needs ${neededStrEN}. ` +
    `You may follow the LGU fertilizer options below for 1 hectare of hybrid rice.`;

  // ------- resolve fertilizer codes from price list -------
  const fertCodes = React.useMemo(() => {
    const p = adminPrices;
    return {
      urea: findFertCode(p, ['46-0-0', '46_0_0', 'urea']),
      mop: findFertCode(p, ['0-0-60', '0_0_60', 'mop', 'potash']),
      dap: findFertCode(p, ['18-46-0', '18_46_0', 'dap']),
      complete141414: findFertCode(p, ['14-14-14', '14_14_14', 'complete']),
      npk16200: findFertCode(p, ['16-20-0', '16_20_0']),
      n2100: findFertCode(p, ['21-0-0', '21_0_0']),
    };
  }, [adminPrices]);

  type LguPlan = {
    code: string;                 // e.g. "OPT1"
    title: string;                // "LGU Option 1"
    bagsByFert: Record<string, number>; // fertCode -> bags/ha
    total: number;                // total PHP/ha
  };

  // ------- LGU plans based on agriculture paper -------
  const lguPlans: LguPlan[] = React.useMemo(() => {
    const { urea, mop, dap, complete141414, npk16200, n2100 } = fertCodes;
    const plans: LguPlan[] = [];

    // Option 1: 18-46-0 (DAP) 3.00 + 0-0-60 (MOP) 2.33 + 46-0-0 (Urea) 4.43
    if (dap && mop && urea) {
      const bags = {
        [dap]: 3.0,
        [mop]: 2.33,
        [urea]: 4.43,
      };
      const total =
        bags[dap] * priceOf(adminPrices, dap) +
        bags[mop] * priceOf(adminPrices, mop) +
        bags[urea] * priceOf(adminPrices, urea);

      plans.push({
        code: 'OPT1',
        title: 'LGU Option 1',
        bagsByFert: bags,
        total,
      });
    }

    // Option 2: 16-20-0 7.00 + 0-0-60 2.33 + 46-0-0 4.52
    if (npk16200 && mop && urea) {
      const bags = {
        [npk16200]: 7.0,
        [mop]: 2.33,
        [urea]: 4.52,
      };
      const total =
        bags[npk16200] * priceOf(adminPrices, npk16200) +
        bags[mop] * priceOf(adminPrices, mop) +
        bags[urea] * priceOf(adminPrices, urea);

      plans.push({
        code: 'OPT2',
        title: 'LGU Option 2',
        bagsByFert: bags,
        total,
      });
    }

    // Option 3: 14-14-14 10.00 + 46-0-0 4.52
    if (complete141414 && urea) {
      const bags = {
        [complete141414]: 10.0,
        [urea]: 4.52,
      };
      const total =
        bags[complete141414] * priceOf(adminPrices, complete141414) +
        bags[urea] * priceOf(adminPrices, urea);

      plans.push({
        code: 'OPT3',
        title: 'LGU Option 3',
        bagsByFert: bags,
        total,
      });
    }

    // Option 4: 14-14-14 10.00 + 21-0-0 10.00
    if (complete141414 && n2100) {
      const bags = {
        [complete141414]: 10.0,
        [n2100]: 10.0,
      };
      const total =
        bags[complete141414] * priceOf(adminPrices, complete141414) +
        bags[n2100] * priceOf(adminPrices, n2100);

      plans.push({
        code: 'OPT4',
        title: 'LGU Option 4',
        bagsByFert: bags,
        total,
      });
    }

    return plans;
  }, [adminPrices, fertCodes]);

  // ------- local history save (using LGU plans) -------
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

      const historyPlans = lguPlans.map((plan, idx) => {
        const details = Object.entries(plan.bagsByFert).map(
          ([code, bags]) => {
            const kg = (bags as number) * SACK_WEIGHT_KG;
            return `${labelOf(adminPrices, code)}: ${bags.toFixed(
              2
            )} bags (${kg.toFixed(2)} kg)`;
          }
        );
        return {
          name: `${plan.title}`,
          cost: `${currency} ${plan.total.toFixed(2)}`,
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
    lguPlans,
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

  // ------- save reading to backend (no server recommendation) -------
  const [postStatus, setPostStatus] = React.useState<
    'pending' | 'saving' | 'saved' | 'failed'
  >('pending');
  const onceRef = React.useRef(false);
  const isSavingRef = React.useRef(false);

  const saveReading = React.useCallback(async () => {
    if (postStatus !== 'pending' || isSavingRef.current) return;
    isSavingRef.current = true;
    setPostStatus('saving');

    try {
      const net = await NetInfo.fetch();
      const online =
        net.isInternetReachable === true
          ? true
          : net.isInternetReachable === false
          ? false
          : !!net.isConnected;

      if (!online || !token) {
        console.warn('Offline or no token: skipping cloud save.');
      } else {
        const payload = {
          N: nValue,
          P: pValue,
          K: kValue,
          ph: phValue,
          source: 'esp32',
        };

        if (farmerId && isObjectId(farmerId)) {
          await addReading({ ...payload, farmerId }, token);
        } else {
          await addStandaloneReading(payload, token);
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
      isSavingRef.current = false;
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
        saveReading();
      }
    }, [refetchPrices, saveReading])
  );

  // ------- PDF (only LGU plans) -------
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

    const plansHtml = lguPlans
      .map((plan, idx) => {
        const rows = Object.entries(plan.bagsByFert)
          .map(([code, bags]) => {
            const price = priceOf(adminPrices, code);
            const subtotal = (bags as number) * price;
            return `<tr>
              <td>${labelOf(adminPrices, code)}</td>
              <td style="text-align:right;">${(bags as number).toFixed(
                2
              )} bags</td>
              <td style="text-align:right;">${currency} ${money(
                subtotal
              )}</td>
            </tr>`;
          })
          .join('');

        return `
          <div style="margin-top:18px;">
            <div class="hdr">
              <span>${plan.title}</span>
              <span>${currency} ${money(plan.total)}</span>
            </div>
            <table>
              <tr>
                <th>Fertilizer</th>
                <th style="text-align:right;">Bags/ha</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
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

          <h3>🏛️ LGU Fertilizer Options (per hectare)</h3>
          ${plansHtml}

          <div class="footer">FertiSense • ${today.getFullYear()}</div>
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
    lguPlans,
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

  // -------------- UI --------------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo as any}
        resizeMode="contain"
      />

      {/* READING RESULTS */}
      <View style={styles.readBox}>
        <Text style={styles.readTitle}>📟 Reading Results</Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>pH:</Text> {phValue.toFixed(1)} ({phStatus})
        </Text>
        <Text style={styles.readLine}>
          <Text style={styles.bold}>N:</Text> {nValue} ({levelN}){'  '}
          <Text style={styles.bold}>P:</Text> {pValue} ({levelP}){'  '}
          <Text style={styles.bold}>K:</Text> {kValue} ({levelK})
        </Text>
        {!!farmerName && (
          <Text style={styles.readSubtle}>Farmer: {farmerName}</Text>
        )}
      </View>

      {/* LOCAL NARRATIVE */}
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationTitle}>
          Rekomendasyon:{' '}
          <Text style={{ fontStyle: 'italic' }}>(Recommendation)</Text>
        </Text>
        <Text style={styles.recommendationText}>{recommendationText}</Text>
        <Text style={styles.englishText}>{englishText}</Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>LGU Fertilizer Recommendations</Text>

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

      {/* LGU PLANS */}
      {lguPlans.map((plan, idx) => (
        <View key={plan.code} style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>
              {plan.title} – {idx + 1}
            </Text>
            <Text style={styles.priceTag}>
              {currency} {(plan.total || 0).toFixed(2)}
            </Text>
          </View>

          {/* header row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Stages</Text>
            {Object.keys(plan.bagsByFert).map(code => (
              <Text key={`hdr-${code}`} style={styles.cellHeader}>
                {labelOf(adminPrices, code)}
              </Text>
            ))}
          </View>

          {/* planting row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>Sa Pagtanim</Text>
            {Object.entries(plan.bagsByFert).map(([code, bags]) => {
              // simple rule: all non-urea at planting; urea is split 50/50
              const isUrea = code === fertCodes.urea;
              const plantingBags = isUrea ? (bags as number) / 2 : (bags as number);
              return (
                <Text key={`plant-${code}`} style={styles.cell}>
                  {plantingBags.toFixed(2)}
                </Text>
              );
            })}
          </View>

          {/* 30d row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 2 }]}>
              Pagkatapos ng 30 Araw
            </Text>
            {Object.entries(plan.bagsByFert).map(([code, bags]) => {
              const isUrea = code === fertCodes.urea;
              const after30 = isUrea ? (bags as number) / 2 : 0;
              return (
                <Text key={`30d-${code}`} style={styles.cell}>
                  {after30.toFixed(2)}
                </Text>
              );
            })}
          </View>

          {/* totals */}
          <View style={[styles.tableRow, styles.tableFooter]}>
            <Text style={[styles.cellHeader, { flex: 2 }]}>Total Bags</Text>
            {Object.entries(plan.bagsByFert).map(([code, bags]) => (
              <Text key={`tot-${code}`} style={styles.cellHeader}>
                {(bags as number).toFixed(2)}
              </Text>
            ))}
          </View>
        </View>
      ))}

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
  readTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
  },
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

  divider: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: 20,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },

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
