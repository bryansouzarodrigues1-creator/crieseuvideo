import { describe, it, expect } from 'vitest';
import { cameraPose, clamp01 } from './camera';
import { CAMERA_MOVE_IDS, SHOT_IDS } from './catalog';

const focus = { x: 0, y: 1.5, z: 0 };
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('cameraPose', () => {
  it('is deterministic: same inputs, same frame (preview and MP4 export match)', () => {
    const a = cameraPose({ move: 'orbit_left', shot: 'medium', intensity: 0.7 }, 0.37, focus, 6);
    const b = cameraPose({ move: 'orbit_left', shot: 'medium', intensity: 0.7 }, 0.37, focus, 6);
    expect(a).toEqual(b);
  });
  it('intensity 0 or a static move holds the camera still for the whole scene', () => {
    for (const spec of [{ move: 'push_in' as const, shot: 'medium' as const, intensity: 0 }, { move: 'static' as const, shot: 'medium' as const, intensity: 1 }]) {
      const p0 = cameraPose(spec, 0, focus, 6), p1 = cameraPose(spec, 1, focus, 6);
      expect(dist(p0.pos, p1.pos)).toBeLessThan(1e-9);
    }
  });
  it('push_in gets closer and pull_out gets farther', () => {
    const near = (m: 'push_in' | 'pull_out') => {
      const s = { move: m, shot: 'medium' as const, intensity: 1 };
      return dist(cameraPose(s, 1, focus, 6).pos, focus) - dist(cameraPose(s, 0, focus, 6).pos, focus);
    };
    expect(near('push_in')).toBeLessThan(0);
    expect(near('pull_out')).toBeGreaterThan(0);
  });
  it('wide is farther than medium, medium farther than close', () => {
    const d = (shot: 'wide' | 'medium' | 'close') => dist(cameraPose({ move: 'static', shot, intensity: 0 }, 0.5, focus, 6).pos, focus);
    expect(d('wide')).toBeGreaterThan(d('medium'));
    expect(d('medium')).toBeGreaterThan(d('close'));
  });
  it('every catalog move and shot gives finite numbers across the whole scene', () => {
    for (const move of CAMERA_MOVE_IDS) for (const shot of SHOT_IDS) for (const progress of [-1, 0, 0.5, 1, 2, NaN]) {
      const p = cameraPose({ move, shot, intensity: 1 }, progress, focus, 6);
      for (const v of [...Object.values(p.pos), ...Object.values(p.look)]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  it('never puts the camera on top of the subject', () => {
    for (const move of CAMERA_MOVE_IDS) for (const progress of [0, 0.5, 1]) {
      expect(dist(cameraPose({ move, shot: 'close', intensity: 1 }, progress, focus, 1).pos, focus)).toBeGreaterThan(0.4);
    }
  });
  it('clamp01 handles NaN and out-of-range', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(5)).toBe(1);
    expect(clamp01(-5)).toBe(0);
  });
});
