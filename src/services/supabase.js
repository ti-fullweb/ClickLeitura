import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns'; // Importar date-fns para formatar a data

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Busca o roteiro de um leiturista específico para uma data específica,
 * incluindo todas as residências associadas e seus detalhes de endereço.
 * @param {string} leituristaId - O UUID do leiturista.
 * @param {Date} dataRoteiro - O objeto Date da data do roteiro.
 * @returns {Promise<object|null>} O objeto do roteiro com os dados aninhados ou null em caso de erro.
 */
export async function getRoteiroDoDia(leituristaId, dataRoteiro) {
  if (!leituristaId || !dataRoteiro) {
    console.error('Erro: leituristaId e dataRoteiro são obrigatórios.');
    return null;
  }

  const dataFormatada = format(dataRoteiro, 'yyyy-MM-dd'); // Formato YYYY-MM-DD esperado pelo Supabase

  console.log(`Buscando roteiro para Leiturista: ${leituristaId}, Data: ${dataFormatada}`);

  const { data, error } = await supabase
    .from('roteiros')
    .select(`
      id,
      data,
      status,
      leiturista_id,
      roteiro_residencias (
        id,
        ordem,
        status,
        visitado_em,
        leitura_anterior_snapshot,
        residencia_id,
        residencias (
          id,
          numero,
          complemento,
          hidrometro_numero,
          latitude,
          longitude,
          ruas (
            id,
            nome,
            cep,
            bairros (
              id,
              nome,
              cidades (
                id,
                nome,
                uf
              )
            )
          )
        )
      )
    `)
    .eq('leiturista_id', leituristaId)
    .eq('data', dataFormatada)
    .order('ordem', { foreignTable: 'roteiro_residencias', ascending: true })
    .maybeSingle(); // Espera-se no máximo um roteiro por leiturista/dia

  if (error) {
    console.error('Erro ao buscar roteiro do dia:', error);
    return null;
  }

  if (!data) {
    console.log(`Nenhum roteiro encontrado para Leiturista: ${leituristaId}, Data: ${dataFormatada}`);
    return null; // Retorna null se nenhum roteiro for encontrado
  }

  console.log('Roteiro encontrado:', data);
  return data;
}

// Mantendo a função antiga comentada ou removida, se não for mais necessária.
// export async function getRoteiros() { ... }
