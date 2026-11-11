import { createFileRoute } from "@tanstack/react-router";
import { askAi, parseJson } from "@/studio/server/ai";

const fallback = {
  captions: [
    { text: "Bem-vindo ao StickStory Studio", startTime: 0.5, duration: 2.5 },
    { text: "Direção de cenas animadas em tempo real", startTime: 3.5, duration: 3.0 },
    { text: "História, emoção e movimento sincronizados", startTime: 7.0, duration: 3.5 },
  ],
};

export const Route = createFileRoute("/api/ai/generate-captions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const prompt = String(body.scriptOrPrompt ?? "").slice(0, 5000);
        const total = Number(body.totalDuration) || 12;
        const data = parseJson(
          await askAi(`Você é um assistente de legendagem de vídeo. Gere legendas divididas em segmentos com tempos de início e duração (em segundos) que caibam em um vídeo de ${total} segundos no total.
Texto ou tema do vídeo: "${prompt}".
Formato: { "captions": [ { "text": "Frase curta e impactante", "startTime": 0.5, "duration": 2.5 } ] }`),
        );
        return Response.json(data?.captions ? data : fallback);
      },
    },
  },
});
