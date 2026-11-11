import { createFileRoute } from "@tanstack/react-router";
import { askAi, parseJson } from "@/studio/server/ai";
import { DRAWING_GUIDE } from "@/studio/explainer/drawing";
import { buildFallbackPlan, normalizePlan, VISUALS, MOODS, PALETTES } from "@/studio/explainer/plan";

export const Route = createFileRoute("/api/ai/explainer-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const script = String(body.script ?? "").slice(0, 6000).trim();
        const aspect = body.aspect === "16:9" ? "16:9" : "9:16";
        const mode = body.mode === "creative" || body.mode === "gallery" ? body.mode : "smart";
        const gallery: { id: string; name: string; drawing: unknown }[] = Array.isArray(body.gallery) ? body.gallery.slice(0, 40).filter((g: any) => g && typeof g.id === "string" && typeof g.name === "string" && Array.isArray(g.drawing)) : [];
        const modeRule = mode === "creative"
          ? "MODO CRIATIVO: use visual=custom em TODAS as cenas e desenhe cenários completos e ricos (céu/chão/fundo, objetos, personagens, 20 a 40 formas, várias animações). Nunca repita a mesma composição."
          : mode === "gallery"
            ? `MODO GALERIA: o usuário tem desenhos salvos. Quando um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ") || "(vazia)"}. Fora isso, prefira os visuais prontos; use custom só quando nada servir.`
            : "PREFIRA custom sempre que o roteiro citar objetos, lugares, ações ou personagens específicos (fogo, cadeira, bombeiros, casa, animais, pessoas nomeadas). Use os visuais prontos só quando servem exatamente.";
        if (script.length < 4) return Response.json({ error: "Escreva um roteiro um pouco maior." }, { status: 400 });
        const text = await askAi(`Você é diretor de animações explicativas 2D para redes sociais (estilo cartoon plano, legenda palavra por palavra).
Divida o roteiro em cenas curtas (uma ideia por cena, 4 a 18 palavras, máx 40 cenas), mantendo o texto original fiel.
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto; chart_up = gráfico crescendo; money = dinheiro/lucro; custom = você DESENHA a cena livremente com formas)
${modeRule} Seja criativo e literal: ilustre o que a frase diz.
- ${DRAWING_GUIDE}
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}], varie entre cenas; use night para momentos tristes ou finais
- label: etiqueta curta opcional (ex: "3 MESES DEPOIS...", "DE GRAÇA")
- chat: texto da mensagem quando visual=phone_chat
- chips: até 4 etiquetas curtas para chips/scale
- highlight: palavras do texto para destacar em amarelo
Roteiro:
"""${script}"""
Formato JSON: {"title": string, "scenes": [{"text","visual","mood","palette","label","chat","chips","highlight","drawing","gallery"}]}`);
        const raw = parseJson(text);
        if (raw && Array.isArray(raw.scenes)) for (const sc of raw.scenes) {
          const hit = sc && gallery.find((g) => g.id === sc.gallery);
          if (hit) { sc.visual = "custom"; sc.drawing = hit.drawing; }
        }
        if (!raw) return Response.json({ plan: buildFallbackPlan(script, aspect), source: "fallback" });
        return Response.json({ plan: normalizePlan(raw, script, aspect), source: "ai" });
      },
    },
  },
});
