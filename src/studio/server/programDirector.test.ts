import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer } from './director';
import { askAiResult } from './ai';
import { sceneProgramFixtures } from '../explainer/sceneProgram/fixtures';
import { totalDuration } from '../explainer/plan';
import { makeSceneProgramCandidate } from '../explainer/sceneProgram/candidate';

vi.mock('./ai', async (original) => ({ ...(await original<typeof import('./ai')>()), askAiResult: vi.fn() }));
afterEach(() => { vi.mocked(askAiResult).mockReset(); vi.unstubAllEnvs(); });
const result = (raw: unknown) => ({ ok: true as const, provider: 'gemini' as const, model: 'fixture', text: JSON.stringify(raw) });

describe('free-form 3D always uses only Gemini Direct', () => {
  it('overrides a configured Lovable provider instead of silently using gateway credits', async () => {
    const sample = sceneProgramFixtures()[1]!;
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    await directExplainer({ script: sample.script, engine: '3d', mode: 'program' },
      { AI_TEXT_PROVIDER: 'lovable', LOVABLE_API_KEY: 'must-never-use-this', GEMINI_API_KEY: 'legacy-key', FREEFORM_3D_GEMINI_API_KEY: 'owner-3d-key' });
    const selected = vi.mocked(askAiResult).mock.calls[0][2];
    expect(selected).toMatchObject({ AI_TEXT_PROVIDER: 'gemini', AI_TEXT_FALLBACK: '' });
    expect(selected).toHaveProperty('GEMINI_API_KEY', 'owner-3d-key');
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
});

describe('production route secret separation', () => {
  it('does not reuse a generic Gemini key for private 3D without the dedicated secret', async () => {
    const sample=sceneProgramFixtures()[1]!;
    vi.stubEnv('GEMINI_API_KEY','legacy-shared-key');
    vi.stubEnv('FREEFORM_3D_GEMINI_API_KEY','');
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    await directExplainer({script:sample.script,mode:'program',engine:'3d'});
    const selected=vi.mocked(askAiResult).mock.calls[0][2];
    expect(selected).toMatchObject({AI_TEXT_PROVIDER:'gemini',AI_TEXT_FALLBACK:'',GEMINI_API_KEY:''});
  });
});

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
  it('returns rejected JSON only as a non-enumerable feedback candidate and repairs it explicitly', async () => {
    const sample = sceneProgramFixtures()[1]!, broken = { ...sample.response.sceneProgram, code: 'private-model-payload' };
    vi.mocked(askAiResult).mockResolvedValueOnce(result({ ...sample.response, sceneProgram: broken }));
    const error = await directExplainer({ script: sample.script, mode: 'program', engine: '3d' }).catch((error) => error);
    expect(error.candidate?.program.code).toBe('private-model-payload');
    expect(JSON.stringify(error)).not.toContain('private-model-payload');
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    const repaired = await directExplainer({ script: sample.script, mode: 'program', engine: '3d', previousProposal: error.candidate, repairIssue: error.message });
    expect(repaired.plan.sceneProgram).toBeDefined(); expect(askAiResult).toHaveBeenCalledTimes(2);
    expect(vi.mocked(askAiResult).mock.calls[1][0]).toContain('Proposta anterior, NÃO executável');
  });
  it('rejects cross-script rejected candidates before inference and accepts feedback without a retained proposal', async () => {
    const sample = sceneProgramFixtures()[1]!, candidate = makeSceneProgramCandidate(sample.response.sceneProgram, [{ sourceId: 's1', text: sample.script }]);
    await expect(directExplainer({ script: 'Uma flor abre suas pétalas.', engine: '3d', mode: 'program', previousProposal: candidate, repairIssue: 'Corrigir.' })).rejects.toMatchObject({ code: 'invalid_program_repair' });
    expect(askAiResult).not.toHaveBeenCalled();
    vi.mocked(askAiResult).mockResolvedValueOnce(result(sample.response));
    await directExplainer({ script: sample.script, mode: 'program', engine: '3d', repairIssue: 'Cada objeto deve usar contextSourceId.' });
    expect(vi.mocked(askAiResult).mock.calls[0][0]).toContain('proposta anterior completa não foi retida');
    expect(askAiResult).toHaveBeenCalledTimes(1);
  });
});
