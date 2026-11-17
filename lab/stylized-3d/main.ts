/** Genuine headless Three.js browser test for the SceneProgram3D generic engine.
 * The fixture is a nonhuman stylized scene. No AI, screenshot mock, or static
 * pre-rendered image. All camera states come from the active engine.
 */
import * as THREE from 'three';
import { SceneProgram3D } from '../../src/studio/explainer/sceneProgram/stage3d';
import { normalizeSceneProgram } from '../../src/studio/explainer/sceneProgram/score';
import { stylizedPropsProgram, stylizedPropsScript } from '../../src/studio/explainer/sceneProgram/stylizedPropsDemo';

const W=720,H=1280;
const canvas=document.querySelector<HTMLCanvasElement>('#view')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const sources=[{sourceId:'s1',text:stylizedPropsScript,duration:8}];
const program=normalizeSceneProgram(stylizedPropsProgram(),sources);
const stage=new SceneProgram3D(program,sources);
const seek=(time:number)=>{
  stage.render(renderer,time,W,H);
  return { ...stage.diagnostics(),time,nodes:stage.nodes.size,
    tomatoParts:program.nodes.filter(n=>n.parent==='fruit').length,
    actors:stage.actors.size };
};
(window as any).__stylized3D={
  seek,
  frame:()=>canvas.toDataURL('image/png'),
  programInfo:{nodes:program.nodes.length,tracks:program.tracks.length,kind:'original-organic-3d-shape'},
};
seek(0);
document.body.dataset.ready='stylized-3d';
