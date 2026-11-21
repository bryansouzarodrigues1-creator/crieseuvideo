// Rebuild the reference study from the same validated plan used by the studio.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeConstructionRecipe } from '../src/studio/code3d/recipes/constructionPlan';
import { checkGeneratedCode } from '../src/studio/code3d/validation';
const plan = JSON.parse(readFileSync('scripts/fixtures/construction-study.plan.json','utf8'));
const config = normalizeConstructionRecipe(plan);
const template = readFileSync('src/studio/code3d/recipes/constructionRuntime.js','utf8');
const code = template.replace('/*CONSTRUCTION_CONFIG*/{}/*END_CONFIG*/', JSON.stringify(config).replace(/</g,'\\u003c'));
const result = checkGeneratedCode(code);
if (!result.ok) throw new Error(result.detail);
writeFileSync('scripts/fixtures/construction-study.js',code);
writeFileSync('scripts/fixtures/construction-study.provenance.json',JSON.stringify({
  origin:'Manually directed procedural reconstruction of a user-provided construction explainer; not a Gemini response.',
  source_sha256:createHash('sha256').update(code).digest('hex'),
  renderer:'Existing Code3DStudio, explicit import, opaque sandbox and native fixed-frame exporter',
  duration:120,clipDuration:12,width:720,height:1280,fps:30,
  inputs:'Reference dimensions, stages, camera cuts and illustrative counter values. No source images or audio embedded.',
  deployment:'Test branch only; no production deployment.'
},null,2)+'\n');
console.log(`Construction study: ${code.length} chars; source validation passed.`);
