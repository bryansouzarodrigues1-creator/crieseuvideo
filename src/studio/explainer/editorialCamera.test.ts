import {describe,it,expect} from 'vitest';
import {editorialCameraPose,normalizeEditorialShot,EDITORIAL_SHOTS,EDITORIAL_CAMERA_MAX_SCALE,EDITORIAL_CAMERA_MAX_SHIFT} from './editorialCamera';
import {normalizePlan} from './plan';
describe('editorial camera',()=>{
 it('preserves approved camera direction and rejects arbitrary commands',()=>{
  expect(normalizeEditorialShot('slide_left')).toBe('slide_left');
  expect(normalizeEditorialShot('javascript:alert(1)')).toBeUndefined();
  const p=normalizePlan({scenes:[{text:'Um teste.',camera:'push_in'}]},'Um teste.','9:16');
  expect(p.scenes[0].camera).toBe('push_in');
 });
 it('has genuine relative depth while flat layers move together',()=>{
  const back=editorialCameraPose('slide_right','back',5,5,true);
  const front=editorialCameraPose('slide_right','front',5,5,true);
  expect(front.x).toBeGreaterThan(back.x*4);
  expect(front.scale).toBeGreaterThan(back.scale);
  expect(editorialCameraPose('slide_right','back',5,5,false)).toEqual(editorialCameraPose('slide_right','front',5,5,false));
 });
 it('bounds all camera motions and seeks independently',()=>{
  for(const shot of EDITORIAL_SHOTS)for(const layer of ['back','middle','front'] as const)for(let t=0;t<=5;t+=.1){
   const p=editorialCameraPose(shot,layer,t,5,true);
   expect(Math.abs(p.x)).toBeLessThanOrEqual(EDITORIAL_CAMERA_MAX_SHIFT+1e-9);
   expect(p.scale).toBeLessThanOrEqual(EDITORIAL_CAMERA_MAX_SCALE);
   editorialCameraPose(shot,layer,5,5,true);
   expect(editorialCameraPose(shot,layer,t,5,true)).toEqual(p);
  }
 });
});
