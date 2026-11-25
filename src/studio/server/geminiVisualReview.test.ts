import {afterEach,describe,expect,it,vi} from 'vitest';
import {countDeckIntersections,reviewVisualScene,visualReviewInput} from './geminiVisualReview';
import {compileCompactWorld} from '../explainer/sceneProgram/planner/compactWorldDirector';
import {sourceBriefsFromScript} from '../explainer/sceneProgram/planner/sceneScript';
const script='O guindaste recolhe uma caixa no chão e a ergue acima dos obstáculos. O carrinho leva a mesma caixa pelo braço até a plataforma elevada. O cabo desce e deposita a caixa sobre a plataforma.';
const plan={version:1,setting:'industrial',background:'#B4D4E1',entities:[
{id:'guindaste',name:'Guindaste de torre',kind:'crane',at:[0,0,0],size:[4,12,6],color:'#D94E2B'},
{id:'caixa',name:'Caixa de materiais',kind:'cargo',at:[0.5,0,0],size:[1.5,1.5,1.5],color:'#C69C6D'},
{id:'plataforma',name:'Plataforma de entrega',kind:'platform',at:[2,0,0],size:[3,3,3],color:'#6C7A89'}],
actions:[{sourceId:'s1',target:'caixa',kind:'lift',delta:[0,5,0]},{sourceId:'s2',target:'caixa',kind:'move',delta:[1.5,0,0]},{sourceId:'s3',target:'caixa',kind:'lower',delta:[0,-2.03,0],onto:'plataforma'}]};
const fixed=structuredClone(plan);
fixed.entities[1].at=[.1,0,0];fixed.entities[2].at=[2.3,0,0];fixed.entities[2].size=[1.8,3,3];fixed.actions[1].delta=[2.2,0,0];
const request=visualReviewInput.parse({script,plan,frames:[0,4,8].map(time=>({time,mimeType:'image/jpeg',data:'A'.repeat(40)})),confirmCost:true});
const key=process.env.GEMINI_API_KEY;
afterEach(()=>{vi.unstubAllGlobals();if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;});
describe('visual review with real motor and mock provider (no paid calls)',()=>{
it('detects the original deck collision and a physically corrected path',()=>{
 const sources=sourceBriefsFromScript(script);
 expect(countDeckIntersections(plan,compileCompactWorld(plan,sources))).toBeGreaterThan(0);
 expect(countDeckIntersections(fixed,compileCompactWorld(fixed,sources))).toBe(0);
});
it('sends the actual image payloads in one High request and accepts a valid correction',async()=>{
 process.env.GEMINI_API_KEY='mock-key';
 const fetchMock=vi.fn(async (_url:string,init:RequestInit)=>{
  const body=JSON.parse(String(init.body));
  expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('high');
  expect(body.contents[0].parts.filter((p:any)=>p.inlineData)).toHaveLength(3);
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({issues:['Caixa atravessa o tablado'],correctedPlan:fixed})}]}}]});
 });
 vi.stubGlobal('fetch',fetchMock);
 const result=await reviewVisualScene(request);
 expect(result.status).toBe('corrected');expect(result.correctedHits).toBe(0);expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('rejects a correction that still intersects the deck and keeps original',async()=>{
 process.env.GEMINI_API_KEY='mock-key';
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({issues:['Interseção'],correctedPlan:plan})}]}}]})));
 expect((await reviewVisualScene(request)).status).toBe('rejected');
});
it('does not call provider for malformed timeline',async()=>{
 const fn=vi.fn();vi.stubGlobal('fetch',fn);
 await expect(reviewVisualScene({...request,frames:[request.frames[1],request.frames[0],request.frames[2]]})).rejects.toThrow();
 expect(fn).not.toHaveBeenCalled();
});
});
