import { DirectorError } from '../src/studio/server/director';
import { locateInvalidSceneNumber } from './gemini-3d-numeric-locator';

/** Reports only a schema location and a scrubbed field name.
 * Raw model values, arbitrary payload strings and credentials never leave memory. */
export function locateUnsupportedSceneField(candidate: {program: Record<string, unknown>} | undefined) {
  const root = candidate?.program;
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const check = (value: unknown, path: string, allowed: readonly string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const key = Object.keys(value).find((k) => !allowed.includes(k));
    if (key === undefined) return null;
    const property = /^[a-z][a-z0-9_]{0,31}$/i.test(key)
      && !/(secret|token|password|api_?key|auth|prompt|credential)/i.test(key) ? key : 'redacted';
    return { path, property };
  };
  const inspectList = (name: string, allowed: readonly string[], nested?: Record<string, readonly string[]>) => {
    const array = root[name];
    if (!Array.isArray(array)) return null;
    for (let i = 0; i < Math.min(256, array.length); i++) {
      const item = array[i], path = name + '[' + i + ']';
      const unexpected = check(item, path, allowed);
      if (unexpected) return unexpected;
      if (nested && item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [field, keys] of Object.entries(nested)) {
          const detail = check((item as Record<string, unknown>)[field], path + '.' + field, keys);
          if (detail) return detail;
        }
      }
    }
    return null;
  };
  return check(root, 'sceneProgram', ['version','sourceSignature','background','nodes','tracks','shots','contacts','motionChecks'])
    || inspectList('nodes', ['id','kind','parent','socket','position','rotation','scale','color','geometry','repeat','evidence','contextSourceId','material','assetId'], {
      geometry:['shape','size','vertices','indices','colors','points','profile','segments'],
      repeat:['count','step','jitter','seed'],
      material:['roughness','metalness','opacity','emissive','emissiveIntensity'],
    })
    || inspectList('tracks', ['node','channel','interpolation','keys'], {})
    || (Array.isArray(root.tracks) ? root.tracks.slice(0, 256).flatMap((t: unknown, i: number) =>
      t && typeof t === 'object' && !Array.isArray(t) && Array.isArray((t as any).keys)
        ? (t as any).keys.slice(0,160).map((k: unknown, j: number) => check(k, 'tracks['+i+'].keys['+j+']', ['sourceId','phase','value'])).filter(Boolean) : [])[0] ?? null : null)
    || inspectList('shots', ['sourceId','subjects','azimuth','endAzimuth','elevation','distance'])
    || inspectList('contacts', ['sourceId','actor','effector','target','offset','begin','end'])
    || inspectList('motionChecks', ['sourceId','node','channel','kind','startPhase','endPhase','threshold']);
}

/**
 * Minimal, private and bounded diagnostic of one failed Gemini trial.
 * Never persist raw model output, request bodies, JWTs, or API credentials.
 * Only a server-generated DirectorError may contribute a message.
 */
export function summarizeGeminiTrialFailure(error: unknown, requestsSent: number) {
  const director = error instanceof DirectorError ? error : null;
  const category = director?.code || 'validation_failed';
  const hasInertCandidate = Boolean(director?.candidate);
  const numericViolation = locateInvalidSceneNumber(director?.candidate);
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
    ...(numericViolation ? {numericViolation} : {}),
    ...(director?.code === 'invalid_scene_program' && director.message.includes('campo não suportado')
      ? { unsupportedField: locateUnsupportedSceneField(director.candidate) } : {}),
    ...(director?.structure ? { structure: director.structure } : {}),
    callsMade: requestsSent,
    retried: false,
    noRenderingAttempted: true,
    source: 'ONE_REAL_GEMINI_RESPONSE' as const,
  };
}
