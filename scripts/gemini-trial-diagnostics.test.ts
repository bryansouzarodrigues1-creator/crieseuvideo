import { describe, expect, it } from 'vitest';
import { DirectorError } from '../src/studio/server/director';
import { locateUnsupportedSceneField, summarizeGeminiTrialFailure } from './gemini-trial-diagnostics';

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
  it('pinpoints unsupported nested fields without leaking model values', () => {
    const candidate = { sourceSignature: '[]', program: {
      version:1, nodes:[{id:'wing', kind:'mesh', geometry:{shape:'box',size:[1,2,3], bevelSegments:5}}],
      tracks:[], shots:[], contacts:[],
    } };
    expect(locateUnsupportedSceneField(candidate)).toEqual({
      path:'nodes[0].geometry',property:'bevelSegments',
    });
    const error = new DirectorError(502,'invalid_scene_program',
      'O programa contém um campo não suportado. Não envie JavaScript, URLs ou shaders.');
    Object.defineProperty(error,'candidate',{value:candidate,enumerable:false});
    const report=summarizeGeminiTrialFailure(error,1);
    expect(report).toMatchObject({
      unsupportedField:{path:'nodes[0].geometry',property:'bevelSegments'},
      callsMade:1,retried:false,noRenderingAttempted:true,
    });
    expect(JSON.stringify(report)).not.toContain('wing');
  });

  it('redacts suspicious or oversized property identifiers from diagnostics', () => {
    const suspicious='AQ.SomeFakeSecret12345678901234567890';
    expect(locateUnsupportedSceneField({program:{[suspicious]:true}})).toEqual({
      path:'sceneProgram',property:'redacted',
    });
    expect(JSON.stringify(locateUnsupportedSceneField({program:{[suspicious]:true}}))).not.toContain(suspicious);
    expect(locateUnsupportedSceneField({program:{nodes:[{material:{opacity:1,secret_token:'DO_NOT_LOG'}}]}}))
      .toEqual({path:'nodes[0].material',property:'redacted'});
  });

  it('does not log non-director error strings or model response bodies', () => {
    const fake = 'AQ.SomeFakeSecret12345678901234567890';
    const error = new Error('Raw untrusted response ' + fake);
    const result = summarizeGeminiTrialFailure(error,1);
    expect(result.validatorMessage).toBeNull();
    expect(JSON.stringify(result)).not.toContain(fake);
  });
});
