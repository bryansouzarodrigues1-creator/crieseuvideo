import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import runtime from './sceneToolsRuntime.js?raw';
import study from './recipes/walkwayReviewRuntime.js?raw';
import {checkGeneratedCode} from './validation';
const makeTools=new Function(runtime+';return createSceneTools;')();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const close=(a:number,b:number,e=1e-5)=>expect(Math.abs(a-b)).toBeLessThan(e);

describe('fixed scene supports, articulated acting and camera helpers',()=>{
 it('measures the actual top and rejects a hole instead of inventing support',()=>{
  const s=makeTools(THREE),shape=new THREE.Shape();shape.moveTo(-3,-3);shape.lineTo(3,-3);shape.lineTo(3,3);shape.lineTo(-3,3);shape.closePath();const hole=new THREE.Path();hole.moveTo(-.5,-.5);hole.lineTo(-.5,.5);hole.lineTo(.5,.5);hole.lineTo(.5,-.5);hole.closePath();shape.holes.push(hole);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:false}),new THREE.MeshBasicMaterial());mesh.rotation.x=-Math.PI/2;mesh.position.y=2;
  close(s.registerSurface('floor',mesh),2.4);close(s.supportAt('floor',2,2).y,2.4);expect(s.supportAt('floor',0,0)).toBeNull();
  mesh.position.y=4;close(s.supportAt('floor',2,2).y,4.4);
 });
 it('places a prop by its real bounds even under a rotated scaled parent',()=>{
  const s=makeTools(THREE),floor=new THREE.Mesh(new THREE.BoxGeometry(12,.4,12),new THREE.MeshBasicMaterial());floor.position.y=2;s.registerSurface('floor',floor);
  const parent=new THREE.Group();parent.rotation.y=.4;parent.scale.set(1.2,1,1);parent.position.set(1,.5,1);const prop=new THREE.Group();parent.add(prop);const part=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());part.position.y=2;prop.add(part);
  s.placeOnSurface(prop,'floor',2,2);close(new THREE.Box3().setFromObject(prop).min.y,2.2);
 });
 it('keeps both limb lengths finite for coincident, unreachable and collinear targets',()=>{
  const s=makeTools(THREE),start=v(7,4,2);
  for(const target of [start.clone(),v(100,4,2),v(7.4,4,2)]){const q=s.solveTwoBone(start,target,v(9,4,2),.5,.5);close(q.joint.distanceTo(start),.5);close(q.joint.distanceTo(q.end),.5);expect([...q.joint,...q.end,q.error].every(Number.isFinite)).toBe(true);}
 });
 it('pins a supporting foot while the body advances and lifts the recovering foot',()=>{
  const s=makeTools(THREE),floor=new THREE.Mesh(new THREE.BoxGeometry(10,.4,12),new THREE.MeshBasicMaterial());s.registerSurface('floor',floor);
  const a=s.walkFeet({distance:.04,origin:[0,.2,0],surface:'floor'}),b=s.walkFeet({distance:.07,origin:[0,.2,0],surface:'floor'}),c=s.walkFeet({distance:.8,origin:[0,.2,0],surface:'floor'});
  expect(a.left.planted&&b.left.planted).toBe(true);close(a.left.point.distanceTo(b.left.point),0);expect(c.left.planted).toBe(false);expect(c.left.point.y).toBeGreaterThan(.2);close(c.right.point.y,.2);
 });
 it('solves real scaled actor soles and hands against world-space targets',()=>{
  const s=makeTools(THREE),actor=s.createPerson({scale:1.3});actor.root.position.set(1,.3,2);actor.root.rotation.y=Math.PI;
  const feet=s.walkFeet({distance:.04,origin:[1,.3,2],direction:[0,0,-1],stride:1.12*1.3,width:.28*1.3,lift:.115*1.3});
  const hand=actor.root.localToWorld(v(.4,.99,.18));const d=actor.pose({time:4,leftFoot:feet.left,rightFoot:feet.right,rightHand:hand,lean:.03});
  expect(Math.max(...d.feet)).toBeLessThan(1e-5);expect(Math.max(...d.legReach)).toBeLessThan(1e-5);expect(d.hands[1]).toBeLessThan(1e-5);close(actor.hands[1].getWorldPosition(v()).distanceTo(hand),0);
 });
 it('selects another camera direction when a solid wall hides its target',()=>{
  const s=makeTools(THREE),camera=new THREE.PerspectiveCamera(40,9/16,.1,100),wall=new THREE.Mesh(new THREE.BoxGeometry(10,10,.2),new THREE.MeshBasicMaterial());wall.position.set(0,1,2);
  expect(s.aimCamera(camera,v(0,1,0),[[0,0,1],[1,0,0]],4,[wall])).toBe(1);
 });
 it('checks the head separately when only the body center is unobstructed',()=>{
  const s=makeTools(THREE),camera=new THREE.PerspectiveCamera(40,9/16,.1,100),sign=new THREE.Mesh(new THREE.BoxGeometry(4,.5,.2),new THREE.MeshBasicMaterial());sign.position.set(0,1.95,2);
  expect(s.aimCamera(camera,v(0,1,0),[[0,0,1],[1,0,0]],4,[sign],[v(0,2.5,0)])).toBe(1);
 });
 it('keeps the new scene self-contained and its arrival/contact repeatable after seeking',()=>{
  expect(checkGeneratedCode(study)).toEqual({ok:true,warnings:[]});
  const ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:(s:string)=>({width:s.length*10})},{get:(o:any,k)=>k in o?o[k]:()=>{},set:(o:any,k,val)=>{o[k]=val;return true;}});
  const stub=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as any);
  class Renderer{shadowMap={};setSize(){}setPixelRatio(){}setViewport(){}setScissor(){}setScissorTest(){}clear(){}clearDepth(){}render(){}dispose(){}}
  try{const create=new Function(study+';return createScene;')();const scene=create({...THREE,WebGLRenderer:Renderer},{},432,768,makeTools(THREE));
   for(let frame=0;frame<360;frame++){const t=frame/30,q=scene.inspect(t);expect(q.camera.selected).toBe(0);expect(q.camera.clear,'Obstructed at '+t).toBe(true);expect(Math.abs(q.headScreen[0])).toBeLessThan(.92);expect(Math.abs(q.headScreen[1])).toBeLessThan(.92);}
   const a=scene.inspect(6.5);scene.inspect(1.5);scene.inspect(10.5);expect(scene.inspect(6.5)).toEqual(a);expect(Math.max(...a.feet)).toBeLessThan(1e-5);expect(a.hand).toBeLessThan(1e-5);close(new THREE.Vector3(...a.rightHand).distanceTo(new THREE.Vector3(...a.grip)),0);scene.dispose();
  }finally{stub.mockRestore();}
 });
});
