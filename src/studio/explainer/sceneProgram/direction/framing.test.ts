import { describe, expect, it } from "vitest";
import { compileDirectionDetailed, type Direction } from "./direction";
import { framingProblems } from "./framing";
import { parseDirection } from "./parse";
import type { ProgramSource } from "../score";
import live from "./fixtures/live-run-45968877722.json";

const sources: ProgramSource[] = [
  { sourceId: "s1", text: "O cofre.", duration: 5 },
];
const make = (safeYaw: number, extra: Direction["cast"] = []): Direction =>
  parseDirection(
    {
      version: 1,
      background: "#EEF1F5",
      cast: [
        { id: "chao", kind: "mesh", geometry: { shape: "box", size: [40, 0.2, 40] }, position: [0, -0.1, 0], color: "#C9D6DF" },
        { id: "cofre", kind: "model", assetId: "giant-safe-v1", position: [0, 0, 0], rotation: [0, safeYaw, 0], scale: [1, 1, 1] },
        ...extra,
      ],
      scenes: [{ sourceId: "s1", shot: { subjects: ["cofre"], azimuth: 0.2, elevation: 0.15, distance: 1.2 }, verbs: [{ do: "spin", node: "cofre", part: "volante", turns: 1, at: [0, 0.4] }] }],
    },
    sources,
  );
const problems = (d: Direction) => framingProblems(compileDirectionDetailed(d, sources).program, sources);

describe("framingProblems", () => {
  it("accepts a safe whose door faces the camera", () => {
    expect(problems(make(0.2))).toEqual([]);
  });
  it("flags a safe turned away from the camera and says how to fix it", () => {
    const p = problems(make(Math.PI));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/de costas/);
    expect(p[0]).toMatch(/rotation \[0, 0.2, 0\]/);
  });
  it("flags a model standing between the camera and the subject", () => {
    const p = problems(
      make(0.2, [{ id: "caminhao", kind: "model", assetId: "armored-truck-v1", position: [1.2, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] }]),
    );
    expect(p.join(" ")).toMatch(/"caminhao" fica entre a câmera e "cofre"/);
  });
  it("catches the real Gemini run where the safe faced away in scenes 4-6", () => {
    const story = [
      ["s1", 7], ["s2", 8], ["s3", 8], ["s4", 8], ["s5", 7], ["s6", 7],
    ].map(([id, d]) => ({ sourceId: id as string, text: id as string, duration: d as number }));
    const direction = parseDirection(live, story);
    const p = framingProblems(compileDirectionDetailed(direction, story).program, story);
    expect(p.join(" ")).toMatch(/cofre/);
  });
});
