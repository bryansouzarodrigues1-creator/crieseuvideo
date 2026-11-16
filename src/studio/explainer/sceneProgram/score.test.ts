import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { normalizePlan, productionSources, refreshProduction } from '../plan';
import { withTargetDuration } from '../duration';
import { compileSceneProgram, normalizeSceneProgram } from './score';
import { SceneProgram3D } from './stage3d';
import { sceneProgramFixtures } from './fixtures';

const example = (index = 0) => {
  const sample = sceneProgramFixtures()[index]!;
  const plan = withTargetDuration(normalizePlan(sample.response, sample.script, '9:16'), sample.duration);
  return { sample, plan, program: plan.sceneProgram!, sources: productionSources(plan.scenes) };
};

describe('authored scene programs beyond the action catalogue', () => {
  it('derives object context from source IDs without asking the model to repeat quotations', () => {
    const { program, sources } = example(0);
    const raw = { ...program, nodes: program.nodes.map(({ evidence: _text, ...node }) => ({ ...node, contextSourceId: 's1' })) };
    expect(normalizeSceneProgram(raw, sources).nodes.every((n) => n.evidence === sources[0].text)).toBe(true);
    raw.nodes[0].contextSourceId = 's99';
    expect(() => normalizeSceneProgram(raw, sources)).toThrow(/frase inexistente/);
  });
  it.each([0, 1, 2])('compiles fixture %i with new geometry and motions, without a thematic renderer', (index) => {
    const { plan, program, sources } = example(index), score = compileSceneProgram(program, sources);
    expect(plan.production).toBeUndefined(); expect(plan.scenes[0].staging).toBeUndefined();
    expect(program.nodes.length).toBeGreaterThan(5);
    expect(score.sample(0)).not.toEqual(score.sample(score.duration));
    const frozen = JSON.stringify(program), earlier = score.sample(score.duration * .33);
    score.sample(score.duration); score.sample(0);
    expect(score.sample(score.duration * .33)).toEqual(earlier);
    expect(JSON.stringify(program)).toBe(frozen);
  });
  it('retimes trajectories by source phase without rewriting their geometry or keys', () => {
    const { plan, program, sources } = example(1), a = compileSceneProgram(program, sources);
    const retimed = withTargetDuration(plan, 60), b = compileSceneProgram(program, productionSources(retimed.scenes));
    const first = a.sample(a.duration * .6), second = b.sample(b.duration * .6);
    for (const [id, state] of first) for (const channel of ['position', 'rotation', 'scale'] as const) state[channel].forEach((v, axis) => expect(v).toBeCloseTo(second.get(id)![channel][axis], 10));
    expect(retimed.sceneProgram).toEqual(program);
  });
  it('binds a saved program to the entire source, and invalidates it after text edits', () => {
    const { plan, sample } = example(1);
    expect(() => normalizePlan(plan, sample.script.replace('cruza', 'nunca cruza'), '9:16')).toThrow(/outro roteiro/);
    const edited = { ...plan, scenes: plan.scenes.map((s) => ({ ...s, text: s.text.replace('cruza', 'nunca cruza') })) };
    expect(refreshProduction(edited).sceneProgram).toBeUndefined();
    expect(normalizePlan(plan, sample.script, '16:9').sceneProgram).toEqual(plan.sceneProgram);
  });
  it.each(['code', 'url', 'shader'])('rejects executable or remote input field %s', (field) => {
    const { program, sources } = example(1);
    expect(() => normalizeSceneProgram({ ...program, [field]: 'untrusted' }, sources)).toThrow(/campo não suportado/);
  });
  it('rejects invalid hierarchy, triangle indices and untrusted resources', () => {
    const { program, sources } = example(0);
    const bad = (edit: (p: any) => void) => { const p = JSON.parse(JSON.stringify(program)); edit(p); expect(() => normalizeSceneProgram(p, sources)).toThrow(); };
    bad((p) => p.nodes[0].parent = p.nodes[0].id);
    bad((p) => p.nodes[0].parent = 'missing');
    bad((p) => p.nodes[1].geometry.indices[0] = 90000);
    bad((p) => p.nodes.find((n: any) => n.repeat).repeat.count = 900000);

    bad((p) => p.shots[0].sourceId = 's99');
    bad((p) => p.contacts.push({ ...p.contacts[0] }));
    bad((p) => p.nodes[0].material = { shader: 'untrusted' });
    bad((p) => p.nodes[0].material = { opacity: -1 });
  });
  it('sorts out-of-order keyframes without changing their sampled movement', () => {
    const { program, sources } = example(0);
    const raw = JSON.parse(JSON.stringify(program));
    const baseline = normalizeSceneProgram(raw, sources);
    raw.tracks[0].keys.reverse();
    const corrected = normalizeSceneProgram(raw, sources);
    expect(corrected.tracks[0].keys).toEqual(baseline.tracks[0].keys);
    const before = compileSceneProgram(baseline,sources), after = compileSceneProgram(corrected,sources);
    for(const fraction of [0,.12,.3,.56,.8,1])
      expect(after.sample(after.duration*fraction)).toEqual(before.sample(before.duration*fraction));
  });
  it('collapses coincident keyframes but still rejects a track with only one distinct instant', () => {
    const { program, sources } = example(0);
    const raw = JSON.parse(JSON.stringify(program));
    const first=raw.tracks[0].keys[0];
    raw.tracks[0].keys.splice(1,0,JSON.parse(JSON.stringify(first)));
    const corrected=normalizeSceneProgram(raw,sources);
    expect(corrected.tracks[0].keys).toHaveLength(program.tracks[0].keys.length);
    const invalid=JSON.parse(JSON.stringify(program));
    invalid.tracks[0].keys=[first,JSON.parse(JSON.stringify(first))];
    expect(()=>normalizeSceneProgram(invalid,sources)).toThrow(/dois instantes distintos/);
  });
  it.each([0, 1, 2])('poses real Three.js geometry for fixture %i deterministically and frames both aspects', (index) => {
    const { program, sources, sample } = example(index), stage = new SceneProgram3D(program, sources);
    try {
      stage.validateContacts();
      let saved;
      for (const time of [sample.duration * .37, sample.duration, 0, sample.duration * .37]) {
        stage.update(time);
        expect(stage.diagnostics().maxContactError).toBeLessThan(.025);
        for (const aspect of [9 / 16, 16 / 9]) {
          stage.frame(aspect); const d = stage.diagnostics();
          expect(d.projectedBounds.min[0]).toBeGreaterThan(-1); expect(d.projectedBounds.max[0]).toBeLessThan(1);
          expect(d.projectedBounds.min[1]).toBeGreaterThan(-.64); expect(d.projectedBounds.max[1]).toBeLessThan(.9);
        }
        const now = stage.actors.get('climber')?.limbs.leftHand.hand.getWorldPosition(new Vector3()).toArray();
        if (time === sample.duration * .37) { if (saved) expect(now).toEqual(saved); saved = now; }
      }
      expect(stage.diagnostics().board).toBe(false);
    } finally { stage.dispose(); }
  });
  it('rejects an actor travelling through a solid platform during an otherwise supported climb', () => {
    const { program, sources } = example(0);
    const changed = JSON.parse(JSON.stringify(program));
    changed.nodes.push({
      id: 'blocking-platform', kind: 'mesh', socket: 'root',
      position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      geometry: { shape: 'box', size: [2, .6, 1.2] },
      color: '#FFFFFF', evidence: sources[0].text,
    });
    const stage = new SceneProgram3D(normalizeSceneProgram(changed, sources), sources);
    try { expect(() => stage.validateContacts()).toThrow(/atravessa uma plataforma sólida/); }
    finally { stage.dispose(); }
  });

  it('rejects fake rock supports that have reachable but interior or floating contact anchors', () => {
    const { program, sources } = example(0);
    const changed = JSON.parse(JSON.stringify(program));
    // Move the rock forward, keeping explicit IK anchors nearby; they now float in air.
    changed.nodes.find((node: { id: string }) => node.id === 'rock').position[2] -= 1.6;
    const stage = new SceneProgram3D(normalizeSceneProgram(changed, sources), sources);
    try { expect(() => stage.validateContacts()).toThrow(/fora do alcance|não toca a superfície/); }
    finally { stage.dispose(); }
  });

  it('rejects a geometrically unreachable hand contact before accepting the preview', () => {
    const { program, sources } = example(0); const raw = JSON.parse(JSON.stringify(program)); raw.contacts[0].offset[1] += 20;
    const stage = new SceneProgram3D(normalizeSceneProgram(raw, sources), sources);
    try { expect(() => stage.validateContacts()).toThrow(/fora do alcance/); } finally { stage.dispose(); }
  });
});
