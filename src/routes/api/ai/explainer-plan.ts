import { cueRule } from "@/studio/explainer/keywords";
import { createFileRoute } from "@tanstack/react-router";
import { askAi, parseJson } from "@/studio/server/ai";
import { DRAWING_GUIDE } from "@/studio/explainer/drawing";
import { SETTING_GUIDE } from "@/studio/explainer/settings";
import { buildFallbackPlan, normalizePlan, VISUALS, MOODS, PALETTES } from "@/studio/explainer/plan";

export const Route = createFileRoute("/api/ai/explainer-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const script = String(body.script ?? "").slice(0, 6000).trim();
        const aspect = body.aspect === "16:9" ? "16:9" : "9:16";
        const mode = body.mode === "gallery" ? "gallery" : "creative";
        const gallery: { id: string; name: string; drawing: unknown }[] = Array.isArray(body.gallery) ? body.gallery.slice(0, 80).filter((g: any) => g && typeof g.id === "string" && typeof g.name === "string" && Array.isArray(g.drawing)) : [];
        const modeRule = mode === "creative"
          ? `MODO CRIATIVO: use visual=custom em TODAS as cenas e desenhe cenários completos e ricos (céu/chão/fundo, objetos, personagens, 10 a 22 formas bem compostas, um foco claro por cena). Nunca repita a mesma composição. ALTERNÂNCIA: nunca use o mesmo tipo de plano em duas cenas seguidas; alterne entre close do personagem (bust grande reagindo), objeto herói gigante (phone, laptop, scale, chart, clock...), metáfora/carimbo (stamp, xmark, check), plano aberto (skyline, crowd, cenário com personagem). Um HERÓI grande por cena ocupando 60-70% da área.${gallery.length ? ` GALERIA/COFRE (desenhos já prontos, custo zero): se um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing (economiza). Caso contrário desenhe do zero. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ")}.` : ""}`
          : mode === "gallery"
            ? `MODO GALERIA: o usuário tem desenhos salvos. Quando um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ") || "(vazia)"}. Fora isso, prefira os visuais prontos; use custom só quando nada servir.`
            : "PREFIRA custom sempre que o roteiro citar objetos, lugares, ações ou personagens específicos (fogo, cadeira, bombeiros, casa, animais, pessoas nomeadas). Use os visuais prontos só quando servem exatamente.";
        let lessons = "";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("explainer_generations").select("reason").eq("rating", "no").not("reason", "is", null).order("rated_at", { ascending: false }).limit(12);
          if (data?.length) lessons = `ERROS QUE USUÁRIOS JÁ REPORTARAM (nunca repita): ${data.map((d) => d.reason).join(" | ")}`;
        } catch { /* learning is optional */ }
        if (script.length < 4) return Response.json({ error: "Escreva um roteiro um pouco maior." }, { status: 400 });
        // Long scripts are directed in parallel chunks so rich creative drawings never hit the time limit and fall back to ready-made visuals.
        const sentences = script.match(/[^.!?…\n]+[.!?…]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [script];
        const size = mode === "creative" ? 1 : 8;
        const parts: string[] = [];
        for (let i = 0; i < sentences.length; i += size) parts.push(sentences.slice(i, i + size).join(" "));
        const direct = (script: string) => askAi(`Você é diretor de animações explicativas 2D para redes sociais (estilo cartoon plano, legenda palavra por palavra).
Divida o roteiro em cenas curtas (uma ideia por cena, 4 a 18 palavras, máx 40 cenas). FIDELIDADE TOTAL: o campo "text" deve conter EXATAMENTE as palavras do roteiro, na ordem, sem inventar, resumir ou acrescentar frases. Todo desenho deve caber inteiro dentro da tela.
${cueRule(script)}
${lessons}
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando (só para conversa/WhatsApp); profile = celular mostrando perfil de rede social com LINK NA BIO e botão seguir; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto; chart_up = gráfico crescendo; money = dinheiro/lucro; custom = você DESENHA a cena livremente com formas)
${modeRule} Seja criativo e literal: ilustre o que a frase diz.
- ${DRAWING_GUIDE}
- ${SETTING_GUIDE} Sempre preencha "setting" em todas as cenas.
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}], varie entre cenas; use night para momentos tristes ou finais
- label: etiqueta curta opcional (ex: "3 MESES DEPOIS...", "DE GRAÇA")
- chat: texto da mensagem quando visual=phone_chat
- chips: até 4 etiquetas curtas para chips/scale
- highlight: palavras do texto para destacar em amarelo
Roteiro:
"""${script}"""
Formato JSON: {"title": string, "scenes": [{"text","visual","mood","palette","label","chat","chips","highlight","drawing","gallery","setting"}]}`);
        const results = (await Promise.all(parts.map((p) => direct(p)))).map(parseJson);
        const ok = results.filter((r) => r && Array.isArray(r.scenes));
        const raw = ok.length ? { title: ok[0].title, scenes: results.flatMap((r, i) => (r && Array.isArray(r.scenes) ? r.scenes : [{ text: parts[i] }])) } : null;
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
