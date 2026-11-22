import {CODE2D_MAX_SCRIPT_CHARS,extractCode2D,type Code2DAspect} from '../code2d/contract';
import {
 buildAnimatorPrompt,buildDirectorPrompt,buildLovableReviewPrompt,buildStoryPrompt,
 parseTextJson,validateDirectorNotes,validateStoryboard,
 type StudioStep,type Storyboard,
} from '../code2d/multiAgentContract';
import {askFreeTextProvider,freeProviderConfiguration} from './freeCode2DProviders';
import {ask3DWorldAi,askGeminiForExplainer} from './ai';
import {checkCode2D} from './code2dGemini';

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
 * One Groq storyboard, optional ONE Gemini HIGH visual-direction request,
 * one optional explicitly approved Lovable artistic review,
 * one OpenRouter :free coding request and deterministic local checks.
 * No Lovable, no automatic retries, no surprise paid endpoints.
 * The video is NOT assumed artistic success before browser frame review.
 */
export async function generateMultiAgentCode2D(
 topic:string,aspect:Code2DAspect,duration:number,useLovableReview=false,
):Promise<MultiAgentResult>{
 const steps:StudioStep[]=[];
 const fail=(failure:string,message:string):MultiAgentFailure=>({
  ok:false,mode:'multi',model:'',failure,message,thinkingLevel:'MULTI',steps,
 });
 if(topic.length>CODE2D_MAX_SCRIPT_CHARS||topic.trim().length<12||duration<30||duration>60)
  return fail('invalid_input','Tema ou duração fora do contrato Code2D.');

 // Fail-fast before spending ANY provider quota on an incomplete pipeline.
 const groq=freeProviderConfiguration('groq');
 const coder=freeProviderConfiguration('openrouter');
 if(!groq.key||!coder.key){
  return fail('not_configured',
   'Equipe gratuita requer GROQ_API_KEY e OPENROUTER_API_KEY no servidor. Nenhuma chamada foi feita.');
 }
 if(!groq.safe||!coder.safe){
  return fail('unsafe_model',
   'Modelo não está na lista gratuita permitida. Nenhuma chamada foi feita.');
 }

 // 1) Storyteller (Groq) — writes human narration and the causal shot list.
 const storyResponse=await askFreeTextProvider('groq',buildStoryPrompt(topic,aspect,duration),'json');
 if(!storyResponse.ok){
  steps.push({stage:'story',provider:'groq',model:storyResponse.model,status:'failed',detail:storyResponse.problem});
  return fail('story_failed','O roteirista gratuito falhou: '+storyResponse.problem);
 }
 const validated=validateStoryboard(parseTextJson(storyResponse.text),duration);
 if(!validated.ok){
  steps.push({stage:'story',provider:'groq',model:storyResponse.model,status:'failed',detail:validated.message});
  return fail('invalid_storyboard',validated.message);
 }
 const board=validated.storyboard;
 steps.push({stage:'story',provider:'groq',model:storyResponse.model,status:'ok',
  detail:board.scenes.length+' cenas, roteiro e elenco com tempos conferidos'});

 // 2) Visual director (Gemini High), OPTIONAL on free-tier outages or missing key.
 // Only validated notes reach the coder. Skipping never counts as AI approval.
 let direction=null;
 if(process.env.GEMINI_API_KEY&&process.env.CODE2D_SKIP_GEMINI_DIRECTION!=='true'){
  const r=await askGeminiForExplainer(buildDirectorPrompt(board));
  if(r.text){
   direction=validateDirectorNotes(parseTextJson(r.text),board);
   steps.push({stage:'direction',provider:'gemini',model:r.model,
     status:direction?'ok':'skipped',
     detail:direction?'Direção HIGH aplicada ao programador':'Direção HIGH retornou notas inválidas; plano preservado sem alterações'});
  }else{
   steps.push({stage:'direction',provider:'gemini',model:r.model,status:'skipped',
     detail:'Direção HIGH indisponível ('+r.problem+'). Roteiro Groq mantido sem falsa aprovação'});
  }
 }else{
  steps.push({stage:'direction',provider:'gemini',model:'gemini high',status:'skipped',
   detail:'Gemini não configurado ou direção opcional desabilitada'});
 }

 // 3) Optional Lovable AI artistic review: separate gateway credits.
 // User must enable it explicitly; free editor build credits are NOT
 // guaranteed to fund this inference.
 let lovableNotes=null;
 if(useLovableReview){
  const model=process.env.LOVABLE_AI_MODEL||'google/gemini-3.7-flash';
  if(!process.env.LOVABLE_API_KEY){
   steps.push({stage:'lovable_review',provider:'lovable',model,status:'skipped',
     detail:'LOVABLE_API_KEY ausente; não foi gasto crédito. Revisão não realizada'});
  }else{
   try{
    const response=await ask3DWorldAi(
      buildLovableReviewPrompt(board,direction),'lovable',
      text=>!!validateDirectorNotes(parseTextJson(text),board),
    );
    lovableNotes=response?validateDirectorNotes(parseTextJson(response.text),board):null;
    steps.push({stage:'lovable_review',provider:'lovable',model,
      status:lovableNotes?'ok':'skipped',
      detail:lovableNotes?'Revisão criativa estruturada recebida; vídeo ainda não foi visto nem renderizado':
        'Revisão não aplicada; nenhuma aprovação inferida'});
   }catch{
    steps.push({stage:'lovable_review',provider:'lovable',model,status:'skipped',
      detail:'Gateway Lovable indisponível ou sem créditos; nenhuma troca de provedor'});
   }
  }
 }else{
  steps.push({stage:'lovable_review',provider:'lovable',model:'não solicitado',status:'skipped',
    detail:'Revisão Lovable desativada para preservar créditos'});
 }

 // 4) Canvas programmer (a verified :free OpenRouter model).
 const codeResult=await askFreeTextProvider(
  'openrouter',buildAnimatorPrompt(topic,board,direction,aspect,duration,lovableNotes),'javascript',
 );
 if(!codeResult.ok){
  steps.push({stage:'animation',provider:'openrouter',model:codeResult.model,status:'failed',detail:codeResult.problem});
  return fail('animation_failed','O programador gratuito falhou: '+codeResult.problem);
 }
 const code=extractCode2D(codeResult.text);
 if(!code){
  steps.push({stage:'animation',provider:'openrouter',model:codeResult.model,status:'failed',detail:'Programa ausente ou grande demais'});
  return fail('missing_code','A IA não entregou um programa Canvas válido.');
 }
 steps.push({stage:'animation',provider:'openrouter',model:codeResult.model,status:'ok',
  detail:'Programa JavaScript entregue para validação, sem alegar qualidade artística'});
 const check=checkCode2D(code);
 if(!check.ok){
  steps.push({stage:'validation',provider:'local',model:'Acorn',status:'failed',detail:check.error});
  return fail('invalid_program','Código rejeitado: '+check.error);
 }
 steps.push({stage:'validation',provider:'local',model:'Acorn',status:'ok',
  detail:'Sintaxe aprovada; replay e avaliação visual dependem do navegador'});
 return {
  ok:true,mode:'multi',model:codeResult.model,code,duration,storyboard:board,
  thinkingLevel:'MULTI',warnings:check.warnings,steps,
 };
}
