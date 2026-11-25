/**
 * Semantic plan → complete SceneProgram (the engine's own contract). Deterministic: same plan, same program.
 * The output is NOT trusted either: callers still run normalizeSceneProgram + SceneProgram3D.validateContacts().
 */
import type { ProgramShot, ProgramSource, Vec3 } from "../score";
import { type CameraIdea, type SemanticPlan } from "./plan";
import { buildNodes, makeWorld } from "./world";
import {
  celebrate,
  climb,
  DirectionError,
  Emitter,
  plant,
  restPose,
  stand,
  walkLeg,
  type ClimbStats,
  type Ctx,
  type Pose,
} from "./verbs";

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

const CAMERA: Record<
  CameraIdea,
  { subjects: (hero: string) => string[]; az: [number, number]; el: number; dist: number }
> = {
  follow: { subjects: (h) => [h], az: [0.95, 1.2], el: 0.14, dist: 1.5 },
  close: { subjects: (h) => [h], az: [1.2, 1.0], el: 0.04, dist: 1.05 },
  wide: { subjects: (h) => [h, "wall"], az: [0.75, 0.5], el: 0.1, dist: 1.1 },
  orbit: { subjects: (h) => [h], az: [0.2, 1.5], el: 0.2, dist: 1.5 },
  low: { subjects: (h) => [h], az: [1.1, 0.8], el: -0.22, dist: 1.4 },
};

export function compileSemantic(plan: SemanticPlan, sources: ProgramSource[]) {
  let world = makeWorld(plan.world.height);
  const out = new Emitter(),
    warnings: string[] = [],
    seconds = sources.map(estimateSeconds);
  const hero = "hero",
    verbs = plan.beats.map((b) => b.verb);
  let pose: Pose = restPose([0, 0, 0], Math.PI),
    climbStats: ClimbStats | undefined;
  const hasPole = verbs.includes("plant"),
    shots: ProgramShot[] = [];
  // Consecutive beats with the same verb are ONE continuous action (the engine splits long sentences into chunks).
  const runs: { from: number; to: number }[] = [];
  plan.beats.forEach((beat, i) => {
    const r = runs.at(-1);
    if (r && plan.beats[r.to].verb === beat.verb) r.to = i;
    else runs.push({ from: i, to: i });
  });
  if (runs.filter((r) => plan.beats[r.from].verb === "climb").length > 1)
    throw new DirectionError(
      "Só uma escalada contínua por plano: frases seguidas com o mesmo verbo viram uma única ação.",
    );
  // Wall height is a scene dimension, not narrative: if the climbing sentence is too short for it, shrink the wall (and say so)
  // instead of spending a repair round. Only a sentence too short for ANY wall is rejected by the climb verb.
  const climbRun = runs.find((r) => plan.beats[r.from].verb === "climb");
  if (climbRun) {
    const secs = seconds.slice(climbRun.from, climbRun.to + 1).reduce((t, x) => t + x, 0),
      steps = Math.max(2, Math.round((0.65 * secs) / 0.95)),
      fits = +(0.9 + 0.53 * steps).toFixed(1);
    if (plan.world.height > fits && fits >= 2.4) {
      world = makeWorld(fits);
      warnings.push(
        `Parede reduzida de ${plan.world.height} m para ${fits} m para caber em ${secs.toFixed(1)} s de escalada.`,
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
        plan.beats[0].from === "left"
          ? -dist * 0.33
          : plan.beats[0].from === "right"
            ? dist * 0.33
            : 0,
        0,
        dist,
      ],
      Math.PI,
    );
  }
  for (const run of runs) {
    const beat = plan.beats[run.from],
      idx = Array.from({ length: run.to - run.from + 1 }, (_, k) => run.from + k);
    out.useSpan(
      idx.map((i) => plan.beats[i].sourceId),
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
            `beats[${i}]: andar só funciona no chão; o personagem já está no topo.`,
          );
        if (verbs.slice(0, i).includes("climb"))
          throw new DirectionError(`beats[${i}]: andar depois da escalada não é suportado.`);
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
    for (const k of idx) {
      const cam = CAMERA[plan.beats[k].camera];
      shots.push({
        sourceId: plan.beats[k].sourceId,
        subjects: cam.subjects(hero),
        azimuth: cam.az[0],
        endAzimuth: cam.az[1],
        elevation: cam.el,
        distance: cam.dist,
      });
    }
  }
  if (!verbs.includes("climb") && !hasPole)
    warnings.push("Plano sem escalada: a parede fica só como cenário.");
  const { nodes, background } = buildNodes(
    world,
    plan.world.mood,
    plan.hero.color,
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
  const program = { version: 1, background, nodes, tracks, shots, contacts: out.contacts };
  const report: CompileReport = {
    seconds,
    climb: climbStats,
    warnings,
    trackKeys: tracks.reduce((n, t) => n + t.keys.length, 0),
    nodes: nodes.length,
    contacts: out.contacts.length,
  };
  return { program, report, plan };
}
export type { Vec3 };
