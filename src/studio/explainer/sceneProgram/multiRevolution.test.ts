import { describe, expect, it } from 'vitest';
import { mechanicalDemoProgram, mechanicalDemoScript } from './mechanicalDemo';
import { normalizeSceneProgram, compileSceneProgram } from './score';

const sources=[{sourceId:'s1',text:mechanicalDemoScript,duration:8}];

describe('general-purpose 3D machine shafts can spin through multiple revolutions',()=>{
  it('retains 4 full turns as a deterministic interpolated rotation',()=>{
    const p=mechanicalDemoProgram();
    p.tracks[1]!.keys[2]!.value=[0,8*Math.PI,0];
    const normalized=normalizeSceneProgram(p,sources);
    const compiled=compileSceneProgram(normalized,sources);
    expect(compiled.sample(8).get('blade-rotor')!.rotation[1]).toBeCloseTo(8*Math.PI,5);
    expect(compiled.sample(0).get('blade-rotor')!.rotation[1]).toBe(0);
    const midpoint=compiled.sample(6.2).get('blade-rotor')!.rotation[1];
    expect(midpoint).toBeGreaterThan(0);
    expect(midpoint).toBeLessThan(8*Math.PI);
    expect(compiled.sample(6.2).get('blade-rotor')!.rotation[1]).toBe(midpoint);
  });
  it('still rejects unbounded rotations or unsafe initial orientations',()=>{
    const p=mechanicalDemoProgram();
    p.tracks[1]!.keys[2]!.value=[0,201,0];
    expect(()=>normalizeSceneProgram(p,sources)).toThrow(/inválida/i);
    const second=mechanicalDemoProgram();
    second.nodes[0]!.rotation=[0,999,0];
    expect(()=>normalizeSceneProgram(second,sources)).toThrow(/inválida/i);
  });
});
