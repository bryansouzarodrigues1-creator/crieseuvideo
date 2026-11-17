/** Real generic Three.js/SceneProgram browser renderer for 30s construction study.
 * Reference: user-provided 1000857556.mp4, seconds 0..30.
 * Offline, original geometry, NO Gemini or Lovable tokens, NO deploy.
 */
import * as THREE from 'three';
import { normalizeSceneProgram } from '../../src/studio/explainer/sceneProgram/score';
import { SceneProgram3D } from '../../src/studio/explainer/sceneProgram/stage3d';
import { cementLift30sProgram, cementLiftSources } from './program';

const W=720,H=1280;
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const program=normalizeSceneProgram(cementLift30sProgram(),cementLiftSources);
const scene=new SceneProgram3D(program,cementLiftSources);
const seek=(time:number)=>{
  scene.render(renderer,time,W,H);
  const diagnostics=scene.diagnostics();
  return {
    time,
    camera:diagnostics.camera,projectedBounds:diagnostics.projectedBounds,
    objects:diagnostics.nodes,contacts:diagnostics.contacts,
    pallet:scene.nodes.get('pallet')?.getWorldPosition(new THREE.Vector3()).toArray(),
    motorGear:scene.nodes.get('big-gear')?.rotation.z,
    smallerGear:scene.nodes.get('small-gear')?.rotation.z,
    rope:scene.nodes.get('rope-body')?.scale.toArray(),
    worker:scene.nodes.get('worker-ground')?.position.toArray(),
  };
};
(window as any).__cementLift={
  seek,frame:()=>canvas.toDataURL('image/png'),
  info:{duration:30,objects:program.nodes.length,tracks:program.tracks.length,cuts:program.shots[0]?.cuts?.length,
    source:'User-supplied reference 1000857556.mp4 seconds 0..30; original authored geometry, not AI output'},
};
seek(0);
document.body.dataset.ready='cement-lift';
