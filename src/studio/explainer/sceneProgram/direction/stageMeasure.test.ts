import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadProgramModels } from "../modelAssets";
import type { ProgramSource } from "../score";
import { compileDirectionDetailed } from "./direction";
import { parseDirection } from "./parse";
import { stageProblems } from "./stageMeasure";
import live from "./fixtures/live-run-45968877722.json";

const fromDisk = (async (url: string) => {
  const bytes = readFileSync(path.resolve(__dirname, "../../../../../public", String(url).replace(/^\//, "")));
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}) as unknown as typeof fetch;

const story: ProgramSource[] = [["s1", 7], ["s2", 8], ["s3", 8], ["s4", 8], ["s5", 7], ["s6", 7]].map(([id, d]) => ({
  sourceId: id as string,
  text: id as string,
  duration: d as number,
}));

describe("stageProblems (real stage, real GLBs)", () => {
  it("measures the real Gemini run and reports what the cameras really show, in the model's vocabulary", async () => {
    const { program } = compileDirectionDetailed(parseDirection(live, story), story);
    const models = await loadProgramModels(program, fromDisk);
    const problems = stageProblems(program, story, models);
    console.log(problems.join("\n"));
    expect(Array.isArray(problems)).toBe(true);
    for (const p of problems) expect(p).toMatch(/^(s\d:|Fundo)/);
  });
  it("flags a subject that is off-frame and a near-black day background", async () => {
    const one: ProgramSource[] = [{ sourceId: "s1", text: "x", duration: 6 }];
    const d = parseDirection(
      {
        version: 1,
        background: "#05060A",
        cast: [
          { id: "chao", kind: "mesh", geometry: { shape: "box", size: [80, 0.2, 80] }, position: [0, -0.1, 0], color: "#C9D6DF" },
          { id: "a", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [0, 0.5, 0], color: "#2563EB" },
          { id: "b", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [40, 0.5, 0], color: "#DC2626" },
        ],
        scenes: [{ sourceId: "s1", shot: { subjects: ["a", "b"], azimuth: 0, elevation: 0.1, distance: 1 }, verbs: [{ do: "move", node: "a", by: [0, 0, 1], at: [0, 0.5] }] }],
      },
      one,
    );
    const { program } = compileDirectionDetailed(d, one);
    const p = stageProblems(program, one, new Map());
    expect(p.join("\n")).toMatch(/Fundo muito escuro/);
    expect(p.join("\n")).toMatch(/s1: "(a|b)" (ocupa só|é assunto do plano mas está praticamente invisível)/);
  });
});
