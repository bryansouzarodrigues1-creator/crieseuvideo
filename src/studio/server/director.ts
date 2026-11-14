import { cueRule } from '../explainer/keywords';
import { DRAWING_GUIDE } from '../explainer/drawing';
import { SETTING_GUIDE } from '../explainer/settings';
import { normalizePlan, VISUALS, MOODS, PALETTES, type ExplainerPlan } from '../explainer/plan';
import { directorChunks, scriptError, spokenText } from '../explainer/script';
import { askAiResult, parseJson, type AiEnvironment, type AiResult } from './ai';

export class DirectorError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface DirectorInput { script: string; aspect?: unknown; mode?: unknown; gallery?: unknown; lessons?: string }
export function validateDirectorInput(script: unknown): asserts script is string {
  const error = typeof script === 'string' ? scriptError(script) : 'Informe o roteiro em texto.';
  if (error) throw new DirectorError(400, 'invalid_script', error);
}
function providerError(result: Extract<AiResult, { ok: false }>): DirectorError {
  const messages = {
    missing_key: 'A IA escolhida ainda não está conectada. Seu roteiro foi preservado. Você pode criar sem IA.',
    quota: 'A cota da IA terminou ou está temporariamente limitada. Nenhuma nova etapa foi iniciada. Tente mais tarde ou crie sem IA.',
    auth: 'O provedor recusou a credencial da IA. Confira a conexão antes de tentar novamente.',
    timeout: 'A direção demorou demais. O roteiro foi preservado; nenhuma tentativa automática será feita.',
    invalid_response: 'A IA entregou uma resposta incompleta. O roteiro foi preservado.',
    configuration: 'O provedor de IA configurado não é válido.',
    upstream: 'Não foi possível concluir a direção. O roteiro foi preservado; nenhuma tentativa automática será feita.',
  };
  return new DirectorError(result.code === 'quota' ? 429 : 503, result.code, messages[result.code]);
}

/** Shared by the production route and the isolated test site. At most two requests in flight. */
export async function directExplainer(input: DirectorInput, env?: AiEnvironment) {
  validateDirectorInput(input.script);
  const script = input.script.trim();
  const aspect = input.aspect === '16:9' ? '16:9' : '9:16';
  const mode = input.mode === 'gallery' ? 'gallery' : 'creative';
  const gallery: { id: string; name: string; drawing: unknown }[] = Array.isArray(input.gallery)
    ? input.gallery.slice(0, 80).filter((g: any) => g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.drawing)) : [];
  const lessons = input.lessons || '';
        const modeRule = mode === "creative"
          ? `MODO CRIATIVO: use visual=custom em TODAS as cenas e desenhe composições limpas (4 a 12 formas, no máximo 6 objetos, um foco claro por cena, nada sobreposto). Nunca repita a mesma composição. ALTERNÂNCIA: nunca use o mesmo tipo de plano em duas cenas seguidas; alterne entre close do personagem (bust grande reagindo), objeto herói gigante (phone, laptop, scale, chart, clock...), metáfora/carimbo (stamp, xmark, check), plano aberto (skyline, crowd, cenário com personagem). Um HERÓI grande por cena ocupando 60-70% da área.${gallery.length ? ` GALERIA/COFRE (desenhos já prontos, custo zero): se um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing (economiza). Caso contrário desenhe do zero. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ")}.` : ""}`
          : mode === "gallery"
            ? `MODO GALERIA: o usuário tem desenhos salvos. Quando um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ") || "(vazia)"}. Fora isso, prefira os visuais prontos; use custom só quando nada servir.`
            : "PREFIRA custom sempre que o roteiro citar objetos, lugares, ações ou personagens específicos (fogo, cadeira, bombeiros, casa, animais, pessoas nomeadas). Use os visuais prontos só quando servem exatamente.";
        const direct = (script: string) => askAiResult(`Você é diretor de animações explicativas 2D para redes sociais (estilo cartoon plano, legenda palavra por palavra).
Divida o roteiro em cenas curtas (uma ideia por cena, 4 a 18 palavras, sem omitir nenhuma palavra). FIDELIDADE TOTAL: o campo "text" deve conter EXATAMENTE as palavras do roteiro, na ordem, sem inventar, resumir ou acrescentar frases. Todo desenho deve caber inteiro dentro da tela.
${cueRule(script)}
${lessons}
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando (só para conversa/WhatsApp); profile = celular mostrando perfil de rede social com LINK NA BIO e botão seguir; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto; chart_up = gráfico crescendo; money = dinheiro/lucro; custom = você DESENHA a cena livremente com formas)
${modeRule} Seja criativo e literal: ilustre o que a frase diz.
- ${DRAWING_GUIDE}
- ${SETTING_GUIDE} Sempre preencha "setting" em todas as cenas.
- story (opcional, para ação FÍSICA inequivocamente descrita nesta frase; não é um desenho estático): {"action":"pickup|handoff|chase","prop":"lantern|hat|ball|box|key","actors":[{"name":"nome literal que aparece neste trecho","color":"#FFB447"},{"name":"segundo nome literal","color":"#4AC6BE"}]}. pickup=pegar objeto, handoff=uma pessoa entrega objeto à outra, chase=correr atrás de objeto. Só use se a frase contiver verbo afirmativo explícito, nome(s) literal(is) e o objeto certo (lanterna, chapéu, bola, caixa ou chave). Em handoff, "actors" deve vir na ordem do GIVER e RECEIVER conforme a frase (Lia entregou a Caio => [Lia, Caio]); inclua duas pessoas. Não invente uma entrega se houver "não entregou", "nunca pegou", ordem ambígua ou frase hipotética. Quando houver story, use visual=custom e OMITA drawing; a engine irá animar contato e posse do objeto. Nunca repita story em cenas cujo texto não tenha essa ação.
- presenterPose (opcional): escolha um de [idle, talking, pointing, running, shocked] SOMENTE quando houver ação humana concreta ou reação do apresentador. 'running' para correr/fugir, 'shocked' para se assustar, 'pointing' para mostrar/apontar. Caso contrário omita; não repita gestos genéricos.
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}], varie entre cenas; use night para momentos tristes ou finais
- label: etiqueta curta opcional (ex: "3 MESES DEPOIS...", "DE GRAÇA")
- chat: texto da mensagem quando visual=phone_chat
- chips: até 4 etiquetas curtas para chips/scale
- highlight: palavras do texto para destacar em amarelo
Roteiro:
"""${script}"""
Formato JSON: {"title": string, "scenes": [{"text","visual","mood","palette","label","chat","chips","highlight","drawing","gallery","setting","presenterPose","story"}]}`, undefined, env);
  const parts = directorChunks(script);
  const plans: ExplainerPlan[] = new Array(parts.length);
  let next = 0;
  let failure: DirectorError | null = null;
  let provider = '', model = '';
  const worker = async () => {
    while (!failure && next < parts.length) {
      const i = next++;
      const result = await direct(parts[i]!);
      if (!result.ok) { failure ??= providerError(result); return; }
      const raw = parseJson(result.text);
      if (!raw || !Array.isArray(raw.scenes) || !raw.scenes.length || !raw.scenes.every((s: unknown) => s && typeof s === 'object' && !Array.isArray(s))) {
        failure ??= new DirectorError(502, 'invalid_plan', 'A IA não entregou cenas válidas. O roteiro foi preservado.'); return;
      }
      for (const scene of raw.scenes) {
        const hit = gallery.find((g) => g.id === scene.gallery);
        if (hit) { scene.visual = 'custom'; scene.drawing = hit.drawing; }
      }
      // Repair each original chunk independently, so a failure/cut cannot shift
      // the text of later scenes into drawings for a different subject.
      plans[i] = normalizePlan(raw, parts[i]!, aspect);
      provider = result.provider; model = result.model;
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, parts.length) }, worker));
  if (failure) throw failure;
  const plan: ExplainerPlan = { title: plans[0]!.title, aspect, scenes: plans.flatMap((p) => p.scenes) };
  if (spokenText(plan.scenes.map((s) => s.text).join(' ')) !== spokenText(script)) {
    throw new DirectorError(502, 'script_mismatch', 'A direção não preservou o roteiro completo. Nenhum vídeo foi substituído.');
  }
  return { plan, source: 'ai' as const, provider, model };
}
