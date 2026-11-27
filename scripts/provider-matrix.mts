/* eslint-disable @typescript-eslint/no-explicit-any -- QA script */
/**
 * Which AI can really direct and see? One REAL call per provider and capability, free tiers only:
 *   direct : does it write a direction (cast + verbs from the catalogue) that parses and compiles, through the product's own path?
 *   vision : does it answer the visual review for REAL engine frames (images in the request)?
 * Needs: tmp/matrix-in/frames/final-*.jpg and tmp/matrix-in/direction-final.json (made by `LIVE_DRY=1 bun scripts/direction-live/run.mts`).
 * Keys come from the environment and are never printed. A provider without a key is reported as "sem chave", not called.
 *   MATRIX_EXPLICIT_RUN=1 GEMINI_API_KEY=… GROQ_API_KEY=… OPENROUTER_API_KEY=… bun scripts/provider-matrix.mts
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  createBudget,
  createRouter,
  memoryQuota,
  targetsFromEnv,
  type ProviderTarget,
} from "../src/studio/ai";
import { PROBLEM_PT } from "../src/studio/ai/problems";
import { directViaRouter } from "../src/studio/explainer/sceneProgram/direction/viaRouter";
import {
  reviewDirection,
  type ReviewFrame,
} from "../src/studio/explainer/sceneProgram/direction/visualReview";
import { parseDirection } from "../src/studio/explainer/sceneProgram/direction/parse";
import type { ProgramSource } from "../src/studio/explainer/sceneProgram/score";
import { SENTENCES } from "./direction-live/story";

if (process.env.MATRIX_EXPLICIT_RUN !== "1") {
  console.error("Este script faz chamadas reais (cota gratuita). Rode com MATRIX_EXPLICIT_RUN=1.");
  process.exit(2);
}
const env = process.env;
const sources: ProgramSource[] = SENTENCES.map(([text, duration], i) => ({
  sourceId: `s${i + 1}`,
  text,
  duration,
}));
const inDir = path.join(process.cwd(), "tmp/matrix-in");
const frameFiles = (await readdir(path.join(inDir, "frames")))
  .filter((f) => f.startsWith("final-"))
  .sort((a, b) => parseFloat(a.slice(6)) - parseFloat(b.slice(6)));
const frames: ReviewFrame[] = await Promise.all(
  frameFiles.map(async (f) => ({
    time: parseFloat(f.slice(6).replace("_", ".")),
    mimeType: "image/jpeg" as const,
    base64: (await readFile(path.join(inDir, "frames", f))).toString("base64"),
  })),
);
const direction = parseDirection(
  JSON.parse(await readFile(path.join(inDir, "direction-final.json"), "utf8")),
  sources,
);

const base = (over: Record<string, string | undefined>) =>
  targetsFromEnv({ ...env, ...over, AI_CHAIN: undefined } as any);
const pick = (
  id: string,
  over: Record<string, string | undefined> = {},
): ProviderTarget | undefined => base({ ...over, AI_CHAIN: id }).chain.find((t) => t.id === id);
const candidates: { label: string; target: ProviderTarget | undefined; needs: string }[] = [
  {
    label: "gemini gemini-3.8-flash",
    target: pick("gemini", { GEMINI_AI_MODEL: "gemini-3.8-flash" }),
    needs: "GEMINI_API_KEY",
  },
  {
    label: "gemini gemini-3.6-flash",
    target: pick("gemini", { GEMINI_AI_MODEL: "gemini-3.6-flash" }),
    needs: "GEMINI_API_KEY",
  },
  { label: "gemini gemini-3.5-flash-lite", target: pick("gemini-lite"), needs: "GEMINI_API_KEY" },
  {
    label: `groq ${env.GROQ_MODEL || "openai/gpt-oss-120b"}`,
    target: pick("groq"),
    needs: "GROQ_API_KEY",
  },
  {
    label: `openrouter ${env.OPENROUTER_MODEL || "openrouter/free"}`,
    target: pick("openrouter"),
    needs: "OPENROUTER_API_KEY",
  },
];

const routerFor = (t: ProviderTarget) =>
  createRouter({
    chain: [t],
    allowPaid: false,
    budget: createBudget({ maxCalls: 2 }),
    quota: memoryQuota(),
    cooldowns: new Map(),
  });
const rows: any[] = [];
for (const c of candidates) {
  const row: any = {
    provider: c.label,
    configured: !!c.target?.apiKey,
    paid: c.target?.paid ?? null,
  };
  if (!c.target?.apiKey) {
    row.direct = row.vision = "sem chave";
    rows.push(row);
    continue;
  }
  let t0 = Date.now();
  try {
    const r = await directViaRouter(routerFor(c.target), sources, {
      form: "full",
      thinking: "high",
    });
    row.directMs = Date.now() - t0;
    row.direct = r.ok
      ? "ok"
      : r.stage === "provider"
        ? `falhou: ${PROBLEM_PT[r.failure.problem]}`
        : `resposta recusada: ${r.message.slice(0, 160)}`;
    if (r.ok) row.directCast = r.value.direction.cast.map((m) => m.assetId ?? m.kind);
  } catch (e) {
    row.direct = "erro: " + (e instanceof Error ? e.message.slice(0, 120) : "?");
  }
  t0 = Date.now();
  try {
    // vision: true only for THIS measurement; the product default stays false until the result below proves it.
    const r = await reviewDirection({
      router: routerFor({ ...c.target, vision: true }),
      direction,
      sources,
      frames,
    });
    row.visionMs = Date.now() - t0;
    row.vision = r.status === "failed" ? `falhou: ${r.reason}` : r.status;
    if (r.status !== "failed") row.visionIssues = r.issues.slice(0, 3);
  } catch (e) {
    row.vision = "erro: " + (e instanceof Error ? e.message.slice(0, 120) : "?");
  }
  rows.push(row);
  console.log("[matrix]", JSON.stringify(row));
}
await mkdir("tmp", { recursive: true });
await writeFile(
  "tmp/provider-matrix.json",
  JSON.stringify({ frames: frames.length, rows }, null, 2),
);
console.log(
  "MATRIX",
  JSON.stringify(
    rows.map((r) => ({ p: r.provider, key: r.configured, direct: r.direct, vision: r.vision })),
  ),
);
