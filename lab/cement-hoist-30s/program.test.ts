import { describe, expect, it } from 'vitest';
import { normalizeSceneProgram } from '../../src/studio/explainer/sceneProgram/score';
import { auditSceneCutActivity } from '../../src/studio/explainer/sceneProgram/cutActivity';
import { cementLift30sProgram, cementLiftSources } from './program';

describe('30-second construction reference uses actual generic SceneProgram', () => {
  it('contains no empty tracks, produces fully valid geometry and a connected 3D cable', () => {
    const raw = cementLift30sProgram();
    expect(raw.tracks.every(Boolean)).toBe(true);
    const p = normalizeSceneProgram(raw,cementLiftSources);
    expect(p.nodes.length).toBeGreaterThan(100);
    expect(p.nodes.length).toBeLessThanOrEqual(160);
    expect(p.cables).toEqual([{node:'rope-body',from:'upper-pulley',to:'load-hook'}]);
    expect(p.shots[0]?.cuts).toHaveLength(5);
    expect(p.nodes.find(n=>n.id==='motor-shell')?.geometry?.shape).toBe('cylinder');
    expect(p.nodes.some(n=>n.id==='output-shaft')).toBe(true);
    expect(p.nodes.some(n=>n.id==='drum')).toBe(true);
  });
  it('does not leave any camera cut without physical motion of a focused 3D subject', () => {
    const p=normalizeSceneProgram(cementLift30sProgram(),cementLiftSources);
    const a=auditSceneCutActivity(p,cementLiftSources,{maxStillSeconds:1.4});
    expect(a.cuts).toHaveLength(5);
    expect(a.cuts.every(c=>c.animated.length>0)).toBe(true);
    expect(a.frozenCuts).toEqual([]);
  });
});
