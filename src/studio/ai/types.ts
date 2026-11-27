/**
 * Provider-agnostic AI layer. Every pipeline (3D, Motion 2D, Cinema 2D, semantic direction) asks the same way,
 * so quota handling, retries, structured output and cost accounting are written once and tested once.
 */
export type Thinking = "minimal" | "low" | "medium" | "high";
export type ProviderKind = "gemini" | "openai-compatible" | "anthropic";

export interface AiImage {
  mimeType: string;
  base64: string;
}
export interface AiRequest {
  prompt: string;
  system?: string;
  /** Ask for JSON. Default true: every engine contract here is JSON. */
  json?: boolean;
  /** JSON Schema of the answer. Used natively where the provider supports it (Gemini responseSchema, Anthropic forced tool). */
  schema?: Record<string, unknown>;
  schemaName?: string;
  maxOutputTokens?: number;
  /** Reasoning budget. Default 'low': hidden reasoning shares the output budget and truncated real answers before. */
  thinking?: Thinking;
  timeoutMs?: number;
  images?: AiImage[];
}

export interface ProviderTarget {
  /** Label shown in logs and used for cooldowns, e.g. "gemini", "groq". */
  id: string;
  kind: ProviderKind;
  model: string;
  apiKey: string | undefined;
  baseUrl?: string;
  /** Anything that can spend money must say so: the router never falls through to it unless allowPaid is set. */
  paid: boolean;
  /**
   * What we KNOW about billing. "free" = the model id itself is free (e.g. an OpenRouter ":free" model).
   * "unverified" = the key's account might have billing enabled, so a free-tier cap is not guaranteed; it is only
   * reachable under the local daily cap (and is blocked when the router runs with requireVerifiedFree).
   * "paid" = costs money. Absent means "free".
   */
  billing?: "free" | "unverified" | "paid";
  /** Price per million tokens, to estimate cost. Unknown price → cost is reported as undefined, never guessed. */
  price?: { inputPerM: number; outputPerM: number };
  /** Free tiers publish daily request caps; counting locally avoids burning 429s. */
  dailyRequests?: number;
  /**
   * Can this model read images? Gemini and Anthropic: yes. OpenAI-compatible hosts: NO unless proven (<ID>_VISION=1 after a real
   * call). A request with images skips a target that cannot see, without spending a call.
   */
  vision?: boolean;
  /** OpenAI-compatible only. */
  structured?: "json_schema" | "json_object" | "none";
  reasoning?: boolean;
  headers?: Record<string, string>;
}

export type Problem =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "quota"
  | "billing_required"
  | "model_unavailable"
  | "invalid_request"
  | "service_unavailable"
  | "timeout"
  | "network"
  | "empty_response"
  | "truncated_response"
  | "refused"
  | "invalid_response"
  | "local_limit"
  | "paid_blocked"
  | "unverified_blocked"
  | "budget_exhausted"
  | "cooling_down"
  | "no_vision";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
export interface TargetRef {
  id: string;
  model: string;
}
export interface AiSuccess {
  ok: true;
  text: string;
  target: TargetRef;
  usage: Usage;
  latencyMs: number;
  costUsd?: number;
  attempts: number;
}
export interface AiFailure {
  ok: false;
  problem: Problem;
  target: TargetRef;
  status?: number;
  retryAfterMs?: number;
  attempts: number;
  failures: AiFailureNote[];
}
export interface AiFailureNote {
  target: string;
  model: string;
  problem: Problem;
  status?: number;
}
export type AiResult = AiSuccess | AiFailure;

/** One HTTP attempt. Providers never retry; the router decides. */
export type Attempt =
  | { ok: true; text: string; usage: Usage; latencyMs: number }
  | { ok: false; problem: Problem; status?: number; retryAfterMs?: number; latencyMs: number };

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<Pick<Response, "ok" | "status" | "headers" | "json">>;
export type ProviderFn = (
  target: ProviderTarget,
  request: AiRequest,
  fetchImpl: FetchLike,
) => Promise<Attempt>;

export const THINKING_ORDER: Thinking[] = ["minimal", "low", "medium", "high"];
export const lowerThinking = (level: Thinking | undefined): Thinking =>
  THINKING_ORDER[Math.max(0, THINKING_ORDER.indexOf(level ?? "low") - 1)];
/**
 * High is a product decision (quality of the direction), so a truncated answer never silently downgrades it:
 * the fix for truncation at High is more output room, not less thinking. Lower levels may still step down.
 */
export const thinkingAfterTruncation = (level: Thinking | undefined): Thinking =>
  level === "high" ? "high" : lowerThinking(level);
