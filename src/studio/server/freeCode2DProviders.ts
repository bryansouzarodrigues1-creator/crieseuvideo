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
    // A REAL Particle-1 free API test with reasoning.enabled=false returned
    // valid JS (684 completion tokens, 0 reasoning tokens, finish_reason=stop).
    // Earlier, the same model spent 12k/12k tokens only on reasoning and
    // returned empty content. Keep explicit budget for other free models,
    // which may not accept a disabled reasoning mode.
    max_tokens:expected==='json'?3000:14000,
    ...(provider==='openrouter'?{
      reasoning:config.model==='particle-ai/particle-1:free'
        ? {enabled:false}
        : {max_tokens:expected==='javascript'?1800:650},
    }:{}),
    ...(provider==='groq'?{reasoning_effort:'low'}:{}),
    ...(provider==='groq'&&expected==='json'?{response_format:{type:'json_object'}}:{}),
   }),
  });
  if(!res.ok)return fail(classify(res.status));
  const data=await res.json();
  const result=textFrom(data);
  const reasonTokens=Number(data?.usage?.completion_tokens_details?.reasoning_tokens||0);
  const allTokens=Number(data?.usage?.completion_tokens||0);
  if(data?.choices?.[0]?.finish_reason==='length')
    return fail(allTokens>0&&reasonTokens>=allTokens-1?'raciocinio_consumiu_saida':'saida_truncada');
  if(!result||!result.trim())
    return fail(reasonTokens>0?'sem_texto_apos_raciocinio':'resposta_vazia');
  return {ok:true,text:result,model:config.model};
 }catch(e){
  return fail(e instanceof Error&&e.name==='AbortError'?'timeout':'rede');
 }finally{clearTimeout(timer);}
}
