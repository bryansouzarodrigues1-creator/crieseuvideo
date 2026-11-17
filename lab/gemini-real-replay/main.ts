/**
 * Replays the EXACT 2026-11-17 Gemini-generated SceneProgram using the
 * project's current SceneProgram3D/Three.js engine. Zero AI requests.
 *
 * If the real engine rejects a frame for IK/contact physics, render an
 * explicitly REJECTED diagnostic visual rather than pretending it passed.
 * Never alter the model-authored graph or fake poses with a different scene.
 */
import * as THREE from 'three';
import { SceneProgram3D } from '../../src/studio/explainer/sceneProgram/stage3d';
import type { ProgramSource, SceneProgram } from '../../src/studio/explainer/sceneProgram/score';

const W=720,H=1280;
const canvas=document.querySelector<HTMLCanvasElement>('#view')!;
const status=document.querySelector<HTMLDivElement>('#status')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.03;

try {
  const response=await fetch('/program.json',{cache:'no-store'});
  if(!response.ok)throw Error('Cannot load original Gemini response without additional inference.');
  const plan=await response.json() as {
    sceneProgram:SceneProgram;
    scenes:Array<{sourceId:string,text:string,duration:number}>;
    targetDuration:number;
    title:string;
  };
  if(!plan.sceneProgram || !Array.isArray(plan.scenes))throw Error('Original response missing validated scene.');
  const sources:ProgramSource[]=plan.scenes.map(s=>({sourceId:s.sourceId,text:s.text,duration:s.duration}));
  const engine=new SceneProgram3D(plan.sceneProgram,sources);
  let physicsVerdict:{valid:boolean;reason?:string;diagnostic?:unknown}={valid:true};
  try {engine.validateContacts();}
  catch(e) {physicsVerdict={valid:false,reason:(e as Error).message,diagnostic:(e as any).diagnostic};}
  let failureCount=0;
  const seek=(time:number)=>{
    const t=THREE.MathUtils.clamp(time,0,plan.targetDuration);
    let rejected=false,reason='';
    try {engine.render(renderer,t,W,H);}
    catch (e) {
      rejected=true;failureCount++;reason=(e as Error).message;
      // The engine is still used in exactly its own world/camera. This branch
      // is a DIAGNOSTIC ONLY; we do not call it a successfully accepted video.
      engine.update(t);engine.frame(W/H);engine.ink.resize(W,H);
      renderer.render(engine.scene,engine.camera);
    }
    const diagnostics=engine.diagnostics();
    return {
      time:t,frameRejected:rejected,rejectionReason:reason,
      maxIKError:diagnostics.maxIKError,maxContactError:diagnostics.maxContactError,
      camera:diagnostics.camera,projectedBounds:diagnostics.projectedBounds,
      nodes:diagnostics.nodes,curves:diagnostics.curves,
      contacts:diagnostics.contacts,physicsVerdict,
    };
  };
  const frame=(time:number)=>{
    const sample=seek(time);
    return {png:canvas.toDataURL('image/png').split(',')[1],sample};
  };
  const start=seek(0);
  (window as any).__geminiRealReplay={
    modelAuthored:true,realCallsInThisReplay:0,frame,
    seek,original:plan,physicsVerdict,getFailedFrameCount:()=>failureCount,
    info:()=>start,
  };
  document.body.dataset.ready='gemini-replay-ready';
  status.textContent='Resposta REAL do Gemini — Replay offline de SceneProgram 3D';
} catch(e) {
  document.body.dataset.ready='gemini-replay-error';
  status.textContent='ERRO: '+(e as Error).message;
  console.error(e);
}
