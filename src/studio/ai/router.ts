import { cooldownMs, isTransient } from "./problems";
import { PROVIDERS } from "./providers";
import {
  lowerThinking,
  type AiFailureNote,
  type AiRequest,
  type AiResult,
  type FetchLike,
  type Problem,
  type ProviderTarget,
  type Usage,
} from "./types";

export interface AiEvent {
  target: string;
  model: string;
  ok: boolean;
  problem?: Problem;
  status?: number;
  usage?: Usage;
  latencyMs?: number;
  costUsd?: number;
  attempt: number;
  note?: string;
}
export interface QuotaStore {
  count(key: string): number;
  increment(key: string): void;
}
export const memoryQuota = (): QuotaStore => {
  const m = new Map<string, number>();
  return { count: (k) => m.get(k) ?? 0, increment: (k) => void m.set(k, (m.get(k) ?? 0) + 1) };
};

export interface RouterOptions {
  chain: ProviderTarget[];
  fetch?: FetchLike;
  /** Spending guard: providers flagged paid are skipped unless this is true. */
  allowPaid?: boolean;
  maxAttemptsPerTarget?: number;
  /** Hard cap of HTTP calls per ask() across all providers. */
  maxCalls?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onEvent?: (event: AiEvent) => void;
  quota?: QuotaStore;
  cooldowns?: Map<string, number>;
  random?: () => number;
}

const cost = (t: ProviderTarget, u: Usage) =>
  t.price
    ? +((u.inputTokens * t.price.inputPerM + u.outputTokens * t.price.outputPerM) / 1e6).toFixed(6)
    : undefined;

/**
 * Ordered providers with the behaviours a real deployment needs and the repo lacked:
 *  - 5xx / timeout / network: retry the SAME provider with exponential backoff + jitter (a 503 "high demand" is usually gone in seconds)
 *  - truncated answer: retry once with doubled output budget and lower reasoning (reasoning ate the budget before)
 *  - 429: pause that provider, move to the next, never hammer
 *  - paid providers are never reached unless allowPaid
 *  - local daily request counters for free tiers, so we stop before the provider has to say no
 */
export function createRouter(options: RouterOptions) {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now,
    rand = options.random ?? Math.random;
  const quota = options.quota ?? memoryQuota(),
    cooldowns = options.cooldowns ?? new Map<string, number>();
  const fetchImpl: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const perTarget = options.maxAttemptsPerTarget ?? 3,
    maxCalls = options.maxCalls ?? 8;
  const day = () => new Date(now()).toISOString().slice(0, 10);

  async function ask(request: AiRequest): Promise<AiResult> {
    const failures: AiFailureNote[] = [];
    let calls = 0,
      last: AiFailureNote | undefined;
    const note = (t: ProviderTarget, problem: Problem, status?: number) => {
      last = { target: t.id, model: t.model, problem, status };
      failures.push(last);
    };
    for (const target of options.chain) {
      const ref = { id: target.id, model: target.model };
      const skip = (problem: Problem, why: string) => {
        note(target, problem);
        options.onEvent?.({
          target: target.id,
          model: target.model,
          ok: false,
          problem,
          attempt: 0,
          note: why,
        });
      };
      if (!target.apiKey) {
        skip("not_configured", "sem chave");
        continue;
      }
      if (target.paid && !options.allowPaid) {
        skip("paid_blocked", "provedor pago sem autorização");
        continue;
      }
      if ((cooldowns.get(target.id) ?? 0) > now()) {
        skip("cooling_down", "em pausa");
        continue;
      }
      if (
        target.dailyRequests !== undefined &&
        quota.count(`${target.id}:${target.model}:${day()}`) >= target.dailyRequests
      ) {
        skip("local_limit", "limite diário local");
        continue;
      }
      let req = request,
        adapted = false;
      for (let attempt = 1; attempt <= perTarget; attempt++) {
        if (calls >= maxCalls) {
          note(target, "local_limit");
          return { ok: false, problem: "local_limit", target: ref, attempts: calls, failures };
        }
        calls++;
        quota.increment(`${target.id}:${target.model}:${day()}`);
        const result = await PROVIDERS[target.kind](target, req, fetchImpl);
        if (result.ok) {
          const costUsd = cost(target, result.usage);
          options.onEvent?.({
            target: target.id,
            model: target.model,
            ok: true,
            usage: result.usage,
            latencyMs: result.latencyMs,
            costUsd,
            attempt,
          });
          return {
            ok: true,
            text: result.text,
            target: ref,
            usage: result.usage,
            latencyMs: result.latencyMs,
            costUsd,
            attempts: calls,
          };
        }
        options.onEvent?.({
          target: target.id,
          model: target.model,
          ok: false,
          problem: result.problem,
          status: result.status,
          latencyMs: result.latencyMs,
          attempt,
        });
        if (result.problem === "truncated_response" && !adapted) {
          adapted = true;
          attempt--; // the adapted retry does not use up the transient-retry budget
          req = {
            ...req,
            maxOutputTokens: Math.min((req.maxOutputTokens ?? 4096) * 2, 32_768),
            thinking: lowerThinking(req.thinking),
          };
          continue;
        }
        if (isTransient(result.problem) && attempt < perTarget) {
          const backoff = Math.min(
            (options.baseDelayMs ?? 600) * 2 ** (attempt - 1),
            options.maxDelayMs ?? 8000,
          );
          await sleep(Math.max(result.retryAfterMs ?? 0, backoff * (0.75 + rand() * 0.5)));
          continue;
        }
        note(target, result.problem, result.status);
        const pause = cooldownMs(result.problem, result.retryAfterMs);
        if (pause) cooldowns.set(target.id, now() + pause);
        break;
      }
    }
    const final = last ?? { target: "none", model: "", problem: "not_configured" as Problem };
    return {
      ok: false,
      problem: final.problem,
      status: final.status,
      target: { id: final.target, model: final.model },
      attempts: calls,
      failures,
    };
  }
  return { ask, cooldowns, quota };
}
export type AiRouter = ReturnType<typeof createRouter>;
