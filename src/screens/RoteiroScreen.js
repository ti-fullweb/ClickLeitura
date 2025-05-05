// RoteiroScreenRefatorado.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoteiroDoDia, // Função que busca/sincroniza o roteiro completo
  sincronizarAlteracoesPendentes, // Função para sincronizar tudo (era sincronizarLeiturasPendentes)
  getProgressoRoteiroLocal // Função que calcula progresso local (era getProgressoRoteiro)
} from '../services/syncRoteiro';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import eventBus from '../services/eventBus';
import { parseISO } from 'date-fns'; // Para converter string ISO para Date

// ID do leiturista para teste (do seed.sql)
const LEITURISTA_ID_TESTE = '8f9b7c6e-5d4a-4b3c-8a1f-9e0d2c1b3a0e';

const RoteiroScreen = ({ navigation }) => {
  const [roteiroCompleto, setRoteiroCompleto] = useState(null); // Armazena o objeto completo do roteiro
  const [roteiroAgrupado, setRoteiroAgrupado] = useState([]); // Roteiro agrupado por ruas para a FlatList
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataAtual, setDataAtual] = useState(new Date()); // Usar objeto Date
  const [progresso, setProgresso] = useState({ total: 0, visitadas: 0, pendentes: 0, percentual: 0 });
  const { isConnected } = useNetworkStatus();

  // Função auxiliar para formatar Date para YYYY-MM-DD
  function formatarDataISO(data) {
    if (!data || !(data instanceof Date)) return '';
    return data.toISOString().split('T')[0];
  }

  // Função para formatar Date para exibição (ex: 30 de abril de 2025)
  function formatarDataExibicao(data) {
    if (!data || !(data instanceof Date)) return 'Data inválida';
    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    // Usar getUTCDate, getUTCMonth, getUTCFullYear para evitar problemas de fuso horário na exibição
    return `${data.getUTCDate().toString().padStart(2, '0')} de ${meses[data.getUTCMonth()]} de ${data.getUTCFullYear()}`;
  }

  // Função para agrupar residências por rua
  const agruparPorRua = (roteiroResidencias) => {
    if (!roteiroResidencias || roteiroResidencias.length === 0) {
      return [];
    }
    const grupos = roteiroResidencias.reduce((acc, rr) => {
      // Acessar o nome da rua através da estrutura aninhada
      const ruaNome = rr.residencias?.ruas?.nome || 'Rua Desconhecida';
      if (!acc[ruaNome]) {
        acc[ruaNome] = { ruaNome: ruaNome, residencias: [] };
      }
      acc[ruaNome].residencias.push(rr); // Adiciona o objeto roteiro_residencia inteiro
      return acc;
    }, {});
    return Object.values(grupos); // Retorna um array de grupos
  };


  useEffect(() => { carregarRoteiro(); }, [dataAtual]); // Recarrega quando a data muda

  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      setRoteiroAgrupado([]); // Limpa antes de carregar
      setRoteiroCompleto(null);

      // Chama a função do serviço com ID e Data
      const dados = await getRoteiroDoDia(LEITURISTA_ID_TESTE, dataAtual);
      setRoteiroCompleto(dados); // Salva o roteiro completo

      if (dados && dados.roteiro_residencias) {
        const agrupado = agruparPorRua(dados.roteiro_residencias);
        setRoteiroAgrupado(agrupado); // Salva o roteiro agrupado para a lista
      } else {
        setRoteiroAgrupado([]); // Garante que está vazio se não houver dados
      }

      // Calcula o progresso usando a função local
      const progressoAtual = await getProgressoRoteiroLocal(LEITURISTA_ID_TESTE, dataAtual);
      setProgresso(progressoAtual);

    } catch (error) {
      console.error("Erro em carregarRoteiro:", error);
      Alert.alert('Erro', 'Não foi possível carregar o roteiro.');
      setRoteiroCompleto(null);
      setRoteiroAgrupado([]);
      setProgresso({ total: 0, visitadas: 0, pendentes: 0, percentual: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isConnected) {
      try {
        // Chama a função de sincronização correta
        const resultado = await sincronizarAlteracoesPendentes(); // Ainda é uma implementação pendente no serviço
        if (resultado.success > 0 || resultado.failed > 0) { // Mostrar alerta mesmo se falhar
           Alert.alert('Sincronização', `${resultado.success} sucesso(s), ${resultado.failed} falha(s).`);
        } else if (!resultado.offline) {
           Alert.alert('Sincronização', 'Nenhuma alteração pendente encontrada.');
        }
      } catch (err) {
         console.error("Erro ao sincronizar pendentes:", err);
         Alert.alert('Erro', 'Falha ao sincronizar alterações pendentes.');
      }
    } else {
      Alert.alert('Offline', 'Sem conexão. As alterações serão sincronizadas depois.');
    }
    // Recarrega o roteiro após tentar sincronizar
    await carregarRoteiro();
  };

  // Atualiza a navegação para usar a nova estrutura de dados (item de roteiro_residencias)
  const visitarEndereco = (itemRoteiroResidencia) => {
     // Define se a visita já foi feita com base no status
     const statusVisitado = ['concluido_com_leitura', 'concluido_sem_leitura', 'impedido'];
     const foiVisitado = statusVisitado.includes(itemRoteiroResidencia.status);

     // TODO: Determinar se existe uma leitura associada para ir para ReadingDetails
     // Por enquanto, vamos sempre para LeituraRoteiro
     const destino = 'LeituraRoteiro'; // Ou 'ReadingDetails' se já houver leitura

     const params = {
       // Passar o objeto roteiro_residencia inteiro pode ser útil
       roteiroResidencia: itemRoteiroResidencia,
       // Passar IDs e informações chave explicitamente também é bom
       roteiroResidenciaId: itemRoteiroResidencia.id,
       residenciaId: itemRoteiroResidencia.residencia_id,
       hidrometroNumero: itemRoteiroResidencia.residencias?.hidrometro_numero,
       enderecoFormatado: `${itemRoteiroResidencia.residencias?.ruas?.nome}, ${itemRoteiroResidencia.residencias?.numero}`,
       leituraAnterior: itemRoteiroResidencia.leitura_anterior_snapshot,
       dataRoteiroISO: formatarDataISO(dataAtual), // Passar a data como string ISO
       leituristaId: LEITURISTA_ID_TESTE,
     };

     console.log("Navegando para:", destino, "com params:", params);
     navigation.navigate(destino, params);
  };

  // Adicionar listener de foco para recarregar o roteiro e emitir evento
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', async () => {
      console.log('RoteiroScreen ganhou foco, recarregando dados...');
      // Não precisa chamar carregarRoteiro aqui necessariamente se a atualização
      // for feita na tela de leitura e o eventBus for usado corretamente.
      // Mas vamos manter por segurança por enquanto.
      await carregarRoteiro();
      eventBus.emit('leituraAtualizada'); // Emitir evento para atualizar HomeScreen
    });

    // Listener para quando uma leitura for salva na outra tela
    const handleLeituraSalva = async () => {
        console.log("Evento 'leituraSalva' recebido, recarregando roteiro...");
        await carregarRoteiro(); // Recarrega para refletir o novo status
    };
    eventBus.on('leituraSalva', handleLeituraSalva);


    return () => {
      unsubscribeFocus();
      eventBus.off('leituraSalva', handleLeituraSalva); // Limpa o listener
    };
  }, [navigation, dataAtual]); // Adicionar dataAtual como dependência

  // Renderiza um item de endereço (agora recebe um item de roteiro_residencias)
  const renderEnderecoItem = (item, index) => {
    const statusVisitado = ['concluido_com_leitura', 'concluido_sem_leitura', 'impedido'];
    const foiVisitado = statusVisitado.includes(item.status);

    // Formata o status para exibição
    let statusTexto = 'Pendente';
    let statusIcon = 'time-outline';
    let statusColor = '#f59e0b'; // Amarelo/Laranja para pendente

    if (item.status === 'concluido_com_leitura' || item.status === 'concluido_sem_leitura') {
        statusTexto = 'Concluído';
        statusIcon = 'checkmark-circle';
        statusColor = '#22c55e'; // Verde para concluído
    } else if (item.status === 'impedido') {
        statusTexto = 'Impedido';
        statusIcon = 'alert-circle';
        statusColor = '#ef4444'; // Vermelho para impedido
    }

    return (
      <TouchableOpacity
        key={`rr-${item.id}-${index}`} // Usar ID de roteiro_residencias
        style={[styles.enderecoItem, foiVisitado && styles.enderecoVisitado]}
        onPress={() => visitarEndereco(item)} // Passa o item completo
      >
        <View style={styles.enderecoNumero}>
          {/* Usar a ordem de visita */}
          <Text style={styles.numeroText}>{String(item.ordem)}</Text>
        </View>
        <View style={styles.enderecoInfo}>
          {/* Exibir endereço e hidrômetro */}
          <Text style={styles.clienteNome} numberOfLines={1}>
            {item.residencias?.ruas?.nome}, {item.residencias?.numero} {item.residencias?.complemento || ''}
          </Text>
          <Text style={styles.clienteId}>Hidrômetro: {item.residencias?.hidrometro_numero || 'N/A'}</Text>
        </View>
        <View style={styles.enderecoStatus}>
          <View style={styles.statusContainer}>
            <Ionicons name={statusIcon} size={20} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusTexto}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Renderiza um grupo de rua (recebe o objeto do grupo)
  const renderRuaItem = ({ item: grupo, index }) => (
    <View style={styles.ruaContainer} key={`rua-${grupo.ruaNome}-${index}`}>
      <View style={styles.ruaHeader}>
        <Ionicons name="location-outline" size={20} color="#3b82f6" />
        <Text style={styles.ruaTitle}>{String(grupo.ruaNome)}</Text>
      </View>
      {/* Mapeia as residências dentro do grupo */}
      {Array.isArray(grupo.residencias) && grupo.residencias.length > 0
        ? grupo.residencias.map((residenciaItem, i) => renderEnderecoItem(residenciaItem, i))
        : <Text style={styles.noCasasText}>Nenhuma residência nesta rua.</Text>}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Carregando roteiro...</Text>
      </View>
    );
  }

  // Usar roteiroAgrupado para a FlatList
  const dataFormatadaExibicao = formatarDataExibicao(dataAtual);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Roteiro do Dia</Text>
        <Text style={styles.headerDate}>{dataFormatadaExibicao}</Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.connectionIndicator, isConnected ? styles.online : styles.offline]} />
          <Text style={styles.connectionText}>{isConnected ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {progresso.total > 0 ? `${progresso.visitadas} de ${progresso.total} residências visitadas` : 'Nenhuma residência no roteiro'}
          </Text>
          <Text style={styles.progressPercent}>{`${progresso.percentual.toFixed(0)}%`}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progresso.percentual}%` }]} />
        </View>
      </View>

      <FlatList
        data={roteiroAgrupado} // Usar os dados agrupados
        renderItem={renderRuaItem}
        keyExtractor={(item, index) => `rua-${item.ruaNome}-${index}`} // Chave baseada no nome da rua
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3b82f6"]} tintColor="#3b82f6" />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={64} color="#94a3b8" />
            {/* Ajustar texto de vazio */}
            <Text style={styles.emptyText}>{loading ? 'Carregando...' : `Nenhum endereço no roteiro para ${dataFormatadaExibicao}.`}</Text>
            <Text style={styles.emptySubText}>Verifique a data ou tente atualizar.</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing || loading}>
              <Text style={styles.refreshButtonText}>{refreshing ? 'Atualizando...' : 'Atualizar Roteiro'}</Text>
            </TouchableOpacity>
          </View>
        )}
        // Ajustar estilo do container vazio
        contentContainerStyle={roteiroAgrupado.length === 0 ? styles.emptyListContent : { paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#64748b' },
  header: { backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  headerDate: { fontSize: 15, color: '#475569', marginTop: 4 },
  connectionStatus: { position: 'absolute', top: 18, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  connectionIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  online: { backgroundColor: '#22c55e' },
  offline: { backgroundColor: '#f97316' },
  connectionText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  progressContainer: { padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressText: { fontSize: 14, color: '#334155' },
  progressPercent: { fontSize: 14, fontWeight: 'bold', color: '#3b82f6' },
  progressBarContainer: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  ruaContainer: {},
  ruaHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  ruaTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginLeft: 8, flex: 1 },
  enderecoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  enderecoVisitado: { backgroundColor: '#f0fdf4' },
  enderecoNumero: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  numeroText: { fontSize: 14, fontWeight: 'bold', color: '#0284c7' },
  enderecoInfo: { flex: 1, marginRight: 8 },
  clienteNome: { fontSize: 15, fontWeight: '500', color: '#1e293b' },
  clienteId: { fontSize: 12, color: '#64748b', marginTop: 2 },
  enderecoStatus: { alignItems: 'flex-end' },
  statusVisitado: { flexDirection: 'row', alignItems: 'center' },
  statusPendente: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 12, marginLeft: 4, color: '#64748b' },
  noCasasText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 40 },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { fontSize: 17, fontWeight: '500', color: '#475569', textAlign: 'center', marginTop: 16 },
  emptySubText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  refreshButton: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#3b82f6', borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  refreshButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});

export default RoteiroScreen;
