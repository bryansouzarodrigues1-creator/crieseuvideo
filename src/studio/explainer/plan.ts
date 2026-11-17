import { normalizeDrawing, type Shape } from './drawing';
import { SETTINGS, type Setting } from './settings';
// Explainer plan: the "score" the AI writes. Rendering is pure code, so no video credits are spent.
export const VISUALS = ['character', 'phone_chat', 'profile', 'laptop', 'map_pins', 'clock', 'scale', 'eye', 'chips', 'city_night', 'chart_up', 'money', 'custom'] as const;
export const MOODS = ['happy', 'neutral', 'sad', 'worried', 'angry'] as const;
/** Gestures the existing 3D rig can perform; omit to retain automatic host behavior. */
export const PRESENTER_POSES = ['idle', 'talking', 'pointing', 'running', 'shocked'] as const;
export const PALETTES = ['orange', 'purple', 'teal', 'pink', 'night'] as const;
export type Visual = (typeof VISUALS)[number];
export type Mood = (typeof MOODS)[number];
export type PresenterPose = (typeof PRESENTER_POSES)[number];
export type Palette = (typeof PALETTES)[number];

export interface ExplainerScene {
  text: string;
  visual: Visual;
  mood: Mood;
  /** Optional meaning-driven gesture for the 3D presenter; no new 3D assets required. */
  presenterPose?: PresenterPose;
  palette: Palette;
  label?: string;
  chat?: string;
  chips?: string[];
  highlight?: string[];
  /** AI-written free drawing used when visual is 'custom'. */
  drawing?: Shape[];
  /** Animated full-screen scenario behind the scene. */
  setting?: Setting;
  /** Measured narration clip: total length plus where speech starts/ends inside it (seconds). */
  voice?: { duration: number; start: number; end: number };
}
export interface ExplainerPlan { title: string; aspect: '9:16' | '16:9'; scenes: ExplainerScene[]; /** Length of an uploaded narration that drives the whole timeline. */ track?: number; /** Rendering engine chosen for this project. */ engine?: '2d' | '3d' }

/** Fit scenes to one uploaded narration: each scene gets a share of the track proportional to its spoken weight. */
export function fitToTrack(plan: ExplainerPlan, track: number): ExplainerPlan {
  const weights = plan.scenes.map((s) => words(s.text).reduce((a, w) => a + wordWeight(w), 0) || 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  return { ...plan, track, scenes: plan.scenes.map((s, i) => {
    const d = Math.max(0.4, (weights[i] / sum) * track - SCENE_LEAD - VOICE_TAIL);
    return { ...s, voice: { duration: d, start: 0, end: d } };
  }) };
}

export const SECONDS_PER_WORD = 0.36;
export const SCENE_LEAD = 0.3;
export const MIN_SCENE = 2.4;

export const words = (text: string) => text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
export const VOICE_TAIL = 0.35;
export const sceneDuration = (s: ExplainerScene) =>
  s.voice ? Math.max(1.6, SCENE_LEAD + s.voice.duration + VOICE_TAIL) : Math.max(MIN_SCENE, SCENE_LEAD + words(s.text).length * SECONDS_PER_WORD + 0.5);
export const sceneStart = (p: ExplainerPlan, i: number) => p.scenes.slice(0, i).reduce((a, s) => a + sceneDuration(s), 0);

/** Spoken weight of a word: longer words and punctuation pauses take more time. */
export const wordWeight = (w: string) => w.replace(/[^\p{L}\d]/gu, '').length + 2 + (/[,;:]$/.test(w) ? 3 : /[.!?…]$/.test(w) ? 5 : 0);
export function wordTimings(scene: ExplainerScene) {
  const list = words(scene.text);
  const from = SCENE_LEAD + (scene.voice ? scene.voice.start : 0);
  const span = scene.voice ? Math.max(0.2, scene.voice.end - scene.voice.start) : list.length * SECONDS_PER_WORD;
  const total = list.reduce((a, w) => a + wordWeight(w), 0) || 1;
  let acc = 0;
  return list.map((word) => { const start = from + (acc / total) * span; acc += wordWeight(word); return { word, start, end: from + (acc / total) * span }; });
}
export const totalDuration = (p: ExplainerPlan) => p.scenes.reduce((a, s) => a + sceneDuration(s), 0);

export function sceneAt(p: ExplainerPlan, t: number) {
  let start = 0;
  for (let i = 0; i < p.scenes.length; i++) {
    const d = sceneDuration(p.scenes[i]);
    if (t < start + d || i === p.scenes.length - 1) return { index: i, scene: p.scenes[i], local: Math.max(0, t - start), duration: d };
    start += d;
  }
  return null;
}

export function wordAt(scene: ExplainerScene, local: number) {
  const list = wordTimings(scene);
  if (!list.length) return null;
  let i = 0;
  while (i < list.length - 1 && local >= list[i + 1].start) i++;
  return { index: i, word: list[i].word, since: local - list[i].start, speaking: local >= list[i].start && local < list[i].end };
}

const has = (s: string, re: RegExp) => re.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

export function pickVisual(sentence: string): Visual {
  if (has(sentence, /\bbio\b|perfil|seguidor|siga|instagram|tiktok/)) return 'profile';
  if (has(sentence, /whats|mensage|celular|telefone|conversa|chamou/)) return 'phone_chat';
  if (has(sentence, /noite|cidade|predio|rua/)) return 'city_night';
  if (has(sentence, /mapa|bairro|empresa|loja|endereco|google/)) return 'map_pins';
  if (has(sentence, /site|computador|notebook|internet|pagina|app/)) return 'laptop';
  if (has(sentence, /tempo|depois|meses|dias|horas|semana|minuto/)) return 'clock';
  if (has(sentence, /cresc|aument|subiu|resultado|mais vendas|dobro/)) return 'chart_up';
  if (has(sentence, /dinheiro|lucro|fatur|ganhou|ganhar|rico|reais/)) return 'money';
  if (has(sentence, /preco|r\$|custa|vale|plano|pagar/)) return 'scale';
  if (has(sentence, /\bver\b|olha|veem|enxerg|mostra/)) return 'eye';
  return 'character';
}
export function pickMood(sentence: string): Mood {
  if (has(sentence, /raiva|odeio|furioso|irritad/)) return 'angry';
  if (has(sentence, /triste|ninguem|nunca|perdeu|fracass|sozinho/)) return 'sad';
  if (has(sentence, /medo|problema|sera|duvida|preocup/)) return 'worried';
  if (has(sentence, /feliz|otimo|consegui|vend|ganh|sucesso|pronto/)) return 'happy';
  return 'neutral';
}

/** A conservative zero-AI fallback: only direct human gestures, never guess elaborate action choreography. */
export function pickPresenterPose(text: string): PresenterPose | undefined {
  if (has(text, /\bcorr(?:e|eu|er|endo|ia|iam|eram)\b|\bfug(?:iu|ir|indo)\b|persegui|perseguindo|disparou/)) return 'running';
  if (has(text, /assust|espant|levou um susto|apavor|aterror|surpres/)) return 'shocked';
  if (has(text, /apont|indicou|indicando|mostr(?:ou|ando|ar)|sinaliz/)) return 'pointing';
  return undefined;
}

export function buildFallbackPlan(script: string, aspect: '9:16' | '16:9' = '9:16'): ExplainerPlan {
  const sentences = script.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const list = sentences.length ? sentences : ['Escreva seu roteiro para começar.'];
  const scenes = list.map((text, i): ExplainerScene => {
    const visual = pickVisual(text);
    const mood = pickMood(text);
    const num = text.match(/\d+\s+[\p{L}]+/u)?.[0];
    const longest = [...words(text)].sort((a, b) => b.length - a.length)[0]?.replace(/[^\p{L}\d]/gu, '');
    return {
      text, visual, mood, presenterPose: pickPresenterPose(text),
      palette: visual === 'city_night' || mood === 'sad' ? 'night' : PALETTES[i % 4],
      label: num ? `${num.toUpperCase()}…` : undefined,
      chat: visual === 'phone_chat' ? text : undefined,
      highlight: longest ? [longest] : [],
    };
  });
  return { title: list[0].slice(0, 60), aspect, scenes };
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

export function normalizePlan(raw: any, script: string, aspect: '9:16' | '16:9'): ExplainerPlan {
  const fb = buildFallbackPlan(script, aspect);
  const arr = Array.isArray(raw?.scenes) ? raw.scenes : [];
  const scenes = arr.slice(0, 40).map((s: any, i: number): ExplainerScene | null => {
    const text = str(s?.text, 400);
    if (!text) return null;
    const drawing = normalizeDrawing(s?.drawing);
    let visual = pick(s.visual, VISUALS, pickVisual(text));
    if (visual === 'custom' && !drawing) visual = pickVisual(text);
    return {
      text,
      visual,
      drawing: visual === 'custom' ? drawing : undefined,
      setting: (SETTINGS as readonly string[]).includes(s.setting) ? s.setting : pickSetting(text),
      mood: pick(s.mood, MOODS, pickMood(text)),
      presenterPose: (PRESENTER_POSES as readonly string[]).includes(s.presenterPose) ? (s.presenterPose as PresenterPose) : pickPresenterPose(text),
      palette: pick(s.palette, PALETTES, PALETTES[i % 4]),
      label: str(s.label, 28),
      chat: str(s.chat, 120),
      chips: Array.isArray(s.chips) ? s.chips.map((c: unknown) => str(c, 22)).filter(Boolean).slice(0, 4) : undefined,
      highlight: Array.isArray(s.highlight) ? s.highlight.map((c: unknown) => str(c, 30)).filter(Boolean).slice(0, 5) : [],
    };
  }).filter(Boolean) as ExplainerScene[];
  if (!scenes.length) return fb;
  return { title: str(raw?.title, 80) || fb.title, aspect, scenes };
}

const SETTING_WORDS: [Setting, RegExp][] = [
  ['road', /estrada|rodovia|carro|dirig|viagem|caminh[aã]o|moto/], ['beach', /praia|mar\b|oceano|areia|onda/],
  ['space', /espa[cç]o|planeta|foguete|gal[aá]xia|astronauta/], ['rain', /chuva|tempestade|chove/],
  ['night', /noite|estrela|lua|dormir|sonho/], ['sunset', /p[oô]r do sol|entardecer|fim de tarde/],
  ['forest', /floresta|mata|[aá]rvore|natureza|bosque/], ['office', /escrit[oó]rio|empresa|reuni[aã]o|trabalho|chefe/],
  ['room', /\bcasa\b|quarto|sala|cozinha|fam[ií]lia/], ['city_day', /cidade|rua|pr[eé]dio|bairro|loja/],
];
/** Picks an animated scenario from the sentence when the AI didn't name a valid one. */
export function pickSetting(text: string): Setting | undefined {
  const t = text.toLowerCase();
  return SETTING_WORDS.find(([, re]) => re.test(t))?.[0];
}

/**
 * The AI only chooses visuals and where to cut; the spoken text is rebuilt from the user's own words, in order,
 * so scenes can never add, repeat or drop words of the script.
 */
export function keepScriptWords<T extends { text?: unknown }>(scenes: T[], script: string): (T & { text: string })[] {
  const source = script.match(/\S+/g) ?? [];
  const list = scenes.slice(0, Math.min(40, source.length));
  const weights = list.map((sc) => Math.max(1, String(sc?.text ?? '').trim().split(/\s+/).filter(Boolean).length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return list.map((sc, i) => {
    const left = list.length - i - 1;
    const want = i === list.length - 1 ? source.length - cursor : Math.max(1, Math.round((source.length * weights[i]!) / total));
    const take = Math.min(source.length - cursor - left, want);
    const text = source.slice(cursor, cursor + take).join(' ');
    cursor += take;
    return { ...sc, text };
  });
}
