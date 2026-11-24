/**
 * Minimal, allowlisted Google RPC error diagnostics.
 * Never return arbitrary provider error messages, request bodies or tokens
 * to the browser. Google ErrorInfo.reason is only exposed when recognized.
 */
export type GeminiErrorCause =
  | 'model_capacity_exhausted'
  | 'model_overloaded'
  | 'service_unavailable'
  | 'project_quota'
  | 'request_invalid'
  | 'unknown';

export type GeminiErrorDiagnostic = {
  httpStatus:number;
  rpcStatus?: 'UNAVAILABLE'|'INTERNAL'|'RESOURCE_EXHAUSTED'|'INVALID_ARGUMENT'|'PERMISSION_DENIED'|'UNAUTHENTICATED'|'NOT_FOUND';
  cause:GeminiErrorCause;
};

const allowedRpc=new Set([
  'UNAVAILABLE','INTERNAL','RESOURCE_EXHAUSTED','INVALID_ARGUMENT',
  'PERMISSION_DENIED','UNAUTHENTICATED','NOT_FOUND',
]);

export function diagnoseGeminiError(httpStatus:number,raw:unknown):GeminiErrorDiagnostic {
  const result:GeminiErrorDiagnostic={httpStatus,cause:'unknown'};
  if(!raw || typeof raw!=='object') return result;
  const obj=raw as {error?:unknown};
  if(!obj.error || typeof obj.error!=='object')return result;
  const error=obj.error as {status?:unknown;details?:unknown};
  if(typeof error.status==='string'&&allowedRpc.has(error.status))
    result.rpcStatus=error.status as GeminiErrorDiagnostic['rpcStatus'];
  if(Array.isArray(error.details)){
    for(const part of error.details){
      if(!part || typeof part!=='object')continue;
      const {reason}=part as {reason?:unknown};
      if(reason==='MODEL_CAPACITY_EXHAUSTED'){result.cause='model_capacity_exhausted';break;}
      if(reason==='MODEL_OVERLOADED'){result.cause='model_overloaded';break;}
      if(reason==='RESOURCE_EXHAUSTED'){result.cause='project_quota';break;}
    }
  }
  if(result.cause==='unknown'){
    if(httpStatus===503 && result.rpcStatus==='UNAVAILABLE')result.cause='service_unavailable';
    else if(httpStatus===429)result.cause='project_quota';
    else if(httpStatus===400)result.cause='request_invalid';
  }
  return result;
}

/** A limited read of the Google error body: never return original text. */
export async function readGeminiErrorDiagnostic(response:Response):Promise<GeminiErrorDiagnostic>{
  try{
    const str=(await response.text()).slice(0,8192);
    return diagnoseGeminiError(response.status,JSON.parse(str) as unknown);
  }catch{
    return {httpStatus:response.status,cause:'unknown'};
  }
}
export function formatGeminiCause(error:GeminiErrorDiagnostic):string {
  switch(error.cause){
    case 'model_capacity_exhausted': return 'Google confirmou esgotamento de capacidade do modelo (MODEL_CAPACITY_EXHAUSTED).';
    case 'model_overloaded': return 'Google informou sobrecarga do modelo (MODEL_OVERLOADED).';
    case 'project_quota': return 'O Google indicou limite de recursos/cota; conferir uso e plano do projeto.';
    case 'request_invalid': return 'A chamada foi recusada como inválida; conferir os parâmetros da API.';
    case 'service_unavailable': return 'Google retornou UNAVAILABLE; o motivo específico não foi fornecido.';
    default: return 'O provedor não forneceu uma causa segura e específica.';
  }
}
