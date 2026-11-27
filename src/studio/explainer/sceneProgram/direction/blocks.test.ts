/* eslint-disable @typescript-eslint/no-explicit-any -- mocked provider payloads */
import { describe, expect, it } from "vitest";
import { createBudget, createRouter, type FetchLike, type ProviderTarget } from "../../../ai";
import type { ProgramSource } from "../score";
import { produceDirectedVideo } from "./autonomous";
import { checkpointMatches, emptyCheckpoint, endState, planInBlocks, type PlanCheckpoint } from "./blocks";

const sources: ProgramSource[] = [
  { sourceId: "s1", text: "O carro-forte sai da central.", duration: 6 },
  { sourceId: "s2", text: "Ele chega ao banco.", duration: 6 },
  { sourceId: "s3", text: "O cofre abre.", duration: 6 },
  { sourceId: "s4", text: "O malote entra no cofre.", duration: 6 },
];
const CHAO = { id: "chao", kind: "mesh", geometry: { shape: "box", size: [60, 0.2, 60] }, position: [0, -0.1, 0], color: "#C9D6DF" };
const CAMINHAO = { id: "caminhao", kind: "model", assetId: "armored-truck-v1", position: [-3, 0, -18] };
const COFRE = { id: "cofre", kind: "model", assetId: "giant-safe-v1", position: [3, 0, -2] };
const MALOTE = { id: "malote", kind: "model", assetId: "money-bag-v1", hidden: true, position: [-3, 0, -1.2] };
const shot = (subjects: string[]) => ({ subjects, azimuth: 0.3, elevation: 0.18, distance: 1.4 });
const block1 = {
  title: "Carro-forte",
  background: "#BFD8E6",
  cast: [CHAO, CAMINHAO, COFRE, MALOTE],
  scenes: [
    { sourceId: "s1", shot: shot(["caminhao"]), verbs: [{ do: "drive", node: "caminhao", by: [0, 0, 8] }] },
    { sourceId: "s2", shot: shot(["caminhao", "cofre"]), verbs: [{ do: "drive", node: "caminhao", by: [0, 0, 6] }] },
  ],
};
const block2 = {
  background: "#BFD8E6",
  cast: [CHAO, CAMINHAO, COFRE, MALOTE],
  scenes: [
    { sourceId: "s3", shot: shot(["cofre"]), verbs: [{ do: "open", node: "cofre", part: "porta" }] },
    { sourceId: "s4", shot: shot(["cofre", "malote"]), verbs: [{ do: "appear", node: "malote", at: [0, 0.2] }, { do: "move", node: "malote", to: [3, 0.28, -2], at: [0.2, 1] }] },
  ],
};

type Reply = { status?: number; body?: unknown };
const gem = (o: unknown): Reply => ({
  body: { candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 300 } },
});
const down: Reply = { status: 503, body: { error: { status: "UNAVAILABLE", message: "high demand" } } };
const G: ProviderTarget = { id: "gemini", kind: "gemini", model: "gemini-3.6-flash", apiKey: "k", paid: false, billing: "free" };
const rig = (replies: Reply[]) => {
  const calls: { body: any }[] = [];
  const fetch: FetchLike = async (_u, init) => {
    calls.push({ body: JSON.parse(init.body) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)], status = r.status ?? 200;
    return { ok: status < 400, status, headers: { get: () => null } as unknown as Headers, json: async () => r.body };
  };
  const router = createRouter({ chain: [G], fetch, budget: createBudget({ maxCalls: 12 }), sleep: async () => {}, random: () => 0.5 });
  return { router, calls, prompt: (i: number) => String(calls[i].body.contents[0].parts.at(-1).text) };
};

describe("planning in blocks", () => {
  it("plans two blocks, tells block 2 the cast and the end state, and checkpoints after each", async () => {
    const t = rig([gem(block1), gem(block2)]);
    const saved: PlanCheckpoint[] = [];
    const r = await planInBlocks({ router: t.router, sources, blockSize: 2, onCheckpoint: (c) => saved.push(c) });
    expect(r.status).toBe("complete");
    if (r.status !== "complete") return;
    expect(t.calls).toHaveLength(2);
    expect(r.scene.direction.scenes.map((s) => s.sourceId)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(r.scene.program.shots).toHaveLength(4);
    // Block 2 sees the existing cast and where the truck stopped (−18 + 8 + 6 = −4), as data.
    expect(t.prompt(1)).toContain('"id":"caminhao"');
    expect(t.prompt(1)).toMatch(/caminhao: visível, posição \[-3, 0, -4\]/);
    expect(t.prompt(1)).toMatch(/malote: OCULTO/);
    expect(t.prompt(0)).not.toContain("ESTADO NO FIM DA CENA ANTERIOR (dado");
    expect(saved.map((c) => c.blocksDone)).toEqual([1, 2]);
    expect(saved[0].direction?.scenes).toHaveLength(2);
    // The checkpoint survives JSON (it is stored by the app).
    expect(JSON.parse(JSON.stringify(saved[0]))).toEqual(saved[0]);
  });

  it("keeps what was planned when a later block fails, and resumes paying only for the rest", async () => {
    const down1 = rig([gem(block1), down]);
    const first = await planInBlocks({ router: down1.router, sources, blockSize: 2 });
    expect(first.status).toBe("partial");
    if (first.status !== "partial") return;
    expect(first.failedBlock).toBe(2);
    expect(first.reason).toMatch(/indispon|sobrecarreg|5xx/i);
    expect(first.checkpoint.blocksDone).toBe(1);
    expect(first.checkpoint.direction?.scenes).toHaveLength(2);

    const resume = rig([gem(block2)]);
    const stored = JSON.parse(JSON.stringify(first.checkpoint));
    const second = await planInBlocks({ router: resume.router, sources, blockSize: 2, checkpoint: stored });
    expect(second.status).toBe("complete");
    expect(resume.calls).toHaveLength(1); // block 1 was not paid for again
    if (second.status === "complete") expect(second.scene.direction.scenes).toHaveLength(4);
  });

  it("rejects a block that changes the cast already defined, quoting the reason back to the model", async () => {
    const moved = { ...block2, cast: [CHAO, { ...CAMINHAO, position: [9, 0, 9] }, COFRE, MALOTE] };
    const t = rig([gem(block1), gem(moved), gem(block2)]);
    const r = await planInBlocks({ router: t.router, sources, blockSize: 2 });
    expect(r.status).toBe("complete");
    expect(t.calls).toHaveLength(3);
    expect(t.prompt(2)).toMatch(/não pode mudar: "caminhao"/);
  });

  it("rejects a block with the wrong number of scenes", async () => {
    const t = rig([gem({ ...block1, scenes: block1.scenes.slice(0, 1) }), gem({ ...block1, scenes: block1.scenes.slice(0, 1) })]);
    const r = await planInBlocks({ router: t.router, sources, blockSize: 2 });
    expect(r.status).toBe("partial");
    if (r.status === "partial") expect(r.reason).toMatch(/exatamente 2 cena/);
  });

  it("ignores a checkpoint made for other sentences, and needs no AI call for a complete one", async () => {
    expect(checkpointMatches({ ...emptyCheckpoint(sources), texts: ["outra", "x", "y", "z"] }, sources)).toBe(false);
    const t = rig([gem(block1), gem(block2)]);
    const done = await planInBlocks({ router: t.router, sources, blockSize: 2 });
    if (done.status !== "complete") throw new Error("setup");
    const none = rig([down]);
    const again = await planInBlocks({ router: none.router, sources, blockSize: 2, checkpoint: done.checkpoint });
    expect(again.status).toBe("complete");
    expect(none.calls).toHaveLength(0);
  });

  it("runs the engine validators on the whole direction so far", async () => {
    const t = rig([gem(block1), gem(block1)]);
    const r = await planInBlocks({ router: t.router, sources, blockSize: 2, measure: () => ["o caminhão atravessa o cofre"] });
    expect(r.status).toBe("partial");
    if (r.status === "partial") expect(r.reason).toMatch(/atravessa o cofre/);
  });

  it("endState reports hidden nodes, positions and turned parts", async () => {
    const t = rig([gem(block1), gem(block2)]);
    const r = await planInBlocks({ router: t.router, sources, blockSize: 2 });
    if (r.status !== "complete") throw new Error("setup");
    const text = endState(r.scene.direction, r.scene.program, sources);
    expect(text).toMatch(/cofre: visível.*porta girada/);
  });

  it("the autonomous loop plans in blocks, exports, and returns the checkpoint (also when it fails)", async () => {
    const ok = rig([gem(block1), gem(block2)]);
    const exported = await produceDirectedVideo({ router: ok.router, sources, blocks: { size: 2 }, review: false, exportVideo: async () => ({ ref: "x.mp4" }) });
    expect(exported.status).toBe("exported");
    expect(exported.checkpoint?.blocksDone).toBe(2);
    expect(exported.aiCalls).toBe(2);

    const bad = rig([gem(block1), down]);
    const saved: PlanCheckpoint[] = [];
    const failed = await produceDirectedVideo({ router: bad.router, sources, blocks: { size: 2, onCheckpoint: (c) => saved.push(c) }, review: false, exportVideo: async () => ({ ref: "x.mp4" }) });
    expect(failed.status).toBe("failed");
    expect(failed.stage).toBe("plan");
    expect(failed.reason).toMatch(/Bloco 2\/2 falhou/);
    expect(failed.checkpoint?.blocksDone).toBe(1);
    expect(saved).toHaveLength(1);
  });
});
