import { describe, expect, it } from 'vitest';
import { normalizePlan, productionSources } from '../../plan';
import { withTargetDuration } from '../../duration';
import { SceneProgram3D } from '../stage3d';
import { compileSemantic } from './compile';
import { parseSemanticPlan, SemanticPlanError, type SemanticPlan } from './plan';

const sentences = [
  'Ele atravessou a neve até a base da montanha.',
  'Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e cada pé, sem olhar para baixo.',
  'No topo, cravou a bandeira.',
  'E finalmente comemorou.',
];
const sources = sentences.map((text, i) => ({ sourceId: `s${i + 1}`, text }));
const ids = sources.map((s) => s.sourceId);
const plan: SemanticPlan = parseSemanticPlan({
  world: { kind: 'cliff', height: 3.3, mood: 'day' }, hero: { color: '#DF6B35' },
  beats: [{ sourceId: 's1', verb: 'walk', camera: 'follow', from: 'left' }, { sourceId: 's2', verb: 'climb', camera: 'follow' }, { sourceId: 's3', verb: 'plant', camera: 'close' }, { sourceId: 's4', verb: 'celebrate', camera: 'orbit' }],
}, ids);

const run = (p: SemanticPlan, texts = sentences, target = 30) => {
  const srcs = texts.map((text, i) => ({ sourceId: `s${i + 1}`, text }));
  const { program, report } = compileSemantic(p, srcs);
  const response = { title: 'semantic', scenes: srcs.map((s) => ({ sourceId: s.sourceId, visual: 'character', mood: 'neutral', palette: 'teal' })), sceneProgram: program };
  const full = withTargetDuration(normalizePlan(response, texts.join(' '), '9:16'), target);
  const stage = new SceneProgram3D(full.sceneProgram!, productionSources(full.scenes));
  return { program, report, stage, full };
};

describe('semantic direction compiler', () => {
  it('compiles a 4-sentence story that passes the engine validators (IK reach, grounded climb, penetration)', () => {
    const { report, stage, program } = run(plan);
    try {
      console.log(JSON.stringify({ nodes: report.nodes, keys: report.trackKeys, contacts: report.contacts, climb: report.climb && { ...report.climb, ladders: undefined }, bytes: JSON.stringify(program).length }));
      expect(() => stage.validateContacts()).not.toThrow();
    } finally { stage.dispose(); }
  });
  it('is deterministic', () => { expect(JSON.stringify(compileSemantic(plan, sources).program)).toBe(JSON.stringify(compileSemantic(plan, sources).program)); });
  it('rejects plans with coordinates or unknown verbs, with a message the model can repair', () => {
    expect(() => parseSemanticPlan({ ...plan, extra: 1 }, ids)).toThrow(SemanticPlanError);
    expect(() => parseSemanticPlan({ ...plan, beats: plan.beats.map((b) => ({ ...b, verb: 'fly' })) }, ids)).toThrow(/verb precisa ser/);
    expect(() => parseSemanticPlan({ ...plan, world: { ...plan.world, height: 8848 } }, ids)).toThrow(/altura da parede/);
  });
});

import { directSemantic } from './run';
describe('long sentences split by the engine', () => {
  it('merges consecutive climb beats into one continuous climb that still validates', () => {
    const chunks = ['Ele atravessou a neve até a base da montanha.', 'Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e', 'cada pé, sem olhar para baixo.', 'No topo, cravou a bandeira.', 'E finalmente comemorou.'];
    const p = parseSemanticPlan({ world: { kind: 'cliff', height: 3.3, mood: 'night' }, hero: { color: '#DF6B35' }, beats: ['walk', 'climb', 'climb', 'plant', 'celebrate'].map((verb, i) => ({ sourceId: `s${i + 1}`, verb, camera: 'follow' })) }, chunks.map((_, i) => `s${i + 1}`));
    const { stage, program } = run(p, chunks);
    try { expect(new Set(program.contacts.map((c: any) => c.sourceId))).toEqual(new Set(['s2', 's3'])); expect(() => stage.validateContacts()).not.toThrow(); } finally { stage.dispose(); }
  });
});
describe('semantic loop', () => {
  it('repairs a plan the compiler measured as impossible, using the measured reason', async () => {
    const prompts: string[] = [];
    const good = JSON.stringify({ title: 'Everest', world: { kind: 'cliff', height: 3.3, mood: 'dusk' }, hero: { color: '#DF6B35' }, beats: plan.beats });
    const tooTall = JSON.stringify({ title: 'Everest', world: { kind: 'cliff', height: 4.5, mood: 'dusk' }, hero: { color: '#DF6B35' }, beats: plan.beats });
    const answers = [tooTall, good];
    const result = await directSemantic(async (prompt) => { prompts.push(prompt); return { ok: true as const, text: answers.shift()! }; }, sources);
    expect(result.attempts).toBe(2);
    expect(prompts[1]).toMatch(/não cabe/);
    expect(result.program.contacts.length).toBeGreaterThan(10);
  });
});
