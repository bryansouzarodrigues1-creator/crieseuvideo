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
import { summarizeGeminiTrialFailure } from './gemini-trial-diagnostics';

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
if (!process.env.FREEFORM_3D_GEMINI_API_KEY) {
  console.error('Falta FREEFORM_3D_GEMINI_API_KEY no ambiente PRIVADO. Nenhuma chamada foi feita.');
  process.exit(2);
}
if (!['gemini-3.6-flash','gemini-3.5-flash-lite'].includes(model)) {
  console.error('Modelo não autorizado no contrato do CrieSeuVideo; nenhuma chamada foi feita.');
  process.exit(2);
}

const originalFetch = globalThis.fetch;
let sentGenerationRequests = 0;
const onlyPermittedUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
// Hard network firewall: the trial process can send at most one outbound
// request, and ONLY to the approved model's GenerateContent endpoint.
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url !== onlyPermittedUrl || (init?.method || 'GET') !== 'POST')
    throw new Error('Saída de rede não autorizada durante a prova 3D.');
  if (++sentGenerationRequests > 1)
    throw new Error('A segunda chamada de IA foi bloqueada pelo teste de solicitação única.');
  return originalFetch(input, init);
}) as typeof fetch;

try {
  // No fallbacks, no correction loop, no other tools and NO TTS.
  const result = await directExplainer({
    script: TRIAL_SCRIPT, mode: 'program', engine: '3d',
    aspect: '9:16', targetDuration: DURATION,
  }, {
    AI_TEXT_PROVIDER: 'gemini',
    AI_TEXT_FALLBACK: '',
    FREEFORM_3D_GEMINI_API_KEY: process.env.FREEFORM_3D_GEMINI_API_KEY,
    GEMINI_TEXT_MODEL: model,
    // The model's output cap includes reasoning tokens. The owner-approved
    // trial uses LOW thinking and a bounded 16k total output allowance.
    GEMINI_THINKING_LEVEL: 'low',
    GEMINI_MAX_OUTPUT_TOKENS: '16384',
  });
  if (sentGenerationRequests !== 1) throw new Error('A prova não fez exatamente uma chamada de geração.');
  const program=result.plan.sceneProgram;
  if (!program) throw new SceneProgramError('O Gemini não devolveu um SceneProgram 3D.');
  const shapes=[...new Set(program.nodes.filter(n=>n.geometry).map(n=>n.geometry!.shape))];
  const actualSeconds=result.plan.scenes.reduce((total,scene)=>total+(scene.duration??0),0);
  const report={
    state:'READY_FOR_VISUAL_INSPECTION',
    provider:result.provider, model:result.model, requestedSeconds:DURATION, actualSeconds,
    durationAdjusted:Math.abs(actualSeconds-DURATION)>.05,
    authoredWithoutPreset:true,
    nodeCount:program.nodes.length,
    trackCount:program.tracks.length,
    shotCount:program.shots.length,
    verifiedMotionCheckCount:program.motionChecks?.length ?? 0,
    shapes, callsMade:sentGenerationRequests, narrationGenerated:false,
  };
  const out=path.resolve('tmp/authorized-gemini-3d-trial');
  await fs.mkdir(out,{recursive:true});
  // This file contains the model-authored plan only, NEVER API credentials.
  await fs.writeFile(path.join(out,'program.json'),JSON.stringify(result.plan,null,2));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  const diagnostic = summarizeGeminiTrialFailure(error, sentGenerationRequests);
  const output = path.resolve('tmp/authorized-gemini-3d-trial');
  await fs.mkdir(output, { recursive: true });
  // This bounded JSON contains only classification and a sanitized
  // server-side validation message. NEVER write raw Gemini JSON or secrets.
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify(diagnostic, null, 2));
  console.error(JSON.stringify(diagnostic));
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}
