export const sendImageToWebhook = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: `foto-hidrometro.jpg`,
        type: `image/jpeg`,
      } as any);
  
      const response = await fetch("https://n8n-n8n.n1n956.easypanel.host/webhook/Fimm-Hidrometro", {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      throw error;
    }
  };
  