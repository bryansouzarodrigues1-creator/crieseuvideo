import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCachedNarration } from './voice';

afterEach(() => vi.unstubAllGlobals());

function fakeHash(byte: number) {
  vi.stubGlobal('crypto', {
    subtle: { digest: vi.fn(async () => new Uint8Array([byte]).buffer) },
  });
}

describe('cached narration recovery', () => {
  it('restores a stored WAV without fetching or billing TTS', async () => {
    fakeHash(18);
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const audio = { duration: 1.25 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => audio);
    const match = vi.fn(async () => ({ arrayBuffer: async () => bytes }));
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ match })) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const restored = await getCachedNarration({ decodeAudioData } as unknown as BaseAudioContext, 'cena cache teste 1', 'Algieba');
    expect(restored).toBe(audio);
    expect(decodeAudioData).toHaveBeenCalledWith(bytes);
    expect(match).toHaveBeenCalledWith('/__voice/12.wav');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on cache miss without triggering a paid request', async () => {
    fakeHash(19);
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: async () => undefined })) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const restored = await getCachedNarration({ decodeAudioData: vi.fn() } as unknown as BaseAudioContext, 'cena cache teste 2', 'Charon');
    expect(restored).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when Cache Storage is unavailable', async () => {
    fakeHash(20);
    vi.stubGlobal('caches', undefined);
    const restored = await getCachedNarration({ decodeAudioData: vi.fn() } as unknown as BaseAudioContext, 'cena cache teste 3', 'Puck');
    expect(restored).toBeNull();
  });
});
