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
