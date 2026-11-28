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

describe("cuts and mood", () => {
  const base = (cuts: unknown, mood?: string) => ({
    version: 1,
    background: "#EEF1F5",
    ...(mood ? { mood } : {}),
    cast: [
      { id: "chao", kind: "mesh", geometry: { shape: "box", size: [40, 0.2, 40] }, position: [0, -0.1, 0], color: "#C9D6DF" },
      { id: "cofre", kind: "model", assetId: "giant-safe-v1", position: [0, 0, 0], rotation: [0, 0.2, 0], scale: [1, 1, 1] },
      { id: "caixa", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [4, 0.5, 0], color: "#2563EB" },
    ],
    scenes: [
      {
        sourceId: "s1",
        shot: { subjects: ["cofre"], azimuth: 0.2, elevation: 0.15, distance: 1.2, ...(cuts ? { cuts } : {}) },
        verbs: [{ do: "spin", node: "cofre", part: "volante", turns: 1, at: [0, 0.4] }],
      },
    ],
  });
  it("accepts cuts and a mood, and carries them into the normalized program", () => {
    const d = parseDirection(
      base([{ from: 0.5, subjects: ["caixa"], azimuth: 0.4, elevation: 0.1, distance: 1.3 }], "night"),
      sources,
    );
    const { program } = compileDirectionDetailed(d, sources);
    expect(program.mood).toBe("night");
    expect(program.shots[0].cuts).toHaveLength(1);
  });
  it("rejects unknown moods, cuts out of order, too close together, or citing objects outside the cast", () => {
    expect(() => parseDirection(base(undefined, "tempestade"), sources)).toThrow(/mood/);
    const cut = (from: number, subjects = ["caixa"]) => ({ from, subjects, azimuth: 0.1, elevation: 0.1, distance: 1.2 });
    expect(() => parseDirection(base([cut(0.6), cut(0.5)]), sources)).toThrow(/ordem crescente/);
    expect(() => parseDirection(base([cut(0.5), cut(0.55)]), sources)).toThrow(/10%/);
    expect(() => parseDirection(base([cut(0.5, ["fantasma"])]), sources)).toThrow(/elenco/);
    expect(() => parseDirection(base([{ ...cut(0.5), extra: 1 }]), sources)).toThrow(/não suportado/);
  });
  it("checks the framing of every cut: the safe seen from behind in a cut is flagged", () => {
    const d = parseDirection(
      base([{ from: 0.5, subjects: ["cofre"], azimuth: 3.1, elevation: 0.1, distance: 1.3 }]),
      sources,
    );
    const p = framingProblems(compileDirectionDetailed(d, sources).program, sources);
    expect(p.join(" ")).toMatch(/cofre.*de costas/);
  });
});

describe("cuts in the real stage", () => {
  it("moves the camera to the new subject at the cut and fits it", async () => {
    const { SceneProgram3D } = await import("../stage3d");
    const src: ProgramSource[] = [{ sourceId: "s1", text: "Duas caixas.", duration: 10 }];
    const d = parseDirection(
      {
        version: 1,
        background: "#EEF1F5",
        mood: "dusk",
        cast: [
          { id: "chao", kind: "mesh", geometry: { shape: "box", size: [60, 0.2, 60] }, position: [0, -0.1, 0], color: "#C9D6DF" },
          { id: "a", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [-10, 0.5, 0], color: "#2563EB" },
          { id: "b", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [10, 0.5, 0], color: "#DC2626" },
        ],
        scenes: [
          {
            sourceId: "s1",
            shot: {
              subjects: ["a"], azimuth: 0, elevation: 0.1, distance: 1.2,
              cuts: [{ from: 0.5, subjects: ["b"], azimuth: 0, elevation: 0.1, distance: 1.2 }],
            },
            verbs: [{ do: "move", node: "a", by: [0, 0, 1], at: [0, 0.4] }],
          },
        ],
      },
      src,
    );
    const stage = new SceneProgram3D(compileDirectionDetailed(d, src).program, src);
    const camX = (t: number) => {
      stage.update(t);
      stage.frame(9 / 16);
      return stage["camera"].position.x;
    };
    expect(camX(2)).toBeCloseTo(-10, 0);
    expect(camX(8)).toBeCloseTo(10, 0);
  });
});
