/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads are untyped external JSON, read defensively */
import { describe, expect, it } from "vitest";
import {
  askStructured,
  createBudget,
  createRouter,
  extractJson,
  targetsFromEnv,
  type FetchLike,
  type ProviderTarget,
} from "./index";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string>; throws?: Error };
const scripted = (replies: Reply[]) => {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (r.throws) throw r.throws;
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null } as Headers,
      json: async () => r.body,
    };
  };
  return { fetch, calls };
};
const geminiOk = (text: string, extra: Record<string, unknown> = {}) => ({
  body: {
    candidates: [
      {
        content: { parts: [{ text: "pensando…", thought: true }, { text }] },
        finishReason: "STOP",
        ...extra,
      },
    ],
    usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 120, thoughtsTokenCount: 30 },
  },
});
const G: ProviderTarget = {
  id: "gemini",
  kind: "gemini",
  model: "gemini-3.6-flash",
  apiKey: "k-g",
  paid: false,
};
const Q: ProviderTarget = {
  id: "groq",
  kind: "openai-compatible",
  model: "openai/gpt-oss-120b",
  apiKey: "k-q",
  baseUrl: "https://api.groq.com/openai/v1",
  paid: false,
  reasoning: true,
};
const A: ProviderTarget = {
  id: "anthropic",
  kind: "anthropic",
  model: "claude-haiku-5-5",
  apiKey: "k-a",
  paid: true,
  price: { inputPerM: 0.1, outputPerM: 0.5 },
};
const fast = { sleep: async () => {}, random: () => 0.5 };

describe("provider adapters", () => {
  it("gemini: key in header, schema, system, thinkingLevel on 3.x, hidden thoughts dropped, thought tokens counted", async () => {
    const s = scripted([geminiOk('{"a":1}')]);
    const r = await createRouter({ chain: [G], fetch: s.fetch, ...fast }).ask({
      prompt: "p",
      system: "sys",
      schema: { type: "object" },
      thinking: "minimal",
      maxOutputTokens: 900,
    });
    expect(r).toMatchObject({
      ok: true,
      text: '{"a":1}',
      usage: { inputTokens: 700, outputTokens: 150 },
    });
    const c = s.calls[0];
    expect(c.url).toContain("/models/gemini-3.6-flash:generateContent");
    expect(c.headers["x-goog-api-key"]).toBe("k-g");
    expect(c.body.systemInstruction.parts[0].text).toBe("sys");
    expect(c.body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { type: "object" },
      maxOutputTokens: 900,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
  });
  it("gemini 2.5 uses a thinking budget instead of a level", async () => {
    const s = scripted([geminiOk("{}")]);
    await createRouter({
      chain: [{ ...G, model: "gemini-2.5-flash" }],
      fetch: s.fetch,
      ...fast,
    }).ask({ prompt: "p", thinking: "minimal" });
    expect(s.calls[0].body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("openai-compatible: bearer auth, json_object, bounded reasoning", async () => {
    const s = scripted([
      {
        body: {
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        },
      },
    ]);
    const r = await createRouter({ chain: [Q], fetch: s.fetch, ...fast }).ask({
      prompt: "p",
      thinking: "low",
    });
    expect(r.ok && r.text).toBe('{"ok":true}');
    expect(s.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(s.calls[0].headers.authorization).toBe("Bearer k-q");
    expect(s.calls[0].body).toMatchObject({
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_completion_tokens: 4096,
    });
  });
  it("anthropic: forced tool call for schemas returns clean JSON; no thinking with forced tools; cost from price", async () => {
    const s = scripted([
      {
        body: {
          stop_reason: "tool_use",
          content: [{ type: "tool_use", name: "answer", input: { verbs: ["walk"] } }],
          usage: { input_tokens: 700, output_tokens: 150 },
        },
      },
    ]);
    const r = await createRouter({ chain: [A], allowPaid: true, fetch: s.fetch, ...fast }).ask({
      prompt: "p",
      schema: { type: "object" },
      thinking: "high",
      maxOutputTokens: 8000,
    });
    expect(r).toMatchObject({ ok: true, text: '{"verbs":["walk"]}', costUsd: 0.000145 });
    const b = s.calls[0].body;
    expect(s.calls[0].headers["x-api-key"]).toBe("k-a");
    expect(s.calls[0].headers["anthropic-version"]).toBe("2023-06-01");
    expect(b.tool_choice).toEqual({ type: "tool", name: "answer" });
    expect(b.thinking).toBeUndefined();
  });
  it("maps truncation and refusals", async () => {
    expect(
      await createRouter({
        chain: [G],
        fetch: scripted([geminiOk("x", { finishReason: "MAX_TOKENS" })]).fetch,
        maxAttemptsPerTarget: 1,
        ...fast,
      }).ask({ prompt: "p" }),
    ).toMatchObject({ ok: false, problem: "truncated_response" });
    expect(
      await createRouter({
        chain: [G],
        fetch: scripted([{ body: { promptFeedback: { blockReason: "SAFETY" } } }]).fetch,
        ...fast,
      }).ask({ prompt: "p" }),
    ).toMatchObject({ ok: false, problem: "refused" });
  });
});

describe("router", () => {
  it("retries 503 on the same provider with growing backoff, then succeeds", async () => {
    const sleeps: number[] = [],
      s = scripted([{ status: 503 }, { status: 503 }, geminiOk("{}")]);
    const r = await createRouter({
      chain: [G],
      fetch: s.fetch,
      sleep: async (ms) => void sleeps.push(ms),
      random: () => 0.5,
    }).ask({ prompt: "p" });
    expect(r).toMatchObject({ ok: true, attempts: 3 });
    expect(s.calls).toHaveLength(3);
    expect(sleeps).toEqual([600, 1200]);
  });
  it("honours Retry-After and pauses a provider after 429, moving on to the next", async () => {
    const calls: string[] = [],
      router = createRouter({
        chain: [G, Q],
        ...fast,
        now: () => 1_000_000,
        fetch: async (url, init) => {
          calls.push(url);
          return url.includes("googleapis")
            ? {
                ok: false,
                status: 429,
                headers: { get: () => "30" } as unknown as Headers,
                json: async () => ({}),
              }
            : {
                ok: true,
                status: 200,
                headers: { get: () => null } as unknown as Headers,
                json: async () => ({
                  choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
                  usage: {},
                }),
              };
        },
      });
    expect(await router.ask({ prompt: "p" })).toMatchObject({ ok: true, target: { id: "groq" } });
    await router.ask({ prompt: "p" });
    expect(calls.filter((u) => u.includes("googleapis"))).toHaveLength(1); // second ask skipped the paused provider
    expect(router.cooldowns.get("gemini")).toBe(1_000_000 + 30_000);
  });
  it("never reaches a paid provider without permission", async () => {
    const s = scripted([geminiOk("{}")]);
    const r = await createRouter({
      chain: [{ ...G, apiKey: undefined }, A],
      fetch: s.fetch,
      ...fast,
    }).ask({ prompt: "p" });
    expect(r).toMatchObject({ ok: false, problem: "paid_blocked" });
    expect(s.calls).toHaveLength(0);
    expect(r.ok === false && r.failures.map((f) => f.problem)).toEqual([
      "not_configured",
      "paid_blocked",
    ]);
  });
  it("after truncation at HIGH keeps High and doubles the output room instead", async () => {
    const s = scripted([geminiOk("x", { finishReason: "MAX_TOKENS" }), geminiOk('{"ok":1}')]);
    const r = await createRouter({ chain: [G], fetch: s.fetch, ...fast }).ask({
      prompt: "p",
      maxOutputTokens: 2600,
      thinking: "high",
    });
    expect(r.ok).toBe(true);
    expect(s.calls[1].body.generationConfig).toMatchObject({
      maxOutputTokens: 5200,
      thinkingConfig: { thinkingLevel: "high" },
    });
  });
  it("after truncation at a lower level still steps reasoning down one level", async () => {
    const s = scripted([geminiOk("x", { finishReason: "MAX_TOKENS" }), geminiOk('{"ok":1}')]);
    await createRouter({ chain: [G], fetch: s.fetch, ...fast }).ask({
      prompt: "p",
      maxOutputTokens: 2600,
      thinking: "medium",
    });
    expect(s.calls[1].body.generationConfig.thinkingConfig).toMatchObject({ thinkingLevel: "low" });
  });
  it("one shared budget caps a whole video: planning, repair and review draw from the same calls", async () => {
    const s = scripted([geminiOk('{"n":1}')]),
      budget = createBudget({ maxCalls: 3 }),
      router = createRouter({ chain: [G], fetch: s.fetch, budget, ...fast });
    expect((await router.ask({ prompt: "plan" })).ok).toBe(true);
    expect((await router.ask({ prompt: "repair" })).ok).toBe(true);
    expect((await router.ask({ prompt: "review" })).ok).toBe(true);
    const fourth = await router.ask({ prompt: "one more" });
    expect(fourth).toMatchObject({ ok: false, problem: "budget_exhausted" });
    expect(s.calls).toHaveLength(3); // nothing was sent
    expect(budget.used().calls).toBe(3);
  });
  it("retries count against the video budget too, and a structured repair cannot restart it", async () => {
    const s = scripted([{ status: 503 }, geminiOk("not json"), geminiOk("still not json")]),
      budget = createBudget({ maxCalls: 3 }),
      router = createRouter({ chain: [G], fetch: s.fetch, budget, ...fast });
    const r = await askStructured(router, { prompt: "p" }, (raw) => raw, 3);
    expect(r.ok).toBe(false);
    expect(s.calls).toHaveLength(3);
    expect(r.ok === false && r.stage === "provider" && r.failure.problem).toBe("budget_exhausted");
  });
  it("stops when the estimated cost cap is reached", async () => {
    const s = scripted([
        {
          body: {
            content: [{ type: "text", text: "{}" }],
            usage: { input_tokens: 1_000_000, output_tokens: 0 },
          },
        },
      ]),
      budget = createBudget({ maxCalls: 10, maxCostUsd: 0.05 }),
      router = createRouter({ chain: [A], allowPaid: true, fetch: s.fetch, budget, ...fast });
    expect((await router.ask({ prompt: "p" })).ok).toBe(true); // costs 0.10 USD at the configured price
    expect(await router.ask({ prompt: "p" })).toMatchObject({
      ok: false,
      problem: "budget_exhausted",
    });
    expect(s.calls).toHaveLength(1);
  });
  it("refuses unverified free tiers in verified-free mode and still runs confirmed ones", async () => {
    const s = scripted([geminiOk("{}")]);
    const unverified = { ...G, billing: "unverified" as const },
      confirmed = { ...Q, billing: "free" as const };
    const r = await createRouter({
      chain: [unverified, confirmed],
      requireVerifiedFree: true,
      fetch: s.fetch,
      ...fast,
    }).ask({ prompt: "p" });
    expect(r.ok === false && r.failures[0].problem).toBe("unverified_blocked");
    expect(s.calls.every((c) => !c.url.includes("googleapis"))).toBe(true);
  });
  it("counts a free-tier daily cap locally and stops before the provider says no", async () => {
    const s = scripted([geminiOk("{}")]),
      router = createRouter({ chain: [{ ...G, dailyRequests: 2 }], fetch: s.fetch, ...fast });
    await router.ask({ prompt: "p" });
    await router.ask({ prompt: "p" });
    expect(await router.ask({ prompt: "p" })).toMatchObject({ ok: false, problem: "local_limit" });
    expect(s.calls).toHaveLength(2);
  });
  it("caps total HTTP calls per ask and reports every failure", async () => {
    const s = scripted([{ status: 500 }]);
    const r = await createRouter({ chain: [G, Q], fetch: s.fetch, maxCalls: 4, ...fast }).ask({
      prompt: "p",
    });
    expect(s.calls).toHaveLength(4);
    expect(r).toMatchObject({ ok: false, problem: "local_limit" });
  });
  it("reports usage events with cost, without secrets", async () => {
    const events: unknown[] = [],
      s = scripted([
        {
          body: {
            content: [{ type: "text", text: "{}" }],
            usage: { input_tokens: 1000, output_tokens: 100 },
          },
        },
      ]);
    await createRouter({
      chain: [A],
      allowPaid: true,
      fetch: s.fetch,
      onEvent: (e) => events.push(e),
      ...fast,
    }).ask({ prompt: "p" });
    expect(events[0]).toMatchObject({ target: "anthropic", ok: true, costUsd: 0.00015 });
    expect(JSON.stringify(events)).not.toContain("k-a");
  });
});

describe("structured output", () => {
  it("extracts JSON from fences and prose", () => {
    expect(extractJson('```json\n{"a":[1,{"b":"}"}]}\n```')).toEqual({ a: [1, { b: "}" }] });
    expect(extractJson('Claro! Aqui está: {"x":1} espero ajudar')).toEqual({ x: 1 });
    expect(() => extractJson("sem json")).toThrow(/não contém JSON/);
  });
  it("quotes the measured reason back once, then accepts the repaired answer", async () => {
    const prompts: string[] = [],
      replies = ['{"height":4.5}', '{"height":3.1}'];
    const router = {
      ask: async (req: { prompt: string }) => {
        prompts.push(req.prompt);
        return {
          ok: true as const,
          text: replies.shift()!,
          target: { id: "x", model: "m" },
          usage: { inputTokens: 10, outputTokens: 5 },
          latencyMs: 1,
          attempts: 1,
          costUsd: 0.001,
        };
      },
      cooldowns: new Map(),
      quota: undefined as never,
    };
    const r = await askStructured(router as never, { prompt: "faça" }, (raw: any) => {
      if (raw.height > 3.5) throw new Error("cada passo teria 90 cm; use no máximo 3.1 m");
      return raw.height as number;
    });
    expect(r).toMatchObject({
      ok: true,
      value: 3.1,
      rounds: 2,
      usage: { inputTokens: 20, outputTokens: 10 },
      costUsd: 0.002,
    });
    expect(prompts[1]).toContain("Motivo medido (dado): cada passo teria 90 cm");
  });
  it("gives up with the validation message after the repair budget", async () => {
    const router = {
      ask: async () => ({
        ok: true as const,
        text: '{"n":0}',
        target: { id: "x", model: "m" },
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
        attempts: 1,
      }),
    };
    expect(
      await askStructured(
        router as never,
        { prompt: "p" },
        () => {
          throw new Error("inválido");
        },
        1,
      ),
    ).toMatchObject({ ok: false, stage: "validation", message: "inválido", rounds: 2 });
  });
});

describe("config", () => {
  it("builds the free-first chain and blocks paid providers by default", () => {
    const { chain, allowPaid } = targetsFromEnv({
      GEMINI_API_KEY: "g",
      GROQ_API_KEY: "q",
      ANTHROPIC_API_KEY: "a",
    });
    expect(chain.map((t) => t.id)).toEqual([
      "gemini",
      "gemini-lite",
      "groq",
      "openrouter",
      "anthropic",
    ]);
    expect(chain.find((t) => t.id === "anthropic")!.paid).toBe(true);
    expect(allowPaid).toBe(false);
    // a key alone does not prove the account has no billing: unverified until the operator confirms
    expect(chain.find((t) => t.id === "gemini")!.billing).toBe("unverified");
    expect(chain.find((t) => t.id === "groq")!.billing).toBe("unverified");
    expect(targetsFromEnv({ AI_CHAIN: "groq,anthropic", AI_ALLOW_PAID: "1" })).toMatchObject({
      allowPaid: true,
    });
  });
  it("classifies billing from what is known: confirmation, ':free' ids, anything else billed", () => {
    const by = (env: Record<string, string>) =>
      Object.fromEntries(targetsFromEnv(env).chain.map((t) => [t.id, t]));
    expect(by({ GEMINI_BILLING: "free" }).gemini).toMatchObject({ billing: "free", paid: false });
    expect(by({ GEMINI_BILLING: "paid" }).gemini).toMatchObject({ billing: "paid", paid: true });
    expect(by({}).openrouter).toMatchObject({ billing: "free", paid: false });
    expect(by({ OPENROUTER_MODEL: "vendor/model:free" }).openrouter.paid).toBe(false);
    expect(by({ OPENROUTER_MODEL: "anthropic/claude-sonnet-4" }).openrouter).toMatchObject({
      billing: "paid",
      paid: true,
    });
    expect(targetsFromEnv({ AI_REQUIRE_VERIFIED_FREE: "1" }).requireVerifiedFree).toBe(true);
  });
});

describe("vision capability", () => {
  const eyes: ProviderTarget = { id: "gemini", kind: "gemini", model: "gemini-3.6-flash", apiKey: "k", paid: false, billing: "free" };
  const blind: ProviderTarget = { id: "groq", kind: "openai-compatible", model: "openai/gpt-oss-120b", apiKey: "k", baseUrl: "https://api.groq.com/openai/v1", paid: false, billing: "unverified", vision: false };
  const img = [{ mimeType: "image/jpeg" as const, base64: "AAAA" }];
  it("skips a text-only provider when the request has images, without spending a call, and uses the next one", async () => {
    const s = scripted([geminiOk('{"ok":true}')]);
    const router = createRouter({ chain: [blind, eyes], fetch: s.fetch, sleep: async () => {} });
    const r = await router.ask({ prompt: "veja", images: img });
    expect(r.ok).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toContain("generativelanguage");
  });
  it("still uses the text-only provider for requests without images", async () => {
    const s = scripted([{ body: { choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 5 } } }]);
    const router = createRouter({ chain: [blind], fetch: s.fetch, sleep: async () => {} });
    expect((await router.ask({ prompt: "texto" })).ok).toBe(true);
    expect(s.calls).toHaveLength(1);
  });
  it("fails with no_vision when nobody in the chain can see", async () => {
    const s = scripted([geminiOk("x")]);
    const router = createRouter({ chain: [blind], fetch: s.fetch, sleep: async () => {} });
    const r = await router.ask({ prompt: "veja", images: img });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem).toBe("no_vision");
    expect(s.calls).toHaveLength(0);
  });
  it("defaults: Gemini sees, Groq and OpenRouter do not until proven (GROQ_VISION=1)", () => {
    const base = { GEMINI_API_KEY: "a", GROQ_API_KEY: "b", OPENROUTER_API_KEY: "c" };
    const by = (env: Record<string, string>) => Object.fromEntries(targetsFromEnv({ ...base, ...env, AI_CHAIN: "gemini,groq,openrouter" }).chain.map((t) => [t.id, t.vision]));
    expect(by({})).toEqual({ gemini: undefined, groq: false, openrouter: false });
    expect(by({ GROQ_VISION: "1" }).groq).toBe(true);
  });
});
