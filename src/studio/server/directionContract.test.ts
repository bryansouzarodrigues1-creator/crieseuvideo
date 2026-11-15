import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer } from './director';
import { askAiResult } from './ai';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const env = { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: 'fixture-only-key' };
const reply = (raw: unknown) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(raw) }] } }] });

describe('director through the real provider adapter with intercepted transport', () => {
  it('accepts explicit absence using the compatible Gemini JSON-MIME request', async () => {
    const script = 'Eu sou o maior jogador do mundo hahahaha';
    const fetchMock = vi.fn(async () => reply({ scenes: [{ sourceId: 's1', visual: 'character', staging: null, story: null }], production: null }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await directExplainer({ script, engine: '3d', targetDuration: 15 }, env);
    expect(result.plan.scenes[0].text).toBe(script);
    expect(result.plan.production?.tracks.some((track) => track.channel === 'laugh')).toBe(true);
    expect(result.plan.targetDuration).toBe(15);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-3.6-flash:generateContent');
    const config = JSON.parse(String(options.body)).generationConfig;
    expect(config).toEqual({ responseMimeType: 'application/json', maxOutputTokens: 8192 });
    expect(JSON.parse(String(options.body)).contents[0].parts[0].text).toContain('"sourceId":"s1","staging":null');
  });
  it('gives different source sentences their own allowed movement and preserves the original order', async () => {
    const script = 'Ana correu pela rua. Bruno nunca correu.';
    const fetchMock = vi.fn(async () => reply({ scenes: [
      { sourceId: 's1', visual: 'custom', staging: { action: 'run', camera: 'follow' } },
      { sourceId: 's2', visual: 'character', staging: { action: 'wait', camera: 'detail' } },
    ] }));
    vi.stubGlobal('fetch', fetchMock);
    const { plan } = await directExplainer({ script, engine: '3d' }, env);
    expect(plan.scenes.map((scene) => scene.staging?.action)).toEqual(['run', 'wait']);
    expect(plan.scenes.map((scene) => scene.text)).toEqual(['Ana correu pela rua.', 'Bruno nunca correu.']);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const prompt = JSON.parse(String(options.body)).contents[0].parts[0].text;
    expect(prompt).toContain('[{"sourceId":"s1","staging":"run"},{"sourceId":"s2","staging":"wait"}]');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry or silently replace a provider output that still contradicts the source', async () => {
    const fetchMock = vi.fn(async () => reply({ scenes: [{ sourceId: 's1', visual: 'character', staging: { action: 'run' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(directExplainer({ script: 'Ana nunca correu.' }, env)).rejects.toMatchObject({
      code: 'unsupported_action', details: { sourceId: 's1', field: 'staging', receivedAction: 'run', expectedAction: 'wait' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps the Lovable transport contract', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"scenes":[]}' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await askAiResult('Fixture request', undefined, { AI_TEXT_PROVIDER: 'lovable', LOVABLE_API_KEY: 'fixture-only' });
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('ai.gateway.lovable.dev');
    expect(JSON.parse(String(options.body)).response_format).toEqual({ type: 'json_object' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
