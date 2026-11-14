import { describe, expect, it } from 'vitest';
import { captureHealthError, type CaptureHealth } from './exportCapture';

const good: CaptureHealth = {
  expectedFrames: 301,
  submittedFrames: 301,
  skippedFrames: 0,
  longestGap: 0,
  hiddenDuringExport: false,
};

describe('video export frame integrity', () => {
  it('accepts a complete recording', () => {
    expect(captureHealthError(good, 30)).toBeNull();
  });

  it('tolerates minor timer jitter without rejecting normal mobile exports', () => {
    expect(captureHealthError({ ...good, submittedFrames: 297, skippedFrames: 4, longestGap: 2 }, 30)).toBeNull();
  });

  it('rejects a long browser or GPU stall before reporting success', () => {
    expect(captureHealthError({ ...good, submittedFrames: 270, skippedFrames: 31, longestGap: 31 }, 30)).toMatch(/perdeu quadros/);
  });

  it('rejects repeated frame loss above the safety threshold', () => {
    expect(captureHealthError({ ...good, submittedFrames: 241, skippedFrames: 60, longestGap: 6 }, 30)).toMatch(/perdeu quadros/);
  });

  it('rejects a recording when the browser tab became hidden', () => {
    expect(captureHealthError({ ...good, hiddenDuringExport: true }, 30)).toMatch(/segundo plano/);
  });

  it('rejects invalid timeline metadata', () => {
    expect(captureHealthError({ ...good, expectedFrames: Number.NaN }, 30)).toMatch(/inválida/);
  });
});
