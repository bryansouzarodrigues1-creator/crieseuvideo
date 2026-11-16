import { describe, expect, it } from 'vitest';
import { DirectorError } from '../src/studio/server/director';
import { summarizeGeminiTrialFailure } from './gemini-trial-diagnostics';

describe('one-shot real Gemini 3D failed trial diagnostics', () => {
  it('distinguishes malformed JSON plan from a scene-program validator rejection', () => {
    const missing = new DirectorError(502, 'invalid_scene_program',
      'A IA não entregou um programa de cena completo. Seu roteiro foi preservado.');
    const report = summarizeGeminiTrialFailure(missing, 1);
    expect(report).toMatchObject({
      state:'REJECTED', code:'invalid_scene_program', phase:'missing_or_malformed_program',
      hasInertCandidate:false, callsMade:1, retried:false,
    });
    const invalid = new DirectorError(502, 'invalid_scene_program',
      'A IA declarou uma ação sem animar a propriedade correspondente.');
    Object.defineProperty(invalid, 'candidate', { value: {sourceSignature:'[]', program:{nodes:[]}}, enumerable:false });
    expect(summarizeGeminiTrialFailure(invalid,1)).toMatchObject({
      phase:'program_validation',hasInertCandidate:true,
    });
  });
  it('does not expose apparent Google credentials in error messages', () => {
    const fake = 'AQ.SomeFakeSecret12345678901234567890';
    const error = new DirectorError(502,'invalid_scene_program','Exemplo ' + fake);
    const result = summarizeGeminiTrialFailure(error,1);
    expect(JSON.stringify(result)).not.toContain(fake);
    expect(result.validatorMessage).toContain('[REDACTED]');
    expect(result.validatorMessage?.length).toBeLessThanOrEqual(500);
  });
  it('does not log non-director error strings or model response bodies', () => {
    const fake = 'AQ.SomeFakeSecret12345678901234567890';
    const error = new Error('Raw untrusted response ' + fake);
    const result = summarizeGeminiTrialFailure(error,1);
    expect(result.validatorMessage).toBeNull();
    expect(JSON.stringify(result)).not.toContain(fake);
  });
});
