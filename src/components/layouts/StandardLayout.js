import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Ícone para o botão de voltar

/**
 * Componente de layout padrão aprimorado para aplicação (foco em UX)
 * @param {Object} props - Propriedades do componente
 * @param {React.ReactNode} props.children - Conteúdo da página
 * @param {string} props.title - Título da página (obrigatório para o cabeçalho)
 * @param {string} props.description - Descrição da página (opcional, exibida abaixo do título)
 * @param {Function} props.onBackPress - Função para voltar (se fornecida, exibe botão de voltar no cabeçalho)
 * @param {React.ReactNode} props.footer - Conteúdo do rodapé (opcional, fixo na parte inferior)
 * @param {boolean} props.disableScroll - Desabilita o ScrollView interno (útil para VirtualizedLists)
 * @param {React.ReactNode} props.headerRight - Conteúdo adicional no lado direito do cabeçalho (opcional)
 * @returns {JSX.Element} - Componente de layout
 */
const StandardLayout = ({ 
  children, 
  title, 
  description, 
  onBackPress, 
  footer,
  disableScroll = false,
  headerRight
}) => {
  const content = (
    <View style={styles.content}>
      {description && <Text style={styles.description}>{description}</Text>}
      
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        {onBackPress && (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color="#2d3748" />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          {title && <Text style={styles.title}>{title}</Text>}
        </View>
        {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
      </View>

      {/* Conteúdo com ou sem ScrollView */}
      {disableScroll ? (
        // Se scroll desabilitado, o conteúdo preenche o espaço restante
        <View style={styles.contentContainerNoScroll}>
           {content}
        </View>
      ) : (
        // Se scroll habilitado, o conteúdo está dentro do ScrollView
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          {content}
        </ScrollView>
      )}
      
      {/* Rodapé */}
      {footer && (
        <View style={styles.footer}>
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
    // Sombra para Android
    elevation: 2,
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  backButton: {
    marginRight: 12,
    padding: 4, // Aumenta a área clicável
  },
  titleContainer: {
    flex: 1, // Permite que o título ocupe o espaço restante
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  headerRight: {
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1, // Permite que o conteúdo cresça para preencher o espaço
  },
  contentContainerNoScroll: {
    flex: 1, // Permite que o conteúdo preencha o espaço restante quando o scroll está desabilitado
  },
  content: {
    padding: 16,
  },
  description: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 16, // Espaço após a descrição
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    backgroundColor: '#fff',
    // Sombra para Android
    elevation: 8,
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
});

export default StandardLayout;
