/* eslint-disable @typescript-eslint/no-explicit-any -- QA harness: browser page API and untyped model JSON */
/**
 * Real end-to-end proof of the autonomous loop on the OFFICIAL engine:
 *   script → Gemini (High) directs from the model catalogue → compile → REAL frames from the engine → Gemini sees them
 *   and may correct → fixed-frame MP4/WebM export in Chromium.
 * One router, one per-video budget (default 5 calls), Gemini only (no Lovable, no paid provider), no hidden retries.
 *
 *   LIVE_EXPLICIT_RUN=1 GEMINI_API_KEY=… bun scripts/direction-live/run.mts
 *   LIVE_DRY=1 bun scripts/direction-live/run.mts      # no network: a canned direction proves ONLY the render/export harness
 *
 * Output (tmp/direction-live/): report.json, direction*.json, frames/*.jpg, video.(mp4|webm). Never contains the key.
 */
import { build } from "vite";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createBudget,
  createRouter,
  memoryQuota,
  targetsFromEnv,
  type AiEvent,
  type FetchLike,
} from "../../src/studio/ai";
import { framingProblems } from "../../src/studio/explainer/sceneProgram/direction/framing";
import { produceDirectedVideo } from "../../src/studio/explainer/sceneProgram/direction/autonomous";
import type { ProgramSource } from "../../src/studio/explainer/sceneProgram/score";
import { SENTENCES } from "./story";

const { chromium } = createRequire(import.meta.url)("playwright");
const dry = process.env.LIVE_DRY === "1";
if (!dry && process.env.LIVE_EXPLICIT_RUN !== "1") {
  console.error(
    "Este script gasta cota real do Gemini. Rode com LIVE_EXPLICIT_RUN=1 (ou LIVE_DRY=1 para testar só o render e a exportação).",
  );
  process.exit(2);
}
if (!dry && !process.env.GEMINI_API_KEY) {
  console.error(
    "GEMINI_API_KEY ausente: nada foi chamado e nenhum vídeo de substituição será gerado.",
  );
  process.exit(3);
}

const sources: ProgramSource[] = (
  process.env.LIVE_SCRIPT
    ? process.env.LIVE_SCRIPT.split("\n").map((t): [string, number] => [t, 7])
    : SENTENCES
).map(([text, duration], i) => ({ sourceId: `s${i + 1}`, text, duration }));
const total = sources.reduce((t, s) => t + (s.duration ?? 0), 0);
if (total < 30 || total > 60) throw new Error(`O vídeo precisa ter de 30 a 60 s (tem ${total}).`);

const root = process.cwd(),
  qa = path.join(root, "scripts/direction-live"),
  dist = path.join(root, "tmp/direction-live/dist"),
  out = path.join(root, "tmp/direction-live");
await mkdir(path.join(out, "frames"), { recursive: true });

// ---- canned answers for LIVE_DRY only (proves the harness; NEVER presented as a Gemini result) ----
const DRY_DIRECTION = {
  title: "Carro-forte (dry)",
  version: 1,
  background: "#BFD8E6",
  cast: [
    {
      id: "chao",
      kind: "mesh",
      geometry: { shape: "box", size: [80, 0.2, 80] },
      position: [0, -0.1, 0],
      color: "#C9D6DF",
    },
    { id: "cofre", kind: "model", assetId: "giant-safe-v1", position: [3, 0, -2] },
    { id: "caminhao", kind: "model", assetId: "armored-truck-v1", position: [-3, 0, -18] },
    { id: "saco", kind: "model", assetId: "money-bag-v1", hidden: true, position: [-3, 0, -1.2] },
    {
      id: "gerente",
      kind: "actor",
      color: "#1E3A8A",
      position: [1.2, 0, 1.6],
      rotation: [0, -0.5, 0],
    },
  ],
  scenes: [
    {
      sourceId: "s1",
      shot: { subjects: ["caminhao"], azimuth: 0.5, elevation: 0.18, distance: 1.5 },
      verbs: [{ do: "drive", node: "caminhao", by: [0, 0, 14] }],
    },
    {
      sourceId: "s2",
      shot: { subjects: ["caminhao", "cofre"], azimuth: 0.35, elevation: 0.2, distance: 1.6 },
      verbs: [{ do: "drive", node: "caminhao", by: [0, 0, 8], at: [0, 0.9] }],
    },
    {
      sourceId: "s3",
      shot: { subjects: ["caminhao", "saco"], azimuth: 2.6, elevation: 0.18, distance: 1.4 },
      verbs: [
        { do: "open", node: "caminhao", part: "porta_traseira", at: [0.1, 0.55] },
        { do: "appear", node: "saco", at: [0.5, 0.8] },
      ],
    },
    {
      sourceId: "s4",
      shot: { subjects: ["saco", "cofre"], azimuth: 0.3, elevation: 0.16, distance: 1.3 },
      verbs: [
        { do: "open", node: "cofre", part: "porta", at: [0, 0.4] },
        { do: "move", node: "saco", to: [3, 0.28, -2], at: [0.4, 1] },
      ],
    },
    {
      sourceId: "s5",
      shot: {
        subjects: ["cofre", "gerente"],
        azimuth: 0.3,
        endAzimuth: 0.05,
        elevation: 0.16,
        distance: 1.15,
      },
      verbs: [
        { do: "spin", node: "cofre", part: "volante", turns: 1, at: [0, 0.5] },
        { do: "close", node: "cofre", part: "porta", at: [0.5, 1] },
        { do: "pose", node: "gerente", pose: "shrug", emotion: "calm", at: [0, 0.4] },
      ],
    },
    {
      sourceId: "s6",
      shot: {
        subjects: ["cofre", "gerente", "caminhao"],
        azimuth: 0.4,
        elevation: 0.2,
        distance: 1.9,
      },
      verbs: [
        { do: "close", node: "caminhao", part: "porta_traseira", at: [0, 0.3] },
        { do: "drive", node: "caminhao", by: [0, 0, 8], at: [0.3, 1] },
      ],
    },
  ],
};
const dryFetch: FetchLike = async (_url, init) => {
  const body = JSON.parse(init.body);
  const review =
    JSON.stringify(body).includes("inlineData") || JSON.stringify(body).includes("inline_data");
  const text = review ? JSON.stringify({ issues: [] }) : JSON.stringify(DRY_DIRECTION);
  return {
    ok: true,
    status: 200,
    headers: { get: () => null } as unknown as Headers,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 600 },
    }),
  };
};

// ---- browser side: the REAL stage and exporter ----
await build({
  configFile: false,
  root: qa,
  logLevel: "error",
  build: { outDir: dist, emptyOutDir: true },
  resolve: { alias: { "@": path.join(root, "src") } },
});
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".glb": "model/gltf-binary",
  ".css": "text/css",
};
const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = url.startsWith("/models/")
    ? path.join(root, "public", url)
    : path.join(dist, url === "/" ? "index.html" : url);
  try {
    const b = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const port = (server.address() as any).port;
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 396, height: 704 } });
const pageErrors: string[] = [];
page.on("pageerror", (e: Error) => pageErrors.push(e.message));
page.on("console", (m: any) => m.type() === "error" && pageErrors.push(m.text()));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => (window as any).__ready, null, { timeout: 60000 });

const starts: number[] = [];
let acc = 0;
for (const s of sources) {
  starts.push(acc);
  acc += s.duration ?? 0;
}
// 7 review frames: the 65% point of every scene (action under way) and the last second.
const frameTimes = [
  ...sources.map((s, i) => +(starts[i] + (s.duration ?? 0) * 0.65).toFixed(2)),
  +(total - 0.3).toFixed(2),
].slice(-7);

// ---- AI side: Gemini only, one shared budget ----
const events: AiEvent[] = [];
// LIVE_CHAIN (default "gemini") may list fallbacks, e.g. "gemini,gemini-lite,groq,openrouter": free tiers only, in this order.
const { chain } = targetsFromEnv(
  dry
    ? { GEMINI_API_KEY: "dry", AI_CHAIN: "gemini" }
    : {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GEMINI_AI_MODEL: process.env.GEMINI_AI_MODEL,
        GEMINI_BILLING: process.env.GEMINI_BILLING,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        AI_CHAIN: process.env.LIVE_CHAIN || "gemini",
      },
);
const budget = createBudget({ maxCalls: Number(process.env.AI_VIDEO_MAX_CALLS) || 5 });
const router = createRouter({
  chain,
  allowPaid: false,
  budget,
  fetch: dry ? dryFetch : undefined,
  quota: memoryQuota(),
  cooldowns: new Map(),
  onEvent: (e) => events.push(e),
});

const stages: string[] = [];
let original: any = null,
  originalProgram: any = null,
  video: { path: string; ext: string; frames: number; fps: number; bytes: number } | null = null,
  motion = 0,
  nodes = 0;
const t0 = Date.now();
const checkpoints: number[] = [];
const result = await produceDirectedVideo({
  router,
  sources,
  direct: { form: "full", thinking: "high" },
  // LIVE_BLOCKS=3 plans three sentences at a time with a checkpoint after each block.
  ...(Number(process.env.LIVE_BLOCKS) > 0
    ? {
        blocks: {
          size: Number(process.env.LIVE_BLOCKS),
          onCheckpoint: (c: { blocksDone: number }) => checkpoints.push(c.blocksDone),
        },
      }
    : {}),
  measure: (program) => {
    originalProgram ??= program;
    return [];
  },
  advise: (program) => framingProblems(program, sources),
  onStage: (stage, info) => {
    stages.push(`${stage}: ${info} (+${Math.round((Date.now() - t0) / 1000)}s)`);
    console.log("[stage]", stages.at(-1));
  },
  renderFrames: async (scene) => {
    original = scene.direction;
    const info = await page.evaluate(({ p, s }: any) => (window as any).__qa.load(p, s), {
      p: scene.program,
      s: sources,
    });
    nodes = info.nodes;
    const frames = [];
    for (const t of frameTimes) {
      const base64: string = await page.evaluate(
        (time: number) => (window as any).__qa.frame(time),
        t,
      );
      await writeFile(
        path.join(out, "frames", `before-${String(t).replace(".", "_")}.jpg`),
        Buffer.from(base64, "base64"),
      );
      frames.push({ time: t, mimeType: "image/jpeg" as const, base64 });
    }
    return frames;
  },
  exportVideo: async (scene) => {
    await page.evaluate(({ p, s }: any) => (window as any).__qa.load(p, s), {
      p: scene.program,
      s: sources,
    });
    motion = await page.evaluate(({ a, b }: any) => (window as any).__qa.motion(a, b), {
      a: 0.2,
      b: total - 0.3,
    });
    for (const t of frameTimes) {
      const base64: string = await page.evaluate(
        (time: number) => (window as any).__qa.frame(time),
        t,
      );
      await writeFile(
        path.join(out, "frames", `final-${String(t).replace(".", "_")}.jpg`),
        Buffer.from(base64, "base64"),
      );
    }
    const r = await page.evaluate(() => (window as any).__qa.exportVideo(12));
    const file = path.join(out, `video.${r.ext}`);
    await writeFile(file, Buffer.from(r.base64, "base64"));
    video = { path: file, ext: r.ext, frames: r.frames, fps: r.fps, bytes: r.bytes };
    return { ref: file };
  },
});
await browser.close();
server.close();

const used = budget.used();
const report = {
  mode: dry
    ? "DRY (resposta fixa: prova só o render e a exportação, NÃO é Gemini)"
    : "LIVE (Gemini real)",
  status: result.status,
  stage: result.stage,
  reason: result.reason,
  review: result.review,
  reviewIssues: result.reviewIssues,
  reviewReason: result.reviewReason,
  aiCalls: result.aiCalls,
  budget: { calls: used.calls, costUsd: used.costUsd },
  providers: events.map((e) => ({
    target: e.target,
    model: e.model,
    ok: e.ok,
    problem: e.problem,
    status: e.status,
    attempt: e.attempt,
    latencyMs: e.latencyMs,
  })),
  stages,
  blocksCheckpointed: checkpoints,
  seconds: total,
  sentences: sources.map((s) => s.text),
  nodes,
  warnings: result.scene?.report.warnings ?? [],
  motionMeanAbsDiff: Number(motion.toFixed(2)),
  video: video && {
    ext: (video as any).ext,
    frames: (video as any).frames,
    fps: (video as any).fps,
    bytes: (video as any).bytes,
  },
  pageErrors,
  castUsed: result.direction?.cast.map((c: any) => `${c.id}:${c.assetId ?? c.kind}`),
  verbs: result.direction?.scenes.map((s) =>
    s.verbs.map((v: any) => `${v.do}(${v.node}${v.part ? "/" + v.part : ""})`),
  ),
  wallSeconds: Math.round((Date.now() - t0) / 1000),
};
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
if (original)
  await writeFile(path.join(out, "direction-original.json"), JSON.stringify(original, null, 2));
if (originalProgram)
  await writeFile(path.join(out, "program-original.json"), JSON.stringify(originalProgram));
if (result.direction)
  await writeFile(
    path.join(out, "direction-final.json"),
    JSON.stringify(result.direction, null, 2),
  );
console.log("LIVE_REPORT", JSON.stringify(report));
if (result.status !== "exported" || !video) process.exit(1);
if (motion < 1) {
  console.error("O vídeo parece parado (diferença média entre o primeiro e o último quadro < 1).");
  process.exit(1);
}
