// Narration: one natural TTS clip per scene; clips are cached in the browser so replays and edits of other scenes never re-bill.
export const NARRATION_VOICES = [
  { id: "Algieba", label: "Charmoso (Patrick)" },
  { id: "Charon", label: "Masculina grave" },
  { id: "Puck", label: "Masculina animada" },
  { id: "Kore", label: "Feminina firme" },
  { id: "Aoede", label: "Feminina leve" },
] as const;

const CACHE = "stickstory-voice-v1";
const memo = new Map<string, AudioBuffer>();

async function hash(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Voice key: Gemini voice name, or "eleven:<voiceId>" for a cloned ElevenLabs voice. */
export async function getNarration(ctx: BaseAudioContext, text: string, voice: string): Promise<AudioBuffer> {
  const eleven = voice.startsWith("eleven:") ? voice.slice(7) : null;
  const id = await hash(`${voice}|${text.trim()}`);
  const hit = memo.get(id); if (hit) return hit;
  const url = `/__voice/${id}.wav`;
  const cache = typeof caches !== "undefined" ? await caches.open(CACHE).catch(() => null) : null;
  let res = cache ? await cache.match(url) : undefined;
  if (!res) {
    const r = await fetch("/api/ai/narrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eleven ? { text, provider: "elevenlabs", voiceId: eleven } : { text, voice }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw Object.assign(new Error(e.error || "Falha na voz."), { status: r.status }); }
    const blob = await r.blob();
    if (cache) await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "audio/wav" } })).catch(() => {});
    res = new Response(blob);
  }
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  memo.set(id, buf);
  return buf;
}

/**
 * Restore an existing narration only from local memory / Cache Storage.
 * Never calls /api/ai/narrate, so opening or exporting a saved project cannot
 * accidentally regenerate paid TTS when the cached WAV was evicted.
 */
export async function getCachedNarration(ctx: BaseAudioContext, text: string, voice: string): Promise<AudioBuffer | null> {
  const id = await hash(`${voice}|${text.trim()}`);
  const hit = memo.get(id);
  if (hit) return hit;
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open(CACHE).catch(() => null);
  const res = cache ? await cache.match(`/__voice/${id}.wav`).catch(() => undefined) : undefined;
  if (!res) return null;
  try {
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    memo.set(id, buffer);
    return buffer;
  } catch {
    return null;
  }
}

/** Trim leading/trailing near-silence so captions line up with the spoken words. */
export function speechBounds(buf: AudioBuffer, threshold = 0.02) {
  const d = buf.getChannelData(0); let a = 0, b = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < threshold) a++;
  while (b > a && Math.abs(d[b]) < threshold) b--;
  return { start: a / buf.sampleRate, end: (b + 1) / buf.sampleRate };
}
