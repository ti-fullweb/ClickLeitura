import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  ActivityIndicator
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import CameraComponent from "../components/Camera";
import { saveReading, initDatabase } from "../database/database";
import eventBus from '../services/eventBus';
import { storage } from '../utils/storage';
import { marcarComoVisitadaLocal } from '../services/syncRoteiro';
import { parseISO } from 'date-fns';
import { MaterialIcons, Ionicons } from '@expo/vector-icons'; // Assumindo que você usa Expo
import { useNetworkStatus } from '../hooks/useNetworkStatus'; // Importar o hook de status de rede (correção de importação)
import StandardLayout from '../components/layouts/StandardLayout';

/**
 * Tela para registrar a leitura de uma residência específica do roteiro.
 */
const LeituraRoteiroScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Extrair parâmetros da navegação
  const {
    roteiroResidenciaId,
    residenciaId,
    hidrometroNumero,
    enderecoFormatado,
    leituraAnterior,
    dataRoteiroISO,
  } = route.params || {};

  // Estados para os campos do formulário
  const [leituraAtual, setLeituraAtual] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [leituristaIdLocal, setLeituristaIdLocal] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' ou 'camera'

  const { isConnected } = useNetworkStatus(); // Obter o status da conexão

  // Inicializar banco de dados e carregar leituristaId do MMKV
  useEffect(() => {
    const setupScreen = async () => {
      try {
        await initDatabase();
        console.log("Database initialized in LeituraRoteiroScreen");

        console.log("Tentando obter leiturista do MMKV em LeituraRoteiroScreen...");
        const leituristaString = storage.getString('leiturista');
        let id = null;
        if (leituristaString) {
          try {
            const leituristaData = JSON.parse(leituristaString);
            if (leituristaData && typeof leituristaData === 'object' && leituristaData.id) {
              id = leituristaData.id;
              console.log("Leiturista ID obtido do MMKV em LeituraRoteiroScreen:", id);
            } else {
              console.warn("Dados do leiturista no MMKV inválidos ou sem ID em LeituraRoteiroScreen.");
            }
          } catch (parseError) {
            console.error("Erro ao parsear dados do leiturista do MMKV em LeituraRoteiroScreen:", parseError);
          }
        } else {
          console.warn("Nenhum dado de leiturista encontrado no MMKV em LeituraRoteiroScreen.");
        }
        setLeituristaIdLocal(id);

      } catch (error) {
        console.error("Erro durante a configuração da tela LeituraRoteiroScreen:", error);
        Alert.alert("Erro", "Não foi possível carregar dados essenciais.");
      }
    };
    setupScreen();
  }, []);

  // Função para lidar com a imagem capturada pela câmera
  const handleImageCaptured = async (imageUri) => {
    if (!imageUri) {
      Alert.alert("Erro", "Nenhuma imagem capturada.");
      setShowCamera(false);
      return;
    }

    setShowCamera(false);
    setIsProcessingImage(true); // Indicador visual específico para processamento de imagem

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });

      console.log("Enviando imagem para o webhook n8n:", "https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro");
      const response = await fetch("https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro", {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      console.log("Resposta bruta do webhook:", responseText);

      if (!response.ok) {
        throw new Error(`Erro no webhook: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);
      console.log("Resposta JSON do webhook:", result);

      if (result && result.readingValue !== undefined && result.readingValue !== null) {
        // Navegar para a tela de confirmação em vez de definir localmente
        navigation.navigate('ConfirmacaoLeituraScreen', {
          leituraDetectada: String(result.readingValue),
          leituraAnterior: leituraAnterior,
          roteiroResidenciaId: roteiroResidenciaId,
          dataRoteiroISO: dataRoteiroISO,
          leituristaIdLocal: leituristaIdLocal,
          hidrometroNumero: hidrometroNumero,
          enderecoFormatado: enderecoFormatado,
          observacoesIniciais: observacoes, // Passa as observações atuais
          imageUri: imageUri, // Passa o URI da imagem capturada
        });
      } else {
        const errorMessage = result?.message || result?.error || "Não foi possível obter a leitura da imagem. Verifique a resposta do servidor.";
        Alert.alert("Atenção", errorMessage);
        console.warn("Resposta do webhook não continha 'readingValue' ou estava vazia:", result);
      }

    } catch (error) {
      console.error("Erro ao enviar imagem para o n8n ou processar resposta:", error);
      Alert.alert("Erro", `Falha ao processar imagem: ${error.message}`);
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Função para salvar a leitura e atualizar o status da visita
  const salvarLeitura = async () => {
    if (!leituraAtual) {
      Alert.alert("Erro", "Por favor, informe a leitura atual.");
      return;
    }
    
    if (!roteiroResidenciaId || !dataRoteiroISO || !leituristaIdLocal) {
      Alert.alert("Erro", "Dados essenciais do roteiro não encontrados. Volte e tente novamente.");
      console.error("Erro: Faltando roteiroResidenciaId, dataRoteiroISO ou leituristaId (local)");
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
        roteiro_residencia_id: roteiroResidenciaId,
        leitura_anterior: leituraAnterior ?? null,
        leitura_atual: leituraAtualNum,
        data_leitura: new Date().toISOString(),
        imagem_url: null,
        observacao: observacoes,
        tipo_ocorrencia_id: 1,
        latitude_leitura: null,
        longitude_leitura: null,
      };

      console.log("Salvando leitura:", leituraData);
      await saveReading(leituraData);

      // 3. Marcar a visita como concluída no MMKV
      const dataRoteiro = parseISO(dataRoteiroISO);
      const novoStatusVisita = 'concluido_com_leitura';
      await marcarComoVisitadaLocal(leituristaIdLocal, dataRoteiro, roteiroResidenciaId, novoStatusVisita);

      // 4. Disparar evento para notificar RoteiroScreen
      eventBus.emit('leituraSalva');

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

  // Se a câmera deve ser mostrada, renderiza apenas o CameraComponent
  if (showCamera) {
    return (
      <CameraComponent
        onCapture={handleImageCaptured}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <StandardLayout
      title="Registro de Leitura"
      onBackPress={() => navigation.goBack()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Card de informações da residência */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="home" size={24} color="#4299e1" />
            <Text style={styles.title}>Dados da Residência</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Hidrômetro:</Text>
            <Text style={styles.value}>{hidrometroNumero || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Endereço:</Text>
            <Text style={styles.value}>{enderecoFormatado || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Leitura Anterior:</Text>
            <Text style={styles.value}>{leituraAnterior ?? "N/A"}</Text>
          </View>
        </View>

        {/* Card de registro de leitura */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="create" size={24} color="#4299e1" />
            <Text style={styles.title}>Registrar Leitura</Text>
          </View>

          {/* Selector para os modos de entrada */}
          <View style={styles.tabSelector}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'manual' && styles.activeTab]}
              onPress={() => setActiveTab('manual')}
            >
              <MaterialIcons name="edit" size={20} color={activeTab === 'manual' ? "#ffffff" : "#4299e1"} />
              <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'camera' && styles.activeTab]}
              onPress={() => setActiveTab('camera')}
            >
              <MaterialIcons name="camera-alt" size={20} color={activeTab === 'camera' ? "#ffffff" : "#4299e1"} />
              <Text style={[styles.tabText, activeTab === 'camera' && styles.activeTabText]}>Foto/IA</Text>
            </TouchableOpacity>
          </View>

          {/* Conteúdo específico para cada modo */}
          {activeTab === 'manual' ? (
            <View style={styles.tabContent}>
              <Text style={styles.label}>Leitura Atual:</Text>
              <TextInput
                style={styles.input}
                value={leituraAtual}
                onChangeText={setLeituraAtual}
                keyboardType="numeric"
                placeholder="Informe a leitura atual"
                returnKeyType="done"
              />
              <Text style={styles.helperText}>Digite o valor da leitura manualmente</Text>
            </View>
          ) : (
            <View style={styles.tabContent}>
              <View style={styles.cameraSection}>
                <TouchableOpacity
                  style={[styles.cameraButton, (!isConnected || isProcessingImage) && styles.disabledButton]} // Desabilitar se offline ou processando
                  onPress={() => {
                    if (!isConnected) {
                      Alert.alert("Offline", "A função de tirar foto para detecção automática requer conexão com a internet.");
                      return;
                    }
                    setShowCamera(true);
                  }}
                  disabled={!isConnected || isProcessingImage} // Desabilitar se offline ou processando
                >
                  <MaterialIcons name="camera-alt" size={28} color="#ffffff" />
                  <Text style={styles.cameraButtonText}>Tirar Foto do Hidrômetro</Text>
                </TouchableOpacity>

                {!isConnected && (
                   <Text style={styles.offlineWarning}>
                     Offline: A detecção automática requer internet.
                   </Text>
                )}

                {isProcessingImage && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color="#4299e1" />
                    <Text style={styles.processingText}>Processando imagem...</Text>
                  </View>
                )}

                {leituraAtual && (
                  <View style={styles.resultContainer}>
                    <Text style={styles.label}>Leitura detectada:</Text>
                    <View style={styles.resultBox}>
                      <Text style={styles.detectedValue}>{leituraAtual}</Text>
                      <TouchableOpacity onPress={() => setLeituraAtual("")}>
                        <MaterialIcons name="edit" size={20} color="#4299e1" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Text style={styles.helperText}>
                  A IA detectará automaticamente o valor do hidrômetro
                </Text>
              </View>
            </View>
          )}

          {/* Observações - comum a ambos os modos */}
          <View style={styles.observacoesSection}>
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
          </View>

          {/* Botão de Salvar */}
          <TouchableOpacity
            style={[styles.saveButton, (isSaving || isProcessingImage) && styles.disabledButton]}
            onPress={salvarLeitura}
            disabled={isSaving || isProcessingImage}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.saveButtonContent}>
                <MaterialIcons name="save" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Salvar Leitura</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: {
  //   flex: 1,
  //   padding: 16,
  //   backgroundColor: "#f5f5f5",
  // },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#4299e1",
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
    color: "#4a5568",
  },
  value: {
    fontSize: 16,
    color: "#2d3748",
  },
  tabSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  activeTab: {
    backgroundColor: '#4299e1',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4299e1',
  },
  activeTabText: {
    color: '#ffffff',
  },
  tabContent: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
    marginLeft: 4,
  },
  cameraSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  cameraButton: {
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
  },
  cameraButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  processingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 8,
    color: '#4299e1',
    fontWeight: '500',
  },
  resultContainer: {
    width: '100%',
    marginTop: 16,
  },
  resultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4299e1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ebf8ff',
  },
  detectedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2b6cb0',
  },
  observacoesSection: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  offlineWarning: { // Estilo para o aviso offline
    fontSize: 12,
    color: '#f44336', // Vermelho para aviso
    marginTop: 8,
    fontStyle: 'italic',
  }
});

export default LeituraRoteiroScreen;
