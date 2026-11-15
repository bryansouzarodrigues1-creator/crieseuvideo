import { spokenText } from './script';
import { sceneDuration, SCENE_LEAD, type ExplainerPlan } from './plan';

export interface NarrationWord { word: string; start: number; end: number }
export interface NarrationClip { sourceId: string; text: string; duration: number; start: number; end: number; timings?: NarrationWord[]; wavBase64: string }
const fail = (): never => { throw new Error('A narração não corresponde às cenas deste roteiro. Importe o pacote gerado a partir do plano atual.'); };
export function validateNarrationPackage(raw: unknown, plan: ExplainerPlan): NarrationClip[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail();
  const r = raw as Record<string, any>;
  if (r.version !== 1 || typeof r.script !== 'string' || spokenText(r.script) !== spokenText(plan.scenes.map((s) => s.text).join(' ')) || !Array.isArray(r.clips) || r.clips.length !== plan.scenes.length) return fail();
  return plan.scenes.map((scene, i) => {
    const clip = r.clips[i];
    if (!clip || clip.text !== scene.text || clip.sourceId !== (scene.sourceId ?? `s${i + 1}`) ||
        !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.duration > 600 ||
        !Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.start < 0 || clip.end <= clip.start || clip.end > clip.duration + .001 ||
        typeof clip.wavBase64 !== 'string' || clip.wavBase64.length > 12000000 || !/^[a-zA-Z0-9+/=]+$/.test(clip.wavBase64)) return fail();
    const words = scene.text.split(/\s+/).filter(Boolean);
    let timings: NarrationWord[] | undefined;
    if (clip.timings !== undefined && clip.timings !== null) {
      if (!Array.isArray(clip.timings) || clip.timings.length !== words.length) return fail();
      let previous = 0;
      timings = clip.timings.map((w: any, k: number) => {
        if (!w || w.word !== words[k] || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < previous - .001 || w.end <= w.start || w.end > clip.duration + .001) return fail();
        previous = w.end; return { word: w.word, start: w.start, end: w.end };
      });
    }
    return { sourceId: clip.sourceId, text: clip.text, duration: clip.duration, start: clip.start, end: clip.end, timings, wavBase64: clip.wavBase64 };
  });
}

/** Time expressive onsets to the actual spoken cue; never stretch the recording. */
export function alignNarratedActing(plan: ExplainerPlan): ExplainerPlan {
  if (!plan.production) return plan;
  const expressions: Record<string, RegExp> = { laugh: /^(haha|hehe|kkk|riso|risada|gargalh|riu|rindo|rir$)/, pride: /^(orgulh|confiante|melhor|maior)/, smile: /^(sorri|feliz)/, point: /^apont/ };
  const tracks = plan.production.tracks.map((track) => {
    if (track.to <= 0 || !expressions[track.channel]) return track;
    if (plan.production!.tracks.filter((t) => t.asset === track.asset && t.channel === track.channel && t.sourceId === track.sourceId).length > 1) return track;
    const scene = plan.scenes.find((s) => s.sourceId === track.sourceId), words = scene?.voice?.timings;
    const cue = words?.find((w) => expressions[track.channel].test(w.word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    if (!scene || !cue) return track;
    const duration = sceneDuration(scene), begin = Math.max(.01, Math.min(.9, (SCENE_LEAD + cue.start - .12) / duration));
    const end = Math.max(begin + .01, Math.min(.98, (SCENE_LEAD + cue.end + .16) / duration));
    return { ...track, begin, end };
  });
  return { ...plan, production: { ...plan.production, tracks } };
}
