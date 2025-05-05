import * as FileSystem from 'expo-file-system';
import axios from 'axios';

const OCR_API_URL = 'https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro';

export const processMeterImage = async (imageUri) => {
  try {
    // 1. Pré-processar imagem (melhorar contraste, recortar região do hidrômetro)
    const processedImage = await preprocessImage(imageUri);
    
    // 2. Enviar para o Webhook do N8N
    const formData = new FormData();
    formData.append('image', {
      uri: processedImage,
      name: 'meter_reading.jpg',
      type: 'image/jpeg'
    });

    const response = await axios.post(OCR_API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    // 3. Extrair e validar o valor
    const readingValue = extractReadingValue(response.data);
    
    return {
      success: true,
      value: readingValue,
      imagePath: processedImage
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      error: 'Falha ao processar imagem do hidrômetro'
    };
  }
};

const preprocessImage = async (uri) => {
  // Implementar lógica de pré-processamento
  return uri; // Retornar URI da imagem processada
};

const extractReadingValue = (apiResponse) => {
  // Extrair e validar o valor da resposta da API
  return apiResponse.reading || null;
};
