import {afterEach,describe,expect,it,vi} from 'vitest';
import {askFreeTextProvider} from '../server/freeCode2DProviders';

const originalKey=process.env.OPENROUTER_API_KEY;
const originalModel=process.env.CODE2D_OPENROUTER_MODEL;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(originalKey===undefined)delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY=originalKey;
  if(originalModel===undefined)delete process.env.CODE2D_OPENROUTER_MODEL;
  else process.env.CODE2D_OPENROUTER_MODEL=originalModel;
});
describe('Free OpenRouter visible output budget',()=>{
  it('reserves visible output room for Code2D rather than letting Particle-1 think for all 12000 tokens',async()=>{
    process.env.OPENROUTER_API_KEY='test-key';
    delete process.env.CODE2D_OPENROUTER_MODEL;
    const seen:any[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,opts?:RequestInit)=>{
      seen.push(JSON.parse(String(opts?.body)));
      return new Response(JSON.stringify({
        choices:[{finish_reason:'stop',message:{content:'function createScene(canvas,width,height){return {duration:40,renderAt(t){},dispose(){}};}'}}],
      }),{status:200});
    }));
    const r=await askFreeTextProvider('openrouter','Write a Code2D animation','javascript');
    expect(r.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].model).toBe('particle-ai/particle-1:free');
    expect(seen[0].reasoning).toEqual({max_tokens:1800});
    expect(seen[0].max_tokens).toBeGreaterThan(13000);
  });
  it('distinguishes an all-reasoning completion from useful generated code',async()=>{
    process.env.OPENROUTER_API_KEY='test-key';
    const f=vi.fn(async()=>new Response(JSON.stringify({
      choices:[{finish_reason:'length',message:{content:''}}],
      usage:{completion_tokens:12000,completion_tokens_details:{reasoning_tokens:12000}},
    }),{status:200}));
    vi.stubGlobal('fetch',f);
    const r=await askFreeTextProvider('openrouter','Write Canvas code','javascript');
    expect(r).toMatchObject({ok:false,problem:'raciocinio_consumiu_saida'});
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('caps JSON reasoning too while preserving free model restrictions',async()=>{
    process.env.OPENROUTER_API_KEY='test-key';
    process.env.CODE2D_OPENROUTER_MODEL='anthropic/claude-sonnet-4';
    const f=vi.fn();
    vi.stubGlobal('fetch',f);
    const r=await askFreeTextProvider('openrouter','Write a story','json');
    expect(r).toMatchObject({ok:false,problem:'modelo_nao_permitido_no_modo_gratuito'});
    expect(f).not.toHaveBeenCalled();
  });
});
