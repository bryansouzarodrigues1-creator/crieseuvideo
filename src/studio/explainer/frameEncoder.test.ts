import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ submitted: [] as number[], drawn: [] as number[], cancelled: false, codec: 'avc' as string | null }));
vi.mock('mediabunny', () => ({
  Quality: class {}, Mp4OutputFormat: class {}, WebMOutputFormat: class {}, BufferTarget: class { buffer = null; },
  getFirstEncodableVideoCodec: vi.fn(async () => state.codec), getFirstEncodableAudioCodec: vi.fn(async () => 'aac'),
  Output: class {
    target: any; constructor(options: any) { this.target = options.target; }
    addVideoTrack() {} addAudioTrack() {} async start() {} async cancel() { state.cancelled = true; }
    async finalize() { this.target.buffer = new Uint8Array([1, 2, 3]).buffer; }
  },
  CanvasSource: class { async add(t: number) { await new Promise((r) => setTimeout(r, 7)); state.submitted.push(t); } close() {} },
  AudioBufferSource: class { async add() {} close() {} },
}));
import { encodeFrames } from './frameEncoder';
beforeEach(() => { state.submitted = []; state.drawn = []; state.cancelled = false; state.codec = 'avc'; });
afterEach(() => vi.restoreAllMocks());
describe('frame-counted browser export', () => {
  it('submits all frame timestamps even when rendering/encoding takes longer than real time', async () => {
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280;
    const result = await encodeFrames({ canvas, duration: .2, fps: 30, draw(t) { state.drawn.push(t); } });
    const times = [0, 1 / 30, 2 / 30, 3 / 30, 4 / 30, 5 / 30];
    expect(state.drawn).toEqual(times); expect(state.submitted).toEqual(times);
    expect(result?.frames).toBe(6); expect(result?.extension).toBe('mp4');
  });
  it('refuses changed canvas dimensions instead of saving a mixed-format file', async () => {
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280;
    await expect(encodeFrames({ canvas, duration: .2, draw() { canvas.width = 1280; } })).rejects.toThrow(/formato mudou/);
    expect(state.cancelled).toBe(true);
  });
  it('returns a compatibility result before starting when the requested MP4 codec is unavailable', async () => {
    state.codec = null;
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 1280;
    expect(await encodeFrames({ canvas, duration: 1, mp4Only: true, draw() { state.drawn.push(0); } })).toBeNull();
    expect(state.drawn).toEqual([]);
  });
});
