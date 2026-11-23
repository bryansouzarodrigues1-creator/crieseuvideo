import {describe,it,expect,vi} from 'vitest';
import {inspectVisualProbe,validateWithSingleRepair,type FrameSample,type VisualProbe} from './visualLoop';

const sample=(at:number,shift:number):FrameSample=>{
 const rgba=new Uint8Array(4*4*4);
 for(let i=0;i<16;i++){
  rgba[i*4]=(i+shift)%3===0?230:20;
  rgba[i*4+1]=i%2===0?140:30;
  rgba[i*4+2]=60;
  rgba[i*4+3]=255;
 }
 return {at,width:4,height:4,rgba};
};
const moving=():VisualProbe=>({
 frames:[sample(0,0),sample(2,1),sample(4,2)],
 replayFirst:sample(0,0),
});
const still=():VisualProbe=>({
 frames:[sample(0,0),sample(2,0),sample(4,0)],
 replayFirst:sample(0,0),
});
describe('3-frame feedback loop without external API or false artistic claims',()=>{
 it('confirms deterministic A-B-A replay and actual changed pixels',()=>{
  const r=inspectVisualProbe(moving());
  expect(r.ok).toBe(true);
  expect(r.changedPixelFraction).toBeGreaterThan(0);
  expect(r.uniqueColorCount).toBeGreaterThan(1);
 });
 it('flags static frames or nondeterministic replay',()=>{
  expect(inspectVisualProbe(still()).problems.some(x=>x.code==='static_animation')).toBe(true);
  const p=moving();p.replayFirst.rgba[0]=11;
  expect(inspectVisualProbe(p).problems.some(x=>x.code==='nondeterministic_replay')).toBe(true);
 });
 it('surfaces clipping/collision metadata from real renderer',()=>{
  const p=moving();
  p.frames[1].clippedLabels=['legenda'];
  p.frames[2].intersections=['mão atravessa caixa'];
  const found=inspectVisualProbe(p).problems.map(x=>x.code);
  expect(found).toContain('clipped_text');
  expect(found).toContain('geometry_intersection');
 });
 it('repairs exactly once and validates/inspects the new render',async()=>{
  const render=vi.fn(async(plan:{move:boolean})=>plan.move?moving():still());
  const repair=vi.fn(async()=>({move:true}));
  const validate=vi.fn((plan:{move:boolean})=>{if(typeof plan.move!=='boolean')throw Error('bad');});
  const result=await validateWithSingleRepair({move:false},render,repair,validate);
  expect(result.status).toBe('repaired');
  expect(result.repairCalls).toBe(1);
  expect(render).toHaveBeenCalledTimes(2);
  expect(repair).toHaveBeenCalledTimes(1);
 });
 it('never calls a paid repair after a satisfactory render',async()=>{
  const render=vi.fn(async()=>moving());
  const repair=vi.fn(async()=>({move:true}));
  const result=await validateWithSingleRepair({move:true},render,repair,()=>{});
  expect(result.status).toBe('passed');
  expect(result.repairCalls).toBe(0);
  expect(repair).not.toHaveBeenCalled();
 });
 it('stops after one unsuccessful repair rather than looping or claiming success',async()=>{
  const render=vi.fn(async()=>still());
  const repair=vi.fn(async(plan:{move:boolean})=>plan);
  const result=await validateWithSingleRepair({move:false},render,repair,()=>{});
  expect(result.status).toBe('failed');
  expect(result.repairCalls).toBe(1);
  expect(repair).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(2);
 });
});