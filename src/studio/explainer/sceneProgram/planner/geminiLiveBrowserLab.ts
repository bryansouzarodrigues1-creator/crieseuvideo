/**
 * INTERNAL LIVE GEMINI QA ADAPTER — no model calls or stored credentials.
 * Runs the actual model-authored SceneProgram3D in Vite/Chromium only.
 * The synthetic input is produced by Gemini via the server-side test harness.
 */
import * as THREE from 'three';
import {compileCompactWorld} from './compactWorldDirector';
import {sourceBriefsFromScript} from './sceneScript';
import {SceneProgram3D} from '../stage3d';
import {auditShotVisibilitySequence} from '../shotVisibilityAudit';

let active:{stage:SceneProgram3D;renderer:THREE.WebGLRenderer;canvas:HTMLCanvasElement;duration:number}|undefined;

export function installGeminiLiveQaScene(raw:unknown,syntheticScript:string){
  disposeGeminiLiveQaScene();
  const sources=sourceBriefsFromScript(syntheticScript);
  const clip=compileCompactWorld(raw,sources);
  const canvas=document.createElement('canvas');
  canvas.id='gemini-live-canvas';
  canvas.width=360;canvas.height=640;
  canvas.style.cssText='position:fixed;left:5px;top:5px;width:360px;height:640px;z-index:99999;display:block';
  document.body.appendChild(canvas);
  const renderer=new THREE.WebGLRenderer({
    canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'
  });
  renderer.setSize(360,640,false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const stage=new SceneProgram3D(clip.program,clip.sources);
  active={stage,renderer,canvas,duration:clip.duration};
  const audit=auditShotVisibilitySequence(stage,9/16);
  stage.render(renderer,0,360,640);
  return {
    seconds:clip.duration,
    duration:clip.duration,
    nodes:clip.program.nodes.length,
    entities:clip.audit.objectCount,
    camera:audit,
    hardIssues:audit.flatMap(r=>r.issues).filter(i=>
      i.code==='subject_offscreen'||i.code==='subject_missing_geometry'),
  };
}

export function renderGeminiQaFrame(t:number){
  if(!active)throw new Error('Nenhuma cena Gemini ativa para teste.');
  active.stage.render(active.renderer,t,360,640);
  return active.stage.diagnostics();
}

export function getGeminiQaState(){
  if(!active)throw new Error('Nenhuma cena Gemini ativa para teste.');
  return active;
}

export function disposeGeminiLiveQaScene(){
  if(!active)return;
  active.stage.dispose();
  active.renderer.dispose();
  active.canvas.remove();
  active=undefined;
}
