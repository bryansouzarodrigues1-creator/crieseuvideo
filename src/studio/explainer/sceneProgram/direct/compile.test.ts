/* eslint-disable @typescript-eslint/no-explicit-any -- untyped model/provider JSON is validated field by field below */
import { describe, expect, it } from "vitest";
import { normalizeSceneProgram } from "../score";
import { SceneProgram3D } from "../stage3d";
import { compileSemantic } from "./compile";
import { parseSemanticPlan, SemanticPlanError, type SemanticPlan } from "./plan";

const sentences = [
  "Ele atravessou a neve até a base da montanha.",
  "Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e cada pé, sem olhar para baixo.",
  "No topo, cravou a bandeira.",
  "E finalmente comemorou.",
];
const sources = sentences.map((text, i) => ({ sourceId: `s${i + 1}`, text }));
const ids = sources.map((s) => s.sourceId);
const plan: SemanticPlan = parseSemanticPlan(
  {
    world: { kind: "cliff", height: 3.3, mood: "day" },
    hero: { color: "#DF6B35" },
    beats: [
      { sourceId: "s1", verb: "walk", camera: "follow", from: "left" },
      { sourceId: "s2", verb: "climb", camera: "follow" },
      { sourceId: "s3", verb: "plant", camera: "close" },
      { sourceId: "s4", verb: "celebrate", camera: "orbit" },
    ],
  },
  ids,
);

const run = (p: SemanticPlan, texts = sentences) => {
  const srcs = texts.map((text, i) => ({
    sourceId: `s${i + 1}`,
    text,
    duration: Math.max(2, text.split(/\s+/).length / 2.6),
  }));
  const { program, report } = compileSemantic(p, srcs);
  const stage = new SceneProgram3D(normalizeSceneProgram(program, srcs), srcs);
  return { program, report, stage };
};

describe("semantic direction compiler", () => {
  it("compiles a 4-sentence story that passes the engine validators (IK reach, grounded climb, penetration)", () => {
    const { report, stage, program } = run(plan);
    try {
      console.log(
        JSON.stringify({
          nodes: report.nodes,
          keys: report.trackKeys,
          contacts: report.contacts,
          climb: report.climb && { ...report.climb, ladders: undefined },
          bytes: JSON.stringify(program).length,
        }),
      );
      expect(() => stage.validateContacts()).not.toThrow();
    } finally {
      stage.dispose();
    }
  });
  it("is deterministic", () => {
    expect(JSON.stringify(compileSemantic(plan, sources).program)).toBe(
      JSON.stringify(compileSemantic(plan, sources).program),
    );
  });
  it("rejects plans with coordinates or unknown verbs, with a message the model can repair", () => {
    expect(() => parseSemanticPlan({ ...plan, extra: 1 }, ids)).toThrow(SemanticPlanError);
    expect(() =>
      parseSemanticPlan({ ...plan, beats: plan.beats.map((b) => ({ ...b, verb: "fly" })) }, ids),
    ).toThrow(/verb precisa ser/);
    expect(() =>
      parseSemanticPlan({ ...plan, world: { ...plan.world, height: 8848 } }, ids),
    ).toThrow(/altura da parede/);
  });
});

import { directSemantic } from "./run";
describe("long sentences split by the engine", () => {
  it("merges consecutive climb beats into one continuous climb that still validates", () => {
    const chunks = [
      "Ele atravessou a neve até a base da montanha.",
      "Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e",
      "cada pé, sem olhar para baixo.",
      "No topo, cravou a bandeira.",
      "E finalmente comemorou.",
    ];
    const p = parseSemanticPlan(
      {
        world: { kind: "cliff", height: 3.3, mood: "night" },
        hero: { color: "#DF6B35" },
        beats: ["walk", "climb", "climb", "plant", "celebrate"].map((verb, i) => ({
          sourceId: `s${i + 1}`,
          verb,
          camera: "follow",
        })),
      },
      chunks.map((_, i) => `s${i + 1}`),
    );
    const { stage, program } = run(p, chunks);
    try {
      expect(new Set(program.contacts.map((c: any) => c.sourceId))).toEqual(new Set(["s2", "s3"]));
      expect(() => stage.validateContacts()).not.toThrow();
    } finally {
      stage.dispose();
    }
  });
});
describe("semantic loop", () => {
  it("shrinks a wall that does not fit the sentence instead of failing, and says so", () => {
    const tall = parseSemanticPlan(
      {
        world: { kind: "cliff", height: 4.5, mood: "dusk" },
        hero: { color: "#DF6B35" },
        beats: plan.beats,
      },
      ids,
    );
    const { report, program } = compileSemantic(
      tall,
      sources.map((s, i) =>
        i === 1 ? { ...s, text: "Depois escalou a parede de gelo com calma e atenção." } : s,
      ),
    );
    expect(report.warnings.join(" ")).toMatch(/Parede reduzida de 4\.5 m para/);
    expect(program.contacts.length).toBeGreaterThan(10);
  });
  it("repairs a plan the compiler measured as impossible (climb in a sentence too short for any wall), using the measured reason", async () => {
    const prompts: string[] = [],
      short = sources.map((s, i) => (i === 1 ? { ...s, text: "Subiu." } : s));
    const climbPlan = JSON.stringify({
      title: "x",
      world: { kind: "cliff", height: 3.3, mood: "dusk" },
      hero: { color: "#DF6B35" },
      beats: plan.beats,
    });
    const standPlan = JSON.stringify({
      title: "x",
      world: { kind: "cliff", height: 3.3, mood: "dusk" },
      hero: { color: "#DF6B35" },
      beats: plan.beats.map((b) =>
        b.verb === "climb"
          ? { ...b, verb: "stand" }
          : b.verb === "plant"
            ? { ...b, verb: "stand" }
            : b,
      ),
    });
    const answers = [climbPlan, standPlan];
    const result = await directSemantic(async (prompt) => {
      prompts.push(prompt);
      return { ok: true as const, text: answers.shift()! };
    }, short);
    expect(result.attempts).toBe(2);
    expect(prompts[1]).toMatch(/curta demais para qualquer parede/);
  });
});

import { createRouter } from "../../../ai";
import { directSemanticViaRouter } from "./viaRouter";
describe("semantic direction through the provider router", () => {
  it("sends the schema natively, repairs once with the measured reason, and compiles a valid program", async () => {
    const bodies: any[] = [],
      answers = [
        {
          world: { kind: "cliff", height: 3.3, mood: "dusk" },
          hero: { color: "#DF6B35" },
          beats: plan.beats.map((b) => ({ ...b, verb: "fly" })),
        },
        {
          title: "A escalada",
          world: { kind: "cliff", height: 3.3, mood: "dusk" },
          hero: { color: "#DF6B35" },
          beats: plan.beats,
        },
      ];
    const router = createRouter({
      chain: [
        { id: "anthropic", kind: "anthropic", model: "claude-haiku-5-5", apiKey: "k", paid: true },
      ],
      allowPaid: true,
      sleep: async () => {},
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return {
          ok: true,
          status: 200,
          headers: { get: () => null } as unknown as Headers,
          json: async () => ({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", name: "semantic_plan", input: answers.shift() }],
            usage: { input_tokens: 800, output_tokens: 90 },
          }),
        };
      },
    });
    const srcs = sentences.map((text, i) => ({ sourceId: `s${i + 1}`, text }));
    const r = await directSemanticViaRouter(router, srcs);
    expect(r).toMatchObject({ ok: true, rounds: 2, value: { title: "A escalada" } });
    expect(bodies[0].tools[0].input_schema.properties.beats.items.properties.verb.enum).toContain(
      "climb",
    );
    expect(bodies[1].messages[0].content[0].text).toMatch(
      /Motivo medido \(dado\): beats\[0\]\.verb precisa ser um destes/,
    );
    expect(r.ok && r.value.program.contacts.length).toBeGreaterThan(10);
  });
});
