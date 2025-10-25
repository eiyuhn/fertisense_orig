import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../src/api';

const PPM_TO_KG_HA = 2.0;
const GOV_TARGET = { N: 120, P: 70, K: 70 };

type RecItem = { label: string; grade?: string; bags: number; pricePerBag: number; subTotal: number; };
type RecOption = { name?: string; items: RecItem[]; totals: { cost: number; N: number; P: number; K: number } };
type RecPayload = { schedule?: any; options: RecOption[] };

export default function RecommendationScreen() {
  const router = useRouter();
  const { farmerId: farmerIdParam, name, code, ph } = useLocalSearchParams<{ farmerId?: string; name?: string; code?: string; ph?: string }>();
  const farmerId = String(farmerIdParam ?? '');
  const nameStr = String(name ?? '');
  const codeStr = String(code ?? '');
  const phParam = parseFloat(String(ph ?? '0')) || 0;

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [soilSupply, setSoilSupply] = useState<{ N: number; P: number; K: number; ph?: number } | null>(null);
  const [usedTarget, setUsedTarget] = useState<{ N: number; P: number; K: number }>(GOV_TARGET);
  const [plans, setPlans] = useState<RecOption[]>([]);
  const [schedule, setSchedule] = useState<any>(null);

  const phValue = (soilSupply?.ph ?? phParam) || 6.5;
  const phStatus = phValue < 5.5 ? 'Acidic' : phValue > 7.5 ? 'Alkaline' : 'Neutral';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorText(null);

    try {
      let lastAvg: { n?: number; p?: number; k?: number; ph?: number } | null = null;

      if (farmerId) {
        const fres = await api.get(`/api/farmers/${farmerId}`);
        const summaries = fres.data?.readingSummaries || [];
        const last = summaries[summaries.length - 1];
        if (last?.avg) lastAvg = last.avg;
      }

      let soil = { N: 0, P: 0, K: 0, ph: undefined as number | undefined };
      if (lastAvg) {
        soil = {
          N: (lastAvg.n ?? 0) * PPM_TO_KG_HA,
          P: (lastAvg.p ?? 0) * PPM_TO_KG_HA,
          K: (lastAvg.k ?? 0) * PPM_TO_KG_HA,
          ph: lastAvg.ph,
        };
      }
      setSoilSupply(soil);

      const target = {
        N: Math.max(0, GOV_TARGET.N - soil.N),
        P: Math.max(0, GOV_TARGET.P - soil.P),
        K: Math.max(0, GOV_TARGET.K - soil.K),
      };
      setUsedTarget(target);

      const recRes = await api.post<RecPayload>('/api/recommend', { target, areaHa: 1 });
      const options = (recRes.data?.options || []).slice().sort((a, b) => (a.totals?.cost ?? 0) - (b.totals?.cost ?? 0));
      setPlans(options.slice(0, 3));
      setSchedule(recRes.data?.schedule ?? null);
    } catch (e:any) {
      setErrorText(e?.response?.data?.message || e?.message || 'Failed to load recommendation.');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => { router.replace('/admin/tabs/admin-home'); return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router])
  );

  const recommendationText =
    'Gumamit ng cost-efficient na kombinasyon batay sa kasalukuyang presyo at soil-adjusted na target (binawas ang nakuhang supply ng lupa).';
  const englishText =
    'Use the most cost-efficient combination based on current prices and a soil-adjusted target (after subtracting soil supply).';

  const handleSavePDF = async () => {
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const fileName = `${nameStr || 'FertiSense'}_${todayIso}.pdf`;

      const soilLine = soilSupply
        ? `<p><strong>Soil supply used</strong> → N ${soilSupply.N.toFixed(1)}, P ${soilSupply.P.toFixed(1)}, K ${soilSupply.K.toFixed(1)}</p>`
        : `<p><em>No 10-point summary found — used fixed target.</em></p>`;
      const targetLine = `<p><strong>Adjusted target</strong> → N ${usedTarget.N.toFixed(1)}, P ${usedTarget.P.toFixed(1)}, K ${usedTarget.K.toFixed(1)}</p>`;

      const planBlocks = plans.map((opt, idx) => {
        const itemsRows = opt.items.map(
          it => `<tr><td>${it.label}</td><td>${it.bags.toFixed(2)} bags</td><td>₱${it.pricePerBag.toFixed(2)}</td><td>₱${it.subTotal.toFixed(2)}</td></tr>`
        ).join('');
        return `
          <h4>Plan ${idx + 1} — Total: ₱${(opt.totals?.cost ?? 0).toFixed(2)}</h4>
          <table>
            <tr><th>Fertilizer</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
            ${itemsRows}
          </table>
        `;
      }).join('');

      const schedHtml = schedule
        ? `<div class="section"><h3>🗓 Application Schedule</h3><pre>${JSON.stringify(schedule, null, 2)}</pre></div>`
        : '';

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
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
            <p><strong>📈 pH Level:</strong> ${phValue.toFixed(1)} (${phStatus})</p>
            ${soilLine}
            ${targetLine}

            <div class="section">
              <h3>📋 Recommendation</h3>
              <p>${recommendationText}</p>
              <p><em>${englishText}</em></p>
            </div>

            <div class="section">
              <h3>🧪 Plans (Top 3 by cost)</h3>
              ${planBlocks}
            </div>

            ${schedHtml}

            <div class="footer">
              Report generated by FertiSense • ${todayIso}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent, base64: false });
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newPath });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newPath, { mimeType: 'application/pdf', dialogTitle: '📄 Share or Save Recommendation PDF' });
      } else {
        Alert.alert('✅ PDF Generated', `Saved at: ${newPath}`);
      }
    } catch {
      Alert.alert('❌ PDF Error', 'Could not generate PDF. Try again.');
    }
  };

  const PriceTag = ({ cost }: { cost: number }) => <Text style={styles.priceTag}>₱{cost.toFixed(2)}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={require('../assets/images/fertisense-logo.png')} style={styles.logo} resizeMode="contain" />

      <View style={styles.phBox}>
        <Text style={styles.phLabel}>📊 pH Level Result:</Text>
        <Text style={styles.phValue}>{phValue.toFixed(1)} ({phStatus})</Text>
        <Text style={styles.phNote}>
          {phStatus === 'Acidic' && 'Soil is too acidic. Consider applying lime.'}
          {phStatus === 'Neutral' && 'Soil pH is optimal for most crops.'}
          {phStatus === 'Alkaline' && 'Soil is alkaline. May affect nutrient availability.'}
        </Text>
      </View>

      <View style={{ marginBottom: 10 }}>
        {soilSupply ? (
          <Text style={{ textAlign: 'center', color: '#333' }}>
            Using soil-adjusted target → N {usedTarget.N.toFixed(1)}, P {usedTarget.P.toFixed(1)}, K {usedTarget.K.toFixed(1)} (soil supply N {soilSupply.N.toFixed(1)}, P {soilSupply.P.toFixed(1)}, K {soilSupply.K.toFixed(1)})
          </Text>
        ) : (
          <Text style={{ textAlign: 'center', color: '#555' }}>
            No 10-point summary found — using fixed target (120-70-70).
          </Text>
        )}
      </View>

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationTitle}>Rekomendasyon: <Text style={{ fontStyle: 'italic' }}>(Recommendation)</Text></Text>
        <Text style={styles.recommendationText}>Gumamit ng cost-efficient na kombinasyon batay sa kasalukuyang presyo at soil-adjusted na target.</Text>
        <Text style={styles.englishText}>Use the most cost-efficient combination based on current prices and a soil-adjusted target.</Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Fertilizer Recommendations</Text>

      {loading && <Text style={{ textAlign: 'center', marginVertical: 10 }}>Loading recommendation…</Text>}
      {errorText && <Text style={{ textAlign: 'center', color: 'red', marginBottom: 10 }}>{errorText}</Text>}

      {plans.map((opt, idx) => (
        <View key={idx} style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableTitle}>Fertilizer Recommendation – {idx + 1}</Text>
            <PriceTag cost={opt.totals?.cost ?? 0} />
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.cellHeader}>Fertilizer</Text>
            <Text style={styles.cellHeader}>Bags</Text>
            <Text style={styles.cellHeader}>Unit Price</Text>
            <Text style={styles.cellHeader}>Subtotal</Text>
          </View>

          {opt.items.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{it.label}</Text>
              <Text style={styles.cell}>{it.bags.toFixed(2)}</Text>
              <Text style={styles.cell}>₱{it.pricePerBag.toFixed(2)}</Text>
              <Text style={styles.cell}>₱{it.subTotal.toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.tableRow}>
            <Text style={[styles.cell, { fontWeight: 'bold' }]}>Totals (N,P,K kg)</Text>
            <Text style={styles.cell}>{(opt.totals?.N ?? 0).toFixed(1)}</Text>
            <Text style={styles.cell}>{(opt.totals?.P ?? 0).toFixed(1)}</Text>
            <Text style={styles.cell}>{(opt.totals?.K ?? 0).toFixed(1)}</Text>
          </View>
        </View>
      ))}

      {schedule && (
        <View style={[styles.table, { padding: 10 }]}>
          <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>🗓 Application Schedule</Text>
          <Text style={{ color: '#333' }}>{typeof schedule === 'string' ? schedule : JSON.stringify(schedule)}</Text>
        </View>
      )}

      <View style={styles.downloadToggle}>
        <Text style={styles.downloadLabel}></Text>
        <TouchableOpacity onPress={handleSavePDF}>
          <Text style={styles.downloadButton}>📄 Download PDF</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/admin/tabs/admin-home')}>
        <Text style={styles.buttonText}>Back to Home Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 23, backgroundColor: '#fff', flexGrow: 1, paddingBottom: 80 },
  logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: -30 },
  phBox: { backgroundColor: '#e8f5e9', padding: 14, borderRadius: 10, marginBottom: 16, alignItems: 'center' },
  phLabel: { fontSize: 14, color: '#2e7d32', fontWeight: 'bold' },
  phValue: { fontSize: 26, fontWeight: 'bold', color: '#1b5e20', marginVertical: 4 },
  phNote: { fontSize: 13, color: '#555', textAlign: 'center' },
  recommendationBox: { borderColor: '#4CAF50', borderWidth: 1.5, padding: 16, borderRadius: 10, marginBottom: 20 },
  recommendationTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 },
  recommendationText: { fontSize: 14, marginBottom: 8, color: '#222' },
  englishText: { fontSize: 13, color: '#555', fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#000', marginVertical: 20, borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  table: { marginBottom: 20, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f0f0f0', padding: 10 },
  tableTitle: { fontSize: 14, fontWeight: 'bold' },
  priceTag: { backgroundColor: '#5D9239', color: '#fff', fontWeight: 'bold', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, fontSize: 13 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd' },
  cellHeader: { flex: 1, padding: 10, fontWeight: 'bold', fontSize: 12, textAlign: 'center', backgroundColor: '#e8f5e9' },
  cell: { flex: 1, padding: 10, fontSize: 12, textAlign: 'center' },
  downloadToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, borderTopWidth: 3, borderColor: '#417d44ff', paddingVertical: 10 },
  downloadLabel: { color: '#444' },
  downloadButton: { fontSize: 15, color: '#550909', fontWeight: 'bold' },
  button: { backgroundColor: '#2e7d32', paddingVertical: 14, borderRadius: 50, marginTop: 20, marginBottom: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
});
