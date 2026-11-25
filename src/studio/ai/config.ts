import type { ProviderTarget } from "./types";

type Env = Record<string, string | undefined>;

/**
 * Default provider chain from environment variables (keys live in the server environment, never in the repo or chat).
 * Order: AI_CHAIN="gemini,gemini-lite,groq,openrouter,anthropic,openai".
 * Free tiers are paid:false. Anthropic/OpenAI cost money, so they are paid:true and stay blocked unless AI_ALLOW_PAID=1.
 * Model ids change often: every one is overridable, and unverified defaults are marked below.
 */
export function targetsFromEnv(env: Env): { chain: ProviderTarget[]; allowPaid: boolean } {
  const all: Record<string, ProviderTarget> = {
    gemini: {
      id: "gemini",
      kind: "gemini",
      model: env.GEMINI_AI_MODEL || "gemini-3.6-flash",
      apiKey: env.GEMINI_API_KEY,
      paid: false,
      dailyRequests: 20,
    },
    // Flash-Lite had a 500 requests/day free cap when checked; confirm the model id in AI Studio.
    "gemini-lite": {
      id: "gemini-lite",
      kind: "gemini",
      model: env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite",
      apiKey: env.GEMINI_API_KEY,
      paid: false,
      dailyRequests: 500,
    },
    groq: {
      id: "groq",
      kind: "openai-compatible",
      model: env.GROQ_MODEL || "openai/gpt-oss-120b",
      apiKey: env.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      paid: false,
      structured: "json_object",
      reasoning: true,
    },
    openrouter: {
      id: "openrouter",
      kind: "openai-compatible",
      model: env.OPENROUTER_MODEL || "openrouter/free",
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      paid: false,
      structured: "json_object",
      dailyRequests: 50,
    },
    anthropic: {
      id: "anthropic",
      kind: "anthropic",
      model: env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      apiKey: env.ANTHROPIC_API_KEY,
      paid: true,
      price: { inputPerM: 0.1, outputPerM: 0.5 },
    },
  };
  if (env.OPENAI_MODEL)
    all.openai = {
      id: "openai",
      kind: "openai-compatible",
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      paid: true,
      structured: "json_schema",
    };
  const order = (env.AI_CHAIN || "gemini,gemini-lite,groq,openrouter,anthropic")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => all[s]);
  return { chain: order.map((id) => all[id]), allowPaid: env.AI_ALLOW_PAID === "1" };
}
