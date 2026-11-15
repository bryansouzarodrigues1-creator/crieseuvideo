import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer } from './director';
import { askAiResult } from './ai';
import { sceneProgramFixtures } from '../explainer/sceneProgram/fixtures';
import { totalDuration } from '../explainer/plan';

vi.mock('./ai', async (original) => ({ ...(await original<typeof import('./ai')>()), askAiResult: vi.fn() }));
afterEach(() => vi.mocked(askAiResult).mockReset());
const result = (raw: unknown) => ({ ok: true as const, provider: 'gemini' as const, model: 'fixture', text: JSON.stringify(raw) });

describe('scene-program direction uses creation instead of catalogue classification', () => {
  it.each([0, 1, 2])('accepts fixture %i from one provider response through the ordinary director', async (index) => {
    const sample = sceneProgramFixtures()[index]!;
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    const { plan } = await directExplainer({ script: sample.script, engine: '3d', mode: 'program', requireActing: true, targetDuration: 30 });
    expect(plan.sceneProgram?.nodes.length).toBe(sample.response.sceneProgram.nodes.length);
    expect(plan.scenes.map((s) => s.text).join(' ')).toBe(sample.script);
    expect(plan.production).toBeUndefined(); expect(totalDuration(plan)).toBe(30);
    expect(askAiResult).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(askAiResult).mock.calls[0][0];
    expect(prompt).toContain('Não escolha apenas um ID de ação pronto');
    expect(prompt).not.toContain('Contrato de staging por frase');
  });
  it('rejects raw JS and malformed programs without retrying or substituting a local movie', async () => {
    const sample = sceneProgramFixtures()[1]!;
    vi.mocked(askAiResult).mockResolvedValueOnce(result({ ...sample.response, sceneProgram: { ...sample.response.sceneProgram, code: 'fetch("private")' } }));
    await expect(directExplainer({ script: sample.script, mode: 'program', engine: '3d' })).rejects.toMatchObject({ code: 'invalid_scene_program' });
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('rejects changed source text even for structurally valid new geometry', async () => {
    const sample = sceneProgramFixtures()[1]!;
    vi.mocked(askAiResult).mockResolvedValueOnce(result({ ...sample.response, scenes: [{ sourceId: 's1', text: 'O cometa explode e destrói uma cidade.' }] }));
    await expect(directExplainer({ script: sample.script, mode: 'program', engine: '3d' })).rejects.toMatchObject({ code: 'source_mismatch' });
  });
  it('preserves a provider error and never retries the programming request', async () => {
    vi.mocked(askAiResult).mockResolvedValueOnce({ ok: false, provider: 'gemini', model: 'fixture', code: 'quota', status: 429 });
    await expect(directExplainer({ script: 'Uma flor abre suas pétalas.', mode: 'program', engine: '3d' })).rejects.toMatchObject({ code: 'quota' });
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
  it('sends a validated prior proposal and numeric feedback only on an explicit repair request', async () => {
    const sample = sceneProgramFixtures()[0]!;
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    const response = await directExplainer({ script: sample.script, engine: '3d', mode: 'program', previousProgram: sample.response.sceneProgram, repairIssue: 'Mão esquerda fora do alcance; alvo=[.47,20,-.27].' });
    expect(response.plan.sceneProgram).toBeDefined(); expect(askAiResult).toHaveBeenCalledTimes(1);
    expect(vi.mocked(askAiResult).mock.calls[0][0]).toContain('REVISÃO SOLICITADA PELO USUÁRIO');
    expect(vi.mocked(askAiResult).mock.calls[0][0]).toContain('alvo=[.47,20,-.27]');
  });
  it('rejects a prior program bound to another script before making any provider call', async () => {
    const sample = sceneProgramFixtures()[0]!;
    await expect(directExplainer({ script: 'Uma flor abre suas pétalas.', engine: '3d', mode: 'program', previousProgram: sample.response.sceneProgram, repairIssue: 'Corrija o contato.' })).rejects.toMatchObject({ code: 'invalid_program_repair' });
    expect(askAiResult).not.toHaveBeenCalled();
  });
});
