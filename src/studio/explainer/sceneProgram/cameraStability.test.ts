import { describe, expect, it } from 'vitest';
import { SceneProgram3D } from './stage3d';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';

const sources: ProgramSource[] = [{ sourceId: 's1', text: mechanicalDemoScript, duration: 8 }];
const make = (motion?: 'locked' | 'orbit') => {
  const raw = mechanicalDemoProgram();
  raw.shots[0].endAzimuth = 1.08;
  if (motion) (raw.shots[0] as typeof raw.shots[0] & { motion?: string }).motion = motion;
  return normalizeSceneProgram(raw, sources);
};

describe('generic 3D camera framing', () => {
  it('keeps the camera stable during a moving machine and never crops its important parts', () => {
    const stage = new SceneProgram3D(make(), sources);
    try {
      for (const aspect of [9 / 16, 16 / 9]) {
        let camera: number[] | undefined;
        for (const time of [0, 1, 2, 3, 4, 5.5, 7, 8, 2.5]) {
          stage.update(time);
          stage.frame(aspect);
          const now = stage.diagnostics();
          if (!camera) camera = now.camera;
          else now.camera.forEach((v, i) => expect(v).toBeCloseTo(camera![i], 5));
          expect(now.projectedBounds.min[0]).toBeGreaterThan(-.88);
          expect(now.projectedBounds.max[0]).toBeLessThan(.88);
          expect(now.projectedBounds.min[1]).toBeGreaterThan(-.65);
          expect(now.projectedBounds.max[1]).toBeLessThan(.88);
        }
      }
    } finally {
      stage.dispose();
    }
  });

  it('allows an intentional orbit that retains safe framing throughout the shot', () => {
    const stage = new SceneProgram3D(make('orbit'), sources);
    try {
      let first: number[] | undefined;
      for (const time of [0, 1, 2, 4, 6, 8]) {
        stage.update(time);
        stage.frame(9 / 16);
        const now = stage.diagnostics();
        if (!first) first = [...now.camera];
        expect(now.projectedBounds.min[0]).toBeGreaterThan(-.88);
        expect(now.projectedBounds.max[0]).toBeLessThan(.88);
      }
      expect(stage.camera.position.toArray()).not.toEqual(first);
    } finally {
      stage.dispose();
    }
  });

  it('rejects unknown camera motion without changing the security contract', () => {
    const invalid = mechanicalDemoProgram() as ReturnType<typeof mechanicalDemoProgram> & { shots: Array<{ motion?: string }> };
    invalid.shots[0]!.motion = 'remote-control';
    expect(() => normalizeSceneProgram(invalid, sources)).toThrow(/movimento da câmera/);
  });
});
