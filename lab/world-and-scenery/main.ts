/**
 * Real 3D browser preview with three different environments and props.
 * Scene geometry is intentionally simple and authored only for QA.
 * ALL main cargo + gear motion is compiled from validated story events.
 * No Gemini call, no image/video model, no stock footage.
 */
import * as THREE from 'three';
import {SceneProgram3D} from '../../src/studio/explainer/sceneProgram/stage3d';
import {type MechanicalSetting} from '../../src/studio/explainer/sceneProgram/planner/mechanicalScenarios';
import {buildWorldAndSceneryPreview} from '../../src/studio/explainer/sceneProgram/planner/worldAndSceneryDemo';

const W=720,H=1280,sceneCanvas=document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer=new THREE.WebGLRenderer({canvas:sceneCanvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;
renderer.outputColorSpace=THREE.SRGBColorSpace;

const names:MechanicalSetting[]=['workshop','city','harbor'];
const label:Record<MechanicalSetting,string>={
  workshop:'OFICINA — caixa de ferramentas composta',
  city:'CIDADE — carrinho com chassi e rodas 3D',
  harbor:'PORTO — barco com casco, cabine e janelas'
};
const assembled=names.map(setting=>{
  const sample=buildWorldAndSceneryPreview(setting);
  return {sample,stage:new SceneProgram3D(sample.program,sample.sources)};
});
const overlay=document.createElement('canvas');overlay.width=W;overlay.height=H;
const ctx=overlay.getContext('2d')!;

const seek=(t:number)=>{
  const index=Math.min(2,Math.max(0,Math.floor(Math.max(0,t)/6)));
  const local=Math.min(6,Math.max(0,t-index*6));
  const {sample,stage}=assembled[index];
  stage.render(renderer,local,W,H);
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(sceneCanvas,0,0);
  ctx.fillStyle='rgba(10,26,39,.9)';
  ctx.fillRect(0,H-166,W,166);
  ctx.fillStyle='#65C2E0';
  ctx.fillRect(32,H-144,74,6);
  ctx.font='bold 29px sans-serif';
  ctx.fillStyle='#FFFFFF';
  ctx.fillText(label[sample.setting],32,H-90);
  ctx.font='22px sans-serif';
  ctx.fillStyle='#C7D5DF';
  ctx.fillText('Mecanica + objetos novos + paisagens 3D',32,H-52);
  const cargo=stage.nodes.get('cargo')!.position.toArray();
  const shaft=stage.nodes.get('drum-shaft')!.rotation;
  const gear=stage.nodes.get('small-gear-shaft')!.rotation;
  return {
    setting:sample.setting,time:t,local,
    cargo,shaft:[shaft.x,shaft.y,shaft.z],gear:[gear.x,gear.y,gear.z],
    camera:stage.camera.position.toArray(),
    sceneNodes:sample.program.nodes.length,
    worldAudit:sample.worldAudit,
    sceneryAudit:sample.sceneryAudit,
    source:'Storyboard compiled mechanically, no Gemini'
  };
};
(window as any).__worldAndScenery3D={
  seek,
  frame:()=>overlay.toDataURL('image/png'),
  info:{duration:18,fps:24,scenes:names,captions:true,
    source:'Hand-authored QA blueprints and original Claude scenery generator. No live Gemini. Water is currently static.'}
};
seek(0);
document.body.dataset.ready='world-and-scenery';