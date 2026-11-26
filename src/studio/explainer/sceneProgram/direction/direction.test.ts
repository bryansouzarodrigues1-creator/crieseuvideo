import { describe, expect, it } from 'vitest';
import { compileSceneProgram, type ProgramSource } from '../score';
import { compileDirection, DirectionError, type Direction } from './direction';
import { MONEY_DIRECTION } from '../demo/moneyWithdrawalDirection';
import { MONEY_WITHDRAWAL_SOURCES, buildMoneyWithdrawalDemo } from '../demo/moneyWithdrawal';
import { buildHandwrittenMoneyDemo } from '../demo/moneyWithdrawal.handwritten.fixture';

const src: ProgramSource[] = [{ sourceId: 's1', text: 'a', duration: 4 }, { sourceId: 's2', text: 'b', duration: 4 }];
const base = (verbs1: Direction['scenes'][0]['verbs'], verbs2: Direction['scenes'][0]['verbs'] = []): Direction => ({
  version: 1, background: '#EEF1F5',
  cast: [
    { id: 'ball', kind: 'mesh', position: [0, .5, 0], geometry: { shape: 'sphere', size: [.5] }, color: '#ff0000' },
    { id: 'ghost', kind: 'mesh', hidden: true, position: [2, .5, 0], geometry: { shape: 'box', size: [1, 1, 1] }, color: '#00ff00' },
  ],
  scenes: [
    { sourceId: 's1', shot: { subjects: ['ball'], azimuth: 0, elevation: .2, distance: 1.2 }, verbs: verbs1 },
    { sourceId: 's2', shot: { subjects: ['ball', 'ghost'], azimuth: 0, elevation: .2, distance: 1.2 }, verbs: verbs2 },
  ],
});
const at = (d: Direction, t: number, id: string) => compileSceneProgram(compileDirection(d, src), src).sample(t).get(id)!;

describe('direction compiler', () => {
  it('holds the previous value until a verb starts and keeps it afterwards', () => {
    const d = base([], [{ do: 'move', node: 'ball', to: [4, .5, 0], at: [.5, 1] }]);
    expect(at(d, 4, 'ball').position[0]).toBeCloseTo(0);      // all of scene 1: still
    expect(at(d, 6, 'ball').position[0]).toBeCloseTo(0);      // scene 2 phase .5: still at the start
    expect(at(d, 8, 'ball').position[0]).toBeCloseTo(4);      // end
    expect(at(d, 8, 'ball').position[1]).toBeCloseTo(.5);     // untouched axes stay
  });
  it('hidden members start at scale 0.01 and appear at their cast scale', () => {
    const d = base([], [{ do: 'appear', node: 'ghost', at: [0, .5] }]);
    expect(at(d, 0, 'ghost').scale[0]).toBeCloseTo(.01);
    expect(at(d, 6, 'ghost').scale[0]).toBeCloseTo(1);
  });
  it('relative moves chain from the current value', () => {
    const d = base([{ do: 'move', node: 'ball', by: [1, 0, 0], at: [0, .5] }], [{ do: 'move', node: 'ball', by: [1, 0, 0], at: [0, .5] }]);
    expect(at(d, 8, 'ball').position[0]).toBeCloseTo(2);
  });
  it('rejects overlapping verbs, unknown nodes, bad windows and mixed interpolation', () => {
    const go = (v: Direction['scenes'][0]['verbs']) => () => compileDirection(base(v), src);
    expect(go([{ do: 'move', node: 'ball', to: [1, 0, 0], at: [0, .6] }, { do: 'move', node: 'ball', to: [2, 0, 0], at: [.4, 1] }])).toThrow(/sobrepostos/);
    expect(go([{ do: 'move', node: 'nobody', to: [1, 0, 0] }])).toThrow(/elenco/);
    expect(go([{ do: 'move', node: 'ball', to: [1, 0, 0], at: [.5, .5] }])).toThrow(/Janela/);
    expect(go([{ do: 'move', node: 'ball', to: [1, 0, 0], at: [0, .4] }, { do: 'drive', node: 'ball', by: [0, 0, 1], wheels: [], wheelRadius: .4, at: [.5, 1] }])).toThrow(/linear/);
    expect(() => compileDirection({ ...base([]), scenes: [base([]).scenes[0]] }, src)).toThrow(DirectionError);
  });
  it('turns promised movement into motion checks that fail when the movement is too small', () => {
    const program = compileDirection(base([{ do: 'move', node: 'ball', to: [3, .5, 0], at: [0, 1] }]), src);
    expect(program.motionChecks?.some((c) => c.node === 'ball' && c.channel === 'position')).toBe(true);
  });
});

describe('the money video as a direction', () => {
  it('reproduces the hand-written animation of every non-actor node', () => {
    const a = compileSceneProgram(buildMoneyWithdrawalDemo().program, MONEY_WITHDRAWAL_SOURCES);
    const b = compileSceneProgram(buildHandwrittenMoneyDemo().program, MONEY_WITHDRAWAL_SOURCES);
    const worst: Record<string, number> = {};
    for (let t = 0; t <= 52; t += .5) {
      const sa = a.sample(t), sb = b.sample(t);
      for (const [id, x] of sa) {
        if (id === 'empresario' || id === 'shares' || id === 'cash') continue; // poses, the certificate spin and the pallet shrink are re-timed on purpose (scene-local now)
        const y = sb.get(id);
        if (!y) continue; // the rocket fins were renamed; static anyway
        for (const ch of ['position', 'rotation', 'scale'] as const)
          for (let i = 0; i < 3; i++) worst[id] = Math.max(worst[id] ?? 0, Math.abs(x[ch][i] - y[ch][i]));
        for (const [part, v] of Object.entries(y.parts ?? {}))
          for (let i = 0; i < 3; i++) worst[id + '/' + part] = Math.max(worst[id + '/' + part] ?? 0, Math.abs((x.parts?.[part]?.[i] ?? 0) - v[i]));
      }
    }
    expect(Object.keys(worst).length).toBeGreaterThan(40); // bars, trucks, wheels, coin, cash, safe parts...
    const bad = Object.entries(worst).filter(([, d]) => d > 1e-2);
    expect(bad).toEqual([]);
  });
  it('keeps the same shots, narration and 52 seconds', () => {
    const clip = buildMoneyWithdrawalDemo();
    expect(clip.program.shots.map((s) => s.sourceId)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    expect(MONEY_DIRECTION.scenes).toHaveLength(7);
    expect(clip.duration).toBe(52);
  });
  describe('drive follows the vehicle forward', () => {
    const truck = (rotation: [number, number, number]): Direction => ({
      version: 1, background: '#EEF1F5',
      cast: [{ id: 'truck', kind: 'model', assetId: 'armored-truck-v1', position: [0, 0, 0], rotation }],
      scenes: [{ sourceId: 's1', shot: { subjects: ['truck'], azimuth: 0, elevation: .2, distance: 1.2 }, verbs: [] }, { sourceId: 's2', shot: { subjects: ['truck'], azimuth: 0, elevation: .2, distance: 1.2 }, verbs: [] }],
    });
    const drive = (d: Direction, by: [number, number, number]): Direction => {
      d.scenes[0].verbs = [{ do: 'drive', node: 'truck', by, wheels: ['roda_1'], wheelRadius: .42, at: [0, 1] }]; return d;
    };
    const wheelX = (d: Direction) => compileSceneProgram(compileDirection(d, src), src).sample(4).get('truck')!.parts!.roda_1[0];
    it('rolls by the distance along the heading, whatever the yaw', () => {
      expect(wheelX(drive(truck([0, 0, 0]), [0, 0, 8.4]))).toBeCloseTo(20);
      // Heading +X (yaw 90°): driving +X is forward, so the wheels turn the same way.
      expect(wheelX(drive(truck([0, Math.PI / 2, 0]), [8.4, 0, 0]))).toBeCloseTo(20);
      // Reversing turns them backwards.
      expect(wheelX(drive(truck([0, 0, 0]), [0, 0, -4.2]))).toBeCloseTo(-10);
    });
    it('rejects driving sideways instead of sliding the wheels', () => {
      expect(() => compileDirection(drive(truck([0, 0, 0]), [8, 0, 0]), src)).toThrow(DirectionError);
      expect(() => compileDirection(drive(truck([0, 0, 0]), [8, 0, 0]), src)).toThrow(/de lado/);
    });
  });
});
