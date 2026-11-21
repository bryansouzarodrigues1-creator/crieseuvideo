import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import runtime from './sceneToolsRuntime.js?raw';
import study from './recipes/carryReviewRuntime.js?raw';
import {buildHandReviewCode} from './recipes/handReview';
import {checkGeneratedCode} from './validation';
const makeTools=new Function(runtime+';return createSceneTools;')();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function minimum(a:number[],b:number[],distance:(p:number[])=>number){let l=0,r=1;const at=(t:number)=>a.map((x,i)=>x+(b[i]-x)*t);for(let i=0;i<30;i++){const x=l+(r-l)/3,y=r-(r-l)/3;if(distance(at(x))<distance(at(y)))r=y;else l=x;}return Math.sqrt(Math.min(distance(a),distance(b),distance(at((l+r)/2))));}
function withScene(run:(scene:any)=>void){const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});const stub=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as any);
 class Renderer{shadowMap={};setSize(){}setPixelRatio(){}setViewport(){}clear(){}clearDepth(){}render(){}dispose(){}}
 try{const create=new Function(study+';return createScene;')(),scene=create({...THREE,WebGLRenderer:Renderer},{},432,768,makeTools(THREE));try{run(scene);}finally{scene.dispose();}}finally{stub.mockRestore();}}

describe('oriented palms, finger closure and safe release',()=>{
 it('transforms contact points, palm normals and finger directions with the object',()=>{
  const s=makeTools(THREE),object=new THREE.Group();object.position.set(3,1,2);object.rotation.y=.8;object.scale.setScalar(1.2);
  const a=s.graspFrames(object,[{point:[.4,.1,0],normal:[-1,0,0],fingers:[0,0,1]}])[0],q=object.getWorldQuaternion(new THREE.Quaternion());
  expect(a.point.distanceTo(object.localToWorld(v(.4,.1,0)))).toBeLessThan(1e-10);expect(v(0,0,1).applyQuaternion(a.quaternion).distanceTo(v(-1,0,0).applyQuaternion(q))).toBeLessThan(1e-10);expect(v(0,1,0).applyQuaternion(a.quaternion).distanceTo(v(0,0,1).applyQuaternion(q))).toBeLessThan(1e-10);
  expect(()=>s.graspFrames(object,[{point:[0,0,0],normal:[1,0,0],fingers:[1,0,0]}])).toThrow(/direções distintas/);
 });
 it('solves the wrist separately and preserves finger lengths and contact while closing',()=>{
  const s=makeTools(THREE),actor=s.createPerson({hands:'articulated',scale:1.1});actor.root.position.set(2,.3,4);actor.root.rotation.y=.6;
  const frames=s.graspFrames(actor.root,[-1,1].map(side=>({point:[side*.42,1.10,.32],normal:[-side,0,0],fingers:[0,0,1]})));
  for(const grip of [0,.25,.5,.75,1]){const d=actor.pose({leftHand:{...frames[0],grip},rightHand:{...frames[1],grip}});expect(Math.max(...d.hands)).toBeLessThan(1e-5);expect(Math.max(...d.armReach)).toBeLessThan(1e-5);
   for(let i=0;i<2;i++){expect(new THREE.Vector3(...d.wrists[i]).distanceTo(frames[i].point)).toBeCloseTo(Math.hypot(.084,.034)*1.1,7);const fingers=d.handSamples[i].filter((s:any)=>s.name==='finger');expect(fingers).toHaveLength(12);for(const c of fingers)expect(new THREE.Vector3(...c.from).distanceTo(new THREE.Vector3(...c.to))).toBeCloseTo(.034*1.1,7);}
  }
 });
 it('keeps finger and thumb capsules clear of the box and grip bars throughout the story',()=>{
  withScene(scene=>{let boxGap=Infinity,barGap=Infinity;
   for(let f=0;f<720;f++){const q=scene.inspect(f/60);for(let i=0;i<2;i++)for(const c of q.handSamples[i]){
    const boxDistance=(p:number[])=>p.reduce((sum,x,j)=>sum+Math.max(Math.abs(x)-[.324,.224,.238][j],0)**2,0);boxGap=Math.min(boxGap,minimum(c.from,c.to,boxDistance)-c.radius);
    if(c.name==='finger'||c.name==='thumb'){const side=i?1:-1,barDistance=(p:number[])=>(p[0]-side*.385)**2+(p[1]-Math.max(.005,Math.min(.155,p[1])))**2+p[2]**2;barGap=Math.min(barGap,minimum(c.from,c.to,barDistance)-c.radius-.018);}
   }}
   expect(boxGap,'Hand enters cargo bounds').toBeGreaterThan(.004);expect(barGap,'Digit enters grip bar').toBeGreaterThan(-.0001);
  });
 });
 it('closes before lifting, opens on the support and withdraws before lowering',()=>{
  expect(checkGeneratedCode(buildHandReviewCode())).toEqual({ok:true,warnings:[]});
  withScene(scene=>{const a=scene.inspect(1.75),b=scene.inspect(1.85),c=scene.inspect(9.65),d=scene.inspect(10.0);expect(a.phase).toBe('source');expect(a.closure).toBeLessThan(1);expect(b.closure).toBe(1);expect(b.phase).toBe('held');expect(c.cargoBottom).toBeCloseTo(c.tableY,6);expect(c.closure).toBeGreaterThan(0);expect(c.closure).toBeLessThan(1);expect(Math.max(...c.gripErrors)).toBeLessThan(1e-5);expect(d.closure).toBe(0);expect(Math.min(...d.gripErrors)).toBeGreaterThan(.07);
   const end=scene.inspect(10.0);scene.inspect(.2);scene.inspect(6.4);expect(scene.inspect(10.0)).toEqual(end);
  });
 });
});
