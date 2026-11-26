/**
 * Strict, allowlist validation of ONE cast member and ONE verb written by a model, plus the catalogue defaults.
 * Used by parse.ts (the single parseDirection). The model says WHAT happens ("open the door"); the angle, axis,
 * wheel names and radii come from the model catalogue in modelRegistry, scaled by the cast scale.
 * Structural/physical limits stay with compileDirection and normalizeSceneProgram, which remain the security boundary.
 */
import { APPROVED_MODELS, approvedModel, type ApprovedModelInfo } from '../modelRegistry';
import type { Vec3 } from '../score';
import { EMOTIONS, POSE_NAMES } from './poses';
import { DirectionError } from './errors';
import { isLocomotion } from './locomotion';
import type { Axis, CastMember, Verb, Window } from './direction';

const RANGE = 200;
export const MESH_SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'plane'] as const;
export const VERB_NAMES = ['appear', 'vanish', 'move', 'scale', 'turn', 'open', 'close', 'rotatePart', 'spin', 'drive', 'roll', 'rise', 'pose'] as const;
const KINDS = ['model', 'mesh', 'actor', 'group'] as const;

/** Models the AI may use: only those whose registry entry carries authoring facts. */
export function directionModels(): [string, ApprovedModelInfo][] {
  return Object.entries(APPROVED_MODELS).filter(([, info]) => info.catalogue);
}

type Raw = Record<string, unknown>;
const fail = (message: string): never => { throw new DirectionError(message); };
const isObject = (x: unknown): x is Raw => !!x && typeof x === 'object' && !Array.isArray(x);
/** Models often send null for "not applicable": treat it as absent. */
const clean = (x: Raw): Raw => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== null && v !== undefined));
const only = (r: Raw, keys: readonly string[], what: string) => {
  const extra = Object.keys(r).find((k) => !keys.includes(k));
  if (extra) fail(`${what} tem o campo não suportado "${extra}".`);
};
const num = (v: unknown, what: string, min = -RANGE, max = RANGE): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail(`${what} precisa ser um número entre ${min} e ${max}.`);
const vec3 = (v: unknown, what: string, min = -RANGE, max = RANGE): Vec3 =>
  Array.isArray(v) && v.length === 3 ? [num(v[0], what, min, max), num(v[1], what, min, max), num(v[2], what, min, max)] : fail(`${what} precisa ter 3 números [x,y,z].`);
const str = (v: unknown, what: string, pattern = /^[a-z0-9][a-z0-9_-]{0,39}$/): string =>
  typeof v === 'string' && pattern.test(v) ? v : fail(`${what} é inválido.`);
const color = (v: unknown, what: string): string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fail(`${what} precisa ser uma cor #RRGGBB.`);

const CAST_KEYS = ['id', 'kind', 'assetId', 'parent', 'position', 'rotation', 'scale', 'color', 'hidden', 'geometry', 'repeat', 'material'] as const;
const MATERIAL_KEYS = ['roughness', 'metalness', 'opacity', 'emissive', 'emissiveIntensity'] as const;

/** One cast member. `ids` holds the members already accepted (a parent must come before its children). */
export function strictCast(value: unknown, ids: Set<string>): CastMember {
  const r = clean(isObject(value) ? value : fail('Um item do elenco não é um objeto.'));
  only(r, CAST_KEYS, 'Um item do elenco');
  const id = str(r.id, 'O id de um item do elenco (minúsculas, números, - ou _)');
  if (ids.has(id)) fail(`O elenco repete "${id}".`);
  const kind = KINDS.includes(r.kind as never) ? r.kind as CastMember['kind'] : fail(`"${id}" tem tipo desconhecido (use ${KINDS.join(', ')}).`);
  const m: CastMember = { id, kind };
  if (r.parent !== undefined) {
    m.parent = str(r.parent, `O pai de "${id}"`);
    if (!ids.has(m.parent as string)) fail(`"${id}" cita o pai "${m.parent}" antes de ele existir no elenco.`);
  }
  if (r.position !== undefined) m.position = vec3(r.position, `A posição de "${id}"`);
  if (r.rotation !== undefined) m.rotation = vec3(r.rotation, `A rotação de "${id}"`, -Math.PI * 4, Math.PI * 4);
  if (r.scale !== undefined) m.scale = vec3(r.scale, `A escala de "${id}"`, .01, 50);
  if (r.hidden !== undefined) m.hidden = r.hidden === true ? true : r.hidden === false ? undefined : fail(`hidden de "${id}" precisa ser true ou false.`);
  if (r.material !== undefined) {
    const mat = clean(isObject(r.material) ? r.material : fail(`material de "${id}" precisa ser um objeto.`));
    only(mat, MATERIAL_KEYS, `O material de "${id}"`);
    m.material = mat;
  }
  if (r.repeat !== undefined) {
    const rep = clean(isObject(r.repeat) ? r.repeat : fail(`repeat de "${id}" precisa ser um objeto.`));
    only(rep, ['count', 'step', 'jitter', 'seed', 'ground', 'above'], `O repeat de "${id}"`);
    m.repeat = rep;
  }
  if (kind === 'model') {
    if (typeof r.assetId !== 'string' || !approvedModel(r.assetId)?.catalogue) fail(`"${id}" usa um modelo que não está no catálogo. Modelos: ${directionModels().map(([k]) => k).join(', ')}.`);
    if (r.geometry !== undefined || r.color !== undefined) fail(`"${id}" é um modelo: não aceita geometry nem color.`);
    m.assetId = r.assetId;
  } else {
    if (r.assetId !== undefined) fail(`Só modelos (kind "model") usam assetId ("${id}").`);
    if (r.color !== undefined) m.color = color(r.color, `A cor de "${id}"`);
    if (kind === 'mesh') {
      const g = clean(isObject(r.geometry) ? r.geometry : fail(`"${id}" é um mesh e precisa de geometry { shape, size }.`));
      only(g, ['shape', 'size'], `A geometry de "${id}"`);
      if (!MESH_SHAPES.includes(g.shape as never)) fail(`A geometry de "${id}" precisa de shape entre ${MESH_SHAPES.join(', ')}.`);
      if (!Array.isArray(g.size) || g.size.length < 1 || g.size.length > 3) fail(`A geometry de "${id}" precisa de size com 1 a 3 números.`);
      m.geometry = { shape: g.shape, size: (g.size as unknown[]).map((n) => num(n, `O tamanho de "${id}"`, .001, RANGE)) };
      if (m.color === undefined) fail(`"${id}" precisa de color.`);
    } else if (r.geometry !== undefined) fail(`Só mesh aceita geometry ("${id}").`);
  }
  ids.add(id);
  return m;
}

const VERB_KEYS = ['do', 'node', 'at', 'to', 'by', 'part', 'axis', 'angle', 'turns', 'wheels', 'wheelRadius', 'dx', 'radius', 'centerY', 'height', 'pose', 'emotion'] as const;

/** One verb. Actor-choreography verbs (walk, climb, …) only accept {do,node,from?,at?}; the world check stays in compileDirection. */
export function strictVerb(value: unknown, cast: Map<string, CastMember>): Verb {
  const r = clean(isObject(value) ? value : fail('Verbo inválido.'));
  only(r, [...VERB_KEYS, 'from'], 'Um verbo');
  if (typeof r.do === 'string' && isLocomotion(r.do)) {
    only(r, ['do', 'node', 'from', 'at'], `O verbo "${r.do}"`);
    if (r.from !== undefined && !['left', 'right', 'front'].includes(r.from as string)) fail('from precisa ser left, right ou front.');
    const n = str(r.node, 'O node de um verbo');
    if (!cast.has(n)) fail(`Verbo cita "${n}", que não está no elenco.`);
    return { do: r.do, node: n, ...(r.from !== undefined ? { from: r.from as 'left' | 'right' | 'front' } : {}) };
  }
  const kind = VERB_NAMES.includes(r.do as never) ? r.do as (typeof VERB_NAMES)[number] : fail(`Verbo desconhecido: ${String(r.do)}.`);
  const node = str(r.node, 'O node de um verbo');
  const m = cast.get(node) ?? fail(`Verbo cita "${node}", que não está no elenco.`);
  let at: Window | undefined;
  if (r.at !== undefined) {
    if (!Array.isArray(r.at) || r.at.length !== 2) fail(`A janela "at" de "${node}" precisa ser [início, fim].`);
    const a = num((r.at as unknown[])[0], 'O início da janela', 0, 1), b = num((r.at as unknown[])[1], 'O fim da janela', 0, 1);
    if (b - a < .01) fail(`A janela "at" de "${node}" é curta demais.`);
    at = [a, b];
  }
  const withAt = <T extends Verb>(verb: T): T => (at ? { ...verb, at } : verb);
  const cat = m.kind === 'model' ? approvedModel(m.assetId)?.catalogue : undefined;
  const scale = ((m.scale as Vec3 | undefined)?.[1]) ?? 1;
  const partFor = () => {
    const name = str(r.part, `A peça de "${node}"`, /^[A-Za-z][A-Za-z0-9_.-]{0,59}$/);
    if (!cat) fail(`"${node}" não tem peças móveis catalogadas.`);
    const info = cat!.parts?.find((p) => p.name === name) ?? fail(`O modelo de "${node}" não tem a peça "${name}".`);
    return info!;
  };
  const axisOr = (fallback: Axis): Axis => r.axis === undefined ? fallback : (['x', 'y', 'z'].includes(r.axis as string) ? r.axis as Axis : fail('axis precisa ser x, y ou z.'));
  const need = (key: keyof typeof r) => r[key] === undefined ? fail(`O verbo "${kind}" de "${node}" precisa de "${String(key)}".`) : r[key];
  const exact = (keys: readonly string[]) => only(r, ['do', 'node', 'at', ...keys], `O verbo "${kind}"`);

  switch (kind) {
    case 'appear': case 'vanish': exact([]); return withAt({ do: kind, node });
    case 'move': {
      exact(['to', 'by']);
      if ((r.to === undefined) === (r.by === undefined)) fail(`"move" de "${node}" precisa de exatamente um entre to e by.`);
      return withAt(r.to !== undefined ? { do: 'move', node, to: vec3(r.to, `O destino de "${node}"`) } : { do: 'move', node, by: vec3(r.by, `O deslocamento de "${node}"`) });
    }
    case 'scale': exact(['to']); return withAt({ do: 'scale', node, to: vec3(need('to'), `A escala de "${node}"`, .01, 50) });
    case 'turn': exact(['to']); return withAt({ do: 'turn', node, to: vec3(need('to'), `A rotação de "${node}"`, -Math.PI * 4, Math.PI * 4) });
    case 'open': {
      exact(['part', 'axis', 'angle']); const p = partFor();
      return withAt({ do: 'open', node, part: p.name, axis: axisOr(p.axis), angle: r.angle === undefined ? (p.openAngle ?? fail(`"open" de "${node}/${p.name}" precisa de angle.`)) : num(r.angle, 'O ângulo', -Math.PI * 4, Math.PI * 4) });
    }
    case 'close': { exact(['part', 'axis']); const p = partFor(); return withAt({ do: 'close', node, part: p.name, axis: axisOr(p.axis) }); }
    case 'rotatePart': { exact(['part', 'axis', 'to']); const p = partFor(); return withAt({ do: 'rotatePart', node, part: p.name, axis: axisOr(p.axis), to: num(need('to'), 'O ângulo', -Math.PI * 8, Math.PI * 8) }); }
    case 'spin': { exact(['part', 'axis', 'turns']); const p = partFor(); return withAt({ do: 'spin', node, part: p.name, axis: axisOr(p.axis), turns: num(need('turns'), 'As voltas', -20, 20) }); }
    case 'drive': {
      exact(['by', 'wheels', 'wheelRadius']);
      const radius = r.wheelRadius === undefined ? (cat?.wheelRadius ? cat.wheelRadius * scale : fail(`"drive" de "${node}" precisa de wheelRadius.`)) : num(r.wheelRadius, 'wheelRadius', .01, 20);
      const wheels = r.wheels === undefined ? (cat?.parts?.filter((p) => p.kind === 'wheel').map((p) => p.name) ?? []) : (Array.isArray(r.wheels) && r.wheels.length <= 12 ? r.wheels.map((w) => partNameOf(cat, w, node)) : fail('wheels precisa ser uma lista de até 12 nomes.'));
      return withAt({ do: 'drive', node, by: vec3(need('by'), `O percurso de "${node}"`), wheels, wheelRadius: radius });
    }
    case 'roll': {
      exact(['dx', 'radius', 'centerY']);
      if (r.radius === undefined && !cat?.roll) fail(`"roll" de "${node}" precisa de radius e centerY.`);
      const radius = r.radius === undefined ? cat!.roll!.radius * scale : num(r.radius, 'radius', .01, 20);
      const centerY = r.centerY === undefined ? (cat?.roll ? cat.roll.centerY * scale : radius) : num(r.centerY, 'centerY', 0, 40);
      return withAt({ do: 'roll', node, dx: num(need('dx'), 'dx', -100, 100), radius, centerY });
    }
    case 'rise': exact(['height']); return withAt({ do: 'rise', node, height: num(need('height'), 'A altura', .01, 40) });
    case 'pose': {
      exact(['pose', 'emotion']);
      if (!POSE_NAMES.includes(r.pose as never)) fail(`Pose desconhecida: ${String(r.pose)}.`);
      if (r.emotion !== undefined && !EMOTIONS.includes(r.emotion as never)) fail(`Emoção desconhecida: ${String(r.emotion)}.`);
      return withAt({ do: 'pose', node, pose: r.pose as never, ...(r.emotion !== undefined ? { emotion: r.emotion as never } : {}) });
    }
  }
}
const partNameOf = (cat: ApprovedModelInfo['catalogue'], w: unknown, node: string): string => {
  const name = str(w, 'O nome da roda', /^[A-Za-z][A-Za-z0-9_.-]{0,59}$/);
  return cat?.parts?.some((p) => p.name === name) ? name : fail(`O modelo de "${node}" não tem a peça "${name}".`);
};

