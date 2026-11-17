import { describe, expect, it } from 'vitest';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';
import { auditSceneActionDensity } from './actionDensity';

const sources: ProgramSource[] = [{ sourceId: 's1', text: 'Um aparelho tenta levantar a carga.', duration: 4 }];
const key = (phase: number, value: number[], sourceId = 's1') => ({ sourceId, phase, value });
const track = (node: string, channel: string, values: [number, number[]][]) =>
  ({ node, channel, interpolation: 'linear', keys: values.map(([phase, value]) => key(phase, value)) });
const make = (kind: 'mesh' | 'actor', tracks: unknown[], src: ProgramSource[] = sources) =>
  normalizeSceneProgram({
    version: 1, background: '#A4D2ED',
    nodes: [{
      id: 'subject', kind, contextSourceId: 's1',
      ...(kind === 'mesh' ? { geometry: { shape: 'box', size: [1, 1, 1] } } : {}),
    }],
    tracks, contacts: [], shots: src.map((s) => ({
      sourceId: s.sourceId, subjects: ['subject'],
      azimuth: 0, endAzimuth: .5, elevation: .2, distance: 1.15,
    })),
  }, src);

describe('independent scene action-density audit', () => {
  it('measures a real assembly fixture without relying on model-authored motionChecks', () => {
    const src = [{ sourceId: 's1', text: mechanicalDemoScript, duration: 8 }];
    const p = normalizeSceneProgram(mechanicalDemoProgram(), src);
    const report = auditSceneActionDensity({ ...p, motionChecks: undefined }, src);
    expect(report.sourceCount).toBe(1);
    expect(report.duration).toBe(8);
    expect(report.beats[0]!.independentlyMovingNodes).toContain('jar-assembly');
    expect(report.beats[0]!.independentlyMovingNodes).toContain('blade-rotor');
    expect(report.beats[0]!.activeSeconds).toBeGreaterThan(5);
    expect(report.findings.some((f) => f.kind === 'no_visible_actuation')).toBe(false);
  });

  it('detects a visually static beat even if a camera is moving', () => {
    const p = make('mesh', [track('subject', 'position', [[0, [0, 0, 0]], [1, [0, 0, 0]]])]);
    const before = JSON.stringify(p);
    const report = auditSceneActionDensity(p, sources);
    expect(report.beats[0]!.activeSeconds).toBe(0);
    expect(report.beats[0]!.longestStillSeconds).toBe(4);
    expect(report.findings).toContainEqual({ kind: 'no_visible_actuation', sourceId: 's1', seconds: 4 });
    expect(report.findings.some((f) => f.kind === 'long_motionless_window')).toBe(true);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('does not invent movement by counting the static descendants of a moving group', () => {
    const p = make('mesh', [track('subject', 'position', [[0, [0, 0, 0]], [1, [2, 0, 0]]])]);
    const report = auditSceneActionDensity(p, sources);
    expect(report.beats[0]!.activeTrackCount).toBe(1);
    expect(report.beats[0]!.independentlyMovingNodes).toEqual(['subject']);
  });

  it('accepts grounded actor root travel when the motor supplies procedural foot planting', () => {
    const p = make('actor', [track('subject', 'position', [[0, [0, 0, 0]], [1, [2, 0, 0]]])]);
    const report = auditSceneActionDensity(p, sources);
    expect(report.findings.some((f) => f.kind === 'actor_root_glide')).toBe(false);
  });

  it('still flags unsupported gliding during diagonal ascents (not a grounded walk)', () => {
    const p = make('actor', [track('subject', 'position', [[0, [0, 0, 0]], [1, [2, .6, 0]]])]);
    const report = auditSceneActionDensity(p, sources);
    expect(report.findings).toContainEqual({
      kind: 'actor_root_glide', sourceId: 's1', actorId: 'subject',
      metres: Number(Math.hypot(2, .6).toFixed(3)),
    });
  });

  it('does not claim a walking actor glides when explicit alternating foot movement exists', () => {
    const p = make('actor', [
      track('subject', 'position', [[0, [0, 0, 0]], [1, [2, 0, 0]]]),
      track('subject', 'leftFoot', [[0, [-.2, .1, 0]], [.5, [.65, .2, 0]], [1, [1.6, .1, 0]]]),
      track('subject', 'rightFoot', [[0, [.2, .1, 0]], [.5, [1.1, .1, 0]], [1, [2.2, .1, 0]]]),
    ]);
    const report = auditSceneActionDensity(p, sources);
    expect(report.findings.some((f) => f.kind === 'actor_root_glide')).toBe(false);
  });

  it('reports idle time within a beat rather than hiding it behind a final movement', () => {
    const p = make('mesh', [track('subject', 'position', [
      [0, [0, 0, 0]], [.75, [0, 0, 0]], [1, [1, 0, 0]],
    ])]);
    const report = auditSceneActionDensity(p, sources);
    expect(report.beats[0]!.longestStillSeconds).toBeGreaterThanOrEqual(3);
    expect(report.findings.some((f) =>
      f.kind === 'long_motionless_window' && f.from === 0 && f.to >= 3)).toBe(true);
  });

  it('cannot be fooled by a model omitting all self-declared motion checks', () => {
    const p = make('mesh', [track('subject', 'rotation', [[0, [0, 0, 0]], [1, [0, 0, 6.283]]])]);
    const report = auditSceneActionDensity(p, sources);
    expect(p.motionChecks).toBeUndefined();
    expect(report.beats[0]!.activeSeconds).toBeGreaterThan(3.5);
    expect(report.findings.some((f) => f.kind === 'no_visible_actuation')).toBe(false);
  });
});
