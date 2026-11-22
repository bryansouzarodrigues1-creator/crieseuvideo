/** Explicit free-provider adapters. No Lovable gateway, no silent paid models.
 * A configured API key is not proof that the account itself has no billing.
 * The user must keep Groq/Gemini accounts on their free tiers if cost matters.
 */
export type TextResult=
  |{ok:true;text:string;model:string}
  |{ok:false;problem:string;model:string};

const classify=(status:number)=>{
 if(status===401)return 'chave_rejeitada';
 if(status===403)return 'acesso_negado';
 if(status===404)return 'modelo_indisponivel';
 if(status===429)return 'cota_esgotada';
 if(status===400||status===422)return 'configuracao_invalida';
 return status>=500?'servico_indisponivel':'resposta_invalida';
};
const textFrom=(data:any):string|null=>{
 const c=data?.choices?.[0];
 const raw=c?.message?.content;
 if(c?.finish_reason==='length')return null;
 return typeof raw==='string'&&raw.trim()?raw:
   Array.isArray(raw)?raw.filter((v:any)=>v&&typeof v.text==='string').map((v:any)=>v.text).join('')||null:null;
};
const allowedModels={
 groq:['openai/gpt-oss-120b','qwen/qwen3.8-27b'] as const,
 openrouter:['particle-ai/particle-1:free','nvidia/nemotron-3-ultra-550b-a55b:free','openrouter/free'] as const,
};
export type FreeTextProvider='groq'|'openrouter';

export function freeProviderConfiguration(provider:FreeTextProvider):{key:string|undefined;model:string;safe:boolean}{
 if(provider==='groq'){
  const model=process.env.CODE2D_GROQ_MODEL||'openai/gpt-oss-120b';
  return {key:process.env.GROQ_API_KEY,model,safe:(allowedModels.groq as readonly string[]).includes(model)};
 }
 const model=process.env.CODE2D_OPENROUTER_MODEL||'particle-ai/particle-1:free';
 return {key:process.env.OPENROUTER_API_KEY,model,safe:(allowedModels.openrouter as readonly string[]).includes(model)};
}

export async function askFreeTextProvider(
 provider:FreeTextProvider,prompt:string,expected:'json'|'javascript',
):Promise<TextResult>{
 const config=freeProviderConfiguration(provider);
 const fail=(problem:string):TextResult=>({ok:false,problem,model:config.model});
 if(!config.key)return fail('chave_ausente');
 if(!config.safe)return fail('modelo_nao_permitido_no_modo_gratuito');
 const url=provider==='groq'
   ?'https://api.groq.com/openai/v1/chat/completions'
   :'https://openrouter.ai/api/v1/chat/completions';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),130_000);
 try{
  const res=await fetch(url,{
   method:'POST',signal:ctrl.signal,
   headers:{'Authorization':'Bearer '+config.key,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:config.model,
    temperature:expected==='json'?.2:.35,
    messages:[{role:'user',content:prompt}],
    max_tokens:expected==='json'?2300:14000,
    ...(provider==='groq'&&expected==='json'?{response_format:{type:'json_object'}}:{}),
   }),
  });
  if(!res.ok)return fail(classify(res.status));
  const data=await res.json();
  if(data?.choices?.[0]?.finish_reason==='length')return fail('saida_truncada');
  const result=textFrom(data);
  if(!result||!result.trim())return fail('resposta_vazia');
  return {ok:true,text:result,model:config.model};
 }catch(e){
  return fail(e instanceof Error&&e.name==='AbortError'?'timeout':'rede');
 }finally{clearTimeout(timer);}
}
