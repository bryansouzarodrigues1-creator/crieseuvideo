/**
 * ONLY a CI fixture. Never label its output as a real Gemini generation.
 * Writes a previously validated manual 3D program so the independent
 * real-output renderer can be tested without model calls or credits.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { mechanicalDemoScript, mechanicalDemoResponse } from '../src/studio/explainer/sceneProgram/mechanicalDemo';
import { normalizePlan } from '../src/studio/explainer/plan';
import { withTargetDuration } from '../src/studio/explainer/duration';

const out=path.resolve('tmp/authorized-gemini-3d-trial');
await fs.mkdir(out,{recursive:true});
const plan=withTargetDuration(normalizePlan(mechanicalDemoResponse(),mechanicalDemoScript,'9:16'),8);
await fs.writeFile(path.join(out,'program.json'),JSON.stringify({...plan,engine:'3d'},null,2));
await fs.writeFile(path.join(out,'fixture-only.json'),JSON.stringify({
  generatedByGemini:false,offlineTest:true,creditsUsed:0,
},null,2));
console.log('PASS: wrote offline manual-geometry fixture for renderer QA; no model contacted.');
