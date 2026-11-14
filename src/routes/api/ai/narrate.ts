import { createFileRoute } from "@tanstack/react-router";
import { NARRATION_VOICES } from "@/studio/explainer/voice";

// Server-only: turns one scene line into a natural WAV narration via the Lovable AI Gateway.
const MODEL = "google/gemini-3.1-flash-tts-preview";

export const Route = createFileRoute("/api/ai/narrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const text = String(body?.text ?? "").trim();
        if (!text) return Response.json({ error: "Texto vazio." }, { status: 400 });
        if (text.length > 500) return Response.json({ error: "A fala ultrapassa 500 caracteres. Divida a cena antes de gerar a voz. Nenhuma palavra foi cortada." }, { status: 400 });
        if (body.provider === "elevenlabs") return elevenLabs(text, String(body.voiceId ?? ""));
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "Voz indisponível no momento." }, { status: 503 });
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
          console.error(`TTS gateway [${upstream.status}]`);
          const msg = upstream.status === 402 ? "Créditos de IA esgotados para a voz." : upstream.status === 429 ? "Muitos pedidos de voz; tente em instantes." : "Não foi possível gerar a voz.";
          return Response.json({ error: msg }, { status: upstream.status });
        }
        return new Response(upstream.body, { status: 200, headers: { "Content-Type": upstream.headers.get("Content-Type") || "audio/wav", "Cache-Control": "no-cache" } });
      },
    },
  },
});

/** Prepared ElevenLabs path: works once an ElevenLabs connection is linked (ELEVENLABS_API_KEY). */
async function elevenLabs(text: string, voiceId: string) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "ElevenLabs ainda não está conectado ao projeto." }, { status: 503 });
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) return Response.json({ error: "Informe um Voice ID válido do ElevenLabs." }, { status: 400 });
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true } }),
  });
  if (!r.ok) {
    console.error(`ElevenLabs [${r.status}]`);
    return Response.json({ error: r.status === 401 ? "Chave do ElevenLabs inválida." : "ElevenLabs não gerou a voz." }, { status: r.status });
  }
  return new Response(r.body, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" } });
}
