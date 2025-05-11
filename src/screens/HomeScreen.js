
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import eventBus from '../services/eventBus';
import { sincronizarComWebhook } from '../services/syncWebhookService';
import { sincronizarLeiturasPendentes } from '../services/syncLeiturasSupabase'; // novo import
import { storage } from '../utils/storage';
import { getProgressoRoteiroLocal } from '../services/syncRoteiro'; // Importar getProgressoRoteiro
import StandardLayout from '../components/layouts/StandardLayout';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [percentage, setPercentage] = useState(0); // Estado para a porcentagem
  const [isConnected, setIsConnected] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  const fetchData = async () => {
    try {
      const leituristaString = storage.getString('leiturista');
      if (!leituristaString) {
        console.warn("Leiturista não encontrado no MMKV para HomeScreen.");
        Alert.alert("Erro", "Dados do leiturista não encontrados. Faça login novamente.");
        setTotal(0);
        setCompleted(0);
        setPending(0);
        setPercentage(0);
        setLastSync(new Date());
        return;
      }

      const leituristaData = JSON.parse(leituristaString);
      const leituristaId = leituristaData?.id;

      if (!leituristaId) {
        console.warn("ID do Leiturista inválido ou não encontrado nos dados do MMKV.");
        Alert.alert("Erro", "ID do leiturista inválido. Faça login novamente.");
        setTotal(0);
        setCompleted(0);
        setPending(0);
        setPercentage(0);
        setLastSync(new Date());
        return;
      }

      // Calcular a data atual no formato ISO (apenas data)
      const today = new Date();
      // const dataAtualISO = today.toISOString().split('T')[0]; // Usar o objeto Date diretamente

      // Obter o progresso do roteiro para o dia atual
      const progressoRoteiro = await getProgressoRoteiroLocal(leituristaId, today);

      // Atualizar os estados com os dados do progresso do roteiro
      setTotal(progressoRoteiro.total);
      setCompleted(progressoRoteiro.visitadas);
      setPending(progressoRoteiro.pendentes);
      const perc = progressoRoteiro.total > 0 ? (progressoRoteiro.visitadas / progressoRoteiro.total) * 100 : 0;
      setPercentage(perc);

      setLastSync(new Date()); // Atualizar hora da última busca/sincronização visual
    } catch (error) {
      console.error("Erro ao buscar dados do roteiro para o resumo do dia:", error);
      // Manter os valores como 0 em caso de erro
      setTotal(0);
      setCompleted(0);
      setPending(0);
      setPercentage(0);
      setLastSync(new Date());
    }
  };

  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    const unsubscribeFocus = navigation.addListener('focus', fetchData);
    const listener = () => fetchData();

    eventBus.on('leituraAtualizada', listener);

    fetchData();

    return () => {
      unsubscribeNetInfo();
      unsubscribeFocus();
      eventBus.off('leituraAtualizada', listener);
    };
  }, [navigation]);

  const formatDate = (date) =>
    new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);

  const formatTime = (date) =>
    date ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}` : '--:--';

const handleSync = async () => {
  console.log("📲 Botão de sincronizar pressionado");
  const resultado = await sincronizarLeiturasPendentes();

  let alertTitle = "Erro"; // Padrão para erro

  if (resultado.success) {
    // Se sucesso, verifica a mensagem para determinar o título
    if (resultado.message.includes("Nenhuma leitura válida para sincronizar encontrada") || resultado.message.includes("Nenhuma leitura pendente para sincronizar")) {
      alertTitle = "Alerta";
    } else {
      alertTitle = "Sucesso";
    }
  }

  Alert.alert(alertTitle, resultado.message);

  console.log("📊 Resultado da sincronização:", resultado);
  await fetchData(); // Recarregar progresso após sync
};

const mostrarLeiturasPendentes = () => {
  const leiturasJson = storage.getString('leiturasPendentes');
  if (!leiturasJson) {
    Alert.alert("Info", "Nenhuma leitura pendente.");
    return;
  }
  const leituras = JSON.parse(leiturasJson);
  console.log("🔎 Leituras pendentes:", leituras);
  Alert.alert("Info", `Total pendentes: ${leituras.length}`);
};

  return (
    <StandardLayout title="Painel Principal">
      <View style={styles.statusBar}>
        <Ionicons name={isConnected ? "wifi" : "wifi-off"} size={16} color={isConnected ? "#047857" : "#ef4444"} style={{ marginRight: 8 }} />
        <Text style={styles.statusText}>
          {isConnected ? "ONLINE" : "OFFLINE"} | Última Sync: {formatTime(lastSync)}
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.syncBtn]} onPress={handleSync}>
          <View style={styles.iconWrapper}><Feather name="refresh-cw" size={24} color="white" /></View>
          <Text style={styles.buttonText}>Sincronizar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#f59e0b' }]} onPress={mostrarLeiturasPendentes}>
          <View style={styles.iconWrapper}><Feather name="eye" size={24} color="white" /></View>
          <Text style={styles.buttonText}>Ver Pendentes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.routeBtn]} 
          onPress={() => navigation.navigate('Main', { screen: 'Roteiro' })}
        >
          <View style={styles.iconWrapper}><Feather name="map" size={24} color="white" /></View>
          <Text style={styles.buttonText}>Rota do Dia</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#e0f2fe' }]}>
            <Feather name="user" size={20} color="#0369a1" />
          </View>
          <View>
            <Text style={styles.cardTitle}>Olá, Leiturista</Text>
            <Text style={styles.cardSubtitle}>Bem-vindo ao seu painel de controle.</Text>
          </View>
        </View>
        <View style={styles.dateRow}>
          <Feather name="calendar" size={16} color="#475569" />
          <Text style={styles.dateText}> {formatDate(new Date())}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: '#dbeafe' }]}>
            <Feather name="activity" size={20} color="#1e40af" />
          </View>
          <Text style={styles.cardTitle}>Resumo do Dia</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statsItem, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.statsValue, { color: '#2563eb' }]}>{total}</Text>
            <Text style={styles.statsLabel}>Total</Text>
          </View>
          <View style={[styles.statsItem, { backgroundColor: '#ecfdf5' }]}>
            <Text style={[styles.statsValue, { color: '#10b981' }]}>{completed}</Text>
            <Text style={styles.statsLabel}>Completas</Text>
          </View>
          <View style={[styles.statsItem, { backgroundColor: '#fff7ed' }]}>
            <Text style={[styles.statsValue, { color: '#f97316' }]}>{pending}</Text>
            <Text style={styles.statsLabel}>Pendentes</Text>
          </View>
        </View>
      </View>
    </StandardLayout>
  );
}

const styles = StyleSheet.create({
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: { backgroundColor: '#f5f7fa' },
  // header: { backgroundColor: '#1e40af', padding: 16 },
  // headerText: { color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#d1fae5' },
  statusText: { color: '#047857', fontWeight: '500', fontSize: 14 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, gap: 12, flexWrap: 'wrap' },
  actionButton: { flexBasis: '45%', minWidth: 140, borderRadius: 12, padding: 12, alignItems: 'center' },
  syncBtn: { backgroundColor: '#10b981' },
  routeBtn: { backgroundColor: '#1d4ed8' },
  iconWrapper: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  buttonText: { color: 'white', fontWeight: '600' },
  card: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1e3a8a' },
  cardSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dateText: { color: '#475569', marginLeft: 6, fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statsItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  statsValue: { fontSize: 24, fontWeight: 'bold' },
  statsLabel: { fontSize: 12, marginTop: 4, fontWeight: '500' }
});
