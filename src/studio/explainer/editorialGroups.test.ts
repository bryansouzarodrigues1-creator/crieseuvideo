import {describe,it,expect} from 'vitest';
import {normalizeGroups,groupPoint,groupIssues,groupPose} from './editorialGroups';
import {normalizeDrawing} from './drawing';
import {normalizePlan} from './plan';
import {motionAudit} from './motionAudit';
describe('linked editorial objects',()=>{
 const groups=normalizeGroups([{id:'motor',x:0,y:0,motion:[{time:0},{time:2,dx:100,rotation:90,ease:'linear'}]}]);
 const drawing=normalizeDrawing([{type:'rect',group:'motor',x:0,y:0,anim:'none'},{type:'circle',group:'motor',x:40,y:0,anim:'none'}])!;
 it('moves all pieces about the same pivot and preserves distance',()=>{
  const a=groupPoint(groups[0],0,0,2),b=groupPoint(groups[0],40,0,2);
  expect(a).toEqual({x:100,y:0});expect(b.x).toBeCloseTo(100);expect(b.y).toBeCloseTo(40);
  expect(Math.hypot(b.x-a.x,b.y-a.y)).toBeCloseTo(40);
  expect(groupPoint(groups[0],40,0,0)).toEqual({x:40,y:0});
 });
 it('rejects missing and mixed-depth groups',()=>{
  expect(groupIssues(drawing,[])).not.toEqual([]);
  expect(groupIssues(drawing,groups)).toEqual([]);
  expect(groupIssues([drawing[0],{...drawing[1],depth:'front'}],groups)).not.toEqual([]);
 });
 it('preserves group motion in plan and counts it as directed movement',()=>{
  const p=normalizePlan({scenes:[{text:'O motor gira.',visual:'custom',composition:'authored',drawing,groups}]},'O motor gira.','9:16');
  expect(p.scenes[0].groups).toEqual(groups);
  expect(motionAudit(p).directedObjects).toBe(2);
 });
});

describe('horizontal support constraint',()=>{
 const groups=normalizeGroups([{id:'truck',x:0,y:0,support:{anchorX:0,anchorY:120,surfaceY:200},motion:[{time:0,dx:-100,dy:-200},{time:2,dx:100,rotation:30,scale:1.5,ease:'linear'}]}]);
 it('pins the contact point exactly to the support line at arbitrary times',()=>{
  const g=groups[0];
  for(const t of [0,.25,1,1.7,2,4,.25]){
   const p=groupPoint(g,0,120,t);
   expect(p.y).toBeCloseTo(200,9);
  }
  expect(groupPose(g,0).dx).toBe(-100);
  expect(groupPose(g,2).dx).toBe(100);
  expect(groupPose(g,0).dy).toBe(80);
 });
 it('keeps the constraint through plan normalization and rejects invalid anchors',()=>{
  const p=normalizePlan({scenes:[{text:'O veículo anda.',visual:'custom',composition:'authored',drawing:[{type:'rect',group:'truck'},{type:'circle',group:'truck'}],groups}]},'O veículo anda.','9:16');
  expect(p.scenes[0].groups?.[0].support).toEqual(groups[0].support);
  expect(normalizeGroups([{...groups[0],support:{anchorX:0,anchorY:Infinity,surfaceY:200}}])).toEqual([]);
 });
});

describe('temporary attachment',()=>{
 const attachment={target:'hand',start:1,end:3,anchorX:50,anchorY:0,targetX:50,targetY:0};
 const groups=normalizeGroups([
  {id:'hand',x:0,y:0,motion:[{time:0},{time:1},{time:3,dx:100,dy:-80,rotation:30,scale:1.2,ease:'linear'},{time:5,dx:150}]},
  {id:'box',x:50,y:0,attachment,motion:[{time:0},{time:3},{time:5,dx:40,ease:'linear'}]}
 ]);
 const drawing=normalizeDrawing([
  {type:'rect',group:'hand',x:0,y:0},{type:'circle',group:'hand',x:50,y:0},
  {type:'rect',group:'box',x:50,y:0},{type:'rect',group:'box',x:60,y:10}
 ])!;
 it('aligns anchors while carrying, preserves release position and is seekable',()=>{
  expect(groupIssues(drawing,groups)).toEqual([]);
  const [hand,box]=groups;
  for(const t of [1,1.25,2,2.75,3,1.25]){
   const a=groupPoint(hand,50,0,t,groups),b=groupPoint(box,50,0,t,groups);
   expect(b.x).toBeCloseTo(a.x,9);expect(b.y).toBeCloseTo(a.y,9);
  }
  expect(groupPoint(box,50,0,.9,groups)).toEqual({x:50,y:0});
  const release=groupPoint(box,50,0,3,groups),later=groupPoint(box,50,0,5,groups);
  expect(later.x-release.x).toBeCloseTo(40,9);expect(later.y).toBeCloseTo(release.y,9);
  expect(groupPoint(box,50,0,3.000001,groups).x).toBeCloseTo(release.x,3);
 });
 it('rejects pickup gaps, chains, conflicting support and different layers',()=>{
  const [hand,box]=groups;
  expect(groupIssues(drawing,[hand,{...box,attachment:{...attachment,targetX:55}}])).not.toEqual([]);
  expect(groupIssues(drawing,[{...hand,attachment:{...attachment,target:'box'}},box])).not.toEqual([]);
  expect(groupIssues(drawing,[hand,{...box,support:{anchorX:50,anchorY:0,surfaceY:0}}])).not.toEqual([]);
  expect(groupIssues(drawing.map(s=>s.group==='hand'?{...s,depth:'back'}:s),groups)).not.toEqual([]);
  expect(normalizeGroups([{...box,attachment:{...attachment,end:0}}])).toEqual([]);
 });
 it('preserves attachment in normalized scenes',()=>{
  const p=normalizePlan({scenes:[{text:'A mão leva a caixa.',visual:'custom',composition:'authored',drawing,groups}]},'A mão leva a caixa.','9:16');
  expect(p.scenes[0].groups?.[1].attachment).toEqual(attachment);
 });
});
