/* eslint-disable @typescript-eslint/no-explicit-any -- reads a private counter of the stage */
import { describe, expect, it } from "vitest";
import { compileDirection, type Direction } from "./direction";
import { normalizeSceneProgram, type ProgramSource } from "../score";
import { SceneProgram3D } from "../stage3d";

const sources: ProgramSource[] = [
  { sourceId: "s1", text: "A rua vazia.", duration: 4 },
  { sourceId: "s2", text: "O gerente aparece e fica surpreso.", duration: 6 },
];
const direction = (hand: "rest" | "surprised" | "head" | "shrug"): Direction => ({
  version: 1,
  background: "#EEF1F5",
  cast: [
    { id: "chao", kind: "mesh", geometry: { shape: "box", size: [40, 0.2, 40] }, position: [0, -0.1, 0], color: "#C9D6DF" },
    { id: "gerente", kind: "actor", color: "#1E3A8A", position: [1, 0, 3], hidden: true },
  ],
  scenes: [
    { sourceId: "s1", shot: { subjects: ["chao"], azimuth: 0.3, elevation: 0.18, distance: 1.2 }, verbs: [] },
    {
      sourceId: "s2",
      shot: { subjects: ["gerente"], azimuth: 0.2, elevation: 0.15, distance: 1.2 },
      verbs: [
        { do: "appear", node: "gerente", at: [0, 0.4] },
        { do: "pose", node: "gerente", pose: hand, emotion: "surprised", at: [0.1, 0.8] },
      ],
    },
  ],
});

describe("an actor that starts hidden and appears", () => {
  for (const pose of ["rest", "surprised", "head", "shrug"] as const) {
    it(`never fails the body-reach check on any exported frame (pose ${pose})`, () => {
      const program = normalizeSceneProgram(compileDirection(direction(pose), sources), sources);
      const stage = new SceneProgram3D(program, sources, new Map());
      try {
        let worst = 0;
        for (let t = 0; t <= 10; t += 1 / 12) {
          stage.update(t);
          worst = Math.max(worst, (stage as any).maxIKError);
        }
        expect(worst).toBeLessThanOrEqual(0.025);
      } finally {
        stage.dispose();
      }
    });
  }
});
