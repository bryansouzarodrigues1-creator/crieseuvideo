import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';

const sources: ProgramSource[] = [{ sourceId: 's1', text: 'Uma caixa descansa sobre um campo aberto.', duration: 4 }];
const mesh = (id: string, shape: string, size: number[], position: number[], extra: Record<string, unknown> = {}) =>
  ({ id, kind: 'mesh', contextSourceId: 's1', position, color: '#88aa66', geometry: { shape, size, ...(extra.geometry as object) }, ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'geometry')) });
const boxTrack = { node: 'box', channel: 'position', interpolation: 'linear', keys: [{ sourceId: 's1', phase: 0, value: [0, .5, 0] }, { sourceId: 's1', phase: 1, value: [0, .8, 0] }] };
const program = (nodes: unknown[], tracks: unknown[] = []) => normalizeSceneProgram({ version: 1, background: '#A7D9ED', nodes, tracks: [boxTrack, ...tracks], contacts: [],
  shots: [{ sourceId: 's1', subjects: ['box'], azimuth: .2, endAzimuth: .2, elevation: .2, distance: 1.2 }] }, sources);
const stage = (nodes: unknown[], tracks?: unknown[]) => new SceneProgram3D(program(nodes, tracks), sources);

describe('bevel option', () => {
  it('accepts bevel on boxes, clamps it to the shape and builds rounded geometry', () => {
    const p = program([mesh('box', 'box', [1, .2, 1], [0, 0, 0], { geometry: { bevel: .5, bevelSegments: 4 } })]);
    expect(p.nodes[0].geometry?.bevel).toBeCloseTo(.098, 3); expect(p.nodes[0].geometry?.bevelSegments).toBe(4);
    const s = new SceneProgram3D(p, sources); const m = s.nodes.get('box') as THREE.Mesh; expect(m.geometry.type).toBe('RoundedBoxGeometry'); s.dispose();
  });
  it('drops bevel on other shapes instead of rejecting the whole scene, but still rejects unknown fields', () => {
    const p = program([mesh('box', 'sphere', [1], [0, 0, 0], { geometry: { bevel: .1, bevelSegments: 2 } })]);
    expect(p.nodes[0].geometry?.bevel).toBeUndefined();
    expect(() => program([mesh('box', 'box', [1, 1, 1], [0, 0, 0], { geometry: { bevel: .1, javascript: 'no' } })])).toThrow();
    expect(() => program([mesh('box', 'box', [1, 1, 1], [0, 0, 0], { geometry: { bevel: 'x' } })])).toThrow();
  });
});

describe('automatic ground continuation', () => {
  const object = (s: SceneProgram3D) => s.scene.getObjectByName('horizon-ground') as THREE.Mesh | undefined;
  it('continues a large static slab just below its top surface', () => {
    const s = stage([mesh('ground', 'box', [40, .4, 40], [0, -.2, 0]), mesh('box', 'box', [1, 1, 1], [0, .5, 0])]);
    expect(s.nodes.get('ground')!.getObjectByName('ink')).toBeUndefined(); expect(s.nodes.get('box')!.getObjectByName('ink')).toBeDefined();
    const d = object(s)!; expect(d).toBeDefined(); expect(d.position.y).toBeLessThan(0); expect(d.position.y).toBeGreaterThan(-.1); s.dispose();
  });
  it('leaves tables, tall walls, moving platforms and translucent slabs alone', () => {
    const cases = [
      [mesh('table', 'box', [3, .1, 1.5], [0, 1, 0]), mesh('box', 'box', [1, 1, 1], [0, 2, 0])],
      [mesh('wall', 'box', [40, 12, .4], [0, 6, -10]), mesh('box', 'box', [1, 1, 1], [0, .5, 0])],
      [mesh('glass', 'box', [40, .2, 40], [0, 0, 0], { material: { opacity: .4 } }), mesh('box', 'box', [1, 1, 1], [0, .5, 0])],
    ];
    for (const nodes of cases) { const s = stage(nodes); expect(object(s)).toBeUndefined(); s.dispose(); }
    const moving = stage([mesh('ground', 'box', [40, .4, 40], [0, -.2, 0]), mesh('box', 'box', [1, 1, 1], [0, .5, 0])],
      [{ node: 'ground', channel: 'position', interpolation: 'linear', keys: [{ sourceId: 's1', phase: 0, value: [0, -.2, 0] }, { sourceId: 's1', phase: 1, value: [5, -.2, 0] }] }]);
    expect(object(moving)).toBeUndefined(); moving.dispose();
  });
  it('treats a horizontal plane like a floor but ignores a vertical backdrop plane', () => {
    const floor = stage([{ ...mesh('ground', 'plane', [60, 60], [0, 0, 0]), rotation: [-Math.PI / 2, 0, 0] }, mesh('box', 'box', [1, 1, 1], [0, .5, 0])]);
    expect(object(floor)).toBeDefined(); floor.dispose();
    const backdrop = stage([mesh('wall', 'plane', [60, 30], [0, 15, -20]), mesh('box', 'box', [1, 1, 1], [0, .5, 0])]);
    expect(object(backdrop)).toBeUndefined(); backdrop.dispose();
  });
});
