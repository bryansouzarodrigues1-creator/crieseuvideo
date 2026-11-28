import {describe,it,expect} from 'vitest';
import {actorPose,actorContinuity,normalizeActor,ACTOR_ACTIONS,solveLimb} from './editorialActor';
import {normalizeDrawing} from './drawing';
import {normalizePlan} from './plan';
import {applySceneEdits} from './editorialEdits';
const raw={id:'worker',style:{skin:'#D7A27D',hair:'#503329',shirt:'#26778B',pants:'#293A4C',haircut:'short'},action:'walk',expression:'neutral',facing:'right',speaking:false};
const a=normalizeActor(raw)!;
const length=(p:{x:number;y:number},q:{x:number;y:number})=>Math.hypot(p.x-q.x,p.y-q.y);
describe('editorial articulated cast',()=>{
 it('normalizes explicit identity and rejects unsafe or missing style',()=>{
  expect(a).toEqual(raw);
  expect(normalizeActor({...raw,style:{...raw.style,skin:'url(x)'}})).toBeUndefined();
  expect(normalizeDrawing([{type:'actor',actor:{id:'bad'}}])).toBeUndefined();
 });
 it('keeps bone lengths for every action and seeking order',()=>{
  for(const action of ACTOR_ACTIONS)for(const t of [0,.1,.6,1.3,5,.1]){
   const actor={...a,action},q=actorPose(actor,t,.6);
   for(const [limbs,n] of [[q.arms,49],[q.legs,54]] as const)for(const l of limbs){
    expect(length(l.root,l.joint)).toBeCloseTo(n,8);expect(length(l.joint,l.end)).toBeCloseTo(n,8);
   }
   expect(actorPose(actor,t,.6)).toEqual(q);
  }
  const unreachable=solveLimb({x:0,y:0},{x:1000,y:0},10,1);
  expect(Math.hypot(unreachable.end.x,unreachable.end.y)).toBeLessThan(20);
 });
 it('allows acting changes but detects duplicate identities and inconsistent wardrobe',()=>{
  expect(actorContinuity([[{actor:a}],[{actor:{...a,action:'point'}}]])).toEqual([]);
  expect(actorContinuity([[{actor:a},{actor:a}]])).toHaveLength(1);
  expect(actorContinuity([[{actor:a}],[{actor:{...a,style:{...a.style,shirt:'#FFFFFF'}}}]])).toHaveLength(1);
 });
 it('preserves the actor in a plan and supports reversible acting corrections',()=>{
  const scene=normalizePlan({scenes:[{text:'Ele aponta.',visual:'custom',composition:'authored',drawing:[{type:'actor',actor:a}]}]},'Ele aponta.','9:16').scenes[0];
  const next=applySceneEdits(scene,[{target:'shape_0',op:'acting',action:'point',expression:'happy',facing:'left',speaking:false}]);
  expect(next.drawing?.[0].actor).toEqual({...a,action:'point',expression:'happy',facing:'left'});
  expect(scene.drawing?.[0].actor).toEqual(a);
  expect(()=>applySceneEdits(scene,[{target:'shape_0',op:'acting',action:'unknown',expression:'happy',facing:'left',speaking:false}])).toThrow();
 });
});