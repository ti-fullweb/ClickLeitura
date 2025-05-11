import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import SyncIndicator from '../components/SyncIndicator';
import { useNavigation } from '@react-navigation/native'; // Importar useNavigation
import { supabase } from '../services/supabase'; // Importar supabase
import { storage } from '../utils/storage'; // Importar MMKV storage
import StandardLayout from '../components/layouts/StandardLayout';

// Função local para gerar deviceId
const getDeviceId = () => {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const SettingsScreen = () => {
  const navigation = useNavigation(); // Obter objeto de navegação
  const { 
    isConnected, 
    isSyncing, 
    pendingCount, 
    forceSyncReadings,
    clearDatabase
  } = useAppContext();

  const [deviceId, setDeviceId] = useState(null);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Obter ID do dispositivo
  const fetchDeviceId = async () => {
    const id = await getDeviceId();
    setDeviceId(id);
  };

  // Se deviceId ainda não foi buscado, buscá-lo
  if (!deviceId) {
    fetchDeviceId();
  }

  // Confirmar limpeza de dados
  const confirmClearData = () => {
    Alert.alert(
      'Limpar Dados',
      'Esta ação irá remover TODAS as leituras salvas no dispositivo. Dados já sincronizados com o servidor não serão afetados. Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Limpar Dados',
          onPress: handleClearData,
          style: 'destructive'
        }
      ]
    );
  };

  // Função para lidar com o logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Erro ao fazer logout:", error);
        Alert.alert("Erro", "Não foi possível fazer logout. Tente novamente.");
      } else {
        console.log("Usuário desconectado.");
        // Limpar dados sensíveis do MMKV, se necessário (perfil do leiturista, roteiro)
        storage.delete('leiturista');
        storage.delete('roteiro_dia');
        // Navegar de volta para a tela de Login e resetar a navegação
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error("Erro inesperado durante o logout:", error);
      Alert.alert("Erro", "Ocorreu um erro inesperado ao fazer logout.");
    }
  };


  // Limpar dados
  const handleClearData = async () => {
    try {
      const success = await clearDatabase();

      if (success) {
        Alert.alert('Sucesso', 'Todos os dados foram removidos do dispositivo.');
      } else {
        Alert.alert('Erro', 'Não foi possível limpar os dados. Tente novamente.');
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao tentar limpar os dados.');
    }
  };

  // Abrir URL
  const openURL = (url) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.error('Não foi possível abrir a URL:', url);
      }
    });
  };

  // Renderizar seção
  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  // Renderizar item de configuração com Switch
  const renderSwitchItem = (icon, title, value, onValueChange, disabled = false) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon} size={22} color="#4299e1" style={styles.settingIcon} />
        <Text style={styles.settingText}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#cbd5e0', true: '#90cdf4' }}
        thumbColor={value ? '#4299e1' : '#f7fafc'}
      />
    </View>
  );

  // Renderizar item de configuração com action/seta
  const renderActionItem = (icon, title, subtitle = null, onPress, destructive = false) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingInfo}>
        <Ionicons 
          name={icon} 
          size={22} 
          color={destructive ? '#f56565' : '#4299e1'} 
          style={styles.settingIcon} 
        />
        <View>
          <Text style={[
            styles.settingText, 
            destructive && { color: '#f56565' }
          ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#a0aec0" />
    </TouchableOpacity>
  );

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <StandardLayout
      title="Configurações"
      footer={
        <SyncIndicator
          isConnected={isConnected}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          onSyncPress={forceSyncReadings}
        />
      }
    >
      {/* Configurações de Sincronização */}
      {renderSection('Sincronização', (
        <>
          {renderSwitchItem(
            'cloud-upload-outline',
            'Sincronização Automática',
            autoSync,
            setAutoSync
          )}

          {renderActionItem(
            'sync-outline',
            'Sincronizar Agora',
            `${pendingCount} leituras pendentes`,
            forceSyncReadings,
            false
          )}

          {deviceId && (
            <View style={styles.deviceIdContainer}>
              <Text style={styles.deviceIdLabel}>ID do Dispositivo:</Text>
              <Text style={styles.deviceId}>{deviceId}</Text>
            </View>
          )}
        </>
      ))}

      {/* Configurações de Aparência */}
      {renderSection('Aparência', (
        <>
          {renderSwitchItem(
            'moon-outline',
            'Modo Escuro',
            darkMode,
            toggleDarkMode
          )}

          {renderSwitchItem(
            'notifications-outline',
            'Notificações',
            notifications,
            setNotifications
          )}
        </>
      ))}

      {/* Sobre o App */}
      {renderSection('Sobre', (
        <>
          {renderActionItem(
            'information-circle-outline',
            'Sobre o App',
            'Versão 1.0.0',
            () => {}
          )}

          {renderActionItem(
            'help-circle-outline',
            'Ajuda & Suporte',
            null,
            () => {}
          )}

          {renderActionItem(
            'document-text-outline',
            'Termos de Uso',
            null,
            () => {}
          )}
        </>
      ))}

      {/* Gerenciamento de Dados */}
      {renderSection('Gerenciamento de Dados', (
        <>
          {renderActionItem(
            'trash-outline',
            'Limpar Todos os Dados',
            'Remove todas as leituras salvas localmente',
            confirmClearData,
            true
          )}
        </>
      ))}

      {/* Botão de Logout */}
      {renderSection('Conta', ( // Nova seção para o botão de logout
         <>
           {renderActionItem(
             'log-out-outline',
             'Sair',
             'Desconectar da sua conta',
             handleLogout,
             true // Botão de logout geralmente é destrutivo visualmente
           )}
         </>
      ))}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#2d3748',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  deviceIdContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  deviceIdLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 14,
    color: '#4a5568',
    fontFamily: 'monospace',
  },
});

export default SettingsScreen;
