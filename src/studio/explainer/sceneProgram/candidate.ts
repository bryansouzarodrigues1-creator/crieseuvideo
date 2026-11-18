import type { ProgramSource } from './score';

/** Rejected JSON is feedback data only. It is never accepted as a render plan. */
export interface SceneProgramCandidate { sourceSignature: string; program: Record<string, unknown> }
const signature = (sources: ProgramSource[]) => JSON.stringify(sources.map((s) => [s.sourceId, s.text]));
function boundedProgram(value: unknown): value is Record<string, unknown> {
  try { return !!value && typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= 90000; } catch { return false; }
}
export function makeSceneProgramCandidate(program: unknown, sources: ProgramSource[]): SceneProgramCandidate | undefined {
  return boundedProgram(program) ? { sourceSignature: signature(sources), program } : undefined;
}
export function readSceneProgramCandidate(value: unknown, sources?: ProgramSource[]): SceneProgramCandidate | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((key) => !['sourceSignature', 'program'].includes(key)) || typeof r.sourceSignature !== 'string' || r.sourceSignature.length > 12000 || !boundedProgram(r.program)) return;
  if (sources && r.sourceSignature !== signature(sources)) return;
  return { sourceSignature: r.sourceSignature, program: r.program };
}
