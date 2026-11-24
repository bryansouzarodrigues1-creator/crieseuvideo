import {describe,it,expect,vi,afterEach} from 'vitest';
import {diagnoseGeminiError,readGeminiErrorDiagnostic,formatGeminiCause} from './geminiFailure';
import {ask3DWorldAi,Ai3DProviderError} from './ai';

const originalKey=process.env.GEMINI_API_KEY;
afterEach(()=>{
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY=originalKey;
  vi.unstubAllGlobals();
});

describe('safe, precise Gemini backend failure classification',()=>{
 it('recognizes Google RPC model-capacity exhaustion from an actual error structure',()=>{
  const info=diagnoseGeminiError(503,{error:{
    code:503,message:'This model is currently experiencing high demand',
    status:'UNAVAILABLE',details:[{
      '@type':'type.googleapis.com/google.rpc.ErrorInfo',
      reason:'MODEL_CAPACITY_EXHAUSTED',metadata:{model:'unknown'}
    }]
  }});
  expect(info).toEqual({
    httpStatus:503,rpcStatus:'UNAVAILABLE',cause:'model_capacity_exhausted'
  });
  expect(formatGeminiCause(info)).toContain('Google confirmou');
  expect(JSON.stringify(info)).not.toContain('currently experiencing');
 });
 it('keeps arbitrary Google error text out of the UI, even on internal errors',()=>{
  const info=diagnoseGeminiError(500,{error:{
    message:'secret key / users personal prompt / context',
    status:'INTERNAL',details:[{reason:'UNTRUSTED_REASON', privateData:'secret'}]
  }});
  expect(info).toEqual({httpStatus:500,rpcStatus:'INTERNAL',cause:'unknown'});
  expect(JSON.stringify(info)).not.toMatch(/secret|prompt|UNTRUSTED/);
 });
 it('distinguishes 429 quota from 503 service unavailable',()=>{
  expect(diagnoseGeminiError(429,{error:{status:'RESOURCE_EXHAUSTED'}}).cause).toBe('project_quota');
  expect(diagnoseGeminiError(503,{error:{status:'UNAVAILABLE'}}).cause).toBe('service_unavailable');
  expect(diagnoseGeminiError(503,null).cause).toBe('unknown');
 });
 it('includes only an allowlisted diagnostic in provider error messages',async()=>{
  process.env.GEMINI_API_KEY='dummy-secret';
  const fetched=vi.fn(async()=>Response.json({error:{
    message:'PRIVATE SCRIPT: character description',
    status:'UNAVAILABLE',
    details:[{reason:'MODEL_CAPACITY_EXHAUSTED'}]
  }},{status:503}));
  vi.stubGlobal('fetch',fetched);
  const failed=await ask3DWorldAi('some private prompt','gemini').catch(e=>e);
  expect(failed).toBeInstanceOf(Ai3DProviderError);
  expect(failed.failures[0]).toEqual({
    provider:'gemini',reason:'service_unavailable',
    diagnostic:{httpStatus:503,rpcStatus:'UNAVAILABLE',cause:'model_capacity_exhausted'}
  });
  expect(failed.message).toContain('MODEL_CAPACITY_EXHAUSTED');
  expect(failed.message).not.toContain('PRIVATE SCRIPT');
  expect(failed.message).not.toContain('dummy-secret');
  expect(fetched).toHaveBeenCalledTimes(1);
 });
 it('fails closed if the provider returns HTML or non-JSON',async()=>{
  const response=new Response('<html>private failure</html>',{status:503});
  expect(await readGeminiErrorDiagnostic(response)).toEqual({httpStatus:503,cause:'unknown'});
 });
});
