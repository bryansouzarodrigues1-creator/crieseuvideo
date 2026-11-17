import { describe, expect, it, vi, afterEach } from 'vitest';
import { getBestSupportedVideoMimeType } from './videoRecorder';

afterEach(() => vi.unstubAllGlobals());

describe('MediaRecorder container negotiation', () => {
  it('preserves WebM extension when MP4 is unavailable', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (mime: string) => mime === 'video/webm;codecs=vp8,opus' });
    expect(getBestSupportedVideoMimeType()).toEqual({
      mimeType: 'video/webm;codecs=vp8,opus',
      extension: 'webm',
    });
  });

  it('prefers MP4 when supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (mime: string) => mime.startsWith('video/mp4') });
    expect(getBestSupportedVideoMimeType().extension).toBe('mp4');
  });

  it('fails explicitly when no recording format is supported', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(() => getBestSupportedVideoMimeType()).toThrow(/não oferece um formato/);
  });
});
