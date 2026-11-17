import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFallbackPlan } from './plan';
import { listProjects, saveProject } from './library';

afterEach(() => vi.unstubAllGlobals());

describe('saved project voice configuration', () => {
  it('retains the selected voice and voice toggle without storing uploaded audio', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
    const plan = buildFallbackPlan('Um roteiro de teste.', '9:16');
    saveProject({
      id: 'voice-test',
      title: 'Teste de narração',
      script: 'Um roteiro de teste.',
      plan,
      updatedAt: Date.now(),
      voiceKey: 'Charon',
      voiceOn: true,
    });
    const saved = listProjects()[0];
    expect(saved.voiceKey).toBe('Charon');
    expect(saved.voiceOn).toBe(true);
  });
});
