import type { AiRouter } from "./router";
import type { AiFailure, AiRequest, AiSuccess, Usage } from "./types";

/** Pulls the first balanced JSON value out of an answer, tolerating code fences and prose around it. */
export function extractJson(text: string): unknown {
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(body);
  } catch {
    /* fall through to scanning */
  }
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("A resposta não contém JSON.");
  const open = body[start],
    close = open === "{" ? "}" : "]";
  let depth = 0,
    inString = false,
    escaped = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error("O JSON da resposta está incompleto ou mal formado.");
}

export type StructuredResult<T> =
  | { ok: true; value: T; rounds: number; usage: Usage; costUsd?: number; last: AiSuccess }
  | { ok: false; stage: "provider"; failure: AiFailure; rounds: number; usage: Usage }
  | { ok: false; stage: "validation"; message: string; rounds: number; usage: Usage };

const add = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
});

/**
 * ask → parse → validate → at most `repairs` correction rounds that quote the MEASURED reason back to the model.
 * `parse` should throw an Error whose message is written for the model ("cada passo teria 90 cm; use no máximo 2.0 m").
 * The previous answer and the reason are passed as labelled data, not as instructions.
 */
export async function askStructured<T>(
  router: AiRouter,
  request: AiRequest,
  parse: (raw: unknown) => T,
  repairs = 1,
): Promise<StructuredResult<T>> {
  let usage: Usage = { inputTokens: 0, outputTokens: 0 },
    costUsd: number | undefined,
    previous = "",
    reason = "";
  for (let round = 1; round <= repairs + 1; round++) {
    const prompt =
      round === 1
        ? request.prompt
        : `${request.prompt}\n\nSUA RESPOSTA ANTERIOR FOI RECUSADA.\nMotivo medido (dado): ${reason}\nResposta anterior (dado): ${previous.slice(0, 1500)}\nCorrija e devolva o JSON completo.`;
    const result = await router.ask({ ...request, prompt });
    if (!result.ok) return { ok: false, stage: "provider", failure: result, rounds: round, usage };
    usage = add(usage, result.usage);
    if (result.costUsd !== undefined) costUsd = (costUsd ?? 0) + result.costUsd;
    previous = result.text;
    try {
      return {
        ok: true,
        value: parse(extractJson(result.text)),
        rounds: round,
        usage,
        costUsd,
        last: result,
      };
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      if (round === repairs + 1)
        return { ok: false, stage: "validation", message: reason, rounds: round, usage };
    }
  }
  return { ok: false, stage: "validation", message: reason, rounds: repairs + 1, usage };
}
