import { scriptScenes, spokenText } from '../explainer/script';

export interface SourceBeat { sourceId: string; text: string }

export function sourceBeats(script: string): SourceBeat[] {
  return scriptScenes(script).map((text, i) => ({ sourceId: `s${i + 1}`, text }));
}

export function beatChunks(beats: SourceBeat[]): SourceBeat[][] {
  const chunks: SourceBeat[][] = [];
  let current: SourceBeat[] = [], chars = 0;
  for (const beat of beats) {
    if (current.length && chars + beat.text.length > 1200) { chunks.push(current); current = []; chars = 0; }
    current.push(beat); chars += beat.text.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Source identity owns chronology. Never redistribute words onto unrelated art. */
export function groundScenes(raw: Record<string, any>[], beats: SourceBeat[]): Record<string, any>[] | null {
  if (raw.some((s) => s.sourceId !== undefined)) {
    if (!raw.every((s) => typeof s.sourceId === 'string') || raw.length !== beats.length ||
        new Set(raw.map((s) => s.sourceId)).size !== raw.length) return null;
    const byId = new Map(raw.map((s) => [s.sourceId, s]));
    if (beats.some((b) => !byId.has(b.sourceId))) return null;
    // A model may omit text to save output tokens. If it supplies text, it must
    // describe that source ID exactly, rather than contradicting the ID.
    if (beats.some((b) => byId.get(b.sourceId)!.text !== undefined &&
        spokenText(String(byId.get(b.sourceId)!.text)) !== spokenText(b.text))) return null;
    return beats.map((b) => ({ ...byId.get(b.sourceId), sourceId: b.sourceId, text: b.text }));
  }
  // Old directors remain compatible only with an already exact ordered script.
  return spokenText(raw.map((s) => s.text ?? '').join(' ')) === spokenText(beats.map((b) => b.text).join(' ')) ? raw : null;
}
