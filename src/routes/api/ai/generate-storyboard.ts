import { createFileRoute } from "@tanstack/react-router";
import { askAi, parseJson } from "@/studio/server/ai";

const fallback = {
  title: "Vídeo Criativo",
  colorPreset: "teal-orange",
  musicGenre: "synthwave",
  headline: "NOVA GERAÇÃO",
  subtitle: "Tecnologia que transforma ideias",
};

export const Route = createFileRoute("/api/ai/generate-storyboard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const idea = String(body.ideaPrompt ?? "").slice(0, 3000);
        const data = parseJson(
          await askAi(`Gere uma estrutura de vídeo para o tema: "${idea}".
Formato: { "title": "Nome do Projeto", "colorPreset": "teal-orange", "headline": "Título principal (max 4 palavras)", "subtitle": "Subtítulo curto", "recommendedMusic": "ambient" }`),
        );
        return Response.json(data?.title ? data : fallback);
      },
    },
  },
});
