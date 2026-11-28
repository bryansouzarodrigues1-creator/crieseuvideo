import {describe,it,expect} from 'vitest';
import {normalizePlan,fitToTrack} from './plan';
import {editorialExportStatus} from './editorialExport';
const plan={...normalizePlan({scenes:[{text:'O ar esfria.',visual:'custom',drawing:[{type:'rect'}]}]},'O ar esfria.','9:16'),engine:'2d' as const};
const track={duration:8} as AudioBuffer;
describe('editorial export readiness',()=>{
 it('permits a valid narration or intentional silent project',()=>{
  expect(editorialExportStatus(plan,null)).toBeNull();
  expect(editorialExportStatus(fitToTrack(plan,8),track)).toBeNull();
 });
 it('does not silently discard lost narration or export an invalid timeline',()=>{
  expect(editorialExportStatus(fitToTrack(plan,8),null)).toMatch(/narração/);
  expect(editorialExportStatus(plan,track)).toMatch(/narração/);
  expect(editorialExportStatus(fitToTrack(plan,120),{duration:120} as AudioBuffer)).toMatch(/120 segundos/);
  expect(editorialExportStatus({...plan,scenes:[]},null)).not.toBeNull();
 });
});