import React, { useEffect } from "react";
import { TempoDevtools } from "tempo-devtools";

export const TempoSetup = () => {
  useEffect(() => {
    const initializeTempo = async () => {
      try {
        if (process.env.NEXT_PUBLIC_TEMPO) {
          await Promise.resolve(TempoDevtools.init());
          console.log("Tempo Devtools inicializado com sucesso");
        }
      } catch (error) {
        console.error("Erro ao inicializar Tempo Devtools:", error);
        // Prevent error from crashing the app
      }
    };

    initializeTempo();
  }, []);

  return null;
};
