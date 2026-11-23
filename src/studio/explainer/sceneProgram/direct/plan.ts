/**
 * Semantic direction: what the model is asked to write instead of raw 3D numbers.
 *
 * The model chooses WHAT happens in each sentence (a verb from a closed list, a camera idea, how tall the
 * mountain is). It never writes coordinates, hold positions, IK targets or contact windows: those are derived
 * deterministically by `compile.ts` from the engine's own measurements (actor height, reach, stride).
 * Everything here is validated with messages written for the model, so a repair call can fix the plan.
 */
export const VERBS = ['walk', 'climb', 'plant', 'celebrate', 'stand'] as const;
export type Verb = typeof VERBS[number];
export const CAMERAS = ['follow', 'wide', 'close', 'orbit', 'low'] as const;
export type CameraIdea = typeof CAMERAS[number];
export const MOODS = ['day', 'dusk', 'night'] as const;
export type Mood = typeof MOODS[number];

export interface SemanticBeat { sourceId: string; verb: Verb; camera: CameraIdea; /** walk: side the hero arrives from */ from?: 'left' | 'right' | 'front' }
export interface SemanticPlan {
  world: { kind: 'cliff'; /** metres of vertical wall the hero has to climb (2.4 to 4.5) */ height: number; mood: Mood };
  hero: { color: string };
  beats: SemanticBeat[];
}
export class SemanticPlanError extends Error { readonly code = 'invalid_semantic_plan'; constructor(message: string) { super(message); } }
const fail = (message: string): never => { throw new SemanticPlanError(message); };

/** Strict parse: unknown fields, unknown verbs and missing sentences are rejected with an actionable message. */
export function parseSemanticPlan(raw: unknown, sourceIds: string[]): SemanticPlan {
  const r = raw as any;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return fail('O plano precisa ser um objeto JSON com world, hero e beats.');
  const extra = Object.keys(r).filter((k) => !['world', 'hero', 'beats', 'title'].includes(k));
  if (extra.length) fail(`Campos não suportados no plano: ${extra.join(', ')}. Envie apenas world, hero e beats (sem coordenadas).`);
  const w = r.world ?? {};
  if (w.kind !== 'cliff') fail('world.kind precisa ser "cliff" (única cena disponível por enquanto).');
  if (typeof w.height !== 'number' || !Number.isFinite(w.height) || w.height < 2.4 || w.height > 4.5) fail('world.height é a altura da parede em metros, entre 2.4 e 4.5. Não use a altura real da montanha.');
  if (!MOODS.includes(w.mood)) fail(`world.mood precisa ser um destes: ${MOODS.join(', ')}.`);
  const color = r.hero?.color;
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) fail('hero.color precisa ser uma cor #RRGGBB (a jaqueta do personagem).');
  if (!Array.isArray(r.beats) || r.beats.length !== sourceIds.length) fail(`beats precisa ter exatamente ${sourceIds.length} item(ns), um por frase, na ordem.`);
  const beats = r.beats.map((b: any, i: number): SemanticBeat => {
    if (!b || typeof b !== 'object') return fail(`beats[${i}] não é um objeto.`);
    if (b.sourceId !== sourceIds[i]) fail(`beats[${i}].sourceId precisa ser "${sourceIds[i]}".`);
    if (!VERBS.includes(b.verb)) fail(`beats[${i}].verb precisa ser um destes: ${VERBS.join(', ')}.`);
    if (!CAMERAS.includes(b.camera)) fail(`beats[${i}].camera precisa ser um destes: ${CAMERAS.join(', ')}.`);
    if (b.from !== undefined && !['left', 'right', 'front'].includes(b.from)) fail(`beats[${i}].from precisa ser left, right ou front.`);
    const extraBeat = Object.keys(b).filter((k) => !['sourceId', 'verb', 'camera', 'from'].includes(k));
    if (extraBeat.length) fail(`beats[${i}] tem campos não suportados: ${extraBeat.join(', ')}.`);
    return { sourceId: b.sourceId, verb: b.verb, camera: b.camera, ...(b.from ? { from: b.from } : {}) };
  });
  return { world: { kind: 'cliff', height: w.height, mood: w.mood }, hero: { color }, beats };
}
