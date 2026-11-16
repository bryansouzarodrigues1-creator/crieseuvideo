import { describe, expect, it } from 'vitest';
import { LatheGeometry, Mesh } from 'three';
import { normalizeSceneProgram, type ProgramSource } from './score';
import { SceneProgram3D } from './stage3d';

const sources: ProgramSource[] = [{
  sourceId: 's1',
  text: 'O liquidificador gira e revela o recipiente de vidro.',
  duration: 5,
}];

const program = () => ({
  version: 1,
  background: '#D5E7E9',
  nodes: [
    {
      id: 'blender-base', kind: 'mesh', contextSourceId: 's1',
      position: [0, .1, 0], color: '#30445A',
      geometry: { shape: 'box', size: [1.2, .35, 1.1] },
    },
    {
      id: 'blender-jar', kind: 'mesh', contextSourceId: 's1',
      position: [0, .45, 0], color: '#C6E9F7',
      geometry: {
        shape: 'lathe', segments: 32,
        profile: [[0, 0], [.37, 0], [.43, .16], [.55, .88], [.58, 1.05]],
      },
      material: { roughness: .12, metalness: .05, opacity: .55, emissive: '#000000', emissiveIntensity: 0 },
    },
    {
      id: 'lid', kind: 'mesh', contextSourceId: 's1',
      position: [0, 1.53, 0], color: '#3C4F61',
      geometry: { shape: 'cylinder', size: [.62, .62, .12] },
    },
  ],
  tracks: [{
    node: 'blender-jar', channel: 'rotation', interpolation: 'linear',
    keys: [
      { sourceId: 's1', phase: 0, value: [0, 0, 0] },
      { sourceId: 's1', phase: 1, value: [0, 6, 0] },
    ],
  }],
  shots: [{ sourceId: 's1', subjects: ['blender-base', 'blender-jar'], azimuth: .3, endAzimuth: .9, elevation: .22, distance: 1.5 }],
  contacts: [],
});

describe('AI-authored generic procedural surfaces', () => {
  it('creates an actual new 3D liquidizer vessel as a Three.js LatheGeometry', () => {
    const normalized = normalizeSceneProgram(program(), sources);
    const meshNode = normalized.nodes.find((n) => n.id === 'blender-jar')!;
    expect(meshNode.geometry?.shape).toBe('lathe');
    expect(meshNode.geometry?.profile).toHaveLength(5);
    expect(meshNode.evidence).toBe(sources[0].text);
    const stage = new SceneProgram3D(normalized, sources);
    try {
      const obj = stage.nodes.get('blender-jar') as Mesh;
      expect(obj).toBeInstanceOf(Mesh);
      expect(obj.geometry).toBeInstanceOf(LatheGeometry);
      expect(obj.geometry.getAttribute('position').count).toBe(5 * 33);
      obj.geometry.computeBoundingBox();
      expect(obj.geometry.boundingBox!.max.y).toBeCloseTo(1.05, 4);
      stage.update(2.5);
      expect(obj.rotation.y).toBeGreaterThan(2);
      stage.update(0);
      expect(obj.rotation.y).toBeCloseTo(0);
    } finally {
      stage.dispose();
    }
  });

  it('accepts a different object shape without adding it to any thematic catalogue', () => {
    const raw = program();
    raw.nodes[1]!.geometry.profile = [[0, 0], [.10, .05], [.30, .22], [.20, .65], [.03, .82]];
    const out = normalizeSceneProgram(raw, sources);
    expect(out.nodes.find((n) => n.id === 'blender-jar')?.geometry?.profile).toEqual(raw.nodes[1]!.geometry.profile);
  });

  const rejects = (modify: (raw: ReturnType<typeof program>) => void) => {
    const raw = program();
    modify(raw);
    expect(() => normalizeSceneProgram(raw, sources)).toThrow();
  };

  it('rejects negative radii and non-finite values', () => {
    rejects((p) => { p.nodes[1]!.geometry.profile![1]![0] = -1; });
    rejects((p) => { p.nodes[1]!.geometry.profile![1]![1] = Number.NaN; });
  });

  it('rejects extremely dense or fractional geometry with a bounded vertex budget', () => {
    rejects((p) => { p.nodes[1]!.geometry.segments = 6500; });
    rejects((p) => { p.nodes[1]!.geometry.segments = 8.5; });
    rejects((p) => { p.nodes[1]!.geometry.profile = Array.from({ length: 100 }, (_, i) => [i / 100, i / 2]); });
  });

  it('rejects degenerate profiles and repeated identical adjacent points', () => {
    rejects((p) => { p.nodes[1]!.geometry.profile = [[0, 0], [0, 0]]; });
    rejects((p) => { p.nodes[1]!.geometry.profile = [[.5, 0], [.5, 0], [.5, 1]]; });
  });

  it('rejects untrusted executable fields instead of executing AI-generated code', () => {
    const raw = JSON.parse(JSON.stringify(program()));
    raw.nodes[1].geometry.javascript = 'alert(1)';
    expect(() => normalizeSceneProgram(raw, sources)).toThrow(/campo não suportado/);
    delete raw.nodes[1].geometry.javascript;
    raw.nodes[1].geometry.shader = 'externally-fetched-shader';
    expect(() => normalizeSceneProgram(raw, sources)).toThrow(/campo não suportado/);
  });

  it('preserves exact geometry and produces identical transforms after seeking', () => {
    const normalized = normalizeSceneProgram(program(), sources);
    const before = JSON.stringify(normalized);
    const stage = new SceneProgram3D(normalized, sources);
    try {
      stage.update(1.2);
      const first = stage.nodes.get('blender-jar')!.rotation.y;
      stage.update(4.9);
      stage.update(1.2);
      expect(stage.nodes.get('blender-jar')!.rotation.y).toBe(first);
      expect(JSON.stringify(normalized)).toBe(before);
    } finally { stage.dispose(); }
  });
});
