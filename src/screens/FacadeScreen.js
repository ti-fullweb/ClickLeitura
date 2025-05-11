import React, { useState, lazy, Suspense } from 'react';
import { View, StyleSheet, Alert, Platform, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useAppContext } from '../context/AppContext';
// Importação dinâmica do CameraComponent
const CameraComponent = lazy(() => import('../components/Camera'));
import { Ionicons } from '@expo/vector-icons';
import StandardLayout from '../components/layouts/StandardLayout';

/**
 * Tela para captura de foto da fachada da casa
 * @param {Object} props - Propriedades do componente
 * @param {Object} props.navigation - Objeto de navegação
 * @returns {JSX.Element} - Componente da tela
 */
const FacadeScreen = ({ navigation }) => {
  const { addReading } = useAppContext();
  
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Função para abrir a câmera
  const handleOpenCamera = () => {
    setShowCamera(true);
  };
  
  // Função para quando uma foto for capturada
  const handleCaptureImage = async (image) => {
    // No ambiente web, armazenar apenas o nome do arquivo, não a URI inteira
    // para evitar problemas com localStorage
    if (Platform.OS === 'web') {
      const imageName = `facade_${Date.now()}.jpg`;
      setCapturedImage({
        ...image,
        name: imageName
      });
    } else {
      setCapturedImage(image);
    }
    
    setShowCamera(false);
  };
  
  // Função para fechar a câmera
  const handleCloseCamera = () => {
    setShowCamera(false);
  };
  
  // Função para fazer upload da imagem para o Supabase Storage
  const uploadImageToSupabase = async (imageUri) => {
    try {
      // Converter URI para Blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Gerar nome único para o arquivo
      const fileExt = imageUri.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `fachadas/${fileName}`; // Pasta no Supabase Storage

      // Fazer upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('fachadas') // Nome do bucket no Supabase Storage
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Obter a URL pública
      const { publicUrl, error: publicUrlError } = supabase.storage
        .from('fachadas')
        .getPublicUrl(filePath);

      if (publicUrlError) {
        throw publicUrlError;
      }

      return publicUrl;

    } catch (error) {
      console.error('Erro ao fazer upload para o Supabase:', error);
      throw error;
    }
  };

  // Função para salvar a fachada
  const handleSaveFacade = async () => {
    if (!capturedImage) {
      Alert.alert('Atenção', 'Por favor, tire uma foto da fachada para continuar.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Upload da imagem para o Supabase Storage
      const imageUrl = await uploadImageToSupabase(capturedImage.uri);

      // 2. Preparar dados para o webhook
      const formData = new FormData();
      formData.append('imageUrl', imageUrl);
      formData.append('address', address);
      formData.append('notes', notes);
      formData.append('timestamp', new Date().toISOString());
      // Adicione outros campos necessários para o webhook aqui

      // 3. Enviar FormData para o webhook
      const webhookUrl = 'https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Fachada-da-Casa';
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data', // Importante para FormData
        },
      });

      if (!webhookResponse.ok) {
        throw new Error(`Erro no webhook: ${webhookResponse.status} ${webhookResponse.statusText}`);
      }

      const webhookResult = await webhookResponse.json();
      console.log('Resposta do webhook:', webhookResult);

      // 4. Salvar dados no banco local (opcional, dependendo da necessidade)
      const facadeData = {
        meter_id: 'FACHADA', // Identificador especial para fachadas
        reading_value: '0', // Não aplicável para fachadas
        client_name: '',
        address: address,
        notes: notes,
        timestamp: new Date().toISOString(),
        synced: true, // Marcar como sincronizado pois já foi para o webhook
        image_path: imageUrl, // Salvar a URL pública da imagem
        is_facade: true // Campo para identificar que é uma fachada
      };

      // await addReading(facadeData); // Descomente se precisar salvar localmente também

      // 5. Redirecionar para nova tela com resposta do webhook
      navigation.navigate('WebhookResponseScreen', { webhookResult }); // Substitua 'WebhookResponseScreen' pelo nome da sua tela de destino

    } catch (error) {
      console.error('Erro ao processar fachada:', error);
      Alert.alert('Erro', `Ocorreu um erro: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Função para cancelar a captura
  const handleCancel = () => {
    navigation.goBack();
  };
  
  // Função para descartar a foto capturada
  const handleDiscardPhoto = () => {
    setCapturedImage(null);
  };
  
  // Botões do rodapé
  const footerContent = (
    <View style={styles.footerContent}>
      <TouchableOpacity
        style={[styles.footerButton, styles.cancelButton]}
        onPress={handleCancel}
        disabled={isSaving}
      >
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.footerButton, 
          styles.saveButton, 
          (!capturedImage || isSaving) && styles.buttonDisabled
        ]}
        onPress={handleSaveFacade}
        disabled={!capturedImage || isSaving}
      >
        {isSaving ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
            <Text style={styles.saveButtonText}>Salvando...</Text>
          </View>
        ) : (
          <Text style={styles.saveButtonText}>Salvar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  // Renderizar a câmera ou o formulário
  if (showCamera) {
    return (
      <Suspense fallback={
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#4299e1" />
          <Text style={styles.loadingText}>Carregando câmera...</Text>
        </View>
      }>
        <CameraComponent
          onCapture={handleCaptureImage}
          onClose={handleCloseCamera}
        />
      </Suspense>
    );
  }
  
  const handleAddressPress = () => {
    // Aqui você pode abrir um modal ou navegar para uma tela para adicionar endereço
    // Por enquanto, usaremos um prompt simples
    Alert.prompt(
      "Adicionar Endereço",
      "Informe o endereço da residência",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Salvar",
          onPress: text => setAddress(text)
        }
      ],
      "plain-text",
      address
    );
  };
  
  const handleNotesPress = () => {
    // Similar ao endereço, podemos usar um prompt simples por enquanto
    Alert.prompt(
      "Adicionar Observações",
      "Informe observações relevantes",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Salvar",
          onPress: text => setNotes(text)
        }
      ],
      "plain-text",
      notes
    );
  };
  
  return (
    <StandardLayout
      title="Foto da Fachada"
      description="Tire uma foto da fachada da casa ou estabelecimento para facilitar a identificação do local."
      onBackPress={() => navigation.goBack()}
      footer={footerContent}
    >
      {capturedImage ? (
        <View style={styles.imageContainer}>
          {/* No ambiente web, quando temos apenas o nome do arquivo, exibir imagem placeholder */}
          {Platform.OS === 'web' && !capturedImage.uri.startsWith('data:') ? (
            <View style={[styles.previewImage, styles.placeholderImage]}>
              <Ionicons name="image" size={64} color="#4299e1" />
              <Text style={styles.placeholderText}>Imagem capturada</Text>
            </View>
          ) : (
            <Image
              source={{ uri: capturedImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          )}
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={handleDiscardPhoto}
          >
            <Ionicons name="close-circle" size={24} color="#f56565" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.photoButton}
          onPress={handleOpenCamera}
        >
          <Ionicons name="camera" size={32} color="#4299e1" />
          <Text style={styles.photoButtonText}>Tirar Foto da Fachada</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Endereço</Text>
          <TouchableOpacity 
            style={styles.field}
            onPress={handleAddressPress}
          >
            <Ionicons name="location-outline" size={20} color="#4299e1" style={styles.fieldIcon} />
            <Text style={[styles.fieldText, !address && styles.placeholderField]}>
              {address || 'Toque para adicionar endereço'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E0" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Observações</Text>
          <TouchableOpacity 
            style={styles.field}
            onPress={handleNotesPress}
          >
            <Ionicons name="create-outline" size={20} color="#4299e1" style={styles.fieldIcon} />
            <Text style={[styles.fieldText, !notes && styles.placeholderField]}>
              {notes || 'Toque para adicionar observações'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E0" />
          </TouchableOpacity>
        </View>
      </View>
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    height: 250,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Sombra para Android
    elevation: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
  },
  placeholderText: {
    marginTop: 8,
    color: '#4299e1',
    fontSize: 16,
    fontWeight: '500',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 18,
    padding: 2,
  },
  photoButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    borderWidth: 1,
    borderColor: '#bee3f8',
    borderRadius: 8,
    padding: 24,
    marginBottom: 20,
    height: 180,
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Sombra para Android
    elevation: 1,
  },
  photoButtonText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#4299e1',
  },
  formContainer: {
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Sombra para Android
    elevation: 1,
  },
  fieldIcon: {
    marginRight: 12,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: '#2d3748',
  },
  placeholderField: {
    color: '#A0AEC0',
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginRight: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4299e1',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 8,
  },
});

export default FacadeScreen;