import { createFileRoute } from "@tanstack/react-router";

// Server-only: turns a spoken script or an uploaded narration into text via the Lovable AI Gateway.
const MODEL = "openai/gpt-transcribe";
const MAX_BYTES = 24 * 1024 * 1024;

export const Route = createFileRoute("/api/ai/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ error: "Transcrição indisponível no momento." }, { status: 503 });
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || !file.size) return Response.json({ error: "Nenhum áudio recebido." }, { status: 400 });
        if (file.size > MAX_BYTES) return Response.json({ error: "Áudio grande demais (máx. 24 MB)." }, { status: 413 });
        const up = new FormData();
        up.append("model", MODEL);
        up.append("file", file, file.name || "audio.webm");
        up.append("response_format", "json");
        up.append("languages", "pt");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: up });
        if (!res.ok) {
          const detail = await res.text();
          console.error(`STT gateway [${res.status}]: ${detail}`);
          const msg = res.status === 402 ? "Créditos de IA esgotados." : res.status === 429 ? "Muitos pedidos; tente em instantes." : "Não foi possível entender o áudio.";
          return Response.json({ error: msg }, { status: res.status });
        }
        const data = await res.json();
        return Response.json({ text: String(data.text ?? "").trim() });
      },
    },
  },
});
