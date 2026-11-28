/**
 * Measurements taken on the REAL stage (the same SceneProgram3D that renders the video, with the real GLBs) and written
 * for the model: what each camera really shows. They are advisory (see advisory.ts) — never a reason to drop a video.
 *   - subject outside the frame / too small on screen / behind something (ray casting on the actual meshes);
 *   - background so dark that the scene reads as a black frame in a "day" mood.
 * Every message names the sentence, the object and a concrete way to fix it with the direction vocabulary.
 */
import type { ApprovedModelId } from "../modelRegistry";
import type { PreparedModel } from "../modelAssets";
import { type ProgramSource, type SceneProgram } from "../score";
import { SceneProgram3D } from "../stage3d";
import { auditShotVisibilityAt, type ShotVisibilityIssue } from "../shotVisibilityAudit";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const fix = (code: ShotVisibilityIssue, id: string, sourceId: string, area: number, inside: number): string => {
  switch (code) {
    case "subject_offscreen":
      return `${sourceId}: "${id}" fica ${inside < 0.5 ? "quase todo" : "parcialmente"} fora do quadro (${pct(inside)} visível). Aumente distance do plano, ou aproxime "${id}" dos outros assuntos (move), ou tire-o de subjects.`;
    case "subject_too_small":
      if (area < 0.002)
        return `${sourceId}: "${id}" é assunto do plano mas está praticamente invisível (${pct(area)} do quadro: oculto, minúsculo ou atrás de algo). Faça-o aparecer (appear) antes ou use um plano/corte mais próximo dele.`;
      return `${sourceId}: "${id}" ocupa só ${pct(area)} do quadro. Use um plano só com "${id}" (subjects: ["${id}"]) ou um corte (cuts) mais próximo (distance perto de 1).`;
    case "possible_occlusion":
      return `${sourceId}: "${id}" está atrás de outro objeto neste plano. Mude o azimuth/elevation do plano (ou do corte), ou afaste o objeto da frente (move/vanish).`;
    default:
      return `${sourceId}: "${id}" não tem geometria visível neste plano; confirme que ele aparece (appear) antes da câmera enquadrá-lo.`;
  }
};

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export function stageProblems(
  program: SceneProgram,
  allSources: ProgramSource[],
  models: ReadonlyMap<ApprovedModelId, PreparedModel>,
  aspect = 9 / 16,
): string[] {
  const sources = allSources.slice(0, program.shots.length);
  const out: string[] = [];
  const dark = luminance(program.background) < 0.1;
  if (dark && !["night", "dusk"].includes(program.mood ?? "day"))
    out.push(`Fundo muito escuro (${program.background}) com luz de dia: o quadro fica quase preto. Use um fundo mais claro ou mood "night".`);
  let stage: SceneProgram3D | undefined;
  try {
    stage = new SceneProgram3D(program, sources, models, "technical");
    for (const span of stage.score.spans) {
      const whole = program.shots.find((s) => s.sourceId === span.sourceId)!;
      const phases = [0.12, 0.5, 0.88, ...(whole.cuts ?? []).map((c) => Math.min(0.97, c.from + 0.12))];
      const seen = new Set<string>();
      for (const phase of phases) {
        const report = auditShotVisibilityAt(stage, span.start + phase * span.duration, aspect);
        for (const subject of report.subjects)
          for (const code of subject.issues) {
            const message = fix(code, subject.id, span.sourceId, subject.areaFraction, subject.insideFraction);
            if (!seen.has(message)) {
              seen.add(message);
              out.push(message);
            }
          }
      }
    }
  } catch {
    // The measurement itself must never break a generation.
  } finally {
    stage?.dispose();
  }
  return out;
}
