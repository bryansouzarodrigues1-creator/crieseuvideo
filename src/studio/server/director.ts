import { cueRule } from '../explainer/keywords';
import { DRAWING_GUIDE } from '../explainer/drawing';
import { SETTING_GUIDE } from '../explainer/settings';
import { normalizePlan, buildFallbackPlan, VISUALS, MOODS, PALETTES, PRESENTER_POSES, type ExplainerPlan } from '../explainer/plan';
import { scriptError, spokenText } from '../explainer/script';
import { sourceBeats, beatChunks, groundScenes, type SourceBeat } from './grounding';
import { normalizeStory, STORY_ACTIONS } from '../explainer/storyAction';
import { normalizeStaging, STAGING_GUIDE, ACTION_LABELS, STAGED_ACTIONS } from '../explainer/staging';
import { normalizeTargetDuration, withTargetDuration } from '../explainer/duration';
import { askAiResult, parseJson, type AiEnvironment, type AiResult } from './ai';
import { PRODUCTION_GUIDE, ProductionError, mergeProduction, CHANNELS } from '../explainer/production/score';
import { directionSchema, stagingContract } from './directionContract';

export interface ActionFailure { sourceId: string; field: 'story' | 'staging'; receivedAction: string; expectedAction: string | null }
export class DirectorError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: ActionFailure) { super(message); }
}
function actionError(scene: Record<string, any>, field: ActionFailure['field']) {
  const value = scene[field]?.action;
  // Never echo an arbitrary model string into diagnostics, responses or logs.
  const known = new Set<string>([...STAGED_ACTIONS, ...STORY_ACTIONS, ...PRESENTER_POSES, ...Object.values(CHANNELS).flatMap(Object.keys)]);
  const receivedAction = typeof value !== 'string' ? 'invalid' : known.has(value) ? value : 'unrecognized';
  const expected = field === 'staging' ? normalizeStaging(undefined, scene.text) : undefined;
  const sourceId = scene.sourceId || 'unknown', position = sourceId.match(/^s(\d+)$/)?.[1];
  const requested = receivedAction === 'invalid' ? 'uma ação em formato inválido' : receivedAction === 'unrecognized' ? 'um movimento que o motor não reconhece' : `a ação "${receivedAction}"`;
  const explanation = field === 'story' ? 'O movimento, o objeto ou quem entrega e recebe não correspondem ao roteiro.'
    : expected ? `Esta frase permite "${ACTION_LABELS[expected.action]}".` : 'Esta frase não tem uma encenação desse tipo disponível; a atuação 3D usa seu próprio plano de movimentos.';
  return new DirectorError(502, 'unsupported_action', `${position ? 'Cena ' + position : 'Uma cena'}: a IA pediu ${requested}. ${explanation} A direção foi rejeitada; seu roteiro foi preservado.`,
    { sourceId, field, receivedAction, expectedAction: expected?.action ?? null });
}
export interface DirectorInput { script: string; aspect?: unknown; mode?: unknown; gallery?: unknown; lessons?: string; targetDuration?: unknown; engine?: unknown }
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
    invalid_request: 'O provedor recusou o formato do pedido. Seu roteiro foi preservado.',
    unsupported_model: 'O modelo selecionado não está disponível para geração nesta conta. Confira a configuração.',
    blocked: 'O provedor bloqueou a resposta para este roteiro. Nenhuma direção nova foi aplicada.',
    truncated: 'A direção atingiu o limite de saída antes de terminar. Nenhuma cena incompleta foi aplicada.',
    configuration: 'O provedor de IA configurado não é válido.',
    upstream: 'Não foi possível concluir a direção. O roteiro foi preservado; nenhuma tentativa automática será feita.',
  };
  const status = result.code === 'quota' ? 429 : ['invalid_request', 'invalid_response', 'unsupported_model', 'truncated'].includes(result.code) ? 502 : result.code === 'blocked' ? 422 : 503;
  return new DirectorError(status, result.code, messages[result.code]);
}

/** Shared by the production route and the isolated test site. At most two requests in flight. */
export async function directExplainer(input: DirectorInput, env?: AiEnvironment) {
  validateDirectorInput(input.script);
  let targetDuration: number | undefined;
  try { targetDuration = normalizeTargetDuration(input.targetDuration); }
  catch (error) { throw new DirectorError(400, 'invalid_duration', (error as Error).message); }
  const script = input.script.trim();
  const aspect = input.aspect === '16:9' ? '16:9' : '9:16';
  const baseline = input.engine === '2d' ? undefined : buildFallbackPlan(script, aspect).production;
  const mode = input.mode === 'gallery' ? 'gallery' : 'creative';
  const gallery: { id: string; name: string; drawing: unknown }[] = Array.isArray(input.gallery)
    ? input.gallery.slice(0, 80).filter((g: any) => g && typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.drawing)) : [];
  const lessons = input.lessons || '';
        const modeRule = mode === "creative"
          ? `MODO CRIATIVO: priorize ações encenadas com staging/story quando o roteiro as permitir. Use visual=custom e desenho livre somente para temas sem capacidade de encenação disponível. Mantenha personagens e causalidade. Cada movimento deve demonstrar o verbo da frase. Não use um apresentador parado ou quadro de exposição para substituir a ação.${gallery.length ? ` GALERIA: ${gallery.map((g) => `${g.id}=${g.name}`).join('; ')}.` : ''}`
          : mode === "gallery"
            ? `MODO GALERIA: o usuário tem desenhos salvos. Quando um deles ilustrar bem a cena, responda "gallery": "<id>" e omita drawing. Galeria: ${gallery.map((g) => `${g.id}=${g.name}`).join("; ") || "(vazia)"}. Fora isso, prefira os visuais prontos; use custom só quando nada servir.`
            : "PREFIRA custom sempre que o roteiro citar objetos, lugares, ações ou personagens específicos (fogo, cadeira, bombeiros, casa, animais, pessoas nomeadas). Use os visuais prontos só quando servem exatamente.";
        const direct = (beats: SourceBeat[]) => { const script = beats.map((b) => b.text).join(' '); return askAiResult(`Você é diretor de animações narrativas para redes sociais, nos motores Motion 2D e Toon 3D.
As frases de origem já possuem sourceId fixo. Devolva EXATAMENTE uma direção por sourceId. Preserve a cronologia, o autor da ação, quem recebe a ação, negações e condições. Não agrupe, duplique, omita nem invente IDs. Omita text: o texto narrado vem diretamente do sourceId original. Se incluir text, deve ser literalmente igual à frase desse ID. Todo desenho deve caber inteiro dentro da tela.
${cueRule(script)}
${lessons}
${STAGING_GUIDE}
Contrato de staging por frase (valor null = OMITIR staging; nunca invente talking/laugh/hoist dentro de staging):
${stagingContract(beats)}
Campos opcionais sem ação devem ser omitidos ou null, nunca {}, "none", "idle" ou uma ação inventada. Não confunda presenterPose com staging. Atuação pride/laugh e mecanismos são tracks de production, não ações de staging.
${input.engine === '2d' ? '' : PRODUCTION_GUIDE}
${baseline ? `Base física executável compilada deste roteiro. Reutilize IDs, modelos, posições e contatos; direcione câmera e atuação. Ao mudar movimentos, preserve a viabilidade dos contatos. Envie o objeto production completo, incluindo version, world e estes assets; limite tracks/couplings/shots aos sourceIds deste pedido. Mantenha os assets consistentes no roteiro completo:\n${JSON.stringify({ ...baseline, tracks: baseline.tracks.filter((t) => beats.some((b) => b.sourceId === t.sourceId)), couplings: baseline.couplings.filter((c) => beats.some((b) => b.sourceId === c.at.sourceId)), shots: baseline.shots.filter((s) => beats.some((b) => b.sourceId === s.sourceId)) })}` : ''}
Se usar production, componha APENAS os sourceIds deste pedido. Mantenha os mesmos IDs, modelos, posições iniciais e cores no roteiro completo. Cada frase recebe uma shot. OMITA story/staging nas cenas dirigidas por production. O grafo de produção tem prioridade sobre os visuais ilustrados.
${targetDuration ? `Duração pedida: ${targetDuration} segundos no total. O motor distribuirá esse tempo entre ações e pausas. Não invente falas ou fatos para preencher tempo.` : ''}
Para cada cena escolha o visual que MELHOR ilustra o significado:
- visual: um de [${VISUALS.join(", ")}] (character = personagem com expressão; phone_chat = celular com mensagem digitando (só para conversa/WhatsApp); profile = celular mostrando perfil de rede social com LINK NA BIO e botão seguir; laptop = site sendo montado; map_pins = mapa com pinos; clock = passagem de tempo; scale = comparação/preço; eye = ver/atenção; chips = lista de etiquetas; city_night = cena noturna final/impacto; chart_up = gráfico crescendo; money = dinheiro/lucro; custom = você DESENHA a cena livremente com formas)
${modeRule} Seja criativo e literal: ilustre o que a frase diz.
- ${DRAWING_GUIDE}
- ${SETTING_GUIDE} Sempre preencha "setting" em todas as cenas.
- story (opcional, para ação FÍSICA inequivocamente descrita nesta frase; não é um desenho estático): {"action":"pickup|handoff|chase","prop":"lantern|hat|ball|box|key","actors":[{"name":"nome literal que aparece neste trecho","color":"#FFB447"},{"name":"segundo nome literal","color":"#4AC6BE"}]}. pickup=pegar objeto, handoff=uma pessoa entrega objeto à outra, chase=correr atrás de objeto. Só use se a frase contiver verbo afirmativo explícito, nome(s) literal(is) e o objeto certo (lanterna, chapéu, bola, caixa ou chave). Em handoff, "actors" deve vir na ordem do GIVER e RECEIVER conforme a frase (Lia entregou a Caio => [Lia, Caio]); inclua duas pessoas. Não invente uma entrega se houver "não entregou", "nunca pegou", ordem ambígua ou frase hipotética. Quando houver story, use visual=custom e OMITA drawing; a engine irá animar contato e posse do objeto. Nunca repita story em cenas cujo texto não tenha essa ação.
- Capacidade Toon 3D disponível: story.performance="grounded-v1" SOMENTE para story.action="handoff", prop="lantern", quando a MESMA frase afirma que o primeiro personagem pega a lanterna e entrega ao segundo. Duração mínima: 18s. A sequência executável é caminhar → agachar/alcançar → tocar/pegar → levantar → transportar → oferecer → contato de duas mãos → trocar posse → reação. A engine controla durações, alça e câmera com segurança. Não peça voo, teletransporte, luta, física de água ou ações fora das capacidades acima. Não use essa performance se a pessoa que pega não for a pessoa que entrega. Para demais roteiros, use apenas capacidades disponíveis e desenhos literais.
- presenterPose (opcional): escolha um de [idle, talking, pointing, running, shocked] SOMENTE quando houver ação humana concreta ou reação do apresentador. 'running' para correr/fugir, 'shocked' para se assustar, 'pointing' para mostrar/apontar. Caso contrário omita; não repita gestos genéricos.
- mood: um de [${MOODS.join(", ")}]
- palette: um de [${PALETTES.join(", ")}], varie entre cenas; use night para momentos tristes ou finais
- label: etiqueta curta opcional (ex: "3 MESES DEPOIS...", "DE GRAÇA")
- chat: texto da mensagem quando visual=phone_chat
- chips: até 4 etiquetas curtas para chips/scale
- highlight: palavras do texto para destacar em amarelo
Contexto do roteiro completo (não gere cenas extras a partir dele):
"""${input.script}"""
Frases de origem a dirigir neste pedido:
${beats.map((b) => `${b.sourceId}: ${JSON.stringify(b.text)}`).join('\n')}
Formato de exemplo sem ação física: {"title":"Título curto","scenes":[{"sourceId":"${beats[0]!.sourceId}","visual":"character","mood":"neutral","palette":"teal","staging":null,"story":null}]}. Inclua EXATAMENTE uma cena para CADA sourceId listado, em ordem. Preencha os demais campos somente quando forem usados; production é opcional e, quando usado, deve ser completo.`, undefined, env, { schema: directionSchema(beats) }); };
  const parts = beatChunks(sourceBeats(script));
  const plans: ExplainerPlan[] = new Array(parts.length);
  const productions: unknown[] = new Array(parts.length);
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
      const grounded = groundScenes(raw.scenes, parts[i]!);
      if (!grounded) { failure ??= new DirectorError(502, 'source_mismatch', 'A IA alterou ou misturou as falas. A direção foi rejeitada; seu roteiro foi preservado.'); return; }
      for (const scene of grounded) if (raw.production != null) { delete scene.story; delete scene.staging; }
      for (const scene of grounded) if (scene.story != null) {
        const story = normalizeStory(scene.story, scene.text);
        if (!story || (scene.story.performance != null && story.performance !== scene.story.performance)) {
          failure ??= actionError(scene, 'story'); return;
        }
      }
      const invalidStaging = grounded.find((scene) => scene.staging != null && !normalizeStaging(scene.staging, scene.text));
      if (invalidStaging) {
        failure ??= actionError(invalidStaging, 'staging'); return;
      }
      productions[i] = raw.production;
      plans[i] = normalizePlan({ ...raw, production: undefined, scenes: grounded }, parts[i]!.map((b) => b.text).join(' '), aspect);
      provider = result.provider; model = result.model;
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, parts.length) }, worker));
  if (failure) throw failure;
  let plan: ExplainerPlan;
  try { plan = normalizePlan({ title: plans[0]!.title, scenes: plans.flatMap((p) => p.scenes), production: mergeProduction(productions) }, script, aspect); }
  catch (error) { if (error instanceof ProductionError) throw new DirectorError(502, error.code, error.message); throw error; }
  if (spokenText(plan.scenes.map((s) => s.text).join(' ')) !== spokenText(script)) {
    throw new DirectorError(502, 'script_mismatch', 'A direção não preservou o roteiro completo. Nenhum vídeo foi substituído.');
  }
  return { plan: withTargetDuration(plan, targetDuration), source: 'ai' as const, provider, model };
}
