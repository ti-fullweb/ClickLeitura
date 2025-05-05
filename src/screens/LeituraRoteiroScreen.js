import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Button,
  Alert,
  Platform,
  KeyboardAvoidingView // Adicionar para melhor comportamento do teclado
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { saveReading, initDatabase } from "../database/database"; // Assumindo que saveReading será adaptada ou lida com a nova estrutura
import eventBus from '../services/eventBus';
import { marcarComoVisitadaLocal } from '../services/syncRoteiro'; // Importar a função correta
import { parseISO } from 'date-fns'; // Para converter data ISO string para Date

/**
 * Tela para registrar a leitura de uma residência específica do roteiro.
 */
const LeituraRoteiroScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Extrair parâmetros da navegação
  const {
    roteiroResidenciaId,
    residenciaId, // Não usado diretamente aqui, mas pode ser útil
    hidrometroNumero,
    enderecoFormatado,
    leituraAnterior,
    dataRoteiroISO, // Data como string ISO
    leituristaId,
    // roteiroResidencia // Objeto completo, se precisar de mais dados
  } = route.params || {};

  // Estados para os campos do formulário
  const [leituraAtual, setLeituraAtual] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // TODO: Adicionar estado para tipo de ocorrência selecionado

  // Inicializar banco de dados (se necessário para saveReading)
  useEffect(() => {
    const initDB = async () => {
      try {
        await initDatabase();
        console.log("Database initialized in LeituraRoteiroScreen");
      } catch (error) {
        console.error("Error initializing database:", error);
      }
    };
    initDB();
    // Remover a busca desnecessária de roteiros
  }, []);

  // Função para salvar a leitura e atualizar o status da visita
  const salvarLeitura = async () => {
    // TODO: Adicionar lógica para lidar com ocorrências (sem leitura atual)
    if (!leituraAtual) {
      Alert.alert("Erro", "Por favor, informe a leitura atual.");
      return;
    }
    if (!roteiroResidenciaId || !dataRoteiroISO || !leituristaId) {
       Alert.alert("Erro", "Dados essenciais do roteiro não encontrados. Volte e tente novamente.");
       console.error("Erro: Faltando roteiroResidenciaId, dataRoteiroISO ou leituristaId");
       return;
    }

    const leituraAtualNum = parseInt(leituraAtual, 10);
    if (isNaN(leituraAtualNum)) {
        Alert.alert("Erro", "Leitura atual inválida. Use apenas números.");
        return;
    }

    // Comparar com leitura anterior (se disponível)
    if (leituraAnterior !== null && leituraAnterior !== undefined && leituraAtualNum < leituraAnterior) {
        Alert.alert("Atenção", `A leitura atual (${leituraAtualNum}) é menor que a anterior (${leituraAnterior}). Deseja continuar?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Continuar", onPress: () => proceedSave(leituraAtualNum) }
        ]);
    } else {
        proceedSave(leituraAtualNum);
    }
  };

  const proceedSave = async (leituraAtualNum) => {
    setIsSaving(true);
    try {
      // 1. Preparar dados para a tabela 'leituras'
      const leituraData = {
        // id: será gerado pelo banco ou UUID? Assumindo que saveReading lida com isso ou gera um.
        roteiro_residencia_id: roteiroResidenciaId, // Chave estrangeira crucial
        leitura_anterior: leituraAnterior ?? null, // Usar o valor do snapshot
        leitura_atual: leituraAtualNum,
        // consumo: será calculado pelo banco (GENERATED COLUMN)
        data_leitura: new Date().toISOString(), // Timestamp da leitura
        imagem_url: null, // TODO: Adicionar lógica de upload de imagem e salvar URL
        observacao: observacoes,
        tipo_ocorrencia_id: 1, // Assumindo 'Leitura Normal' (ID 1 do seed) - TODO: Tornar dinâmico
        latitude_leitura: null, // TODO: Capturar localização
        longitude_leitura: null,
        // Campos de sincronização (ex: synced: false) devem ser gerenciados por saveReading/MMKV
      };

      console.log("Salvando leitura:", leituraData);
      // 2. Salvar a leitura (usando a função adaptada/existente)
      // saveReading precisa armazenar isso localmente (MMKV/SQLite) e marcar como não sincronizado
      await saveReading(leituraData); // Adapte esta função se necessário!

      // 3. Marcar a visita como concluída no MMKV
      const dataRoteiro = parseISO(dataRoteiroISO); // Converter string ISO para Date
      const novoStatusVisita = 'concluido_com_leitura'; // Ou outro status baseado na ocorrência
      await marcarComoVisitadaLocal(leituristaId, dataRoteiro, roteiroResidenciaId, novoStatusVisita);

      // 4. Disparar evento para notificar RoteiroScreen
      eventBus.emit('leituraSalva'); // Emitir o evento correto

      Alert.alert("Sucesso", "Leitura registrada e visita atualizada localmente!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);

    } catch (error) {
      console.error("Erro detalhado ao salvar leitura:", error);
      Alert.alert(
        "Erro",
        `Não foi possível salvar a leitura localmente: ${error.message}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // Usar KeyboardAvoidingView para o teclado não cobrir os inputs
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Dados da Residência</Text>
          <Text style={styles.label}>Hidrômetro:</Text>
          <Text style={styles.value}>{hidrometroNumero || "N/A"}</Text>

          <Text style={styles.label}>Endereço:</Text>
          <Text style={styles.value}>{enderecoFormatado || "N/A"}</Text>

          <Text style={styles.label}>Leitura Anterior:</Text>
          {/* Mostrar N/A se for null/undefined */}
          <Text style={styles.value}>{leituraAnterior ?? "N/A"}</Text>
        </View>

        {/* TODO: Adicionar Seletor de Ocorrência aqui */}

        <View style={styles.card}>
          <Text style={styles.title}>Registrar Leitura</Text>

          <Text style={styles.label}>Leitura Atual:</Text>
          <TextInput
            style={styles.input}
            value={leituraAtual}
            onChangeText={setLeituraAtual}
            keyboardType="numeric"
            placeholder="Informe a leitura atual"
            returnKeyType="done" // Melhora usabilidade do teclado
          />

          {/* TODO: Adicionar botão para Câmera/OCR */}

          <Text style={styles.label}>Observações:</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Observações (opcional)"
            multiline
            numberOfLines={4}
            returnKeyType="default"
          />

          <View style={styles.buttonContainer}>
            <Button
              title={isSaving ? "Salvando..." : "Salvar Leitura"}
              onPress={salvarLeitura}
              disabled={isSaving}
              color="#3b82f6" // Cor azul consistente
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#4299e1",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
    color: "#4a5568",
  },
  value: {
    fontSize: 16,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  buttonContainer: {
    marginTop: 8,
  },
});

export default LeituraRoteiroScreen;
