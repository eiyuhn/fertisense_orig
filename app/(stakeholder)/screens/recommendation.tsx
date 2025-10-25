import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useData } from '../../../context/DataContext';
import { FertilizerPrices, useFertilizer } from '../../../context/FertilizerContext';

// 🔗 NEW: backend hooks
import { useAuth } from '../../../context/AuthContext';
import { addReading, getFarmer } from '../../../src/services';

/* -------------------- Utils (idempotency) -------------------- */
async function getLastKey() {
  try {
    const v = await FileSystem.readAsStringAsync(FileSystem.documentDirectory + 'lastReadingKey.txt');
    return v || '';
  } catch {
    return '';
  }
}
async function setLastKey(key: string) {
  try {
    await FileSystem.writeAsStringAsync(FileSystem.documentDirectory + 'lastReadingKey.txt', key);
  } catch {}
}
function makeKey(farmerId: string, dateISO: string, n: number, p: number, k: number, ph?: number) {
  return `${farmerId}|${dateISO}|${n}|${p}|${k}|${ph ?? ''}`;
}

export default function RecommendationScreen() {
  const router = useRouter();
  const { prices: fertilizerPrices } = useFertilizer();
  const { addReading: addLocalReading, readings } = useData();

  // ⬇️ params coming from previous screen
  const params = useLocalSearchParams();
  const nameStr = (params.name ?? '') as string;
  const codeStr = (params.code ?? '') as string;
  const nValue = parseFloat((params.n ?? '0') as string);
  const pValue = parseFloat((params.p ?? '0') as string);
  const kValue = parseFloat((params.k ?? '0') as string);
  const phValue = parseFloat((params.ph ?? '0') as string) || 6.5;
  const paramFarmerId = (params.farmerId ?? '') as string; // may be '' if not passed

  // 🔐 auth/online
  const { token, online } = useAuth();

  // local de-dup guard to avoid re-posting
  const postedRef = useRef(false);

  // ---------------- Prices (unchanged) ----------------
  const fallbackPrices: FertilizerPrices = {
    urea: 25,
    ssp: 20,
    mop: 18,
    dap: 30,
    npk: 27,
  };
  const prices: FertilizerPrices = { ...fallbackPrices, ...fertilizerPrices };
  const fertilizerAmounts: Record<string, Partial<FertilizerPrices>> = {
    plan1: { urea: 261, ssp: 193, mop: 197 },
    plan2: { dap: 70, urea: 247, mop: 197 },
    plan3: { npk: 179, urea: 226, mop: 149 },
  };
  const totalPrice = (items: Partial<FertilizerPrices>) => {
    return Object.entries(items).reduce((sum, [key, amount]) => {
      const price = prices[key as keyof FertilizerPrices] ?? 0;
      return sum + (amount ?? 0) * price;
    }, 0);
  };

  // ---------------- Text (unchanged) ----------------
  const recommendationText =
    'Mababa ang Phosphorus ng lupa. Katamtaman ang Nitrogen at Potassium. Inirerekomenda naming magdagdag ng abono na may mataas na Phosphorus tulad ng Superphosphate.';
  const englishText =
    'The soil is low in Phosphorus. Nitrogen and Potassium are medium. We recommend applying fertilizer with high Phosphorus like Superphosphate.';
  const phStatus =
    phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  // ---------------- Auto-save to local context (unchanged) ----------------
  useEffect(() => {
    const today = new Date().toLocaleDateString();

    const fertilizerPlans = Object.entries(fertilizerAmounts).map(
      ([_, items], index) => ({
        stage: `Plan ${index + 1}`,
        type: Object.keys(items)
          .map((k) => k.toUpperCase())
          .join(', '),
        amount: Object.values(items)
          .map((v) => v?.toString() ?? '0')
          .join(', '),
        price: totalPrice(items),
      })
    );

    const data = {
      name: nameStr,
      code: codeStr,
      date: today,
      n: nValue,
      p: pValue,
      k: kValue,
      ph: phValue,
      recommendation: [recommendationText, englishText],
      fertilizerPlans,
    };

    const exists = readings.some(
      (r) =>
        r.code === codeStr &&
        r.n === nValue &&
        r.p === pValue &&
        r.k === kValue &&
        r.ph === phValue &&
        r.date === today
    );

    if (!exists && nameStr && codeStr) {
      addLocalReading(data);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- NEW: Save to backend readings ----------------
  useEffect(() => {
    if (postedRef.current) return;
    postedRef.current = true; // run once per mount

    (async () => {
      // Only attempt if we have internet + logged in
      if (!online || !token) return;

      // Resolve backend farmer id:
      // 1) Prefer explicit farmerId from params
      // 2) Else, try look up by code
      let backendFarmerId = (paramFarmerId || '').trim();

      if (!backendFarmerId && codeStr) {
        try {
          const farmer = await getFarmer({ code: codeStr }, token);
          if (farmer?._id) backendFarmerId = farmer._id;
        } catch {
          // lookup failed; skip backend write quietly
          return;
        }
      }
      if (!backendFarmerId) return; // nothing to write to

      // Idempotency guard (local simple key)
      const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const key = makeKey(backendFarmerId, todayISO, nValue, pValue, kValue, phValue);
      const last = await getLastKey();
      if (last === key) return;

      try {
        await addReading(
          {
            farmerId: backendFarmerId,
            npk: { N: nValue, P: pValue, K: kValue },
            ph: isFinite(phValue) ? phValue : null,
            source: 'esp32',
          },
          token
        );
        await setLastKey(key);
      } catch (e: any) {
        // Non-blocking: show a soft hint only if it looks like auth
        const msg = e?.response?.data?.error || e?.message || '';
        if (/401|unauthor/i.test(msg)) {
          Alert.alert('Login required', 'Please log in again to save readings to the server.');
        }
        // otherwise ignore; user still sees recommendations
      }
    })();
  }, [online, token, paramFarmerId, codeStr, nValue, pValue, kValue, phValue]);

  // ---------------- PDF generation (unchanged) ----------------
  const handleSavePDF = async () => {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const fileName = `${nameStr}_${formattedDate}.pdf`;

    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial; padding: 20px; }
            h1 { color: #2e7d32; }
            p { margin-bottom: 8px; }
            .section { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
            .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <h1>🌾 Fertilizer Recommendation Report</h1>
          <p><strong>👤 Name:</strong> ${nameStr}</p>
          <p><strong>🆔 Code:</strong> ${codeStr}</p>
          <p><strong>📅 Date:</strong> ${formattedDate}</p>
          <p><strong>📈 pH Level:</strong> ${phValue.toFixed(1)} (${phStatus})</p>

          <div class="section">
            <h3>📋 Recommendation</h3>
            <p>${recommendationText}</p>
            <p><em>${englishText}</em></p>
          </div>

          <div class="section">
            <h3>🧪 Fertilizer Plans</h3>
            ${Object.entries(fertilizerAmounts)
              .map(([_, items], index) => {
                const total = totalPrice(items).toFixed(2);
                const rows = Object.entries(items)
                  .map(
                    ([name, val]) =>
                      `<tr><td>${name.toUpperCase()}</td><td>${val} kg</td></tr>`
                  )
                  .join('');
                return `
                  <p><strong>Plan ${index + 1} - ₱${total}</strong></p>
                  <table>
                    <tr><th>Fertilizer</th><th>Amount</th></tr>
                    ${rows}
                  </table>
                `;
              })
              .join('')}
          </div>

          <div class="footer">
            Report generated by FertiSense • ${formattedDate}
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newPath });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newPath, {
          mimeType: 'application/pdf',
          dialogTitle: '📄 Share or Save Recommendation PDF',
        });
      } else {
        Alert.alert('✅ PDF Generated', `Saved at: ${newPath}`);
      }
    } catch (err) {
      Alert.alert('❌ PDF Error', 'Could not generate PDF. Try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require('../../../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* 📊 pH Result */}
      <View style={styles.phBox}>
        <Text style={styles.phLabel}>📊 pH Level Result:</Text>
        <Text style={styles.phValue}>
          {phValue.toFixed(1)} ({phStatus})
        </Text>
        <Text style={styles.phNote}>
          {phStatus === 'Acidic' && 'Soil is too acidic. Consider applying lime.'}
          {phStatus === 'Neutral' && 'Soil pH is optimal for most crops.'}
          {phStatus === 'Alkaline' && 'Soil is alkaline. May affect nutrient availability.'}
        </Text>
      </View>

      {/* 📝 Recommendation */}
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationTitle}>
          Rekomendasyon: <Text style={{ fontStyle: 'italic' }}>(Recommendation)</Text>
        </Text>
        <Text style={styles.recommendationText}>{recommendationText}</Text>
        <Text style={styles.englishText}>{englishText}</Text>
      </View>

      {/* ✅ Action Checklist */}
      <View style={styles.checkItem}>
        <Image source={require('../../../assets/images/checkmark.png')} style={styles.checkIcon} />
        <Text style={styles.checkText}>Maglagay ng Superphosphate (P) na abono.</Text>
      </View>
      <View style={styles.checkItem}>
        <Image source={require('../../../assets/images/checkmark.png')} style={styles.checkIcon} />
        <Text style={styles.checkText}>Hindi kailangang magdilig.</Text>
      </View>

      {/* Fertilizer Table */}
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Recommendations</Text>
      {Object.entries(fertilizerAmounts).map(([key, items], index) => (
        <View key={key} style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>Fertilizer Recommendation – {index + 1}</Text>
            <Text style={styles.priceTag}>₱{totalPrice(items).toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cellHeader}>Stages</Text>
            {Object.keys(items).map((item) => (
              <Text key={item} style={styles.cellHeader}>{item.toUpperCase()}</Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Sa Pagtanim</Text>
            {Object.values(items).map((val, i) => (
              <Text key={i} style={styles.cell}>{val}</Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Pagkatapos ng 30 Araw</Text>
            {Object.values(items).map((val, i) => (
              <Text key={i} style={styles.cell}>{i === 0 ? val : 0}</Text>
            ))}
          </View>
        </View>
      ))}

      {/* 📄 PDF Download */}
      <View style={styles.downloadToggle}>
        <Text style={styles.downloadLabel}>Save a copy of this report</Text>
        <TouchableOpacity onPress={handleSavePDF}>
          <Text style={styles.downloadButton}>📄 Download PDF</Text>
        </TouchableOpacity>
      </View>

      {/* 🔙 Back Home */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(stakeholder)/tabs/stakeholder-home')}
      >
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* -------------------- Styles (unchanged) -------------------- */
const styles = StyleSheet.create({
  container: {
    padding: 23,
    backgroundColor: '#fff',
    flexGrow: 1,
    paddingBottom: 80,
  },
  logo: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: -30,
  },
  phBox: {
    backgroundColor: '#e8f5e9',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  phLabel: { fontSize: 14, color: '#2e7d32', fontWeight: 'bold' },
  phValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1b5e20',
    marginVertical: 4,
  },
  phNote: { fontSize: 13, color: '#555', textAlign: 'center' },
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
  englishText: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fdfdfd',
  },
  checkIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    resizeMode: 'contain',
  },
  checkText: { fontSize: 14, color: '#333' },
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
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  cellHeader: {
    flex: 1,
    padding: 10,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: '#e8f5e9',
  },
  cell: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    textAlign: 'center',
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
  downloadToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    borderTopWidth: 3,
    borderColor: '#417d44ff',
    paddingVertical: 10,
  },
  downloadLabel: {
    color: '#444',
    fontSize: 13,
  },
  downloadButton: {
    fontSize: 15,
    color: '#550909',
    fontWeight: 'bold',
  },
});
