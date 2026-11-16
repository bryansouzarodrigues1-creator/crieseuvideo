/**
 * One-call, owner-approved creative 3D trial. NEVER run this in a push CI job.
 *
 * Default execution is OFFLINE and prints its proposed scenario, with zero
 * requests. Requires a fresh server-side Gemini credential and an exact
 * explicit confirmation environment flag to request *one* model response.
 *
 * This exercises the real director/normalizer, not just the 3D fixture.
 * Validated JSON is saved for visual QA in the real studio afterward.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { directExplainer, DirectorError } from '../src/studio/server/director';
import { SceneProgramError } from '../src/studio/explainer/sceneProgram/score';

const TRIAL_SCRIPT = 'Uma pequena turbina eólica recebe uma rajada de vento. Suas pás começam a girar, aceleram e depois param.';
const DURATION = 8;
const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
const approved = process.env.CONFIRM_ONE_GEMINI_CALL === 'I_APPROVE_ONE_CALL';
if (!approved) {
  console.log(JSON.stringify({
    state: 'OFFLINE_DRY_RUN', model,
    script: TRIAL_SCRIPT, seconds: DURATION,
    callsMade: 0, creditsUsed: 0, next: 'Owner must authorize exactly one real Gemini call in a private session.',
  }, null, 2));
  process.exit(0);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('Falta GEMINI_API_KEY no ambiente PRIVADO. Nenhuma chamada foi feita.');
  process.exit(2);
}
if (!['gemini-3.6-flash','gemini-3.5-flash-lite'].includes(model)) {
  console.error('Modelo não autorizado no contrato do CrieSeuVideo; nenhuma chamada foi feita.');
  process.exit(2);
}

try {
  // No fallbacks, no correction loop, no other tools and NO TTS.
  const result = await directExplainer({
    script: TRIAL_SCRIPT, mode: 'program', engine: '3d',
    aspect: '9:16', targetDuration: DURATION,
  }, {
    AI_TEXT_PROVIDER: 'gemini',
    AI_TEXT_FALLBACK: '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_TEXT_MODEL: model,
  });
  const program=result.plan.sceneProgram;
  if (!program) throw new SceneProgramError('O Gemini não devolveu um SceneProgram 3D.');
  const shapes=[...new Set(program.nodes.filter(n=>n.geometry).map(n=>n.geometry!.shape))];
  const report={
    state:'READY_FOR_VISUAL_INSPECTION',
    provider:result.provider, model:result.model, seconds:DURATION,
    authoredWithoutPreset:true,
    nodeCount:program.nodes.length,
    trackCount:program.tracks.length,
    shotCount:program.shots.length,
    verifiedMotionCheckCount:program.motionChecks?.length ?? 0,
    shapes, callsMade:1, narrationGenerated:false,
  };
  const out=path.resolve('tmp/authorized-gemini-3d-trial');
  await fs.mkdir(out,{recursive:true});
  // This file contains the model-authored plan only, NEVER API credentials.
  await fs.writeFile(path.join(out,'program.json'),JSON.stringify(result.plan,null,2));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  const code=error instanceof DirectorError ? error.code : 'validation_failed';
  // Do not log provider bodies, prompts, keys or potentially confidential
  // scene proposals; only a safe machine-readable failure summary.
  console.error(JSON.stringify({state:'REJECTED',code,callsMade:1,retried:false}));
  process.exitCode=1;
}
