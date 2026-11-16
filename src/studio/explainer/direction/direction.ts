// Direção de cena: o contrato entre o Gemini e o motor 3D.
// A IA nunca escreve texto aqui (as palavras do roteiro continuam intocadas); só escolhe itens do catálogo.
// Tudo que vier inválido é trocado por um padrão seguro, e pedidos que o motor ainda não executa vão para `unsupported`.
import {
  ACTION_IDS, CAMERA_MOVE_IDS, ENTRANCE_IDS, ENVIRONMENT_IDS, EXPRESSION_IDS, OUTFIT_IDS, PLACEMENTS, PROP_IDS, SHOT_IDS,
  type Action, type CameraMove, type Entrance, type Environment, type Expression, type Outfit, type Placement, type Prop, type Shot,
} from './catalog';

export interface Direction {
  environment: Environment;
  outfit: Outfit;
  action: Action;
  entrance: Entrance;
  expression: Expression;
  placement: Placement;
  props: Prop[];
  cameraMove: CameraMove;
  shot: Shot;
  /** 0 = câmera quase parada, 1 = movimento completo. */
  intensity: number;
  /** true: mostra o quadro de ilustração ao lado do personagem; false: cena "de mundo" (personagem + cenário). */
  board: boolean;
  /** Coisas pedidas pelo roteiro que o motor ainda não sabe fazer (aparecem na interface, nunca são simuladas). */
  unsupported: string[];
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const has = (s: string, re: RegExp) => re.test(norm(s));

export const DEFAULT_DIRECTION: Direction = {
  environment: 'office', outfit: 'default', action: 'talk', entrance: 'none', expression: 'neutral', placement: 'center',
  props: [], cameraMove: 'push_in', shot: 'medium', intensity: 0.6, board: true, unsupported: [],
};

/** Direção determinística a partir das palavras da cena: custo zero e sempre disponível (também é o plano B quando a IA falha). */
export function fallbackDirection(text: string): Direction {
  const d: Direction = { ...DEFAULT_DIRECTION, props: [], unsupported: [] };
  const env: [Environment, RegExp][] = [
    ['summit', /montanha|\bmonte\b|everest|escal|cume|\btopo\b|alpin/],
    ['beach', /praia|\bmar\b|oceano|areia/], ['space', /espaco|planeta|foguete|galaxia|astronauta/], ['rain', /chuva|tempestade/],
    ['night', /noite|estrela|\blua\b|dormir|sonho/], ['sunset', /por do sol|entardecer|fim de tarde/],
    ['forest', /floresta|\bmata\b|arvore|natureza/], ['road', /estrada|rodovia|carro|dirig|viagem|moto/],
    ['office', /escritorio|empresa|reuniao|trabalho|chefe/], ['room', /\bcasa\b|quarto|\bsala\b|cozinha|familia/],
    ['city_day', /cidade|\brua\b|predio|bairro|\bloja\b/],
  ];
  const hit = env.find(([, re]) => has(text, re));
  if (hit) d.environment = hit[0];
  if (d.environment === 'summit') {
    Object.assign(d, { outfit: 'yellow_jacket', entrance: 'rise_from_below', cameraMove: 'push_in', board: false, props: ['flag'], intensity: 0.7 });
  } else if (hit && hit[0] !== 'office') {
    d.board = false;
  }
  if (has(text, /\bcorr(e|er|endo|eu)\b|fugi|disparou/)) d.action = 'run';
  else if (has(text, /celular|whats|mensagem|telefone/)) d.action = 'hold_phone';
  else if (has(text, /dinheiro|lucro|reais|moeda|faturou/)) d.action = 'hold_coins';
  else if (has(text, /susto|chocad|inacredit|surpres|\bmas\.\.\.|\bmas…/)) d.action = 'shocked';
  if (has(text, /raiva|odeio|furioso|irritad/)) d.expression = 'angry';
  else if (has(text, /triste|ninguem|nunca|perdeu|fracass|sozinho|medo|problema|preocup/)) d.expression = 'confused';
  else if (has(text, /feliz|otimo|consegui|ganh|sucesso|pronto|venceu/)) d.expression = 'happy';
  return d;
}

export interface NormalizedDirection { direction: Direction; /** Campos que vieram inválidos e foram trocados por um padrão. */ repaired: string[] }

/** Valida a resposta da IA. Nunca lança: o que for inválido cai no padrão derivado do próprio texto da cena. */
export function normalizeDirection(raw: unknown, text: string): NormalizedDirection {
  const base = fallbackDirection(text);
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const repaired: string[] = [];
  const choose = <T extends string>(key: string, allowed: readonly T[], fb: T): T => {
    if (r[key] === undefined) return fb;
    if (allowed.includes(r[key] as T)) return r[key] as T;
    repaired.push(key);
    return fb;
  };
  const props = Array.isArray(r.props) ? [...new Set((r.props as unknown[]).filter((p): p is Prop => PROP_IDS.includes(p as Prop)))].slice(0, 3) : base.props;
  if (Array.isArray(r.props) && (r.props as unknown[]).some((p) => !PROP_IDS.includes(p as Prop))) repaired.push('props');
  const rawIntensity = typeof r.intensity === 'number' ? r.intensity : Number(r.intensity);
  const intensity = Number.isFinite(rawIntensity) ? Math.min(1, Math.max(0, rawIntensity)) : base.intensity;
  if (r.intensity !== undefined && !Number.isFinite(rawIntensity)) repaired.push('intensity');
  const environment = choose('environment', ENVIRONMENT_IDS, base.environment);
  const direction: Direction = {
    environment,
    outfit: choose('outfit', OUTFIT_IDS, base.outfit),
    action: choose('action', ACTION_IDS, base.action),
    entrance: choose('entrance', ENTRANCE_IDS, base.entrance),
    expression: choose('expression', EXPRESSION_IDS, base.expression),
    placement: choose('placement', PLACEMENTS, base.placement),
    props,
    cameraMove: choose('cameraMove', CAMERA_MOVE_IDS, base.cameraMove),
    shot: choose('shot', SHOT_IDS, base.shot),
    intensity,
    board: typeof r.board === 'boolean' ? r.board : environment === 'summit' ? false : base.board,
    unsupported: Array.isArray(r.unsupported) ? (r.unsupported as unknown[]).filter((u): u is string => typeof u === 'string' && !!u.trim()).map((u) => u.trim().slice(0, 80)).slice(0, 5) : [],
  };
  // "Apontar para o quadro" só faz sentido com quadro visível.
  if (direction.action === 'point_at_board' && !direction.board) direction.action = 'talk';
  return { direction, repaired };
}

const ROTATION: CameraMove[] = ['push_in', 'orbit_left', 'pull_out', 'orbit_right', 'crane_up', 'pan_right', 'crane_down', 'pan_left'];
/** Evita repetir o mesmo movimento+plano em cenas seguidas (regra de alternância do plano de animação fluida). */
export function varyShots(list: Direction[]): Direction[] {
  const out: Direction[] = [];
  for (const d of list) {
    const prev = out[out.length - 1];
    if (prev && prev.cameraMove === d.cameraMove && prev.shot === d.shot && d.cameraMove !== 'static') {
      const next = ROTATION[(ROTATION.indexOf(d.cameraMove) + 1) % ROTATION.length] ?? 'push_in';
      out.push({ ...d, cameraMove: next, shot: d.shot === 'medium' ? 'wide' : 'medium' });
    } else out.push(d);
  }
  return out;
}

/** Garante uma direção em cada cena sem gastar IA (ex.: usuário troca de Motion 2D para 3D Toon depois de gerar). */
export function ensureDirections<T extends { text: string; direction?: Direction }>(scenes: T[]): T[] {
  const filled = scenes.map((s) => s.direction ?? fallbackDirection(s.text));
  const varied = varyShots(filled);
  return scenes.map((s, i) => ({ ...s, direction: s.direction ? s.direction : varied[i]! }));
}

/**
 * Junta a resposta da IA (lista de { index, ... }) com as cenas: cada cena é validada; sem resposta válida, usa o padrão do texto.
 * Devolve também quantas cenas vieram da IA, para a interface dizer a verdade sobre a origem.
 */
export function mergeDirections(texts: string[], parsed: unknown): { directions: Direction[]; fromAi: number; repaired: number } {
  const items = parsed && typeof parsed === 'object' && Array.isArray((parsed as { directions?: unknown }).directions) ? ((parsed as { directions: unknown[] }).directions) : [];
  const byIndex = new Map<number, unknown>();
  for (const it of items) {
    const i = it && typeof it === 'object' ? Number((it as { index?: unknown }).index) : NaN;
    if (Number.isInteger(i) && i >= 0 && i < texts.length && !byIndex.has(i)) byIndex.set(i, it);
  }
  let repaired = 0;
  const directions = texts.map((text, i) => {
    const raw = byIndex.get(i);
    const n = normalizeDirection(raw, text);
    if (raw) repaired += n.repaired.length;
    return n.direction;
  });
  return { directions: varyShots(directions), fromAi: byIndex.size, repaired };
}
