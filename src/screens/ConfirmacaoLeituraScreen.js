import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { saveReading } from '../database/database';
import eventBus from '../services/eventBus';
import { marcarComoVisitadaLocal } from '../services/syncRoteiro';
import { parseISO } from 'date-fns';
import StandardLayout from '../components/layouts/StandardLayout';

const ConfirmacaoLeituraScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    leituraDetectada, // Leitura vinda da IA
    leituraAnterior,
    roteiroResidenciaId,
    dataRoteiroISO,
    leituristaIdLocal,
    hidrometroNumero,
    enderecoFormatado,
    observacoesIniciais, // Observações que podem ter sido preenchidas antes da foto
  } = route.params || {};

  const [leituraAtualEditada, setLeituraAtualEditada] = useState(String(leituraDetectada || ""));
  const [observacoesEditadas, setObservacoesEditadas] = useState(observacoesIniciais || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Se a leitura detectada mudar (ex: re-navegação com novos params), atualiza o estado
    setLeituraAtualEditada(String(leituraDetectada || ""));
    setObservacoesEditadas(observacoesIniciais || "");
  }, [leituraDetectada, observacoesIniciais]);

  const handleConfirmarSalvar = async () => {
    if (!leituraAtualEditada) {
      Alert.alert("Erro", "A leitura atual não pode estar vazia.");
      return;
    }
    if (!roteiroResidenciaId || !dataRoteiroISO || !leituristaIdLocal) {
      Alert.alert("Erro", "Dados essenciais do roteiro não encontrados. Volte e tente novamente.");
      console.error("Erro: Faltando roteiroResidenciaId, dataRoteiroISO ou leituristaIdLocal em ConfirmacaoLeituraScreen");
      return;
    }

    const leituraAtualNum = parseInt(leituraAtualEditada, 10);
    if (isNaN(leituraAtualNum)) {
      Alert.alert("Erro", "Leitura atual inválida. Use apenas números.");
      return;
    }

    if (leituraAnterior !== null && leituraAnterior !== undefined && leituraAtualNum < leituraAnterior) {
      Alert.alert(
        "Atenção",
        `A leitura atual (${leituraAtualNum}) é menor que a anterior (${leituraAnterior}). Deseja continuar?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => proceedSaveConfirmation(leituraAtualNum) },
        ]
      );
    } else {
      proceedSaveConfirmation(leituraAtualNum);
    }
  };

  const proceedSaveConfirmation = async (leituraAtualNum) => {
    setIsSaving(true);
    try {
      const leituraData = {
        roteiro_residencia_id: roteiroResidenciaId,
        leitura_anterior: leituraAnterior ?? null,
        leitura_atual: leituraAtualNum,
        data_leitura: new Date().toISOString(),
        imagem_url: null, // TODO: Se a imagem foi capturada, precisamos da URI aqui ou do resultado do upload
        observacao: observacoesEditadas,
        tipo_ocorrencia_id: 1, // Assumindo 'Leitura Normal' - TODO: Tornar dinâmico se houver ocorrências
        latitude_leitura: null, // TODO: Capturar localização
        longitude_leitura: null,
      };

      console.log("Salvando leitura confirmada:", leituraData);
      await saveReading(leituraData);

      const dataRoteiro = parseISO(dataRoteiroISO);
      const novoStatusVisita = 'concluido_com_leitura'; // Ou outro status
      await marcarComoVisitadaLocal(leituristaIdLocal, dataRoteiro, roteiroResidenciaId, novoStatusVisita);

      eventBus.emit('leituraSalva');

      Alert.alert("Sucesso", "Leitura confirmada e salva localmente!", [
        { text: "OK", onPress: () => navigation.popToTop() }, // Voltar para o topo da stack (RoteiroScreen)
      ]);

    } catch (error) {
      console.error("Erro detalhado ao salvar leitura confirmada:", error);
      Alert.alert("Erro", `Não foi possível salvar a leitura: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StandardLayout
      title="Confirmar Leitura"
      onBackPress={() => navigation.goBack()}
      footer={
        <View style={styles.actions}>
          <View style={styles.buttonContainer}>
            <Button
              title={isSaving ? "Salvando..." : "Confirmar e Salvar"}
              onPress={handleConfirmarSalvar}
              disabled={isSaving}
              color="#3b82f6"
            />
          </View>
          <View style={styles.buttonSpacing}>
            <Button
              title="Cancelar/Voltar"
              onPress={() => navigation.goBack()}
              color="#f44336" // Vermelho para cancelar
              disabled={isSaving}
            />
          </View>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Hidrômetro:</Text>
          <Text style={styles.value}>{hidrometroNumero || "N/A"}</Text>

          <Text style={styles.label}>Endereço:</Text>
          <Text style={styles.value}>{enderecoFormatado || "N/A"}</Text>

          <Text style={styles.label}>Leitura Anterior:</Text>
          <Text style={styles.value}>{leituraAnterior ?? "N/A"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Leitura Atual (Detectada pela IA):</Text>
          <TextInput
            style={styles.input}
            value={leituraAtualEditada}
            onChangeText={setLeituraAtualEditada}
            keyboardType="numeric"
            placeholder="Confirme ou edite a leitura"
            returnKeyType="done"
          />

          <Text style={styles.label}>Observações:</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={observacoesEditadas}
            onChangeText={setObservacoesEditadas}
            placeholder="Observações (opcional)"
            multiline
            numberOfLines={4}
            returnKeyType="default"
          />
        </View>
      </KeyboardAvoidingView>
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#4299e1',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#4a5568',
  },
  value: {
    fontSize: 16,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: 8,
  },
  buttonSpacing: {
    marginTop: 12,
  },
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: {
  //   flex: 1,
  //   backgroundColor: '#f7fafc',
  // },
  // scrollView: {
  //   flex: 1,
  // },
  // content: {
  //   padding: 16,
  // },
  // title: {
  //   fontSize: 24,
  //   fontWeight: 'bold',
  //   color: '#2d3748',
  //   marginBottom: 8,
  // },
  // description: {
  //   fontSize: 16,
  //   color: '#4a5568',
  //   marginBottom: 24,
  // },
  // actions: {
  //   borderTopWidth: 1,
  //   borderTopColor: '#e2e8f0',
  //   padding: 16,
  //   backgroundColor: '#fff',
  // },
  // button: {
  //   backgroundColor: '#4299e1',
  //   padding: 16,
  //   borderRadius: 8,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
  // buttonText: {
  //   color: '#fff',
  //   fontSize: 16,
  //   fontWeight: '500',
  // },
});

export default ConfirmacaoLeituraScreen;
