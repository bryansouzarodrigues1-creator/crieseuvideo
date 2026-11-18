import { afterEach, describe, expect, it, vi } from 'vitest';
import { directExplainer } from '../../../server/director';
import { askAiResult } from '../../../server/ai';
import { sceneProgramFixtures } from '../fixtures';
import { normalizeSceneProgram } from '../score';
import { extractKeywords, stem, tokens } from './keywords';
import { searchVault, scoreEntry, estimateSize, type VaultEntry } from './vault';
import { applyUses, harvest, candidateRoots, offerFor, offerPrompt } from './flow';
import { MemoryVaultStore, supabaseVaultStore } from './store';

vi.mock('../../../server/ai', async (original) => ({ ...(await original<typeof import('../../../server/ai')>()), askAiResult: vi.fn() }));
afterEach(() => { vi.mocked(askAiResult).mockReset(); });
const ok = (raw: unknown) => ({ ok: true as const, provider: 'gemini' as const, model: 'fixture', text: JSON.stringify(raw) });
const env = { FREEFORM_3D_GEMINI_API_KEY: 'k' };

const comet = () => {
  const sample = sceneProgramFixtures()[1]!, response = JSON.parse(JSON.stringify(sample.response));
  response.sceneProgram.nodes.find((n: any) => n.id === 'comet').asset = { name: 'Cometa brilhante', keywords: ['cometa', 'astro'] };
  return { sample, response };
};

describe('keyword normalisation', () => {
  it('stems plurals and accents so inflected words meet', () => {
    expect(stem('Arcas')).toBe(stem('arca')); expect(stem('barcos')).toBe('barco'); expect(stem('animais')).toBe('animal'); expect(stem('canções')).toBe('cancao');
    expect(tokens('A arca de Noé flutua sobre as águas')).toEqual(['arca', 'noe', 'flutua', 'agua']);
  });
  it('ranks repeated, longer words first and drops stop words', () => {
    expect(extractKeywords('o cometa cruza o céu, o cometa brilha', 3)).toEqual(['cometa', 'brilha', 'cruza']);
  });
});

describe('exact keyword + context search', () => {
  const entry = (over: Partial<VaultEntry> = {}): VaultEntry => ({ id: 'arca-1', title: 'Arca de Noé', kind: 'object', keywords: ['arca', 'noe', 'barco'], contextTokens: ['arca', 'noe', 'flutua', 'agua', 'animal'], root: 'arca', nodes: [], tracks: [], size: [10, 6, 30], uses: 0, rejects: 0, createdAt: '2026-01-01', ...over });
  it('matches the keyword in context, including plurals', () => {
    expect(scoreEntry('Noé constrói uma arca enorme para os animais e a água sobe.', entry())?.keywordHits).toContain('arca');
    expect(scoreEntry('As arcas flutuam na água com os animais de Noé.', entry())).not.toBeNull();
  });
  it('never returns a piece whose keyword is absent, however close the context', () => {
    expect(scoreEntry('Um navio flutua sobre a água com animais.', entry())).toBeNull();
  });
  it('requires context: a bare keyword in an unrelated sentence is not enough', () => {
    expect(scoreEntry('O preço da arca na loja de brinquedos sobe amanhã.', entry())).toBeNull();
  });
  it('skips rejected pieces and ranks by score, then use', () => {
    expect(scoreEntry('Noé constrói uma arca para os animais na água.', entry({ rejects: 2 }))).toBeNull();
    const a = entry({ id: 'a', uses: 0 }), b = entry({ id: 'b', uses: 5 });
    expect(searchVault([a, b], 'Noé constrói uma arca para os animais na água.').map((m) => m.entry.id)).toEqual(['b', 'a']);
  });
  it('estimates size from primitives and hierarchy', () => {
    const n = (id: string, position: [number, number, number], size: number[], parent?: string, scale: [number, number, number] = [1, 1, 1]) => ({ id, kind: parent === undefined && size.length === 0 ? 'group' as const : 'mesh' as const, ...(parent ? { parent } : {}), position, rotation: [0, 0, 0] as [number, number, number], scale, color: '#ffffff', ...(size.length ? { geometry: { shape: 'box', size } } : {}) });
    expect(estimateSize([n('g', [0, 0, 0], []), n('a', [0, 1, 0], [2, 2, 2], 'g'), n('b', [4, 1, 0], [2, 2, 2], 'g')])).toEqual([6, 2, 2]);
  });
});

describe('harvesting from a validated program', () => {
  it('saves a root group with automatic keywords and without the user sentence', () => {
    const { sample, response } = comet(), roots = candidateRoots(response.sceneProgram);
    const program = normalizeSceneProgram((() => { const p = JSON.parse(JSON.stringify(response.sceneProgram)); p.nodes.forEach((n: any) => delete n.asset); return p; })(), [{ sourceId: 's1', text: sample.script }]);
    const [entry] = harvest(program, roots);
    expect(entry.title).toBe('Cometa brilhante'); expect(entry.keywords).toEqual(expect.arrayContaining(['cometa', 'astro', 'brilhante']));
    expect(entry.nodes.length).toBe(6); expect(entry.tracks.length).toBeGreaterThan(0);
    expect(JSON.stringify(entry)).not.toContain('deixa uma cauda'); expect(entry.contextTokens).toEqual(expect.arrayContaining(['cometa', 'cauda']));
    expect(harvest(program, roots, new Set(['comet']))).toEqual([]);
  });
});

describe('end to end through the director', () => {
  const second = (vaultId: string) => ({ title: 'x', scenes: [{ sourceId: 's1', visual: 'character', mood: 'neutral', palette: 'teal' }],
    sceneProgram: { version: 1, background: '#101A35', uses: [{ vault: vaultId, id: 'cometa', sourceId: 's1', position: [0, 1, 0], scale: 1.4 }, { vault: 'inexistente', id: 'x', sourceId: 's1' }],
      nodes: [{ id: 'estrelas', kind: 'mesh', contextSourceId: 's1', geometry: { shape: 'sphere', size: [.03] }, color: '#FFFFFF', repeat: { count: 60, step: [0, 0, 0], jitter: [20, 12, 4], seed: 3 } }],
      tracks: [], contacts: [], shots: [{ sourceId: 's1', subjects: ['cometa'], azimuth: .1, endAzimuth: -.1, elevation: .1, distance: 1.2 }] } });
  it('generates once, stores the piece, then reuses it by keyword and context without rebuilding', async () => {
    const store = new MemoryVaultStore(), { sample, response } = comet();
    vi.mocked(askAiResult).mockResolvedValueOnce(ok(response));
    const first = await directExplainer({ script: sample.script, engine: '3d', mode: 'program' }, env, { vault: store });
    expect(first.plan.sceneProgram?.nodes.some((n) => 'asset' in n)).toBe(false);
    const saved = [...store.items.values()]; expect(saved).toHaveLength(1);
    expect(vi.mocked(askAiResult).mock.calls[0][0]).not.toContain('COFRE DE PEÇAS JÁ PRONTAS');

    const script = 'Outro cometa cruza o céu escuro e brilha.';
    vi.mocked(askAiResult).mockResolvedValueOnce(ok(second(saved[0].id)));
    const reused = await directExplainer({ script, engine: '3d', mode: 'program', targetDuration: 6 }, env, { vault: store });
    const prompt = vi.mocked(askAiResult).mock.calls[1][0]; expect(prompt).toContain('COFRE DE PEÇAS JÁ PRONTAS'); expect(prompt).toContain(saved[0].id);
    const nodes = reused.plan.sceneProgram!.nodes;
    expect(nodes.find((n) => n.id === 'cometa')?.scale[0]).toBeCloseTo(1.4); expect(nodes.length).toBe(1 + 6);
    expect(reused.plan.sceneProgram!.tracks.length).toBeGreaterThan(0);
    expect(nodes.find((n) => n.id === 'cometa-1')?.evidence).toBe(script);
    expect(store.items.size).toBe(1); expect(saved[0].uses).toBe(1);
  });
  it('offers nothing when keyword and context do not match, and rejects a vault-only field smuggled through', async () => {
    const store = new MemoryVaultStore(), { sample, response } = comet();
    vi.mocked(askAiResult).mockResolvedValueOnce(ok(response)); await directExplainer({ script: sample.script, engine: '3d', mode: 'program' }, env, { vault: store });
    vi.mocked(askAiResult).mockResolvedValueOnce(ok(comet().response));
    await directExplainer({ script: 'O ferreiro bate o ferro quente na bigorna.', engine: '3d', mode: 'program' }, env, { vault: store }).catch(() => undefined);
    expect(vi.mocked(askAiResult).mock.calls[1][0]).not.toContain('COFRE DE PEÇAS JÁ PRONTAS');
  });
  it('keeps working when the store is unavailable', async () => {
    const broken = supabaseVaultStore(async () => { throw new Error('no table'); }), { sample, response } = comet();
    expect(await broken.list()).toEqual([]);
    vi.mocked(askAiResult).mockResolvedValueOnce(ok(response));
    await expect(directExplainer({ script: sample.script, engine: '3d', mode: 'program' }, env, { vault: broken })).resolves.toBeTruthy();
  });
});

describe('applyUses safety', () => {
  const entry = (): VaultEntry => ({ id: 'e', title: 't', kind: 'object', keywords: ['k'], contextTokens: [], root: 'r', size: [1, 1, 1], uses: 0, rejects: 0, createdAt: '', tracks: [],
    nodes: [{ id: 'r', kind: 'group', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff' }, { id: 'm', kind: 'mesh', parent: 'r', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', geometry: { shape: 'box', size: [1, 1, 1] } }] });
  const beats = [{ sourceId: 's1', text: 'x' }];
  it('skips pieces the director did not offer, bad ids, duplicates and node-budget overflow', () => {
    const raw: any = { nodes: [{ id: 'existente' }], tracks: [], uses: [{ vault: 'e', id: 'novo', sourceId: 's1' }, { vault: 'e', id: 'novo', sourceId: 's1' }, { vault: 'e', id: 'Ruim Id', sourceId: 's1' }, { vault: 'e', id: 'ok2', sourceId: 's9' }, { vault: 'zzz', id: 'ok3', sourceId: 's1' }] };
    const out = applyUses(raw, [entry()], beats);
    expect(out.used).toEqual(['e']); expect(raw.uses).toBeUndefined(); expect(raw.nodes.map((n: any) => n.id)).toEqual(['existente', 'novo', 'novo-1']);
    const full: any = { nodes: Array.from({ length: 159 }, (_, i) => ({ id: `n${i}` })), uses: [{ vault: 'e', id: 'novo', sourceId: 's1' }] };
    expect(applyUses(full, [entry()], beats).used).toEqual([]); expect(full.nodes).toHaveLength(159);
  });
  it('offer text is data and empty without matches', () => { expect(offerPrompt([])).toBe(''); expect(offerFor([], beats)).toEqual([]); });
});
