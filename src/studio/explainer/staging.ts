/** Executable narrative vocabulary shared by local rehearsal and AI direction. */
export const STAGED_ACTIONS = ['phone', 'heartbeat', 'walk', 'run', 'work', 'growth', 'money_flow', 'question', 'wait', 'time'] as const;
export type StagedAction = typeof STAGED_ACTIONS[number];
export interface NarrativeStaging {
  action: StagedAction;
  actor: { id: string; name: string; color: string };
  friends: number;
  metaphor: boolean;
  camera: 'follow' | 'detail' | 'wide';
}
export const ACTION_LABELS: Record<StagedAction, string> = {
  phone: 'Receber e ler no celular', heartbeat: 'Reagir com o coração disparado', walk: 'Caminhar', run: 'Correr',
  work: 'Trabalhar no computador', growth: 'Gráfico em crescimento', money_flow: 'Dinheiro e documentos em circulação',
  question: 'Perceber e questionar', wait: 'Esperar sem se deslocar', time: 'Passagem do tempo',
};
const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const notNames = /^(ele|ela|eles|elas|eu|voce|nos|o|a|os|as|um|uma|no|na|nos|nas|se|depois|entao|agora|hoje|ontem|quando|esse|essa|isso|aquele|aquela|mas|seu|sua|tres)$/;

/** Literal verbs are selected before scenery nouns: "correu pela rua" is running,
 * never just a skyline. Abstract topics explicitly use object metaphors. */
export function inferStaging(text: string): NarrativeStaging | undefined {
  const t = clean(text);
  if (/\b(nao|nunca|jamais)\b.{0,35}(corrupcao|propina|lavagem de dinheiro|desvio)/.test(t)) return;
  if (/\b(leao|leoa|gato|cachorro|cavalo|animal|passaro|peixe)\b/.test(t)) return;
  const deniedMotion = /\b(nao|nunca|jamais|sem)\b(?:\s+\S+){0,4}\s+\b(corr\w*|caminh\w*|andou|fug\w*)\b/.test(t);
  if (!deniedMotion && /\b(nao|nunca|jamais)\b(?:\s+\S+){0,4}\s+(receb\w*|leu|digit\w*|abri\w*|criou|dispar\w*|subi\w*|cresc\w*)\b/.test(t)) return;
  if (/\bse\b(?:\s+\S+){0,4}\s+(corr\w*|caminh\w*|receb\w*|digit\w*)\b/.test(t)) return;
  let action: StagedAction | undefined;
  if (deniedMotion || /\b(parad[oa]|esperou|aguardou|ficou imovel)\b/.test(t)) action = 'wait';
  else if (/coracao|palpit|peito dispar/.test(t)) action = 'heartbeat';
  else if (/\b(corr(?:e|eu|er|endo|ia|iam|eram)|fugiu|fugindo)\b/.test(t)) action = 'run';
  else if (/\b(caminh(?:a|ou|ando|ar|ava)|andou|andando)\b/.test(t)) action = 'walk';
  else if (/corrupcao|propina|lavagem de dinheiro|desvio de (dinheiro|verba)|esquema de corrup/.test(t)) action = 'money_flow';
  else if (/\b(grafico|vendas|resultado)\b/.test(t) && /subi|cresc|aument|dispar|dobr/.test(t)) action = 'growth';
  else if (/celular|telefone|mensage|notific|whatsapp/.test(t) && /receb|\bleu\b|\bler\b|olhou|\bviu\b|mand|envi|digit|respond|abriu|chegou/.test(t)) action = 'phone';
  else if (/computador|notebook|laptop|\bsite\b/.test(t) && /digit|program|escrev|criou|montou|abriu|trabalh|mostrou/.test(t)) action = 'work';
  else if (/pergunt|duvida|e agora|pensou|percebeu|surpres|assust/.test(t)) action = 'question';
  else if (/\b(horas|meses|dias|semanas|tempo passou|relogio)\b/.test(t)) action = 'time';
  if (!action) return;
  const first = text.trim().match(/^([A-ZÀ-Ý][\p{L}'-]{1,23})\b/u)?.[1];
  const name = first && !notNames.test(clean(first)) ? first : 'Personagem';
  const id = name === 'Personagem' ? 'lead' : clean(name);
  let hash = 0; for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const colors = ['#E7A345', '#55B7AD', '#CC7596', '#7999D1'];
  return {
    action, actor: { id, name, color: colors[hash % colors.length] },
    friends: action === 'run' || action === 'walk' ? (/\bamigos\b/.test(t) ? 2 : /\bamig[oa]\b/.test(t) ? 1 : 0) : 0,
    metaphor: ['money_flow', 'growth', 'heartbeat', 'time'].includes(action),
    camera: action === 'run' || action === 'walk' ? 'follow' : action === 'money_flow' || action === 'growth' ? 'wide' : 'detail',
  };
}

export function normalizeStaging(raw: unknown, text: string): NarrativeStaging | undefined {
  const literal = inferStaging(text);
  if (raw === undefined || raw === null) return literal;
  if (!literal || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const r = raw as Record<string, unknown>;
  if (r.action !== literal.action) return;
  // Camera choices may vary; actors, action and prop semantics belong to the source.
  return { ...literal, camera: ['follow', 'detail', 'wide'].includes(String(r.camera)) ? r.camera as NarrativeStaging['camera'] : literal.camera };
}

export const STAGING_GUIDE = `Encenação reutilizável: staging={"action":"${STAGED_ACTIONS.join('|')}","camera":"follow|detail|wide"}.
Use phone para ler/receber mensagens, heartbeat para coração disparado, walk/run para deslocamento real, work para computador/site,
growth para gráfico crescendo, money_flow para metáfora visual de corrupção/propina (dinheiro/documentos sem acusar pessoas inventadas),
question para dúvida/reação, wait para esperar ou NÃO correr, time para passagem do tempo. Escolha somente a ação afirmada nesta frase.
Não substitua correr por imagem de rua nem receber mensagem por apresentador apontando para um quadro. O motor executa corpos, mãos,
objetos e câmera. Não invente participantes, crimes específicos, falas ou acontecimentos. Desenhos livres ficam para temas sem ação suportada.`;
