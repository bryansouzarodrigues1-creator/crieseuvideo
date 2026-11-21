/** Word timing measured from the narration audio itself, for any voice (Gemini, ElevenLabs, a recording).
 *
 * Without it captions spread the words evenly over the speech, so they drift from the sound. Here the expected
 * word boundaries (syllable count + punctuation pauses) are snapped to the real valleys of the loudness envelope,
 * and a real pause between two words is kept as a gap, so a word is only on screen while it is being said.
 * Pure function of the samples: deterministic and unit-testable. Times are relative to the clip start. */
export interface AlignedWord { word: string; start: number; end: number }

const strip = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Rough number of syllables of a Portuguese token: vowel groups, digits read as one beat per digit group. */
export function syllables(word: string): number {
  const w = strip(word).replace(/[^a-z0-9]/g, ''); if (!w) return 1;
  const groups = (w.match(/[aeiouy]+/g) ?? []).length + (w.match(/\d+/g) ?? []).length * 2;
  return Math.max(1, groups);
}
const FUNCTION_WORDS = new Set('a o as os um uma uns umas e de da do das dos em no na nos nas por pelo pela com sem que se ao aos à ou mas ja já foi era so só me te lhe seu sua'.split(' '));
/** Relative time a word takes to say: syllables, lighter for small function words, heavier for a long final word. */
export const wordWeight = (word: string) => { const n = syllables(word), bare = strip(word).replace(/[^a-z0-9]/g, ''); return FUNCTION_WORDS.has(bare) ? .55 : n + (n > 2 ? .25 : 0); };
const hasPause = (word: string) => /[.!?…,;:]$/.test(word);

/** Loudness per `hop` seconds (RMS over a 2-hop window). */
export function envelope(samples: ArrayLike<number>, sampleRate: number, hop = .01): Float64Array {
  const n = Math.max(1, Math.floor(samples.length / (hop * sampleRate))), size = Math.max(1, Math.round(hop * sampleRate)), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let sum = 0, count = 0; for (let k = i * size; k < Math.min(samples.length, (i + 2) * size); k++) { sum += samples[k]! * samples[k]!; count++; } out[i] = Math.sqrt(sum / Math.max(1, count)); }
  return out;
}

export interface AlignOptions { bounds?: { start: number; end: number }; hop?: number; /** shortest silence (s) treated as a real pause */ minPause?: number; /** how far (s) a boundary may move to a loudness valley */ reach?: number }

export function alignWords(samples: ArrayLike<number>, sampleRate: number, words: string[], options: AlignOptions = {}): AlignedWord[] {
  if (!words.length) return [];
  const hop = options.hop ?? .01, env = envelope(samples, sampleRate, hop), duration = samples.length / sampleRate;
  const peak = env.reduce((m, v) => Math.max(m, v), 0) || 1, quiet = peak * .05;
  const bounds = options.bounds;
  let a = bounds ? Math.round(bounds.start / hop) : env.findIndex((v) => v > quiet), b = bounds ? Math.round(bounds.end / hop) : env.length - 1 - [...env].reverse().findIndex((v) => v > quiet);
  if (a < 0 || b <= a) { a = 0; b = env.length - 1; }
  // 1) real pauses inside the speech: silent runs, which is where the narrator obeys the punctuation
  const minRun = Math.round((options.minPause ?? .11) / hop), pauses: { from: number; to: number }[] = [];
  for (let i = a; i <= b;) { if (env[i]! >= quiet) { i++; continue; } let j = i; while (j <= b && env[j]! < quiet) j++; if (i > a && j <= b && j - i >= minRun) pauses.push({ from: i, to: j }); i = j + 1; }
  const stops = words.flatMap((w, i) => i < words.length - 1 && hasPause(w) ? [i] : []); // boundary i sits after word i
  // 2) pair pauses with punctuation: exact when the counts agree, otherwise the longest ones in order
  const anchor = new Map<number, { end: number; start: number }>();
  const pick = pauses.length > stops.length ? [...pauses].sort((x, y) => (y.to - y.from) - (x.to - x.from)).slice(0, stops.length).sort((x, y) => x.from - y.from) : pauses;
  if (pick.length === stops.length) stops.forEach((w, k) => anchor.set(w, { end: pick[k]!.from, start: pick[k]!.to }));
  // 3) inside each phrase, share the time by syllable weight, then ease every cut to the nearest loudness valley
  const weight = words.map(wordWeight), starts: number[] = new Array(words.length), ends: number[] = new Array(words.length);
  const phrases: [number, number][] = []; let from = 0;
  for (let i = 0; i < words.length; i++) if (anchor.has(i) || i === words.length - 1) { phrases.push([from, i]); from = i + 1; }
  const reachBase = Math.round((options.reach ?? .06) / hop);
  phrases.forEach(([first, last]) => {
    const left = first === 0 ? a : anchor.get(first - 1)!.start, right = last === words.length - 1 ? b + 1 : anchor.get(last)!.end;
    const sum = weight.slice(first, last + 1).reduce((x, y) => x + y, 0); let acc = 0; const cuts: number[] = [left];
    for (let i = first; i < last; i++) {
      acc += weight[i]!; const ideal = left + (right - left) * acc / sum, reach = Math.min(reachBase, Math.round((right - left) * weight[i]! / sum * .4));
      const lo = Math.max(cuts[cuts.length - 1]! + 2, Math.round(ideal - reach)), hi = Math.min(right - 2 * (last - i), Math.round(ideal + reach));
      let best = Math.round(ideal), score = Infinity;
      for (let k = lo; k <= hi; k++) { const s = env[k]! / peak + Math.abs(k - ideal) / (reach * 6 + 1); if (s < score) { score = s; best = k; } }
      cuts.push(Math.min(Math.max(best, cuts[cuts.length - 1]! + 1), right - 1));
    }
    cuts.push(right);
    for (let i = first; i <= last; i++) { starts[i] = cuts[i - first]!; ends[i] = cuts[i - first + 1]!; }
  });
  return words.map((word, i) => ({ word, start: Math.min(duration, starts[i]! * hop), end: Math.min(duration, Math.max(ends[i]!, starts[i]! + 1) * hop) }));
}
