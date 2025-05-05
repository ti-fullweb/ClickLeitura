import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Processa uma imagem para OCR e extrai a leitura do hidrômetro
 * @param {string} imageUri - URI da imagem capturada
 * @returns {Promise<Object>} - Resultado do processamento OCR
 */
export const processImage = async (imageUri) => {
  try {
    // 1. Pré-processar a imagem para melhorar o reconhecimento
    const processedImage = await preprocessImage(imageUri);

    // 2. Enviar para o webhook do N8N para processamento OCR
    const result = await sendToOcrService(processedImage);

    return result;
  } catch (error) {
    console.error("Erro no processamento de imagem:", error);
    throw new Error("Falha ao processar imagem do hidrômetro");
  }
};

/**
 * Pré-processa a imagem para melhorar o reconhecimento OCR
 * @param {string} uri - URI da imagem original
 * @returns {Promise<string>} - URI da imagem processada
 */
async function preprocessImage(uri) {
  try {
    // Usar ImageManipulator para melhorar a qualidade da imagem para OCR
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 1200 } }, // Redimensionar para largura padrão
        { contrast: 1.2 }, // Aumentar contraste
        { brightness: 0.1 }, // Ajustar brilho
      ],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    return manipResult.uri;
  } catch (error) {
    console.error("Erro no pré-processamento da imagem:", error);
    // Em caso de erro, retornar a imagem original
    return uri;
  }
}

/**
 * Envia a imagem para o serviço OCR via webhook
 * @param {string} imageUri - URI da imagem processada
 * @returns {Promise<Object>} - Resultado do OCR
 */
async function sendToOcrService(imageUri) {
  try {
    // Preparar a imagem para envio
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error("Arquivo de imagem não encontrado");
    }

    // Criar FormData para envio da imagem
    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: "image/jpeg",
      name: "meter_reading.jpg",
    });

    // Adicionar timeout para evitar que a requisição fique pendente indefinidamente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

    try {
      // Enviar para o webhook do N8N
      const response = await fetch(
        "https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro",
        {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro na resposta do servidor: ${response.status}`);
      }

      const result = await response.json();

      // Formatar o resultado para o formato esperado pela aplicação
      return {
        text: result.reading || null,
        confidence: result.confidence || 0,
        success: !!result.reading,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.warn("Tempo limite excedido ao conectar ao serviço OCR");
        return {
          text: null,
          confidence: 0,
          success: false,
          error: "Tempo limite excedido ao conectar ao serviço OCR",
        };
      }
      console.error("Erro na requisição OCR:", fetchError);
      return {
        text: null,
        confidence: 0,
        success: false,
        error: fetchError.message || "Erro ao processar imagem",
      };
    }
  } catch (error) {
    console.error("Erro ao enviar imagem para OCR:", error);
    return {
      text: null,
      confidence: 0,
      success: false,
      error: error.message,
    };
  }
}
