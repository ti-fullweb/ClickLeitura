
# AppLeiturista

Um aplicativo móvel para leituristas realizarem medições de consumo com suporte a modo offline e sincronização.

## 🚀 Funcionalidades

- 📸 Captura de fotos de medidores
- 🏠 Registro de fachadas de imóveis
- 📱 Funcionamento offline
- 🔄 Sincronização automática quando online
- 📍 Roteiro diário com organização por ruas
- ✅ Marcação de visitas realizadas

## 🛠️ Tecnologias

- React Native + Expo
- Typescript
- TailwindCSS (NativeWind)
- SQLite
- N8N Webhook


## 📦 Instalação

```bash
# Instalar dependências
npm install
npx expo install
npx expo install expo-dev-client
npx expo install expo-sqlite
npx expo install expo-dev-client expo-sqlite
npx expo start -c
npx expo run:android

# Iniciar o projeto
npx expo run:android  
```

## 🔧 Configuração

O projeto requer as seguintes variáveis de ambiente:

-Hidrômetro Webhook https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro 
-Fachadas Webhook https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Fachada-da-Casa
-roda diaria Webhook https://n8n-n8n.n1n956.easypanel.host/webhook/e85a5e53-b870-49b9-99b0-03b0753ba1c6


Configure-as através da ferramenta Secrets do Replit.

## 📱 Uso

1. Faça login no aplicativo
2. Sincronize o roteiro do dia
3. Visualize a lista de endereços
4. Capture fotos dos medidores
5. Registre as leituras
6. Marque as visitas como concluídas

## 📄 Licença

Este projeto é privado e proprietário.
