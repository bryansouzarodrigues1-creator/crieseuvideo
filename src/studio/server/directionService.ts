/**
 * Server-side use of the unified direction: script → sentences → router (shared per-video budget) → DirectedScene,
 * and the visual review of rendered frames. Pure of any framework so it is testable; `directScene.functions.ts` is the thin authenticated wrapper.
 * Keys are read from the SERVER environment only (never from the request).
 */
import { z } from "zod";
import {
  createBudget,
  createRouter,
  memoryQuota,
  targetsFromEnv,
  type AiEvent,
  type Budget,
  type FetchLike,
} from "../ai";
import { splitSceneSentences } from "../explainer/sceneProgram/planner/sceneScript";
import type { ProgramSource } from "../explainer/sceneProgram/score";
import { estimateSeconds } from "../explainer/sceneProgram/direction/locomotion";
import type { Direction } from "../explainer/sceneProgram/direction/direction";
import {
  reviewDirection,
  type ReviewResult,
} from "../explainer/sceneProgram/direction/visualReview";
import { directViaRouter } from "../explainer/sceneProgram/direction/viaRouter";

type Env = Record<string, string | undefined>;
export const DEFAULT_VIDEO_CALLS = 5;

export const directInput = z
  .object({
    script: z.string().min(45).max(1500),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    form: z.enum(["compact", "full"]).default("compact"),
    geminiBeta: z.literal(true).optional(),
    confirmCost: z.literal(true),
  })
  .strict();
export const reviewInput = z
  .object({
    script: z.string().min(45).max(1500),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    direction: z.record(z.unknown()).refine((d) => JSON.stringify(d).length <= 60_000),
    frames: z
      .array(
        z
          .object({
            time: z.number().finite().min(0).max(120),
            mimeType: z.enum(["image/jpeg", "image/png"]),
            base64: z
              .string()
              .min(32)
              .max(250_000)
              .regex(/^[A-Za-z0-9+/]+={0,2}$/),
          })
          .strict(),
      )
      .min(3)
      .max(7),
    geminiBeta: z.literal(true).optional(),
    confirmCost: z.literal(true),
  })
  .strict();

export function sourcesFromScript(script: string): ProgramSource[] {
  const sentences = splitSceneSentences(script);
  if (sentences.length < 1 || sentences.length > 10)
    throw new Error("Use de 1 a 10 frases ou linhas.");
  if (sentences.some((s) => s.length < 12 || s.length > 350))
    throw new Error("Cada frase precisa ter de 12 a 350 caracteres.");
  const sources=sentences.map((text,i)=>({sourceId:`s${i+1}`,text}));
  const timed=sources.map(s=>({...s,duration:estimateSeconds(s)}));
  if(timed.reduce((sum,s)=>sum+s.duration,0)>60)throw Error("Reduza o roteiro para no máximo 60 segundos.");
  return timed;
}

/** One budget per video, kept for 30 minutes so planning and the later visual review draw from the same calls (in memory, like the other first-line guards). */
const budgets = new Map<string, { budget: Budget; at: number }>();
export function budgetFor(key: string, env: Env, now = Date.now()): Budget {
  for (const [k, v] of budgets) if (now - v.at > 30 * 60_000) budgets.delete(k);
  const hit = budgets.get(key);
  if (hit) return hit.budget;
  const budget = createBudget({
    maxCalls: Number(env.AI_VIDEO_MAX_CALLS) || DEFAULT_VIDEO_CALLS,
    maxCostUsd: env.AI_VIDEO_MAX_COST_USD ? Number(env.AI_VIDEO_MAX_COST_USD) : undefined,
  });
  budgets.set(key, { budget, at: now });
  return budget;
}
/** Daily counters and provider pauses outlive a single request, otherwise a free-tier cap would reset on every call. */
const quota = memoryQuota(),
  cooldowns = new Map<string, number>();
const routerFor = (env: Env, budget: Budget, fetch?: FetchLike, events?: AiEvent[]) => {
  const { chain, allowPaid, requireVerifiedFree } = targetsFromEnv(env);
  return createRouter({
    chain,
    allowPaid,
    requireVerifiedFree,
    budget,
    fetch,
    quota,
    cooldowns,
    onEvent: (e) => events?.push(e),
  });
};
const report = (budget: Budget, events: AiEvent[]) => ({
  aiCalls: budget.used().calls,
  callsLeft: budget.remaining(),
  costUsd: budget.used().costUsd,
  providers: [...new Set(events.filter((e) => e.ok).map((e) => `${e.target}/${e.model}`))],
});

export async function runDirection(raw: unknown, env: Env, userId: string, fetch?: FetchLike) {
  const input = directInput.parse(raw);
  const sources = sourcesFromScript(input.script);
  const events: AiEvent[] = [],
    budget = budgetFor(`${userId}:${input.videoId}`, env);
  const result = await directViaRouter(routerFor(input.geminiBeta?{...env,AI_CHAIN:"gemini",GEMINI_AI_MODEL:"gemini-3.6-flash",AI_ALLOW_PAID:"0"}:env, budget, fetch, events), sources, {
    form: input.form,
  });
  if (!result.ok) {
    const why =
      result.stage === "provider"
        ? `provedor: ${result.failure.failures.map((f) => `${f.target}=${f.problem}`).join(", ")}`
        : result.message;
    return { ok: false as const, reason: why, ...report(budget, events) };
  }
  const { program, direction, title, report: compile } = result.value;
  return {
    ok: true as const,
    title,
    sources,
    directionJson: JSON.stringify(direction),
    programJson: JSON.stringify(program),
    warnings: compile.warnings,
    ...report(budget, events),
  };
}

export async function runDirectionReview(
  raw: unknown,
  env: Env,
  userId: string,
  fetch?: FetchLike,
) {
  const input = reviewInput.parse(raw);
  const sources = sourcesFromScript(input.script);
  const events: AiEvent[] = [],
    budget = budgetFor(`${userId}:${input.videoId}`, env);
  const result: ReviewResult = await reviewDirection({
    router: routerFor(input.geminiBeta?{...env,AI_CHAIN:"gemini",GEMINI_AI_MODEL:"gemini-3.6-flash",AI_ALLOW_PAID:"0"}:env, budget, fetch, events),
    direction: input.direction as unknown as Direction,
    sources,
    frames: input.frames.map((f) => ({ time: f.time, mimeType: f.mimeType, base64: f.base64 })),
  });
  if (result.status === "corrected") {
    const { direction, program, ...rest } = result;
    return {
      ...rest,
      sources,
      directionJson: JSON.stringify(direction),
      programJson: JSON.stringify(program),
      ...report(budget, events),
    };
  }
  return { ...result, ...report(budget, events) };
}
