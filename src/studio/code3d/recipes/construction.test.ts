import { describe, it, expect } from 'vitest';
import { buildConstructionCode, normalizeConstructionRecipe } from './construction';
import { checkGeneratedCode } from '../validation';
import { code3dSize, code3dFrameRate } from '../contract';

describe('construction scenes through the existing code sandbox',()=>{
  it('emits a self-contained accepted program for a parameterized building',()=>{
    const a=buildConstructionCode(),b=buildConstructionCode({area:60000,floors:3,totalCost:0});
    expect(checkGeneratedCode(a)).toEqual({ok:true,warnings:[]});
    expect(checkGeneratedCode(b)).toEqual({ok:true,warnings:[]});
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/fetch\(|import\(|Math\.random\(|requestAnimationFrame\(/);
    expect(a).toContain('InstancedMesh');
  });
  it('rejects a contradictory counter, invalid footprint and out-of-range clip',()=>{
    expect(()=>buildConstructionCode({costs:[[0,20],[3,10]]})).toThrow('Contador');
    expect(()=>buildConstructionCode({footprint:[[0,0],[1,1],[2,2]]})).toThrow('área');
    expect(()=>buildConstructionCode({clipDuration:14})).toThrow('8 e 12');
    expect(()=>buildConstructionCode({clipStart:9})).toThrow('Início');
    expect(()=>buildConstructionCode({floors:1.5})).toThrow('inteiro');
  });
  it('preserves source-clock staging while exporting later timeline segments',()=>{
    const p=normalizeConstructionRecipe({timelineDuration:120,clipDuration:12,clipStart:108,timeMap:[{start:0,duration:120,source:22,rate:1}],timings:{piles:[27,30]}});
    expect(p.clipStart).toBe(108);expect(p.timings.piles).toEqual([27,30]);
    expect(p.timeMap[0].source).toBe(22);
  });
  it('keeps the default lightweight export and makes HD an explicit choice',()=>{
    expect(code3dSize('9:16')).toEqual({width:432,height:768});
    expect(code3dFrameRate()).toBe(24);
    expect(code3dSize('9:16','hd')).toEqual({width:720,height:1280});
    expect(code3dSize('16:9','hd')).toEqual({width:1280,height:720});
    expect(code3dFrameRate('hd')).toBe(30);
  });
});
