/* eslint-disable @typescript-eslint/no-explicit-any -- mocked provider payloads */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadProgramModels } from "../modelAssets";
import { createBudget, createRouter, type FetchLike, type ProviderTarget } from "../../../ai";
import { MONEY_DIRECTION } from "../demo/moneyWithdrawalDirection";
import { MONEY_WITHDRAWAL_SOURCES } from "../demo/moneyWithdrawal";
import { normalizeSceneProgram, type ProgramSource } from "../score";
import { SceneProgram3D } from "../stage3d";
import { produceDirectedVideo } from "./autonomous";
import { compileDirectionDetailed, DirectionError, type Direction } from "./direction";
import { parseDirection } from "./parse";
import { directViaRouter } from "./viaRouter";
import { reviewDirection, storyShape, type ReviewFrame } from "./visualReview";

const fromDisk = (async (url: string) => {
  const bytes = readFileSync(
    path.resolve(__dirname, "../../../../../public", String(url).replace(/^\//, "")),
  );
  return new Response(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
}) as unknown as typeof fetch;
const sentences = [
  "Ele atravessou a neve até a base da montanha.",
  "Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e cada pé, sem olhar para baixo.",
  "No topo, cravou a bandeira.",
  "E finalmente comemorou.",
];
const sources: ProgramSource[] = sentences.map((text, i) => ({
  sourceId: `s${i + 1}`,
  text,
  duration: Math.max(2, text.split(/\s+/).length / 2.6),
}));
const cam = (subjects: string[]) => ({
  subjects,
  azimuth: 0.9,
  endAzimuth: 1.1,
  elevation: 0.14,
  distance: 1.4,
});
/** One Direction that mixes BOTH methods: the hero walks and climbs (measured body) while ordinary cast members appear, move and are tinted by verbs. */
const mixed = (): Direction => ({
  version: 1,
  background: "#BCD9EA",
  world: { kind: "cliff", height: 3.3, mood: "day" },
  cast: [
    { id: "hero", kind: "actor", color: "#DF6B35" },
    {
      id: "banner",
      kind: "mesh",
      hidden: true,
      position: [1.6, 1.2, 1.2],
      geometry: { shape: "box", size: [0.8, 0.5, 0.05] },
      color: "#EF4444",
    },
    { id: "coin", kind: "model", hidden: true, assetId: "giant-coin-v1", position: [-2.2, 0, 1.4] },
  ],
  scenes: [
    {
      sourceId: "s1",
      shot: cam(["hero"]),
      verbs: [
        { do: "walk", node: "hero", from: "left" },
        { do: "appear", node: "banner", at: [0.2, 0.6] },
      ],
    },
    {
      sourceId: "s2",
      shot: cam(["hero", "wall"]),
      verbs: [
        { do: "climb", node: "hero" },
        { do: "move", node: "banner", by: [0, 0.6, 0], at: [0, 1] },
      ],
    },
    {
      sourceId: "s3",
      shot: cam(["hero"]),
      verbs: [
        { do: "plant", node: "hero" },
        { do: "appear", node: "coin", at: [0, 0.5] },
      ],
    },
    {
      sourceId: "s4",
      shot: cam(["hero"]),
      verbs: [
        { do: "celebrate", node: "hero" },
        { do: "vanish", node: "banner", at: [0, 0.4] },
      ],
    },
  ],
});

describe("one compiler for both direction methods", () => {
  it("compiles cast verbs and actor choreography into ONE program that passes the engine validators", async () => {
    const { program, report } = compileDirectionDetailed(mixed(), sources);
    const ids = program.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["hero", "wall", "banner", "coin", "snowfall"]));
    expect(ids.filter((i) => i === "hero")).toHaveLength(1);
    expect(program.contacts.length).toBeGreaterThan(0);
    expect(program.tracks.some((t) => t.node === "banner")).toBe(true);
    expect(report.contacts).toBe(program.contacts.length);
    const normalized = normalizeSceneProgram(program, sources);
    const stage = new SceneProgram3D(
      normalized,
      sources,
      await loadProgramModels(normalized, fromDisk),
    );
    try {
      expect(() => stage.validateContacts()).not.toThrow();
    } finally {
      stage.dispose();
    }
  });
  it("is deterministic", () => {
    expect(JSON.stringify(compileDirectionDetailed(mixed(), sources).program)).toBe(
      JSON.stringify(compileDirectionDetailed(mixed(), sources).program),
    );
  });
  it("explains misuse in words written for the model", () => {
    const noWorld = mixed();
    delete noWorld.world;
    expect(() => compileDirectionDetailed(noWorld, sources)).toThrow(/exigem "world"/);
    const twice = mixed();
    twice.scenes[0].verbs.push({ do: "stand", node: "hero" });
    expect(() => compileDirectionDetailed(twice, sources)).toThrow(/um só por frase/);
    const clash = mixed();
    clash.scenes[0].verbs.push({ do: "pose", node: "hero", pose: "head" });
    expect(() => compileDirectionDetailed(clash, sources)).toThrow(
      /controlado pelos verbos de ator/,
    );
    const reserved = mixed();
    reserved.cast.push({
      id: "wall",
      kind: "mesh",
      geometry: { shape: "box", size: [1, 1, 1] },
      position: [0, 0, 0],
      color: "#000000",
    });
    expect(() => compileDirectionDetailed(reserved, sources)).toThrow(/reservado pelo mundo/);
    const other = mixed();
    other.scenes[0].verbs[0] = { do: "walk", node: "banner" };
    expect(() => compileDirectionDetailed(other, sources)).toThrow(DirectionError);
  });
});

describe("parseDirection", () => {
  const money = () => JSON.parse(JSON.stringify(MONEY_DIRECTION));
  it("accepts the money video direction exactly as authored", () => {
    expect(parseDirection(money(), MONEY_WITHDRAWAL_SOURCES)).toMatchObject({ version: 1 });
  });
  it("rejects unknown verbs, unknown nodes and wrong scene counts with an actionable message", () => {
    const bad = money();
    bad.scenes[0].verbs[0].do = "teleport";
    expect(() => parseDirection(bad, MONEY_WITHDRAWAL_SOURCES)).toThrow(/"teleport" não existe/);
    const node = money();
    node.scenes[0].verbs[0].node = "fantasma";
    expect(() => parseDirection(node, MONEY_WITHDRAWAL_SOURCES)).toThrow(/não está no elenco/);
    const short = money();
    short.scenes.pop();
    expect(() => parseDirection(short, MONEY_WITHDRAWAL_SOURCES)).toThrow(/exatamente 7/);
    expect(() => parseDirection({ ...money(), extra: 1 }, MONEY_WITHDRAWAL_SOURCES)).toThrow(
      /não suportados/,
    );
  });
});

// ---- router plumbing -----------------------------------------------------------------------------------------
type Reply = { status?: number; body?: unknown };
const scripted = (replies: Reply[]) => {
  const calls: { url: string; body: any }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)],
      status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: { get: () => null } as unknown as Headers,
      json: async () => r.body,
    };
  };
  return { fetch, calls };
};
const gem = (text: string): Reply => ({
  body: {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 300 },
  },
});
const G: ProviderTarget = {
  id: "gemini",
  kind: "gemini",
  model: "gemini-3.6-flash",
  apiKey: "k",
  paid: false,
  billing: "free",
};
const fast = { sleep: async () => {}, random: () => 0.5 };
const moneySources = MONEY_WITHDRAWAL_SOURCES;
const png = "A".repeat(64);
const frames: ReviewFrame[] = [0, 2, 4].map((time) => ({
  time,
  mimeType: "image/png",
  base64: png,
}));

describe("direction through the router", () => {
  it("full form: the money direction written by a model compiles through the same compiler, asked at High", async () => {
    const s = scripted([
      gem(JSON.stringify({ title: "Musk", ...JSON.parse(JSON.stringify(MONEY_DIRECTION)) })),
    ]);
    const router = createRouter({
      chain: [G],
      fetch: s.fetch,
      budget: createBudget({ maxCalls: 4 }),
      ...fast,
    });
    const r = await directViaRouter(router, moneySources, { form: "full" });
    expect(r.ok && r.value.program.shots).toHaveLength(7);
    expect(s.calls[0].body.generationConfig.thinkingConfig).toMatchObject({
      thinkingLevel: "high",
    });
    expect(JSON.stringify(s.calls[0].body)).toContain("giant-safe-v1"); // the catalogue is in the prompt
  });
  it("compact form: a sentence too short is repaired once with the measured reason; the whole thing stays inside the video budget", async () => {
    const bad = {
      world: { kind: "cliff", height: 4.5, mood: "day" },
      hero: { color: "#DF6B35" },
      beats: sources.map((x, i) => ({
        sourceId: x.sourceId,
        verb: ["walk", "climb", "plant", "celebrate"][i],
        camera: "follow",
      })),
    };
    const short = sources.map((x, i) => (i === 1 ? { ...x, duration: 1 } : x));
    const good = {
      ...bad,
      beats: bad.beats
        .map((b) => (b.verb === "climb" ? { ...b, verb: "stand" } : b))
        .map((b) => (b.verb === "plant" ? { ...b, verb: "stand" } : b)),
    };
    const s = scripted([gem(JSON.stringify(bad)), gem(JSON.stringify(good))]);
    const budget = createBudget({ maxCalls: 3 }),
      router = createRouter({ chain: [G], fetch: s.fetch, budget, ...fast });
    const r = await directViaRouter(router, short, { form: "compact" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.rounds).toBe(2);
    expect(s.calls[1].body.contents[0].parts[0].text).toContain("Motivo medido");
    expect(budget.used().calls).toBe(2);
  });
});

describe("visual review of a direction", () => {
  const dir = mixed();
  const tinted = (): Direction => {
    const d = JSON.parse(JSON.stringify(dir)) as Direction;
    (d.cast[1] as any).color = "#22C55E";
    (d.cast[1] as any).position = [1.8, 1.4, 1.2];
    return d;
  };
  const answer = (d: Direction | null, issues = ["0–2 s: bandeira atravessa a parede"]) =>
    gem(JSON.stringify({ issues, correctedDirection: d }));
  const run = async (reply: Reply, extra: { budget?: ReturnType<typeof createBudget> } = {}) => {
    const s = scripted([reply]),
      router = createRouter({ chain: [G], fetch: s.fetch, budget: extra.budget, ...fast });
    return { s, result: await reviewDirection({ router, direction: dir, sources, frames }) };
  };
  it("sends real frames as images and accepts a correction that tells the same story", async () => {
    const { s, result } = await run(answer(tinted()));
    expect(result.status).toBe("corrected");
    const parts = s.calls[0].body.contents[0].parts;
    expect(parts.filter((p: any) => p.inlineData)).toHaveLength(3);
    expect(s.calls[0].body.generationConfig.thinkingConfig).toMatchObject({
      thinkingLevel: "high",
    });
  });
  it("rejects a correction that changes the story (removed or reordered verbs, new cast)", async () => {
    const swapped = tinted();
    swapped.scenes[3].verbs = [{ do: "stand", node: "hero" }];
    expect((await run(answer(swapped))).result).toMatchObject({ status: "rejected" });
    const extra = tinted();
    extra.cast.push({
      id: "ufo",
      kind: "mesh",
      position: [0, 5, 0],
      geometry: { shape: "sphere", size: [1] },
      color: "#fff000",
    });
    expect((await run(answer(extra))).result).toMatchObject({ status: "rejected" });
    expect(storyShape(tinted())).toBe(storyShape(dir));
  });
  it("rejects a correction that stops compiling or makes engine measurements worse", async () => {
    const broken = tinted();
    (broken.scenes[0].verbs[1] as any).at = [0.9, 0.1];
    expect((await run(answer(broken))).result).toMatchObject({ status: "rejected" });
    const s = scripted([answer(tinted())]);
    const router = createRouter({ chain: [G], fetch: s.fetch, ...fast });
    const calls = { n: 0 };
    const worse = await reviewDirection({
      router,
      direction: dir,
      sources,
      frames,
      measure: () => (calls.n++ === 0 ? [] : ["mão atravessa a parede"]),
    });
    expect(worse).toMatchObject({ status: "rejected" });
  });
  it("never blocks: no budget or a failing provider keeps the original and says why", async () => {
    const used = createBudget({ maxCalls: 1 });
    used.take();
    expect((await run(answer(tinted()), { budget: used })).result).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("orçamento"),
    });
    expect((await run({ status: 503 })).result.status).toBe("failed");
    const none = await run(answer(null));
    expect(none.result.status).toBe("unchanged");
  });
  it("refuses unusable frames before spending a call", async () => {
    const s = scripted([answer(null)]);
    const router = createRouter({ chain: [G], fetch: s.fetch, ...fast });
    const r = await reviewDirection({
      router,
      direction: dir,
      sources,
      frames: frames.slice(0, 2),
    });
    expect(r.status).toBe("failed");
    expect(s.calls).toHaveLength(0);
  });
});

describe("autonomous loop: plan → animate → see → correct → export", () => {
  const good = () => JSON.stringify({ title: "Escalada", ...mixed() });
  it("exports the CORRECTED direction and spends exactly two AI calls (plan + review)", async () => {
    const corrected = mixed();
    (corrected.cast[1] as any).color = "#22C55E";
    const s = scripted([
      gem(good()),
      gem(
        JSON.stringify({
          issues: ["2 s: bandeira vermelha some no fundo"],
          correctedDirection: corrected,
        }),
      ),
    ]);
    const budget = createBudget({ maxCalls: 5 }),
      router = createRouter({ chain: [G], fetch: s.fetch, budget, ...fast });
    const stages: string[] = [];
    let exported: unknown;
    const r = await produceDirectedVideo({
      router,
      sources,
      direct: { form: "full" },
      onStage: (st) => stages.push(st),
      renderFrames: async () => frames,
      exportVideo: async (scene) => {
        exported = scene.direction;
        return { ref: "video-1.mp4" };
      },
    });
    expect(r).toMatchObject({
      status: "exported",
      review: "corrected",
      exportRef: "video-1.mp4",
      aiCalls: 2,
    });
    expect(stages).toEqual(["plan", "render", "review", "export"]);
    expect((exported as Direction).cast[1]).toMatchObject({ color: "#22C55E" });
    expect(budget.used().calls).toBe(2);
  });
  it("a failed review never blocks the export of the original", async () => {
    const s = scripted([gem(good()), { status: 500 }]);
    const router = createRouter({
      chain: [G],
      fetch: s.fetch,
      budget: createBudget({ maxCalls: 3 }),
      maxAttemptsPerTarget: 1,
      ...fast,
    });
    const r = await produceDirectedVideo({
      router,
      sources,
      direct: { form: "full" },
      renderFrames: async () => frames,
      exportVideo: async () => ({ ref: "v.mp4" }),
    });
    expect(r).toMatchObject({ status: "exported", review: "failed" });
  });
  it("a failed plan stops before rendering or exporting anything", async () => {
    const s = scripted([{ status: 401 }]);
    const router = createRouter({ chain: [G], fetch: s.fetch, ...fast });
    let touched = false;
    const r = await produceDirectedVideo({
      router,
      sources,
      renderFrames: async () => {
        touched = true;
        return frames;
      },
      exportVideo: async () => {
        touched = true;
        return { ref: "x" };
      },
    });
    expect(r).toMatchObject({ status: "failed", stage: "plan" });
    expect(touched).toBe(false);
  });
  it("engine measurements feed the repair round of the plan instead of reaching the export", async () => {
    const s = scripted([gem(good()), gem(good())]);
    const router = createRouter({
      chain: [G],
      fetch: s.fetch,
      budget: createBudget({ maxCalls: 4 }),
      ...fast,
    });
    let n = 0;
    const r = await produceDirectedVideo({
      router,
      sources,
      direct: { form: "full" },
      review: false,
      measure: () => (n++ === 0 ? ["a mão esquerda não alcança o apoio 3 (erro 31 cm)"] : []),
      exportVideo: async () => ({ ref: "v.mp4" }),
    });
    expect(r).toMatchObject({ status: "exported", review: "skipped", aiCalls: 2 });
    expect(s.calls[1].body.contents[0].parts[0].text).toContain("31 cm");
  });
});
