import { cueRule } from "@/studio/explainer/keywords";
import { createFileRoute } from "@tanstack/react-router";
import { askGeminiForExplainer, parseJson } from "@/studio/server/ai";
import { DRAWING_GUIDE } from "@/studio/explainer/drawing";
import { MOTION_GUIDE } from "@/studio/explainer/shapeMotion";
import { motionAudit } from "@/studio/explainer/motionAudit";
import { SETTING_GUIDE } from "@/studio/explainer/settings";
import { normalizePlan, keepScriptWords, VISUALS, MOODS, PALETTES } from "@/studio/explainer/plan";

export const Route = createFileRoute("/api/ai/explainer-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const script = String(body.script ?? "").slice(0, 6000).trim();
        const aspect = body.aspect === "16:9" ? "16:9" : "9:16";
        const generateScript = body.generateScript === true;
        const durationSeconds = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds)
          ? Math.max(15, Math.min(180, Math.round(body.durationSeconds))) : 40;
        const mode = body.mode === "gallery" ? "gallery" : "creative";
        const gallery: { id: string; name: string; drawing: unknown }[] = Array.isArray(body.gallery) ? body.gallery.slice(0, 80).filter((g: any) => g && typeof g.id === "string" && typeof g.name === "string" && Array.isArray(g.drawing)) : [];
        const modeRule = mode === "creative"
          ? `MODO CRIATIVO: use visual=custom em TODAS as cenas e desenhe composições limpas (4 a 12 formas, no máximo 6 objetos, um foco claro por cena, nada sobreposto). Nunca repita a mesma composição. ALTERNÂNCIA: nunca use o mesmo tipo de plano em duas cenas seguidas; alterne entre close do personagem (bust grande reagindo), objeto herói gigante (phone, laptop, scale, chart, clock...), metáfora/carimbo (stamp, xmark, check), plano aberto (skyline, crowd, cenário com personagem). Um HERÓI grande por cena ocupando 60-70% da área.${gallery.length ? ` GALERIA/COFRE (desenhos já prontos, custo zero): se um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing (economiza). Caso contrário desenhe do zero. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ")}.` : ""}`
          : mode === "gallery"
            ? `MODO GALERIA: o usuário tem desenhos salvos. Quando um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ") || "(vazia)"}. Fora isso, prefira os visuais prontos; use custom só quando nada servir.`
            : "PREFIRA custom sempre que o roteiro citar objetos, lugares, ações ou personagens específicos (fogo, cadeira, bombeiros, casa, animais, pessoas nomeadas). Use os visuais prontos só quando servem exatamente.";
        let lessons = "";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("explainer_generations").select("reason").eq("rating", "no").not("reason", "is", null).order("rated_at", { ascending: false }).limit(12);
          if (data?.length) lessons = `ERROS QUE USUÁRIOS JÁ REPORTARAM (nunca repita): ${data.map((d) => d.reason).join(" | ")}`;
        } catch { /* learning is optional */ }
        if (script.length < 4) return Response.json({ error: "Escreva um tema ou roteiro um pouco maior." }, { status: 400 });

        // On short briefs the Gemini is both SCRIPTWRITER and VISUAL DIRECTOR.
        // This is a single direct HIGH request, never a hand-authored sample.
        if (generateScript) {
          const targetWords = Math.max(30, Math.round((durationSeconds - 6) / 0.36));
          const answer = await askGeminiForExplainer(`Você é roteirista e diretor visual de animações 2D explicativas para redes sociais. Crie uma história original, clara e interessante em português brasileiro.
Tema fornecido pelo usuário: """${script}"""
Duração desejada: ${durationSeconds} segundos. Crie aproximadamente ${targetWords} palavras de narração, com começo, desenvolvimento, conclusão e gancho. A duração será ajustada depois com base na narração real.
Se a pauta envolver fatos atuais ou números não fornecidos, não invente estatísticas ou fontes; prefira conceitos verificáveis.
Gere o roteiro INTEGRAL no campo "script", sem marcadores de cena. Divida esse mesmo roteiro em 6 a 10 cenas com campo "text", sem acrescentar, duplicar ou omitir palavras.
Cada cena deve conter um desenho VISUALMENTE ESPECÍFICO para a frase, com objetos, personagens e ações que o motor realmente suporta; evite depender só de etiquetas. Varie cenários e enquadramentos.
O Gemini não é o renderizador: VOCÊ é o programador da animação. Especifique trajetórias usando o campo motion em pelo menos um objeto protagonista por cena, sempre que uma ação for descrita. Mostre origem, contato/ação e resultado em instantes diferentes, não apenas uma pose com pop.
${modeRule}
${DRAWING_GUIDE}
${MOTION_GUIDE}
${SETTING_GUIDE}
${lessons}
Cada cena deve ter:
- visual: uma de [${VISUALS.join(", ")}] (prefira "custom" com desenho por formas quando descrever ações ou objetos).
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}]
- setting: um cenário válido da lista acima.
- drawing (se visual for custom), label, highlight e chips quando úteis.
Responda SOMENTE com JSON: {"title":"título","script":"narração integral","scenes":[{"text":"trecho exato da narração","visual":"custom","mood":"neutral","palette":"teal","setting":"office","drawing":[],"label":"","highlight":[]}]}.`);
          if (!answer.text) return Response.json({
            error: `O Gemini ${answer.model} (High) não conseguiu escrever o roteiro: ${answer.problem}. Nenhum roteiro de demonstração foi usado.`,
            code: answer.problem, provider: "gemini", thinkingLevel: "HIGH"
          }, { status: 503 });
          const parsed = parseJson(answer.text);
          const authoredScript = typeof parsed?.script === "string" ? parsed.script.trim().slice(0, 6000) : "";
          if (authoredScript.length < 20 || !Array.isArray(parsed?.scenes) || !parsed.scenes.length) {
            return Response.json({ error: "O Gemini respondeu, mas não entregou roteiro e cenas válidos. Nenhuma substituição manual foi usada.", code: "invalid_plan" }, { status: 502 });
          }
          parsed.scenes = keepScriptWords(parsed.scenes, authoredScript);
          for (const sc of parsed.scenes) {
            const hit = sc && gallery.find(g => g.id === sc.gallery);
            if (hit) { sc.visual = "custom"; sc.drawing = hit.drawing; }
          }
          const directed = normalizePlan(parsed, authoredScript, aspect);
          return Response.json({
            plan: directed, script: authoredScript, motionAudit: motionAudit(directed),
            source: "gemini", model: answer.model, thinkingLevel: answer.thinkingLevel
          });
        }

        // Existing complete scripts keep their exact wording. Each segment is
        // directed by Gemini HIGH only. Sequence avoids free-tier RPM bursts.
        const sentences = script.match(/[^.!?…\n]+[.!?…]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [script];
        const size = mode === "creative" ? 6 : 8;
        const parts: string[] = [];
        for (let i = 0; i < sentences.length; i += size) parts.push(sentences.slice(i, i + size).join(" "));
        const direct = (script: string) => askGeminiForExplainer(`Você é diretor de animações explicativas 2D para redes sociais (estilo cartoon plano, legenda palavra por palavra).
Divida o roteiro em cenas curtas (uma ideia por cena, 4 a 18 palavras, máx 40 cenas). FIDELIDADE TOTAL: o campo "text" deve conter EXATAMENTE as palavras do roteiro, na ordem, sem inventar, resumir ou acrescentar frases. Todo desenho deve caber inteiro dentro da tela.
${cueRule(script)}
${lessons}
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando (só para conversa/WhatsApp); profile = celular mostrando perfil de rede social com LINK NA BIO e botão seguir; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto; chart_up = gráfico crescendo; money = dinheiro/lucro; custom = você DESENHA a cena livremente com formas)
${modeRule} Seja criativo e literal: ilustre o que a frase diz.
- ${DRAWING_GUIDE}
- ${MOTION_GUIDE}
No modo criativo, atribua motion ao objeto principal quando houver verbo de movimento ou transformação; a sequência deve ter ação e consequência, não só surgimento de símbolos.
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
        const results: any[] = [];
        for (const part of parts) {
          const answer = await direct(part);
          if (!answer.text) return Response.json({
            error: `O Gemini ${answer.model} (High) falhou: ${answer.problem}. Nenhum Lovable ou plano automático foi usado.`,
            code: answer.problem, provider: "gemini", thinkingLevel: "HIGH"
          }, { status: 503 });
          const parsed = parseJson(answer.text);
          if (!parsed || !Array.isArray(parsed.scenes) || !parsed.scenes.length) {
            return Response.json({ error: "Gemini High não retornou cenas 2D válidas; não substituí a resposta por um modelo pronto.", code: "invalid_plan" }, { status: 502 });
          }
          results.push(parsed);
        }
        const raw = { title: results[0]?.title, scenes: results.flatMap(r => r.scenes) };
        // A IA escolhe direção visual e divisão; o texto final é reconstruído somente com palavras do roteiro original.
        // Isso impede frases inventadas, duplicadas ou omitidas, mesmo se o modelo devolver texto divergente.
        if (raw && Array.isArray(raw.scenes)) raw.scenes = keepScriptWords(raw.scenes, script);
        if (raw && Array.isArray(raw.scenes)) for (const sc of raw.scenes) {
          const hit = sc && gallery.find((g) => g.id === sc.gallery);
          if (hit) { sc.visual = "custom"; sc.drawing = hit.drawing; }
        }
        const directed = normalizePlan(raw, script, aspect);
        return Response.json({ plan: directed, script, motionAudit: motionAudit(directed), source: "gemini",
          model: process.env.GEMINI_AI_MODEL || "gemini-3.8-flash", thinkingLevel: "HIGH" });
      },
    },
  },
});
