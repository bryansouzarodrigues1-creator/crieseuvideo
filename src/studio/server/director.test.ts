import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer, DirectorError } from './director';
import { askAiResult } from './ai';
import { spokenText } from '../explainer/script';
import { buildFallbackPlan } from '../explainer/plan';

vi.mock('./ai', async (original) => ({ ...(await original<typeof import('./ai')>()), askAiResult: vi.fn() }));
afterEach(() => vi.mocked(askAiResult).mockReset());
const good = (text: string) => ({ ok: true as const, text: JSON.stringify({ title: 'Ensaio', scenes: [{ text, visual: 'phone_chat' }] }), provider: 'gemini' as const, model: 'gemini-3.6-flash' });
const fromSource = (prompt: string) => ({ ...good(''), text: JSON.stringify({ title: 'Original', scenes: prompt.split('\n').flatMap((line) => {
  const match = line.match(/^(s\d+): (".*")$/);
  return match ? [{ sourceId: match[1], visual: 'phone_chat' }] : [];
}) }) });

describe('bounded scene direction', () => {
  it.each(['staging', 'story', 'production'])('treats optional %s=null as absence and keeps the executable acting', async (field) => {
    const script = 'Eu sou o maior jogador do mundo hahahaha';
    const raw = { scenes: [{ sourceId: 's1', visual: 'character', ...(field !== 'production' ? { [field]: null } : {}) }], ...(field === 'production' ? { production: null } : {}) };
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify(raw) });
    const { plan } = await directExplainer({ script, engine: '3d', targetDuration: 15 });
    expect(plan.scenes[0].text).toBe(script);
    expect(plan.production?.assets.map((asset) => asset.kind)).toEqual(['person']);
    expect(plan.production?.tracks.some((track) => track.channel === 'laugh')).toBe(true);
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('does not let production=null erase a valid handoff or bypass an invalid action', async () => {
    const script = 'Lia pega a lanterna e entrega para Caio.';
    const raw = { production: null, scenes: [{ sourceId: 's1', visual: 'custom', story: { action: 'handoff', prop: 'lantern', performance: null, actors: [{ name: 'Lia' }, { name: 'Caio' }] } }] };
    vi.mocked(askAiResult).mockResolvedValueOnce({ ...good(''), text: JSON.stringify(raw) });
    const { plan } = await directExplainer({ script });
    expect(plan.scenes[0].story?.actors.map((actor) => actor.name)).toEqual(['Lia', 'Caio']);
    expect(plan.scenes[0].story?.action).toBe('handoff');
    raw.scenes[0].story.action = 'fly';
    vi.mocked(askAiResult).mockResolvedValueOnce({ ...good(''), text: JSON.stringify(raw) });
    await expect(directExplainer({ script })).rejects.toMatchObject({ code: 'unsupported_action', details: { sourceId: 's1', field: 'story', receivedAction: 'unrecognized' } });
    expect(askAiResult).toHaveBeenCalledTimes(2);
  });
  it('identifies the source conflict and never echoes arbitrary provider action strings', async () => {
    const script = 'Ele nunca correu.';
    for (const [action, receivedAction] of [['run', 'run'], ['private-model-and-source-string', 'unrecognized']] as const) {
      vi.mocked(askAiResult).mockResolvedValueOnce({ ...good(''), text: JSON.stringify({ scenes: [{ sourceId: 's1', staging: { action } }] }) });
      const error = await directExplainer({ script }).catch((error) => error);
      expect(error).toMatchObject({ code: 'unsupported_action', details: { sourceId: 's1', field: 'staging', receivedAction, expectedAction: 'wait' } });
      expect(error.message).toContain('Cena 1');
      expect(error.message).toContain('Esperar sem se deslocar');
      expect(JSON.stringify(error)).not.toContain('private-model-and-source-string');
    }
  });
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
  it('normal AI direction of a non-demo script gets an executable scene and requested duration', async () => {
    const text = 'Esse foi o maior esquema de corrupção.';
    vi.mocked(askAiResult).mockResolvedValue(good(text));
    const { plan } = await directExplainer({ script: text, targetDuration: 30, engine: '3d' });
    expect(plan.scenes[0].staging?.action).toBe('money_flow');
    expect(plan.scenes[0].duration).toBeCloseTo(30);
    expect(plan.scenes[0].text).toBe(text);
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported staged actions and invalid duration before requesting AI', async () => {
    await expect(directExplainer({ script: 'Ele correu.', targetDuration: 10000 })).rejects.toMatchObject({ code: 'invalid_duration' });
    expect(askAiResult).not.toHaveBeenCalled();
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify({ scenes: [{ sourceId: 's1', staging: { action: 'fly' } }] }) });
    await expect(directExplainer({ script: 'Ele correu.' })).rejects.toMatchObject({ code: 'unsupported_action' });
  });
  it('accepts a model-composed parallel mechanism rather than forcing a local keyword recipe', async () => {
    const text = 'No canteiro, a grua movimenta o carrinho e eleva o palete.';
    const program = buildFallbackPlan(text).production!;
    program.tracks.push({ asset: 'crane', channel: 'trolley', sourceId: 's1', begin: .12, end: .88, to: 6, evidence: 'movimenta o carrinho' });
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify({ title: 'Grua', scenes: [{ sourceId: 's1', visual: 'custom' }], production: program }) });
    const result = await directExplainer({ script: text, engine: '3d', targetDuration: 15 });
    expect(result.plan.production?.tracks.some((t) => t.channel === 'trolley')).toBe(true);
    expect(result.plan.scenes[0].text).toBe(text);
    expect(result.plan.scenes[0].duration).toBe(15);
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('rejects a model production with an unreachable contact before applying its plan', async () => {
    const text = 'O guindaste ergue uma carga.', program = buildFallbackPlan(text).production!;
    program.assets.find((a) => a.id === 'cargo')!.position[0] += 2;
    vi.mocked(askAiResult).mockResolvedValue({ ...good(''), text: JSON.stringify({ scenes: [{ sourceId: 's1' }], production: program }) });
    await expect(directExplainer({ script: text, engine: '3d' })).rejects.toMatchObject({ code: 'contact_mismatch', status: 502 });
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
});
