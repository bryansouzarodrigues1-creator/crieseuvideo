import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import runtime from './sceneToolsRuntime.js?raw';
import study from './recipes/carryReviewRuntime.js?raw';
import {checkGeneratedCode} from './validation';
const makeTools=new Function(runtime+';return createSceneTools;')();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

describe('curved steps and single-object transfers',()=>{
 it('keeps a supporting foot fixed while the body turns along a curved path',()=>{
  const s=makeTools(THREE),path=s.createWalkPath([[0,0,0],[0,0,1],[1,0,2],[2,0,2]]);
  const a=s.walkOnPath({path,distance:.91}),b=s.walkOnPath({path,distance:1.03});
  expect(a.left.planted&&b.left.planted).toBe(true);expect(a.left.point.distanceTo(b.left.point)).toBeLessThan(1e-10);expect(Math.abs(a.body.yaw-b.body.yaw)).toBeGreaterThan(.01);
  const start=s.walkOnPath({path,distance:0}),end=s.walkOnPath({path,distance:path.length,settle:1});
  expect(start.left.point.z).toBeCloseTo(0,3);expect(start.right.point.z).toBeCloseTo(0,3);expect(end.left.planted&&end.right.planted).toBe(true);
 });
 it('preserves the sole target when the shoe pitches and turns under a rotated actor',()=>{
  const s=makeTools(THREE),actor=s.createPerson();actor.root.position.set(2,.2,3);actor.root.rotation.y=.7;
  const feet=[{point:v(1.85,.2,3),pitch:-.16,yaw:.4},{point:v(2.15,.2,3),pitch:.1,yaw:.8}];const d=actor.pose({crouch:.05,leftFoot:feet[0],rightFoot:feet[1]});expect(Math.max(...d.feet)).toBeLessThan(1e-5);
 });
 it('freezes the release pose without requiring an earlier frame and rejects a pickup jump',()=>{
  const s=makeTools(THREE),parent=new THREE.Group();parent.rotation.y=.8;parent.position.set(7,0,3);const object=new THREE.Group();parent.add(object);
  const heldAt=(t:number)=>({position:v(t,1,t*.5),quaternion:new THREE.Quaternion().setFromAxisAngle(v(0,1,0),t*.1)}),source=heldAt(1),transfer=s.createPropTransfer(object,{source,pickup:1,release:4,heldAt});
  transfer.apply(8);const final=object.getWorldPosition(v());expect(final.distanceTo(v(4,1,2))).toBeLessThan(1e-10);transfer.apply(.1);transfer.apply(8);expect(object.getWorldPosition(v()).distanceTo(final)).toBeLessThan(1e-10);
  expect(s.objectGrips(object,[[0,0,0]])[0].distanceTo(final)).toBeLessThan(1e-10);expect(()=>s.createPropTransfer(object,{source:{position:v()},pickup:1,release:4,heldAt})).toThrow(/sem salto/);
 });
 it('validates reachable contacts, obstacle clearance, placement and replay over the full story',()=>{
  expect(checkGeneratedCode(study)).toEqual({ok:true,warnings:[]});
  const ctx=new Proxy({measureText:(s:string)=>({width:s.length*10})},{get:(o:any,k)=>k in o?o[k]:()=>{},set:(o:any,k,val)=>{o[k]=val;return true;}});
  const stub=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as any);
  class Renderer{shadowMap={};setSize(){}setPixelRatio(){}setViewport(){}clear(){}clearDepth(){}render(){}dispose(){}}
  try{const create=new Function(study+';return createScene;')(),scene=create({...THREE,WebGLRenderer:Renderer},{},432,768,makeTools(THREE));let maxLeg=0,maxGrip=0,maxArm=0;
   for(let f=0;f<720;f++){const t=f/60,q=scene.inspect(t);maxLeg=Math.max(maxLeg,...q.legReach);maxArm=Math.max(maxArm,...q.armReach);if(t>=1.6&&t<=9.45)maxGrip=Math.max(maxGrip,...q.gripErrors);
    expect(q.cargoBottom).toBeGreaterThanOrEqual(q.floorY-1e-5);expect(Math.abs(q.headScreen[0])).toBeLessThan(.94);expect(Math.abs(q.headScreen[1])).toBeLessThan(.94);
    for(const p of q.footSoles){const inside=p[0]>q.obstacleMin[0]-.11&&p[0]<q.obstacleMax[0]+.11&&p[2]>q.obstacleMin[2]-.17&&p[2]<q.obstacleMax[2]+.17;expect(inside,'Foot intersects toolbox at '+t).toBe(false);}
    for(const p of q.kneesLocal){const distanceSq=[.31,.22,.23].reduce((sum,h,i)=>sum+Math.max(0,Math.abs(p[i])-h)**2,0);expect(distanceSq,'Knee intersects cargo at '+t).toBeGreaterThan(.0918**2);}
    if(t>=9.45)expect(Math.abs(q.cargoBottom-q.tableY)).toBeLessThan(1e-5);
   }
   expect(maxLeg,'Leg reach').toBeLessThan(1e-4);expect(maxArm,'Arm reach').toBeLessThan(1e-4);expect(maxGrip,'Cargo grip').toBeLessThan(1e-4);
   const a=scene.inspect(10.8);scene.inspect(.5);scene.inspect(4.2);expect(scene.inspect(10.8)).toEqual(a);
   for(const event of [1.6,9.45]){const a=scene.inspect(event-1e-6),b=scene.inspect(event+1e-6);expect(new THREE.Vector3(...a.cargoPosition).distanceTo(new THREE.Vector3(...b.cargoPosition))).toBeLessThan(1e-4);}
   scene.dispose();
  }finally{stub.mockRestore();}
 });
});
