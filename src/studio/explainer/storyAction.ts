/**
 * Limited, deterministic two-person story actions.
 * This is choreography, not generative video: the same scene/time always
 * produces the same character positions, object ownership and hand contact.
 */
export const STORY_ACTIONS = ['pickup', 'handoff', 'chase'] as const;
export const STORY_PROPS = ['lantern', 'hat', 'ball', 'box', 'key'] as const;
export type StoryAction = (typeof STORY_ACTIONS)[number];
export type StoryProp = (typeof STORY_PROPS)[number];

export interface StoryActor { name: string; color: string }
export interface StoryScene {
  action: StoryAction;
  prop: StoryProp;
  actors: StoryActor[];
  /** Whether the source explicitly says the giver picks up the object first. */
  pickupFirst: boolean;
}

const PROP_WORDS: Record<StoryProp, RegExp> = {
  lantern: /\blanterna\b/,
  hat: /\bchapeu\b/,
  ball: /\bbola\b/,
  box: /\bcaixa\b/,
  key: /\bchave\b/,
};
const VERBS: Record<StoryAction, RegExp> = {
  pickup: /\b(peg\w*|apanh\w*|recolh\w*|levant\w*|ergue\w*|agarrou)\b/,
  handoff: /\b(entreg\w*|passou|deu|transfer\w*)\b/,
  chase: /\b(persegu\w*|corr\w*|fug\w*)\b/,
};
const clean = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const defaults = ['#FFB447', '#4AC6BE'];
const easing = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
const between = (value: number, start: number, end: number) => easing((value - start) / (end - start));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Reject unsupported, hallucinated, negated or reversed actions before rendering.
 * Restrictive by design: unsupported scripts still use the existing illustration.
 */
export function normalizeStory(raw: unknown, sourceText: string): StoryScene | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof sourceText !== 'string') return;
  const input = raw as Record<string, unknown>;
  if (!STORY_ACTIONS.includes(input.action as StoryAction) ||
      !STORY_PROPS.includes(input.prop as StoryProp)) return;
  const action = input.action as StoryAction, prop = input.prop as StoryProp;
  const source = clean(sourceText);
  const verb = source.match(VERBS[action]);
  if (!verb || !PROP_WORDS[prop].test(source)) return;

  // If the script denies the action, don't draw it as if it happened.
  // This is conservative for short scene snippets; the director should not
  // combine a negated action with a later affirmative one in one story beat.
  if (/\b(nao|nunca|jamais|sem)\b(?:\s+\S+){0,5}\s+(?:entreg\w*|peg\w*|apanh\w*|persegu\w*|corr\w*|fug\w*|passou|deu|transfer\w*)\b/.test(source)) return;

  const persons = Array.isArray(input.actors) ? input.actors.slice(0, 2) : [];
  const expected = action === 'handoff' ? 2 : 1;
  if (persons.length < expected) return;
  const actors: StoryActor[] = [];
  for (let i = 0; i < expected; i++) {
    const item = persons[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const actor = item as Record<string, unknown>;
    const name = typeof actor.name === 'string' ? actor.name.trim().slice(0, 24) : '';
    // Names must come from the spoken text; the AI must not invent participants.
    if (!name || !source.includes(clean(name))) return;
    const color = typeof actor.color === 'string' && /^#[0-9a-f]{6}$/i.test(actor.color)
      ? actor.color : defaults[i]!;
    actors.push({ name, color });
  }
  if (action === 'handoff') {
    if (clean(actors[0]!.name) === clean(actors[1]!.name)) return;
    const handoff = source.match(VERBS.handoff)!;
    const before = source.slice(0, handoff.index), after = source.slice(handoff.index! + handoff[0].length);
    // Only animate explicit "giver ... handed ... receiver" phrasing.
    // Ambiguous reversed phrasing falls back to a static illustration.
    if (!before.includes(clean(actors[0]!.name)) || !after.includes(clean(actors[1]!.name))) return;
  }
  return {
    action, prop, actors,
    pickupFirst: action === 'pickup' || (action === 'handoff' && VERBS.pickup.test(source)),
  };
}

export interface StoryActorFrame {
  x: number;
  moving: boolean;
  /** The hand touching the prop (world drawing coordinates). */
  reach?: { side: 'left' | 'right'; x: number; y: number };
}
export interface StoryFrame {
  actors: StoryActorFrame[];
  prop: { x: number; y: number; rotation: number; owner: 0 | 1 | null };
  touching: boolean[];
}

/** Pixel-independent coordinates in the existing explainer hero zone. */
export function storyFrame(story: StoryScene, local: number, duration: number): StoryFrame {
  const p = Math.max(0, Math.min(1, Number.isFinite(local) && Number.isFinite(duration) && duration > 0 ? local / duration : 0));
  if (story.action === 'chase') {
    const step = between(p, 0.05, 0.90);
    const propX = lerp(-225, 325, between(p, 0, 1));
    return {
      actors: [{ x: lerp(-295, 175, step), moving: p > 0.05 && p < 0.9 }],
      prop: { x: propX, y: -135 + Math.sin(p * Math.PI * 2) * 45, rotation: p * Math.PI * 2.5, owner: null },
      touching: [false],
    };
  }
  if (story.action === 'pickup') {
    const approach = between(p, 0.05, 0.35), raise = between(p, 0.32, 0.74);
    const x = lerp(-225, -145, approach), propX = lerp(-95, x + 75, raise);
    const propY = lerp(200, -12, raise);
    return {
      actors: [{ x, moving: p > 0.05 && p < 0.35, reach: p > 0.24 ? { side: 'right', x: propX, y: propY } : undefined }],
      prop: { x: propX, y: propY, rotation: 0, owner: p >= 0.74 ? 0 : null },
      touching: [p >= 0.32],
    };
  }

  const enter = between(p, 0.26, 0.50), leave = between(p, 0.64, 0.92);
  const x0 = lerp(lerp(-225, -125, enter), -205, leave);
  const x1 = lerp(lerp(225, 125, enter), 205, leave);
  const lifted = between(p, 0.05, 0.25);
  let x = story.pickupFirst ? lerp(-175, -100, lifted) : -100;
  let y = story.pickupFirst ? lerp(190, -12, lifted) : -12;
  x = lerp(x, 0, enter);
  x = lerp(x, 80, leave);
  const leftTouch = p >= (story.pickupFirst ? 0.08 : 0) && p <= 0.62;
  const rightTouch = p >= 0.46;
  return {
    actors: [
      { x: x0, moving: p > 0.26 && p < 0.92 && (p < 0.50 || p > 0.64), reach: leftTouch ? { side: 'right', x, y } : undefined },
      { x: x1, moving: p > 0.26 && p < 0.92 && (p < 0.50 || p > 0.64), reach: rightTouch ? { side: 'left', x, y } : undefined },
    ],
    prop: { x, y, rotation: 0, owner: p >= 0.58 ? 1 : story.pickupFirst && p < 0.25 ? null : 0 },
    touching: [leftTouch, rightTouch],
  };
}
