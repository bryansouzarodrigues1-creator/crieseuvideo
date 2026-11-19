/**
 * Offline 12-second engineering assembly test for the actual SceneProgram3D motor.
 *
 * All components are one persistent scene graph. Nothing is spawned or removed
 * between chapters; the battery, chip and lenses remain in their sockets after
 * installation. Used only when the user explicitly requests the local demo.
 * This fixture is not an AI response, a general smartphone generator or a preset.
 */
import {
  normalizeSceneProgram,
  compileSceneProgram,
  type ProgramGeometry,
  type ProgramSource,
  type Vec3,
} from '../score';
import type { ComplexWorldClip } from '../planner/complexWorldBatch';

const duration = 12;
export const SMARTPHONE_DEMO_SCRIPT = [
  'A estrutura do celular recebe a bateria, que desliza até o encaixe e permanece instalada.',
  'O processador e as lentes da câmera são colocados em seus pontos de montagem.',
  'Por fim, a tela desliza sobre os componentes e fecha o aparelho.',
].join(' ');

const SOURCES: ProgramSource[] = [
  { sourceId: 's1', text: 'A estrutura do celular recebe a bateria, que desliza até o encaixe e permanece instalada.', duration: 4 },
  { sourceId: 's2', text: 'O processador e as lentes da câmera são colocados em seus pontos de montagem.', duration: 4 },
  { sourceId: 's3', text: 'Por fim, a tela desliza sobre os componentes e fecha o aparelho.', duration: 4 },
];

type SourceId = 's1' | 's2' | 's3';
type Material = { roughness?: number; metalness?: number; opacity?: number; emissive?: string; emissiveIntensity?: number };
type Node = Record<string, unknown>;
const V = (x: number, y: number, z: number): Vec3 => [x, y, z];
const key = (sourceId: SourceId, phase: number, value: Vec3) => ({ sourceId, phase, value });

/** Builds an independent, validated scene, leaving all current project state alone. */
export function buildSmartphoneAssemblyDemo(): ComplexWorldClip {
  const nodes: Node[] = [];
  const addGroup = (id: string, position: Vec3, parent?: string, sourceId: SourceId = 's1') => {
    nodes.push({ id, kind: 'group', position, ...(parent ? { parent } : {}), contextSourceId: sourceId });
  };
  const addMesh = (
    id: string, parent: string | undefined, position: Vec3, size: Vec3,
    color: string, sourceId: SourceId = 's1', options: {
      bevel?: number; material?: Material; geometry?: ProgramGeometry; rotation?: Vec3;
      repeat?: { count: number; step: Vec3; jitter: Vec3; seed: number };
    } = {}
  ) => {
    const geometry: ProgramGeometry = options.geometry ?? {
      shape: 'box', size, ...(options.bevel ? { bevel: options.bevel, bevelSegments: 3 } : {})
    };
    nodes.push({
      id, kind: 'mesh', position, ...(parent ? { parent } : {}), color,
      geometry, contextSourceId: sourceId,
      ...(options.rotation ? { rotation: options.rotation } : {}),
      ...(options.material ? { material: options.material } : {}),
      ...(options.repeat ? { repeat: options.repeat } : {}),
    });
  };

  // The same chassis survives for the whole film; all parts have their own roots.
  addMesh('floor', undefined, V(0, -0.26, 0), V(9, .32, 7), '#3d485b');
  addMesh('assembly-pad', undefined, V(0, -.075, 0), V(4.8, .08, 3.0), '#667589', 's1', { bevel: .04 });
  addGroup('phone', V(0, 0, 0));
  addMesh('chassis', 'phone', V(0, 3.1, 0), V(2.70, 5.35, .34), '#252c3b', 's1', { bevel: .13 });
  addMesh('inner-bay', 'phone', V(0, 3.10, .185), V(2.42, 5.03, .035), '#174e40', 's1', { bevel: .012 });
  addMesh('board', 'phone', V(.52, 4.10, .235), V(.95, 1.64, .08), '#11623f', 's2', { bevel: .03 });
  addMesh('trace-a', 'phone', V(.48, 4.58, .291), V(.045, .70, .015), '#cfac64', 's2');
  addMesh('trace-b', 'phone', V(.72, 4.26, .291), V(.49, .035, .015), '#cfac64', 's2');
  addMesh('trace-c', 'phone', V(.25, 3.86, .291), V(.38, .035, .015), '#cfac64', 's2');
  addMesh('power-connector', 'phone', V(-.25, 4.0, .26), V(.35, .16, .12), '#dbb75c', 's1');
  addMesh('bottom-speaker', 'phone', V(0, .77, .26), V(.78, .12, .08), '#1a202a', 's3');
  addMesh('speaker-grille', 'phone', V(-.30, .77, .32), V(.025, .06, .025), '#a7b3c7', 's3', {
    repeat: { count: 11, step: V(.06, 0, 0), jitter: V(0, 0, 0), seed: 2 }
  });

  addGroup('battery', V(-1.32, 2.50, 1.28), 'phone', 's1');
  addMesh('battery-cell', 'battery', V(0, 0, 0), V(1.32, 2.47, .18), '#222b38', 's1', { bevel: .06 });
  addMesh('battery-label', 'battery', V(0, .10, .098), V(.92, 1.80, .015), '#6fa4bc', 's1', { bevel: .006 });
  addMesh('battery-band', 'battery', V(0, -.72, .11), V(.93, .13, .016), '#f1c06a', 's1');
  addMesh('battery-tab', 'battery', V(.26, 1.30, -.01), V(.33, .19, .085), '#d5b25e', 's1');

  addGroup('processor', V(1.35, 4.25, 1.30), 'phone', 's2');
  addMesh('processor-body', 'processor', V(0, 0, 0), V(.71, .74, .13), '#0d223e', 's2', { bevel: .035 });
  addMesh('processor-die', 'processor', V(0, 0, .078), V(.46, .46, .025), '#4a9ebb', 's2', {
    material: { emissive: '#124469', emissiveIntensity: .30 }
  });
  addMesh('chip-pin-left', 'processor', V(-.39, -.29, 0), V(.09, .07, .09), '#e5c77e', 's2', {
    repeat: { count: 8, step: V(0, .082, 0), jitter: V(0, 0, 0), seed: 3 }
  });
  addMesh('chip-pin-right', 'processor', V(.39, -.29, 0), V(.09, .07, .09), '#e5c77e', 's2', {
    repeat: { count: 8, step: V(0, .082, 0), jitter: V(0, 0, 0), seed: 4 }
  });

  addGroup('camera', V(-1.42, 4.96, 1.35), 'phone', 's2');
  addMesh('camera-housing', 'camera', V(0, 0, 0), V(.78, .85, .20), '#12192a', 's2', { bevel: .09 });
  for (let i = 0; i < 3; i++) {
    const cx = i === 2 ? -.22 : .22, cy = i === 0 ? .23 : i === 1 ? -.21 : 0;
    addMesh('camera-lens-' + i, 'camera', V(cx, cy, .135), V(.19, .19, .19), '#8cc6e3', 's2', {
      geometry: { shape: 'cylinder', size: [.19, .19, .13] }, rotation: V(Math.PI / 2, 0, 0),
      material: { emissive: '#12415c', emissiveIntensity: .20 }
    });
    addMesh('camera-core-' + i, 'camera', V(cx, cy, .21), V(.11, .11, .015), '#101e32', 's2', {
      geometry: { shape: 'cylinder', size: [.11, .11, .025] }, rotation: V(Math.PI / 2, 0, 0)
    });
  }

  // Display waits to the side until the last act, then covers the installed parts.
  addGroup('display', V(3.15, 3.10, 1.16), 'phone', 's3');
  addMesh('display-glass', 'display', V(0, 0, 0), V(2.50, 5.15, .085), '#11192c', 's3', { bevel: .04 });
  addMesh('display-panel', 'display', V(0, 0, .049), V(2.32, 4.95, .012), '#236599', 's3', {
    material: { emissive: '#0f3959', emissiveIntensity: .45, opacity: .96 }
  });
  addMesh('display-highlight', 'display', V(0, 1.35, .061), V(1.83, .12, .008), '#9edcff', 's3', {
    material: { emissive: '#55b9e8', emissiveIntensity: .65, opacity: .65 }
  });
  addMesh('front-camera', 'display', V(0, 2.32, .07), V(.07, .07, .018), '#0d1727', 's3', {
    geometry: { shape: 'sphere', size: [.075] }
  });

  const tracks = [
    {
      node: 'battery', channel: 'position', interpolation: 'smooth',
      keys: [key('s1', 0, V(-1.32, 2.50, 1.28)), key('s1', .86, V(-.28, 2.48, .38)), key('s3', 1, V(-.28, 2.48, .38))]
    },
    {
      node: 'processor', channel: 'position', interpolation: 'smooth',
      keys: [key('s1', 0, V(1.35, 4.25, 1.30)), key('s2', .2, V(1.35, 4.25, 1.30)), key('s2', .76, V(.54, 4.20, .38)), key('s3', 1, V(.54, 4.20, .38))]
    },
    {
      node: 'camera', channel: 'position', interpolation: 'smooth',
      keys: [key('s1', 0, V(-1.42, 4.96, 1.35)), key('s2', .45, V(-1.42, 4.96, 1.35)), key('s2', .96, V(-.76, 4.92, .45)), key('s3', 1, V(-.76, 4.92, .45))]
    },
    {
      node: 'display', channel: 'position', interpolation: 'smooth',
      keys: [key('s1', 0, V(3.15, 3.10, 1.16)), key('s3', .14, V(3.15, 3.10, 1.16)), key('s3', .94, V(0, 3.10, .68)), key('s3', 1, V(0, 3.10, .68))]
    }
  ];

  const program = normalizeSceneProgram({
    version: 1, background: '#b4cbdc', nodes, tracks,
    shots: [
      { sourceId: 's1', subjects: ['chassis'], azimuth: .14, endAzimuth: .08, elevation: .14, distance: 1.19 },
      { sourceId: 's2', subjects: ['chassis'], azimuth: .08, endAzimuth: -.12, elevation: .12, distance: 1.15 },
      { sourceId: 's3', subjects: ['chassis'], azimuth: -.12, endAzimuth: .06, elevation: .10, distance: 1.18 }
    ],
    contacts: [],
    motionChecks: [
      { sourceId: 's1', node: 'battery', channel: 'position', kind: 'change', startPhase: 0, endPhase: .95, threshold: .9 },
      { sourceId: 's2', node: 'battery', channel: 'position', kind: 'hold', startPhase: 0, endPhase: 1, threshold: .01 },
      { sourceId: 's2', node: 'processor', channel: 'position', kind: 'change', startPhase: .15, endPhase: .85, threshold: .7 },
      { sourceId: 's2', node: 'camera', channel: 'position', kind: 'change', startPhase: .40, endPhase: 1, threshold: .7 },
      { sourceId: 's3', node: 'display', channel: 'position', kind: 'change', startPhase: .15, endPhase: .98, threshold: 2.5 }
    ],
  }, SOURCES);

  // Run the same compiler used for AI-authored clips; fail fast on invalid curves.
  compileSceneProgram(program, SOURCES);
  return {
    id: 'smartphone-demo', sources: SOURCES, duration, program,
    audit: { objectCount: 5, objectParts: nodes.filter(n => n.kind === 'mesh').length,
      sceneryRegions: 1, sceneNodes: program.nodes.length, shotCount: program.shots.length,
      estimatedVertexLimit: 250000 },
  };
}
