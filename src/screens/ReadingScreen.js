
import React, { useState, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, ActivityIndicator, Text, Modal } from 'react-native';
import { useAppContext } from '../context/AppContext';
import MeterReadingForm from '../components/MeterReadingForm';
import CameraComponent from '../components/Camera';
import StandardLayout from '../components/layouts/StandardLayout';

const ReadingScreen = ({ navigation }) => {
  const { addReading } = useAppContext();

  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const formValueRef = useRef({});

  const updateFormValueRef = (values) => {
    formValueRef.current = values;
  };

  const handleOpenCamera = () => {
    setShowCamera(true);
  };

  const handleCaptureImage = async (image) => {
    setCapturedImage(image);
    setShowCamera(false);
    
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        type: 'image/jpeg',
        name: 'hydrometer.jpg'
      });

      const response = await fetch('https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      
      if (result && result.reading) {
        Alert.alert('Leitura Detectada', `A leitura "${result.reading}" foi processada pelo servidor. Deseja usar este valor?`, [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim', onPress: () => updateReadingValue(result.reading) }
        ]);
      } else {
        Alert.alert('Aviso', 'Não foi possível processar a imagem do hidrômetro. Por favor, insira o valor manualmente.');
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      Alert.alert('Erro', 'Falha ao enviar imagem para processamento. Por favor, insira o valor manualmente.');
    }
  };

  const updateReadingValue = (value) => {
    if (value && formValueRef.current?.setFieldValue) {
      formValueRef.current.setFieldValue('reading_value', value.toString());
    }
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
  };

  const handleSaveReading = async (formData) => {
    setIsSaving(true);

    try {
      const reading = {
        ...formData,
        timestamp: new Date().toISOString(),
        synced: false,
        neighborhood: formData.neighborhood || '',
        city: formData.city || ''
      };

      const result = await addReading(reading);

      // Envia para webhook do n8n
      try {
        await fetch('https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...reading,
            action: 'save_reading',
            device_id: Platform.OS === 'android' ? 'android' : 'ios'
          }),
        });
        console.log("Enviado ao webhook com sucesso");
      } catch (webhookError) {
        console.warn("Erro ao enviar para o webhook:", webhookError);
      }

      if (result) {
        Alert.alert('Sucesso', 'Leitura salva com sucesso!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Início' }],
              });
            }
          }
        ]);
      } else {
        throw new Error('Falha ao salvar a leitura localmente.');
      }
    } catch (error) {
      console.error('Erro ao salvar leitura:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar salvar a leitura.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <StandardLayout
      title="Nova Leitura"
      onBackPress={handleCancel}
    >
      {showCamera ? (
        <CameraComponent onCapture={handleCaptureImage} onClose={handleCloseCamera} />
      ) : (
        <>
          <MeterReadingForm
            onSubmit={handleSaveReading}
            onCancel={handleCancel}
            onTakePhoto={handleOpenCamera}
            isSaving={isSaving}
            capturedImage={capturedImage}
            onFormRef={updateFormValueRef}
          />

        </>
      )}
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: { flex: 1, backgroundColor: '#f7fafc' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: {
    backgroundColor: 'white', borderRadius: 10, padding: 20, alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)', elevation: 5, minWidth: 250
  },
  modalText: { fontSize: 18, fontWeight: 'bold', marginTop: 15, color: '#2d3748' },
  modalSubText: { fontSize: 14, marginTop: 5, color: '#718096', textAlign: 'center' },
});

export default ReadingScreen;
