import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCode3DWithGemini } from './code3dGemini';
import { checkGeneratedCode } from '../code3d/validation';
import { CODE3D_MAX_CODE_CHARS, CODE3D_REQUEST_TIMEOUT_MS, validDuration } from '../code3d/contract';
import { readSandboxMessage } from '../code3d/sandbox';

const body = 'function createScene(){const shots=DIRECTOR_SCORE.shots;return {duration:DIRECTOR_SCORE.duration,renderAt(t){},dispose(){}}}';
const direction = {version:1,duration:8,timing:'planned',objects:[{id:'crane',description:'guindaste amarelo',parts:['mast','hook']}],shots:[{id:'lift',start:0,end:8,quote:'guindaste',subjects:['crane'],focus:'crane',camera:'detail',action:'o gancho levanta a carga',before:'carga apoiada no piso',after:'carga levantada pelo cabo'}]};
const code = '/*CRIESEUVIDEO_DIRECTION_V1\n'+JSON.stringify(direction)+'\n*/\n'+body;
const reply = (parts: unknown, finishReason = 'STOP') => Response.json({ candidates: [{ finishReason, content: { parts } }] });
beforeEach(() => { vi.stubEnv('GEMINI_API_KEY', 'test-key-never-real'); vi.stubEnv('GEMINI_CODE3D_MODEL', 'test-model'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Code 3D provider boundary (no paid calls)', () => {
  it('does not contact a provider without a configured key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16')).toMatchObject({ ok: false, failure: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('makes one request, ignores thought text and validates the complete segmented code', async () => {
    const fetch = vi.fn(async () => reply([{ text: 'private thought', thought: true }, { text: code.slice(0, 31) }, { text: code.slice(31) }]));
    vi.stubGlobal('fetch', fetch);
    const result = await generateCode3DWithGemini('Uma cena de guindaste', '9:16');
    expect(result).toMatchObject({ ok: true, direction, model: 'test-model' });
    if (result.ok) expect(result.code).toContain('const DIRECTOR_SCORE = ');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('honors the explicitly selected Gemini model without a fallback', async () => {
    const fetch = vi.fn(async (_url: unknown) => reply([{ text: code }])); vi.stubGlobal('fetch', fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16', 'gemini-3.6-flash')).toMatchObject({ ok: true, model: 'gemini-3.6-flash' });
    expect(String(fetch.mock.calls[0][0])).toContain('/gemini-3.6-flash:generateContent');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects arbitrary browser-supplied model names before any request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16', 'unexpected-model' as never)).toMatchObject({ ok: false, failure: 'invalid_request' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['gemini-3.8-flash', 'gemini-2.5-flash'])('uses only thinking settings supported by %s', async model => {
    vi.stubEnv('GEMINI_CODE3D_MODEL', model);
    let body: any;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
      body = JSON.parse(String(init.body)); return reply([{ text: code }]);
    }));
    expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16')).toMatchObject({ ok: true });
    expect(body.generationConfig.maxOutputTokens).toBe(32768);
    expect(body.generationConfig.thinkingConfig).toEqual(model.startsWith('gemini-3') ? { thinkingLevel: 'low' } : undefined);
  });

  it.each(['headers', 'body'])('aborts a long generation during %s with exactly one request and no retry', async phase => {
    vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = vi.fn((_url: unknown, init: RequestInit) => {
      const pending = () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
      return phase === 'body' ? Promise.resolve({ ok: true, json: pending }) : pending();
    });
    vi.stubGlobal('fetch', fetch);
    const result = generateCode3DWithGemini('Uma cena de guindaste', '9:16');
    await vi.advanceTimersByTimeAsync(CODE3D_REQUEST_TIMEOUT_MS);
    expect(await result).toMatchObject({ ok: false, failure: 'timeout' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([[400, 'invalid_request'], [401, 'unauthorized'], [403, 'forbidden'], [404, 'model_unavailable'], [429, 'quota'], [503, 'service_unavailable']])(
    'returns HTTP %s without retrying or exposing the response body', async (status, failure) => {
      const fetch = vi.fn(async () => new Response('sensitive provider response', { status: status as number }));
      vi.stubGlobal('fetch', fetch); vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await generateCode3DWithGemini('Uma cena de guindaste', '9:16');
      expect(result).toMatchObject({ ok: false, failure });
      expect(JSON.stringify(result)).not.toMatch(/sensitive provider response|test-key-never-real/);
      expect(fetch).toHaveBeenCalledOnce();
    });

  it('rejects truncation before trying to execute or repair incomplete code', async () => {
    const fetch = vi.fn(async () => reply([{ text: code }], 'MAX_TOKENS'));
    vi.stubGlobal('fetch', fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16')).toMatchObject({ ok: false, failure: 'truncated_response' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects code that omits the direction instead of silently approving an unplanned animation', async () => {
    const fetch = vi.fn(async () => reply([{text:body}])); vi.stubGlobal('fetch',fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste','9:16')).toMatchObject({ok:false,failure:'direction_error'});
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects invalid narration before spending quota', async () => {
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    expect(await generateCode3DWithGemini('Uma cena de guindaste','9:16','configured',{duration:8,words:[{text:'guindaste',start:5,end:3}]})).toMatchObject({ok:false,failure:'invalid_request'});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses supplied word times in the actual provider request and normalized returned score', async () => {
    const narration={duration:8,words:[{text:'O',start:0,end:.2},{text:'guindaste',start:.3,end:.8},{text:'levanta.',start:1,end:2},{text:'Apoia',start:4.4,end:4.9},{text:'a',start:5,end:5.1},{text:'carga.',start:5.2,end:6}]};
    const plan={...direction,timing:'provided',shots:[
      {...direction.shots[0],quote:'O guindaste',firstWord:0,start:undefined,end:undefined},
      {...direction.shots[0],id:'rest',quote:'Apoia a carga.',firstWord:3,start:undefined,end:undefined},
    ]};
    let requestBody:any;
    const fetch=vi.fn(async (_url:unknown,init:RequestInit)=>{requestBody=JSON.parse(String(init.body));return reply([{text:'/*CRIESEUVIDEO_DIRECTION_V1\n'+JSON.stringify(plan)+'\n*/\n'+body}]);});vi.stubGlobal('fetch',fetch);
    const result=await generateCode3DWithGemini('Um guindaste levanta e apoia uma carga.','9:16','configured',narration);
    expect(result).toMatchObject({ok:true,direction:{timing:'provided',shots:[{start:0,end:4.4},{start:4.4,end:8}]}});
    expect(requestBody.contents[0].parts[0].text).toContain('4.4');
    expect(requestBody.contents[0].parts[0].text).toContain('spoken-actions-v1');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([() => new Response('not JSON'), () => reply('not an array')])(
    'distinguishes an unreadable provider response from a network failure', async response => {
      const fetch = vi.fn(async () => response()); vi.stubGlobal('fetch', fetch);
      expect(await generateCode3DWithGemini('Uma cena de guindaste', '9:16')).toMatchObject({ ok: false, failure: 'invalid_response' });
      expect(fetch).toHaveBeenCalledOnce();
    });

  it('rejects a non-function entrypoint and oversized programs', () => {
    expect(checkGeneratedCode('const createScene = 42;')).toMatchObject({ ok: false, failure: 'contract_error' });
    expect(checkGeneratedCode(code + ' '.repeat(CODE3D_MAX_CODE_CHARS))).toMatchObject({ ok: false, failure: 'too_large' });
  });

  it('uses the same strict duration contract on both sides of the message bridge', () => {
    const frame = {}, token = 'a'.repeat(32);
    for (const duration of [null, true, '8', 2, 25, Infinity, undefined]) {
      expect(validDuration(duration)).toBe(duration === undefined ? 10 : null);
      expect(readSandboxMessage({ source: frame, origin: 'null', data: { type: 'ready', token, duration, deterministic: true, maxDiff: 0 } }, frame, token)).toBeNull();
    }
  });
});
