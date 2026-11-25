/* eslint-disable @typescript-eslint/no-explicit-any -- provider payloads are untyped external JSON, read defensively */
import { parseRetryAfter, problemFromStatus } from "./problems";
import type {
  AiRequest,
  Attempt,
  FetchLike,
  ProviderFn,
  ProviderTarget,
  Thinking,
  Usage,
} from "./types";

const DEFAULT_TIMEOUT = 120_000;
const maxTokens = (r: AiRequest) => Math.max(256, Math.min(r.maxOutputTokens ?? 4096, 32_768));
const JSON_SUFFIX = "\n\nResponda somente com JSON válido.";

async function send(
  target: ProviderTarget,
  request: AiRequest,
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  read: (
    data: any,
  ) =>
    | Omit<Extract<Attempt, { ok: true }>, "latencyMs">
    | { problem: "empty_response" | "truncated_response" | "refused" | "invalid_response" },
): Promise<Attempt> {
  const started = Date.now(),
    ctrl = new AbortController(),
    timer = setTimeout(() => ctrl.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT);
  const elapsed = () => Date.now() - started;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...target.headers, ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok)
      return {
        ok: false,
        problem: problemFromStatus(res.status),
        status: res.status,
        retryAfterMs: parseRetryAfter(res.headers?.get?.("retry-after")),
        latencyMs: elapsed(),
      };
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return { ok: false, problem: "invalid_response", status: res.status, latencyMs: elapsed() };
    }
    const out = read(data);
    return "problem" in out
      ? { ok: false, problem: out.problem, status: res.status, latencyMs: elapsed() }
      : { ...out, latencyMs: elapsed() };
  } catch (error) {
    return {
      ok: false,
      problem: error instanceof Error && error.name === "AbortError" ? "timeout" : "network",
      latencyMs: elapsed(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Gemini 3.x takes thinkingLevel; 2.5 takes a token budget. */
const geminiThinking = (model: string, level: Thinking | undefined): Record<string, unknown> => {
  const l = level ?? "low";
  if (/^gemini-2\.5/.test(model))
    return {
      thinkingConfig: { thinkingBudget: { minimal: 0, low: 1024, medium: 4096, high: -1 }[l] },
    };
  return { thinkingConfig: { thinkingLevel: l } };
};

export const gemini: ProviderFn = (target, request, fetchImpl) => {
  const json = request.json !== false;
  const parts: unknown[] = [
    ...(request.images ?? []).map((i) => ({
      inlineData: { mimeType: i.mimeType, data: i.base64 },
    })),
    { text: request.prompt + (json ? JSON_SUFFIX : "") },
  ];
  const body = {
    ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
    contents: [{ role: "user", parts }],
    generationConfig: {
      ...(json ? { responseMimeType: "application/json" } : {}),
      ...(json && request.schema ? { responseSchema: request.schema } : {}),
      maxOutputTokens: maxTokens(request),
      ...geminiThinking(target.model, request.thinking),
    },
  };
  const base = target.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  return send(
    target,
    request,
    fetchImpl,
    `${base}/models/${target.model}:generateContent`,
    { "x-goog-api-key": target.apiKey ?? "" },
    body,
    (data) => {
      if (data?.promptFeedback?.blockReason) return { problem: "refused" };
      const candidate = data?.candidates?.[0];
      if (!candidate) return { problem: "empty_response" };
      if (candidate.finishReason === "MAX_TOKENS") return { problem: "truncated_response" };
      if (
        ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(
          candidate.finishReason,
        )
      )
        return { problem: "refused" };
      const text = (candidate.content?.parts ?? [])
        .filter((p: any) => typeof p?.text === "string" && !p.thought)
        .map((p: any) => p.text)
        .join("");
      if (!text.trim()) return { problem: "empty_response" };
      const u = data.usageMetadata ?? {},
        usage: Usage = {
          inputTokens: u.promptTokenCount ?? 0,
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        };
      return { ok: true, text, usage };
    },
  );
};

/** OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Together…: anything speaking /chat/completions. */
export const openaiCompatible: ProviderFn = (target, request, fetchImpl) => {
  const json = request.json !== false,
    mode = target.structured ?? "json_object";
  const content: unknown = request.images?.length
    ? [
        ...request.images.map((i) => ({
          type: "image_url",
          image_url: { url: `data:${i.mimeType};base64,${i.base64}` },
        })),
        { type: "text", text: request.prompt + (json ? JSON_SUFFIX : "") },
      ]
    : request.prompt + (json ? JSON_SUFFIX : "");
  const body: Record<string, unknown> = {
    model: target.model,
    messages: [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      { role: "user", content },
    ],
    max_completion_tokens: maxTokens(request),
    ...(json && mode === "json_schema" && request.schema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName ?? "answer", schema: request.schema },
          },
        }
      : {}),
    ...(json && (mode === "json_object" || (mode === "json_schema" && !request.schema))
      ? { response_format: { type: "json_object" } }
      : {}),
    // gpt-oss style reasoning models spend the output budget thinking: keep it explicit and low unless asked.
    ...(target.reasoning
      ? { reasoning_effort: request.thinking === "minimal" ? "low" : (request.thinking ?? "low") }
      : {}),
  };
  const base = (target.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return send(
    target,
    request,
    fetchImpl,
    `${base}/chat/completions`,
    { authorization: `Bearer ${target.apiKey ?? ""}` },
    body,
    (data) => {
      const choice = data?.choices?.[0];
      if (!choice) return { problem: "empty_response" };
      if (choice.finish_reason === "length") return { problem: "truncated_response" };
      if (choice.finish_reason === "content_filter" || choice.message?.refusal)
        return { problem: "refused" };
      const text = typeof choice.message?.content === "string" ? choice.message.content : "";
      if (!text.trim()) return { problem: "empty_response" };
      const u = data.usage ?? {};
      return {
        ok: true,
        text,
        usage: { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 },
      };
    },
  );
};

/** Anthropic Messages API. With a schema, a forced tool call guarantees parseable JSON (no prose, no fences). */
export const anthropic: ProviderFn = (target, request, fetchImpl) => {
  const json = request.json !== false,
    useTool = json && !!request.schema,
    tokens = maxTokens(request);
  const content = [
    ...(request.images ?? []).map((i) => ({
      type: "image",
      source: { type: "base64", media_type: i.mimeType, data: i.base64 },
    })),
    { type: "text", text: request.prompt + (json && !useTool ? JSON_SUFFIX : "") },
  ];
  const body: Record<string, unknown> = {
    model: target.model,
    max_tokens: tokens,
    ...(request.system ? { system: request.system } : {}),
    messages: [{ role: "user", content }],
    ...(useTool
      ? {
          tools: [
            {
              name: request.schemaName ?? "answer",
              description: "Entregue a resposta final neste formato.",
              input_schema: request.schema,
            },
          ],
          tool_choice: { type: "tool", name: request.schemaName ?? "answer" },
        }
      : {}),
    // Extended thinking cannot be combined with a forced tool call, and needs room under max_tokens.
    ...(!useTool && request.thinking === "high" && tokens >= 4096
      ? { thinking: { type: "enabled", budget_tokens: Math.min(8000, tokens - 1024) } }
      : {}),
  };
  const base = (target.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  return send(
    target,
    request,
    fetchImpl,
    `${base}/v1/messages`,
    { "x-api-key": target.apiKey ?? "", "anthropic-version": "2023-06-01" },
    body,
    (data) => {
      if (data?.stop_reason === "max_tokens") return { problem: "truncated_response" };
      if (data?.stop_reason === "refusal") return { problem: "refused" };
      const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
      const tool = blocks.find((b) => b?.type === "tool_use");
      const text = tool
        ? JSON.stringify(tool.input)
        : blocks
            .filter((b) => b?.type === "text")
            .map((b) => b.text)
            .join("");
      if (!text.trim()) return { problem: "empty_response" };
      const u = data.usage ?? {};
      return {
        ok: true,
        text,
        usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0 },
      };
    },
  );
};

export const PROVIDERS: Record<ProviderTarget["kind"], ProviderFn> = {
  gemini,
  "openai-compatible": openaiCompatible,
  anthropic,
};
