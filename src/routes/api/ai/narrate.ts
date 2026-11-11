import { createFileRoute } from "@tanstack/react-router";
import { NARRATION_VOICES } from "@/studio/explainer/voice";

// Server-only: turns one scene line into a natural WAV narration via the Lovable AI Gateway.
const MODEL = "google/gemini-3.1-flash-tts-preview";

export const Route = createFileRoute("/api/ai/narrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "Voz indisponível no momento." }, { status: 503 });
        const body = await request.json().catch(() => ({}));
        const text = String(body.text ?? "").trim().slice(0, 500);
        const voice = NARRATION_VOICES.some((v) => v.id === body.voice) ? body.voice : NARRATION_VOICES[0].id;
        if (!text) return Response.json({ error: "Texto vazio." }, { status: 400 });
        const charm = voice === "Algieba" ? "Fale como um mentalista charmoso e espirituoso: voz masculina suave, descontraída e levemente rouca, com um sorriso na voz, tom confiante e brincalhão, ritmo tranquilo e pausas calculadas antes das revelações. " : "";
        const direction = charm + "Narre em português do Brasil como um narrador de vídeo explicativo para redes sociais: voz natural, calorosa e confiante, ritmo dinâmico porém claro, pausas curtas nas vírgulas, sem soar robótico. Leia exatamente este texto:";
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: `${direction} ${text}` }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
            stream_format: "audio",
          }),
        });
        if (!upstream.ok) {
          const detail = await upstream.text();
          console.error(`TTS gateway [${upstream.status}]: ${detail}`);
          const msg = upstream.status === 402 ? "Créditos de IA esgotados para a voz." : upstream.status === 429 ? "Muitos pedidos de voz; tente em instantes." : "Não foi possível gerar a voz.";
          return Response.json({ error: msg }, { status: upstream.status });
        }
        return new Response(upstream.body, { status: 200, headers: { "Content-Type": upstream.headers.get("Content-Type") || "audio/wav", "Cache-Control": "no-cache" } });
      },
    },
  },
});
