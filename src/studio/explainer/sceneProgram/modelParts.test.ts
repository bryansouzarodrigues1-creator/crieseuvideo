import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { approvedModel, type ApprovedModelId } from './modelRegistry';
import { loadApprovedModel, type PreparedModel } from './modelAssets';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';

const source: ProgramSource[] = [{ sourceId: 's1', text: 'O cofre abre e o caminhão arranca.', duration: 4 }];
const disk = (id: ApprovedModelId) => async () => {
  const info = approvedModel(id)!;
  const bytes = readFileSync(path.resolve(__dirname, '../../../../public', info.url.replace(/^\//, '')));
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
};
const load = (id: ApprovedModelId) => loadApprovedModel(id, disk(id) as unknown as typeof fetch);
const keys = (a: number[], b: number[]) => [{ sourceId: 's1', phase: 0, value: a }, { sourceId: 's1', phase: 1, value: b }];
const plan = (tracks: unknown[], extra: Record<string, unknown> = {}) => ({
  version: 1, background: '#EEF1F5',
  nodes: [
    { id: 'safe', kind: 'model', contextSourceId: 's1', assetId: 'giant-safe-v1' },
    { id: 'truck', kind: 'model', contextSourceId: 's1', assetId: 'armored-truck-v1', position: [6, 0, 0] },
  ],
  tracks,
  shots: [{ sourceId: 's1', subjects: ['safe', 'truck'], azimuth: .2, endAzimuth: .6, elevation: .18, distance: 1.2 }],
  contacts: [], ...extra,
});
const doorTracks = () => [
  { node: 'safe', part: 'volante', channel: 'rotation', interpolation: 'smooth', keys: keys([0, 0, 0], [0, 0, Math.PI * 2]) },
  { node: 'safe', part: 'porta', channel: 'rotation', interpolation: 'smooth', keys: keys([0, 0, 0], [0, 2.0, 0]) },
  { node: 'truck', part: 'porta_traseira', channel: 'rotation', interpolation: 'linear', keys: keys([0, 0, 0], [0, 2.09, 0]) },
  { node: 'truck', part: 'roda_1', channel: 'rotation', interpolation: 'linear', keys: keys([0, 0, 0], [12, 0, 0]) },
];

describe('rotating named parts inside an imported GLB', () => {
  it('registers the five generated models under reviewed, same-origin IDs', () => {
    for (const id of ['money-pallet-v1', 'armored-truck-v1', 'giant-safe-v1', 'money-bag-v1', 'giant-coin-v1'] as const)
      expect(approvedModel(id)?.url).toMatch(/^\/models\/[a-z0-9_]+\.glb$/);
  });
  it('validates part tracks: model nodes and rotation only, no duplicates', () => {
    expect(normalizeSceneProgram(plan(doorTracks()), source).tracks[0].part).toBe('volante');
    const bad = (t: unknown[]) => () => normalizeSceneProgram(plan(t), source);
    expect(bad([{ node: 'safe', part: 'porta', channel: 'position', keys: keys([0, 0, 0], [1, 0, 0]) }])).toThrow(/peça interna/);
    expect(bad([{ node: 'safe', part: '../x', channel: 'rotation', keys: keys([0, 0, 0], [0, 1, 0]) }])).toThrow(/nome da peça/);
    expect(bad([{ node: 'safe', part: 'porta', channel: 'rotation', keys: keys([0, 0, 0], [0, 1, 0]) },
      { node: 'safe', part: 'porta', channel: 'rotation', keys: keys([0, 0, 0], [0, 2, 0]) }])).toThrow(/duplicar/);
    // A part track may coexist with a whole-model rotation track.
    expect(bad([{ node: 'safe', part: 'porta', channel: 'rotation', keys: keys([0, 0, 0], [0, 1, 0]) },
      { node: 'safe', channel: 'rotation', keys: keys([0, 0, 0], [0, 1, 0]) }])).not.toThrow();
  });
  it('a motion check on a part needs a track for that very part', () => {
    const check = (part?: string) => () => normalizeSceneProgram(plan(doorTracks(), { motionChecks: [
      { sourceId: 's1', node: 'safe', channel: 'rotation', part, kind: 'change', startPhase: 0, endPhase: 1, threshold: 1 }] }), source);
    expect(check('porta')).not.toThrow();
    expect(check('dobradica_1')).toThrow(/sem animar/);
    expect(check(undefined)).toThrow(/sem animar/);
  });
  it('turns only the rotation of the named nodes, keeping their authored pivots, and is seekable', async () => {
    const [safe, truck] = await Promise.all([load('giant-safe-v1'), load('armored-truck-v1')]);
    const program = normalizeSceneProgram(plan(doorTracks()), source);
    const stage = new SceneProgram3D(program, source, new Map<ApprovedModelId, PreparedModel>([['giant-safe-v1', safe], ['armored-truck-v1', truck]]));
    try {
      const part = (n: string, p: string) => stage.nodes.get(n)!.getObjectByName(p)!;
      stage.update(0);
      const pivot = { porta: part('safe', 'porta').position.toArray(), roda: part('truck', 'roda_1').position.toArray(), tras: part('truck', 'porta_traseira').position.toArray() };
      expect(pivot.porta).toEqual([0.76, 1.05, 0.8]);
      expect(pivot.tras[2]).toBeCloseTo(-2.93);
      stage.update(4);
      expect(part('safe', 'porta').rotation.y).toBeCloseTo(2.0);
      expect(part('safe', 'volante').rotation.z).toBeCloseTo(Math.PI * 2);
      expect(part('truck', 'porta_traseira').rotation.y).toBeCloseTo(2.09);
      expect(part('truck', 'roda_1').rotation.x).toBeCloseTo(12);
      expect(part('safe', 'porta').position.toArray()).toEqual(pivot.porta);
      expect(part('truck', 'roda_1').position.toArray()).toEqual(pivot.roda);
      // Opening direction: +Y turns the safe door toward +Z, the truck door toward -Z.
      stage.update(2); stage.scene.updateMatrixWorld(true);
      const zOf = (n: string, p: string, local: THREE.Vector3) => part(n, p).localToWorld(local.clone()).z - stage.nodes.get(n)!.position.z;
      expect(zOf('safe', 'porta', new THREE.Vector3(-0.76, 0, 0))).toBeGreaterThan(zOf('safe', 'porta', new THREE.Vector3(0, 0, 0)) + .3);
      expect(zOf('truck', 'porta_traseira', new THREE.Vector3(1.36, 0, 0))).toBeLessThan(zOf('truck', 'porta_traseira', new THREE.Vector3(0, 0, 0)) - .3);
      // Scrubbing back and forth reproduces identical angles.
      stage.update(1.3); const a = part('safe', 'porta').rotation.y; stage.update(3.9); stage.update(1.3);
      expect(part('safe', 'porta').rotation.y).toBe(a);
      stage.update(0); expect(part('safe', 'porta').rotation.y).toBeCloseTo(0);
    } finally { stage.dispose(); }
  });
  it('fails loudly when the GLB has no part with the requested name', async () => {
    const safe = await load('giant-safe-v1');
    const program = normalizeSceneProgram({
      ...plan([{ node: 'safe', part: 'asa', channel: 'rotation', keys: keys([0, 0, 0], [0, 1, 0]) }]),
      nodes: [{ id: 'safe', kind: 'model', contextSourceId: 's1', assetId: 'giant-safe-v1' }],
      shots: [{ sourceId: 's1', subjects: ['safe'] }],
    }, source);
    expect(() => new SceneProgram3D(program, source, new Map([['giant-safe-v1', safe]]))).toThrow(/peça interna "asa"/);
  });
});
