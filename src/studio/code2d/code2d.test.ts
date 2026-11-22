import {afterEach,describe,expect,it,vi} from 'vitest';
import {code2dPrompt,extractCode2D,validateCode2DDuration} from './contract';
import {checkCode2D,generateCode2DWithGemini} from '../server/code2dGemini';
import {buildCode2DSandboxSrcdoc} from './sandbox';

const originalKey=process.env.GEMINI_API_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY=originalKey;
});
const PROGRAM="function createScene(canvas,width,height){const ctx=canvas.getContext('2d');return {duration:40,renderAt(t){ctx.clearRect(0,0,width,height);ctx.fillRect(t*10,20,10,10)},dispose(){}};}";
const FENCE=String.fromCharCode(96).repeat(3);

describe('code2d new engine: original 40s user-directed animation',()=>{
  it('asks Gemini for full-code 40 seconds instead of the old 8-second shape presets',()=>{
    const p=code2dPrompt('Uma loja muda seu estoque','9:16',40);
    expect(p).toContain('duration:40');
    expect(p).toContain('40 segundos');
    expect(p).toContain('renderAt(t)');
    expect(p).toContain('personagens');
    expect(p).not.toContain('8–12');
    expect(validateCode2DDuration(40)).toBe(40);
    expect(validateCode2DDuration(8)).toBeNull();
    expect(validateCode2DDuration(65)).toBeNull();
  });
  it('extracts JS and rejects invalid or too large outputs',()=>{
    expect(extractCode2D(FENCE+'js\n'+PROGRAM+'\n'+FENCE)).toBe(PROGRAM);
    expect(extractCode2D('sem código')).toBeNull();
    expect(checkCode2D(PROGRAM)).toMatchObject({ok:true});
    expect(checkCode2D('function foo() {}')).toMatchObject({ok:false});
    expect(checkCode2D('import x from "https://example.com"; function createScene() {}')).toMatchObject({ok:false});
    expect(checkCode2D('function createScene(){fetch("https://a");}')).toMatchObject({ok:false});
    expect(checkCode2D('function createScene(){window.location="https://a";}')).toMatchObject({ok:false});
  });
  it('isolates generated code with opaque sandbox and network-disabled CSP',()=>{
    const html=buildCode2DSandboxSrcdoc({token:'a'.repeat(32),nonce:'b'.repeat(32),parentOrigin:'https://crieseuvideo.example',duration:40});
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("worker-src 'none'");
    expect(html).toContain('createImageBitmap');
    expect(html).toContain('DURATION=40');
    expect(html).not.toContain(PROGRAM);
    expect(()=>buildCode2DSandboxSrcdoc({token:'a'.repeat(32),nonce:'b'.repeat(32),parentOrigin:'https://crieseuvideo.example',duration:8})).toThrow();
  });
  it('makes exactly one direct Gemini High call with no Lovable fallback',async()=>{
    process.env.GEMINI_API_KEY='test-secret';
    const requests:{url:string;body:any}[]=[];
    vi.stubGlobal('fetch',vi.fn(async (url:RequestInfo|URL,opt?:RequestInit)=>{
      requests.push({url:String(url),body:JSON.parse(String(opt?.body))});
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:PROGRAM}]}}]}),{status:200});
    }));
    const r=await generateCode2DWithGemini('Crie uma sequência na fábrica','9:16',40);
    expect(r).toMatchObject({ok:true,duration:40,thinkingLevel:'HIGH'});
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('generativelanguage.googleapis.com');
    expect(requests[0].body.generationConfig.thinkingConfig.thinkingLevel).toBe('HIGH');
    expect(requests[0].body.generationConfig.responseMimeType).toBe('text/plain');
  });
  it('reports provider errors without fabricating a short video or retrying',async()=>{
    process.env.GEMINI_API_KEY='test-secret';
    const fn=vi.fn(async()=>new Response('',{status:503}));
    vi.stubGlobal('fetch',fn);
    const r=await generateCode2DWithGemini('Uma loja com personagens reais','9:16',40);
    expect(r).toMatchObject({ok:false,failure:'service_unavailable',thinkingLevel:'HIGH'});
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
