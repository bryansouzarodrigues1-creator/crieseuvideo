import {describe,it,expect} from 'vitest';
import {normalizeGroups,groupPoint,groupIssues} from './editorialGroups';
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
