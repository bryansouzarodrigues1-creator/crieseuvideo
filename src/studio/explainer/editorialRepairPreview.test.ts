import {describe,it,expect} from 'vitest';
import {buildRepairCandidate,compareEditorialReviews} from './editorialRepairPreview';
import {normalizePlan,fitToTrack,totalDuration} from './plan';
import type {EditorialReview,ReviewIssue} from './editorialReview';
const report=(issues:ReviewIssue[]):EditorialReview=>({scenes:2,frames:6,metrics:[],issues});
const issue=(scene:number,code:ReviewIssue['code']):ReviewIssue=>({scene,code,message:code});
describe('editorial repair preview',()=>{
 it('compares issue identity by scene and type, not total count',()=>{
  const old=report([issue(1,'small_art'),issue(2,'little_motion')]);
  const next=report([issue(1,'empty_art'),issue(2,'little_motion')]);
  const delta=compareEditorialReviews(old,next);
  expect(delta.resolved).toEqual([old.issues[0]]);
  expect(delta.introduced).toEqual([next.issues[0]]);
  expect(delta.blocked).toBe(true);
 });
 it('keeps pre-existing empty art and subjective warnings advisory',()=>{
  const old=report([issue(1,'empty_art')]);
  expect(compareEditorialReviews(old,report([...old.issues,issue(2,'repeated_background')])).blocked).toBe(false);
 });
 it('does not change the original project or the other scenes or narration timing',()=>{
  const plan=fitToTrack(normalizePlan({scenes:[{text:'Um motor.',visual:'custom',composition:'authored',drawing:[{type:'rect',x:0,y:0}]},{text:'Outro lugar.',visual:'custom',composition:'authored',drawing:[{type:'circle'}]}]},'Um motor. Outro lugar.','9:16'),8);
  const before=JSON.stringify(plan);
  const after=buildRepairCandidate(plan,0,[{target:'shape_0',op:'move',dx:40,dy:30}]);
  expect(after.scenes[0].drawing?.[0]).toMatchObject({x:40,y:30});
  expect(after.scenes[1]).toBe(plan.scenes[1]);
  expect(after.scenes[0].voice).toBe(plan.scenes[0].voice);
  expect(totalDuration(after)).toBe(totalDuration(plan));
  expect(JSON.stringify(plan)).toBe(before);
  expect(()=>buildRepairCandidate(plan,-1,[])).toThrow();
 });
});
