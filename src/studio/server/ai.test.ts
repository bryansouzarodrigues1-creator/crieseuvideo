import { afterEach, describe, expect, it, vi } from 'vitest';
import { askAi, askAiResult, preflightGemini } from './ai';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const goodGemini = () => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: '{"scenes":[]}' }] } }] }),
});

describe('AI text provider selection', () => {
  it('preflights the shared request through countTokens without requesting generation', async () => {
    const fetchMock = vi.fn(async () => Response.json({ totalTokens: 20 })); vi.stubGlobal('fetch', fetchMock);
    expect(await preflightGemini({ GEMINI_API_KEY: 'fixture-only-key' })).toEqual({ ok: true, model: 'gemini-3.6-flash', totalTokens: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/gemini-3\.6-flash:countTokens$/);
    expect(url).not.toContain('generateContent');
    const body = JSON.parse(String(options.body));
    expect(body.generateContentRequest.model).toBe('models/gemini-3.6-flash');
    expect(body.generateContentRequest.generationConfig).toEqual({ responseMimeType: 'application/json', maxOutputTokens: 8192 });
    expect(body.generateContentRequest.contents[0].parts[0].text).toContain('Verificar a conexão');
  });
  it('does not mark a malformed preflight response as a verified connection or retry it', async () => {
    const fetchMock = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', fetchMock);
    expect(await preflightGemini({ GEMINI_API_KEY: 'fixture-only' })).toMatchObject({ ok: false, code: 'invalid_response' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('routes to Gemini directly with server-only key and structured JSON', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-secret');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    const fetchMock = vi.fn(async () => goodGemini());
    vi.stubGlobal('fetch', fetchMock);

    expect(await askAi('Crie uma cena.')).toBe('{"scenes":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    expect((options.headers as Record<string, string>)['x-goog-api-key']).toBe('test-only-secret');
    const body = JSON.parse(String(options.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.contents[0].parts[0].text).toContain('Crie uma cena');
  });

  it('uses lower thinking and a bounded output allowance only when the owner trial opts in', async () => {
    const fetchMock = vi.fn(async () => goodGemini());
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAiResult('Direção 3D experimental', undefined, {
      AI_TEXT_PROVIDER:'gemini', GEMINI_API_KEY:'private-test',
      GEMINI_THINKING_LEVEL:'low', GEMINI_MAX_OUTPUT_TOKENS:'16384',
    })).toMatchObject({ok:true});
    const body=JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string,RequestInit])[1].body));
    expect(body.generationConfig).toMatchObject({
      responseMimeType:'application/json',maxOutputTokens:16384,
      thinkingConfig:{thinkingLevel:'low'},
    });
    fetchMock.mockClear();
    await askAiResult('Legacy request', undefined, {
      AI_TEXT_PROVIDER:'gemini', GEMINI_API_KEY:'private-test',
      GEMINI_MAX_OUTPUT_TOKENS:'9999999', GEMINI_THINKING_LEVEL:'invalid-level',
    });
    const capped=JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string,RequestInit])[1].body));
    expect(capped.generationConfig.maxOutputTokens).toBe(16384);
    expect(capped.generationConfig).not.toHaveProperty('thinkingConfig');
  });

  it('keeps 60s by default and caps a requested owner-only Gemini timeout at 120s', async () => {
    const fetchMock = vi.fn(async () => goodGemini());
    vi.stubGlobal('fetch', fetchMock);
    const timers = vi.spyOn(globalThis, 'setTimeout');
    await askAiResult('Test owner 3D', undefined, {
      AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'private-fixture-key',
      GEMINI_REQUEST_TIMEOUT_MS: '120000',
    });
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 120000);
    timers.mockClear();
    await askAiResult('Test malformed server timeout', undefined, {
      AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'private-fixture-key',
      GEMINI_REQUEST_TIMEOUT_MS: 'NaN',
    });
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 60000);
    timers.mockClear();
    await askAiResult('Test cap', undefined, {
      AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'private-fixture-key',
      GEMINI_REQUEST_TIMEOUT_MS: '900000',
    });
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 120000);
    timers.mockClear();
    await askAiResult('Test default legacy provider', undefined, {
      AI_TEXT_PROVIDER: 'lovable', LOVABLE_API_KEY: 'private-fixture-key',
      GEMINI_REQUEST_TIMEOUT_MS: '120000',
    });
    expect(timers).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never falls back to Lovable when direct Gemini is missing a key', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await askAi('Teste')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not switch to a paid provider on Google quota exhaustion', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-secret');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAi('Teste')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing Lovable flow as default', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'lovable');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"title":"ok"}' } }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAi('Teste')).toBe('{"title":"ok"}');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('ai.gateway.lovable.dev');
  });

  it('uses Gemini after Lovable 402 only with explicit fallback consent', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'lovable');
    vi.stubEnv('AI_TEXT_FALLBACK', 'gemini');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-secret');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 402 })
      .mockResolvedValueOnce(goodGemini());
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAi('Teste')).toBe('{"scenes":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not auto-fallback after Lovable 402 without opt-in', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'lovable');
    vi.stubEnv('AI_TEXT_FALLBACK', '');
    vi.stubEnv('LOVABLE_API_KEY', 'test-only-lovable');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-secret');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => ({ ok: false, status: 402 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAi('Teste')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unapproved model names instead of switching to arbitrary models', async () => {
    vi.stubEnv('AI_TEXT_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-secret');
    vi.stubEnv('GEMINI_TEXT_MODEL', 'gemini-3-pro-preview');
    const fetchMock = vi.fn(async () => goodGemini());
    vi.stubGlobal('fetch', fetchMock);
    expect(await askAi('Teste')).toBe('{"scenes":[]}');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('gemini-3.6-flash:generateContent');
  });
  it('distinguishes provider request, model and key failures without exposing response bodies', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const [status, body, code] of [
      [400, { error: { message: 'private-provider-detail' } }, 'invalid_request'],
      [404, {}, 'unsupported_model'],
      [400, { error: { message: 'private-provider-detail', details: [{ reason: 'API_KEY_INVALID' }] } }, 'auth'],
      [429, {}, 'quota'],
    ] as const) {
      fetchMock.mockResolvedValueOnce(Response.json(body, { status }));
      expect(await askAiResult('private-script', undefined, { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'private-key' })).toMatchObject({ ok: false, code, status });
    }
    const logs = JSON.stringify(warn.mock.calls);
    for (const secret of ['private-key', 'private-script', 'private-provider-detail']) expect(logs).not.toContain(secret);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('rejects blocked and truncated content before parsing a scene plan', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const [response, code] of [
      [{ promptFeedback: { blockReason: 'SAFETY' } }, 'blocked'],
      [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"partial":' }] } }] }, 'truncated'],
    ] as const) {
      fetchMock.mockResolvedValueOnce(Response.json(response));
      expect(await askAiResult('test', undefined, { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' })).toMatchObject({ ok: false, code });
    }
  });
});
