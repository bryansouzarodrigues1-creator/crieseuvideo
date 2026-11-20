import {describe,expect,it} from 'vitest';
import {AI3D_COOLDOWN_MS,cooldownSecondsRemaining,ai3dCooldownMessage,parseAi3DCooldown}
  from './ai3dCooldown';

describe('3D provider anti-duplicate cooldown contract',()=>{
  const last=1_800_000_000_000;
  it('returns the exact remaining seconds, without resetting the attempt clock',()=>{
    expect(AI3D_COOLDOWN_MS).toBe(30_000);
    expect(cooldownSecondsRemaining(last,last)).toBe(30);
    expect(cooldownSecondsRemaining(last,last+1)).toBe(30);
    expect(cooldownSecondsRemaining(last,last+1000)).toBe(29);
    expect(cooldownSecondsRemaining(last,last+29_001)).toBe(1);
    expect(cooldownSecondsRemaining(last,last+29_999)).toBe(1);
    expect(cooldownSecondsRemaining(last,last+30_000)).toBe(0);
    expect(cooldownSecondsRemaining(last,last+45_000)).toBe(0);
    expect(cooldownSecondsRemaining(0,last)).toBe(0);
  });
  it('serializes a safe retry hint the browser can show without another paid call',()=>{
    const blocked=new Error(ai3dCooldownMessage(cooldownSecondsRemaining(last,last+18_000)));
    expect(parseAi3DCooldown(blocked)).toBe(12);
    expect(blocked.message).toContain('antes de chamar a IA');
    expect(parseAi3DCooldown(new Error('token inválido'))).toBeNull();
    expect(parseAi3DCooldown(new Error('AI3D_COOLDOWN:99:'))).toBeNull();
    expect(parseAi3DCooldown('AI3D_COOLDOWN:1:')).toBe(1);
    expect(parseAi3DCooldown('AI3D_COOLDOWN:30:')).toBe(30);
  });
  it('never claims an additional provider call or initiates an automatic retry',()=>{
    const message=ai3dCooldownMessage(23);
    expect(message).toContain('bloqueado antes de chamar a IA');
    expect(message).not.toContain('reenvio automático');
  });
});
