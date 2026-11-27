/* eslint-disable @typescript-eslint/no-explicit-any -- mocked provider payloads */
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../ai";
import { budgetFor, runDirection, runDirectionReview, sourcesFromScript } from "./directionService";

const script =
  "Ele atravessou a neve até a base da montanha. Depois subiu a parede de gelo devagar, passo a passo, sem olhar para baixo. No topo, comemorou.";
const plan = {
  world: { kind: "cliff", height: 3.2, mood: "day" },
  hero: { color: "#DF6B35" },
  beats: [
    { sourceId: "s1", verb: "walk", camera: "follow", from: "left" },
    { sourceId: "s2", verb: "stand", camera: "wide" },
    { sourceId: "s3", verb: "celebrate", camera: "orbit" },
  ],
};
const gem = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
});
const fetchOf = (bodies: unknown[]) => {
  const calls: any[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null } as unknown as Headers,
      json: async () => bodies[Math.min(calls.length - 1, bodies.length - 1)],
    };
  };
  return { fetch, calls };
};
const env = { GEMINI_API_KEY: "server-key", GEMINI_BILLING: "free", AI_VIDEO_MAX_CALLS: "2" };

describe("direction service", () => {
  it("splits a script into sentences and refuses unusable ones", () => {
    expect(sourcesFromScript(script).map((s) => s.sourceId)).toEqual(["s1", "s2", "s3"]);
    expect(() => sourcesFromScript("Oi. Tchau.")).toThrow(/12 a 350/);
  });
  it("plans through the router with the key from the SERVER env, and reports calls/providers without secrets", async () => {
    const f = fetchOf([gem(JSON.stringify(plan))]);
    const r = await runDirection(
      { script, videoId: "video-aaaa1", form: "compact", confirmCost: true },
      env,
      "u1",
      f.fetch,
    );
    expect(r).toMatchObject({
      ok: true,
      aiCalls: 1,
      callsLeft: 1,
      providers: ["gemini/gemini-3.6-flash"],
    });
    expect(f.calls[0].headers["x-goog-api-key"]).toBe("server-key");
    expect(JSON.stringify(r)).not.toContain("server-key");
    expect(JSON.parse((r as any).programJson).nodes.length).toBeGreaterThan(10);
  });
  it("planning and review of the SAME video share one budget; a different video starts its own", async () => {
    const f = fetchOf([gem(JSON.stringify({ issues: [], correctedDirection: null }))]);
    const frames = [0, 2, 4].map((time) => ({
      time,
      mimeType: "image/png" as const,
      base64: "A".repeat(64),
    }));
    const direction = JSON.parse(
      (
        (await runDirection(
          { script, videoId: "video-bbbb2", form: "compact", confirmCost: true },
          env,
          "u2",
          fetchOf([gem(JSON.stringify(plan))]).fetch,
        )) as any
      ).directionJson,
    );
    const review = await runDirectionReview(
      { script, videoId: "video-bbbb2", direction, frames, confirmCost: true },
      env,
      "u2",
      f.fetch,
    );
    expect(review).toMatchObject({ status: "unchanged", aiCalls: 2, callsLeft: 0 });
    // budget (2) is now spent for this video: nothing more is sent
    const again = await runDirection(
      { script, videoId: "video-bbbb2", form: "compact", confirmCost: true },
      env,
      "u2",
      f.fetch,
    );
    expect(again).toMatchObject({ ok: false, aiCalls: 2 });
    expect(f.calls).toHaveLength(1);
    expect(budgetFor("u2:video-cccc3", env).remaining()).toBe(2);
  });
  it("rejects requests without explicit cost confirmation or with unknown fields", async () => {
    await expect(
      runDirection({ script, videoId: "video-dddd4", confirmCost: false }, env, "u3"),
    ).rejects.toThrow();
    await expect(
      runDirection({ script, videoId: "video-dddd4", confirmCost: true, apiKey: "x" }, env, "u3"),
    ).rejects.toThrow();
  });
});

describe("block planning through the service (failure recovery)", () => {
  const story =
    "Uma caixa surge no centro da sala vazia. A caixa anda para a direita. A caixa volta para o meio da sala. A caixa sobe e fica no alto.";
  const cast = [
    { id: "chao", kind: "mesh", geometry: { shape: "box", size: [30, 0.2, 30] }, position: [0, -0.1, 0], color: "#C9D6DF" },
    { id: "caixa", kind: "mesh", geometry: { shape: "box", size: [1, 1, 1] }, position: [0, 0.5, 0], color: "#2563EB" },
  ];
  const scene = (id: string, by: number[]) => ({
    sourceId: id,
    shot: { subjects: ["caixa"], azimuth: 0.2, elevation: 0.15, distance: 1.3 },
    verbs: [{ do: "move", node: "caixa", by, at: [0, 0.9] }],
  });
  const block1 = { title: "Caixa", background: "#EEF1F5", cast, scenes: [scene("s1", [0, 0.2, 0]), scene("s2", [2, 0, 0]), scene("s3", [-2, 0, 0])] };
  const block2 = { title: "Caixa", background: "#EEF1F5", cast, scenes: [scene("s4", [0, 1, 0])] };
  const blocksEnv = { ...env, AI_VIDEO_MAX_CALLS: "2" };

  it("keeps the first block when the second fails, and resumes from the checkpoint without paying for block 1 again", async () => {
    const first = fetchOf([gem(JSON.stringify(block1)), gem("isto não é JSON"), gem("nem isto")]);
    const failed: any = await runDirection(
      { script: story, videoId: "video-blk-01", form: "full", blocks: true, confirmCost: true },
      blocksEnv,
      "u-blocks",
      first.fetch,
    );
    expect(failed.ok).toBe(false);
    expect(failed.resumable).toBe(true);
    expect(failed.checkpoint.blocksDone).toBe(1);
    expect(failed.reason).toMatch(/Bloco 2\/2/);

    const resumed = fetchOf([gem(JSON.stringify(block2))]);
    const done: any = await runDirection(
      { script: story, videoId: "video-blk-02", form: "full", blocks: true, checkpoint: failed.checkpoint, confirmCost: true },
      blocksEnv,
      "u-blocks",
      resumed.fetch,
    );
    expect(done.ok).toBe(true);
    expect(resumed.calls).toHaveLength(1);
    expect(JSON.parse(done.directionJson).scenes).toHaveLength(4);
  });
  it("ignores a checkpoint from other sentences or with a forged direction", async () => {
    const forged = {
      version: 1,
      sourceIds: ["s1", "s2", "s3", "s4"],
      texts: story.split(". ").map((t, i, a) => (i < a.length - 1 ? t + "." : t)),
      blocksDone: 1,
      direction: { version: 1, background: "#000", cast: [{ id: "x", kind: "model", assetId: "evil" }], scenes: [] },
    };
    const f = fetchOf([gem(JSON.stringify(block1)), gem(JSON.stringify(block2))]);
    const r: any = await runDirection(
      { script: story, videoId: "video-blk-03", form: "full", blocks: true, checkpoint: forged, confirmCost: true },
      blocksEnv,
      "u-blocks2",
      f.fetch,
    );
    expect(r.ok).toBe(true);
    expect(f.calls).toHaveLength(2); // started from block 1: the forged checkpoint was discarded
  });
});
