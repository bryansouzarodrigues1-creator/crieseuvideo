/** Developer-authored render fixtures, NOT model output or app fallbacks.
 * The renderer/director never imports this module. Every fixture uses the same
 * public graph contract; none adds a theme/action implementation to the engine. */
import type { Vec3 } from './score';

function author(script: string, background: string) {
  const nodes: any[] = [], tracks: any[] = [], contacts: any[] = [];
  const add = (id: string, kind: string, position: Vec3, more: Record<string, any> = {}) => { nodes.push({ id, kind, position, evidence: script, ...more }); return id; };
  const shape = (id: string, kind: string, size: number[], color: string, position: Vec3, more: Record<string, any> = {}) => add(id, 'mesh', position, { geometry: { shape: kind, size }, color, ...more });
  const curve = (node: string, channel: string, points: [number, Vec3][], interpolation = 'smooth') => tracks.push({ node, channel, interpolation, keys: points.map(([phase, value]) => ({ sourceId: 's1', phase, value })) });
  const shot = (subjects: string[], azimuth: number, endAzimuth: number, elevation = .18, distance = 1.15) => ({ sourceId: 's1', subjects, azimuth, endAzimuth, elevation, distance });
  const result = (title: string, shots: any[], duration: number) => ({ id: title, script, duration, response: { title, scenes: [{ sourceId: 's1', visual: 'character', mood: 'neutral', palette: 'teal' }], sceneProgram: { version: 1, background, nodes, tracks, shots, contacts } } });
  return { add, shape, curve, shot, result, nodes, contacts };
}

function climbing() {
  const a = author('Ele conseguiu escalar o monte Everest mas...', '#B6D7EA');
  a.shape('rock', 'box', [4.7, 10, 2.4], '#8999AD', [0, 2.1, -1.55]);
  a.add('snow-face', 'mesh', [0, 0, 0], { color: '#EFF5F3', geometry: { shape: 'mesh', vertices: [-2.35, 7.15, -.30, 2.35, 7.15, -.30, 2.35, 4.9, -.30, .8, 5.7, -.30, -.1, 4.8, -.30, -1.2, 5.6, -.30, -2.35, 5.1, -.30], indices: [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6] } });
  for (let i = 0; i < 8; i++) {
    const x = i % 2 ? -.28 : .28, y = 1.28 + Math.floor(i / 2) * .28;
    a.shape(`ledge-${i}`, 'box', [.78, .14, .36], i % 2 ? '#D4E0E4' : '#DDE8EB', [x, y, -.30]);
  }
  for (const [i, x, y, z, radius] of [[0, -6, 4, -9, 4], [1, 7, 5, -12, 5], [2, -11, 3, -17, 6], [3, 13, 3, -20, 7]]) {
    a.shape(`peak-${i}`, 'cone', [radius, y * 3], '#7A94AB', [x, y - 4, z]);
    a.shape(`cap-${i}`, 'cone', [radius * .47, y * 1.42], '#ECF5F8', [x, y * 1.82 - 4, z]);
  }
  a.shape('snow-specks', 'sphere', [.026], '#FFFFFF', [0, 4, 2], { repeat: { count: 120, step: [0, 0, 0], jitter: [17, 13, 6], seed: 37 } });
  a.curve('snow-specks', 'position', [[0, [0, 5, 2]], [1, [.8, 1.2, 2]]], 'linear');
  a.add('climber', 'actor', [0, .8, 0], { rotation: [0, Math.PI, 0], color: '#DF6B35' });
  a.shape('helmet', 'cone', [.36, .19], '#F2BD42', [0, .29, -.012], { parent: 'climber', socket: 'head', scale: [1.02, 1, 1.03] });
  a.shape('helmet-band', 'cylinder', [.36, .36, .08], '#F2BD42', [0, .19, -.012], { parent: 'climber', socket: 'head' });
  a.shape('pack', 'box', [.52, .61, .28], '#314C63', [0, 1.24, -.33], { parent: 'climber' });
  a.curve('climber', 'position', [[0, [0, .8, 0]], [.06, [0, .8, 0]], [.94, [0, 1.92, 0]], [1, [0, 1.92, 0]]], 'linear');
  a.curve('climber', 'bodyRotation', [[0, [.12, 0, -.04]], [.25, [.18, 0, .04]], [.5, [.12, 0, -.04]], [.75, [.18, 0, .04]], [1, [.12, 0, -.04]]]);
  a.curve('climber', 'headRotation', [[0, [0, 0, 0]], [.80, [-.08, 0, 0]], [1, [-.08, -.7, 0]]]);
  const holds = (effector: string, x: number, initial: number, steps: [number, number][], z: number) => {
    const points: [number, Vec3][] = [[0, [x, initial, z]]]; let height = initial, previous = 0;
    for (const [begin, end] of steps) {
      points.push([begin, [x, height, z]]); a.contacts.push({ sourceId: 's1', actor: 'climber', effector, target: 'rock', offset: [x, height - 2.1, z + 1.55], begin: previous, end: begin });
      height += effector.endsWith('Hand') ? .38 : .28;
      points.push([(begin + end) / 2, [x + (x < 0 ? -.06 : .06), height - .08, z + .15]], [end, [x, height, z]]); previous = end;
    }
    if (previous < 1) { points.push([1, [x, height, z]]); a.contacts.push({ sourceId: 's1', actor: 'climber', effector, target: 'rock', offset: [x, height - 2.1, z + 1.55], begin: previous, end: 1 }); }
    a.curve('climber', effector, points);
  };
  holds('leftHand', .47, 2.44, [[.22, .30], [.62, .70]], -.27);
  holds('rightHand', -.47, 2.61, [[.40, .48], [.80, .88]], -.27);
  holds('leftFoot', .19, 1.42, [[.12, .20], [.44, .52], [.76, .84]], -.09);
  holds('rightFoot', -.19, 1.42, [[.28, .36], [.60, .68], [.90, .98]], -.09);
  return a.result('escalada-programa', [a.shot(['climber'], 1.10, .92, .16, 1.24)], 15);
}

function comet() {
  const a = author('O cometa cruza o céu e deixa uma cauda brilhante.', '#101A35');
  a.add('comet', 'group', [-3, -1, 0], { rotation: [0, 0, .75] });
  a.shape('nucleus', 'sphere', [.43], '#B8F1F0', [0, 0, 0], { parent: 'comet' });
  a.shape('hot-core', 'sphere', [.23], '#FFFFFF', [.12, .05, .29], { parent: 'comet' });
  for (let i = 0; i < 8; i++) a.shape(`trail-${i}`, 'cone', [.32 - i * .028, 1.05], i % 2 ? '#6ECED8' : '#9EE8EC', [-.45 - i * .24, -.03, -.03 * i], { parent: 'comet', rotation: [0, 0, Math.PI / 2], scale: [1, 1.5, .6] });
  a.shape('stars', 'sphere', [.027], '#DBE4FF', [0, 0, -6], { repeat: { count: 180, step: [0, 0, 0], jitter: [35, 35, 10], seed: 129 } });
  a.shape('planet', 'sphere', [1.7], '#514A88', [4, -4, -8]);
  a.shape('ring', 'torus', [2.3, .11], '#8581BA', [4, -4, -8], { rotation: [1.10, .3, .12] });
  a.curve('comet', 'position', [[0, [-3, -1, 0]], [.45, [-.2, 1, 0]], [1, [3.2, 2, 0]]], 'linear');
  a.curve('comet', 'rotation', [[0, [0, 0, .75]], [.5, [0, 0, .6]], [1, [0, 0, .4]]]);
  a.curve('nucleus', 'scale', [[0, [1, 1, 1]], [.5, [1.1, 1.1, 1.1]], [1, [1, 1, 1]]]);
  return a.result('cometa-programa', [a.shot(['comet'], .16, -.16, .1, 1.18)], 12);
}

function robot() {
  const a = author('O robô estica o braço e gira a engrenagem.', '#BACDD2');
  a.shape('floor', 'box', [30, .2, 30], '#879DA0', [0, -.12, 0]);
  a.add('robot', 'group', [-.9, .2, 0]);
  a.shape('base', 'cylinder', [.53, .67, .35], '#36586C', [0, 0, 0], { parent: 'robot' });
  a.shape('body', 'box', [.80, .95, .65], '#688D9E', [0, .65, 0], { parent: 'robot' });
  a.add('head', 'group', [0, 1.40, 0], { parent: 'robot' });
  a.shape('head-shell', 'box', [.77, .52, .64], '#D1DEE0', [0, 0, 0], { parent: 'head' });
  for (const side of [-1, 1]) a.shape(side < 0 ? 'eye-left' : 'eye-right', 'sphere', [.09], '#4CD4E4', [side * .19, .03, .335], { parent: 'head', scale: [1, .65, .45] });
  a.add('arm', 'group', [.43, 1.10, 0], { parent: 'robot' });
  a.shape('shoulder', 'cylinder', [.19, .19, .24], '#2D4C60', [0, 0, 0], { parent: 'arm', rotation: [Math.PI / 2, 0, 0] });
  a.shape('upper-arm', 'box', [.74, .24, .27], '#D5E0DE', [.38, 0, 0], { parent: 'arm' });
  a.add('extension', 'group', [.40, 0, 0], { parent: 'arm' });
  a.shape('piston', 'cylinder', [.075, .075, .91], '#607C8A', [.18, 0, 0], { parent: 'extension', rotation: [0, 0, Math.PI / 2] });
  a.shape('wrist', 'box', [.20, .38, .32], '#355569', [.68, 0, 0], { parent: 'extension' });
  a.add('gear', 'group', [.84, 0, .12], { parent: 'extension' });
  a.shape('gear-disc', 'torus', [.40, .14], '#E6BA5B', [0, 0, 0], { parent: 'gear' });
  a.shape('gear-hub', 'cylinder', [.14, .14, .20], '#526775', [0, 0, 0], { parent: 'gear', rotation: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; a.shape(`tooth-${i}`, 'box', [.15, .22, .19], '#E6BA5B', [.48 * Math.cos(angle), .48 * Math.sin(angle), 0], { parent: 'gear', rotation: [0, 0, angle - Math.PI / 2] }); }
  a.shape('back-wall', 'box', [18, 7, .4], '#A5BCC4', [0, 3, -5]);
  a.shape('beam', 'box', [.12, 5.8, .12], '#74939E', [-7, 2.8, -4.7], { repeat: { count: 9, step: [1.7, 0, 0], jitter: [0, 0, 0], seed: 1 } });
  a.curve('extension', 'position', [[0, [.40, 0, 0]], [.15, [.40, 0, 0]], [.52, [1.10, 0, 0]], [1, [1.10, 0, 0]]]);
  a.curve('gear', 'rotation', [[0, [0, 0, 0]], [.5, [0, 0, 0]], [1, [0, 0, Math.PI * 1.8]]], 'linear');
  a.curve('head', 'rotation', [[0, [0, -.12, 0]], [.50, [0, .23, -.05]], [1, [0, .23, -.05]]]);
  return a.result('robo-programa', [a.shot(['robot'], .45, .75, .2, 1.12)], 15);
}

export const sceneProgramFixtures = () => [climbing(), comet(), robot()];
