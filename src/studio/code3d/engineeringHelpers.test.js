import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createEngineeringHelpers} from './engineeringHelpers.js';
import {code3dPrompt} from './contract';
import {buildSandboxSrcdoc} from './sandbox';

describe('Engineering 3D in existing Code3D runtime',()=>{
 it('creates persistent geometry and deterministic reversible cutaways',()=>{
  const e=createEngineeringHelpers(THREE),root=new THREE.Group(),b=e.ArchitectureBuilder(root);
  const lid=b.group(root,0,2,0),mesh=b.box(lid,0,0,0,3,.2,2,0x887766);
  const cut=e.CutawaySystem(lid,e.V(0,3,0));
  cut(.5);const first=[lid.position.y,mesh.material.opacity,mesh.castShadow];
  cut(1);expect(lid.visible).toBe(false);
  cut(0);expect(lid.position.y).toBe(2);expect(lid.visible).toBe(true);
  cut(.5);expect([lid.position.y,mesh.material.opacity,mesh.castShadow]).toEqual(first);
  expect(lid.children).toHaveLength(1);
 });
 it('uses absolute time for flow and arbitrary camera keyframes',()=>{
  const e=createEngineeringHelpers(THREE),root=new THREE.Group();
  const update=e.FlowVisualizer(root,[e.V(0,0,0),e.V(1,1,0),e.V(2,1,1)],0x2ec4f1,12);
  const snapshot=()=>root.children.filter(o=>o.isInstancedMesh).map(o=>Array.from(o.instanceMatrix.array));
  update(2,.8);const first=snapshot();update(5,.2);update(2,.8);expect(snapshot()).toEqual(first);
  update(0,0);expect(root.children.every(o=>!o.visible)).toBe(true);
  const camera=new THREE.PerspectiveCamera(26,9/16,.1,180);
  const keys=[[0,[8,6,10],[0,1,0]],[4,[5,4,7],[0,1,0]]];
  e.CameraDirector(camera,2,keys);const pos=camera.position.toArray();
  e.CameraDirector(camera,4,keys);e.CameraDirector(camera,2,keys);
  expect(camera.position.toArray()).toEqual(pos);
 });
 it('advertises optional helpers and keeps the opaque-origin runtime',()=>{
  const prompt=code3dPrompt('Uma tampa revela as peças internas de uma máquina','9:16');
  expect(prompt).toContain('E3D.CutawaySystem');
  expect(prompt).toContain('E3D.TechnicalCallout');
  const shell=buildSandboxSrcdoc({token:'a'.repeat(32),nonce:'b'.repeat(32),parentOrigin:'https://example.com',minDuration:8,maxDuration:12,defaultDuration:10});
  expect(shell).toContain('createScene(THREE,canvas,w,h,E3D)');
  expect(shell).toContain("connect-src 'none'");
  expect(shell).not.toContain('allow-same-origin');
 });
});
