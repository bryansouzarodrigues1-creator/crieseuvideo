/**
 * Independent, read-only action-density audit for SceneProgram.
 *
 * This intentionally ignores the model-authored motionChecks: an AI can omit
 * them or describe only easy movements while leaving the story motionless.
 * This is NOT a semantic validator. Active objects can still move incorrectly.
 * Its findings are observations for the director/visual reviewer, not a reason
 * to silently rewrite a user project.
 */
import { buildProceduralWalk } from './proceduralWalk';
import {
  compileSceneProgram,
  type ProgramChannel,
  type ProgramSource,
  type ProgramState,
  type SceneProgram,
  type Vec3,
} from './score';

export type ActionFinding =
  | { kind: 'no_visible_actuation'; sourceId: string; seconds: number }
  | { kind: 'long_motionless_window'; sourceId: string; from: number; to: number }
  | { kind: 'actor_root_glide'; sourceId: string; actorId: string; metres: number };

export interface BeatActivity {
  sourceId: string;
  start: number;
  duration: number;
  activeSeconds: number;
  longestStillSeconds: number;
  independentlyMovingNodes: string[];
  /** Counts only authored property changes, not camera travel or child inheritance. */
  activeTrackCount: number;
}

export interface ActionDensityReport {
  version: 1;
  sourceCount: number;
  duration: number;
  sampledStepSeconds: number;
  beats: BeatActivity[];
  findings: ActionFinding[];
  limitation: string;
}

const norm = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const valueOf = (s: ProgramState | undefined, channel: ProgramChannel): Vec3 => {
  if (!s) return [0, 0, 0];
  if (channel === 'position' || channel === 'rotation' || channel === 'scale') return s[channel];
  return s.pose[channel] ?? [0, 0, 0];
};

const velocityFloor = (channel: ProgramChannel) =>
  channel === 'position' ? 0.055
    : channel === 'scale' ? 0.055
      : channel === 'face' ? 0.22
        : 0.12;

/** Audits *actual sampled curves*, including rotations over multiple turns.
 * Detection is deliberately conservative and cannot claim that a story was acted.
 */
export function auditSceneActionDensity(
  program: SceneProgram,
  sources: ProgramSource[],
  options: { stepSeconds?: number; idleWarningSeconds?: number } = {},
): ActionDensityReport {
  const score = compileSceneProgram(program, sources);
  const step = Math.max(.05, Math.min(1, options.stepSeconds ?? .25));
  const idleWarning = Math.max(.5, options.idleWarningSeconds ?? 1.5);
  const findings: ActionFinding[] = [];
  const beats: BeatActivity[] = [];
  const proceduralWalkActors = new Set(program.nodes.filter((n) => n.kind === 'actor' &&
    buildProceduralWalk(program, sources, n.id)).map((n) => n.id));

  for (const span of score.spans) {
    const slices = Math.max(1, Math.ceil(span.duration / step));
    const dt = span.duration / slices;
    const nodes = new Set<string>();
    const activeTracks = new Set<string>();
    const travelled = new Map<string, number>();
    let activeSeconds = 0, stillStart: number | null = null, longestStillSeconds = 0;
    let longestWindow: [number, number] | null = null;

    for (let i = 0; i < slices; i++) {
      const a = span.start + i * dt, b = span.start + (i + 1) * dt;
      const before = score.sample(a), after = score.sample(b);
      let moving = false;
      for (const track of program.tracks) {
        const d = norm(
          valueOf(before.get(track.node), track.channel),
          valueOf(after.get(track.node), track.channel),
        );
        const key = track.node + '/' + track.channel;
        travelled.set(key, (travelled.get(key) ?? 0) + d);
        if (d > velocityFloor(track.channel) * dt + 1e-7) {
          moving = true;
          nodes.add(track.node);
          activeTracks.add(key);
        }
      }
      if (moving) {
        activeSeconds += dt;
        if (stillStart !== null) {
          const length = a - stillStart;
          if (length > longestStillSeconds) {
            longestStillSeconds = length;
            longestWindow = [stillStart, a];
          }
          stillStart = null;
        }
      } else if (stillStart === null) stillStart = a;
    }
    if (stillStart !== null) {
      const end = span.start + span.duration, length = end - stillStart;
      if (length > longestStillSeconds) {
        longestStillSeconds = length;
        longestWindow = [stillStart, end];
      }
    }

    beats.push({
      sourceId: span.sourceId, start: span.start, duration: span.duration,
      activeSeconds: Number(activeSeconds.toFixed(3)),
      longestStillSeconds: Number(longestStillSeconds.toFixed(3)),
      independentlyMovingNodes: [...nodes].sort(), activeTrackCount: activeTracks.size,
    });
    if (activeSeconds < Math.min(.1, span.duration * .1))
      findings.push({ kind: 'no_visible_actuation', sourceId: span.sourceId, seconds: span.duration });
    if (longestWindow && longestStillSeconds >= idleWarning)
      findings.push({
        kind: 'long_motionless_window', sourceId: span.sourceId,
        from: Number(longestWindow[0].toFixed(3)),
        to: Number(longestWindow[1].toFixed(3)),
      });
    // Actor root translation is not a walk cycle. Do not mistake a character
    // gliding across the set for walking if neither foot/leg was authored.
    for (const actor of program.nodes.filter((n) => n.kind === 'actor')) {
      const distance = travelled.get(actor.id + '/position') ?? 0;
      const legs = (travelled.get(actor.id + '/leftFoot') ?? 0)
        + (travelled.get(actor.id + '/rightFoot') ?? 0)
        + (travelled.get(actor.id + '/leftFootRotation') ?? 0)
        + (travelled.get(actor.id + '/rightFootRotation') ?? 0);
      if (distance >= .35 && legs < .08 && !proceduralWalkActors.has(actor.id))
        findings.push({
          kind: 'actor_root_glide', sourceId: span.sourceId,
          actorId: actor.id, metres: Number(distance.toFixed(3)),
        });
    }
  }

  return {
    version: 1, sourceCount: sources.length, duration: score.duration,
    sampledStepSeconds: step, beats, findings,
    limitation: 'Motion-based audit only. It cannot verify semantics, visible occlusion, correct object identity, physical safety or artistic quality.',
  };
}
