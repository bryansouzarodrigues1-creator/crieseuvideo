import { describe, expect, it } from 'vitest';
import { compileSceneProgram, normalizeSceneProgram } from './score';
import { auditSceneActionDensity } from './actionDensity';
import {
  craneExperimentFixture,
  craneExperimentProgram,
  craneExperimentScript,
  craneExperimentSources,
} from './craneExperiment';

describe('20-second crane study (agent-authored offline calibration, NOT live Gemini)', () => {
  it('preserves three exact narration sentences and has a camera for each', () => {
    const f = craneExperimentFixture();
    expect(f.script).toBe(craneExperimentScript);
    expect(f.script.split(/(?<=[.!?…])\s+/)).toHaveLength(3);
    expect(f.response.scenes.map((s) => s.sourceId)).toEqual(['s1', 's2', 's3']);
    expect(f.response.sceneProgram.shots.map((s) => s.sourceId)).toEqual(['s1', 's2', 's3']);
  });

  it('validates real geometry and independently observable actuation in every beat', () => {
    const p = normalizeSceneProgram(craneExperimentProgram(), craneExperimentSources);
    const report = auditSceneActionDensity(p, craneExperimentSources);
    expect(p.nodes.some((n) => n.kind === 'actor')).toBe(true);
    expect(p.nodes.filter((n) => n.kind === 'mesh').length).toBeGreaterThan(25);
    expect(report.sourceCount).toBe(3);
    expect(report.duration).toBe(20);
    expect(report.beats.map((b) => b.sourceId)).toEqual(['s1', 's2', 's3']);
    for (const beat of report.beats) {
      expect(beat.activeSeconds).toBeGreaterThan(2);
      expect(beat.independentlyMovingNodes.length).toBeGreaterThan(1);
    }
    expect(report.findings.filter((f) => f.kind === 'no_visible_actuation')).toHaveLength(0);
    expect(report.findings.filter((f) => f.kind === 'actor_root_glide')).toHaveLength(0);
  });

  it('evolves ONE load continuously through effort, pulley and motorized winch', () => {
    const p = normalizeSceneProgram(craneExperimentProgram(), craneExperimentSources);
    const score = compileSceneProgram(p, craneExperimentSources);
    const start = score.sample(0);
    const ropeAttempt = score.sample(11);
    const final = score.sample(19.5);
    const load = (time: number) => score.sample(time).get('load')!.position[1];
    expect(start.get('load')!.position[1]).toBeCloseTo(.45);
    expect(load(6)).toBeCloseTo(.45);
    expect(load(11)).toBeGreaterThan(.7);
    expect(load(19.5)).toBeGreaterThan(4);
    expect(final.get('pulley-rotor')!.rotation[2]).toBeLessThan(ropeAttempt.get('pulley-rotor')!.rotation[2]);
    expect(start.get('winch-install')!.scale[0]).toBeCloseTo(.01);
    expect(final.get('winch-install')!.scale[0]).toBeCloseTo(1);
    expect(final.get('gear-rotor')!.rotation[2]).toBeGreaterThan(10);
  });
});
