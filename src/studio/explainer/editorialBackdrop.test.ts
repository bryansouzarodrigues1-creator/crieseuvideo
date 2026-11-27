import {describe,it,expect} from 'vitest';
import {normalizeBackdrop} from './editorialBackdrop';
import {normalizePlan} from './plan';
import {foregroundExtent,laidOut} from './layout';
describe('original editorial art',()=>{
 it('normalizes bounded backdrop and rejects invalid paint/geometry',()=>{
  expect(normalizeBackdrop({top:'url(x)',bottom:'#112233',elements:[]})).toBeUndefined();
  const a=normalizeBackdrop({top:'#123456',bottom:'#abcdef',elements:[{type:'rect',x:9999,y:-12,w:100000,h:200,color:'#112233'},{type:'poly',color:'#ffffff',points:[[0,1]]},{type:'image',color:'#ffffff'}]})!;
  expect(a.elements).toHaveLength(1);
  expect(a.elements[0]).toMatchObject({x:1000,y:0,w:2000});
 });
 it('retains authored artwork, zero outlines and independent scenery',()=>{
  const drawing=Array.from({length:12},(_,i)=>({type:'rect',x:i*5,y:i*5,w:120,h:120,strokeWidth:0,color:'#123456'}));
  const backdrop={top:'#123456',bottom:'#abcdef',elements:[]};
  const p=normalizePlan({scenes:[{text:'Um motor.',visual:'custom',drawing,composition:'authored',backdrop},{text:'Uma fábrica.',visual:'custom',drawing,composition:'authored',backdrop:{...backdrop,top:'#aa4411'}}]},'Um motor. Uma fábrica.','9:16');
  expect(p.scenes[0].drawing).toHaveLength(12);
  expect(p.scenes[0].drawing![0].strokeWidth).toBe(0);
  expect(p.scenes[0].composition).toBe('authored');
  expect(laidOut(p.scenes[0].drawing!).length).toBeLessThan(12);
  expect(p.scenes[0].backdrop).not.toEqual(p.scenes[1].backdrop);
  expect(foregroundExtent(p.scenes[0].drawing!,true)).not.toBeNull();
 });
});
