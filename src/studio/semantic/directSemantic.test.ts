import {describe,it,expect} from 'vitest';
import {compileDirectSemantic,SemanticPlanError} from './directSemantic';

const plan={
 version:1,duration:8,
 zones:[{id:'door'},{id:'car'},{id:'tool_rack'}],
 actors:[{id:'mechanic',startZone:'door'}],
 props:[{id:'wheel',startZone:'car'}],
 actions:[
  {id:'walk_car',verb:'move_to',actorId:'mechanic',at:0,duration:2,zoneId:'car'},
  {id:'grab_wheel',verb:'pick_up',actorId:'mechanic',at:2,duration:1,propId:'wheel'},
  {id:'walk_rack',verb:'move_to',actorId:'mechanic',at:3,duration:2,zoneId:'tool_rack'},
  {id:'put_wheel',verb:'place_on',actorId:'mechanic',at:5,duration:1,zoneId:'tool_rack',propId:'wheel'},
  {id:'look_car',verb:'look_at',actorId:'mechanic',at:6,duration:1,targetId:'car'},
 ],
};
const clone=()=>JSON.parse(JSON.stringify(plan));
describe('directSemantic: actions instead of hundreds of coordinates',()=>{
 it('compiles a causal mechanic movement, pickup, carry and release',()=>{
  const result=compileDirectSemantic(plan);
  expect(result.duration).toBe(8);
  expect(result.actions.map(x=>x.verb)).toEqual(['move_to','pick_up','move_to','place_on','look_at']);
  expect(result.finalPropZones.wheel).toBe('tool_rack');
  expect(result.finalActorZones.mechanic).toBe('tool_rack');
  expect(result.actions[1].heldPropAfter).toBe('wheel');
  expect(result.actions[3].heldPropAfter).toBeNull();
 });
 it('blocks grabbing items without moving to them first',()=>{
  const bad=clone();bad.actions.shift();
  expect(()=>compileDirectSemantic(bad)).toThrow('fora do alcance');
 });
 it('blocks teleporting objects to a destination without walking',()=>{
  const bad=clone();bad.actions.splice(2,1);
  expect(()=>compileDirectSemantic(bad)).toThrow('falta aproximar');
 });
 it('blocks overlapping actor actions and contradictory possession',()=>{
  const a=clone();a.actions[1].at=1;
  expect(()=>compileDirectSemantic(a)).toThrow('simultâneas');
  const b=clone();b.actions[3].propId='another_wheel';
  expect(()=>compileDirectSemantic(b)).toThrow();
 });
 it('rejects unknown semantic IDs, invalid durations and arbitrary code',()=>{
  const a=clone();a.actions[0].zoneId='not_a_zone';
  expect(()=>compileDirectSemantic(a)).toThrow();
  const b=clone();b.duration=4;
  expect(()=>compileDirectSemantic(b)).toThrow();
  const c=clone();c.actions[0].code='eval("bad")';
  expect(()=>compileDirectSemantic(c)).toThrow(SemanticPlanError);
 });
 it('does not generate meshes, geometry, IK or camera coordinates',()=>{
  const s=JSON.stringify(compileDirectSemantic(plan));
  expect(s).not.toContain('position:');
  expect(s).not.toContain('three.js');
 });
});