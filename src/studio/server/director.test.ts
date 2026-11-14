import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer, DirectorError } from './director';
import { askAiResult } from './ai';
import { spokenText } from '../explainer/script';

vi.mock('./ai', async (original) => ({ ...(await original<typeof import('./ai')>()), askAiResult: vi.fn() }));
afterEach(() => vi.mocked(askAiResult).mockReset());
const good = (text: string) => ({ ok: true as const, text: JSON.stringify({ title: 'Ensaio', scenes: [{ text, visual: 'phone_chat' }] }), provider: 'gemini' as const, model: 'gemini-3.6-flash' });
const fromSource = (prompt: string) => ({ ...good(''), text: JSON.stringify({ title: 'Original', scenes: prompt.split('\n').flatMap((line) => {
  const match = line.match(/^(s\d+): (".*")$/);
  return match ? [{ sourceId: match[1], visual: 'phone_chat' }] : [];
}) }) });

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
  it('rejects hallucinated lines rather than applying their art to repaired text', async () => {
    const script = 'O preço foi R$ 3,50. Abri exemplo.com e mandei uma mensagem!';
    vi.mocked(askAiResult).mockResolvedValue(good('Uma fala inventada.'));
    await expect(directExplainer({ script })).rejects.toMatchObject({ code: 'source_mismatch' });
  });
  it('preserves order across independently completed chunks', async () => {
    const script = Array.from({ length: 90 }, (_, i) => `A cena ${i} mostra a palavra original${i} no celular.`).join(' ');
    let inFlight = 0, peak = 0;
    vi.mocked(askAiResult).mockImplementation(async (prompt) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await Promise.resolve(); inFlight--;
      return fromSource(prompt);
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
  it('restores source order while keeping each direction attached to its sentence', async () => {
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify({ scenes: [
      { sourceId: 's2', visual: 'clock' }, { sourceId: 's1', visual: 'laptop' },
    ] }) });
    const { plan } = await directExplainer({ script: 'Ana abriu o computador. Bruno olhou o relógio.' });
    expect(plan.scenes.map((s) => s.visual)).toEqual(['laptop', 'clock']);
    expect(plan.scenes.map((s) => s.text)).toEqual(['Ana abriu o computador.', 'Bruno olhou o relógio.']);
  });
  it('rejects a reversed handoff even when all script words are exact', async () => {
    const text = 'Lia pega a lanterna e entrega para Caio.';
    vi.mocked(askAiResult).mockResolvedValue({ ...good(text), text: JSON.stringify({ scenes: [{ text, story: {
      action: 'handoff', prop: 'lantern', actors: [{ name: 'Caio' }, { name: 'Lia' }],
    } }] }) });
    await expect(directExplainer({ script: text })).rejects.toMatchObject({ code: 'unsupported_action' });
  });
  it('passes a supported 3D performance from a new script without an AI/TTS request', async () => {
    const text = 'Nina caminha, agacha-se, pega a lanterna e entrega para Rui, que sorri.';
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify({ scenes: [{ sourceId: 's1', story: {
      action: 'handoff', prop: 'lantern', performance: 'grounded-v1', actors: [{ name: 'Nina' }, { name: 'Rui' }],
    } }] }) });
    const { plan } = await directExplainer({ script: text });
    expect(plan.scenes[0].story?.performance).toBe('grounded-v1');
    expect(plan.scenes[0].text).toBe(text);
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
});
