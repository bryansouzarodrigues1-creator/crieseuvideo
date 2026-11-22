import { describe, expect, it } from 'vitest';
import { previewFrameAt, previewResumeAt } from './previewPlayback';

describe('Motion 2D preview playback', () => {
  it('restarts from zero only when playback begins at the end', () => {
    expect(previewResumeAt(12, 12)).toBe(0);
    expect(previewResumeAt(12.2, 12)).toBe(0);
    expect(previewResumeAt(6.4, 12)).toBe(6.4);
  });

  it('keeps the final frame visible instead of flashing the first frame', () => {
    expect(previewFrameAt(11, 1.5, 12)).toBe(12);
    expect(previewFrameAt(11, 10, 12)).toBe(12);
  });

  it('does not advance before audio playback starts or while its clock is paused', () => {
    expect(previewFrameAt(3, -0.05, 12)).toBe(3);
    expect(previewFrameAt(3, 0, 12)).toBe(3);
    expect(previewFrameAt(3, 0.25, 12)).toBe(3.25);
  });

  it('handles silent, missing and invalid durations safely', () => {
    expect(previewResumeAt(Number.NaN, 10)).toBe(0);
    expect(previewResumeAt(3, 0)).toBe(0);
    expect(previewFrameAt(3, Number.NaN, 10)).toBe(3);
    expect(previewFrameAt(0, 2, Number.NaN)).toBe(0);
  });
});
