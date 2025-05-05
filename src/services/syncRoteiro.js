import { MMKV } from "react-native-mmkv";
import { sincronizarComWebhook } from './syncWebhookService';
import NetInfo from '@react-native-community/netinfo';
import { getRoteiroDoDia as getRoteiroDoSupabase } from './supabase'; // Renomeado para evitar conflito
import { format, parseISO } from 'date-fns'; // Adicionar parseISO

// Instância do MMKV para roteiros
const roteiroStorage = new MMKV({ id: 'roteiro-storage' });

// Helper para gerar a chave do MMKV
const getRoteiroStorageKey = (leituristaId, dataRoteiro) => {
  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd');
  return `roteiro-${leituristaId}-${dataFormatada}`;
};

/**
 * Sincroniza (busca do Supabase e salva localmente) o roteiro de um leiturista para uma data.
 * @param {string} leituristaId - O UUID do leiturista.
 * @param {Date} dataRoteiro - O objeto Date da data do roteiro.
 * @returns {Promise<object|null>} - O objeto do roteiro sincronizado ou null em caso de erro/offline sem dados locais.
 */
export const syncRoteiroDoDia = async (leituristaId, dataRoteiro) => {
  const storageKey = getRoteiroStorageKey(leituristaId, dataRoteiro);
  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd');

  try {
    console.log(`Tentando sincronizar roteiro: Leiturista ${leituristaId}, Data: ${dataFormatada}`);
    const netInfo = await NetInfo.fetch();

    if (netInfo.isConnected) {
      console.log('Online: Buscando roteiro do Supabase...');
      const roteiroDoSupabase = await getRoteiroDoSupabase(leituristaId, dataRoteiro);

      if (roteiroDoSupabase) {
        // Salvar no MMKV
        roteiroStorage.set(storageKey, JSON.stringify(roteiroDoSupabase));
        console.log(`Roteiro (${dataFormatada}) salvo localmente no MMKV.`);
        return roteiroDoSupabase;
      } else {
        console.warn(`Nenhum roteiro encontrado no Supabase para ${dataFormatada}. Verificando local...`);
        // Se não encontrou no Supabase, mas estava online, pode não existir mesmo.
        // Limpa o local para garantir consistência, caso exista um antigo.
        if (roteiroStorage.contains(storageKey)) {
            console.log(`Removendo roteiro local antigo para ${dataFormatada}`);
            roteiroStorage.delete(storageKey);
        }
        return null; // Retorna null pois não existe no Supabase
      }
    } else {
      console.log('Offline: Tentando carregar roteiro do MMKV...');
      const dadosLocais = roteiroStorage.getString(storageKey);
      if (dadosLocais) {
        console.log(`Roteiro (${dataFormatada}) carregado do MMKV (offline).`);
        return JSON.parse(dadosLocais);
      } else {
        console.warn(`Offline e sem roteiro local para ${dataFormatada}.`);
        return null; // Offline e sem dados locais
      }
    }
  } catch (error) {
    console.error(`Erro ao sincronizar roteiro (${dataFormatada}):`, error);
    // Tentar carregar do local em caso de erro na sincronização
    const dadosLocais = roteiroStorage.getString(storageKey);
    return dadosLocais ? JSON.parse(dadosLocais) : null;
  }
};

/**
 * Obtém o roteiro do dia, priorizando o armazenamento local (MMKV) e sincronizando se necessário.
 * @param {string} leituristaId - O UUID do leiturista.
 * @param {Date} dataRoteiro - O objeto Date da data do roteiro.
 * @returns {Promise<object|null>} - O objeto do roteiro ou null se não encontrado.
 */
export const getRoteiroDoDia = async (leituristaId, dataRoteiro) => {
  const storageKey = getRoteiroStorageKey(leituristaId, dataRoteiro);
  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd');

  try {
    // Tentar carregar do MMKV primeiro
    const dadosLocais = roteiroStorage.getString(storageKey);

    if (dadosLocais) {
      console.log(`Roteiro (${dataFormatada}) encontrado localmente no MMKV.`);
      // TODO: Adicionar verificação opcional de "validade" dos dados locais?
      return JSON.parse(dadosLocais);
    } else {
      console.log(`Roteiro (${dataFormatada}) não encontrado localmente, tentando sincronizar...`);
      // Se não tiver localmente, tentar sincronizar do Supabase
      return await syncRoteiroDoDia(leituristaId, dataRoteiro);
    }
  } catch (error) {
    console.error(`Erro ao obter roteiro do dia (${dataFormatada}) do MMKV:`, error);
    // Em caso de erro na leitura local, tentar sincronizar como fallback
    return await syncRoteiroDoDia(leituristaId, dataRoteiro);
  }
};

/**
 * Marca uma residência específica dentro de um roteiro como visitada no MMKV.
 * @param {string} leituristaId - O UUID do leiturista.
 * @param {Date} dataRoteiro - O objeto Date da data do roteiro.
 * @param {string} roteiroResidenciaId - O UUID da entrada em roteiro_residencias a ser atualizada.
 * @param {string} novoStatus - O novo status da visita (ex: 'concluido_com_leitura', 'impedido').
 * @param {Date} [visitadoEm=new Date()] - Timestamp da visita.
 * @returns {Promise<boolean>} - Sucesso da operação.
 */
export const marcarComoVisitadaLocal = async (leituristaId, dataRoteiro, roteiroResidenciaId, novoStatus, visitadoEm = new Date()) => {
  const storageKey = getRoteiroStorageKey(leituristaId, dataRoteiro);
  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd');

  try {
    console.warn("marcarComoVisitadaLocal: Esta função atualiza apenas o MMKV. A sincronização com Supabase precisa ser feita separadamente.");

    const dadosRoteiroString = roteiroStorage.getString(storageKey);
    if (!dadosRoteiroString) {
      console.error(`Erro: Roteiro (${dataFormatada}) não encontrado localmente para marcar visita.`);
      return false;
    }

    const roteiro = JSON.parse(dadosRoteiroString);

    // Encontrar a residência específica no roteiro local
    const residenciaIndex = roteiro.roteiro_residencias.findIndex(rr => rr.id === roteiroResidenciaId);

    if (residenciaIndex === -1) {
      console.error(`Erro: Residência com ID ${roteiroResidenciaId} não encontrada no roteiro local (${dataFormatada}).`);
      return false;
    }

    // Atualizar o status e a data da visita
    roteiro.roteiro_residencias[residenciaIndex].status = novoStatus;
    roteiro.roteiro_residencias[residenciaIndex].visitado_em = visitadoEm.toISOString(); // Salvar como ISO string

    // Salvar o roteiro atualizado de volta no MMKV
    roteiroStorage.set(storageKey, JSON.stringify(roteiro));
    console.log(`Residência ${roteiroResidenciaId} marcada como ${novoStatus} no roteiro local (${dataFormatada}).`);

    // TODO: Adicionar a lógica para enfileirar esta atualização para sincronização posterior com o Supabase/Webhook.

    return true;
  } catch (error) {
    console.error('Erro ao marcar casa como visitada:', error);
    return false;
  }
};

// --- Funções de Sincronização com Backend (Webhook/Supabase) ---
// Estas funções precisam ser implementadas/adaptadas para enviar
// as alterações locais (status de visita, novas leituras) para o backend.

/**
 * Envia a atualização de status de uma visita para o backend.
 * (Implementação depende do endpoint: Supabase direto ou Webhook N8N)
 * @param {string} roteiroResidenciaId
 * @param {string} novoStatus
 * @param {string} visitadoEmISOString
 */
const sincronizarAtualizacaoVisita = async (roteiroResidenciaId, novoStatus, visitadoEmISOString) => {
  console.warn("sincronizarAtualizacaoVisita: Implementação pendente.");
  // Exemplo (Supabase direto):
  // const { error } = await supabase
  //   .from('roteiro_residencias')
  //   .update({ status: novoStatus, visitado_em: visitadoEmISOString })
  //   .eq('id', roteiroResidenciaId);
  // if (error) console.error("Erro ao sincronizar status da visita:", error);

  // Exemplo (Webhook):
  // await sincronizarComWebhook('/webhook/visita', { id: roteiroResidenciaId, status: novoStatus, visitado_em: visitadoEmISOString });
  return true; // Simular sucesso por enquanto
};

/**
 * Envia uma nova leitura para o backend.
 * (Implementação depende do endpoint)
 * @param {object} dadosLeitura - Objeto contendo os dados da leitura a serem enviados.
 */
const sincronizarNovaLeitura = async (dadosLeitura) => {
   console.warn("sincronizarNovaLeitura: Implementação pendente.");
   // Exemplo (Supabase direto):
   // const { error } = await supabase.from('leituras').insert([dadosLeitura]);
   // if (error) console.error("Erro ao sincronizar nova leitura:", error);

   // Exemplo (Webhook):
   // await sincronizarComWebhook('/webhook/leitura', dadosLeitura);
   return true; // Simular sucesso por enquanto
};


/**
 * Tenta sincronizar todas as alterações locais pendentes (visitas, leituras).
 * Esta função precisaria de uma forma de rastrear o que foi alterado localmente.
 * Usar um banco de dados local como WatermelonDB simplificaria isso enormemente.
 * Com MMKV, seria necessário um mecanismo manual (ex: outra chave MMKV para 'pendentes').
 * @returns {Promise<Object>} - Resultados da sincronização.
 */
export const sincronizarAlteracoesPendentes = async () => {
  console.warn("sincronizarAlteracoesPendentes: Lógica complexa com MMKV, implementação pendente.");

  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("Offline, sincronização de pendentes adiada.");
      return { success: 0, failed: 0, offline: true };
    }

    console.log("Online, tentando sincronizar alterações pendentes...");

    // TODO: Implementar a lógica para:
    // 1. Identificar quais roteiro_residencias tiveram status/visitado_em alterados localmente e ainda não foram sincronizados.
    // 2. Identificar quais leituras foram criadas localmente e ainda não foram sincronizadas.
    // 3. Chamar as funções sincronizarAtualizacaoVisita e sincronizarNovaLeitura para cada item pendente.
    // 4. Marcar os itens como sincronizados localmente após sucesso.

    let sincronizadas = 0;
    let falhas = 0;

    // Exemplo muito simplificado (não funcional sem rastreamento):
    // const pendentes = mmkv.get(...) // Obter lista de IDs pendentes
    // for (const itemPendente of pendentes) {
    //   let sucesso = false;
    //   if (itemPendente.tipo === 'visita') {
    //      sucesso = await sincronizarAtualizacaoVisita(...);
    //   } else if (itemPendente.tipo === 'leitura') {
    //      sucesso = await sincronizarNovaLeitura(...);
    //   }
    //   if (sucesso) sincronizadas++; else falhas++;
    //   // Marcar como sincronizado ou remover da lista de pendentes
    // }

    console.log(`Sincronização de pendentes concluída (simulado): ${sincronizadas} sucesso(s), ${falhas} falha(s).`);
    return { success: sincronizadas, failed: falhas, offline: false };
  } catch (error) {
    console.error('Erro ao sincronizar leituras pendentes:', error);
    return { success: 0, failed: 0, error: error.message };
  }
};


/**
 * Calcula o progresso do roteiro com base nos dados locais (MMKV).
 * @param {string} leituristaId - O UUID do leiturista.
 * @param {Date} dataRoteiro - O objeto Date da data do roteiro.
 * @returns {Promise<Object>} - Objeto com estatísticas do progresso { total, visitadas, pendentes, percentual }.
 */
export const getProgressoRoteiroLocal = async (leituristaId, dataRoteiro) => {
  const storageKey = getRoteiroStorageKey(leituristaId, dataRoteiro);
  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd');
  const progressoPadrao = { total: 0, visitadas: 0, pendentes: 0, percentual: 0 };

  try {
    const dadosRoteiroString = roteiroStorage.getString(storageKey);
    if (!dadosRoteiroString) {
      console.log(`Progresso: Roteiro (${dataFormatada}) não encontrado localmente.`);
      // Poderia tentar buscar do Supabase aqui, mas a função é 'Local'
      return progressoPadrao;
    }

    const roteiro = JSON.parse(dadosRoteiroString);

    // Verifica se a estrutura esperada existe
    if (!roteiro || !Array.isArray(roteiro.roteiro_residencias)) {
       console.error(`Progresso: Estrutura inesperada no roteiro local (${dataFormatada}).`, roteiro);
       return progressoPadrao;
    }

    const total = roteiro.roteiro_residencias.length;
    let visitadas = 0;

    // Contar residências com status que indicam visita concluída ou impedida
    // Ajuste os status conforme necessário para sua lógica de negócio
    const statusVisitado = ['concluido_com_leitura', 'concluido_sem_leitura', 'impedido'];
    roteiro.roteiro_residencias.forEach(residencia => {
      if (statusVisitado.includes(residencia.status)) {
        visitadas++;
      }
    });

    const pendentes = total - visitadas;
    const percentual = total > 0 ? Math.round((visitadas / total) * 100) : 0;

    console.log(`Progresso Roteiro (${dataFormatada}): Total=${total}, Visitadas=${visitadas}, Pendentes=${pendentes}, %=${percentual}`);

    return {
      total,
      visitadas,
      pendentes,
      percentual
    };
  } catch (error) {
    console.error(`Erro ao calcular progresso do roteiro local (${dataFormatada}):`, error);
    return progressoPadrao;
  }
};

// Renomeando a função antiga para evitar conflitos ou removendo-a se não for mais usada
// export const getProgressoRoteiro = async (data) => { ... }
