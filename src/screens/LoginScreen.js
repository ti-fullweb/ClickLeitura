import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../services/supabase"; // Importar o cliente Supabase
import { storage } from "../utils/storage"; // Importar MMKV storage

export default function LoginScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Erro", "Por favor, preencha todos os campos");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username, // Usar o campo username como email
        password: password,
      });

      if (error) {
        throw error;
      }

      // Se o login for bem-sucedido, buscar informações adicionais do leiturista
      if (data.user) {
        const { data: leituristaData, error: leituristaError } = await supabase
          .from('leituristas') // Tabela informada pelo usuário
          .select('*')
          .eq('user_id', data.user.id) // Corrigido para usar user_id
          .single();

        if (leituristaError) {
          console.error("Erro ao buscar perfil do leiturista:", leituristaError);
          // Decidir se o login deve falhar se o perfil não for encontrado
          // Por enquanto, vamos permitir o login mas alertar sobre o perfil
          Alert.alert("Aviso", "Perfil do leiturista não encontrado no banco de dados.");
          // Não lançar erro fatal aqui para permitir a navegação
        } else if (leituristaData) {
          console.log("Perfil do leiturista encontrado:", leituristaData);
          // Salvar dados completos do leiturista no MMKV
          storage.set('leiturista', JSON.stringify(leituristaData));
          console.log("Perfil do leiturista salvo no MMKV.");
        } else {
           console.warn("Busca do perfil do leiturista não retornou dados.");
        }
      } else {
         console.warn("Login bem-sucedido, mas data.user é null ou undefined.");
      }


      // Navega para a tela inicial após login bem-sucedido
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (error) {
      Alert.alert(
        "Erro de Login",
        error.message || "Não foi possível fazer login. Verifique suas credenciais.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Feather name="droplet" size={40} color="#1e40af" />
        </View>
        <Text style={styles.appName}>App Leiturista</Text>
        <Text style={styles.appSlogan}>Gestão de leituras de água</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Feather
            name="user"
            size={20}
            color="#64748b"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Nome de usuário"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Feather
            name="lock"
            size={20}
            color="#64748b"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.loginButtonText}>Carregando...</Text>
          ) : (
            <Text style={styles.loginButtonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2024 App Leiturista</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 80,
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 8,
  },
  appSlogan: {
    fontSize: 16,
    color: "#64748b",
  },
  formContainer: {
    paddingHorizontal: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#334155",
  },
  loginButton: {
    backgroundColor: "#1e40af",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPassword: {
    alignItems: "center",
    marginTop: 16,
  },
  forgotPasswordText: {
    color: "#1e40af",
    fontSize: 14,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 12,
  },
});
