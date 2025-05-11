import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StandardLayout from '../components/layouts/StandardLayout';

/**
 * Tela para exibir a resposta do webhook
 * @param {Object} props - Propriedades do componente
 * @param {Object} props.route - Objeto de rota contendo os parâmetros de navegação
 * @param {Object} props.navigation - Objeto de navegação
 * @returns {JSX.Element} - Componente da tela
 */
const WebhookResponseScreen = ({ route, navigation }) => {
  const { webhookResult } = route.params;

  // Função para voltar para a tela inicial ou outra tela relevante
  const handleGoHome = () => {
    navigation.navigate('Início'); // Substitua 'Início' pelo nome da sua tela inicial
  };

  return (
    <StandardLayout
      title="Resposta do Webhook"
      description="Aqui está a resposta recebida do webhook após o envio da foto da fachada."
      footer={
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleGoHome}
          >
            <Text style={styles.buttonText}>Voltar para o Início</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.responseContainer}>
        <Text style={styles.responseText}>
          {JSON.stringify(webhookResult, null, 2)}
        </Text>
      </View>
    </StandardLayout>
  );
};

const styles = StyleSheet.create({
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
  responseContainer: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
  },
  responseText: {
    fontSize: 14,
    color: '#2d3748',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4299e1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default WebhookResponseScreen;
