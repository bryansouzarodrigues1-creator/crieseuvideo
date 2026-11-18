import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { kitMesh, kitVertexCount, terrainHeight, waterHeight, waterMesh, type KitParams } from './scenery';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';

const base: KitParams = { shape: 'terrain', size: [40, 40, 8], seed: 7, roughness: .6, wave: .3, segments: 16, peakColor: '#eeeeee', foliage: '#3f8f4e', color: '#6a9a4a' };
const valid = (d: { positions: number[]; indices: number[]; colors?: number[] }) => {
  expect(d.positions.every(Number.isFinite)).toBe(true);
  const n = d.positions.length / 3; expect(d.indices.every((i) => Number.isInteger(i) && i >= 0 && i < n)).toBe(true); expect(d.indices.length % 3).toBe(0);
  if (d.colors) expect(d.colors.length).toBe(d.positions.length);
};

describe('scenery generators', () => {
  it('are deterministic and produce valid indexed meshes for every kit shape', () => {
    for (const shape of ['terrain', 'water', 'tree', 'rock', 'cloud'] as const) {
      const p = { ...base, shape, size: shape === 'terrain' ? [40, 40, 8] : shape === 'water' ? [30, 30] : [3] };
      const a = kitMesh(p, 1.5), b = kitMesh(p, 1.5); valid(a); expect(a).toEqual(b);
      expect(a.positions.length / 3).toBeLessThanOrEqual(kitVertexCount(shape, p.segments) * 4);
    }
  });
  it('terrain falls to zero at the border, stays within its height and changes with the seed', () => {
    expect(terrainHeight(base, -20, 0)).toBe(0); expect(terrainHeight(base, 0, 20)).toBe(0);
    let max = 0; for (let x = -19; x <= 19; x += 1) for (let z = -19; z <= 19; z += 1) { const h = terrainHeight(base, x, z); expect(h).toBeGreaterThanOrEqual(0); max = Math.max(max, h); }
    expect(max).toBeLessThanOrEqual(8); expect(max).toBeGreaterThan(2);
    expect(terrainHeight({ ...base, seed: 8 }, 3, 4)).not.toBe(terrainHeight(base, 3, 4));
    const mesh = kitMesh(base); const ys = mesh.positions.filter((_, i) => i % 3 === 1); expect(Math.max(...ys)).toBeCloseTo(max, 0);
  });
  it('water moves with time and respects its wave amplitude', () => {
    const w = { ...base, shape: 'water' as const, size: [30, 30], segments: 12 };
    expect(waterMesh(w, 0).positions).not.toEqual(waterMesh(w, 1).positions);
    for (let t = 0; t < 5; t += .5) expect(Math.abs(waterHeight(w, 3, -2, t))).toBeLessThanOrEqual(w.wave + 1e-9);
    expect(Math.max(...waterMesh({ ...w, wave: 0 }, 2).positions.filter((_, i) => i % 3 === 1).map(Math.abs))).toBe(0);
  });
});

const sources: ProgramSource[] = [{ sourceId: 's1', text: 'Uma ilha verde com floresta e um lago sob as nuvens.', duration: 4 }];
const node = (id: string, shape: string, size: number[], position: number[], geometry: object = {}, extra: object = {}) =>
  ({ id, kind: 'mesh', contextSourceId: 's1', position, color: '#6a9a4a', geometry: { shape, size, ...geometry }, ...extra });
const track = { node: 'isle', channel: 'position', interpolation: 'linear', keys: [{ sourceId: 's1', phase: 0, value: [0, 0, 0] }, { sourceId: 's1', phase: 1, value: [0, 0, 0] }] };
const program = (nodes: unknown[]) => normalizeSceneProgram({ version: 1, background: '#A7D9ED', nodes, tracks: [track], contacts: [],
  shots: [{ sourceId: 's1', subjects: ['isle'], azimuth: .3, endAzimuth: .3, elevation: .3, distance: 1.6 }] }, sources);

describe('scenery kit in SceneProgram', () => {
  it('normalizes kit shapes with defaults and rejects kit fields on other shapes', () => {
    const p = program([node('isle', 'terrain', [40, 40, 8], [0, 0, 0])]);
    expect(p.nodes[0].geometry).toMatchObject({ shape: 'terrain', seed: 1, roughness: .5, segments: 32, peakColor: '#E8ECEF' });
    expect(() => program([node('isle', 'box', [1, 1, 1], [0, 0, 0], { seed: 3 })])).toThrow();
    expect(() => program([node('isle', 'terrain', [40, 40, 8], [0, 0, 0], { segments: 200 })])).toThrow();
    expect(() => program([node('isle', 'terrain', [40, 40, 8], [0, 0, 0], { seed: 1.5 })])).toThrow();
    expect(() => program([node('isle', 'tree', [4], [0, 0, 0], { foliage: 'verde' })])).toThrow();
  });
  it('counts kit vertices against the budget', () => {
    expect(() => program([node('isle', 'tree', [4], [0, 0, 0], {}, { repeat: { count: 800, step: [1, 0, 0] } }), node('b', 'terrain', [9, 9, 1], [0, 0, 0], { segments: 64 }, { repeat: { count: 60, step: [0, 0, 0] } })])).toThrow(/orçamento/);
  });
  it('builds water that is re-displaced as time advances', () => {
    const p = program([node('isle', 'water', [30, 30], [0, 0, 0], { wave: 1 })]), s = new SceneProgram3D(p, sources);
    const m = s.nodes.get('isle') as THREE.Mesh, y = () => Array.from(m.geometry.getAttribute('position').array).filter((_, i) => i % 3 === 1);
    s.update(0); const first = y(); s.update(2); expect(y()).not.toEqual(first); s.dispose();
  });
  it('snaps repeated trees onto the terrain and hides those below the shoreline', () => {
    const terrain = node('isle', 'terrain', [40, 40, 8], [0, 0, 0], { seed: 4, roughness: .7 });
    const forest = node('forest', 'tree', [3], [0, 0, 0], {}, { repeat: { count: 60, step: [0, 0, 0], jitter: [36, 0, 36], seed: 5, ground: 'isle', above: 1 } });
    const s = new SceneProgram3D(program([terrain, forest]), sources), inst = s.nodes.get('forest') as THREE.InstancedMesh, m = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    let shown = 0, hidden = 0;
    for (let i = 0; i < 60; i++) {
      inst.getMatrixAt(i, m); m.decompose(pos, new THREE.Quaternion(), sc);
      const h = terrainHeight({ size: [40, 40, 8], seed: 4, roughness: .7 }, pos.x, pos.z);
      expect(pos.y).toBeCloseTo(h, 5); if (sc.x === 0) { hidden++; expect(h).toBeLessThan(1); } else { shown++; expect(h).toBeGreaterThanOrEqual(1); }
    }
    expect(shown).toBeGreaterThan(0); expect(hidden).toBeGreaterThan(0); s.dispose();
  });
  it('rejects ground that is not a single terrain in the same group, or above without ground', () => {
    const tree = (repeat: object) => node('forest', 'tree', [3], [0, 0, 0], {}, { repeat: { count: 3, step: [1, 0, 0], ...repeat } });
    expect(() => program([node('isle', 'box', [4, 1, 4], [0, 0, 0]), tree({ ground: 'isle' })])).toThrow();
    expect(() => program([node('isle', 'terrain', [40, 40, 8], [0, 0, 0]), tree({ ground: 'ghost' })])).toThrow();
    expect(() => program([node('isle', 'terrain', [40, 40, 8], [0, 0, 0]), tree({ above: 2 })])).toThrow();
  });
});
