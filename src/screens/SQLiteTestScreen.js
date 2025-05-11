import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import {
  initDatabase,
  saveReading,
  getReadings,
  updateReading,
  getReadingById,
  deleteReading,
} from "../database/database";
import { StatusBar } from "expo-status-bar";
import StandardLayout from '../components/layouts/StandardLayout';

function SQLiteTestScreen() {
  const [connectionStatus, setConnectionStatus] = useState(
    "Verificando conexão com SQLite...",
  );
  const [statusColor, setStatusColor] = useState("gray");
  const [readings, setReadings] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentReading, setCurrentReading] = useState({
    id: null,
    meter_id: "",
    reading_value: "",
    client_name: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await initDatabase();
      setConnectionStatus("SQLite está disponível e inicializado!");
      setStatusColor("green");
      loadReadings();
    } catch (error) {
      setConnectionStatus(`SQLite não está disponível: ${error.message}`);
      setStatusColor("red");
    }
  };

  const loadReadings = async () => {
    try {
      const data = await getReadings();
      setReadings(data);
    } catch (error) {
      Alert.alert("Erro", `Erro ao carregar leituras: ${error.message}`);
    }
  };

  const handleSave = async () => {
    try {
      if (!currentReading.meter_id || !currentReading.reading_value) {
        Alert.alert(
          "Erro",
          "ID do Medidor e Valor da Leitura são obrigatórios!",
        );
        return;
      }

      if (isEditing && currentReading.id) {
        await updateReading(currentReading);
        Alert.alert("Sucesso", "Leitura atualizada com sucesso!");
      } else {
        const newReading = {
          ...currentReading,
          timestamp: new Date().toISOString(),
          synced: false,
        };
        await saveReading(newReading);
        Alert.alert("Sucesso", "Leitura adicionada com sucesso!");
      }

      resetForm();
      loadReadings();
    } catch (error) {
      Alert.alert("Erro", `Erro ao salvar leitura: ${error.message}`);
    }
  };

  const handleEdit = async (id) => {
    try {
      const reading = await getReadingById(id);
      setCurrentReading(reading);
      setIsEditing(true);
    } catch (error) {
      Alert.alert("Erro", `Erro ao carregar leitura: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      Alert.alert(
        "Confirmar exclusão",
        "Tem certeza que deseja excluir esta leitura?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteReading(id);
                loadReadings();
                Alert.alert("Sucesso", "Leitura excluída com sucesso!");
              } catch (error) {
                Alert.alert(
                  "Erro",
                  `Erro ao excluir leitura: ${error.message}`,
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Erro", `Erro ao excluir leitura: ${error.message}`);
    }
  };

  const resetForm = () => {
    setCurrentReading({
      id: null,
      meter_id: "",
      reading_value: "",
      client_name: "",
      address: "",
      notes: "",
    });
    setIsEditing(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>Medidor: {item.meter_id}</Text>
        <Text>Leitura: {item.reading_value}</Text>
        <Text>Cliente: {item.client_name || "-"}</Text>
        <Text>Endereço: {item.address || "-"}</Text>
        <Text>Data: {new Date(item.timestamp).toLocaleString()}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => handleEdit(item.id)}
        >
          <Text style={styles.buttonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.buttonText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <StandardLayout title="Teste SQLite - App Leiturista">
      <StatusBar style="auto" />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status de Conexão</Text>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {connectionStatus}
        </Text>
        <TouchableOpacity style={styles.button} onPress={checkConnection}>
          <Text style={styles.buttonText}>Testar Conexão</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {isEditing ? "Editar Leitura" : "Adicionar Leitura"}
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>ID do Medidor:</Text>
          <TextInput
            style={styles.input}
            value={currentReading.meter_id}
            onChangeText={(text) =>
              setCurrentReading({ ...currentReading, meter_id: text })
            }
            placeholder="Digite o ID do medidor"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Valor da Leitura:</Text>
          <TextInput
            style={styles.input}
            value={currentReading.reading_value}
            onChangeText={(text) =>
              setCurrentReading({ ...currentReading, reading_value: text })
            }
            placeholder="Digite o valor da leitura"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nome do Cliente:</Text>
          <TextInput
            style={styles.input}
            value={currentReading.client_name}
            onChangeText={(text) =>
              setCurrentReading({ ...currentReading, client_name: text })
            }
            placeholder="Digite o nome do cliente"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Endereço:</Text>
          <TextInput
            style={styles.input}
            value={currentReading.address}
            onChangeText={(text) =>
              setCurrentReading({ ...currentReading, address: text })
            }
            placeholder="Digite o endereço"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Observações:</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={currentReading.notes}
            onChangeText={(text) =>
              setCurrentReading({ ...currentReading, notes: text })
            }
            placeholder="Digite observações"
            multiline
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>
              {isEditing ? "Atualizar" : "Salvar"}
            </Text>
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={resetForm}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lista de Leituras</Text>
        {readings.length > 0 ? (
          <FlatList
            data={readings}
            renderItem={renderItem}
            keyExtractor={(item) => item.id} // Usar ID como string
            style={styles.list}
          />
        ) : (
          <Text style={styles.emptyText}>Nenhuma leitura encontrada</Text>
        )}
      </View>
    </StandardLayout>
  );
}

const styles = StyleSheet.create({
  // Removido estilos que agora são tratados pelo StandardLayout
  // container: {
  //   flex: 1,
  //   padding: 16,
  //   backgroundColor: "#f5f5f5",
  // },
  // title: {
  //   fontSize: 20,
  //   fontWeight: "bold",
  //   marginBottom: 16,
  //   textAlign: "center",
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  statusText: {
    marginBottom: 12,
    fontSize: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#4caf50",
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  editButton: {
    backgroundColor: "#2196f3",
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: "#f44336",
  },
  list: {
    maxHeight: 300,
  },
  item: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  itemContent: {
    marginBottom: 8,
  },
  itemTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  itemActions: {
    flexDirection: "row",
  },
  emptyText: {
    textAlign: "center",
    padding: 16,
    color: "#666",
  },
});

export default SQLiteTestScreen;
