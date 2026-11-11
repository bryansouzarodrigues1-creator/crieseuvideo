// Explainer plan: the "score" the AI writes. Rendering is pure code, so no video credits are spent.
export const VISUALS = ['character', 'phone_chat', 'laptop', 'map_pins', 'clock', 'scale', 'eye', 'chips', 'city_night'] as const;
export const MOODS = ['happy', 'neutral', 'sad', 'worried', 'angry'] as const;
export const PALETTES = ['orange', 'purple', 'teal', 'pink', 'night'] as const;
export type Visual = (typeof VISUALS)[number];
export type Mood = (typeof MOODS)[number];
export type Palette = (typeof PALETTES)[number];

export interface ExplainerScene {
  text: string;
  visual: Visual;
  mood: Mood;
  palette: Palette;
  label?: string;
  chat?: string;
  chips?: string[];
  highlight?: string[];
}
export interface ExplainerPlan { title: string; aspect: '9:16' | '16:9'; scenes: ExplainerScene[] }

export const SECONDS_PER_WORD = 0.36;
export const SCENE_LEAD = 0.3;
export const MIN_SCENE = 2.4;

export const words = (text: string) => text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
export const sceneDuration = (s: ExplainerScene) => Math.max(MIN_SCENE, SCENE_LEAD + words(s.text).length * SECONDS_PER_WORD + 0.5);
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
  const list = words(scene.text);
  if (!list.length) return null;
  const i = Math.min(list.length - 1, Math.max(0, Math.floor((local - SCENE_LEAD) / SECONDS_PER_WORD)));
  return { index: i, word: list[i], since: local - SCENE_LEAD - i * SECONDS_PER_WORD };
}

const has = (s: string, re: RegExp) => re.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

export function pickVisual(sentence: string): Visual {
  if (has(sentence, /whats|mensage|celular|telefone|conversa|chamou/)) return 'phone_chat';
  if (has(sentence, /noite|cidade|predio|rua/)) return 'city_night';
  if (has(sentence, /mapa|bairro|empresa|loja|endereco|google/)) return 'map_pins';
  if (has(sentence, /site|computador|notebook|internet|pagina|app/)) return 'laptop';
  if (has(sentence, /tempo|depois|meses|dias|horas|semana|minuto/)) return 'clock';
  if (has(sentence, /preco|r\$|custa|vale|plano|pagar|dinheiro|real/)) return 'scale';
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

export function buildFallbackPlan(script: string, aspect: '9:16' | '16:9' = '9:16'): ExplainerPlan {
  const sentences = script.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const list = sentences.length ? sentences : ['Escreva seu roteiro para começar.'];
  const scenes = list.map((text, i): ExplainerScene => {
    const visual = pickVisual(text);
    const mood = pickMood(text);
    const num = text.match(/\d+\s+[\p{L}]+/u)?.[0];
    const longest = [...words(text)].sort((a, b) => b.length - a.length)[0]?.replace(/[^\p{L}\d]/gu, '');
    return {
      text, visual, mood,
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
    return {
      text,
      visual: pick(s.visual, VISUALS, pickVisual(text)),
      mood: pick(s.mood, MOODS, pickMood(text)),
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
