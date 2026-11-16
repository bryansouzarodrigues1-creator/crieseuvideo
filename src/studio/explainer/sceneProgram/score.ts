/** An interpreted scene language: new geometry and keyframes, not action IDs.
 * This module is also the server validator. It never imports/evaluates model code. */
import { approvedModel, type ApprovedModelId } from './modelRegistry';

export type Vec3 = [number, number, number];
export interface ProgramSource { sourceId: string; text: string; duration?: number }
export const PROGRAM_CHANNELS = ['position', 'rotation', 'scale', 'bodyRotation', 'headRotation', 'face', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot', 'leftHandRotation', 'rightHandRotation', 'leftFootRotation', 'rightFootRotation'] as const;
export type ProgramChannel = typeof PROGRAM_CHANNELS[number];
export const EFFECTORS = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'] as const;
export type Effector = typeof EFFECTORS[number];
export type Socket = 'root' | 'head' | Effector;
export interface ProgramGeometry { shape: 'box' | 'sphere' | 'capsule' | 'cone' | 'cylinder' | 'plane' | 'torus' | 'mesh' | 'tube' | 'lathe'; size?: number[]; vertices?: number[]; indices?: number[]; colors?: number[]; points?: Vec3[]; /** [radius, height] pairs; rotated around local Y to create a novel 3D surface. */ profile?: [number, number][]; segments?: number }
export interface ProgramNode {
  id: string; kind: 'group' | 'mesh' | 'actor' | 'model'; parent?: string; socket: Socket; assetId?: ApprovedModelId;
  position: Vec3; rotation: Vec3; scale: Vec3; color: string; evidence: string;
  geometry?: ProgramGeometry; repeat?: { count: number; step: Vec3; jitter: Vec3; seed: number };
  material?: { roughness: number; metalness: number; opacity: number; emissive: string; emissiveIntensity: number };
}
export interface ProgramKey { sourceId: string; phase: number; value: Vec3 }
export interface ProgramTrack { node: string; channel: ProgramChannel; interpolation: 'linear' | 'smooth' | 'step'; keys: ProgramKey[] }
export interface ProgramShot { sourceId: string; subjects: string[]; azimuth: number; endAzimuth: number; elevation: number; distance: number }
export interface ProgramContact { sourceId: string; actor: string; effector: Effector; target: string; offset: Vec3; begin: number; end: number }
/** A measurable on-screen action, not a thematic action ID or AI assertion.
 * change => sufficient movement; hold => small movement for the whole interval.
 * Coordinates are LOCAL to the named node, including when its parent moves. */
export interface ProgramMotionCheck {
  sourceId: string;
  node: string;
  channel: 'position' | 'rotation' | 'scale';
  kind: 'change' | 'hold';
  startPhase: number;
  endPhase: number;
  threshold: number;
}
export interface SceneProgram { version: 1; sourceSignature: string; background: string; nodes: ProgramNode[]; tracks: ProgramTrack[]; shots: ProgramShot[]; contacts: ProgramContact[]; motionChecks?: ProgramMotionCheck[] }
export interface ProgramState { position: Vec3; rotation: Vec3; scale: Vec3; pose: Partial<Record<ProgramChannel, Vec3>> }
export class SceneProgramError extends Error {
  readonly code = 'invalid_scene_program';
  constructor(message: string, readonly diagnostic?: unknown) { super(message); }
}
const fail = (message: string): never => { throw new SceneProgramError(message); };
const obj = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : fail('Uma definição do programa de cena não é um objeto.');
const list = (value: unknown, max: number): any[] => Array.isArray(value) && value.length <= max ? value : fail('O programa excedeu um limite de elementos ou contém uma lista inválida.');
const num = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b ? v : fail('Uma coordenada, tempo ou dimensão do programa é inválida.');
const vector = (v: unknown, a = -200, b = 200): Vec3 => { const p = list(v, 3); if (p.length !== 3) fail('Uma coordenada precisa de três valores.'); return p.map((x) => num(x, a, b)) as Vec3; };
const identifier = (v: unknown) => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(v) ? v : fail('Um identificador do programa é inválido.');
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fail('Uma cor do programa é inválida.');
const only = (r: Record<string, unknown>, keys: string[]) => { if (Object.keys(r).some((k) => !keys.includes(k))) fail('O programa contém um campo não suportado. Não envie JavaScript, URLs ou shaders.'); };
const smooth = (t: number) => t * t * (3 - 2 * t);

export function normalizeSceneProgram(raw: unknown, sources: ProgramSource[]): SceneProgram {
  const r = obj(raw); only(r, ['version', 'sourceSignature', 'background', 'nodes', 'tracks', 'shots', 'contacts', 'motionChecks']);
  if (r.version !== 1 || !sources.length) fail('A versão ou as frases do programa são inválidas.');
  const sourceSignature = JSON.stringify(sources.map((s) => [s.sourceId, s.text]));
  if (r.sourceSignature !== undefined && r.sourceSignature !== sourceSignature) fail('O programa pertence a outro roteiro. Gere uma nova direção para este texto.');
  const sourceIndex = new Map(sources.map((s, i) => [s.sourceId, i]));
  const source = (v: unknown) => typeof v === 'string' && sourceIndex.has(v) ? v : fail('O programa citou uma frase inexistente.');
  const fullText = sources.map((s) => s.text).join(' ');
  let vertexBudget = 0;
  const nodes = list(r.nodes, 160).map((value): ProgramNode => {
    const n = obj(value); only(n, ['id', 'kind', 'parent', 'socket', 'position', 'rotation', 'scale', 'color', 'geometry', 'repeat', 'evidence', 'contextSourceId', 'material', 'assetId']);
    if (!['group', 'mesh', 'actor', 'model'].includes(n.kind)) fail('O tipo de nó do programa não é reconhecido.');
    const assetId = n.kind === 'model' ? n.assetId as ApprovedModelId : undefined;
    if (n.kind === 'model' && !approvedModel(assetId)) fail('O modelo externo solicitado não está no catálogo autorizado do projeto.');
    if (n.kind !== 'model' && n.assetId !== undefined) fail('Apenas nós model podem mencionar um modelo GLB.');
    const contextSourceId = n.contextSourceId !== undefined ? source(n.contextSourceId) : undefined;
    const evidence = contextSourceId ? sources[sourceIndex.get(contextSourceId)!].text : n.evidence;
    if (typeof evidence !== 'string' || !evidence.trim() || !contextSourceId && (evidence.length > 400 || !fullText.includes(evidence))) fail('Cada objeto precisa indicar contextSourceId de uma frase original ou citar um trecho literal do roteiro.');
    let geometry: ProgramGeometry | undefined;
    if (n.kind === 'mesh') {
      const g = obj(n.geometry); only(g, ['shape', 'size', 'vertices', 'indices', 'colors', 'points', 'profile', 'segments']);
      const arity: Record<string, number> = { box: 3, sphere: 1, capsule: 2, cone: 2, cylinder: 3, plane: 2, torus: 2, tube: 1 };
      if (g.shape === 'lathe') {
        // Generic surface-of-revolution: jars, bottles, gears, vases, wheels, etc.
        // All values are data. No JavaScript, remote resources or arbitrary shaders.
        if (g.size !== undefined || g.vertices !== undefined || g.indices !== undefined ||
            g.colors !== undefined || g.points !== undefined) fail('A geometria lathe só aceita profile e segments.');
        const profile = list(g.profile, 64).map((value): [number, number] => {
          const pair = list(value, 2);
          if (pair.length !== 2) fail('Cada ponto do perfil precisa conter raio e altura.');
          return [num(pair[0], 0, 200), num(pair[1], -200, 200)];
        });
        if (profile.length < 2 || Math.max(...profile.map((p) => p[0])) < .005 ||
            Math.max(...profile.map((p) => p[1])) - Math.min(...profile.map((p) => p[1])) < .005)
          fail('O perfil lathe precisa de pelo menos dois pontos e dimensão 3D não degenerada.');
        if (profile.some((p, i) => i > 0 && p[0] === profile[i - 1][0] && p[1] === profile[i - 1][1]))
          fail('O perfil lathe contém pontos consecutivos duplicados.');
        const segments = num(g.segments ?? 24, 8, 64);
        if (!Number.isInteger(segments)) fail('A resolução do perfil lathe precisa ser inteira.');
        geometry = { shape: 'lathe', profile, segments };
      } else if (g.shape === 'mesh') {
        const vertices = list(g.vertices, 18000).map((v) => num(v, -200, 200));
        if (vertices.length < 9 || vertices.length % 3) fail('Uma malha precisa de vértices 3D completos.');
        const indices = list(g.indices, 24000).map((v) => { const i = num(v, 0, vertices.length / 3 - 1); if (!Number.isInteger(i)) fail('Um índice de triângulo é inválido.'); return i; });
        if (!indices.length || indices.length % 3) fail('Uma malha precisa de triângulos completos.');
        let colors: number[] | undefined;
        if (g.colors !== undefined) { colors = list(g.colors, 18000).map((v) => num(v, 0, 1)); if (colors.length !== vertices.length) fail('As cores dos vértices não correspondem à malha.'); }
        geometry = { shape: 'mesh', vertices, indices, ...(colors ? { colors } : {}) };
      } else {
        const count = arity[g.shape]; if (!count) fail('A geometria do programa não é reconhecida.');
        const size = list(g.size, count).map((v) => num(v, g.shape === 'cylinder' ? 0 : .005, 200));
        if (size.length !== count || g.shape === 'cylinder' && (size[2] <= 0 || size[0] + size[1] <= 0)) fail('As dimensões da geometria são inválidas.');
        let points: Vec3[] | undefined;
        if (g.shape === 'tube') { points = list(g.points, 64).map((p) => vector(p)); if (points.length < 2) fail('Um tubo precisa de um caminho.'); }
        geometry = { shape: g.shape, size, ...(points ? { points } : {}) };
      }
    } else if (n.geometry !== undefined) fail('Somente malhas definem geometria.');
    let material: ProgramNode['material'];
    if (n.material !== undefined) {
      if (n.kind !== 'mesh') fail('Somente malhas definem material.');
      const m = obj(n.material); only(m, ['roughness', 'metalness', 'opacity', 'emissive', 'emissiveIntensity']);
      material = { roughness: num(m.roughness ?? .85, 0, 1), metalness: num(m.metalness ?? 0, 0, 1), opacity: num(m.opacity ?? 1, .05, 1), emissive: color(m.emissive ?? '#000000'), emissiveIntensity: num(m.emissiveIntensity ?? 0, 0, 3) };
    }
    let repeat: ProgramNode['repeat'];
    if (n.repeat !== undefined) {
      if (n.kind !== 'mesh') fail('Repetição só é permitida para malhas.');
      const p = obj(n.repeat); only(p, ['count', 'step', 'jitter', 'seed']);
      const count = num(p.count, 1, 800), seed = num(p.seed ?? 1, 0, 2147483647);
      if (!Number.isInteger(count) || !Number.isInteger(seed)) fail('Repetição precisa de contagem e semente inteiras.');
      repeat = { count, seed, step: vector(p.step ?? [0, 0, 0]), jitter: vector(p.jitter ?? [0, 0, 0], 0, 200) };
    }
    vertexBudget += (geometry?.vertices ? geometry.vertices.length / 3 : n.kind === 'actor' ? 5000 : n.kind === 'model' ? 40000 : n.kind === 'group' ? 0 : geometry?.shape === 'tube' ? 520 : geometry?.shape === 'lathe' ? (geometry.profile!.length * (geometry.segments! + 1)) : 500) * (repeat?.count ?? 1);
    if (vertexBudget > 250000) fail('A cena excedeu o orçamento de geometria para a prévia.');
    const socket = n.socket ?? 'root'; if (!['root', 'head', ...EFFECTORS].includes(socket)) fail('O encaixe de um objeto não existe.');
    return { id: identifier(n.id), kind: n.kind, ...(n.parent !== undefined ? { parent: identifier(n.parent) } : {}), socket,
      position: vector(n.position ?? [0, 0, 0]), rotation: vector(n.rotation ?? [0, 0, 0], -Math.PI * 2, Math.PI * 2), scale: vector(n.scale ?? [1, 1, 1], .01, 100),
      color: color(n.color ?? '#F0B44B'), evidence, ...(assetId ? { assetId } : {}), ...(geometry ? { geometry } : {}), ...(repeat ? { repeat } : {}), ...(material ? { material } : {}) };
  });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (!nodes.length || nodeMap.size !== nodes.length || nodes.filter((n) => n.kind === 'actor').length > 4) fail('A cena precisa de IDs únicos e no máximo quatro personagens.');
  for (const node of nodes) {
    const visited = new Set([node.id]); let parent = node.parent;
    if (node.socket !== 'root' && (!parent || nodeMap.get(parent)?.kind !== 'actor')) fail('Um encaixe corporal precisa de um personagem pai.');
    while (parent) { if (visited.has(parent) || !nodeMap.has(parent) || visited.size > 16) fail('A hierarquia da cena tem um ciclo, profundidade excessiva ou um pai inexistente.'); visited.add(parent); parent = nodeMap.get(parent)!.parent; }
  }
  let keyBudget = 0;
  const tracks = list(r.tracks, 256).map((value): ProgramTrack => {
    const t = obj(value); only(t, ['node', 'channel', 'interpolation', 'keys']);
    const node = nodeMap.get(t.node) ?? fail('Uma curva citou um objeto inexistente.'); if (!(PROGRAM_CHANNELS as readonly string[]).includes(t.channel)) fail('Uma curva citou uma propriedade inexistente.');
    if (!['position', 'rotation', 'scale'].includes(t.channel) && node.kind !== 'actor') fail('Somente personagens possuem controles corporais.');
    if (!['linear', 'smooth', 'step'].includes(t.interpolation ?? 'smooth')) fail('A interpolação de uma curva é inválida.');
    let previous = -1;
    const keys = list(t.keys, 160).map((value): ProgramKey => {
      const k = obj(value); only(k, ['sourceId', 'phase', 'value']);
      const sourceId = source(k.sourceId), phase = num(k.phase, 0, 1), order = sourceIndex.get(sourceId)! + phase;
      if (order <= previous) fail('Os pontos de uma curva precisam seguir a ordem do roteiro sem tempos duplicados.'); previous = order;
      const bounds = t.channel === 'scale' ? [.01, 100] : t.channel === 'face' ? [-1, 1] : /Rotation|rotation/.test(t.channel) ? [-Math.PI * 2, Math.PI * 2] : [-200, 200];
      return { sourceId, phase, value: vector(k.value, bounds[0], bounds[1]) };
    });
    keyBudget += keys.length; if (keys.length < 2 || keyBudget > 3000) fail('Uma curva precisa de dois pontos e o programa deve caber no orçamento de animação.');
    return { node: node.id, channel: t.channel, interpolation: t.interpolation ?? 'smooth', keys };
  });
  if (!tracks.length || new Set(tracks.map((t) => `${t.node}/${t.channel}`)).size !== tracks.length) fail('Defina movimentos sem duplicar uma curva do mesmo objeto.');
  const maximumScales = new Map(nodes.map((n) => [n.id, Math.max(...n.scale)]));
  for (const t of tracks) if (t.channel === 'scale') maximumScales.set(t.node, Math.max(maximumScales.get(t.node)!, ...t.keys.flatMap((k) => k.value)));
  for (const node of nodes) { let current: ProgramNode | undefined = node, product = 1; while (current) { product *= maximumScales.get(current.id)!; if (product > 1000) fail('A escala acumulada de uma hierarquia excedeu o limite da cena.'); current = current.parent ? nodeMap.get(current.parent) : undefined; } }
  const shots = list(r.shots, 120).map((value): ProgramShot => {
    const s = obj(value); only(s, ['sourceId', 'subjects', 'azimuth', 'endAzimuth', 'elevation', 'distance']);
    const subjects = list(s.subjects, 6).map((v) => nodeMap.has(v) ? v as string : fail('A câmera citou um objeto inexistente.'));
    if (!subjects.length) fail('A câmera precisa acompanhar pelo menos um objeto.');
    return { sourceId: source(s.sourceId), subjects, azimuth: num(s.azimuth ?? .5, -Math.PI * 2, Math.PI * 2), endAzimuth: num(s.endAzimuth ?? s.azimuth ?? .5, -Math.PI * 2, Math.PI * 2), elevation: num(s.elevation ?? .18, -.35, 1.1), distance: num(s.distance ?? 1.15, 1, 2.5) };
  });
  if (shots.length !== sources.length || new Set(shots.map((s) => s.sourceId)).size !== shots.length || sources.some((s) => !shots.some((p) => p.sourceId === s.sourceId))) fail('Cada frase do roteiro precisa da sua própria tomada.');
  const contacts = list(r.contacts ?? [], 100).map((value): ProgramContact => {
    const c = obj(value); only(c, ['sourceId', 'actor', 'effector', 'target', 'offset', 'begin', 'end']);
    if (nodeMap.get(c.actor)?.kind !== 'actor' || !nodeMap.has(c.target) || !(EFFECTORS as readonly string[]).includes(c.effector)) fail('Um contato precisa de personagem, membro e alvo válidos.');
    let target = nodeMap.get(c.target); while (target) { if (target.id === c.actor) fail('Um contato não pode depender do próprio corpo.'); target = target.parent ? nodeMap.get(target.parent) : undefined; }
    const begin = num(c.begin ?? 0, 0, 1), end = num(c.end ?? 1, 0, 1); if (end <= begin) fail('Um contato termina antes de começar.');
    return { sourceId: source(c.sourceId), actor: c.actor, effector: c.effector, target: c.target, offset: vector(c.offset ?? [0, 0, 0]), begin, end };
  });
  for (let i = 0; i < contacts.length; i++) for (let j = i + 1; j < contacts.length; j++) {
    const a = contacts[i], b = contacts[j];
    if (a.sourceId === b.sourceId && a.actor === b.actor && a.effector === b.effector && Math.max(a.begin, b.begin) < Math.min(a.end, b.end)) fail('Um membro recebeu contatos simultâneos incompatíveis.');
  }
  const motionChecks = r.motionChecks === undefined ? undefined : list(r.motionChecks, 60).map((value): ProgramMotionCheck => {
    const check = obj(value);
    only(check, ['sourceId', 'node', 'channel', 'kind', 'startPhase', 'endPhase', 'threshold']);
    const sourceId = source(check.sourceId);
    if (!nodeMap.has(check.node)) fail('Uma verificação de movimento citou um objeto que não existe.');
    if (!['position', 'rotation', 'scale'].includes(check.channel)) fail('A verificação usa um eixo de movimento não permitido.');
    if (!['change', 'hold'].includes(check.kind)) fail('A verificação de movimento precisa indicar mudança ou estabilidade.');
    const startPhase = num(check.startPhase, 0, 1), endPhase = num(check.endPhase, 0, 1);
    if (endPhase - startPhase < .05) fail('A verificação de movimento precisa de uma janela temporal positiva.');
    const threshold = num(check.threshold, .001, 100);
    if (!tracks.some((t) => t.node === check.node && t.channel === check.channel))
      fail('A IA declarou uma ação sem animar a propriedade correspondente.');
    return { sourceId, node: check.node, channel: check.channel, kind: check.kind, startPhase, endPhase, threshold };
  });
  const normalized: SceneProgram = { version: 1, sourceSignature, background: color(r.background ?? '#A7D9ED'), nodes, tracks, shots: sources.map((s) => shots.find((p) => p.sourceId === s.sourceId)!), contacts,
    ...(motionChecks ? { motionChecks } : {}) };
  validateMotionChecks(normalized, sources);
  return normalized;
}

export function compileSceneProgram(program: SceneProgram, sources: ProgramSource[]) {
  let cursor = 0;
  const spans = sources.map((s) => { const duration = Math.max(.1, s.duration ?? 3), span = { sourceId: s.sourceId, start: cursor, duration }; cursor += duration; return span; });
  const at = (key: { sourceId: string; phase: number }) => { const s = spans.find((s) => s.sourceId === key.sourceId)!; return s.start + key.phase * s.duration; };
  const curves = program.tracks.map((t) => ({ ...t, keys: t.keys.map((k) => ({ time: at(k), value: k.value })) }));
  const contacts = program.contacts.map((c) => ({ ...c, start: at({ sourceId: c.sourceId, phase: c.begin }), finish: at({ sourceId: c.sourceId, phase: c.end }) }));
  return { duration: cursor, spans, contacts, sample(time: number) {
    const t = Number.isFinite(time) ? Math.max(0, Math.min(cursor, time)) : 0;
    const states = new Map(program.nodes.map((n): [string, ProgramState] => [n.id, { position: [...n.position], rotation: [...n.rotation], scale: [...n.scale], pose: {} }]));
    for (const curve of curves) {
      let value = curve.keys[0].value;
      for (let i = 1; i < curve.keys.length; i++) {
        const a = curve.keys[i - 1], b = curve.keys[i];
        if (t >= b.time) { value = b.value; continue; }
        const phase = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
        const u = curve.interpolation === 'step' ? 0 : curve.interpolation === 'smooth' ? smooth(phase) : phase;
        value = a.value.map((v, axis) => v + (b.value[axis] - v) * u) as Vec3; break;
      }
      const state = states.get(curve.node)!;
      if (curve.channel === 'position' || curve.channel === 'rotation' || curve.channel === 'scale') state[curve.channel] = [...value];
      else state.pose[curve.channel] = [...value];
    }
    return states;
  }, shot(time: number) { const span = spans.find((s, i) => time < s.start + s.duration || i === spans.length - 1)!; return { span, shot: program.shots.find((s) => s.sourceId === span.sourceId)! }; } };
}

/**
 * Independently evaluates the returned animation, rather than trusting the
 * AI's statement that an action happens. Works for any Three.js object/rig
 * with position, rotation or scale tracks, not only predefined scene types.
 * Runs both in server normalization and client when a saved program loads.
 */
export function validateMotionChecks(program: SceneProgram, sources: ProgramSource[]): void {
  if (!program.motionChecks?.length) return;
  const timeline = compileSceneProgram(program, sources);
  for (const check of program.motionChecks) {
    const span = timeline.spans.find((item) => item.sourceId === check.sourceId);
    if (!span) fail('Uma ação verificável cita uma frase inexistente.');
    const points: Vec3[] = [];
    for (let i = 0; i <= 16; i++) {
      const phase = check.startPhase + (check.endPhase - check.startPhase) * (i / 16);
      const time = span.start + span.duration * phase;
      const state = timeline.sample(time).get(check.node);
      if (!state) fail('Uma ação verificável cita um objeto inexistente.');
      points.push(state[check.channel]);
    }
    // Total travelled path catches rotating parts that return to their
    // starting angle; max displacement catches holds that briefly wander.
    const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const travelled = points.slice(1).reduce((total, point, index) => total + distance(point, points[index]!), 0);
    const wandered = Math.max(...points.map((point) => distance(point, points[0]!)));
    if (check.kind === 'change' && travelled + 1e-7 < check.threshold) {
      throw new SceneProgramError(
        'A animação promete uma ação, mas o objeto não se move o suficiente no momento indicado. Ajuste as curvas antes de exportar.',
        { kind: 'missing_motion', sourceId: check.sourceId, node: check.node, channel: check.channel, expectedMinimum: check.threshold, actual: travelled },
      );
    }
    if (check.kind === 'hold' && wandered > check.threshold + 1e-7) {
      throw new SceneProgramError(
        'Uma peça deveria permanecer parada ou encaixada, mas continua se movendo. Corrija a ordem e a sincronização dos movimentos.',
        { kind: 'motion_during_hold', sourceId: check.sourceId, node: check.node, channel: check.channel, maximumAllowed: check.threshold, actual: wandered },
      );
    }
  }
}
