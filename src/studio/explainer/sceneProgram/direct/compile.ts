/**
 * Compact semantic plan → SceneProgram. This is NOT a second compiler: the plan is rewritten as a Direction (cast + one
 * actor verb per sentence + a camera) and `compileDirection` — the same compiler the cast+verbs videos use — does the work.
 * Deterministic: same plan, same program. The output is still not trusted: callers run normalizeSceneProgram + SceneProgram3D.validateContacts().
 */
import { compileDirectionDetailed, type Direction } from "../direction/direction";
import type { ProgramSource, Vec3 } from "../score";
import { type CameraIdea, type SemanticPlan } from "./plan";
export { estimateSeconds, type CompileReport } from "../direction/locomotion";

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

/** The compact plan written out as the full Direction it stands for. */
export function semanticToDirection(plan: SemanticPlan): Direction {
  return {
    version: 1,
    background: "#BCD9EA", // replaced by the world's sky
    world: { kind: "cliff", height: plan.world.height, mood: plan.world.mood },
    cast: [{ id: "hero", kind: "actor", color: plan.hero.color }],
    scenes: plan.beats.map((b) => {
      const cam = CAMERA[b.camera];
      return {
        sourceId: b.sourceId,
        shot: {
          subjects: cam.subjects("hero"),
          azimuth: cam.az[0],
          endAzimuth: cam.az[1],
          elevation: cam.el,
          distance: cam.dist,
        },
        verbs: [{ do: b.verb, node: "hero", ...(b.from ? { from: b.from } : {}) }],
      };
    }),
  };
}

export function compileSemantic(plan: SemanticPlan, sources: ProgramSource[]) {
  const { program, report } = compileDirectionDetailed(semanticToDirection(plan), sources);
  return { program, report, plan };
}
export type { Vec3 };
