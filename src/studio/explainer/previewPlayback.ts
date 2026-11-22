/**
 * Motion 2D preview timeline helpers.
 *
 * The preview and its scheduled Web Audio sources share one playback origin.
 * Export still uses exportTimeline.ts and its deterministic frame sampler.
 */
export function previewResumeAt(position: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(position) || position < 0 || position >= duration) return 0;
  return position;
}

/** Clamp the visible frame; never wrap to frame zero at natural completion. */
export function previewFrameAt(start: number, elapsed: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const base = Number.isFinite(start) ? Math.max(0, start) : 0;
  const advance = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return Math.min(duration, base + advance);
}
