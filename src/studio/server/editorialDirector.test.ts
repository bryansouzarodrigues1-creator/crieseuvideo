import {describe,it,expect,vi} from 'vitest';
import {directEditorialPlan} from './editorialDirector';
const script='O ar entra quente. O aparelho remove calor.';
const scene=(text:string)=>({text,visual:'custom',composition:'authored',mood:'neutral',palette:'teal',backdrop:{top:'#123456',bottom:'#654321',elements:[]},drawing:[{type:'rect',x:0,y:0,w:400,h:100,color:'#EEEEEE'},{type:'circle',x:50,y:50,r:30,color:'#AAAAAA'}]});
const answer=(value:unknown)=>({text:JSON.stringify(value),problem:'invalid_response' as const,model:'gemini-3.6-flash',thinkingLevel:'high' as const});
describe('shared production editorial director',()=>{
 it('makes exactly one call and preserves every narrated word and custom art',async()=>{
  const provider=vi.fn(async(_prompt:string)=>answer({scenes:[scene('O ar entra quente.'),scene('O aparelho remove calor.')]}));
  const res=await directEditorialPlan({mode:'creative',gallery:[{id:'private',name:'SHOULD_NOT_APPEAR',drawing:[]}]},script,'9:16',true,provider);
  expect(res.status).toBe(200);expect(provider).toHaveBeenCalledTimes(1);
  expect(provider.mock.calls[0][0]).not.toContain('SHOULD_NOT_APPEAR');
  const data=await res.json();expect(data.plan.engine).toBe('2.5d');expect(data.plan.scenes.map((s:any)=>s.text).join(' ')).toBe(script);
  expect(data.plan.scenes.every((s:any)=>s.composition==='authored')).toBe(true);
 });
 it('rejects altered scripts and incomplete art without retry or substitute',async()=>{
  for(const [raw,code] of [[{scenes:[scene('Texto diferente.')]},'invalid_plan'],[{scenes:[{...scene(script),drawing:[]}]},'invalid_original_art']] as const){
   const provider=vi.fn(async()=>answer(raw));const res=await directEditorialPlan({},script,'9:16',false,provider);
   expect(res.status).toBe(502);expect((await res.json()).code).toBe(code);expect(provider).toHaveBeenCalledTimes(1);
  }
 });
 it('reports exhausted quota, never generating a fake video',async()=>{
  const provider=vi.fn(async()=>({...answer({}),text:null,problem:'quota' as const}));
  const res=await directEditorialPlan({},script,'9:16',true,provider);
  expect(res.status).toBe(503);expect(provider).toHaveBeenCalledTimes(1);expect((await res.json()).plan).toBeUndefined();
 });
});