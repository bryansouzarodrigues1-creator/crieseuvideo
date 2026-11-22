/**
 * One-shot live proof against THE REAL Motion 2D route.
 * Gemini alone must write the script and all scene directions.
 * Never retries, never requests via Lovable and never uses sample plans.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='tmp/motion2d-high-live';
await mkdir(out,{recursive:true});
const response=await fetch('http://127.0.0.1:4198/api/ai/explainer-plan',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
    script:'Gastos do governo brasileiro: o que significa o orçamento da União, o que é refinanciamento da dívida, a diferença entre valores previstos e gastos realmente executados e por que transparência importa. Sem números inventados.',
    aspect:'9:16', mode:'creative', generateScript:true, durationSeconds:40, gallery:[]
  }),
  signal:AbortSignal.timeout(225000)
});
const result=await response.json().catch(()=>({error:'non_json_response'}));
if(!response.ok){
  await writeFile(out+'/request-error.json',JSON.stringify({http:response.status,error:result?.error||'unknown',code:result?.code||null},null,2));
  throw Error('Actual 2D endpoint failed: HTTP '+response.status+' '+String(result?.code||result?.error));
}
assert.equal(result.source,'gemini','No fallback or manually authored plan is accepted');
assert.equal(result.thinkingLevel,'HIGH');
assert.equal(typeof result.script,'string');
assert.ok(result.script.length>80);
assert.ok(Array.isArray(result.plan?.scenes) && result.plan.scenes.length>=3);
const allWords=result.plan.scenes.map(s=>s.text).join(' ').replace(/\s+/g,' ').trim();
const scriptWords=result.script.replace(/\s+/g,' ').trim();
assert.equal(allWords,scriptWords,'All words of generated narration must match animated scene captions');
// Save the untouched Gemini response before quality assertions: failed creative
// direction must not be rewritten by us or mislabelled as Gemini output.
await writeFile(out+'/gemini-response.json',JSON.stringify(result,null,2));
const directions=result.motionAudit||{totalScenes:result.plan.scenes.length,directedScenes:0,directedObjects:0,coverage:0};
await writeFile(out+'/generation-proof.json',JSON.stringify({
  provider:'gemini',model:result.model,requestedThinkingLevel:'HIGH',
  createdScriptByGemini:true,createdScenesByGemini:true,
  sceneCount:result.plan.scenes.length,wordCount:result.script.split(/\s+/).length,
  realMotionDirection:directions,
  userRequestCount:1,lovableFallback:false,automaticRetry:false,
  durationTargetSeconds:40,narrationRecording:'not requested'
},null,2));
if(directions.directedScenes<1) {
  await writeFile(out+'/visual-qa-warning.txt','Gemini did not produce any original keyframed objects. Native video is a baseline, NOT a new-motion proof.\n');
}
console.log('GEMINI_2D_REAL_SUCCESS',result.model,'High',result.plan.scenes.length,'scenes',result.script.length,'characters');
