import {describe,it,expect} from 'vitest';
import {extractArt,coverage,frameDifference} from './editorialReview';
const pixels=(...values:number[])=>new Uint8ClampedArray(values);
describe('editorial frame review',()=>{
 it('does not count identical backdrop as artwork',()=>{
  const back=pixels(20,30,40,255,20,30,40,255);
  expect(coverage(extractArt(back,back))).toBe(0);
  const frame=pixels(20,30,40,255,180,190,200,255);
  expect(coverage(extractArt(frame,back))).toBe(.5);
 });
 it('detects action but ignores changing background under a stationary object',()=>{
  const a=pixels(10,10,10,255,200,200,200,255);
  const b=pixels(40,40,40,255,200,200,200,255);
  const backA=pixels(10,10,10,255,10,10,10,255);
  const backB=pixels(40,40,40,255,40,40,40,255);
  const artA=extractArt(a,backA),artB=extractArt(b,backB);
  expect(frameDifference(artA,artB)).toBe(0);
  expect(frameDifference(a,b)).toBe(.5);
  expect(frameDifference(artB,extractArt(backB,backB))).toBe(.5);
 });
 it('rejects incompatible buffers',()=>{
  expect(()=>extractArt(pixels(0),pixels(0))).toThrow();
  expect(()=>frameDifference(pixels(0,0,0,0),pixels())).toThrow();
 });
});
