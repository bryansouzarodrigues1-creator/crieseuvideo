import { afterEach, describe, expect, it, vi } from 'vitest';
import { askAi } from './ai';

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
    expect(String(fetchMock.mock.calls[0][0])).toContain('ai.gateway.lovable.dev');
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
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-3.6-flash:generateContent');
  });
});
