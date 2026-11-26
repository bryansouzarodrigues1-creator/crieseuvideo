/**
 * Direction → SceneProgram: the authoring method as DATA.
 *
 * A direction is a cast (what exists, where, hidden or not) plus, per narration source, a camera
 * and a list of verbs with a time window inside that source ([from, to] as phases 0..1).
 * This compiler owns every convention that used to be written by hand:
 *  - a verb never leaves a gap: before each move it writes a HOLD key with the previous value;
 *  - hiding is scale 0.01 (the engine has no visibility channel), appearing grows back to the cast scale;
 *  - wheels roll by distance / radius (+X turns a wheel forward along +Z); doors and wheels are GLB parts;
 *  - a rolling disc turns about its CENTER (the node origin is at its base), so it uses dense linear keys;
 *  - poses come from a small catalogue and are resolved to world targets from the actor's transform;
 *  - every real movement also yields a motion check, so a promised action that does not move fails fast.
 * Output goes through normalizeSceneProgram, which stays the only security boundary.
 * The shape is plain JSON on purpose: an LLM can write it instead of raw tracks.
 */
import { normalizeSceneProgram, SceneProgramError, type ProgramSource, type SceneProgram, type Vec3 } from '../score';
import { EMOTIONS, POSE_NAMES, faceFor, handTargets, type Emotion, type PoseName } from './poses';
import { DirectionError } from './errors';
import { choreograph, isLocomotion, type Beat, type CliffWorld, type CompileReport, type LocomotionVerb } from './locomotion';

export { DirectionError };
export type { CliffWorld, CompileReport, LocomotionVerb };

export type Window = readonly [number, number];
export type Axis = 'x' | 'y' | 'z';
export type CastMember = {
  id: string; kind: 'model' | 'mesh' | 'actor' | 'group';
  /** Starts invisible (scale 0.01); an `appear` verb grows it to `scale` (default 1). */
  hidden?: boolean;
} & Record<string, unknown>;

export type Verb =
  | { do: 'appear' | 'vanish'; node: string; at?: Window }
  | { do: 'move'; node: string; to?: Vec3; by?: Vec3; at?: Window }
  | { do: 'scale'; node: string; to: Vec3; at?: Window }
  | { do: 'turn'; node: string; to: Vec3; at?: Window }
  /** Rotates a named GLB part to an absolute angle (radians) about one axis. open = rotatePart, close = back to 0. */
  | { do: 'rotatePart'; node: string; part: string; axis: Axis; to: number; at?: Window }
  | { do: 'open'; node: string; part: string; axis: Axis; angle: number; at?: Window }
  | { do: 'close'; node: string; part: string; axis: Axis; at?: Window }
  | { do: 'spin'; node: string; part: string; axis: Axis; turns: number; at?: Window }
  /** Drives the node by a vector ALONG ITS FORWARD (+Z rotated by its yaw) and rolls its wheel parts by distance / radius. Sideways vectors are rejected. Linear. */
  | { do: 'drive'; node: string; by: Vec3; wheels: string[]; wheelRadius: number; at?: Window }
  /** Rolls an upright disc along +X by `dx`; `centerY` is the disc center height above the node origin. Linear. */
  | { do: 'roll'; node: string; dx: number; radius: number; centerY: number; at?: Window }
  /** Sets the height of a unit-height box that grows from its base (bars). The cast position.y is the base. */
  | { do: 'rise'; node: string; height: number; at?: Window }
  | { do: 'pose'; node: string; pose: PoseName; emotion?: Emotion; at?: Window }
  /**
   * Actor choreography on the cliff world (needs `world`): the verb is the WHOLE sentence. The body, gait, holds and
   * contact windows are computed from the measured actor, so no coordinates are written. Only the cast member "hero".
   */
  | ActorVerb;
export type ActorVerb = { do: LocomotionVerb; node: string; from?: 'left' | 'right' | 'front' };
const isActorVerb = (v: Verb): v is ActorVerb => isLocomotion(v.do);

export interface SceneDirection {
  sourceId: string;
  shot: { subjects: string[]; azimuth: number; endAzimuth?: number; elevation: number; distance: number };
  verbs: Verb[];
}
export interface Direction {
  version: 1; background: string; cast: CastMember[]; scenes: SceneDirection[];
  /** Optional world built from the engine's own measurements; required by the actor verbs (walk, climb, plant, celebrate, stand). */
  world?: CliffWorld;
}

const HID: Vec3 = [.01, .01, .01], ONE: Vec3 = [1, 1, 1], ZERO: Vec3 = [0, 0, 0];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const axisVec = (axis: Axis, angle: number): Vec3 => axis === 'x' ? [angle, 0, 0] : axis === 'y' ? [0, angle, 0] : [0, 0, angle];
const axisOf = (v: Vec3, axis: Axis) => v[axis === 'x' ? 0 : axis === 'y' ? 1 : 2];

interface Track {
  node: string; channel: string; part?: string; interpolation: 'smooth' | 'linear';
  keys: { sourceId: string; phase: number; value: Vec3 }[]; current: Vec3; lastOrder: number;
}
interface Check { sourceId: string; node: string; channel: 'position' | 'rotation' | 'scale'; part?: string; startPhase: number; endPhase: number; threshold: number }

export function compileDirection(direction: Direction, sources: ProgramSource[]): SceneProgram {
  return compileDirectionDetailed(direction, sources).program;
}

export function compileDirectionDetailed(direction: Direction, sources: ProgramSource[]): { program: SceneProgram; report: CompileReport } {
  if (direction.version !== 1) throw new DirectionError('Versão de direção desconhecida.');
  if (direction.scenes.length !== sources.length || direction.scenes.some((s, i) => s.sourceId !== sources[i].sourceId))
    throw new DirectionError('A direção precisa ter exatamente uma cena por frase do roteiro, na mesma ordem.');

  const cast = new Map<string, CastMember>();
  for (const member of direction.cast) {
    if (cast.has(member.id)) throw new DirectionError(`O elenco repete "${member.id}".`);
    cast.set(member.id, member);
  }
  const first = sources[0].sourceId;

  // Actor choreography: the hero's verbs are expanded into tracks/contacts/world nodes by the measured-body verbs.
  const usesActorVerbs = direction.scenes.some((sc) => sc.verbs.some(isActorVerb));
  let choreo: ReturnType<typeof choreograph> | undefined;
  if (usesActorVerbs && !direction.world) throw new DirectionError('Os verbos de ator (walk, climb, plant, celebrate, stand) exigem "world".');
  if (direction.world) {
    const hero = cast.get('hero');
    if (!hero || hero.kind !== 'actor' || typeof hero.color !== 'string')
      throw new DirectionError('Com "world", o elenco precisa de um ator "hero" com color #RRGGBB.');
    const beats: Beat[] = direction.scenes.map((scene) => {
      const own = scene.verbs.filter(isActorVerb);
      if (own.length > 1) throw new DirectionError(`A cena ${scene.sourceId} tem ${own.length} verbos de ator; use um só por frase.`);
      const verb = own[0];
      if (verb && verb.node !== 'hero') throw new DirectionError(`Verbos de ator só valem para "hero" (cena ${scene.sourceId}).`);
      return { sourceId: scene.sourceId, verb: verb?.do ?? 'stand', ...(verb?.from ? { from: verb.from } : {}) };
    });
    choreo = choreograph(direction.world, hero.color, beats, sources);
  }
  const worldIds = new Set((choreo?.nodes ?? []).map((n) => n.id as string));
  const castNodes = direction.cast.filter((m) => !choreo || m.id !== 'hero').map(({ hidden, ...rest }) => {
    if (worldIds.has(rest.id)) throw new DirectionError(`O elenco usa "${rest.id}", nome reservado pelo mundo (${[...worldIds].slice(0, 6).join(', ')}…).`);
    return { contextSourceId: first, ...rest, ...(hidden ? { scale: HID } : {}) };
  });
  const nodes: Record<string, unknown>[] = [...(choreo?.nodes ?? []), ...castNodes];
  const visibleScale = (m: CastMember): Vec3 => (m.scale as Vec3 | undefined) ?? ONE;
  const startOf = (m: CastMember, channel: 'position' | 'rotation' | 'scale'): Vec3 =>
    channel === 'scale' ? (m.hidden ? HID : visibleScale(m)) : ((m[channel] as Vec3 | undefined) ?? ZERO);

  const tracks = new Map<string, Track>();
  const checks: Check[] = [];
  const member = (id: string) => cast.get(id) ?? (() => { throw new DirectionError(`Verbo cita "${id}", que não está no elenco.`); })();

  const track = (node: string, channel: string, part: string | undefined, interpolation: 'smooth' | 'linear', initial: Vec3): Track => {
    const key = `${node}|${channel}|${part ?? ''}`;
    let t = tracks.get(key);
    if (choreo?.owned.has(`${node}|${channel}`))
      throw new DirectionError(`"${node}" (${channel}) já é controlado pelos verbos de ator; não combine com outros verbos nessa propriedade.`);
    if (!t) { t = { node, channel, ...(part ? { part } : {}), interpolation, keys: [], current: initial, lastOrder: -1 }; tracks.set(key, t); }
    else if (t.interpolation !== interpolation)
      throw new DirectionError(`"${node}" mistura movimento suave e linear na mesma propriedade (${channel}${part ? '/' + part : ''}).`);
    return t;
  };
  const push = (t: Track, sourceId: string, order: number, phase: number, value: Vec3) => {
    t.keys.push({ sourceId, phase, value }); t.lastOrder = order;
  };
  /** One verb on one track: hold the previous value until `from`, then reach `target` at `to`. */
  const animate = (t: Track, sourceId: string, index: number, [from, to]: Window, target: Vec3, check: boolean) => {
    const a = index + from, b = index + to;
    if (a < t.lastOrder - 1e-9) throw new DirectionError(`Verbos sobrepostos em "${t.node}" (${t.channel}${t.part ? '/' + t.part : ''}) na cena ${sourceId}.`);
    if (a > t.lastOrder + 1e-9) push(t, sourceId, a, from, t.current);
    push(t, sourceId, b, to, target);
    const delta = dist(t.current, target);
    if (check && delta >= .1 && to - from >= .05 && ['position', 'rotation', 'scale'].includes(t.channel))
      checks.push({ sourceId, node: t.node, channel: t.channel as Check['channel'], ...(t.part ? { part: t.part } : {}),
        startPhase: from, endPhase: to, threshold: Math.max(.05, .5 * delta) });
    t.current = target;
  };

  const shots = direction.scenes.map((scene) => ({
    sourceId: scene.sourceId, subjects: scene.shot.subjects, azimuth: scene.shot.azimuth,
    endAzimuth: scene.shot.endAzimuth ?? scene.shot.azimuth, elevation: scene.shot.elevation, distance: scene.shot.distance,
  }));

  direction.scenes.forEach((scene, index) => {
    const { sourceId } = scene;
    for (const verb of scene.verbs) {
      if (isActorVerb(verb)) continue; // expanded by the choreography above
      const at: Window = verb.at ?? [0, 1];
      if (!(at[0] >= 0 && at[1] <= 1 && at[1] - at[0] >= .01)) throw new DirectionError(`Janela inválida em "${verb.node}" (${sourceId}).`);
      const m = member(verb.node);
      const prop = (channel: 'position' | 'rotation' | 'scale', interp: 'smooth' | 'linear' = 'smooth') => track(m.id, channel, undefined, interp, startOf(m, channel));
      const part = (name: string) => track(m.id, 'rotation', name, 'smooth', ZERO);
      switch (verb.do) {
        case 'appear': animate(prop('scale'), sourceId, index, at, visibleScale(m), true); break;
        case 'vanish': animate(prop('scale'), sourceId, index, at, HID, true); break;
        case 'scale': animate(prop('scale'), sourceId, index, at, verb.to, true); break;
        case 'turn': animate(prop('rotation'), sourceId, index, at, verb.to, true); break;
        case 'move': {
          const t = prop('position');
          const target = verb.to ?? (verb.by ? add(t.current, verb.by) : undefined);
          if (!target) throw new DirectionError(`"move" de "${m.id}" precisa de to ou by.`);
          animate(t, sourceId, index, at, target, true); break;
        }
        case 'rotatePart': case 'open': case 'close': case 'spin': {
          const t = part(verb.part);
          const angle = verb.do === 'rotatePart' ? verb.to : verb.do === 'open' ? verb.angle : verb.do === 'close' ? 0 : axisOf(t.current, verb.axis) + verb.turns * Math.PI * 2;
          animate(t, sourceId, index, at, axisVec(verb.axis, angle), true); break;
        }
        case 'drive': {
          const t = prop('position', 'linear');
          const target = add(t.current, verb.by);
          if (!(verb.wheelRadius > 0)) throw new DirectionError(`"drive" de "${m.id}" precisa de wheelRadius positivo.`);
          // Wheels roll about local X for motion along the vehicle's FORWARD (+Z rotated by its current yaw).
          // A sideways drive would slide the wheels, so it is rejected instead of animated wrongly.
          const yaw = (tracks.get(`${m.id}|rotation|`)?.current ?? (m.rotation as Vec3 | undefined) ?? ZERO)[1];
          const fx = Math.sin(yaw), fz = Math.cos(yaw);
          const along = verb.by[0] * fx + verb.by[2] * fz, side = verb.by[0] * fz - verb.by[2] * fx;
          if (Math.abs(side) > Math.max(.05, .05 * Math.abs(along)))
            throw new DirectionError(`"${m.id}" não pode andar de lado: vire o veículo (turn) antes de dirigir.`);
          for (const w of verb.wheels) { const wt = track(m.id, 'rotation', w, 'linear', ZERO); animate(wt, sourceId, index, at, [wt.current[0] + along / verb.wheelRadius, 0, 0], w === verb.wheels[0]); }
          animate(t, sourceId, index, at, target, true); break;
        }
        case 'roll': {
          const p = prop('position', 'linear'), r = prop('rotation', 'linear');
          const [x0, , z0] = p.current, steps = 36, c = verb.centerY;
          const base = index + at[0];
          if (base < Math.max(p.lastOrder, r.lastOrder) - 1e-9) throw new DirectionError(`Verbos sobrepostos em "${m.id}" (roll) na cena ${sourceId}.`);
          for (const t of [p, r]) if (base > t.lastOrder + 1e-9) push(t, sourceId, base, at[0], t.current);
          let endPos: Vec3 = p.current, endRot: Vec3 = r.current;
          for (let j = 1; j <= steps; j++) {
            const u = j / steps, theta = -(verb.dx / verb.radius) * u, phase = at[0] + (at[1] - at[0]) * u, order = index + phase;
            endPos = [x0 + verb.dx * u + c * Math.sin(theta), c - c * Math.cos(theta), z0]; endRot = [0, 0, theta];
            push(p, sourceId, order, phase, endPos);
            push(r, sourceId, order, phase, endRot);
          }
          checks.push({ sourceId, node: m.id, channel: 'position', startPhase: at[0], endPhase: at[1], threshold: Math.max(.05, .5 * Math.abs(verb.dx)) });
          p.current = endPos; r.current = endRot;
          break;
        }
        case 'rise': {
          const pos = m.position as Vec3 | undefined, base = pos?.[1] ?? 0, s = visibleScale(m);
          if (!pos) throw new DirectionError(`"rise" de "${m.id}" precisa de position no elenco.`);
          animate(prop('scale'), sourceId, index, at, [s[0], verb.height, s[2]], true);
          animate(prop('position'), sourceId, index, at, [pos[0], base + verb.height / 2, pos[2]], false); break;
        }
        case 'pose': {
          if (m.kind !== 'actor') throw new DirectionError(`"pose" só vale para atores ("${m.id}").`);
          if (!POSE_NAMES.includes(verb.pose)) throw new DirectionError(`Pose desconhecida: ${verb.pose}.`);
          if (verb.emotion !== undefined && !EMOTIONS.includes(verb.emotion)) throw new DirectionError(`Emoção desconhecida: ${verb.emotion}.`);
          const pos = (m.position as Vec3 | undefined) ?? ZERO, yaw = ((m.rotation as Vec3 | undefined) ?? ZERO)[1];
          const rest = handTargets('rest', pos, yaw), goal = handTargets(verb.pose, pos, yaw);
          animate(track(m.id, 'leftHand', undefined, 'smooth', rest.left), sourceId, index, at, goal.left, false);
          animate(track(m.id, 'rightHand', undefined, 'smooth', rest.right), sourceId, index, at, goal.right, false);
          animate(track(m.id, 'face', undefined, 'smooth', faceFor('neutral')), sourceId, index, at, faceFor(verb.emotion ?? 'neutral'), false);
          break;
        }
        default: throw new DirectionError('Verbo desconhecido.');
      }
    }
  });

  // The engine accepts at most 60 checks: keep the ones with the largest promised movement.
  const motionChecks = [...checks].sort((x, y) => y.threshold - x.threshold).slice(0, 60).map((c) => ({ ...c, kind: 'change' as const }));
  try {
    const program = normalizeSceneProgram({
      version: 1, background: choreo?.background ?? direction.background, nodes,
      tracks: [...(choreo?.tracks ?? []), ...[...tracks.values()].map(({ current: _c, lastOrder: _l, ...t }) => t)],
      shots, contacts: choreo?.contacts ?? [], motionChecks,
    }, sources);
    const keys = program.tracks.reduce((n, t) => n + t.keys.length, 0);
    return { program, report: {
      seconds: choreo?.seconds ?? sources.map((src) => src.duration ?? 0), climb: choreo?.climb, warnings: choreo?.warnings ?? [],
      trackKeys: keys, nodes: program.nodes.length, contacts: program.contacts.length,
    } };
  } catch (error) {
    if (error instanceof SceneProgramError) throw new DirectionError('A direção gerou um programa inválido: ' + error.message);
    throw error;
  }
}
