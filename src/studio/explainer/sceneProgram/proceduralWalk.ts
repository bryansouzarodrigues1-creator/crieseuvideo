/**
 * Flat-ground, path-distance-driven procedural gait for SceneProgram actors.
 *
 * The director supplies an actor's translation. This module computes facing,
 * alternating foot plants with world-stable stance phases and arms as DATA.
 * No walking animation preset, network request, runtime evaluator, or timeline
 * state is required. Sampling t=7, t=1, t=7 must return the same pose.
 *
 * Conservative fallback: never override authored feet, authored root rotation,
 * actor contacts, climbing/vertical travel, or tiny repositioning. More advanced
 * terrain locomotion and true balance/physics require a different solver.
 */
import { compileSceneProgram, type ProgramSource, type SceneProgram, type Vec3 } from './score';

export interface ProceduralWalkFrame {
  heading: number;
  speed: number;
  bob: number;
  lean: number;
  /** Pelvis transfers a little weight to the supporting leg, in local X. */
  weightShift: number;
  /** Opposite rotation of the upper torso and subtle head counter-motion. */
  torsoTwist: number;
  headCounter: number;
  leftFootRoll: number;
  rightFootRoll: number;
  leftFoot: Vec3;
  rightFoot: Vec3;
  leftHand: Vec3;  // actor-root LOCAL (ready to be transformed by root matrix)
  rightHand: Vec3;
}
export interface ProceduralWalk {
  actorId: string;
  totalDistance: number;
  at(time: number): ProceduralWalkFrame;
}

interface Sample { time: number; position: Vec3; distance: number }
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const u = clamp(n, 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const mix = (a: Vec3, b: Vec3, t: number): Vec3 =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const horizontal = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function search(data: Sample[], value: number, field: 'time' | 'distance') {
  let lo = 0, hi = data.length - 1;
  while (lo + 1 < hi) {
    const m = (lo + hi) >>> 1;
    if (data[m]![field] <= value) lo = m;
    else hi = m;
  }
  const a = data[lo]!, b = data[hi]!;
  const u = b[field] - a[field] > 1e-9 ? clamp((value - a[field]) / (b[field] - a[field]), 0, 1) : 0;
  return { pos: mix(a.position, b.position, u), arc: lerp(a.distance, b.distance, u) };
}

export function buildProceduralWalk(
  program: SceneProgram, sources: ProgramSource[], actorId: string,
): ProceduralWalk | undefined {
  const actor = program.nodes.find((n) => n.kind === 'actor' && n.id === actorId);
  if (!actor || !program.tracks.some((t) => t.node === actorId && t.channel === 'position')) return;
  // An animator's explicit choices win over the procedural fallback.
  if (program.tracks.some((t) => t.node === actorId &&
    ['leftFoot', 'rightFoot', 'leftFootRotation', 'rightFootRotation', 'rotation'].includes(t.channel))) return;
  if (program.contacts.some((c) => c.actor === actorId)) return;
  // A hand carrying a tool or bag must not swing through the body as though free.
  const holdingLeft = program.nodes.some((n) => n.parent === actorId && n.socket === 'leftHand');
  const holdingRight = program.nodes.some((n) => n.parent === actorId && n.socket === 'rightHand');

  const score = compileSceneProgram(program, sources);
  const steps = Math.max(2, Math.min(2400, Math.ceil(score.duration / .09)));
  const samples: Sample[] = [];
  let distance = 0, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const time = score.duration * i / steps;
    const position = score.sample(time).get(actorId)!.position;
    minY = Math.min(minY, position[1]); maxY = Math.max(maxY, position[1]);
    if (samples.length) distance += horizontal(position, samples.at(-1)!.position);
    samples.push({ time, position, distance });
  }
  // A jump or climb must remain under authored IK and contacts.
  if (distance < .3 || maxY - minY > .12) return;
  const groundY = samples[0]!.position[1];
  const positionAtArc = (s: number) => search(samples, clamp(s, 0, distance), 'distance').pos;
  const distanceAtTime = (t: number) =>
    search(samples, clamp(t, 0, score.duration), 'time').arc;
  const headingAt = (s: number) => {
    const a = positionAtArc(Math.max(0, s - .15));
    const b = positionAtArc(Math.min(distance, s + .15));
    return Math.atan2(b[0] - a[0], b[2] - a[2]); // actor +Z points forward
  };
  const plant = (s: number, side: -1 | 1): Vec3 => {
    const p = positionAtArc(s), angle = headingAt(s);
    // right axis of local +Z is [+cos(yaw), -sin(yaw)] in parent space
    return [p[0] + side * .17 * Math.cos(angle),
      groundY + .15,
      p[2] - side * .17 * Math.sin(angle)];
  };

  // Each foot stays planted while the opposite foot steps. A complete step
  // moves between TWO parent-space anchors and lifts only during the swing.
  const feet = (s: number, side: -1 | 1): Vec3 => {
    let anchored = plant(0, side);
    const first = side === -1 ? .025 : .275;
    for (let start = first; start < distance; start += .50) {
      const end = start + .19;
      if (end > distance - .015) break; // no stranded foot in mid-air at stop
      const next = plant(Math.min(end + .07, distance), side);
      if (s < start) break;
      if (s < end) {
        const phase = (s - start) / (end - start);
        const pos = mix(anchored, next, smooth(phase));
        pos[1] += Math.sin(Math.PI * phase) * .15;
        return pos;
      }
      anchored = next;
    }
    return anchored;
  };

  // A small toe-off / heel-down rotation helps the shoe read as a step.
  // A final, stationary foot is neutral to avoid an eternal raised heel.
  const footRoll = (s: number, side: -1 | 1): number => {
    const first = side === -1 ? .025 : .275;
    if (s < first || s >= distance - .025) return 0;
    const cycle = (s - first) % .50;
    if (cycle < .19) return lerp(.095, -.07, smooth(cycle / .19));
    if (cycle < .31) return -.07 * (1 - smooth((cycle - .19) / .12));
    if (cycle > .44) return .095 * smooth((cycle - .44) / .06);
    return 0;
  };

  return {
    actorId,
    totalDistance: distance,
    at(time: number): ProceduralWalkFrame {
      const arc = distanceAtTime(time);
      const lo = Math.max(0, time - .14), hi = Math.min(score.duration, time + .14);
      const speed = (distanceAtTime(hi) - distanceAtTime(lo)) / Math.max(.001, hi - lo);
      const effort = smooth(speed / .28);
      const cycle = arc / .50 * Math.PI * 2;
      return {
        heading: headingAt(arc), speed,
        bob: .016 * effort * Math.sin(cycle * 2),
        lean: .016 * effort * Math.sin(cycle),
        weightShift: .015 * effort * Math.sin(cycle),
        torsoTwist: .055 * effort * Math.sin(cycle + .2),
        headCounter: -.035 * effort * Math.sin(cycle + .2),
        leftFootRoll: footRoll(arc, -1) * effort,
        rightFootRoll: footRoll(arc, 1) * effort,
        leftFoot: feet(arc, -1), rightFoot: feet(arc, 1),
        leftHand: [-.45, .85, holdingLeft ? .02 : .035 + .145 * effort * Math.sin(cycle + Math.PI)],
        rightHand: [.45, .85, holdingRight ? .02 : .035 + .145 * effort * Math.sin(cycle)],
      };
    },
  };
}
