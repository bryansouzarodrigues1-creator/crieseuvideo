import { normalizeSceneProgram, type ProgramSource } from './score';

/**
 * Authored QA scene - never used as a response to a user's arbitrary prompt.
 * Character: opt-in local Patrick preset. Scenario: investigative workbench.
 * Demonstrates a physical target and independently seekable joint animation.
 */
export function patrickPilotScene() {
  const sources: ProgramSource[] = [{
    sourceId: 's1',
    text: 'Patrick observa um livro misterioso na bancada, toca a capa e percebe uma pista.',
    duration: 8,
  }];
  const nodes = [
    { id: 'floor', kind: 'mesh', geometry: { shape: 'box', size: [18,.20,18] }, color: '#687c85', position: [0,-.17,0] },
    { id: 'wall', kind: 'mesh', geometry: { shape: 'box', size: [8,3.6,.2] }, color: '#9dabb4', position: [0,1.7,-2.0] },
    { id: 'workbench', kind: 'mesh', geometry: { shape: 'box', size: [1.05,.15,.80] }, color: '#86664c', position: [.99,.83,.35] },
    { id: 'workbench-leg', kind: 'mesh', geometry: { shape: 'box', size: [.12,.74,.12] }, color: '#5d493f', position: [1.30,.38,.51] },
    { id: 'book', kind: 'mesh', geometry: { shape: 'box', size: [.36,.075,.28] }, color: '#4c526f', position: [.64,.98,.32] },
    { id: 'book-label', kind: 'mesh', parent: 'book', geometry: { shape: 'box', size: [.22,.008,.14] }, color: '#d3b87a', position: [0,.051,0] },
    { id: 'patrick', kind: 'actor', actorPreset: 'patrick-mentalista-v1', color: '#34496d', position: [0,0,0] },
  ].map((n) => ({ ...n, contextSourceId: 's1' }));
  const track = (node: string, channel: string, values: Array<[number, [number,number,number]]>) => ({
    node, channel, interpolation: 'smooth',
    keys: values.map(([phase, value]) => ({ sourceId: 's1', phase, value })),
  });
  const tracks = [
    track('patrick', 'headRotation', [[0,[0,.03,0]],[.35,[.17,.21,0]],[.7,[.14,.08,0]],[1,[-.05,-.08,0]]]),
    track('patrick', 'face', [[0,[.1,0,.05]],[.42,[.15,0,.06]],[.78,[.7,0,.14]],[1,[.65,0,.12]]]),
    track('patrick', 'rightHand', [[0,[.47,.77,.12]],[.38,[.64,1.05,.32]],[.69,[.64,1.01,.32]],[1,[.48,1.22,.24]]]),
    track('patrick', 'leftHand', [[0,[-.43,.78,.1]],[.6,[-.42,.82,.14]],[1,[-.29,1.24,.22]]]),
    track('book', 'rotation', [[0,[0,0,0]],[.62,[0,0,0]],[.85,[0,.2,0]],[1,[0,.2,0]]]),
  ];
  const raw = {
    version: 1,
    background: '#aebdc5',
    nodes, tracks,
    shots: [{ sourceId: 's1', subjects: ['patrick','book'], azimuth: .25, endAzimuth: -.1, elevation: .15, distance: 1.25 }],
    contacts: [{
      sourceId: 's1', actor: 'patrick', effector: 'rightHand', target: 'book',
      offset: [0,.05,0], begin: .42, end: .7,
    }],
  };
  return { sources, program: normalizeSceneProgram(raw, sources) };
}
