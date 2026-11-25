import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ask3DWorldAi,Ai3DProviderError} from './ai';
import {gemini3DResponseSchema,parseAi3DScene} from './ai3dSchema';

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
  it('does not mislabel provider HTTP 400 as invalid 3D JSON',async()=>{
    process.env.LOVABLE_API_KEY='fake-lovable-token';
    process.env.GEMINI_API_KEY='fake-gemini-token';
    const fetched=vi.fn(async()=>new Response('request may contain private data',{status:400}));
    vi.stubGlobal('fetch',fetched);
    const failure=await ask3DWorldAi('test scene','auto').catch(e=>e);
    expect(failure).toBeInstanceOf(Ai3DProviderError);
    expect(failure.failures).toEqual([
      {provider:'lovable',reason:'invalid_request'},
      {provider:'gemini',reason:'invalid_request'},
    ]);
    expect(failure.message).toContain('HTTP 400/422');
    expect(failure.message).not.toContain('formato 3D esperado');
    expect(failure.message).not.toContain('private data');
    expect(fetched).toHaveBeenCalledTimes(2);
  });
  it('reports obsolete model 404 separately and requests a current Gemini model',async()=>{
    process.env.GEMINI_API_KEY='fake-gemini-token';
    const fetched=vi.fn(async(_input:RequestInfo|URL)=>new Response('secret provider diagnostic',{status:404}));
    vi.stubGlobal('fetch',fetched);
    const failure=await ask3DWorldAi('test scene','gemini').catch(e=>e);
    expect(failure.failures).toEqual([{provider:'gemini',reason:'model_unavailable'}]);
    expect(failure.message).toContain('HTTP 404');
    expect(failure.message).not.toContain('secret provider diagnostic');
    expect(String(fetched.mock.calls[0][0])).toContain('gemini-3.8-flash:generateContent');
    expect(fetched).toHaveBeenCalledTimes(1);
  });
  it('uses the explicitly selected Gemini 3.6 Flash after a 5xx with zero automatic retries',async()=>{
    process.env.GEMINI_API_KEY='dummy-secret-for-test-only';
    const fetched=vi.fn(async (url:string|URL|Request)=>new Response('',{status:503}));
    vi.stubGlobal('fetch',fetched);
    const problem=await ask3DWorldAi('scene','gemini',undefined,undefined,'gemini-3.6-flash').catch(e=>e);
    expect(problem).toBeInstanceOf(Ai3DProviderError);
    expect(problem.failures).toEqual([{provider:'gemini',reason:'service_unavailable'}]);
    expect(String(fetched.mock.calls[0][0])).toContain('/models/gemini-3.6-flash:generateContent');
    expect(fetched).toHaveBeenCalledTimes(1);
  });
  it('selects Gemini 3.5 Flash-Lite only when explicitly requested',async()=>{
    process.env.GEMINI_API_KEY='dummy-test-secret';
    const fetchMock=vi.fn(async(_url:string|URL|Request)=>new Response('',{status:503}));
    vi.stubGlobal('fetch',fetchMock);
    const problem=await ask3DWorldAi('scene','gemini',undefined,undefined,'gemini-3.5-flash-lite').catch(e=>e);
    expect(problem).toBeInstanceOf(Ai3DProviderError);
    expect(problem.failures[0].reason).toBe('service_unavailable');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not automatically swap Gemini models when Google returns HTTP 500',async()=>{
    process.env.GEMINI_API_KEY='dummy-secret';
    const fetched=vi.fn(async()=>new Response('',{status:500}));
    vi.stubGlobal('fetch',fetched);
    const error=await ask3DWorldAi('scene','gemini',undefined,undefined,'gemini-3.8-flash').catch(e=>e);
    expect(error.failures).toEqual([{provider:'gemini',reason:'service_unavailable'}]);
    expect(fetched).toHaveBeenCalledTimes(1);
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
  it('sends a real 3D response schema with chapter-specific source IDs to Gemini',async()=>{
    process.env.GEMINI_API_KEY='mock-gemini';
    let captured:unknown;
    const modelScene={
      version:1,setting:'city',background:'#D6EBF0',
      entities:[
        {id:'home',name:'Garagem da cidade',kind:'building',at:[-4,0,-6],size:[8,5,3],color:'#9DAAB8'},
        {id:'gate',name:'Portão de metal',kind:'gate',at:[1,0,2],size:[3,2.2,.3],color:'#BBBBCC'}
      ],
      actions:[{sourceId:'s1',target:'gate',kind:'lift',delta:[0,2.6,0]}]
    };
    vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init:RequestInit)=>{
      captured=JSON.parse(String(init.body));
      return Response.json({candidates:[{finishReason:'STOP',
        content:{parts:[{text:JSON.stringify(modelScene)}]}}]});
    }));
    const schema=gemini3DResponseSchema(['s1']);
    const result=await ask3DWorldAi('one-shot test','gemini',
      txt=>({accepted:!!parseAi3DScene(txt)}),schema);
    expect(result?.provider).toBe('gemini');
    expect((captured as any).generationConfig.responseMimeType).toBe('application/json');
    expect((captured as any).generationConfig.responseSchema).toEqual(schema);
    expect((captured as any).generationConfig.responseSchema.properties.actions.items.properties.sourceId.enum)
      .toEqual(['s1']);
  });
  it('accepts safely segmented gateway text without spending a second request',async()=>{
    process.env.LOVABLE_API_KEY='mock-lovable';
    const fetchMock=vi.fn(async()=>Response.json({choices:[{
      finish_reason:'stop',
      message:{content:[
        {type:'text',text:'{"version":1,'},{type:'text',text:'"setting":"city"}'}
      ]}
    }]}));
    vi.stubGlobal('fetch',fetchMock);
    const result=await ask3DWorldAi('scene','lovable',txt=>({accepted:
      parseAi3DScene(txt)?.setting==='city'}));
    expect(result?.provider).toBe('lovable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('separates valid JSON with an incompatible scene from malformed JSON',async()=>{
    process.env.LOVABLE_API_KEY='mock-lovable';process.env.GEMINI_API_KEY='mock-gemini';
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      if(url.includes('lovable'))
        return Response.json({choices:[{message:{content:'{"scene":{"version":1,"entities":[]}}'}}]});
      return Response.json({candidates:[{content:{parts:[{text:'not JSON'}]}}]});
    }));
    const error=await ask3DWorldAi('problem / solution','auto',text=>{
      const value=parseAi3DScene(text);
      return value?{accepted:false,reason:'invalid_scene'}:{accepted:false,reason:'invalid_json'};
    },gemini3DResponseSchema(['s1','s2'])).catch(e=>e);
    expect(error).toBeInstanceOf(Ai3DProviderError);
    expect(error.failures).toEqual([
      {provider:'lovable',reason:'invalid_scene'},
      {provider:'gemini',reason:'invalid_json'}
    ]);
    expect(error.message).not.toContain('{"scene"');
  });
  it('flags truncated output rather than pretending it is a usable scene',async()=>{
    process.env.GEMINI_API_KEY='mock-gemini';
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({candidates:[{
      finishReason:'MAX_TOKENS',content:{parts:[{text:'{"version":1,'}]}
    }]})));
    const error=await ask3DWorldAi('test','gemini').catch(e=>e);
    expect(error.failures).toEqual([{provider:'gemini',reason:'truncated_response'}]);
  });
  it('reports a safety block as blocked, not as an empty response',async()=>{
    process.env.GEMINI_API_KEY='mock-gemini';
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}})));
    const error=await ask3DWorldAi('test','gemini').catch(e=>e);
    expect(error.failures).toEqual([{provider:'gemini',reason:'blocked'}]);
    expect(String(error.message)).toMatch(/política de segurança/);
  });
  it('ignores visible thought parts and keeps only the JSON answer',async()=>{
    process.env.GEMINI_API_KEY='mock-gemini';
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({candidates:[{content:{parts:[
      {text:'vou pensar...',thought:true},{text:'{"version":1}'}]}}]})));
    const result=await ask3DWorldAi('test','gemini');
    expect(result?.text).toBe('{"version":1}');
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
