/**
 * ONE real Gemini request against the production CrieSeuVideo 3D planning
 * contract. Safe in GitHub Actions: reads a repository secret via process.env,
 * never prints keys, prompts, user data, or the raw provider response.
 *
 * Runs only on the internal test branch; outputs synthetic fixture and status.
 * Missing secret means SKIP (not a fake success).
 */
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ask3DWorldAi,Ai3DProviderError} from '../src/studio/server/ai';
import {sourceBriefsFromScript} from '../src/studio/explainer/sceneProgram/planner/sceneScript';
import {compactWorldPrompt,compileCompactWorld} from '../src/studio/explainer/sceneProgram/planner/compactWorldDirector';
import {gemini3DResponseSchema,parseAi3DScene} from '../src/studio/server/ai3dSchema';
import {compileSceneProgram} from '../src/studio/explainer/sceneProgram/score';

const dir=path.resolve('tmp/gemini-live-3d');
await mkdir(dir,{recursive:true});
const syntheticScript=[
  'O guindaste pega uma caixa de materiais apoiada no chão de uma obra e a ergue.',
  'O carrinho leva a mesma caixa suspensa até uma plataforma de entrega mais alta.',
  'O guindaste desce o cabo e apoia a caixa no tablado da plataforma sem atravessá-lo.',
].join(' ');
const save=async(summary:Record<string,unknown>)=>{
  await writeFile(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
  console.log('GEMINI_LIVE_RESULT='+JSON.stringify(summary));
};

if(!process.env.GEMINI_API_KEY){
  await save({
    status:'skipped',
    reason:'GEMINI_API_KEY not present in GitHub Actions secrets',
    liveProviderCalls:0,
    note:'Lovable Secrets and GitHub Actions Secrets are separate stores. This was NOT a live Gemini test.',
  });
}else{
  const source=sourceBriefsFromScript(syntheticScript);
  const schema=gemini3DResponseSchema(source.map(s=>s.sourceId));
  const prompt=compactWorldPrompt(source);
  try{
    // Exactly ONE provider call, explicitly Gemini. No Lovable fallback,
    // no automatic retry and no followup calls.
    const answer=await ask3DWorldAi(prompt,'gemini',txt=>{
      const json=parseAi3DScene(txt);
      if(!json)return {accepted:false,reason:'invalid_json'};
      try{
        compileCompactWorld(json,source);
        return {accepted:true};
      }catch{
        return {accepted:false,reason:'invalid_scene'};
      }
    },schema);
    if(!answer||answer.provider!=='gemini')throw new Error('Gemini did not return an accepted scene');
    const plan=parseAi3DScene(answer.text);
    if(!plan)throw new Error('Provider scene unexpectedly failed JSON parsing');
    const clip=compileCompactWorld(plan,source);
    const animation=compileSceneProgram(clip.program,clip.sources);
    const load=clip.program.nodes.find(n=>n.id===
      (plan.actions as Array<{target:string}>)[0]?.target);
    const start=load?animation.sample(0).get(load.id)?.position:null;
    const end=load?animation.sample(clip.duration).get(load.id)?.position:null;
    await writeFile(path.join(dir,'scene-plan.json'),JSON.stringify({plan,syntheticScript},null,2));
    await save({
      status:'provider_accepted',provider:'gemini',
      model:process.env.GEMINI_AI_MODEL||'gemini-3.8-flash',
      liveProviderCalls:1,
      seconds:clip.duration,
      nodes:clip.program.nodes.length,
      tracks:clip.program.tracks.length,
      subjects:clip.program.shots.map(s=>s.subjects),
      actorStart:start,actorEnd:end,
      output:'scene-plan.json (synthetic test scene only)',
      note:'Real Gemini responded and compiled. Visual QA/export must still run in browser.',
    });
  }catch(e){
    const reasons=e instanceof Ai3DProviderError?e.failures.map(f=>({provider:f.provider,reason:f.reason})):undefined;
    await save({
      status:'provider_rejected',liveProviderCalls:1,
      reasons:reasons??'scene_validation_failed',
      note:'Real Gemini call did NOT produce a validated 3D scene. No fallback video or second provider call.',
    });
    process.exitCode=1;
  }
}
