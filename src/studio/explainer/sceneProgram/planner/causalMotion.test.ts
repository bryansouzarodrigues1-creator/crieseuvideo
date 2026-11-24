import {describe,expect,it} from 'vitest';
import {compileCompactWorld, CompactWorldError} from './compactWorldDirector';
import {sourceBriefsFromScript} from './sceneScript';
import {compileSceneProgram} from '../score';
import {SceneProgram3D} from '../stage3d';

const story=sourceBriefsFromScript(
 'O guindaste prende a caixa e começa a erguer o material do canteiro. '+
 'O carrinho do guindaste desloca a caixa suspensa até a plataforma. '+
 'O cabo desce e deposita cuidadosamente a mesma caixa na plataforma.'
);
const factory=()=>({
 version:1,setting:'industrial',background:'#C5DCEB',
 entities:[
  {id:'crane',name:'Guindaste com carrinho móvel',kind:'crane',at:[-2,0,0],size:[7,9,3],color:'#D6A442'},
  {id:'load',name:'A mesma caixa do começo ao fim',kind:'cargo',at:[1,1,0],size:[1.5,1,1],color:'#C9B394'},
  {id:'landing',name:'Plataforma elevada de recebimento',kind:'platform',at:[2.2,0,0],size:[3.2,1,3],color:'#8199A2'},
 ],
 actions:[
  {sourceId:'s1',target:'load',kind:'lift',delta:[0,3,0]},
  {sourceId:'s2',target:'load',kind:'move',delta:[1.2,0,0]},
  {sourceId:'s3',target:'load',kind:'lower',delta:[0,-3,0],onto:'landing'},
 ]
});

describe('3D causal motion: one persistent cargo, three story beats',()=>{
 it('lifts, carries and lowers the SAME object without teleporting across cuts',()=>{
  const clip=compileCompactWorld(factory(),story);
  expect(clip.duration).toBe(12);
  expect(clip.program.nodes.filter(n=>n.id==='load')).toHaveLength(1);
  expect(clip.program.tracks.filter(t=>t.node==='load'&&t.channel==='position')).toHaveLength(1);
  const timeline=compileSceneProgram(clip.program,clip.sources);
  const get=(time:number,id:string)=>timeline.sample(time).get(id)!.position;
  const begin=get(0,'load'),up=get(3.99,'load');
  const carried=get(7.99,'load'),end=get(12,'load');
  expect(end[1]+.02).toBeCloseTo(1,1); // cargo base meets the actual deck
  expect(begin).toEqual([1,1,0]);
  expect(up[1]-begin[1]).toBeGreaterThan(2.8);
  expect(carried[0]-up[0]).toBeGreaterThan(1.1);
  expect(carried[1]).toBeCloseTo(up[1],2);
  expect(end[0]).toBeCloseTo(carried[0],2);
  expect(end[1]).toBeCloseTo(begin[1],2);
  for(const cut of [4,8]){
   const before=get(cut-.001,'load'),after=get(cut+.001,'load');
   expect(Math.hypot(...before.map((v,i)=>v-after[i]))).toBeLessThan(.015);
  }
 });
 it('ties real hook and trolley to the cargo in X, Y, Z during all chapters',()=>{
  const clip=compileCompactWorld(factory(),story);
  const names=new Set(clip.program.nodes.map(n=>n.id));
  for(const id of ['crane-trolley','crane-hook','crane-cable','crane-winch'])
   expect(names.has(id)).toBe(true);
  const timelines=clip.program.tracks;
  for(const id of ['crane-trolley','crane-hook','crane-cable'])
   expect(timelines.filter(t=>t.node===id&&t.channel==='position')).toHaveLength(1);
  expect(timelines.filter(t=>t.node==='crane-cable'&&t.channel==='scale')).toHaveLength(1);
  expect(timelines.filter(t=>t.node==='crane-winch'&&t.channel==='rotation')).toHaveLength(1);
  const sampler=compileSceneProgram(clip.program,clip.sources);
  const crane=clip.program.nodes.find(n=>n.id==='crane')!;
  for(const time of [0,1.9,3.99,4.1,5.9,7.99,8.1,10.0,12]){
   const sample=sampler.sample(time);
   const cargo=sample.get('load')!.position;
   const hook=sample.get('crane-hook')!.position;
   const cable=sample.get('crane-cable')!.position;
   const trolley=sample.get('crane-trolley')!.position;
   expect(hook[0]+crane.position[0]).toBeCloseTo(cargo[0],2);
   expect(hook[2]+crane.position[2]).toBeCloseTo(cargo[2],2);
   expect(hook[1]+crane.position[1]).toBeCloseTo(cargo[1]+1.12,2);
   expect(cable[0]).toBeCloseTo(hook[0],2);
   expect(cable[2]).toBeCloseTo(hook[2],2);
   expect(trolley[0]).toBeCloseTo(hook[0],2);
   expect(trolley[2]).toBeCloseTo(hook[2],2);
  }
  const first=sampler.sample(0).get('crane-cable')!.scale[1];
  const raised=sampler.sample(3.99).get('crane-cable')!.scale[1];
  const lowered=sampler.sample(12).get('crane-cable')!.scale[1];
  expect(raised).toBeLessThan(first);
  expect(lowered).toBeCloseTo(first,2);
  // Camera must show the machine AND the cargo, not crop out the crane.
  expect(clip.program.shots.map(s=>s.subjects))
   .toEqual([['crane','load','landing'],['crane','load','landing'],['crane','load','landing']]);
 });
 it('executes the real 3D stage with the same mesh identities in all three beats',()=>{
  const clip=compileCompactWorld(factory(),story);
  const stage=new SceneProgram3D(clip.program,clip.sources);
  try{
   const load=stage.nodes.get('load');
   const hook=stage.nodes.get('crane-hook');
   for(const time of [0,2,3.8,4.2,6,7.8,8.2,10,11.98]){
    stage.update(time);
    stage.frame(9/16);
    expect(stage.nodes.get('load')).toBe(load);
    expect(stage.nodes.get('crane-hook')).toBe(hook);
    expect(stage.camera.position.toArray().every(Number.isFinite)).toBe(true);
   }
  }finally{stage.dispose();}
 });
 it('rejects gravity-defying lowering and cargo outside the jib',()=>{
  const tooLow=factory();
  tooLow.actions[2].delta=[0,-6,0];
  expect(()=>compileCompactWorld(tooLow,story)).toThrow(/piso/);
  const tooFar=factory();
  tooFar.actions[1].delta=[4,0,0];
  expect(()=>compileCompactWorld(tooFar,story)).toThrow(/alcance/);
 });
 it('still rejects conflicting actions in the SAME narration beat',()=>{
  const repeated=factory();
  repeated.actions[1].sourceId='s1';
  expect(()=>compileCompactWorld(repeated,story)).toThrow(CompactWorldError);
 });
});
