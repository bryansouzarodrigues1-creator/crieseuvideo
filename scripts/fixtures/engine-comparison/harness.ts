import * as THREE from 'three';
import {drawExplainerFrame} from '../../../src/studio/explainer/render';
import {totalDuration} from '../../../src/studio/explainer/plan';
import {Toon3D} from '../../../src/studio/explainer/toon3d';
import {SceneProgram3D} from '../../../src/studio/explainer/sceneProgram/stage3d';
import {encodeFixedFrame3DClip} from '../../../src/studio/utils/deterministic3dExport';
import {plan,program,sources} from './scene';
import {createSvgScene} from './svg-scene';

const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;
const engine=new URL(location.href).searchParams.get('engine')||'motion2d';
let toon:Toon3D|null=null,stage:SceneProgram3D|null=null,gl:THREE.WebGLRenderer|null=null,svg:ReturnType<typeof createSvgScene>|null=null;
if(engine==='toon3d')toon=new Toon3D();
if(engine==='sceneprogram'){
 stage=new SceneProgram3D(program,sources);
 gl=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});gl.setPixelRatio(1);gl.setSize(720,1280,false);gl.shadowMap.enabled=true;gl.shadowMap.type=THREE.PCFSoftShadowMap;gl.outputColorSpace=THREE.SRGBColorSpace;
}
if(engine==='htmlsvg')svg=createSvgScene(document.querySelector('#svg-holder')!);
const render=async(t:number)=>{
 ctx.clearRect(0,0,720,1280);
 const oldTime=Math.min(totalDuration(plan)-.001,t*totalDuration(plan)/12);
 if(engine==='motion2d')drawExplainerFrame(ctx,plan,oldTime);
 else if(toon){toon.render(plan,oldTime,720,1280);ctx.drawImage(toon.canvas,0,0);}
 else if(stage&&gl){stage.render(gl,Math.min(11.999,t),720,1280);ctx.drawImage(gl.domElement,0,0);}
 else if(svg)await svg.render(t,ctx);
 else throw Error('Unknown renderer '+engine);
};
const api={engine,render,async frame(t:number){await render(t);return canvas.toDataURL('image/png').split(',')[1];},
 async export(){const v=await encodeFixedFrame3DClip({canvas,durationSeconds:12,fps:30,renderFrame:render});
 if(v.filenameExtension!=='mp4')throw Error('A real MP4 is required for this comparison');
 const a=document.createElement('a');a.href=URL.createObjectURL(v.blob);a.download=engine+'-native.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);return{frames:v.frames,fps:v.fps};},
 diagnostics(){return stage?.diagnostics()??{engine};}
};
(window as any).comparison=api;
await render(0);
document.body.dataset.ready='true';
