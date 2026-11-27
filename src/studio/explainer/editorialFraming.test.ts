import {describe,it,expect} from 'vitest';
import {fixedEditorialPose,normalizeEditorialFraming} from './editorialFraming';
describe('fixed editorial framing',()=>{
 it('maps authored shifts without depending on subject extent',()=>{
  const zone={x0:40,y0:100,x1:1000,y1:1500};
  const a=fixedEditorialPose({x:0,y:0,zoom:1},zone,1);
  const b=fixedEditorialPose({x:0,y:100,zoom:1},zone,1);
  expect(b.scale).toBe(a.scale);
  expect(b.y-a.y).toBeCloseTo(100*a.scale);
 });
 it('rejects missing or invalid coordinates',()=>{
  for(const v of [null,{}, {x:0,y:0,zoom:2},{x:Infinity,y:0,zoom:1}])expect(normalizeEditorialFraming(v)).toBeUndefined();
 });
});