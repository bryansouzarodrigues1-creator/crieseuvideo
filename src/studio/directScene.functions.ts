import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { directInput, reviewInput } from "./server/directionService";

// First-line guards only (in memory): one planning and one review in flight per user; the real spending cap is the
// per-video AI budget inside the service (AI_VIDEO_MAX_CALLS) and the providers' own limits.
const busy = new Set<string>();
const guard = async <T>(user: string, run: () => Promise<T>): Promise<T> => {
  if (busy.has(user)) throw Error("Uma geração sua já está em andamento.");
  busy.add(user);
  try {
    return await run();
  } finally {
    busy.delete(user);
  }
};

/** Plan + compile a scene with the unified direction (any configured provider, High, shared video budget). */
export const directScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => directInput.parse(data))
  .handler(({ data, context }) =>
    guard(context.userId, async () => {
      const { runDirection } = await import("./server/directionService");
      return runDirection(data, process.env, context.userId);
    }),
  );

/** Visual review of frames rendered by the engine; draws from the same per-video budget as directScene. */
export const reviewDirectedScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => reviewInput.parse(data))
  .handler(({ data, context }) =>
    guard(context.userId, async () => {
      const { runDirectionReview } = await import("./server/directionService");
      return runDirectionReview(data, process.env, context.userId);
    }),
  );
