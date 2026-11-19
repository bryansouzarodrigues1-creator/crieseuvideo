import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ask3DWorldAi,Ai3DProviderError} from './ai';

const LOVABLE=process.env.LOVABLE_API_KEY;
const GEMINI=process.env.GEMINI_API_KEY;
function restore(){
  if(LOVABLE===undefined)delete process.env.LOVABLE_API_KEY; else process.env.LOVABLE_API_KEY=LOVABLE;
  if(GEMINI===undefined)delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=GEMINI;
}
beforeEach(()=>{delete process.env.LOVABLE_API_KEY;delete process.env.GEMINI_API_KEY;});
afterEach(()=>{restore();vi.unstubAllGlobals();});
describe('safe diagnostic of real 3D AI provider failures (no real credits)',()=>{
  it('reports a missing Lovable key, without falling back when explicitly chosen',async()=>{
    const fetchMock=vi.fn();
    vi.stubGlobal('fetch',fetchMock);
    const error=await ask3DWorldAi('test scene','lovable').catch(e=>e);
    expect(error).toBeInstanceOf(Ai3DProviderError);
    expect(error.failures).toEqual([{provider:'lovable',reason:'not_configured'}]);
    expect(error.message).toContain('chave não configurada');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('explains API authentication failure without leaking response bodies',async()=>{
    process.env.LOVABLE_API_KEY='dummy-secret-token';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('secret body',{status:401})));
    const error=await ask3DWorldAi('test scene','lovable').catch(e=>e);
    expect(error.failures).toEqual([{provider:'lovable',reason:'unauthorized'}]);
    expect(error.message).not.toContain('secret body');
    expect(error.message).not.toContain('dummy-secret-token');
  });
  it('reports a Gemini quota response clearly',async()=>{
    process.env.GEMINI_API_KEY='dummy-key';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:429})));
    const error=await ask3DWorldAi('test scene','gemini').catch(e=>e);
    expect(error.failures).toEqual([{provider:'gemini',reason:'quota'}]);
  });
  it('uses Gemini only in auto mode after the failed Lovable request',async()=>{
    process.env.LOVABLE_API_KEY='dummy-lovable';
    process.env.GEMINI_API_KEY='dummy-gemini';
    const mocked=vi.fn(async(input:string|URL|Request)=>{
      if(String(input).includes('ai.gateway.lovable.dev'))return new Response('',{status:503});
      return Response.json({candidates:[{content:{parts:[{text:'{"version":1,"clips":[]}'}]}}]});
    });
    vi.stubGlobal('fetch',mocked);
    const result=await ask3DWorldAi('test scene','auto');
    expect(result?.provider).toBe('gemini');
    expect(mocked).toHaveBeenCalledTimes(2);
  });
});
