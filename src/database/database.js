import { Platform } from "react-native";
import { MMKV } from "react-native-mmkv";
import * as WebStorage from "./webStorage"; // Manter fallback para web

// Instância do MMKV
const storage = new MMKV();

let dbInitialized = false;

/**
 * Initialize the database (MMKV for native, WebStorage for web)
 */
export const initDatabase = async () => {
  if (Platform.OS === "web") {
    console.log("Using web storage instead of MMKV");
    await WebStorage.initWebStorage();
  } else {
    console.log("Using MMKV for local storage");
    // MMKV é inicializado automaticamente na criação da instância
  }
  dbInitialized = true;
  return true;
};

/**
 * Check if database is initialized, if not initialize it
 */
const ensureDatabaseInitialized = async () => {
  if (!dbInitialized) {
    return await initDatabase();
  }
  return true;
};

/**
 * Generate a unique ID for MMKV keys
 * This is a simple timestamp-based ID, consider a more robust solution for production
 */
const generateId = () => {
  return Date.now().toString();
};

/**
 * Save a reading to the local database (MMKV or WebStorage)
 * @param {Object} reading - Reading object to save
 * @returns {Promise<string>} - ID of the saved reading (local ID)
 */
export const saveReading = async (reading) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      // Ensure web storage also marks as unsynced if not already done
      const readingToSave = { ...reading, synced: false, timestamp: reading.timestamp || new Date().toISOString() };
      return await WebStorage.saveReading(readingToSave);
    } else {
      // TODO: Consider using UUID (e.g., from expo-crypto) for more robust IDs in production
      const id = generateId(); // Gerar um ID único local
      // Adicionar ID, timestamp e marcar como NÃO sincronizado
      const readingWithMeta = {
        ...reading,
        id: id, // ID local
        timestamp: reading.timestamp || new Date().toISOString(), // Usar timestamp existente ou criar novo
        synced: false // Marcar explicitamente como não sincronizado
      };
      const storageKey = `reading:${id}`;
      storage.set(storageKey, JSON.stringify(readingWithMeta));
      console.log(`Reading saved to MMKV with key ${storageKey}`, readingWithMeta);
      return id; // Retorna o ID local gerado
    }
  } catch (error) {
    console.error("Error saving reading:", error);
    throw error;
  }
};

/**
 * Get all readings from the local database (MMKV or WebStorage)
 * @returns {Promise<Array>} - Array of reading objects
 */
export const getReadings = async () => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.getReadings();
    } else {
      const keys = storage.getAllKeys().filter(key => key.startsWith('reading:'));
      const readings = keys.map(key => JSON.parse(storage.getString(key)));
      console.log(`Fetched ${readings.length} readings from MMKV`);
      return readings;
    }
  } catch (error) {
    console.error("Error getting readings:", error);
    throw error;
  }
};

/**
 * Get unsynced readings from the local database (MMKV or WebStorage)
 * Note: MMKV doesn't have direct query capabilities like SQL.
 * We need to fetch all and filter.
 * @returns {Promise<Array>} - Array of unsynced reading objects
 */
export const getUnsyncedReadings = async () => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.getUnsyncedReadings();
    } else {
      const allReadings = await getReadings();
      const unsyncedReadings = allReadings.filter(reading => !reading.synced);
      console.log(`Fetched ${unsyncedReadings.length} unsynced readings from MMKV`);
      return unsyncedReadings;
    }
  } catch (error) {
    console.error("Error getting unsynced readings:", error);
    throw error;
  }
};

/**
 * Update a reading's sync status in the local database (MMKV or WebStorage)
 * @param {string} id - ID of the reading to update
 * @param {boolean} isSynced - New sync status
 * @param {string} remoteId - Remote ID from Supabase
 * @returns {Promise<boolean>} - Success status
 */
export const updateReadingSyncStatus = async (
  id,
  isSynced,
  remoteId = null,
) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.updateReadingSyncStatus(id, isSynced, remoteId);
    } else {
      const readingKey = `reading:${id}`;
      const readingString = storage.getString(readingKey);
      if (!readingString) {
        console.warn(`Reading with key ${readingKey} not found in MMKV`);
        return false;
      }
      const reading = JSON.parse(readingString);
      reading.synced = isSynced;
      reading.remoteId = remoteId; // Adicionar remoteId se necessário
      storage.set(readingKey, JSON.stringify(reading));
      console.log(`Reading sync status updated for key ${readingKey} in MMKV`);
      return true;
    }
  } catch (error) {
    console.error("Error updating reading sync status:", error);
    throw error;
  }
};

/**
 * Delete a reading from the local database (MMKV or WebStorage)
 * @param {string} id - ID of the reading to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteReading = async (id) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.deleteReading(id);
    } else {
      const readingKey = `reading:${id}`;
      storage.delete(readingKey);
      console.log(`Reading with key ${readingKey} deleted from MMKV`);
      return true;
    }
  } catch (error) {
    console.error("Error deleting reading:", error);
    throw error;
  }
};

/**
 * Clear all data from the database (MMKV or WebStorage)
 * Note: This will clear ALL data in the MMKV instance.
 * If you have other data stored, you might need a more specific clear.
 * @returns {Promise<boolean>} - Success status
 */
export const clearDatabase = async () => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.clearStorage();
    } else {
      storage.clearAll(); // Limpa todos os dados no MMKV
      console.log("All data cleared from MMKV");
      return true;
    }
  } catch (error) {
    console.error("Error clearing database:", error);
    throw error;
  }
};

/**
 * Get readings count by time period from the local database (MMKV or WebStorage)
 * Note: MMKV doesn't have direct query capabilities like SQL.
 * We need to fetch all and filter/count.
 * @param {string} startTimestamp - Start of the time period (ISO string)
 * @returns {Promise<number>} - Count of readings in the period
 */
export const getReadingsCountByPeriod = async (startTimestamp) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.getReadingsCountByPeriod(startTimestamp);
    } else {
      const allReadings = await getReadings();
      const count = allReadings.filter(reading =>
        new Date(reading.timestamp) >= new Date(startTimestamp)
      ).length;
      console.log(`Counted ${count} readings since ${startTimestamp} from MMKV`);
      return count;
    }
  } catch (error) {
    console.error("Error getting readings count by period:", error);
    throw error;
  }
};

/**
 * Get a reading by its ID from the local database (MMKV or WebStorage)
 * @param {string} id - ID of the reading to get
 * @returns {Promise<Object>} - Reading object
 */
export const getReadingById = async (id) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      const reading = await WebStorage.getReadingById(id);
      if (!reading) {
        throw new Error(`Reading with ID ${id} not found in WebStorage`);
      }
      return reading;
    } else {
      const readingKey = `reading:${id}`;
      const readingString = storage.getString(readingKey);
      if (!readingString) {
        throw new Error(`Reading with ID ${id} not found in MMKV`);
      }
      const reading = JSON.parse(readingString);
      console.log(`Fetched reading with key ${readingKey} from MMKV`);
      return reading;
    }
  } catch (error) {
    console.error("Error getting reading by ID:", error);
    throw error;
  }
};

/**
 * Update an existing reading in the local database (MMKV or WebStorage)
 * @param {Object} reading - Reading object with updated data
 * @returns {Promise<boolean>} - Success status
 */
export const updateReading = async (reading) => {
  try {
    await ensureDatabaseInitialized();

    if (Platform.OS === "web") {
      return await WebStorage.updateReading(reading);
    } else {
      const readingKey = `reading:${reading.id}`;
      const readingString = storage.getString(readingKey);
      if (!readingString) {
        console.warn(`Reading with key ${readingKey} not found in MMKV for update`);
        return false;
      }
      // Preserve original timestamp if not provided in update
      const existingReading = JSON.parse(readingString);
      const updatedReading = {
        ...existingReading,
        ...reading,
        timestamp: existingReading.timestamp // Preserve original timestamp
      };
      storage.set(readingKey, JSON.stringify(updatedReading));
      console.log(`Reading with key ${readingKey} updated in MMKV`);
      return true;
    }
  } catch (error) {
    console.error("Error updating reading:", error);
    throw error;
  }
};
