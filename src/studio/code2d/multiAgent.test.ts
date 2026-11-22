import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {generateMultiAgentCode2D} from '../server/code2dMultiAgent';
import {validateStoryboard} from './multiAgentContract';

const KEYS=['GEMINI_API_KEY','GROQ_API_KEY','OPENROUTER_API_KEY',
 'CODE2D_SKIP_GEMINI_DIRECTION','CODE2D_OPENROUTER_MODEL','CODE2D_GROQ_MODEL'] as const;
const original=Object.fromEntries(KEYS.map(k=>[k,process.env[k]])) as Record<string,string|undefined>;
const board={
 title:'Uma pequena oficina aprende a trabalhar melhor',
 characters:[{id:'ana',description:'Ana, cabelo preto, macacão azul e sapatos vermelhos'}],
 scenes:Array.from({length:5},(_,i)=>({
  id:'s'+(i+1),start:i*8,end:(i+1)*8,
  narration:'Ana trabalha na oficina e encontra uma maneira de resolver os problemas.',
  setting:'Oficina iluminada, bancadas e ferramentas nas paredes',
  action:'Ana pega uma caixa, transporta até a bancada e apoia sem atravessar objetos.',
  camera:'Plano médio de acompanhamento com deslocamento lateral',
  props:['caixa','bancada','ferramentas'],
 })),
};
const CODE='function createScene(canvas,width,height){const c=canvas.getContext("2d");return {duration:40,renderAt(t){c.clearRect(0,0,width,height);c.fillRect(t*2,0,80,90);},dispose(){}};}';
const answer=(body:any)=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(body)},finish_reason:'stop'}]}),{status:200});
const codeAnswer=()=>new Response(JSON.stringify({choices:[{message:{content:CODE},finish_reason:'stop'}]}),{status:200});
const geminiAnswer=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({
 continuity:'Ana mantém sempre a mesma roupa e câmera pelo mesmo lado.',
 notes:[{sceneId:'s1',direction:'A personagem usa o braço esquerdo e encosta realmente na caixa antes de levantar.'}],
})}]}}]}),{status:200});

beforeEach(()=>{
 process.env.GROQ_API_KEY='test-groq';
 process.env.OPENROUTER_API_KEY='test-openrouter';
 delete process.env.GEMINI_API_KEY;
 process.env.CODE2D_SKIP_GEMINI_DIRECTION='true';
 delete process.env.CODE2D_GROQ_MODEL;
 delete process.env.CODE2D_OPENROUTER_MODEL;
});
afterEach(()=>{
 vi.unstubAllGlobals();
 for(const k of KEYS){
  if(original[k]===undefined)delete process.env[k];
  else process.env[k]=original[k];
 }
});

describe('free multi-agent Code2D orchestra',()=>{
 it('rejects missing keys before consuming even one free request',async()=>{
  delete process.env.GROQ_API_KEY;
  const f=vi.fn();vi.stubGlobal('fetch',f);
  const r=await generateMultiAgentCode2D('Uma história com movimento','9:16',40);
  expect(r).toMatchObject({ok:false,failure:'not_configured'});
  expect(f).not.toHaveBeenCalled();
 });
 it('validates strict contiguous storyboards and exact requested time',()=>{
  expect(validateStoryboard(board,40).ok).toBe(true);
  expect(validateStoryboard({...board,scenes:board.scenes.map((s,i)=>i===3?{...s,start:25}:s)},40).ok).toBe(false);
  expect(validateStoryboard(board,60).ok).toBe(false);
 });
 it('runs Groq story and OpenRouter free coder with stage audit, without Lovable',async()=>{
  const requests:{url:string;body:any}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   const address=String(url);requests.push({url:address,body:JSON.parse(String(init?.body))});
   return address.includes('api.groq.com')?answer(board):codeAnswer();
  }));
  const r=await generateMultiAgentCode2D('Uma história completa na oficina','9:16',40);
  expect(r).toMatchObject({ok:true,mode:'multi',duration:40,model:'particle-ai/particle-1:free'});
  if(!r.ok)throw Error(r.message);
  expect(r.storyboard.scenes).toHaveLength(5);
  expect(r.steps.map(x=>[x.stage,x.status])).toEqual([
   ['story','ok'],['direction','skipped'],['animation','ok'],['validation','ok']
  ]);
  expect(requests).toHaveLength(2);
  expect(requests[0].url).toContain('api.groq.com');
  expect(requests[1].url).toContain('openrouter.ai/api');
  expect(requests[1].body.model).toBe('particle-ai/particle-1:free');
  expect(requests[1].body.messages[0].content).toContain('Oficina iluminada');
  expect(requests.every(x=>!x.url.includes('lovable'))).toBe(true);
 });
 it('Gemini HIGH directs validated scenes but never edits the Groq script',async()=>{
  process.env.GEMINI_API_KEY='test-gemini';
  delete process.env.CODE2D_SKIP_GEMINI_DIRECTION;
  const requests:{url:string;body:any}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
   const address=String(url);requests.push({url:address,body:JSON.parse(String(init?.body))});
   return address.includes('groq')?answer(board):
     address.includes('generativelanguage.googleapis.com')?geminiAnswer():codeAnswer();
  }));
  const r=await generateMultiAgentCode2D('Uma animação com roteiro e cenário','9:16',40);
  expect(r.ok).toBe(true);
  if(!r.ok)throw Error(r.message);
  expect(requests).toHaveLength(3);
  const gemini=requests.find(x=>x.url.includes('generativelanguage'))!;
  expect(gemini.body.generationConfig.thinkingConfig.thinkingLevel).toBe('HIGH');
  const coder=requests.find(x=>x.url.includes('openrouter.ai'))!;
  expect(coder.body.messages[0].content).toContain('Ana mantém sempre a mesma roupa');
  expect(r.storyboard).toEqual(board);
  expect(r.steps[1]).toMatchObject({stage:'direction',status:'ok',provider:'gemini'});
 });
 it('skips a Gemini 503 instead of calling Lovable, without pretending it directed',async()=>{
  process.env.GEMINI_API_KEY='test-gemini';
  delete process.env.CODE2D_SKIP_GEMINI_DIRECTION;
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL)=>{
   calls.push(String(url));
   return String(url).includes('groq')?answer(board):
     String(url).includes('generativelanguage')?new Response('',{status:503}):codeAnswer();
  }));
  const r=await generateMultiAgentCode2D('Uma história em uma oficina real','9:16',40);
  expect(r.ok).toBe(true);
  if(!r.ok)throw Error(r.message);
  expect(r.steps[1]).toMatchObject({stage:'direction',status:'skipped',provider:'gemini'});
  expect(calls).toHaveLength(3);
  expect(calls.every(x=>!x.includes('lovable'))).toBe(true);
 });
 it('stops at quota exhaustion instead of wasting coding quota',async()=>{
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL)=>{
   calls.push(String(url));return new Response('',{status:429});
  }));
  const r=await generateMultiAgentCode2D('Uma história completa sobre oficinas','9:16',40);
  expect(r).toMatchObject({ok:false,failure:'story_failed'});
  expect(calls).toHaveLength(1);
 });
 it('rejects a paid OpenRouter model and does not send any request',async()=>{
  process.env.CODE2D_OPENROUTER_MODEL='anthropic/claude-sonnet-4';
  const f=vi.fn();vi.stubGlobal('fetch',f);
  const r=await generateMultiAgentCode2D('Uma história de máquina animada','9:16',40);
  expect(r).toMatchObject({ok:false,failure:'unsafe_model'});
  expect(f).not.toHaveBeenCalled();
 });
 it('rejects a broken Groq storyboard before calling the programmer',async()=>{
  const f=vi.fn(async()=>answer({...board,scenes:board.scenes.slice(0,1)}));
  vi.stubGlobal('fetch',f);
  const r=await generateMultiAgentCode2D('O tempo precisa bater exatamente','9:16',40);
  expect(r).toMatchObject({ok:false,failure:'invalid_storyboard'});
  expect(f).toHaveBeenCalledTimes(1);
 });
});
