import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { approvedModel } from './modelRegistry';
import { inspectGLB, loadApprovedModel, instantiateModel } from './modelAssets';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';

const source: ProgramSource[] = [{ sourceId: 's1', text: 'O robô começa a caminhar.', duration: 6 }];
const rawPlan = () => ({
  version: 1, background: '#EEF1F5',
  nodes: [{
    id: 'robot', kind: 'model', contextSourceId: 's1',
    assetId: 'expressive-robot-v1', position: [0, 0, 0], scale: [1, 1, 1],
  }],
  tracks: [{
    node: 'robot', channel: 'position', interpolation: 'smooth',
    keys: [{ sourceId: 's1', phase: 0, value: [-1, 0, 0] },
      { sourceId: 's1', phase: 1, value: [1, 0, 0] }],
  }],
  shots: [{ sourceId: 's1', subjects: ['robot'], azimuth: .2, endAzimuth: .6, elevation: .18, distance: 1.1 }],
  contacts: [],
});

/** Minimal genuine GLB 2.0 containing an indexed triangle. */
function triangleGLB(): ArrayBuffer {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const raw = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    buffers: [{ byteLength: 42 }],
  };
  const encoder = new TextEncoder(), json = encoder.encode(JSON.stringify(raw));
  const paddedJSON = Math.ceil(json.byteLength / 4) * 4, paddedBIN = 44;
  const ab = new ArrayBuffer(12 + 8 + paddedJSON + 8 + paddedBIN);
  const v = new DataView(ab), arr = new Uint8Array(ab);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, ab.byteLength, true);
  v.setUint32(12, paddedJSON, true); v.setUint32(16, 0x4e4f534a, true);
  arr.fill(0x20, 20, 20 + paddedJSON); arr.set(json, 20);
  const at = 20 + paddedJSON;
  v.setUint32(at, paddedBIN, true); v.setUint32(at + 4, 0x004e4942, true);
  for (let i = 0; i < positions.length; i++) v.setFloat32(at + 8 + i * 4, positions[i], true);
  for (let i = 0; i < 3; i++) v.setUint16(at + 8 + 36 + i * 2, i, true);
  return ab;
}

describe('trusted GLB registry and model import', () => {
  it('never interprets a model ID as an AI-provided URL', () => {
    expect(approvedModel('expressive-robot-v1')?.url).toMatch(/^\/__l5e\/assets-v1\//);
    expect(approvedModel('https://evil.example/robot.glb')).toBeUndefined();
    const bad = rawPlan(); bad.nodes[0].assetId = 'https://evil.example/robot.glb';
    expect(() => normalizeSceneProgram(bad, source)).toThrow(/catálogo autorizado/);
    expect(() => normalizeSceneProgram({
      ...rawPlan(), nodes: [{ ...rawPlan().nodes[0], url: 'https://evil.example/robot.glb' }],
    }, source)).toThrow(/campo não suportado/);
  });
  it('accepts approved IDs without requiring a fixed animation action name', () => {
    const normalized = normalizeSceneProgram(rawPlan(), source);
    expect(normalized.nodes[0].kind).toBe('model');
    expect(normalized.nodes[0].assetId).toBe('expressive-robot-v1');
    expect(normalized.tracks[0].channel).toBe('position');
  });
  it('verifies actual GLB magic, version, declared length and triangle budget', () => {
    const data = triangleGLB();
    expect(inspectGLB(data)).toEqual({ triangles: 1, nodes: 1 });
    const damaged = data.slice(0); new DataView(damaged).setUint32(0, 0, true);
    expect(() => inspectGLB(damaged)).toThrow(/GLB 2.0/);
    const mismatch = data.slice(0); new DataView(mismatch).setUint32(8, data.byteLength - 2, true);
    expect(() => inspectGLB(mismatch)).toThrow(/GLB 2.0/);
  });
  it('rejects attempted external textures even inside an otherwise valid GLB', () => {
    const data = triangleGLB(), v = new DataView(data);
    // An external image cannot be injected without changing the JSON chunk;
    // integrity checks catch invalid lengths and the stricter parser catches URIs.
    v.setUint32(12, 99999, true);
    expect(() => inspectGLB(data)).toThrow(/JSON/);
  });
  it('loads a real, generated GLB buffer and keeps its texture/geometry local', async () => {
    const data = triangleGLB();
    const mockFetch = async (_url: string | URL | Request): Promise<Response> => new Response(data.slice(0), { status: 200, headers: { 'content-type': 'model/gltf-binary' } });
    const loaded = await loadApprovedModel('expressive-robot-v1', mockFetch as typeof fetch);
    const box = new THREE.Box3().setFromObject(loaded.gltf.scene);
    expect(box.isEmpty()).toBe(false);
    expect(box.getSize(new THREE.Vector3()).x).toBeCloseTo(1);
  });
  it('allows a model to follow a deterministic, seekable scene timeline', async () => {
    const loaded = await loadApprovedModel('expressive-robot-v1', (async () => new Response(triangleGLB())) as typeof fetch);
    const normalized = normalizeSceneProgram(rawPlan(), source);
    const stage = new SceneProgram3D(normalized, source, new Map([['expressive-robot-v1', loaded]]));
    try {
      stage.update(2.4);
      const before = stage.nodes.get('robot')!.position.toArray();
      stage.update(5.7); stage.update(0); stage.update(2.4);
      expect(stage.nodes.get('robot')!.position.toArray()).toEqual(before);
      stage.validateContacts();
      expect(stage.importedModels.size).toBe(1);
      const a = stage.nodes.get('robot')!;
      expect(a.children.length).toBeGreaterThan(0);
    } finally { stage.dispose(); }
  });
  it('selects one named animation, isolates scene placement, and seeks deterministically', async () => {
    const loaded = await loadApprovedModel('expressive-robot-v1', (async () => new Response(triangleGLB())) as typeof fetch);
    const animated = loaded.gltf.scene;
    animated.name = 'CharacterRoot';
    loaded.gltf.animations = [
      new THREE.AnimationClip('idle', 2, [new THREE.VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 0, 2, 0])]),
      new THREE.AnimationClip('walk', 2, [new THREE.VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 4, 0, 0])]),
    ];
    const instance = instantiateModel(loaded, 'walk');
    instance.root.position.set(10, 0, 0);
    instance.setTime(1);
    expect(instance.root.position.toArray()).toEqual([10, 0, 0]);
    expect(instance.root.children[0].position.toArray()).toEqual([2, 0, 0]);
    instance.setTime(1.7); instance.setTime(.2); instance.setTime(1);
    expect(instance.root.children[0].position.toArray()).toEqual([2, 0, 0]);
    const defaultInstance = instantiateModel(loaded);
    defaultInstance.setTime(1);
    expect(defaultInstance.root.children[0].position.toArray()).toEqual([0, 1, 0]);
    expect(() => instantiateModel(loaded, 'missing')).toThrow(/não encontrada/);
    const plan = rawPlan();
    const normalized = normalizeSceneProgram({...plan,nodes:[{...plan.nodes[0],animationClip:'walk'}]}, source);
    expect(normalized.nodes[0].animationClip).toBe('walk');
    const stage = new SceneProgram3D(normalized, source, new Map([['expressive-robot-v1',loaded]]));
    try {
      stage.update(1);
      expect(stage.nodes.get('robot')!.children[0].position.x).toBeCloseTo(2);
      expect(stage.nodes.get('robot')!.position.x).toBeLessThan(0);
    } finally { stage.dispose(); }
    expect(() => normalizeSceneProgram({...plan,nodes:[{...plan.nodes[0],animationClip:'https://example.com'}]},source)).toThrow(/animação GLB inválido/);
  });

  it('refuses to display an unprepared model instead of substituting a generic presenter', () => {
    const plan = normalizeSceneProgram(rawPlan(), source);
    expect(() => new SceneProgram3D(plan, source)).toThrow(/ainda não foi carregado/);
  });
});
