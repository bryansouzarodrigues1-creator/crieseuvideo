import type { Direction, CastMember, Verb } from '../direction/direction';
import type { Vec3 } from '../score';

/**
 * The 7-scene "E se o Elon Musk sacasse tudo?" video as a DIRECTION (cast + verbs), not raw tracks.
 * Models come from the approved catalogue; the actor is the generic code-built figure.
 */
const V = (x: number, y: number, z: number): Vec3 => [x, y, z];
const BAR_X0 = -4.8, H0 = [.6, .8, 1.0, 1.25, 1.5, 1.8, 2.1, 2.3], H1 = [.5, .5, .45, .4, .35, .3, .25, .2];
const TRUCKS = 4, LANE = -8, LEG = 24, WHEELS = ['roda_1', 'roda_2', 'roda_3', 'roda_4', 'roda_5', 'roda_6'];
const bars = H0.map((_, i) => i);
const each = (fn: (i: number) => Verb): Verb[] => bars.map(fn);

const cast: CastMember[] = [
  { id: 'ground', kind: 'mesh', position: V(0, -.1, 0), geometry: { shape: 'box', size: [80, .2, 80] }, color: '#C9D6DF' },
  { id: 'safe', kind: 'model', assetId: 'giant-safe-v1', position: V(0, 0, 0) },
  { id: 'bag', kind: 'model', assetId: 'money-bag-v1', position: V(0, .28, -.1) },
  { id: 'empresario', kind: 'actor', color: '#1E3A8A', position: V(2.5, 0, 1.9), rotation: V(0, -.55, 0) },
  { id: 'shares', kind: 'mesh', hidden: true, position: V(-1, 3.2, -1.2), geometry: { shape: 'box', size: [.5, .7, .03] }, color: '#3B82F6',
    repeat: { count: 28, step: V(0, 0, 0), jitter: V(8, 2.6, 3), seed: 7 } },
  { id: 'board', kind: 'mesh', hidden: true, position: V(-3.4, 1.65, .2), geometry: { shape: 'box', size: [3.6, 2.9, .12] }, color: '#111827' },
  ...bars.map((i): CastMember => ({ id: `bar${i}`, kind: 'mesh', hidden: true, position: V(BAR_X0 + .4 * i, .3, .3),
    geometry: { shape: 'box', size: [.26, 1, .12] }, color: i < 4 ? '#22C55E' : '#EF4444' })),
  { id: 'rocket', kind: 'group', hidden: true, position: V(-3.8, 0, -1) },
  { id: 'rocket-body', kind: 'mesh', parent: 'rocket', position: V(0, 1.6, 0), geometry: { shape: 'cylinder', size: [.45, .45, 3.2] }, color: '#F3F4F6' },
  { id: 'rocket-nose', kind: 'mesh', parent: 'rocket', position: V(0, 3.7, 0), geometry: { shape: 'cone', size: [.45, 1.0] }, color: '#D1D5DB' },
  { id: 'rocket-fin-a', kind: 'mesh', parent: 'rocket', position: V(.55, .6, 0), geometry: { shape: 'box', size: [.1, .9, .5] }, color: '#374151' },
  { id: 'rocket-fin-b', kind: 'mesh', parent: 'rocket', position: V(-.55, .6, 0), geometry: { shape: 'box', size: [.1, .9, .5] }, color: '#374151' },
  { id: 'rocket-fin-c', kind: 'mesh', parent: 'rocket', position: V(0, .6, .55), geometry: { shape: 'box', size: [.5, .9, .1] }, color: '#374151' },
  { id: 'cash', kind: 'model', hidden: true, assetId: 'money-pallet-v1', position: V(2.4, 0, -1.0) },
  { id: 'coin', kind: 'model', hidden: true, assetId: 'giant-coin-v1', position: V(4.2, 0, .5) },
  ...Array.from({ length: TRUCKS }, (_, i): CastMember => ({ id: `truck${i + 1}`, kind: 'model', hidden: true, assetId: 'armored-truck-v1', position: V(LANE, 0, -32 + 8 * i) })),
];
const trucks = Array.from({ length: TRUCKS }, (_, i) => `truck${i + 1}`);

export const MONEY_DIRECTION: Direction = {
  version: 1, background: '#BFD8E6', cast,
  scenes: [
    { sourceId: 's1', shot: { subjects: ['safe', 'empresario'], azimuth: .3, endAzimuth: .05, elevation: .16, distance: 1.15 }, verbs: [
      { do: 'spin', node: 'safe', part: 'volante', axis: 'z', turns: 1, at: [0, .4] },
      { do: 'open', node: 'safe', part: 'porta', axis: 'y', angle: 2.0, at: [.4, .95] },
      { do: 'pose', node: 'empresario', pose: 'surprised', emotion: 'surprised', at: [0, .2] },
    ] },
    { sourceId: 's2', shot: { subjects: ['safe', 'bag', 'shares'], azimuth: .05, endAzimuth: -.15, elevation: .2, distance: 1.1 }, verbs: [
      { do: 'appear', node: 'shares', at: [0, .35] },
      { do: 'move', node: 'shares', to: V(-1, 3.5, -1.2), at: [.35, 1] },
      { do: 'pose', node: 'empresario', pose: 'shrug', emotion: 'calm', at: [0, .25] },
    ] },
    { sourceId: 's3', shot: { subjects: ['board', 'cash'], azimuth: .05, endAzimuth: .15, elevation: .14, distance: 1.1 }, verbs: [
      { do: 'move', node: 'shares', to: V(-1, .15, -1.2), at: [0, .9] },
      { do: 'turn', node: 'shares', to: V(1.2, 2.4, 0), at: [0, .9] },
      { do: 'vanish', node: 'shares', at: [.85, 1] },
      { do: 'appear', node: 'board', at: [0, .15] },
      ...each((i) => ({ do: 'rise', node: `bar${i}`, height: H0[i], at: [0, .3] })),
      ...each((i) => ({ do: 'rise', node: `bar${i}`, height: H1[i], at: [.45, .95] })),
      { do: 'appear', node: 'cash', at: [.35, .5] },
      { do: 'scale', node: 'cash', to: V(.55, .55, .55), at: [.5, 1] },
      { do: 'pose', node: 'empresario', pose: 'head', emotion: 'worried', at: [0, .25] },
    ] },
    { sourceId: 's4', shot: { subjects: ['rocket', 'empresario'], azimuth: -.2, endAzimuth: .1, elevation: .14, distance: 1.1 }, verbs: [
      { do: 'vanish', node: 'board', at: [0, .15] },
      ...each((i) => ({ do: 'vanish', node: `bar${i}`, at: [.1, .2] })),
      { do: 'appear', node: 'rocket', at: [0, .3] },
      { do: 'pose', node: 'empresario', pose: 'shrug', emotion: 'puzzled', at: [0, .25] },
    ] },
    { sourceId: 's5', shot: { subjects: ['cash', 'coin', 'empresario'], azimuth: .15, endAzimuth: -.1, elevation: .14, distance: 1.1 }, verbs: [
      { do: 'vanish', node: 'rocket', at: [0, .3] },
      { do: 'scale', node: 'cash', to: V(.3, .3, .3), at: [0, .9] },
      { do: 'appear', node: 'coin', at: [0, .08] },
      { do: 'roll', node: 'coin', dx: 4.5, radius: .5, centerY: .5, at: [.1, 1] },
      { do: 'pose', node: 'empresario', pose: 'rest', emotion: 'sad', at: [0, .25] },
    ] },
    { sourceId: 's6', shot: { subjects: trucks, azimuth: .55, endAzimuth: .3, elevation: .16, distance: 1.0 }, verbs: [
      { do: 'vanish', node: 'coin', at: [0, .08] },
      { do: 'vanish', node: 'cash', at: [.03, .08] },
      ...trucks.flatMap((id): Verb[] => [
        { do: 'appear', node: id, at: [0, .02] },
        { do: 'drive', node: id, by: V(0, 0, LEG), wheels: WHEELS, wheelRadius: .42, at: [0, 1] },
      ]),
      { do: 'pose', node: 'empresario', pose: 'rest', emotion: 'neutral', at: [0, .25] },
    ] },
    { sourceId: 's7', shot: { subjects: ['safe', 'empresario', 'cash'], azimuth: .2, endAzimuth: 0, elevation: .15, distance: 1.1 }, verbs: [
      ...trucks.map((id): Verb => ({ do: 'vanish', node: id, at: [0, .1] })),
      { do: 'rotatePart', node: 'safe', part: 'volante', axis: 'z', to: 0, at: [0, .55] },
      { do: 'close', node: 'safe', part: 'porta', axis: 'y', at: [0, .7] },
      { do: 'scale', node: 'cash', to: V(.12, .12, .12), at: [0, .35] },
      { do: 'pose', node: 'empresario', pose: 'shrug', emotion: 'crushed', at: [0, .25] },
    ] },
  ],
};
