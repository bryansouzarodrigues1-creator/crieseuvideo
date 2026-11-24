/**
 * Read-only provider diagnostic for the authenticated CrieSeuVideo 3D studio.
 * GET model metadata does not generate text and does not consume output tokens.
 * It does NOT test capacity for generateContent, so availability is qualified.
 * Never send raw Google error responses or API credentials to the browser.
 */
import {createServerFn} from '@tanstack/react-start';
import {setResponseHeader} from '@tanstack/react-start/server';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {resolveGeminiModel} from './server/ai';
import type {GeminiModelChoice} from './server/ai';
import {formatGeminiCause,readGeminiErrorDiagnostic} from './server/geminiFailure';
import type {GeminiErrorCause} from './server/geminiFailure';

export type GeminiModelStatus = {
  model:string;
  status:'available'|'not_configured'|'unauthorized'|'forbidden'|
    'not_found'|'rate_limited'|'unavailable'|'timeout'|'network_error'|'incompatible';
  httpStatus?:number;
  note:string;
};

const input=z.object({
  geminiModel:z.enum(['default','gemini-3.6-flash','gemini-3.8-flash'])
}).strict();

export const checkGeminiModelStatus=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator((data)=>input.parse(data))
  .handler(async({data}):Promise<GeminiModelStatus>=>{
    setResponseHeader('Cache-Control','private, no-store');
    const model=resolveGeminiModel(data.geminiModel as GeminiModelChoice);
    const key=process.env.GEMINI_API_KEY;
    if(!key)return{
      model,status:'not_configured',note:'GEMINI_API_KEY não está configurada neste servidor.'
    };
    // A model ID is resolved from a strict allowlist/server config; never
    // allow user-supplied URLs or expose response body containing metadata.
    if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(model))
      return{model:'inválido',status:'incompatible',note:'O identificador de modelo do servidor não é permitido.'};
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),10000);
    try{
      const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model),{
        method:'GET',headers:{'x-goog-api-key':key,Accept:'application/json'},signal:ctrl.signal,
      });
      if(!res.ok){
        const status:GeminiModelStatus['status']=
          res.status===401?'unauthorized':res.status===403?'forbidden':
          res.status===404?'not_found':res.status===429?'rate_limited':'unavailable';
        return{model,status,httpStatus:res.status,note:status==='unavailable'
          ?'Google retornou erro nesta consulta de metadados; isso não prova falha na chave.'
          :'Consulta ao modelo não autorizada, indisponível ou limitada.'};
      }
      const json:unknown=await res.json();
      if(!json||typeof json!=='object')return{
        model,status:'incompatible',httpStatus:res.status,note:'A API não forneceu metadados válidos do modelo.'
      };
      const supported=(json as {supportedGenerationMethods?:unknown}).supportedGenerationMethods;
      if(Array.isArray(supported)&&!supported.includes('generateContent'))
        return{model,status:'incompatible',httpStatus:res.status,note:'Este modelo não anuncia suporte a generateContent.'};
      return{model,status:'available',httpStatus:res.status,
        note:'Chave e identificador aceitos na consulta de metadados. A geração ainda pode retornar 500/503 por sobrecarga.'};
    }catch(e){
      return{model,status:e instanceof Error&&e.name==='AbortError'?'timeout':'network_error',
        note:'Não foi possível consultar os metadados do modelo. Nenhuma geração foi iniciada.'};
    }finally{clearTimeout(timer);}
  });


/** Explicit, ONE tiny content-generation call to isolate actual inference
 * availability from harmless metadata listing. It may consume input/output
 * tokens. No automatic retry, no failover or production video generation. */
export type GeminiInferenceProbe = {
  model:string;
  status:'success'|'not_configured'|'rate_limited'|'busy'|'failed'|'timeout'|'network_error';
  httpStatus?:number;
  cause?:GeminiErrorCause;
  durationMs?:number;
  tokenUsage?:number;
  note:string;
};

const userProbeTimes=new Map<string,number>();
const PROBE_COOLDOWN_MS=15*60*1000;

export const probeGeminiInference=createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator((data)=>input.parse(data))
  .handler(async({data,context}):Promise<GeminiInferenceProbe>=>{
    setResponseHeader('Cache-Control','private, no-store');
    const model=resolveGeminiModel(data.geminiModel as GeminiModelChoice);
    if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(model))
      return {model:'inválido',status:'failed',note:'Modelo inválido no servidor.'};
    const key=process.env.GEMINI_API_KEY;
    if(!key)return {model,status:'not_configured',note:'GEMINI_API_KEY ausente no servidor.'};
    const user=context.userId;
    const now=Date.now();
    const last=userProbeTimes.get(user)??0;
    if(now-last<PROBE_COOLDOWN_MS)
      return {model,status:'rate_limited',
        note:'O teste mínimo já foi solicitado recentemente. Aguarde 15 minutos para evitar gastar tokens repetidos.'};
    userProbeTimes.set(user,now);
    if(userProbeTimes.size>2000)userProbeTimes.clear();
    const started=Date.now();
    try{
      // Same Developer API base URL and server key as the full 3D call;
      // deliberately EXCLUDES the 3D schema/long prompt to isolate the fault.
      const res=await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
          method:'POST',
          headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
          body:JSON.stringify({
            contents:[{role:'user',parts:[{text:'Responda somente OK.'}]}],
            generationConfig:{maxOutputTokens:80,thinkingConfig:{thinkingLevel:'low'}},
          }),
          signal:AbortSignal.timeout(25000),
        }
      );
      const durationMs=Date.now()-started;
      if(!res.ok){
        const problem=await readGeminiErrorDiagnostic(res);
        return {model,status:'failed',httpStatus:res.status,durationMs,cause:problem.cause,
          note:formatGeminiCause(problem)+
          ' O erro ocorreu em uma chamada mínima, SEM o roteiro ou JSON do nosso motor.'};
      }
      // Read only usage metadata; never return the raw model's text.
      const raw:unknown=await res.json();
      const usage=raw&&typeof raw==='object'&&'usageMetadata' in raw
        ?(raw as {usageMetadata?:{totalTokenCount?:unknown}}).usageMetadata?.totalTokenCount
        :undefined;
      return {model,status:'success',httpStatus:200,durationMs,
        ...(typeof usage==='number'&&Number.isFinite(usage)?{tokenUsage:usage}:{}),
        note:'A geração mínima funcionou. O próximo problema, caso a cena 3D falhe, está ligado ao tamanho da chamada, à configuração estruturada ou à capacidade do modelo sob carga.'};
    }catch(e){
      const timedOut=e instanceof Error&&
        (e.name==='TimeoutError'||e.name==='AbortError');
      return {model,status:timedOut?'timeout':'network_error',durationMs:Date.now()-started,
        note:timedOut
          ?'A API não respondeu à chamada mínima em 25 segundos.'
          :'O servidor não conseguiu completar a comunicação com a API.'};
    }
  });
