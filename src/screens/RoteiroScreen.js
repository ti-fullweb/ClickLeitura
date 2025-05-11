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
  RefreshControl,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoteiroDoDia, // Função que busca/sincroniza o roteiro completo
  sincronizarAlteracoesPendentes, // Função para sincronizar tudo (era sincronizarLeiturasPendentes)
  getProgressoRoteiroLocal, // Função que calcula progresso local (era getProgressoRoteiro)
} from '../services/syncRoteiro'; // Manter importações diretas para funções usadas
import * as syncRoteiroService from '../services/syncRoteiro'; // Importar o módulo inteiro como alias
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppContext } from '../context/AppContext'; // Importar useAppContext
import eventBus from '../services/eventBus';
import { parseISO } from 'date-fns'; // Para converter string ISO para Date
import { storage } from '../utils/storage'; // Importar MMKV storage (para dados do leiturista)
import StandardLayout from '../components/layouts/StandardLayout';

// ID do leiturista para teste (do seed.sql) - Manter comentado ou remover se não for mais necessário
// const LEITURISTA_ID_TESTE = '8f9b7c6e-5d4a-4b3c-8a1f-9e0d2c1b3a0e';

const RoteiroScreen = ({ navigation }) => {
  const [roteiroCompleto, setRoteiroCompleto] = useState(null); // Armazena o objeto completo do roteiro
  const [roteiroAgrupado, setRoteiroAgrupado] = useState([]); // Roteiro agrupado por ruas para a FlatList
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataAtual, setDataAtual] = useState(new Date()); // Usar objeto Date
  const [progresso, setProgresso] = useState({ total: 0, visitadas: 0, pendentes: 0, percentual: 0 });
  const { isConnected } = useNetworkStatus();
  const { getReadingByRoteiroResidenciaId } = useAppContext(); // Obter a função do contexto

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

      // Obter o ID do leiturista logado do MMKV
      console.log("Tentando obter leiturista do MMKV...");
      const leituristaString = storage.getString('leiturista');
      console.log("Resultado storage.getString('leiturista'):", leituristaString);
      let leituristaId = null;
      let leituristaData = null; // Declarar leituristaData aqui

      if (leituristaString) {
        try {
          leituristaData = JSON.parse(leituristaString); // Atribuir ao leituristaData
          console.log("Dados do leiturista parseados:", leituristaData);
          // Verificar se leituristaData é um objeto válido e tem a propriedade id
          if (leituristaData && typeof leituristaData === 'object' && leituristaData.id) {
             leituristaId = leituristaData.id; // Usar o ID do registro na tabela leituristas
             console.log("Leiturista ID obtido do MMKV:", leituristaId);
          } else {
             console.warn("Dados do leiturista no MMKV inválidos ou sem ID.");
          }
        } catch (parseError) {
          console.error("Erro ao parsear dados do leiturista do MMKV em LeituraRoteiroScreen:", parseError);
          // leituristaId permanece null
        }
      } else {
         console.warn("Nenhum dado de leiturista encontrado no MMKV.");
      }


      if (!leituristaId) {
        console.warn("Leiturista ID final é null. Não é possível carregar o roteiro.");
        setLoading(false);
        setRefreshing(false);
        Alert.alert("Erro", "Dados do leiturista não encontrados. Por favor, faça login novamente.");
        // Opcional: Redirecionar para a tela de login
        // navigation.navigate('Login');
        return;
      }


      // Chama a função do serviço com ID e Data
      const dados = await getRoteiroDoDia(leituristaId, dataAtual);
      setRoteiroCompleto(dados); // Salva o roteiro completo

      // Gerar a chave de armazenamento usando a função helper do alias
      const storageKey = syncRoteiroService.getRoteiroStorageKey(leituristaId, dataAtual);
      console.log("Chave de armazenamento do roteiro:", storageKey);

      if (dados) { // Verificar se dados não é null
        // Salvar o roteiro completo no MMKV usando a instância do alias e a chave correta
        syncRoteiroService.roteiroStorage.set(storageKey, JSON.stringify(dados));
        console.log(`Roteiro do dia (${storageKey}) salvo no MMKV.`);

        if (dados.roteiro_residencias) {
           const agrupado = agruparPorRua(dados.roteiro_residencias);
           setRoteiroAgrupado(agrupado); // Salva o roteiro agrupado para a lista
        } else {
           setRoteiroAgrupado([]); // Garante que está vazio se não houver residências
        }

      } else {
        setRoteiroAgrupado([]); // Garante que está vazio se não houver dados
        // Remover roteiro antigo se não houver novo, usando a chave correta
        if (syncRoteiroService.roteiroStorage.contains(storageKey)) { // Corrigido: usar alias
           syncRoteiroService.roteiroStorage.delete(storageKey); // Corrigido: usar alias
           console.log(`Nenhum roteiro encontrado, removendo roteiro antigo (${storageKey}) do MMKV.`);
        } else {
           console.log(`Nenhum roteiro encontrado e nenhuma chave (${storageKey}) no MMKV para remover.`);
        }
      }


      // Calcula o progresso usando a função local
      // Precisa passar o leituristaId correto aqui também
      const progressoAtual = await getProgressoRoteiroLocal(leituristaId, dataAtual);
      setProgresso(progressoAtual);

    } catch (error) {
      console.error("Erro em carregarRoteiro:", error);
      Alert.alert('Erro', 'Não foi possível carregar o roteiro.');
      setRoteiroCompleto(null);
      setRoteiroAgrupado([]);
        setProgresso({ total: 0, visitadas: 0, pendentes: 0, percentual: 0 });
      // Limpar MMKV em caso de erro, usando a instância do alias e a chave correta
      const storageKeyOnError = syncRoteiroService.getRoteiroStorageKey(leituristaId, dataAtual);
      if (syncRoteiroService.roteiroStorage.contains(storageKeyOnError)) { // Corrigido: usar alias
         syncRoteiroService.roteiroStorage.delete(storageKeyOnError); // Corrigido: usar alias
         console.log(`Roteiro (${storageKeyOnError}) removido do MMKV devido a erro.`);
      }
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
  const visitarEndereco = async (itemRoteiroResidencia) => {
    // Define se a visita já foi feita com base no status
    const statusVisitado = ['concluido_com_leitura', 'concluido_sem_leitura', 'impedido'];
    const foiVisitado = statusVisitado.includes(itemRoteiroResidencia.status);

    // Determinar o destino com base no status da residência
    let destino = 'LeituraRoteiro'; // Destino padrão para registrar leitura
    let params = {
      roteiroResidencia: itemRoteiroResidencia,
      roteiroResidenciaId: itemRoteiroResidencia.id,
      residenciaId: itemRoteiroResidencia.residencia_id,
      hidrometroNumero: itemRoteiroResidencia.residencias?.hidrometro_numero,
      enderecoFormatado: `${itemRoteiroResidencia.residencias?.ruas?.nome}, ${itemRoteiroResidencia.residencias?.numero}`,
      leituraAnterior: itemRoteiroResidencia.leitura_anterior_snapshot,
      dataRoteiroISO: formatarDataISO(dataAtual),
    };

    if (itemRoteiroResidencia.status === 'concluido_com_leitura' || itemRoteiroResidencia.status === 'concluido_sem_leitura') {
      destino = 'ReadingDetails'; // Se já tem leitura, vai para detalhes
      try {
        console.log(`Buscando leitura para roteiroResidenciaId: ${itemRoteiroResidencia.id}`);
        const reading = await getReadingByRoteiroResidenciaId(itemRoteiroResidencia.id);
        if (reading && reading.id) {
          params.readingId = reading.id; // Adicionar o ID da leitura aos parâmetros
          console.log(`Leitura encontrada com ID: ${reading.id}. Navegando para ReadingDetails.`);
        } else {
          Alert.alert('Erro', 'Não foi possível encontrar os dados da leitura salva para este endereço.');
          console.warn(`Leitura não encontrada para roteiroResidenciaId: ${itemRoteiroResidencia.id}`);
          return; // Não navegar se a leitura não for encontrada
        }
      } catch (error) {
        Alert.alert('Erro', 'Ocorreu um erro ao buscar os dados da leitura.');
        console.error('Erro ao buscar leitura por roteiroResidenciaId:', error);
        return; // Não navegar em caso de erro
      }
    }
    // TODO: Adicionar lógica para ir para ReadingDetails se houver leitura salva localmente
    // mesmo que o status no roteiro ainda não reflita isso (sincronização pendente)

    console.log("Navegando para:", destino, "com params:", params);
    navigation.navigate(destino, params);
  };

  // Adicionar listener de foco para recarregar o roteiro e emitir evento
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', async () => {
      console.log('RoteiroScreen ganhou foco, recarregando dados...');
      // Recarrega o roteiro ao focar na tela
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
    <StandardLayout title="Seu Roteiro do Dia" disableScroll={true}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <View style={styles.header}>
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
            {/* Ajustar texto de vazio para ser mais claro */}
            <Text style={styles.emptyText}>{loading ? 'Carregando...' : `Não há leituras agendadas para ${dataFormatadaExibicao}.`}</Text>
            <Text style={styles.emptySubText}>Verifique a data ou tente sincronizar para obter o roteiro mais recente.</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing || loading}>
              <Text style={styles.refreshButtonText}>{refreshing ? 'Atualizando...' : 'Atualizar Roteiro'}</Text>
            </TouchableOpacity>
          </View>
        )}
        // Ajustar estilo do container vazio
        contentContainerStyle={roteiroAgrupado.length === 0 ? styles.emptyListContent : { paddingBottom: 20 }}
      />
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: { flex: 1, backgroundColor: '#f8fafc' },
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
