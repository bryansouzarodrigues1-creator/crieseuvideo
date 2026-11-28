import {describe,it,expect} from 'vitest';
import {actorHandPoint} from './editorialActor';
import {normalizeDrawing} from './drawing';
import {normalizeGroups,groupPoint,groupIssues} from './editorialGroups';
const actor=normalizeDrawing([{type:'actor',x:0,y:0,anim:'none',actor:{id:'worker',style:{skin:'#D7A27D',hair:'#503329',shirt:'#26778B',pants:'#293A4C',haircut:'short'},action:'point',expression:'neutral',facing:'right',speaking:false},motion:[{time:0},{time:3,dx:100,rotation:15,ease:'linear'},{time:5,dx:200}]}])![0];
const hand=actorHandPoint(actor,0,'right')!;
const shapes=[actor,...normalizeDrawing([{type:'rect',x:hand.x,y:hand.y,group:'box'},{type:'rect',x:hand.x,y:hand.y+10,group:'box'}])!];
const group=normalizeGroups([{id:'box',x:hand.x,y:hand.y,motion:[{time:0}],grip:{actor:'worker',hand:'right',start:0,end:3,anchorX:hand.x,anchorY:hand.y}}])[0];
describe('actor hand contact',()=>{
 it('tracks the actual rendered hand, including root rotation and translation',()=>{
  expect(groupIssues(shapes,[group])).toEqual([]);
  for(const t of [0,.1,1.5,3,.1]){
   const a=actorHandPoint(actor,t,'right')!,b=groupPoint(group,hand.x,hand.y,t,[group],shapes);
   expect(b.x).toBeCloseTo(a.x,8);expect(b.y).toBeCloseTo(a.y,8);
  }
  expect(groupPoint(group,hand.x,hand.y,5,[group],shapes)).toEqual(groupPoint(group,hand.x,hand.y,3,[group],shapes));
 });
 it('rejects distant pickup and missing or incompatible actors',()=>{
  expect(groupIssues(shapes,[{...group,grip:{...group.grip!,anchorX:hand.x-100}}])).not.toEqual([]);
  expect(groupIssues(shapes.slice(1),[group])).not.toEqual([]);
  expect(groupIssues([{...actor,depth:'front'},...shapes.slice(1)],[group])).not.toEqual([]);
  expect(actorHandPoint({...actor,actor:{...actor.actor!,action:'talk'}},0,'right')).toBeUndefined();
 });
});