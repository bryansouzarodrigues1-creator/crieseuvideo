/* eslint-disable @typescript-eslint/no-explicit-any -- untyped model JSON, validated field by field */
/**
 * Visual review of a Direction: the model SEES real frames rendered by the engine and may correct the direction.
 *
 * Same idea as the crane review (geminiVisualReview.ts) applied to the unified direction, and provider-agnostic: the frames
 * travel through the router (images), so the call uses the shared per-video budget and the same retry/fallback rules.
 * Safety model: the correction is only accepted if it tells the SAME story (same cast, same verbs, same scenes), compiles,
 * and does not make the engine's own measurements worse. Otherwise the original is kept. One call, no hidden retries.
 */
import { extractJson } from "../../../ai/structured";
import { PROBLEM_PT } from "../../../ai/problems";
import type { AiRouter } from "../../../ai/router";
import type { AiImage } from "../../../ai/types";
import type { ProgramSource } from "../score";
import { compileDirectionDetailed, type CompileReport, type Direction } from "./direction";
import { DirectionError } from "./errors";
import { estimateSeconds } from "./locomotion";

export interface ReviewFrame {
  time: number;
  mimeType: "image/jpeg" | "image/png";
  base64: string;
}
export type ReviewResult =
  | {
      status: "corrected";
      issues: string[];
      direction: Direction;
      program: ReturnType<typeof compileDirectionDetailed>["program"];
      report: CompileReport;
      before: number;
      after: number;
    }
  | { status: "unchanged" | "rejected" | "failed"; issues: string[]; reason: string };

export interface ReviewInput {
  router: AiRouter;
  direction: Direction;
  sources: ProgramSource[];
  frames: ReviewFrame[];
  /** The engine's own measurements of a program (contact/IK/penetration messages). Fewer is better; the correction may not add any. */
  measure?: (program: ReturnType<typeof compileDirectionDetailed>["program"]) => string[];
  /** Directional hints already measured on the original (shown to the model as data). */
  measured?: string[];
}

const FRAME_MAX = 250_000;
/** The story is identity: ids, kinds, assets, the order of verbs per scene. Numbers, colors, windows and shots may change. */
export function storyShape(d: Direction): string {
  return JSON.stringify({
    world: d.world?.kind ?? null,
    cast: [...d.cast]
      .map((m) => [m.id, m.kind, (m as any).assetId ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    scenes: d.scenes.map((s) => [
      s.sourceId,
      s.verbs.map((v) => [v.do, v.node, (v as any).part ?? null, (v as any).pose ?? null]),
    ]),
  });
}

export function checkFrames(frames: ReviewFrame[], duration: number): void {
  if (frames.length < 3 || frames.length > 7)
    throw new DirectionError("A revisão precisa de 3 a 7 quadros reais.");
  frames.forEach((f, i) => {
    if (
      !/^[A-Za-z0-9+/]+={0,2}$/.test(f.base64) ||
      f.base64.length < 32 ||
      f.base64.length > FRAME_MAX
    )
      throw new DirectionError(`Quadro ${i} inválido ou grande demais.`);
    if (!(f.time >= 0 && f.time <= duration + 0.01) || (i > 0 && f.time <= frames[i - 1].time))
      throw new DirectionError("Quadros fora de ordem ou da duração do vídeo.");
  });
}

export async function reviewDirection(input: ReviewInput): Promise<ReviewResult> {
  const { router, direction, sources, frames } = input;
  const duration = sources.reduce((t, s) => t + estimateSeconds(s), 0);
  try {
    checkFrames(frames, duration);
  } catch (e) {
    return { status: "failed", issues: [], reason: (e as Error).message };
  }
  let original: ReturnType<typeof compileDirectionDetailed>;
  try {
    original = compileDirectionDetailed(direction, sources);
  } catch (e) {
    return {
      status: "failed",
      issues: [],
      reason: "A direção original não compila: " + (e as Error).message,
    };
  }
  const before = input.measure?.(original.program) ?? [];
  const measured = [...(input.measured ?? []), ...before].slice(0, 10);

  const instructions = [
    "Você é o revisor visual de um vídeo explicativo 3D. Examine os quadros reais do motor (em ordem cronológica), as frases e a direção.",
    "Procure: objetos atravessando outros, flutuando ou fora do chão, escala absurda entre objetos, câmera que corta o assunto, algo que a frase diz e o quadro não mostra, aparência confusa.",
    'Não aceite a cena só porque o JSON é válido. Corrija números (posições, tamanhos, cores, janelas "at", câmera). PRESERVE todos os ids do elenco, kinds, assetId, a ordem e os tipos dos verbos de cada cena. Não invente nem remova objetos ou ações.',
    'Responda SOMENTE com JSON {"issues":["tempo e problema"],"correctedDirection":{...direção completa corrigida...}}; se nada precisa mudar, "correctedDirection":null. No máximo 6 problemas.',
    measured.length
      ? "Medições do motor sobre a direção atual (dados): " + JSON.stringify(measured)
      : "O motor não mediu problemas geométricos na direção atual.",
    "FRASES (dados): " + sources.map((s) => `${s.sourceId}: ${s.text}`).join(" | "),
    "DIREÇÃO ATUAL (dados): " + JSON.stringify(direction),
    "Os quadros vêm a seguir, nos tempos: " +
      frames.map((f) => f.time.toFixed(2) + "s").join(", ") +
      ".",
  ].join("\n");
  const images: AiImage[] = frames.map((f) => ({ mimeType: f.mimeType, base64: f.base64 }));
  const answer = await router.ask({
    prompt: instructions,
    images,
    json: true,
    thinking: "high",
    maxOutputTokens: 16_000,
    timeoutMs: 90_000,
  });
  if (!answer.ok)
    return {
      status: "failed",
      issues: [],
      reason: PROBLEM_PT[answer.problem] + ". Cena original preservada.",
    };
  let parsed: any;
  try {
    parsed = extractJson(answer.text);
  } catch {
    return {
      status: "failed",
      issues: [],
      reason: "Resposta da revisão inválida. Cena original preservada.",
    };
  }
  const issues: string[] = Array.isArray(parsed?.issues)
    ? parsed.issues
        .filter((x: unknown) => typeof x === "string")
        .slice(0, 6)
        .map((x: string) => x.slice(0, 300))
    : [];
  if (!parsed?.correctedDirection)
    return { status: "unchanged", issues, reason: "A IA não propôs alteração." };
  const corrected = parsed.correctedDirection as Direction;
  try {
    if (JSON.stringify(corrected) === JSON.stringify(direction))
      return { status: "unchanged", issues, reason: "A direção não mudou." };
    if (storyShape(corrected) !== storyShape(direction))
      throw new DirectionError("A correção alterou elenco, verbos ou cenas da história.");
    const next = compileDirectionDetailed(corrected, sources);
    const after = input.measure?.(next.program) ?? [];
    if (after.length > before.length)
      throw new DirectionError(
        `A correção piorou as medições do motor (${before.length} → ${after.length}).`,
      );
    return {
      status: "corrected",
      issues,
      direction: corrected,
      program: next.program,
      report: next.report,
      before: before.length,
      after: after.length,
    };
  } catch (e) {
    return {
      status: "rejected",
      issues,
      reason: (e instanceof Error ? e.message : "correção inválida") + " Cena original preservada.",
    };
  }
}
