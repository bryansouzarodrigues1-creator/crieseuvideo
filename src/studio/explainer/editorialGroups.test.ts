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

describe('temporary object attachment',()=>{
 const attachment={carrier:'hand',start:1,end:3,anchorX:0,anchorY:0,carrierX:0,carrierY:0};
 const groups=normalizeGroups([
  {id:'hand',x:0,y:0,motion:[{time:0},{time:1},{time:3,dx:180,dy:-60,ease:'linear'},{time:4,dx:240,dy:-60,ease:'linear'}]},
  {id:'box',x:0,y:0,motion:[{time:0}],attachment}
 ]);
 const shapes=normalizeDrawing(['hand','box'].flatMap(group=>[{type:'rect',group},{type:'circle',group}]))!;
 it('preserves pickup, follows carrier, releases without snapping and seeks backwards',()=>{
  const [hand,box]=groups;
  expect(groupIssues(shapes,groups)).toEqual([]);
  for(const t of [1,1.5,2,3,1.25])expect(groupPoint(box,0,0,t,groups)).toEqual(groupPoint(hand,0,0,t,groups));
  expect(groupPoint(box,0,0,.5,groups)).toEqual({x:0,y:0});
  expect(groupPoint(box,0,0,4,groups)).toEqual({x:180,y:-60});
  expect(groupPoint(hand,0,0,4,groups)).toEqual({x:240,y:-60});
 });
 it('rejects missing carriers, cycles, initial gaps and cross-layer attachments',()=>{
  for(const invalid of [
    [{...groups[0]}, {...groups[1],attachment:{...attachment,carrier:'missing'}}],
    [{...groups[0],attachment:{...attachment,carrier:'box'}},groups[1]],
    [groups[0],{...groups[1],attachment:{...attachment,anchorX:100}}],
    [groups[0],{...groups[1],support:{anchorX:0,anchorY:0,surfaceY:0}}]
  ])expect(groupIssues(shapes,invalid).length).toBeGreaterThan(0);
  expect(groupIssues(shapes.map(s=>s.group==='box'?{...s,depth:'front'}:s),groups).length).toBeGreaterThan(0);
 });
 it('preserves attachment through plan normalization',()=>{
  const p=normalizePlan({scenes:[{text:'Transporta a caixa.',visual:'custom',composition:'authored',drawing:shapes,groups}]},'Transporta a caixa.','9:16');
  expect(p.scenes[0].groups?.find(g=>g.id==='box')?.attachment).toEqual(attachment);
 });
});
