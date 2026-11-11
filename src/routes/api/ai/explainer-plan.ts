import { createFileRoute } from "@tanstack/react-router";
import { askAi, parseJson } from "@/studio/server/ai";
import { buildFallbackPlan, normalizePlan, VISUALS, MOODS, PALETTES } from "@/studio/explainer/plan";

export const Route = createFileRoute("/api/ai/explainer-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const script = String(body.script ?? "").slice(0, 6000).trim();
        const aspect = body.aspect === "16:9" ? "16:9" : "9:16";
        if (script.length < 4) return Response.json({ error: "Escreva um roteiro um pouco maior." }, { status: 400 });
        const text = await askAi(`Você é diretor de animações explicativas 2D para redes sociais (estilo cartoon plano, legenda palavra por palavra).
Divida o roteiro em cenas curtas (uma ideia por cena, 4 a 18 palavras, máx 40 cenas), mantendo o texto original fiel.
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto)
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}], varie entre cenas; use night para momentos tristes ou finais
- label: etiqueta curta opcional (ex: "3 MESES DEPOIS...", "DE GRAÇA")
- chat: texto da mensagem quando visual=phone_chat
- chips: até 4 etiquetas curtas para chips/scale
- highlight: palavras do texto para destacar em amarelo
Roteiro:
"""${script}"""
Formato JSON: {"title": string, "scenes": [{"text","visual","mood","palette","label","chat","chips","highlight"}]}`);
        const raw = parseJson(text);
        if (!raw) return Response.json({ plan: buildFallbackPlan(script, aspect), source: "fallback" });
        return Response.json({ plan: normalizePlan(raw, script, aspect), source: "ai" });
      },
    },
  },
});
