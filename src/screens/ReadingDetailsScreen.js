import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import MeterReadingForm from '../components/MeterReadingForm';
import CameraComponent from '../components/Camera'; // Importar o componente da câmera

/**
 * Reading details screen for viewing and editing a reading
 * @param {Object} props - Component props
 * @param {Object} props.route - Route object with params
 * @param {Object} props.navigation - Navigation object
 * @returns {JSX.Element} - Screen component
 */
const ReadingDetailsScreen = ({ route, navigation }) => {
  const { readingId } = route.params;
  const { getReadingById, updateReading } = useAppContext();

  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showCamera, setShowCamera] = useState(false); // Novo estado para controlar a câmera
  const [isProcessingImage, setIsProcessingImage] = useState(false); // Estado para indicar processamento da imagem

  // Carregar a leitura
  useEffect(() => {
    const loadReading = async () => {
      try {
        setLoading(true);
        const readingData = await getReadingById(readingId);
        setReading(readingData);
      } catch (err) {
        console.error('Error loading reading:', err);
        setError(err.message);
        Alert.alert('Erro', `Não foi possível carregar a leitura: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadReading();
  }, [readingId, getReadingById]);

  // Manipular o envio do formulário de edição
  const handleSubmit = async (updatedData) => {
    try {
      setIsSaving(true);

      // Atualizar no banco de dados
      const updatedReading = {
        ...reading,
        ...updatedData,
        // Se a leitura já estava sincronizada, marcar como não sincronizada após edição
        synced: false
      };

      await updateReading(updatedReading);

      // Atualizar estado local
      setReading(updatedReading);
      setIsEditing(false);

      // Mostrar confirmação
      Alert.alert('Sucesso', 'Leitura atualizada com sucesso.');
    } catch (err) {
      console.error('Error updating reading:', err);
      Alert.alert('Erro', `Não foi possível atualizar a leitura: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancelar a edição
  const handleCancel = () => {
    setIsEditing(false);
  };

  // Abrir modo de edição
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Manipular a câmera - Agora abre o componente da câmera
  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  // Lidar com a foto capturada pelo CameraComponent
  const handleImageCaptured = async (image) => {
    setShowCamera(false); // Esconder a câmera
    setIsProcessingImage(true); // Indicar que a imagem está sendo processada

    try {
      // Enviar a imagem para o webhook
      const webhookUrl = 'https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro';
      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        type: 'image/jpeg', // ou o tipo correto da imagem
        name: 'meter_reading.jpg',
      });

      console.log('Enviando imagem para o webhook...');
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro do webhook: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Resposta do webhook:', result);

      // Assumindo que a resposta contém o valor da leitura em result.readingValue
      const readingValue = result.readingValue;

      if (readingValue !== undefined && readingValue !== null) {
        // Atualizar o estado local e o formulário com o valor da leitura
        setReading(prevReading => ({
          ...prevReading,
          reading_value: readingValue,
          image_path: image.uri, // Salvar o URI da nova imagem
          synced: false, // Marcar como não sincronizado após nova leitura/foto
        }));
        Alert.alert('Sucesso', `Leitura detectada: ${readingValue}`);
      } else {
        Alert.alert('Aviso', 'Nenhum valor de leitura detectado na imagem.');
      }

    } catch (err) {
      console.error('Erro ao processar imagem ou webhook:', err);
      Alert.alert('Erro', `Não foi possível processar a imagem: ${err.message}`);
    } finally {
      setIsProcessingImage(false); // Finalizar indicação de processamento
    }
  };

  // Lidar com o fechamento da câmera
  const handleCameraClose = () => {
    setShowCamera(false);
  };


  // Renderizar o componente da câmera se showCamera for true
  if (showCamera) {
    return (
      <CameraComponent
        onCapture={handleImageCaptured}
        onClose={handleCameraClose}
      />
    );
  }

  // Renderizar em caso de erro ou carregamento
  if (loading || isProcessingImage) { // Incluir isProcessingImage no estado de carregamento
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4299e1" />
        <Text style={styles.loadingText}>
          {loading ? 'Carregando leitura...' : 'Processando imagem...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#f56565" />
        <Text style={styles.errorText}>Erro ao carregar leitura</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!reading) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#f56565" />
        <Text style={styles.errorText}>Leitura não encontrada</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Modo de edição: mostrar formulário
  if (isEditing) {
    return (
      <View style={styles.container}>
        <MeterReadingForm
          initialData={reading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onTakePhoto={handleTakePhoto} // Passar a nova função handleTakePhoto
          isSaving={isSaving}
          capturedImage={reading.image_path ? { uri: reading.image_path } : null}
        />
      </View>
    );
  }

  // Modo de visualização: mostrar detalhes
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                {reading.is_facade ? 'Fachada' : `Medidor ${reading.meter_id}`}
              </Text>
              <View style={[
                styles.syncTag,
                reading.synced ? styles.syncedTag : styles.unsyncedTag
              ]}>
                <Ionicons
                  name={reading.synced ? "cloud-done" : "cloud-offline"}
                  size={16}
                  color={reading.synced ? "#48bb78" : "#ed8936"}
                />
                <Text style={[
                  styles.syncText,
                  { color: reading.synced ? "#48bb78" : "#ed8936" }
                ]}>
                  {reading.synced ? "Sincronizado" : "Pendente"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#4299e1" />
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {reading.image_path && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: reading.image_path }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          )}

          {!reading.is_facade && (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Leitura do Medidor</Text>
              <View style={styles.readingValueContainer}>
                <Text style={styles.readingValue}>{reading.reading_value}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Informações Gerais</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Data:</Text>
              <Text style={styles.infoValue}>
                {new Date(reading.timestamp).toLocaleString('pt-BR')}
              </Text>
            </View>

            {reading.client_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cliente:</Text>
                <Text style={styles.infoValue}>{reading.client_name}</Text>
              </View>
            )}

            {reading.address && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Endereço:</Text>
                <Text style={styles.infoValue}>{reading.address}</Text>
              </View>
            )}

            {reading.remote_id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID Remoto:</Text>
                <Text style={styles.infoValue}>{reading.remote_id}</Text>
              </View>
            )}
          </View>

          {reading.notes && (
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Observações</Text>
              <Text style={styles.notesText}>{reading.notes}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#4a5568" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#f56565',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4299e1',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  syncTag: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  syncedTag: {
    backgroundColor: '#ebf8ff',
  },
  unsyncedTag: {
    backgroundColor: '#FEEBDD',
  },
  syncText: {
    fontSize: 12,
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#4299e1',
    marginLeft: 4,
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    height: 240,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  readingValueContainer: {
    backgroundColor: '#ebf8ff',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  readingValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4299e1',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#2d3748',
  },
  notesText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4a5568',
    marginLeft: 8,
  },
});

export default ReadingDetailsScreen;
