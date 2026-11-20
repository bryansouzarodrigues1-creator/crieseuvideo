import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameRequests } from './frameRequests';

afterEach(() => vi.useRealTimers());
const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap;

describe('exported frame lifecycle', () => {
  it('cancels a frame immediately and closes its late bitmap', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const frames = new FrameRequests(send);
    const ctrl = new AbortController();
    const pending = frames.request(2, ctrl.signal);
    const result = expect(pending).rejects.toThrow('cancelada');
    ctrl.abort();
    await result;
    const late = bitmap();
    frames.receive(send.mock.calls[0][0].seq, late);
    expect(late.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects all frames on runtime error or scene replacement without leaving timers', async () => {
    vi.useFakeTimers();
    const frames = new FrameRequests(vi.fn());
    const signal = new AbortController().signal;
    const one = expect(frames.request(0, signal)).rejects.toThrow('substituída');
    const two = expect(frames.request(1, signal)).rejects.toThrow('substituída');
    frames.cancel('Cena substituída');
    await Promise.all([one, two]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out an unresponsive scene and still accepts later requests', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const frames = new FrameRequests(send, 100);
    const signal = new AbortController().signal;
    const timeout = expect(frames.request(0, signal)).rejects.toThrow('parou de responder');
    await vi.advanceTimersByTimeAsync(100);
    await timeout;
    const next = frames.request(1, signal);
    const image = bitmap();
    frames.receive(send.mock.calls[1][0].seq, image);
    expect(await next).toBe(image);
    expect(image.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
