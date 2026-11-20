import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { cooldownSecondsRemaining, ai3dCooldownMessage } from './ai3dCooldown';
import { CODE3D_MAX_SCRIPT_CHARS, CODE3D_MIN_SCRIPT_CHARS } from './code3d/contract';

const input = z.object({
  script: z.string().trim().min(CODE3D_MIN_SCRIPT_CHARS).max(CODE3D_MAX_SCRIPT_CHARS),
  aspect: z.enum(['9:16', '16:9']),
}).strict();

// Signed-in users only; one Gemini call per click; separate window from the JSON 3D mode.
const inFlight = new Set<string>();
const lastRequest = new Map<string, number>();

export const generateCode3D = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const now = Date.now();
    if (inFlight.has(userId)) return { ok: false as const, failure: 'busy', model: '', message: 'Uma geração sua já está em andamento.' };
    const retryIn = cooldownSecondsRemaining(lastRequest.get(userId) || 0, now);
    if (retryIn > 0) return { ok: false as const, failure: 'cooldown', model: '', message: ai3dCooldownMessage(retryIn) };
    inFlight.add(userId);
    lastRequest.set(userId, now);
    try {
      const { generateCode3DWithGemini } = await import('./server/code3dGemini');
      return await generateCode3DWithGemini(data.script, data.aspect);
    } finally {
      inFlight.delete(userId);
      if (lastRequest.size > 2000) lastRequest.clear();
    }
  });
