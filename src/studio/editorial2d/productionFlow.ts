import type { StorytellingSpec } from './storytelling';

/** Manual audio first. Do not try to infer whether an MP3 has speech from its extension. */
export type AudioIntent = 'auto' | 'narrated' | 'without_voice';
export type ImportedAudioType = 'unclassified' | 'voice' | 'music';
export type ResolvedAudio = 'narrated' | 'no_voice' | 'confirm_audio_type' | 'waiting_for_mp3';

export const DURATION_PRESETS = [30, 60, 120, 180, 300] as const;
export const MIN_VIDEO_SECONDS = 15;
export const MAX_VIDEO_SECONDS = 600; // editor technical limit, NOT a subscription entitlement

export function resolveAudioMode(
  intent: AudioIntent,
  imported: ImportedAudioType,
  hasAudio: boolean,
  spokenText: string,
): ResolvedAudio {
  if (intent === 'without_voice') return 'no_voice';
  if (intent === 'narrated') return hasAudio ? 'narrated' : 'waiting_for_mp3';
  if (hasAudio && imported === 'voice') return 'narrated';
  if (hasAudio && imported === 'music') return 'no_voice';
  if (hasAudio && imported === 'unclassified') return 'confirm_audio_type';
  return spokenText.trim() ? 'waiting_for_mp3' : 'no_voice';
}

export function durationAllowed(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= MIN_VIDEO_SECONDS && seconds <= MAX_VIDEO_SECONDS;
}

/** Re-timing changes scene boundaries only, never audio pitch or playback rate. */
export function rescaleStoryDuration(spec: StorytellingSpec, targetSeconds: number): StorytellingSpec {
  if (!durationAllowed(targetSeconds)) throw new Error('Duração fora do intervalo de 15 segundos a 10 minutos');
  if (!Number.isFinite(spec.duration) || spec.duration <= 0 || !spec.scenes.length) {
    throw new Error('Projeto sem duração e cenas válidas');
  }
  const factor = targetSeconds / spec.duration;
  let elapsed = 0;
  const scenes = spec.scenes.map((scene, i) => {
    const length = i === spec.scenes.length - 1
      ? targetSeconds - elapsed
      : (scene.end - scene.start) * factor;
    if (length < 2) throw new Error('Alguma cena ficaria menor que 2 segundos; ajuste o roteiro antes de aplicar.');
    const start = elapsed;
    elapsed += length;
    return { ...scene, start, end: i === spec.scenes.length - 1 ? targetSeconds : elapsed };
  });
  return { ...spec, duration: targetSeconds, scenes };
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Approximate word rate for creative planning only; NEVER for final lip/caption alignment. */
export function estimatedSpeechRange(text: string) {
  const words = countWords(text);
  if (words === 0) return null;
  return { minSeconds: Math.round(words / 2.8), maxSeconds: Math.ceil(words / 2.0), words };
}

export function cleanElevenPerformanceText(input: string): string {
  return input
    .replace(/\[[^\]\r\n]{1,60}\]/g, '')
    .replace(/<break\b[^>]*\/?>/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitIntoActs(totalSeconds: number, idealSeconds = 30): { start: number; end: number }[] {
  if (!durationAllowed(totalSeconds)) throw new Error('Duração inválida');
  const count = Math.max(1, Math.ceil(totalSeconds / idealSeconds));
  return Array.from({length:count},(_,i)=>({
    start: Math.round((i*totalSeconds)/count*100)/100,
    end: i===count-1?totalSeconds:Math.round(((i+1)*totalSeconds)/count*100)/100,
  }));
}
