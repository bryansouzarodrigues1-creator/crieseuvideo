import type { AiRouter } from "../../../ai/router";
import type { StructuredResult } from "../../../ai/structured";
import { directViaRouter, type DirectedScene } from "../direction/viaRouter";
import type { ProgramSource } from "../score";

export type SemanticDirection = DirectedScene;

/** Compact semantic form of the unified direction path (kept as a named entry for callers and the smoke script). */
export function directSemanticViaRouter(
  router: AiRouter,
  sources: ProgramSource[],
  extra = "",
): Promise<StructuredResult<SemanticDirection>> {
  return directViaRouter(router, sources, { form: "compact", extra });
}
