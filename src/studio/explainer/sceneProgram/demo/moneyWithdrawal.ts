/**
 * "E se o Elon Musk sacasse todo o dinheiro dele?" — 7 scenes in ONE persistent scene graph.
 *
 * Uses the five reviewed GLBs from /models (safe, bag, pallet, coin, armored truck), a code-built
 * generic actor (no likeness of any real person) and plain meshes (stock chart, rocket, certificates).
 * Doors, wheels and the safe wheel are driven by `part` rotation tracks on the model nodes.
 * Offline fixture: not an AI response and never sends a request.
 */
import { normalizeSceneProgram, compileSceneProgram, type ProgramSource, type Vec3 } from '../score';
import type { ComplexWorldClip } from '../planner/complexWorldBatch';

export const MONEY_WITHDRAWAL_SOURCES: ProgramSource[] = [
  { sourceId: 's1', text: 'E se o Elon Musk sacasse todo o dinheiro dele?', duration: 5 },
  { sourceId: 's2', text: 'Primeiro: ele não tem esse dinheiro na mão. A fortuna é quase toda ação.', duration: 8 },
  { sourceId: 's3', text: 'Se ele vendesse tudo da Tesla de uma vez, o preço despencaria.', duration: 8 },
  { sourceId: 's4', text: 'E a SpaceX nem tem ação na bolsa. Quem tem centenas de bilhões para comprar?', duration: 9 },
  { sourceId: 's5', text: 'Ainda sobra o imposto: dezenas de bilhões.', duration: 6 },
  { sourceId: 's6', text: 'Se fossem 800 bilhões em notas de cem, seriam mais de oito mil toneladas: uma fila de caminhões.', duration: 10 },
  { sourceId: 's7', text: 'Moral: sacar tudo faria ele ficar bem mais pobre.', duration: 6 },
];
export const MONEY_WITHDRAWAL_SCRIPT = MONEY_WITHDRAWAL_SOURCES.map((s) => s.text).join(' ');

type S = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';
type Node = Record<string, unknown>;
const V = (x: number, y: number, z: number): Vec3 => [x, y, z];
const k = (sourceId: S, phase: number, value: Vec3) => ({ sourceId, phase, value });
const HID = V(.01, .01, .01), ONE = V(1, 1, 1);
const TAU = Math.PI * 2;
const OPEN_SAFE = 2.0, OPEN_TRUCK = 2.09;

// Actor (generic, navy suit) stands front-right of the safe, turned slightly toward the camera.
const ACTOR_POS = V(2.5, 0, 1.9), ACTOR_YAW = -.55;
const world = (x: number, y: number, z: number): Vec3 => {
  const c = Math.cos(ACTOR_YAW), s = Math.sin(ACTOR_YAW);
  return V(ACTOR_POS[0] + x * c + z * s, y, ACTOR_POS[2] - x * s + z * c);
};
const POSES = {
  rest: { l: world(-.4, .74, .05), r: world(.4, .74, .05) },
  surprised: { l: world(-.62, 1.85, .2), r: world(.62, 1.85, .2) },
  head: { l: world(-.2, 2.0, .06), r: world(.2, 2.0, .06) },
  shrug: { l: world(-.7, 1.35, .38), r: world(.7, 1.35, .38) },
} as const;
const SCENE_POSE: Record<S, keyof typeof POSES> = { s1: 'surprised', s2: 'shrug', s3: 'head', s4: 'shrug', s5: 'rest', s6: 'rest', s7: 'shrug' };
const SCENE_FACE: Record<S, Vec3> = {
  s1: V(.9, 0, .9), s2: V(0, 0, .1), s3: V(-.6, 0, .25), s4: V(.45, 0, .6), s5: V(-.8, 0, .1), s6: V(0, 0, 0), s7: V(-.9, 0, 0),
};
const ALL: S[] = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

export function buildMoneyWithdrawalDemo(): ComplexWorldClip {
  const nodes: Node[] = [];
  const mesh = (id: string, parent: string | undefined, position: Vec3, geometry: Record<string, unknown>, color: string, extra: Node = {}) =>
    nodes.push({ id, kind: 'mesh', ...(parent ? { parent } : {}), position, geometry, color, contextSourceId: 's1', ...extra });
  const model = (id: string, assetId: string, position: Vec3, extra: Node = {}) =>
    nodes.push({ id, kind: 'model', assetId, position, contextSourceId: 's1', ...extra });

  mesh('ground', undefined, V(0, -.1, 0), { shape: 'box', size: [80, .2, 80] }, '#C9D6DF');

  // The safe, with a small bag of cash on its interior floor (y = 0.28 m).
  model('safe', 'giant-safe-v1', V(0, 0, 0));
  model('bag', 'money-bag-v1', V(0, .28, -.1));

  // Generic actor.
  nodes.push({ id: 'empresario', kind: 'actor', color: '#1E3A8A', position: ACTOR_POS, rotation: V(0, ACTOR_YAW, 0), contextSourceId: 's1' });

  // Floating share certificates (scene 2) that fall when the price crashes (scene 3).
  mesh('shares', undefined, V(-1, 3.2, -1.2), { shape: 'box', size: [.5, .7, .03] }, '#3B82F6',
    { repeat: { count: 28, step: V(0, 0, 0), jitter: V(8, 2.6, 3), seed: 7 } });

  // Stock chart: dark board + 8 bars.
  mesh('board', undefined, V(-3.4, 1.65, .2), { shape: 'box', size: [3.6, 2.9, .12] }, '#111827');
  const BAR_X0 = -4.8, bars = 8, h0 = [.6, .8, 1.0, 1.25, 1.5, 1.8, 2.1, 2.3], h1 = [.5, .5, .45, .4, .35, .3, .25, .2];
  for (let i = 0; i < bars; i++)
    mesh(`bar${i}`, undefined, V(BAR_X0 + .4 * i, .3, .3), { shape: 'box', size: [.26, 1, .12] }, i < 4 ? '#22C55E' : '#EF4444');

  // Generic rocket (no logos).
  nodes.push({ id: 'rocket', kind: 'group', position: V(-3.8, 0, -1), contextSourceId: 's4' });
  mesh('rocket-body', 'rocket', V(0, 1.6, 0), { shape: 'cylinder', size: [.45, .45, 3.2] }, '#F3F4F6');
  mesh('rocket-nose', 'rocket', V(0, 3.7, 0), { shape: 'cone', size: [.45, 1.0] }, '#D1D5DB');
  for (const [fx, fz] of [[.55, 0], [-.55, 0], [0, .55]] as const)
    mesh(`rocket-fin-${fx}-${fz}`.replace(/[.]/g, 'p').replace('-0-', '-z-'), 'rocket', V(fx, .6, fz), { shape: 'box', size: fz ? [.5, .9, .1] : [.1, .9, .5] }, '#374151');

  // Cash pallet, tax coin and the convoy.
  model('cash', 'money-pallet-v1', V(2.4, 0, -1.0), { scale: HID });
  model('coin', 'giant-coin-v1', V(4.2, 0, .5), { scale: HID });
  const TRUCKS = 4, X_LANE = -8, LEG = 24;
  for (let i = 0; i < TRUCKS; i++) model(`truck${i + 1}`, 'armored-truck-v1', V(X_LANE, 0, -32 + 8 * i), { scale: HID });

  const tracks: Node[] = [];
  const track = (node: string, channel: string, keys: ReturnType<typeof k>[], interpolation = 'smooth', part?: string) =>
    tracks.push({ node, channel, interpolation, keys, ...(part ? { part } : {}) });

  // Safe: wheel turns, door swings open (s1); it closes again at the end (s7).
  track('safe', 'rotation', [k('s1', 0, V(0, 0, 0)), k('s1', .4, V(0, 0, TAU)), k('s1', .95, V(0, 0, TAU)), k('s7', 0, V(0, 0, TAU)), k('s7', .55, V(0, 0, 0))], 'smooth', 'volante');
  track('safe', 'rotation', [k('s1', 0, V(0, 0, 0)), k('s1', .4, V(0, 0, 0)), k('s1', .95, V(0, OPEN_SAFE, 0)), k('s7', 0, V(0, OPEN_SAFE, 0)), k('s7', .7, V(0, 0, 0))], 'smooth', 'porta');

  // Actor: pose and face per scene.
  for (const [channel, side] of [['leftHand', 'l'], ['rightHand', 'r']] as const)
    track('empresario', channel, [k('s1', 0, POSES.rest[side]), ...ALL.flatMap((s) => [k(s, .2, POSES[SCENE_POSE[s]][side]), k(s, .9, POSES[SCENE_POSE[s]][side])])]);
  track('empresario', 'face', [k('s1', 0, V(0, 0, 0)), ...ALL.flatMap((s) => [k(s, .2, SCENE_FACE[s]), k(s, .9, SCENE_FACE[s])])]);

  // Share certificates: appear (s2), fall and vanish (s3).
  track('shares', 'scale', [k('s1', 1, HID), k('s2', .35, ONE), k('s3', .85, ONE), k('s3', 1, HID)]);
  track('shares', 'position', [k('s2', .35, V(-1, 3.2, -1.2)), k('s2', 1, V(-1, 3.5, -1.2)), k('s3', .9, V(-1, .15, -1.2))]);
  track('shares', 'rotation', [k('s2', .35, V(0, 0, 0)), k('s3', .9, V(1.2, 2.4, 0))]);

  // Chart: bars rise, then crash (s3), then everything folds away (s4).
  track('board', 'scale', [k('s2', 1, HID), k('s3', .15, ONE), k('s3', 1, ONE), k('s4', .15, HID)]);
  for (let i = 0; i < bars; i++) {
    const y = (h: number) => V(BAR_X0 + .4 * i, .3 + h / 2, .3);
    track(`bar${i}`, 'scale', [k('s2', 1, HID), k('s3', .3, V(1, h0[i], 1)), k('s3', .45, V(1, h0[i], 1)), k('s3', .95, V(1, h1[i], 1)), k('s4', .1, V(1, h1[i], 1)), k('s4', .2, HID)]);
    track(`bar${i}`, 'position', [k('s2', 1, y(.01)), k('s3', .3, y(h0[i])), k('s3', .45, y(h0[i])), k('s3', .95, y(h1[i])), k('s4', .1, y(h1[i]))]);
  }

  // Rocket (s4) rises into view and leaves in s5.
  track('rocket', 'scale', [k('s3', 1, HID), k('s4', .3, ONE), k('s4', 1, ONE), k('s5', .3, HID)]);

  // Cash pallet: appears when the shares are sold (s3), shrinks with the price and the tax, tiny at the end.
  track('cash', 'scale', [k('s2', 1, HID), k('s3', .35, HID), k('s3', .5, ONE), k('s3', 1, V(.55, .55, .55)), k('s5', .9, V(.3, .3, .3)), k('s6', .03, V(.3, .3, .3)), k('s6', .08, HID), k('s7', 0, HID), k('s7', .35, V(.12, .12, .12))]);

  // Tax coin rolls away with a slice (s5).
  track('coin', 'scale', [k('s4', 1, HID), k('s5', .08, ONE), k('s5', 1, ONE), k('s6', .08, HID)]);
  // A rolling coin turns about ITS CENTER (0.5 m above the node origin), so the node is moved to keep the center on a
  // straight line at y = 0.5: p = center + R(theta)·(0, -0.5). Dense linear keys keep the motion exact when scrubbing.
  const coinKeys = Array.from({ length: 37 }, (_, j) => {
    const u = j / 36, theta = -(4.5 / .5) * u, cx = 4.2 + 4.5 * u;
    return { phase: .1 + .9 * u, pos: V(cx + .5 * Math.sin(theta), .5 - .5 * Math.cos(theta), .5), rot: V(0, 0, theta) };
  });
  track('coin', 'position', coinKeys.map((c) => k('s5', c.phase, c.pos)), 'linear');
  track('coin', 'rotation', coinKeys.map((c) => k('s5', c.phase, c.rot)), 'linear');

  // Convoy of armored trucks (s6): drive +Z, wheels roll radius 0.42 m, then leave the frame (s7).
  for (let i = 0; i < TRUCKS; i++) {
    const z0 = -32 + 8 * i, id = `truck${i + 1}`;
    track(id, 'scale', [k('s5', 1, HID), k('s6', .01, ONE), k('s6', 1, ONE), k('s7', .1, HID)]);
    track(id, 'position', [k('s6', 0, V(X_LANE, 0, z0)), k('s6', 1, V(X_LANE, 0, z0 + LEG))], 'linear');
    for (let w = 1; w <= 6; w++) track(id, 'rotation', [k('s6', 0, V(0, 0, 0)), k('s6', 1, V(LEG / .42, 0, 0))], 'linear', `roda_${w}`);
  }

  const program = normalizeSceneProgram({
    version: 1, background: '#BFD8E6', nodes, tracks,
    shots: [
      { sourceId: 's1', subjects: ['safe', 'empresario'], azimuth: .3, endAzimuth: .05, elevation: .16, distance: 1.15 },
      { sourceId: 's2', subjects: ['safe', 'bag', 'shares'], azimuth: .05, endAzimuth: -.15, elevation: .2, distance: 1.1 },
      { sourceId: 's3', subjects: ['board', 'cash'], azimuth: .05, endAzimuth: .15, elevation: .14, distance: 1.1 },
      { sourceId: 's4', subjects: ['rocket', 'empresario'], azimuth: -.2, endAzimuth: .1, elevation: .14, distance: 1.1 },
      { sourceId: 's5', subjects: ['cash', 'coin', 'empresario'], azimuth: .15, endAzimuth: -.1, elevation: .14, distance: 1.1 },
      { sourceId: 's6', subjects: ['truck1', 'truck2', 'truck3', 'truck4'], azimuth: .55, endAzimuth: .3, elevation: .16, distance: 1.0 },
      { sourceId: 's7', subjects: ['safe', 'empresario', 'cash'], azimuth: .2, endAzimuth: 0, elevation: .15, distance: 1.1 },
    ],
    contacts: [],
    motionChecks: [
      { sourceId: 's1', node: 'safe', part: 'porta', channel: 'rotation', kind: 'change', startPhase: .4, endPhase: .95, threshold: 1.5 },
      { sourceId: 's2', node: 'safe', part: 'porta', channel: 'rotation', kind: 'hold', startPhase: 0, endPhase: 1, threshold: .01 },
      { sourceId: 's3', node: 'bar7', channel: 'scale', kind: 'change', startPhase: .45, endPhase: .95, threshold: 1.5 },
      { sourceId: 's5', node: 'coin', channel: 'position', kind: 'change', startPhase: .1, endPhase: 1, threshold: 4 },
      { sourceId: 's6', node: 'truck1', channel: 'position', kind: 'change', startPhase: 0, endPhase: 1, threshold: 20 },
      { sourceId: 's6', node: 'truck1', part: 'roda_1', channel: 'rotation', kind: 'change', startPhase: 0, endPhase: 1, threshold: 20 },
      { sourceId: 's7', node: 'safe', part: 'porta', channel: 'rotation', kind: 'change', startPhase: 0, endPhase: .7, threshold: 1.5 },
    ],
  }, MONEY_WITHDRAWAL_SOURCES);
  compileSceneProgram(program, MONEY_WITHDRAWAL_SOURCES);

  const duration = MONEY_WITHDRAWAL_SOURCES.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  return {
    id: 'musk-saque-demo', sources: MONEY_WITHDRAWAL_SOURCES, duration, program,
    presentation: {
      title: 'E se ele sacasse tudo?',
      narration: MONEY_WITHDRAWAL_SCRIPT,
      beats: [
        { start: 0, end: 5, subject: 'A pergunta', problem: 'E se ele sacasse tudo?', solution: 'Vamos abrir o cofre.' },
        { start: 5, end: 13, subject: 'Ação, não dinheiro', problem: 'O cofre quase vazio.', solution: 'A fortuna é quase toda ação.' },
        { start: 13, end: 21, subject: 'Vender derruba o preço', problem: 'Vender tudo de uma vez...', solution: '...faz o preço despencar.' },
        { start: 21, end: 30, subject: 'Sem comprador', problem: 'SpaceX não tem ação na bolsa.', solution: 'Quem compra centenas de bilhões?' },
        { start: 30, end: 36, subject: 'Imposto', problem: 'Ainda tem o imposto.', solution: 'Dezenas de bilhões a menos.' },
        { start: 36, end: 46, subject: 'Dinheiro físico', problem: '800 bi em notas de cem.', solution: 'Mais de 8 mil toneladas.' },
        { start: 46, end: 52, subject: 'Moral', problem: 'Sacar tudo?', solution: 'Ele ficaria bem mais pobre.' },
      ],
    },
    audit: { objectCount: 8, objectParts: nodes.filter((n) => n.kind === 'mesh').length, sceneryRegions: 1, sceneNodes: program.nodes.length, shotCount: program.shots.length, estimatedVertexLimit: 250000 },
  };
}
