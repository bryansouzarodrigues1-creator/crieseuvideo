import { DirectorError } from '../src/studio/server/director';

/**
 * Minimal, private and bounded diagnostic of one failed Gemini trial.
 * Never persist raw model output, request bodies, JWTs, or API credentials.
 * Only a server-generated DirectorError may contribute a message.
 */
export function summarizeGeminiTrialFailure(error: unknown, requestsSent: number) {
  const director = error instanceof DirectorError ? error : null;
  const category = director?.code || 'validation_failed';
  const hasInertCandidate = Boolean(director?.candidate);
  const phase = category === 'invalid_scene_program'
    ? hasInertCandidate ? 'program_validation' : 'missing_or_malformed_program'
    : category === 'source_mismatch' ? 'script_grounding'
    : category === 'validation_failed' ? 'unknown_validation'
    : 'provider_or_request';
  const safeText = director?.message
    .replace(/AQ\.[a-zA-Z0-9_-]{12,}|AIza[a-zA-Z0-9_-]{12,}/g, '[REDACTED]')
    .slice(0, 500) || null;
  return {
    state: 'REJECTED' as const,
    code: category,
    phase,
    validatorMessage: safeText,
    hasInertCandidate,
    callsMade: requestsSent,
    retried: false,
    noRenderingAttempted: true,
    source: 'ONE_REAL_GEMINI_RESPONSE' as const,
  };
}
