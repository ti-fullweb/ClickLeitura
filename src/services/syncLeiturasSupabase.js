// services/syncLeiturasSupabase.js

import { storage } from '../utils/storage';
import { supabase } from '../services/supabase';

export async function sincronizarLeiturasPendentes() {
  try {
    console.log("🔄 Iniciando sincronização de leituras pendentes...");

    const leiturasJson = storage.getString('leiturasPendentes');
    if (!leiturasJson) {
      console.log("✅ Nenhuma leitura pendente para sincronizar.");
      return { success: true, message: "Nenhuma leitura pendente para sincronizar." };
    }

    const leituras = JSON.parse(leiturasJson);
    console.log(`📦 Leituras carregadas do MMKV: ${leituras.length}`);

    const leiturasSincronizadas = [];
    let leiturasValidasParaSincronizar = 0;

    // Regex simples para verificar formato UUID (pode não ser 100% rigorosa, mas suficiente para este caso)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const leitura of leituras) {
      // Mapear campos do MMKV para as colunas do Supabase
      const {
        id, // ID local
        roteiro_residencia_id,
        leitura_anterior,
        reading_value, // Alias para leitura_atual
        data_leitura, // Usar data_leitura ou timestamp do MMKV
        imagem_url,
        observacao,
        tipo_ocorrencia_id,
        latitude_leitura,
        longitude_leitura,
        timestamp // Manter timestamp caso data_leitura não esteja presente
      } = leitura;

      // Verificar se o ID é um UUID válido antes de tentar sincronizar
      if (!id || !uuidRegex.test(id)) {
          console.warn(`⏭️ Pulando leitura com ID inválido (não é UUID): ${id}`, leitura);
          // Opcional: Adicionar a uma lista de falhas ou IDs inválidos para relatório final
          continue; // Pula para a próxima leitura
      }

      leiturasValidasParaSincronizar++; // Conta apenas leituras com IDs válidos

      console.log("📤 Enviando leitura para Supabase:", leitura);

      const { error } = await supabase.from('leituras').insert([{
        id: id, // Usar o ID local como ID no Supabase
        roteiro_residencia_id: roteiro_residencia_id,
        leitura_anterior: leitura_anterior,
        leitura_atual: reading_value, // Mapear reading_value para leitura_atual
        data_leitura: data_leitura || timestamp, // Usar data_leitura se existir, senão timestamp
        imagem_url: imagem_url,
        observacao: observacao,
        tipo_ocorrencia_id: tipo_ocorrencia_id,
        latitude_leitura: latitude_leitura,
        longitude_leitura: longitude_leitura,
        // Não inserir 'sincronizado', 'created_at', 'updated_at' - Supabase gerencia
      }]);

      if (error) {
        console.error("❌ Erro ao enviar leitura:", error);
        // Apenas logamos o erro e continuamos
        continue; // Pula para a próxima iteração do loop
      }

      // Se sucesso, adiciona à lista de sincronizadas
      leiturasSincronizadas.push(leitura);
    }

    // Lógica para remover leituras sincronizadas do MMKV
    // Se houve falhas, não devemos remover TUDO.
    // Precisamos remover apenas as que foram adicionadas a leiturasSincronizadas.
    if (leiturasSincronizadas.length > 0) {
        const leiturasPendentesJsonAtual = storage.getString('leiturasPendentes');
        let leiturasPendentesAtual = leiturasPendentesJsonAtual ? JSON.parse(leiturasPendentesJsonAtual) : [];
        
        // Filtrar o array original, mantendo apenas as que NÃO foram sincronizadas
        const leiturasRestantes = leiturasPendentesAtual.filter(pendente => 
            !leiturasSincronizadas.some(sincronizada => sincronizada.id === pendente.id)
        );

        if (leiturasRestantes.length < leiturasPendentesAtual.length) {
             storage.set('leiturasPendentes', JSON.stringify(leiturasRestantes));
             console.log(`✅ ${leiturasSincronizadas.length} leituras sincronizadas e removidas do MMKV.`);
        } else {
             console.log("Nenhuma leitura foi removida do MMKV após a sincronização.");
        }
       
    } else {
        console.log("Nenhuma leitura foi sincronizada com sucesso para remover do MMKV.");
    }


    // Determinar a mensagem de retorno com base nas leituras válidas e sincronizadas
    let message = "";
    let successStatus = false;

    if (leiturasValidasParaSincronizar === 0) {
        message = "Nenhuma leitura válida para sincronizar encontrada.";
        successStatus = true; // Considerado sucesso pois não há nada para fazer
    } else if (leiturasSincronizadas.length === leiturasValidasParaSincronizar) {
        message = `Todas as ${leiturasSincronizadas.length} leituras válidas sincronizadas com sucesso.`;
        successStatus = true;
    } else if (leiturasSincronizadas.length > 0) {
        message = `${leiturasSincronizadas.length} de ${leiturasValidasParaSincronizar} leituras válidas sincronizadas. Algumas falharam.`;
        successStatus = true; // Ainda considerado sucesso parcial
    } else {
        message = `Nenhuma das ${leiturasValidasParaSincronizar} leituras válidas pôde ser sincronizada.`;
        successStatus = false; // Falha total nas leituras válidas
    }


    return { success: successStatus, message: message };

  } catch (e) {
    console.error("❗ Erro inesperado na sincronização:", e);
    return { success: false, message: "Erro inesperado.", error: e };
  }
}
