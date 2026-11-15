import type { ExplainerPlan } from '../src/studio/explainer/plan';
import { normalizeTargetDuration } from '../src/studio/explainer/duration';
import { spokenText } from '../src/studio/explainer/script';

export const PROJECT_KEY = 'crieseuvideo-lab-v1', DRAFT_KEY = 'crieseuvideo-lab-draft-v2';
export const LAB_SAMPLE = 'Ele recebeu uma mensagem no celular. A novidade fez o coração disparar. Ele correu pela rua para contar aos amigos. No escritório, o gráfico subia sem parar. Mas uma pergunta mudou tudo: e agora?';
const LEGACY_STORY = 'Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que segura o objeto e sorri.';
export interface LabDraft { script: string; aspect: '9:16' | '16:9'; engine: '2d' | '3d'; targetDuration?: number; directionMode?: 'program' | 'catalogue' }
export interface StoredLabProject { script: string; plan: ExplainerPlan; source?: string; engine?: string; aspect?: string; createdByUser?: boolean; directionMode?: 'program' | 'catalogue' }
type Reader = Pick<Storage, 'getItem'>;
function read(storage: Reader, key: string): any {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}
function draft(value: any): LabDraft | null {
  if (!value || typeof value.script !== 'string' || value.script.length > 6000) return null;
  let duration: number | undefined;
  try { duration = normalizeTargetDuration(value.targetDuration ?? value.plan?.targetDuration); } catch {}
  return { script: value.script, aspect: value.aspect === '16:9' ? '16:9' : '9:16', engine: value.engine === '2d' ? '2d' : '3d', targetDuration: duration, ...(['program', 'catalogue'].includes(value.directionMode) ? { directionMode: value.directionMode } : {}) };
}
/** Recover text/settings, never auto-apply a preview or delete an older project. */
export function recoverLabSession(storage: Reader): { draft: LabDraft; project: StoredLabProject | null } {
  const saved = read(storage, PROJECT_KEY), current = draft(read(storage, DRAFT_KEY));
  const previous = draft(saved);
  const legacyExample = previous && !saved.createdByUser && [LAB_SAMPLE, LEGACY_STORY].some((text) => spokenText(text) === spokenText(previous.script));
  const scenes = Array.isArray(saved?.plan?.scenes) ? saved.plan.scenes : [];
  const matches = previous && scenes.length > 0 && scenes.every((scene: any) => typeof scene?.text === 'string')
    && spokenText(scenes.map((scene: any) => scene.text).join(' ')) === spokenText(previous.script);
  return {
    draft: current ?? (previous && !legacyExample ? previous : { script: '', aspect: '9:16', engine: '3d' }),
    project: previous && matches && !legacyExample ? saved as StoredLabProject : null,
  };
}
