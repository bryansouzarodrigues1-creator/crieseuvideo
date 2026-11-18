import { describe, expect, it } from 'vitest';
import { normalizeSceneProgram, compileSceneProgram, type ProgramSource } from './score';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';

const source: ProgramSource[] = [{ sourceId: 's1', text: mechanicalDemoScript, duration: 8 }];
const clone = () => structuredClone(mechanicalDemoProgram());
const assertRejected = (change: (program: ReturnType<typeof mechanicalDemoProgram>) => void, message: RegExp) => {
  const program = clone();
  change(program);
  try { normalizeSceneProgram(program, source); throw new Error('INVALID_PROGRAM_WAS_ACCEPTED'); }
  catch (error) {
    expect((error as Error).message).not.toBe('INVALID_PROGRAM_WAS_ACCEPTED');
    expect((error as Error).message).toMatch(message);
  }
};

describe('measurable 3D action contracts (not thematic presets)', () => {
  it('accepts the physical sequence: assembly, rest, then blade rotation', () => {
    const plan = normalizeSceneProgram(clone(), source);
    expect(plan.motionChecks).toHaveLength(4);
    expect(compileSceneProgram(plan, source).sample(8).get('blade-rotor')?.rotation[1]).toBeCloseTo(6.1);
  });

  it('rejects the classic fake assembly: the jar never actually moves', () => {
    assertRejected((p) => {
      p.tracks[0]!.keys.forEach((k) => { k.value = [0, 1.01, 0]; });
    }, /não se move o suficiente/);
  });

  it('rejects a blender video that claims blade motion while blades remain still', () => {
    assertRejected((p) => {
      p.tracks[1]!.keys.forEach((k) => { k.value = [0, 0, 0]; });
    }, /não se move o suficiente/);
  });

  it('rejects premature blade movement before the jar docks', () => {
    assertRejected((p) => {
      p.tracks[1]!.keys[1]!.value = [0, 2, 0];
    }, /deveria permanecer parada|continua se movendo/);
  });

  it('rejects a jar that keeps moving after the assembly is supposed to finish', () => {
    assertRejected((p) => {
      p.tracks[0]!.keys[4]!.value = [0, 1.65, 0];
    }, /deveria permanecer parada|continua se movendo/);
  });

  it('rejects a claim with no corresponding track, wrong node, unknown source, or invalid time', () => {
    assertRejected((p) => {
      p.motionChecks[0]!.node = 'nonexistent';
    }, /objeto que não existe/);
    assertRejected((p) => {
      p.motionChecks[0]!.channel = 'scale';
    }, /sem animar a propriedade/);
    assertRejected((p) => {
      p.motionChecks[0]!.sourceId = 's99';
    }, /frase inexistente/);
    assertRejected((p) => {
      p.motionChecks[0]!.endPhase = p.motionChecks[0]!.startPhase;
    }, /janela temporal positiva/);
  });

  it('rejects arbitrary commands and impossible thresholds, including fractional invalid windows', () => {
    const raw = JSON.parse(JSON.stringify(clone()));
    raw.motionChecks[0].javascript = 'fetch(\'https://example.org/\')';
    expect(() => normalizeSceneProgram(raw, source)).toThrow(/campo não suportado/);
    assertRejected((p) => { p.motionChecks[0]!.threshold = -1; }, /inválida/);
    assertRejected((p) => { p.motionChecks[0]!.startPhase = Number.NaN; }, /inválida/);
  });

  it('also verifies an unrelated piston motion without knowing object categories', () => {
    const text = 'O pistão recua, depois permanece parado.';
    const program = {
      version: 1, background: '#C5D7E0',
      nodes: [{ id: 'cylinder-piston', kind: 'mesh', contextSourceId: 's1',
        geometry: { shape: 'cylinder', size: [.30, .30, .95] }, color: '#34495C' }],
      tracks: [{ node: 'cylinder-piston', channel: 'position', interpolation: 'smooth',
        keys: [
          { sourceId: 's1', phase: 0, value: [0, .2, 0] },
          { sourceId: 's1', phase: .45, value: [1.2, .2, 0] },
          { sourceId: 's1', phase: 1, value: [1.2, .2, 0] },
        ],
      }],
      shots: [{ sourceId: 's1', subjects: ['cylinder-piston'], azimuth: .4, elevation: .2, distance: 1.5 }],
      contacts: [],
      motionChecks: [
        { sourceId: 's1', node: 'cylinder-piston', channel: 'position', kind: 'change', startPhase: 0, endPhase: .45, threshold: 1 },
        { sourceId: 's1', node: 'cylinder-piston', channel: 'position', kind: 'hold', startPhase: .45, endPhase: 1, threshold: .01 },
      ],
    };
    expect(normalizeSceneProgram(program, [{ sourceId: 's1', text, duration: 5 }]).motionChecks).toHaveLength(2);
  });

  it('accepts historical scene programs without opt-in claims (migration safe)', () => {
    const raw: { motionChecks?: unknown } = clone();
    delete raw.motionChecks;
    expect(normalizeSceneProgram(raw, source).motionChecks).toBeUndefined();
  });

  it('repeats exactly after random seek order, without accepting an empty motion', () => {
    const plan = normalizeSceneProgram(clone(), source);
    const score = compileSceneProgram(plan, source);
    const sample = score.sample(3.4);
    for (const time of [1.5, 8, 0, 5, 3.4]) score.sample(time);
    expect(score.sample(3.4)).toEqual(sample);
  });
});
