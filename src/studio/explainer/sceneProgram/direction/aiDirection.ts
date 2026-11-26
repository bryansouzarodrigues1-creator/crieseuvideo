/**
 * Lets an LLM (Gemini) write a Direction instead of raw tracks.
 *
 * Three pieces, all browser-safe and free of network access:
 *  - directionPrompt / directionResponseSchema: what the model is told and the shape it must answer in;
 *  - parseDirection: a STRICT allowlist validator that also fills catalogue defaults (door angle, wheel
 *    names, wheel radius, coin radius), so the model only says WHAT happens, not engine numbers;
 *  - the catalogue comes from modelRegistry, never hard-coded here: registering a model with
 *    `catalogue` metadata is all it takes to offer it to the AI.
 * The schema and the prompt are hints. compileDirection → normalizeSceneProgram stays the only
 * security boundary; nothing returned by a model reaches Three.js without passing it.
 */
import { APPROVED_MODELS, approvedModel, type ApprovedModelInfo } from '../modelRegistry';
import type { ProgramSource, Vec3 } from '../score';
import type { ComplexWorldClip } from '../planner/complexWorldBatch';
import { EMOTIONS, POSE_NAMES } from './poses';
import { compileDirection, DirectionError, type Axis, type CastMember, type Direction, type SceneDirection, type Verb, type Window } from './direction';

export const MAX_DIRECTION_SCENES = 8;
const MAX_CAST = 60, MAX_VERBS_PER_SCENE = 24, RANGE = 200;
export const MESH_SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'plane'] as const;
export const VERB_NAMES = ['appear', 'vanish', 'move', 'scale', 'turn', 'open', 'close', 'rotatePart', 'spin', 'drive', 'roll', 'rise', 'pose'] as const;
const KINDS = ['model', 'mesh', 'actor', 'group'] as const;

/** Models the AI may use: only those whose registry entry carries authoring facts. */
export function directionModels(): [string, ApprovedModelInfo][] {
  return Object.entries(APPROVED_MODELS).filter(([, info]) => info.catalogue);
}

// ---------------------------------------------------------------------------------------------
// Parsing

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
const str = (v: unknown, what: string, pattern = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/): string =>
  typeof v === 'string' && pattern.test(v) ? v : fail(`${what} é inválido.`);
const color = (v: unknown, what: string): string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fail(`${what} precisa ser uma cor #RRGGBB.`);

/** The only JSON envelope tolerated is a markdown fence; anything else is not repaired. */
export function parseDirectionJson(text: string): unknown {
  if (!text || text.length > 480_000) return fail('A IA devolveu uma resposta vazia ou grande demais.');
  const trimmed = text.trim();
  const fenced = trimmed.match(/^\x60{3}(?:json)?\s*\n([\s\S]*?)\n?\x60{3}$/i);
  try { return JSON.parse(fenced ? fenced[1] : trimmed); } catch { return fail('A IA não devolveu JSON válido.'); }
}

const CAST_KEYS = ['id', 'kind', 'assetId', 'parent', 'position', 'rotation', 'scale', 'color', 'hidden', 'shape', 'size'] as const;

function parseCast(value: unknown, ids: Set<string>): CastMember {
  const r = clean(isObject(value) ? value : fail('Elenco inválido.'));
  only(r, CAST_KEYS, 'Um item do elenco');
  const id = str(r.id, 'O id de um item do elenco');
  if (ids.has(id)) fail(`O elenco repete "${id}".`);
  const kind = KINDS.includes(r.kind as never) ? r.kind as CastMember['kind'] : fail(`"${id}" tem tipo desconhecido.`);
  const m: CastMember = { id, kind };
  if (r.parent !== undefined) {
    m.parent = str(r.parent, `O pai de "${id}"`);
    if (!ids.has(m.parent as string)) fail(`"${id}" cita o pai "${m.parent}" antes de ele existir no elenco.`);
  }
  if (r.position !== undefined) m.position = vec3(r.position, `A posição de "${id}"`);
  if (r.rotation !== undefined) m.rotation = vec3(r.rotation, `A rotação de "${id}"`, -Math.PI * 4, Math.PI * 4);
  if (r.scale !== undefined) m.scale = vec3(r.scale, `A escala de "${id}"`, .01, 50);
  if (r.hidden !== undefined) m.hidden = r.hidden === true ? true : r.hidden === false ? undefined : fail(`hidden de "${id}" precisa ser true ou false.`);
  if (kind === 'model') {
    if (typeof r.assetId !== 'string' || !approvedModel(r.assetId)?.catalogue) fail(`"${id}" usa um modelo que não está no catálogo.`);
    if (r.shape !== undefined || r.size !== undefined || r.color !== undefined) fail(`"${id}" é um modelo: não aceita shape, size ou color.`);
    m.assetId = r.assetId;
  } else {
    if (r.assetId !== undefined) fail(`Só modelos (kind "model") usam assetId ("${id}").`);
    if (r.color !== undefined) m.color = color(r.color, `A cor de "${id}"`);
    if (kind === 'mesh') {
      if (!MESH_SHAPES.includes(r.shape as never)) fail(`"${id}" precisa de shape entre ${MESH_SHAPES.join(', ')}.`);
      if (!Array.isArray(r.size) || r.size.length < 1 || r.size.length > 3) fail(`"${id}" precisa de size com 1 a 3 números.`);
      m.geometry = { shape: r.shape, size: (r.size as unknown[]).map((n) => num(n, `O tamanho de "${id}"`, .001, RANGE)) };
      if (m.color === undefined) fail(`"${id}" precisa de color.`);
    } else if (r.shape !== undefined || r.size !== undefined) fail(`Só mesh aceita shape e size ("${id}").`);
  }
  ids.add(id);
  return m;
}

const VERB_KEYS = ['do', 'node', 'at', 'to', 'by', 'part', 'axis', 'angle', 'turns', 'wheels', 'wheelRadius', 'dx', 'radius', 'centerY', 'height', 'pose', 'emotion'] as const;

function parseVerb(value: unknown, cast: Map<string, CastMember>): Verb {
  const r = clean(isObject(value) ? value : fail('Verbo inválido.'));
  only(r, VERB_KEYS, 'Um verbo');
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

/** Validates an AI-written direction against an allowlist and fills catalogue defaults. Throws DirectionError. */
export function parseDirection(raw: unknown, sources: readonly ProgramSource[]): Direction {
  const r = isObject(raw) ? raw : fail('A direção precisa ser um objeto JSON.');
  only(r, ['version', 'background', 'cast', 'scenes'], 'A direção');
  if (r.version !== 1) fail('Versão de direção desconhecida.');
  if (!Array.isArray(r.cast) || r.cast.length < 1 || r.cast.length > MAX_CAST) fail(`O elenco precisa ter de 1 a ${MAX_CAST} itens.`);
  if (!Array.isArray(r.scenes) || r.scenes.length !== sources.length) fail('A direção precisa ter exatamente uma cena por frase do roteiro.');
  const ids = new Set<string>(), cast = new Map<string, CastMember>();
  for (const item of r.cast as unknown[]) { const m = parseCast(item, ids); cast.set(m.id, m); }
  const scenes = (r.scenes as unknown[]).map((value, i): SceneDirection => {
    const s = clean(isObject(value) ? value : fail('Cena inválida.'));
    only(s, ['sourceId', 'shot', 'verbs'], 'Uma cena');
    if (s.sourceId !== sources[i].sourceId) fail('As cenas precisam seguir a ordem das frases (s1, s2, ...).');
    const shot = clean(isObject(s.shot) ? s.shot : fail(`A cena ${s.sourceId} precisa de câmera (shot).`));
    only(shot, ['subjects', 'azimuth', 'endAzimuth', 'elevation', 'distance'], 'A câmera');
    if (!Array.isArray(shot.subjects) || shot.subjects.length < 1 || shot.subjects.length > 6) fail('A câmera precisa de 1 a 6 subjects.');
    const subjects = (shot.subjects as unknown[]).map((id) => { const k = str(id, 'Um subject da câmera'); return cast.has(k) ? k : fail(`A câmera cita "${k}", que não está no elenco.`); });
    const verbsRaw = s.verbs === undefined ? [] : Array.isArray(s.verbs) ? s.verbs : fail('verbs precisa ser uma lista.');
    if ((verbsRaw as unknown[]).length > MAX_VERBS_PER_SCENE) fail(`No máximo ${MAX_VERBS_PER_SCENE} verbos por cena.`);
    return {
      sourceId: sources[i].sourceId,
      shot: {
        subjects, azimuth: num(shot.azimuth ?? 0.3, 'azimuth', -Math.PI * 2, Math.PI * 2),
        ...(shot.endAzimuth !== undefined ? { endAzimuth: num(shot.endAzimuth, 'endAzimuth', -Math.PI * 2, Math.PI * 2) } : {}),
        elevation: num(shot.elevation ?? .18, 'elevation', -.35, 1.1), distance: num(shot.distance ?? 1.15, 'distance', 1, 2.5),
      },
      verbs: (verbsRaw as unknown[]).map((v) => parseVerb(v, cast)),
    };
  });
  return { version: 1, background: color(r.background, 'background'), cast: [...cast.values()], scenes };
}

// ---------------------------------------------------------------------------------------------
// Prompt and response schema

export function directionResponseSchema(sourceIds: readonly string[]): Record<string, unknown> {
  if (sourceIds.length < 1 || sourceIds.length > MAX_DIRECTION_SCENES || sourceIds.some((id, i) => id !== 's' + (i + 1)))
    throw new Error(`A direção precisa de 1 a ${MAX_DIRECTION_SCENES} IDs s1, s2, ... em ordem.`);
  const vec = { type: 'ARRAY', items: { type: 'NUMBER' }, minItems: 3, maxItems: 3 };
  const models = directionModels().map(([id]) => id);
  return {
    type: 'OBJECT',
    properties: {
      version: { type: 'INTEGER' },
      background: { type: 'STRING' },
      cast: {
        type: 'ARRAY', minItems: 1, maxItems: MAX_CAST,
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] },
            assetId: { type: 'STRING', enum: models }, parent: { type: 'STRING' },
            position: vec, rotation: vec, scale: vec, color: { type: 'STRING' }, hidden: { type: 'BOOLEAN' },
            shape: { type: 'STRING', enum: [...MESH_SHAPES] }, size: { type: 'ARRAY', items: { type: 'NUMBER' }, minItems: 1, maxItems: 3 },
          },
          required: ['id', 'kind'],
        },
      },
      scenes: {
        type: 'ARRAY', minItems: sourceIds.length, maxItems: sourceIds.length,
        items: {
          type: 'OBJECT',
          properties: {
            sourceId: { type: 'STRING', enum: [...sourceIds] },
            shot: {
              type: 'OBJECT',
              properties: {
                subjects: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 1, maxItems: 6 },
                azimuth: { type: 'NUMBER' }, endAzimuth: { type: 'NUMBER' }, elevation: { type: 'NUMBER' }, distance: { type: 'NUMBER' },
              },
              required: ['subjects', 'azimuth', 'elevation', 'distance'],
            },
            verbs: {
              type: 'ARRAY', maxItems: MAX_VERBS_PER_SCENE,
              items: {
                type: 'OBJECT',
                properties: {
                  do: { type: 'STRING', enum: [...VERB_NAMES] }, node: { type: 'STRING' },
                  at: { type: 'ARRAY', items: { type: 'NUMBER' }, minItems: 2, maxItems: 2 },
                  to: vec, by: vec, part: { type: 'STRING' }, axis: { type: 'STRING', enum: ['x', 'y', 'z'] },
                  angle: { type: 'NUMBER' }, turns: { type: 'NUMBER' }, wheels: { type: 'ARRAY', items: { type: 'STRING' } },
                  wheelRadius: { type: 'NUMBER' }, dx: { type: 'NUMBER' }, radius: { type: 'NUMBER' }, centerY: { type: 'NUMBER' },
                  height: { type: 'NUMBER' }, pose: { type: 'STRING', enum: [...POSE_NAMES] }, emotion: { type: 'STRING', enum: [...EMOTIONS] },
                },
                required: ['do', 'node'],
              },
            },
          },
          required: ['sourceId', 'shot', 'verbs'],
        },
      },
    },
    required: ['version', 'background', 'cast', 'scenes'],
  };
}

/** A tiny, model-agnostic example. direction.test/aiDirection.test compile it so it can never rot. */
export const DIRECTION_EXAMPLE = {
  version: 1, background: '#BFD8E6',
  cast: [
    { id: 'chao', kind: 'mesh', shape: 'box', size: [60, 0.2, 60], position: [0, -0.1, 0], color: '#C9D6DF' },
    { id: 'cofre', kind: 'model', assetId: 'giant-safe-v1', position: [0, 0, 0] },
    { id: 'pessoa', kind: 'actor', color: '#1E3A8A', position: [2.2, 0, 1.8], rotation: [0, -0.55, 0] },
    { id: 'caixa', kind: 'mesh', hidden: true, shape: 'box', size: [0.6, 0.6, 0.6], position: [0, 0.6, 0], color: '#F59E0B' },
  ],
  scenes: [
    { sourceId: 's1', shot: { subjects: ['cofre', 'pessoa'], azimuth: 0.3, endAzimuth: 0.05, elevation: 0.16, distance: 1.15 }, verbs: [
      { do: 'spin', node: 'cofre', part: 'volante', turns: 1, at: [0, 0.4] },
      { do: 'open', node: 'cofre', part: 'porta', at: [0.4, 0.95] },
      { do: 'pose', node: 'pessoa', pose: 'surprised', emotion: 'surprised', at: [0, 0.2] },
    ] },
    { sourceId: 's2', shot: { subjects: ['cofre', 'caixa'], azimuth: 0.05, elevation: 0.2, distance: 1.1 }, verbs: [
      { do: 'appear', node: 'caixa', at: [0, 0.3] },
      { do: 'move', node: 'caixa', to: [0, 0.6, 3], at: [0.3, 1] },
    ] },
  ],
};

function catalogueText(): string {
  return directionModels().map(([id, info]) => {
    const c = info.catalogue!;
    const lines = [`- ${id}: ${c.description} Tamanho ${c.size.join(' × ')} m (largura × altura × profundidade, sem escala). Origem: ${c.origin}.`];
    for (const p of c.parts?.filter((q) => q.kind !== 'wheel') ?? []) lines.push(`    peça "${p.name}" (${p.kind}, eixo ${p.axis}${p.openAngle !== undefined ? `, ângulo padrão ${p.openAngle}` : ''}): ${p.note}`);
    const wheels = c.parts?.filter((q) => q.kind === 'wheel') ?? [];
    if (wheels.length) lines.push(`    rodas: ${wheels.map((w) => w.name).join(', ')} (raio ${c.wheelRadius} m). Use o verbo drive; as rodas giram sozinhas.`);
    if (c.roll) lines.push(`    pode rolar de pé ao longo de +X com o verbo roll (raio ${c.roll.radius} m).`);
    if (c.interiorFloorY !== undefined) lines.push(`    piso interno em y=${c.interiorFloorY}: coloque modelos pequenos dentro com position y=${c.interiorFloorY}.`);
    return lines.join('\n');
  }).join('\n');
}

export function directionPrompt(sources: readonly ProgramSource[]): string {
  if (sources.length < 1 || sources.length > MAX_DIRECTION_SCENES) throw new Error(`Roteiro com 1 a ${MAX_DIRECTION_SCENES} frases.`);
  const briefs = sources.map((s) => ({ sourceId: s.sourceId, text: s.text, duration: s.duration }));
  return [
    'Você é diretor de animação de um estúdio de vídeos explicativos em 3D. Você NÃO escreve coordenadas por quadro: escreve uma DIREÇÃO (elenco + verbos) e o motor cuida do resto.',
    'Responda SOMENTE com JSON {version:1,background:"#RRGGBB",cast:[...],scenes:[...]}. Nada de texto fora do JSON, scripts, URLs ou modelos que não estejam no catálogo.',
    '',
    'ROTEIRO (uma cena por frase, mesma ordem, cada cena dura o "duration" indicado em segundos):',
    JSON.stringify(briefs),
    '',
    'ELENCO (cast): tudo o que existe no vídeo inteiro, em UMA cena persistente. Cada item: {id,kind,position?,rotation?,scale?,hidden?,...}.',
    '- kind "model": {assetId} escolhido do CATÁLOGO abaixo. Não aceita shape/size/color.',
    `- kind "mesh": {shape:${MESH_SHAPES.join('|')},size,color:"#RRGGBB"}; size: box [largura,altura,profundidade], sphere [raio], cylinder [raioTopo,raioBase,altura], cone [raio,altura], torus [raio,tubo], capsule [raio,comprimento], plane [largura,profundidade].`,
    '- kind "actor": uma pessoa genérica feita em código ({color} é a roupa). Nunca represente uma pessoa real; é um boneco neutro.',
    '- kind "group": agrupa peças; use "parent":"idDoGrupo" nas filhas (o grupo deve vir antes).',
    '- hidden:true = começa invisível; o verbo appear faz aparecer. Inclua sempre um chão (mesh box largo e fino com topo em y=0).',
    '- Mundo em metros: +Y é para cima, o chão fica em y=0, a câmera padrão olha de +Z para −Z. Itens apoiados no chão têm position y = metade da altura (meshes) ou 0 (modelos, origem na base).',
    '',
    'CATÁLOGO DE MODELOS (use só estes assetId):',
    catalogueText(),
    '',
    'VERBOS por cena: {do,node,at:[de,até]}; "at" é a janela dentro da cena, de 0 a 1 (padrão [0,1]).',
    '- appear / vanish: surgir / sumir.   - move {to:[x,y,z]} ou {by:[dx,dy,dz]}.   - scale {to:[sx,sy,sz]}.   - turn {to:[rx,ry,rz]} (radianos).',
    '- open {part} / close {part}: abre/fecha uma porta do modelo. spin {part,turns}: gira uma peça (volante). Ângulo e eixo vêm do catálogo; não precisa informar.',
    '- drive {by:[dx,0,dz]}: o veículo anda PARA A FRENTE (+Z do modelo, girado pelo seu yaw) e as rodas giram sozinhas. Andar de lado é rejeitado: gire o veículo antes com turn.',
    '- roll {dx}: disco de pé rola ao longo de +X.   - rise {height}: barra (mesh box de altura 1, position.y = base) cresce até a altura.',
    `- pose {pose:${POSE_NAMES.join('|')},emotion:${EMOTIONS.join('|')}}: só para actor.`,
    '',
    'REGRAS DE QUALIDADE (o motor rejeita o que quebra isto):',
    '- Cada cena precisa de pelo menos um verbo com movimento visível que ilustre a frase. Nada de cena parada.',
    '- Dois verbos na mesma propriedade do mesmo node não podem se sobrepor no tempo dentro da cena. Não misture move (suave) com drive/roll (linear) no mesmo node.',
    '- Escolha a câmera de cada cena: shot {subjects:[ids que devem aparecer],azimuth (0 = de frente; ±0.3 a ±0.6 dá profundidade),endAzimuth? (câmera se move devagar),elevation 0.1–0.3,distance 1.0–1.4}. Mantenha o assunto da frase em foco e perto do centro.',
    '- Prefira poucos objetos bem escolhidos a muitos. Mantenha tudo que a câmera mostra dentro de ~12 m do centro. Modelos grandes (veículos) fora de cena começam hidden e entram com drive.',
    '- Modelos têm escalas reais; use "scale" no elenco para equilibrar tamanhos (por exemplo um pallet pequeno ao lado de um cofre).',
    '',
    'EXEMPLO de formato (outro tema, apenas ilustra a sintaxe):',
    JSON.stringify(DIRECTION_EXAMPLE),
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Glue used by the server function (kept here so it is unit-tested without a server)

/** Sources for a direction request: ids s1..sN assigned by the server, never by the client. */
export function directionSources(items: readonly { text: string; duration: number }[]): ProgramSource[] {
  if (items.length < 1 || items.length > MAX_DIRECTION_SCENES) fail(`Use de 1 a ${MAX_DIRECTION_SCENES} frases.`);
  return items.map((s, i) => ({ sourceId: 's' + (i + 1), text: s.text.replace(/\s+/g, ' ').trim(), duration: s.duration }));
}

/** Provider callback: accept an answer only if it parses AND compiles into a valid SceneProgram. */
export function checkDirectionAnswer(text: string, sources: ProgramSource[]): { accepted: boolean; reason?: 'invalid_json' | 'invalid_scene' } {
  let raw: unknown;
  try { raw = parseDirectionJson(text); } catch { return { accepted: false, reason: 'invalid_json' }; }
  try { compileDirection(parseDirection(raw, sources), sources); return { accepted: true }; }
  // Never echo the model output or the failing reason into logs.
  catch { return { accepted: false, reason: 'invalid_scene' }; }
}

export function directionToClip(text: string, sources: ProgramSource[]): ComplexWorldClip {
  const direction = parseDirection(parseDirectionJson(text), sources);
  const program = compileDirection(direction, sources);
  let start = 0;
  return {
    id: 'direcao', sources, duration: sources.reduce((sum, s) => sum + (s.duration ?? 0), 0), program,
    presentation: {
      title: sources[0].text.slice(0, 60), narration: sources.map((s) => s.text).join(' '),
      beats: sources.map((s) => { const b = { start, end: start + (s.duration ?? 0), subject: s.text.slice(0, 48), problem: s.text.slice(0, 80), solution: '' }; start = b.end; return b; }),
    },
    audit: { objectCount: direction.cast.length, objectParts: program.nodes.filter((n) => n.kind === 'mesh').length, sceneryRegions: 0, sceneNodes: program.nodes.length, shotCount: program.shots.length, estimatedVertexLimit: 250000 },
  };
}
