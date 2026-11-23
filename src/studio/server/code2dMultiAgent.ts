import {CODE2D_MAX_SCRIPT_CHARS,extractCode2D,type Code2DAspect} from '../code2d/contract';
import {
 buildAnimatorPrompt,buildDirectorPrompt,buildLovableReviewPrompt,buildStoryPrompt,
 parseTextJson,validateDirectorNotes,validateStoryboard,
 type DirectorNotes,type StudioStep,type Storyboard,type StudioStage,
} from '../code2d/multiAgentContract';
import {askFreeTextProvider,freeProviderConfiguration,type FreeTextProvider} from './freeCode2DProviders';
import {ask3DWorldAi,askGeminiForExplainer} from './ai';
import {checkCode2D,generateCode2DWithGemini} from './code2dGemini';

export type MultiAgentSuccess={
 ok:true;mode:'multi';model:string;code:string;duration:number;
 storyboard:Storyboard;thinkingLevel:'MULTI';warnings:string[];steps:StudioStep[];
};
export type MultiAgentFailure={
 ok:false;mode:'multi';model:string;failure:string;message:string;
 thinkingLevel:'MULTI';steps:StudioStep[];
};
export type MultiAgentResult=MultiAgentSuccess|MultiAgentFailure;

/**
 * One user click starts one bounded team orchestration, never paid provider
 * fallback, never identical model retries. Each role owns a validated artifact.
 * AI-generated JS is still only code until the sandbox replays/render checks it.
 */
export const CODE2D_MAX_TEAM_PROVIDER_CALLS=8;
export const CODE2D_MAX_ATTEMPTS_PER_ROLE=3;
type GeminiKey='primary'|'alternate';
const keyExists=(key:GeminiKey)=>Boolean(
 key==='primary'?process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY_ALT,
);
const keyFallbackAllowed=(problem:string|null)=>[
 'unauthorized','forbidden','quota','not_configured','model_unavailable',
].includes(String(problem));

export async function generateMultiAgentCode2D(
 topic:string,aspect:Code2DAspect,duration:number,useLovableReview=false,
):Promise<MultiAgentResult>{
 const steps:StudioStep[]=[];
 const fail=(failure:string,message:string):MultiAgentFailure=>({
  ok:false,mode:'multi',model:'',failure,message,thinkingLevel:'MULTI',steps,
 });
 if(topic.length>CODE2D_MAX_SCRIPT_CHARS||topic.trim().length<12||
   !Number.isInteger(duration)||duration<30||duration>60)
  return fail('invalid_input','Tema ou duração fora do contrato Code2D.');

 const groq=freeProviderConfiguration('groq');
 const coder=freeProviderConfiguration('openrouter');
 if(!groq.safe||!coder.safe)
  return fail('unsafe_model','Modelo não aprovado no modo gratuito. Nenhuma chamada foi feita.');
 if(!groq.key&&!coder.key&&!keyExists('primary')&&!keyExists('alternate'))
  return fail('not_configured','Configure pelo menos um provedor para iniciar. Nenhuma chamada foi feita.');

 let used=0;
 const available=()=>used<CODE2D_MAX_TEAM_PROVIDER_CALLS;
 const report=(stage:StudioStage,provider:StudioStep['provider'],
  model:string,status:StudioStep['status'],detail:string)=>{
  steps.push({stage,provider,model,status,detail});
 };
 const callFree=async (provider:FreeTextProvider,prompt:string,expected:'json'|'javascript')=>{
  const config=freeProviderConfiguration(provider);
  if(!config.key||!config.safe||!available())return {
   ok:false as const,problem:!config.key?'chave_ausente':!config.safe?'modelo_nao_permitido':'limite_da_equipe',
   model:config.model,
  };
  used++;
  return await askFreeTextProvider(provider,prompt,expected);
 };
 // Use the one model actually proved to answer with High thinking on this
 // server. Keep 3.8 configurable for a future validated comparison.
 const code2dGeminiModel=process.env.CODE2D_GEMINI_MODEL||'gemini-3.6-flash';
 const callGemini=async(prompt:string,key:GeminiKey)=>{
  if(!keyExists(key)||!available())return {
   text:null,model:code2dGeminiModel,
   problem:(!keyExists(key)?'not_configured':'quota') as 'not_configured'|'quota',
  };
  used++;
  return await askGeminiForExplainer(prompt,key,code2dGeminiModel);
 };

 // Story: Groq -> Gemini HIGH -> OpenRouter free. JSON and clock must validate.
 let board:Storyboard|null=null;
 const storyPrompt=buildStoryPrompt(topic,aspect,duration);
 let storyAttempts=0;
 const acceptStory=(raw:string,provider:StudioStep['provider'],model:string)=>{
  const valid=validateStoryboard(parseTextJson(raw),duration);
  report('story',provider,model,valid.ok?'ok':'failed',
   valid.ok?valid.storyboard.scenes.length+' cenas e linha do tempo completas':
      valid.message);
  if(valid.ok)board=valid.storyboard;
 };
 if(groq.key&&available()){
  storyAttempts++;
  const r=await callFree('groq',storyPrompt,'json');
  if(r.ok)acceptStory(r.text,'groq',r.model);
  else report('story','groq',r.model,'failed',r.problem);
 }
 if(!board&&storyAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&available()){
  const key:GeminiKey=keyExists('primary')?'primary':'alternate';
  if(keyExists(key)){
   storyAttempts++;
   const r=await callGemini(storyPrompt,key);
   if(r.text)acceptStory(r.text,'gemini',r.model);
   else {
    report('story','gemini',r.model,'failed','Gemini '+key+': '+r.problem);
    // Alternative key is only used for account/permission/quota errors.
    if(!board&&key==='primary'&&keyExists('alternate')&&keyFallbackAllowed(r.problem)
       &&storyAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&available()){
      storyAttempts++;
      const alt=await callGemini(storyPrompt,'alternate');
      if(alt.text)acceptStory(alt.text,'gemini',alt.model);
      else report('story','gemini',alt.model,'failed','Gemini alternate: '+alt.problem);
    }
   }
  }
 }
 if(!board&&storyAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&coder.key&&available()){
  storyAttempts++;
  const r=await callFree('openrouter',storyPrompt,'json');
  if(r.ok)acceptStory(r.text,'openrouter',r.model);
  else report('story','openrouter',r.model,'failed',r.problem);
 }
 if(!board)return fail('story_failed','Nenhum roteirista autorizado entregou storyboard válido. Não foi criado roteiro manual.');
 // Narrow the type for asynchronous closures and preserve the exact validated storyboard.
 const storyboard:Storyboard=board;

 // Direction: Gemini High -> Groq -> OpenRouter. Missing direction never looks
 // like an approved artistic review. Gemini alternative key only for auth/quota.
 let direction:DirectorNotes|null=null;
 if(process.env.CODE2D_SKIP_GEMINI_DIRECTION==='true'){
  report('direction','gemini','HIGH','skipped','Etapa opcional desabilitada no servidor');
 }else{
  const prompt=buildDirectorPrompt(storyboard);
  let attempts=0;
  const acceptNotes=(value:string,provider:StudioStep['provider'],model:string)=>{
   const parsed=validateDirectorNotes(parseTextJson(value),storyboard);
   report('direction',provider,model,parsed?'ok':'failed',
    parsed?'Direção de continuidade estruturada validada':'Notas inválidas; direção não aprovada');
   if(parsed)direction=parsed;
  };
  const key:GeminiKey=keyExists('primary')?'primary':'alternate';
  if(keyExists(key)&&available()){
   attempts++;
   const r=await callGemini(prompt,key);
   if(r.text)acceptNotes(r.text,'gemini',r.model);
   else {
    report('direction','gemini',r.model,'failed','Gemini '+key+': '+r.problem);
    if(!direction&&key==='primary'&&keyExists('alternate')&&keyFallbackAllowed(r.problem)
       &&attempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&available()){
      attempts++;
      const alt=await callGemini(prompt,'alternate');
      if(alt.text)acceptNotes(alt.text,'gemini',alt.model);
      else report('direction','gemini',alt.model,'failed','Gemini alternate: '+alt.problem);
    }
   }
  }
  if(!direction&&attempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&groq.key&&available()){
   attempts++;
   const r=await callFree('groq',prompt,'json');
   if(r.ok)acceptNotes(r.text,'groq',r.model);
   else report('direction','groq',r.model,'failed',r.problem);
  }
  if(!direction&&attempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&coder.key&&available()){
   attempts++;
   const r=await callFree('openrouter',prompt,'json');
   if(r.ok)acceptNotes(r.text,'openrouter',r.model);
   else report('direction','openrouter',r.model,'failed',r.problem);
  }
  if(!direction)report('direction','local','none','skipped',
   'Nenhum diretor entregou notas válidas; storyboard preservado, não houve aprovação artística');
 }

 // Lovable gateway is charged independently of the daily editor credits.
 // Never call without explicit UI opt-in; not a paid auto fallback.
 let lovableNotes:DirectorNotes|null=null;
 if(useLovableReview&&process.env.LOVABLE_API_KEY&&available()){
  used++;
  const model=process.env.LOVABLE_AI_MODEL||'google/gemini-3.7-flash';
  try{
   const response=await ask3DWorldAi(buildLovableReviewPrompt(storyboard,direction),
     'lovable',value=>!!validateDirectorNotes(parseTextJson(value),storyboard));
   lovableNotes=response?validateDirectorNotes(parseTextJson(response.text),storyboard):null;
   report('lovable_review','lovable',model,lovableNotes?'ok':'skipped',
    lovableNotes?'Análise estrutural recebida (não analisou quadros renderizados)':'Revisão inválida');
  }catch{
   report('lovable_review','lovable',model,'skipped',
    'Gateway indisponível ou sem créditos; sem nova tentativa ou troca automática');
  }
 }else report('lovable_review','lovable','opcional','skipped',
   useLovableReview?'Chave ausente ou orçamento de chamadas esgotado':'Desativado para preservar créditos');

 // Animator: OpenRouter free -> Groq (low reasoning) -> Gemini HIGH last.
 // Live proof: Particle-1 returned HTTP 429; Gemini High used 15,359
 // thinking tokens and only emitted a truncated 637-token code fragment.
 // Prioritize Groq's smaller reasoning budget before costly Gemini High.
 // Every candidate is syntax-checked; invalid output is a failure.
 const animatorPrompt=buildAnimatorPrompt(topic,storyboard,direction,aspect,duration,lovableNotes);
 let output:string|null=null,model='';
 let animationAttempts=0;
 const acceptCode=(text:string,provider:StudioStep['provider'],name:string)=>{
  const candidate=extractCode2D(text);
  const valid=candidate?checkCode2D(candidate):null;
  const ok=Boolean(valid?.ok&&candidate);
  report('animation',provider,name,ok?'ok':'failed',
   ok?'Código Canvas validado, sem presumir resultado artístico':
    valid&&'error' in valid?valid.error:'Programa ausente ou incompleto');
  if(ok&&candidate){output=candidate;model=name;}
 };
 if(coder.key&&available()){
  animationAttempts++;
  const r=await callFree('openrouter',animatorPrompt,'javascript');
  if(r.ok)acceptCode(r.text,'openrouter',r.model);
  else report('animation','openrouter',r.model,'failed',r.problem);
 }
 if(!output&&animationAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&groq.key&&available()){
  animationAttempts++;
  const r=await callFree('groq',animatorPrompt,'javascript');
  if(r.ok)acceptCode(r.text,'groq',r.model);
  else report('animation','groq',r.model,'failed',r.problem);
 }
 const gemKey:GeminiKey=keyExists('primary')?'primary':'alternate';
 if(!output&&animationAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&keyExists(gemKey)&&available()){
  animationAttempts++;
  used++;
  const r=await generateCode2DWithGemini(topic,aspect,duration,animatorPrompt,gemKey);
  if(r.ok){
   output=r.code;model=r.model;
   report('animation','gemini',r.model,'ok','Código gerado pelo Gemini High validado');
  }else{
   report('animation','gemini',r.model,'failed','Gemini '+gemKey+': '+r.failure);
   if(!output&&gemKey==='primary'&&keyExists('alternate')&&keyFallbackAllowed(r.failure)
     &&animationAttempts<CODE2D_MAX_ATTEMPTS_PER_ROLE&&available()){
    animationAttempts++;
    used++;
    const alt=await generateCode2DWithGemini(topic,aspect,duration,animatorPrompt,'alternate');
    if(alt.ok){
     output=alt.code;model=alt.model;
     report('animation','gemini',alt.model,'ok','Código gerado com chave Gemini alternativa');
    }else report('animation','gemini',alt.model,'failed','Gemini alternate: '+alt.failure);
   }
  }
 }
 if(!output)return fail('animation_failed','Nenhum programador entregou código válido. Não foi usado programa de demonstração.');
 report('validation','local','Acorn','ok','Sintaxe validada; replay e revisão visual ainda dependem do navegador.');
 return {ok:true,mode:'multi',model,code:output,duration,storyboard,
  thinkingLevel:'MULTI',warnings:[],steps};
}
