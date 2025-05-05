
import { getUnsyncedReadings, updateReadingSyncStatus } from '../database/database';

export const sincronizarComWebhook = async () => {
  try {
    const leiturasPendentes = await getUnsyncedReadings();

    if (leiturasPendentes.length === 0) {
      console.log("Nenhuma leitura pendente para sincronizar.");
      return { success: 0, message: "Nenhuma leitura para sincronizar." };
    }

    const webhookUrl = "https://n8n-n8n.n1n956.easypanel.host/webhook/e85a5e53-b870-49b9-99b0-03b0753ba1c6";

    for (const leitura of leiturasPendentes) {
      try {
        const payload = {
          id: leitura.id,
          meter_id: leitura.meter_id,
          reading_value: leitura.reading_value,
          client_name: leitura.client_name || 'Não informado',
          address: leitura.address || 'Não informado',
          bairro: leitura.bairro || 'Não informado',
          cidade: leitura.cidade || 'Não informado',
          notes: leitura.notes || 'Não informado',
          image_path: leitura.image_path || null,
          timestamp: leitura.timestamp,
          synced: leitura.synced,
          neighborhood: leitura.bairro || 'Não informado',
          city: leitura.cidade || 'Não informado'
        };
        
        console.log('Enviando payload:', payload);
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await updateReadingSyncStatus(leitura.id, true); // marca como sincronizado
        } else {
          console.warn("Erro ao sincronizar leitura ID:", leitura.id);
        }
      } catch (err) {
        console.error("Erro ao enviar leitura:", err);
      }
    }

    return { success: leiturasPendentes.length, message: "Leituras sincronizadas com sucesso." };
  } catch (error) {
    console.error("Erro ao sincronizar leituras:", error);
    return { success: 0, message: "Erro durante sincronização." };
  }
};
