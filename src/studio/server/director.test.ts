import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer, DirectorError } from './director';
import { askAiResult } from './ai';
import { spokenText } from '../explainer/script';

vi.mock('./ai', async (original) => ({ ...(await original<typeof import('./ai')>()), askAiResult: vi.fn() }));
afterEach(() => vi.mocked(askAiResult).mockReset());
const good = (text: string) => ({ ok: true as const, text: JSON.stringify({ title: 'Ensaio', scenes: [{ text, visual: 'phone_chat' }] }), provider: 'gemini' as const, model: 'gemini-3.6-flash' });

describe('bounded scene direction', () => {
  it('rejects long scripts before requesting AI instead of cutting them', async () => {
    await expect(directExplainer({ script: 'a'.repeat(6001) })).rejects.toMatchObject({ status: 400 });
    expect(askAiResult).not.toHaveBeenCalled();
  });
  it('surfaces quota failure and never substitutes a local animation', async () => {
    vi.mocked(askAiResult).mockResolvedValue({ ok: false, provider: 'gemini', model: 'test', code: 'quota', status: 429 });
    await expect(directExplainer({ script: 'O celular tocou.' })).rejects.toMatchObject({ status: 429, code: 'quota' });
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('does not dequeue more chunks after the provider refuses the first two', async () => {
    const script = 'Uma frase sobre o celular com detalhes para uma longa sequência. '.repeat(80);
    vi.mocked(askAiResult).mockResolvedValue({ ok: false, provider: 'gemini', model: 'test', code: 'quota', status: 429 });
    await expect(directExplainer({ script })).rejects.toBeInstanceOf(DirectorError);
    expect(askAiResult).toHaveBeenCalledTimes(2);
  });
  it('preserves all original words and punctuation after hallucinated AI lines', async () => {
    const script = 'O preço foi R$ 3,50. Abri exemplo.com e mandei uma mensagem!';
    vi.mocked(askAiResult).mockResolvedValue(good('Uma fala inventada.'));
    const result = await directExplainer({ script });
    expect(result.provider).toBe('gemini');
    expect(result.source).toBe('ai');
    expect(result.plan.scenes.map((s) => s.text).join(' ')).toBe(script);
  });
  it('preserves order across independently completed chunks', async () => {
    const script = Array.from({ length: 90 }, (_, i) => `A cena ${i} mostra a palavra original${i} no celular.`).join(' ');
    let inFlight = 0, peak = 0;
    vi.mocked(askAiResult).mockImplementation(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await Promise.resolve(); inFlight--;
      return good('A IA resumiu indevidamente.');
    });
    const { plan } = await directExplainer({ script });
    expect(peak).toBe(2);
    expect(spokenText(plan.scenes.map((s) => s.text).join(' '))).toBe(script);
    expect(plan.scenes.length).toBeGreaterThan(40);
    expect(plan.scenes.every((s) => s.text.length <= 400)).toBe(true);
  });
  it('rejects malformed plans instead of displaying presets as AI work', async () => {
    vi.mocked(askAiResult).mockResolvedValue({ ...good('x'), text: '{"scenes":[]}' });
    await expect(directExplainer({ script: 'O celular tocou.' })).rejects.toMatchObject({ code: 'invalid_plan' });
  });
});
