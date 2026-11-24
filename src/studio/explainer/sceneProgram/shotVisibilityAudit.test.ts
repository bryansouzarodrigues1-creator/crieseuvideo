import { describe, expect, it } from 'vitest';
import { compileCompactWorld } from './planner/compactWorldDirector';
import { sourceBriefsFromScript } from './planner/sceneScript';
import { SceneProgram3D } from './stage3d';
import { auditShotVisibilityAt, auditShotVisibilitySequence } from './shotVisibilityAudit';

const sources = sourceBriefsFromScript(
  'O guindaste ergue uma carga única com o seu cabo até a parte alta do canteiro. ' +
  'O carrinho transporta a mesma carga por cima dos obstáculos sem soltá-la. ' +
  'O operador abaixa a carga perto da plataforma e encerra a operação.'
);
const spec = {
  version: 1,
  setting: 'industrial',
  background: '#C5DCEB',
  entities: [
    { id: 'crane', name: 'Guindaste alto no canteiro', kind: 'crane', at: [-2, 0, 0], size: [7, 9, 3], color: '#D6A442' },
    { id: 'load', name: 'Carga única suspensa', kind: 'cargo', at: [0, 0, 0], size: [1.5, 1, 1], color: '#C9B394' },
    { id: 'landing', name: 'Plataforma elevada de recebimento', kind: 'platform', at: [2.2, 0, 0], size: [2.4, 1, 2.8], color: '#8199A2' },
  ],
  actions: [
    { sourceId: 's1', target: 'load', kind: 'lift', delta: [0, 4, 0] },
    { sourceId: 's2', target: 'load', kind: 'move', delta: [2.2, 0, 0] },
    { sourceId: 's3', target: 'load', kind: 'lower', delta: [0, -3, 0], onto: 'landing' },
  ],
} as const;

describe('real 3D shot visibility audit — no model or remote calls', () => {
  const create = () => {
    const clip = compileCompactWorld(spec, sources);
    return new SceneProgram3D(clip.program, clip.sources);
  };

  it('measures all three story beats for portrait and landscape without losing subjects', () => {
    const stage = create();
    try {
      for (const aspect of [9 / 16, 16 / 9]) {
        const reports = auditShotVisibilitySequence(stage, aspect);
        expect(reports).toHaveLength(9);
        expect(new Set(reports.map(r => r.sourceId))).toEqual(new Set(['s1', 's2', 's3']));
        for (const report of reports) {
          expect(report.aspect).toBe(aspect);
          expect(report.subjects.map(s => s.id)).toEqual(expect.arrayContaining(['crane', 'load']));
          for (const subject of report.subjects) {
            expect(Number.isFinite(subject.areaFraction)).toBe(true);
            expect(subject.areaFraction).toBeGreaterThanOrEqual(0);
            expect(subject.areaFraction).toBeLessThanOrEqual(1);
            expect(subject.insideFraction).toBeGreaterThanOrEqual(0);
            expect(subject.insideFraction).toBeLessThanOrEqual(1);
            expect(subject.testedRays).toBeLessThanOrEqual(9);
            expect(subject.blockedRays).toBeLessThanOrEqual(subject.testedRays);
            // Framing should not chop the selected subject at the shot boundary.
            expect(subject.issues).not.toContain('subject_offscreen');
            expect(subject.issues).not.toContain('subject_missing_geometry');
          }
        }
      }
    } finally {
      stage.dispose();
    }
  });

  it('provides reproducible, bounded, machine-readable revision feedback', () => {
    const stage = create();
    try {
      const first = auditShotVisibilityAt(stage, 5.5, 9 / 16, { minimumAreaFraction: .95 });
      const second = auditShotVisibilityAt(stage, 5.5, 9 / 16, { minimumAreaFraction: .95 });
      expect(second).toEqual(first);
      expect(first.subjects.some(s => s.issues.includes('subject_too_small'))).toBe(true);
      expect(first.issues.filter(i => i.code === 'subject_too_small')).not.toHaveLength(0);
      expect(first.issues.every(i => i.suggestion.length > 20)).toBe(true);
      const serialized = JSON.stringify(first);
      expect(serialized).toContain('subject_too_small');
      expect(serialized).not.toMatch(/api_key|secret|token/i);
    } finally {
      stage.dispose();
    }
  });

  it('rejects invalid time and aspect before mutating camera state', () => {
    const stage = create();
    try {
      expect(() => auditShotVisibilityAt(stage, 0, 0)).toThrow(/proporção inválidos/);
      expect(() => auditShotVisibilityAt(stage, Number.NaN, 9 / 16)).toThrow();
    } finally {
      stage.dispose();
    }
  });
});
