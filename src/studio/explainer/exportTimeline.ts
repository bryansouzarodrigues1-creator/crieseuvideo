/**
 * Deterministic export timeline for the MP4/WebM exporter.
 *
 * The timeline (scene starts, narration offsets) is the single source of truth: audio is mixed offline
 * onto it, sample-exact, and every video frame is rendered at an exact multiple of 1/fps. Nothing here
 * depends on requestAnimationFrame, on wall-clock scheduling or on the preview's playback state.
 */
import { SCENE_LEAD, sceneStart, totalDuration, type ExplainerPlan } from './plan';

export const EXPORT_FPS = 30;
/** Hold after the last word/frame so the muxer never cuts the final scene or the narration tail. */
export const EXPORT_TAIL = 0.35;

export interface MixSource {
  plan: ExplainerPlan;
  voiceKey: string;
  buffers: Map<string, AudioBuffer>;
  /** Uploaded narration that drives the whole timeline (plan.track). */
  track: AudioBuffer | null;
}
export interface AudioCue { buffer: AudioBuffer; /** seconds on the timeline (t = 0 is the first video frame) */ at: number }

/** Every audible element positioned on the timeline: the uploaded track, or one clip per narrated scene. */
export function audioCues({ plan, voiceKey, buffers, track }: MixSource): AudioCue[] {
  if (plan.track && track) return [{ buffer: track, at: 0 }];
  const cues: AudioCue[] = [];
  plan.scenes.forEach((s, i) => {
    const buffer = s.voice && buffers.get(`${voiceKey}|${s.text}`);
    if (buffer) cues.push({ buffer, at: sceneStart(plan, i) + SCENE_LEAD });
  });
  return cues;
}

/** Scene numbers with missing narration, regardless of persisted timing metadata. */
export function missingNarrationScenes({ plan, voiceKey, buffers }: Pick<MixSource, 'plan' | 'voiceKey' | 'buffers'>): number[] {
  if (plan.track) return []; // Uploaded tracks are validated against `track` separately.
  return plan.scenes.flatMap((scene, index) =>
    scene.voice && buffers.has(`${voiceKey}|${scene.text}`) ? [] : [index + 1]
  );
}

/** Export length: the longer of the visual timeline and the end of the last audio cue, plus the tail. */
export function exportDuration(plan: ExplainerPlan, cues: AudioCue[]): number {
  const audioEnd = cues.reduce((m, c) => Math.max(m, c.at + c.buffer.duration), 0);
  return Math.max(totalDuration(plan), audioEnd) + EXPORT_TAIL;
}

/** Frame-exact time for a clock reading: always an integer multiple of 1/fps, never negative. */
export const frameTime = (clock: number, fps = EXPORT_FPS) => Math.floor(Math.max(0, clock) * fps + 1e-6) / fps;

/** Mix every cue into one stereo buffer exactly `duration` long (offline render: no real-time scheduling). */
export async function mixdown(cues: AudioCue[], duration: number, sampleRate: number): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  for (const { buffer, at } of cues) {
    const src = off.createBufferSource();
    src.buffer = buffer; src.connect(off.destination); src.start(at);
  }
  return off.startRendering();
}
