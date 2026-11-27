/* eslint-disable @typescript-eslint/no-explicit-any -- scene nodes are the engine's untyped JSON; normalizeSceneProgram is the security boundary */
/**
 * Actor choreography as part of a Direction.
 *
 * The cast+verbs compiler handles objects, GLB parts, camera and simple poses. A hero that WALKS and CLIMBS needs more:
 * an alternating gait, hands and feet that land on real holds, IK reach and contact windows. Those curves come from the
 * measured-body verbs in `direct/verbs.ts`; this module runs them for a Direction scene by scene and returns tracks,
 * contacts and world nodes for `compileDirection` to merge. It is not a second compiler: nothing is emitted here that
 * the direction compiler does not own and validate afterwards.
 */
import type { ProgramContact, ProgramSource, ProgramTrack } from "../score";
import { buildNodes, makeWorld } from "../direct/world";
import type { Mood } from "../direct/plan";
import {
  celebrate,
  climb,
  Emitter,
  plant,
  restPose,
  stand,
  walkLeg,
  type ClimbStats,
  type Ctx,
  type Pose,
} from "../direct/verbs";
import { DirectionError } from "./errors";

export const LOCOMOTION_VERBS = ["walk", "climb", "plant", "celebrate", "stand"] as const;
export type LocomotionVerb = (typeof LOCOMOTION_VERBS)[number];
export const isLocomotion = (v: string): v is LocomotionVerb =>
  (LOCOMOTION_VERBS as readonly string[]).includes(v);
export interface CliffWorld {
  kind: "cliff";
  /** metres of vertical wall the hero has to climb (2.4 to 4.5) */
  height: number;
  mood: Mood;
}
export interface Beat {
  sourceId: string;
  verb: LocomotionVerb;
  from?: "left" | "right" | "front";
}
export interface CompileReport {
  seconds: number[];
  climb?: ClimbStats;
  warnings: string[];
  trackKeys: number;
  nodes: number;
  contacts: number;
}
/** ~2.6 spoken words per second when the audio duration is not known yet. */
export const estimateSeconds = (s: ProgramSource) =>
  s.duration ?? Math.max(2, s.text.trim().split(/\s+/).length / 2.6);

export interface Choreography {
  /** world + hero nodes (the hero node already carries its color) */
  nodes: any[];
  tracks: ProgramTrack[];
  contacts: ProgramContact[];
  background: string;
  climb?: ClimbStats;
  warnings: string[];
  seconds: number[];
  /** `node|channel` ids owned by the choreography: no other verb may write them */
  owned: Set<string>;
}

export function choreograph(
  world0: CliffWorld,
  heroColor: string,
  beats: Beat[],
  sources: ProgramSource[],
): Choreography {
  let world = makeWorld(world0.height);
  const out = new Emitter(),
    warnings: string[] = [],
    seconds = sources.map(estimateSeconds);
  const hero = "hero",
    verbs = beats.map((b) => b.verb);
  let pose: Pose = restPose([0, 0, 0], Math.PI),
    climbStats: ClimbStats | undefined;
  const hasPole = verbs.includes("plant");
  // Consecutive beats with the same verb are ONE continuous action (the engine splits long sentences into chunks).
  const runs: { from: number; to: number }[] = [];
  beats.forEach((beat, i) => {
    const r = runs.at(-1);
    if (r && beats[r.to].verb === beat.verb) r.to = i;
    else runs.push({ from: i, to: i });
  });
  if (runs.filter((r) => beats[r.from].verb === "climb").length > 1)
    throw new DirectionError(
      "Só uma escalada contínua por plano: frases seguidas com o mesmo verbo viram uma única ação.",
    );
  // Wall height is a scene dimension, not narrative: if the climbing sentence is too short for it, shrink the wall (and say so)
  // instead of spending a repair round. Only a sentence too short for ANY wall is rejected by the climb verb.
  const climbRun = runs.find((r) => beats[r.from].verb === "climb");
  if (climbRun) {
    const secs = seconds.slice(climbRun.from, climbRun.to + 1).reduce((t, x) => t + x, 0),
      steps = Math.max(2, Math.round((0.65 * secs) / 0.95)),
      fits = +(0.9 + 0.53 * steps).toFixed(1);
    if (world0.height > fits && fits >= 2.4) {
      world = makeWorld(fits);
      warnings.push(
        `Parede reduzida de ${world0.height} m para ${fits} m para caber em ${secs.toFixed(1)} s de escalada.`,
      );
    }
  }
  if (verbs[0] === "walk") {
    // Approach distance follows the time the sentence gives: a short sentence starts closer instead of making the hero run.
    const first = runs[0],
      secs = seconds.slice(first.from, first.to + 1).reduce((t, x) => t + x, 0),
      dist = Math.min(5.2, Math.max(1.2, 1.4 * secs * 0.8));
    pose = restPose(
      [
        beats[0].from === "left" ? -dist * 0.33 : beats[0].from === "right" ? dist * 0.33 : 0,
        0,
        dist,
      ],
      Math.PI,
    );
  }
  for (const run of runs) {
    const beat = beats[run.from],
      idx = Array.from({ length: run.to - run.from + 1 }, (_, k) => run.from + k);
    out.useSpan(
      idx.map((i) => beats[i].sourceId),
      idx.map((i) => seconds[i]),
    );
    const c: Ctx = {
      out,
      world,
      hero,
      sourceId: beat.sourceId,
      seconds: idx.reduce((t, i) => t + seconds[i], 0),
      first: run.from === 0,
      pose,
    };
    const i = run.from;
    switch (beat.verb) {
      case "walk": {
        if (pose.pos[1] > 0.01)
          throw new DirectionError(
            `cena ${beat.sourceId}: andar só funciona no chão; o personagem já está no topo.`,
          );
        if (verbs.slice(0, i).includes("climb"))
          throw new DirectionError(
            `cena ${beat.sourceId}: andar depois da escalada não é suportado.`,
          );
        walkLeg(c, [0, 0, 0], 0, 0.8, Math.PI);
        stand(c, 0.9, 1);
        break;
      }
      case "climb":
        climbStats = climb(c);
        break;
      case "plant":
        plant(c, "pole", "flag");
        break;
      case "celebrate":
        celebrate(c);
        break;
      case "stand":
        stand(c);
        break;
    }
    pose = c.pose;
  }
  const { nodes, background } = buildNodes(
    world,
    world0.mood,
    heroColor,
    climbStats?.ladders,
    sources
      .map((s) => s.text)
      .join(" ")
      .slice(0, 280),
    hasPole,
  );
  // snow keeps falling through the whole film
  const first = sources[0].sourceId,
    last = sources.at(-1)!.sourceId;
  out.useSpan(
    sources.map((x) => x.sourceId),
    seconds,
  );
  out.key("snowfall", "position", first, 0, [0, 6, 2]);
  out.key("snowfall", "position", last, 1, [0.8, 1.2, 2]);
  const tracks = [...out.tracks.values()];
  return {
    nodes,
    tracks,
    contacts: out.contacts,
    background,
    climb: climbStats,
    warnings,
    seconds,
    owned: new Set(tracks.map((t) => `${t.node}|${t.channel}`)),
  };
}
