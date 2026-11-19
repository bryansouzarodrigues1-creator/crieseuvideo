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
  it('tries Gemini once if Lovable returns JSON without a valid scene, with explicit Auto selection',async()=>{
    process.env.LOVABLE_API_KEY='mock-lovable';
    process.env.GEMINI_API_KEY='mock-gemini';
    const fetched=vi.fn(async(input:string|URL|Request)=>{
      if(String(input).includes('ai.gateway.lovable.dev'))
        return Response.json({choices:[{message:{content:'{"version":1,"oops":true}'}}]});
      return Response.json({candidates:[{content:{parts:[{text:'{"version":1,"setting":"coast"}'}]}}]});
    });
    vi.stubGlobal('fetch',fetched);
    const output=await ask3DWorldAi('two-shot animated scene','auto',text=>{
      const json=JSON.parse(text) as {version:number;setting?:string};
      return json.version===1&&json.setting==='coast';
    });
    expect(output?.provider).toBe('gemini');
    expect(fetched).toHaveBeenCalledTimes(2);
  });
  it('never calls a second provider when a user explicitly selects Lovable',async()=>{
    process.env.LOVABLE_API_KEY='mock-lovable';
    process.env.GEMINI_API_KEY='mock-gemini';
    const fetched=vi.fn(async()=>Response.json({choices:[{message:{content:'{}'}}]}));
    vi.stubGlobal('fetch',fetched);
    const error=await ask3DWorldAi('valid requested world','lovable',()=>false).catch(e=>e);
    expect(error).toBeInstanceOf(Ai3DProviderError);
    expect(error.failures).toEqual([{provider:'lovable',reason:'invalid_response'}]);
    expect(fetched).toHaveBeenCalledTimes(1);
  });
  it('asks Gemini for a structured compact-world schema only for 3D generation',async()=>{
    process.env.GEMINI_API_KEY='test-key-not-real';
    const mock=vi.fn(async()=>Response.json({
      candidates:[{content:{parts:[{text:'{"version":1,"setting":"coast"}'}]}}]
    }));
    vi.stubGlobal('fetch',mock);
    const answer=await ask3DWorldAi('Gerar uma única cena','gemini',content=>{
      return JSON.parse(content).setting==='coast';
    });
    expect(answer?.provider).toBe('gemini');
    const [,options]=mock.mock.calls[0] as unknown as [string,RequestInit];
    const body=JSON.parse(String(options.body)) as any;
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.properties.entities.items.properties.kind.enum)
      .toContain('motorcycle');
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(1024);
    expect(body.generationConfig.temperature).toBeLessThan(0.5);
  });
  it('separates malformed JSON and invalid scene reports without exposing the answer',async()=>{
    process.env.LOVABLE_API_KEY='secret-sentinel';
    const mocked=vi.fn(async()=>Response.json({choices:[{message:{content:'uma descrição solta'}}]}));
    vi.stubGlobal('fetch',mocked);
    const error=await ask3DWorldAi('roteiro privado','lovable',()=> 'invalid_json').catch(e=>e);
    expect(error).toBeInstanceOf(Ai3DProviderError);
    expect(error.failures).toEqual([{provider:'lovable',reason:'invalid_json'}]);
    expect(error.message).toContain('JSON válido');
    expect(error.message).not.toContain('sentinel');
    expect(error.message).not.toContain('roteiro privado');
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
