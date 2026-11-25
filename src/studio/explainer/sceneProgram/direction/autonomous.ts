/**
 * The autonomous loop: plan → animate → see → correct → export, on ONE engine and ONE per-video budget.
 *
 * Everything that needs the browser (rendering real frames, exporting the MP4) is injected, so this orchestration is
 * the same on the server, in the studio and in the Playwright QA, and is testable without a GPU or an API key.
 * Failure policy: a failed plan stops (nothing to export); a failed/rejected REVIEW never blocks the video, the
 * original direction is exported; the budget is the hard stop for AI spending.
 */
import type { AiRouter } from "../../../ai/router";
import { PROBLEM_PT } from "../../../ai/problems";
import type { ProgramSource } from "../score";
import type { Direction } from "./direction";
import { reviewDirection, type ReviewFrame, type ReviewResult } from "./visualReview";
import { directViaRouter, type DirectedScene, type DirectOptions } from "./viaRouter";

export interface AutonomousDeps {
  router: AiRouter;
  sources: ProgramSource[];
  direct?: DirectOptions;
  /** Engine validators (contacts, IK reach, penetration). Throw/return messages written for the model; they feed the measured repair. */
  measure?: (program: DirectedScene["program"]) => string[];
  /** Real frames from the engine (3–7). Absent → no visual review. */
  renderFrames?: (scene: DirectedScene) => Promise<ReviewFrame[]>;
  exportVideo: (scene: DirectedScene) => Promise<{ ref: string }>;
  review?: boolean;
  onStage?: (stage: "plan" | "render" | "review" | "export", info: string) => void;
}
export interface AutonomousResult {
  status: "exported" | "failed";
  stage?: "plan" | "render" | "export";
  reason?: string;
  scene?: DirectedScene;
  review: "skipped" | ReviewResult["status"];
  reviewIssues: string[];
  reviewReason?: string;
  exportRef?: string;
  direction?: Direction;
  aiCalls: number;
}

export async function produceDirectedVideo(deps: AutonomousDeps): Promise<AutonomousResult> {
  const { router, sources } = deps;
  const calls = () => router.budget?.used().calls ?? 0;
  deps.onStage?.("plan", "direção pelo modelo");
  const planned = await directViaRouter(router, sources, {
    ...deps.direct,
    validate: (scene) => {
      const problems = deps.measure?.(scene.program) ?? [];
      if (problems.length) throw new Error(problems.slice(0, 4).join(" | "));
    },
  });
  if (!planned.ok) {
    const reason =
      planned.stage === "provider" ? PROBLEM_PT[planned.failure.problem] : planned.message;
    return {
      status: "failed",
      stage: "plan",
      reason,
      review: "skipped",
      reviewIssues: [],
      aiCalls: calls(),
    };
  }
  let scene = planned.value;
  let review: AutonomousResult["review"] = "skipped",
    reviewIssues: string[] = [],
    reviewReason: string | undefined;
  if (deps.review !== false && deps.renderFrames) {
    deps.onStage?.("render", "quadros reais do motor");
    let frames: ReviewFrame[] = [];
    try {
      frames = await deps.renderFrames(scene);
    } catch (e) {
      review = "failed";
      reviewReason =
        "Não foi possível renderizar quadros: " + (e instanceof Error ? e.message : String(e));
    }
    if (frames.length) {
      deps.onStage?.("review", "revisão visual");
      const result = await reviewDirection({
        router,
        direction: scene.direction,
        sources,
        frames,
        measure: deps.measure,
      });
      review = result.status;
      reviewIssues = result.issues;
      if (result.status === "corrected")
        scene = {
          ...scene,
          direction: result.direction,
          program: result.program,
          report: result.report,
        };
      else reviewReason = result.reason;
    }
  }
  deps.onStage?.("export", "MP4");
  try {
    const { ref } = await deps.exportVideo(scene);
    return {
      status: "exported",
      scene,
      direction: scene.direction,
      review,
      reviewIssues,
      reviewReason,
      exportRef: ref,
      aiCalls: calls(),
    };
  } catch (e) {
    return {
      status: "failed",
      stage: "export",
      reason: e instanceof Error ? e.message : String(e),
      scene,
      review,
      reviewIssues,
      reviewReason,
      aiCalls: calls(),
    };
  }
}
