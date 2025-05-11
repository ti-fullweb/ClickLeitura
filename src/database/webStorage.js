/**
 * Implementação alternativa de banco de dados para ambiente web
 * Implementação alternativa de banco de dados para ambiente React Native
 * usando AsyncStorage para simular operações de banco de dados SQLite
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Prefixo para as chaves no AsyncStorage
const STORAGE_PREFIX = "appleiturista_";
const READINGS_KEY = `${STORAGE_PREFIX}readings`;

/**
 * Inicializar armazenamento
 */
export const initWebStorage = async () => {
  try {
    // Verificar se já existe dados de leituras
    const existingReadings = await AsyncStorage.getItem(READINGS_KEY);
    if (!existingReadings) {
      await AsyncStorage.setItem(READINGS_KEY, JSON.stringify([]));
    }

    console.log("Async storage initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing async storage:", error);
    throw error;
  }
};

/**
 * Salvar leitura no AsyncStorage
 * @param {Object} reading - Objeto com dados da leitura
 * @returns {Promise<number>} - ID da leitura salva
 */
export const saveReading = async (reading) => {
  try {
    // Obter leituras atuais
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");

    // Gerar novo ID (maior ID + 1 ou 1 se não houver leituras)
    const newId =
      readings.length > 0 ? Math.max(...readings.map((r) => r.id)) + 1 : 1;

    // Verificar se precisamos sanitizar a leitura (problemas com imagens Data URI muito grandes)
    // Se image_path não for uma string (é um objeto ou URI muito grande), substituir por nome do arquivo
    let sanitizedReading = { ...reading };

    // Verificar se image_path é URI de dados longa, substituir por nome simplificado
    if (
      typeof sanitizedReading.image_path === "string" &&
      sanitizedReading.image_path.startsWith("data:") &&
      sanitizedReading.image_path.length > 1000
    ) {
      sanitizedReading.image_path = `imagem_${newId}.jpg`;
    }

    // Adicionar nova leitura
    const newReading = {
      ...sanitizedReading,
      id: newId,
    };

    readings.unshift(newReading); // Adicionar no início para manter ordem por data

    // Salvar de volta no AsyncStorage
    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(readings));

    return newId;
  } catch (error) {
    console.error("Error saving reading to async storage:", error);
    throw error;
  }
};

/**
 * Obter todas as leituras do AsyncStorage
 * @returns {Promise<Array>} - Array com as leituras
 */
export const getReadings = async () => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    return readings;
  } catch (error) {
    console.error("Error getting readings from async storage:", error);
    throw error;
  }
};

/**
 * Obter leituras não sincronizadas
 * @returns {Promise<Array>} - Array com leituras não sincronizadas
 */
export const getUnsyncedReadings = async () => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    return readings.filter((reading) => !reading.synced);
  } catch (error) {
    console.error("Error getting unsynced readings from async storage:", error);
    throw error;
  }
};

/**
 * Atualizar status de sincronização de uma leitura
 * @param {number} id - ID da leitura
 * @param {boolean} isSynced - Novo status de sincronização
 * @param {string} remoteId - ID remoto (opcional)
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export const updateReadingSyncStatus = async (
  id,
  isSynced,
  remoteId = null,
) => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");

    // Encontrar e atualizar a leitura
    const updatedReadings = readings.map((reading) => {
      if (reading.id === id) {
        return {
          ...reading,
          synced: isSynced,
          remote_id: remoteId || reading.remote_id,
        };
      }
      return reading;
    });

    // Salvar de volta no AsyncStorage
    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(updatedReadings));

    return true;
  } catch (error) {
    console.error("Error updating reading sync status in async storage:", error);
    throw error;
  }
};

/**
 * Limpar todos os dados do AsyncStorage
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export const clearStorage = async () => {
  try {
    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify([]));
    return true;
  } catch (error) {
    console.error("Error clearing async storage:", error);
    throw error;
  }
};

/**
 * Obter contagem de leituras por período
 * @param {string} startTimestamp - Timestamp de início do período
 * @returns {Promise<number>} - Quantidade de leituras no período
 */
export const getReadingsCountByPeriod = async (startTimestamp) => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    return readings.filter(
      (reading) => new Date(reading.timestamp) >= new Date(startTimestamp),
    ).length;
  } catch (error) {
    console.error(
      "Error getting readings count by period from async storage:",
      error,
    );
    throw error;
  }
};

/**
 * Obter uma leitura pelo ID
 * @param {number} id - ID da leitura
 * @returns {Promise<Object>} - Objeto da leitura
 */
export const getReadingById = async (id) => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    const reading = readings.find((r) => r.id === id);

    if (!reading) {
      throw new Error(`Reading with ID ${id} not found`);
    }

    return reading;
  } catch (error) {
    console.error("Error getting reading by ID from async storage:", error);
    throw error;
  }
};

/**
 * Atualizar uma leitura existente
 * @param {Object} updatedReading - Objeto com dados atualizados da leitura
 * @returns {Promise<boolean>} - Status de sucesso
 */
export const updateReading = async (updatedReading) => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    const index = readings.findIndex((r) => r.id === updatedReading.id);

    if (index === -1) {
      throw new Error(`Reading with ID ${updatedReading.id} not found`);
    }

    // Para leituras já sincronizadas, marcar como não sincronizada após edição
    // a menos que explicitamente definido
    if (readings[index].synced && updatedReading.synced !== true) {
      updatedReading.synced = false;
    }

    // Manter o timestamp original
    updatedReading.timestamp = readings[index].timestamp;

    // Preservar o caminho da imagem original se não foi especificado um novo
    if (!updatedReading.image_path && readings[index].image_path) {
      updatedReading.image_path = readings[index].image_path;
    }

    // Verificar se a imagem precisa ser sanitizada
    if (
      typeof updatedReading.image_path === "string" &&
      updatedReading.image_path.startsWith("data:") &&
      updatedReading.image_path.length > 1000
    ) {
      updatedReading.image_path = `imagem_${updatedReading.id}.jpg`;
    }

    // Atualizar no array
    readings[index] = updatedReading;

    // Salvar de volta no AsyncStorage
    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(readings));

    return true;
  } catch (error) {
    console.error("Error updating reading in async storage:", error);
    throw error;
  }
};

/**
 * Excluir uma leitura pelo ID
 * @param {number} id - ID da leitura a ser excluída
 * @returns {Promise<boolean>} - Status de sucesso
 */
export const deleteReading = async (id) => {
  try {
    const readingsData = await AsyncStorage.getItem(READINGS_KEY);
    const readings = JSON.parse(readingsData || "[]");
    const filteredReadings = readings.filter((reading) => reading.id !== id);

    await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(filteredReadings));
    return true;
  } catch (error) {
    console.error("Error deleting reading from async storage:", error);
    throw error;
  }
};
