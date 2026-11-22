import { afterEach, describe, expect, it, vi } from 'vitest';
import { askGeminiForExplainer, GEMINI_THINKING_LEVEL } from './ai';
import { generateCode3DWithGemini } from './code3dGemini';

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_AI_MODEL;
const codeModel = process.env.GEMINI_CODE3D_MODEL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (key === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = key;
  if (model === undefined) delete process.env.GEMINI_AI_MODEL;
  else process.env.GEMINI_AI_MODEL = model;
  if (codeModel === undefined) delete process.env.GEMINI_CODE3D_MODEL;
  else process.env.GEMINI_CODE3D_MODEL = codeModel;
});

describe('explicit Gemini High for all direct animation requests', () => {
  it('uses the direct Gemini endpoint exactly once for Motion 2D, without Lovable fallback', async () => {
    process.env.GEMINI_API_KEY = 'test-secret';
    const calls: Array<{url:string;body:any}> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({
        candidates: [{content: {parts: [{text: '{"title":"Teste","script":"Um teste completo.","scenes":[{"text":"Um teste completo."}]}'}]}, finishReason:'STOP'}]
      }), {status:200});
    }));
    const out = await askGeminiForExplainer('Crie roteiro e cenas');
    expect(out.thinkingLevel).toBe('HIGH');
    expect(out.model).toBeTruthy();
    expect(JSON.parse(String(out.text)).scenes).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('generativelanguage.googleapis.com');
    expect(calls[0].body.generationConfig.thinkingConfig.thinkingLevel).toBe('HIGH');
    expect(calls[0].body.generationConfig.responseMimeType).toBe('application/json');
    expect(GEMINI_THINKING_LEVEL).toBe('HIGH');
  });

  it('does not downgrade or contact Lovable after a quota response', async () => {
    process.env.GEMINI_API_KEY = 'test-secret';
    const fn = vi.fn(async () => new Response('', {status:429}));
    vi.stubGlobal('fetch', fn);
    const out = await askGeminiForExplainer('Crie 2D High');
    expect(out.text).toBeNull();
    expect(out.problem).toBe('quota');
    expect(out.thinkingLevel).toBe('HIGH');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails clearly without contacting any provider when Gemini key is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    const fn=vi.fn();
    vi.stubGlobal('fetch',fn);
    const out=await askGeminiForExplainer('tema');
    expect(out.problem).toBe('not_configured');
    expect(out.text).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses Gemini High in Code 3D too', async () => {
    process.env.GEMINI_API_KEY = 'test-secret';
    const calls:any[] = [];
    vi.stubGlobal('fetch',vi.fn(async (_input:RequestInfo|URL, init?:RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response('',{status:429});
    }));
    const result = await generateCode3DWithGemini('Uma caixa gira', '9:16');
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].generationConfig.thinkingConfig.thinkingLevel).toBe('HIGH');
    expect(calls[0].generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(32768);
  });
});
