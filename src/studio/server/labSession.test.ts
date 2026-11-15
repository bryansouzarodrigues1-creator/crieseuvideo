import { describe, expect, it } from 'vitest';
import { recoverLabSession, PROJECT_KEY, DRAFT_KEY, LAB_SAMPLE } from '../../../lab/session';
import { buildFallbackPlan } from '../explainer/plan';

const storage = (records: Record<string, string>) => ({ getItem: (key: string) => records[key] ?? null });
const saved = (script: string) => ({ script, plan: buildFallbackPlan(script), source: 'ENSAIO LOCAL' });
describe('laboratory drafts and explicit project restoration', () => {
  it('starts with empty text and no project on a first visit', () => {
    expect(recoverLabSession(storage({}))).toMatchObject({ draft: { script: '', engine: '3d', aspect: '9:16' }, project: null });
  });
  it('ignores the legacy automatic example without deleting it', () => {
    const records = { [PROJECT_KEY]: JSON.stringify(saved(LAB_SAMPLE)) }, before = records[PROJECT_KEY];
    expect(recoverLabSession(storage(records))).toMatchObject({ draft: { script: '' }, project: null });
    expect(records[PROJECT_KEY]).toBe(before);
  });
  it('recovers a user project as an explicit resume candidate', () => {
    const value = saved('Ana recebeu uma mensagem no celular.');
    const result = recoverLabSession(storage({ [PROJECT_KEY]: JSON.stringify(value) }));
    expect(result.draft.script).toBe(value.script); expect(result.project?.script).toBe(value.script);
  });
  it('keeps a changed game-story draft separate from the previous generated plan', () => {
    const current = 'Ele achou que conseguia vencer uma partida de clash royale mas não sabia quem era seu adversário';
    const previous = saved('Eu sou o maior jogador do mundo hahahaha');
    const records = { [PROJECT_KEY]: JSON.stringify(previous), [DRAFT_KEY]: JSON.stringify({ script: current, engine: '3d', aspect: '9:16', targetDuration: 30 }) };
    const result = recoverLabSession(storage(records));
    expect(result.draft).toMatchObject({ script: current, targetDuration: 30 });
    expect(result.project?.script).toBe(previous.script);
    expect(JSON.parse(records[PROJECT_KEY])).toEqual(previous);
  });
  it('keeps the typed script but does not offer a mismatched legacy preview', () => {
    const value = { ...saved(LAB_SAMPLE), script: 'Meu roteiro sobre um jogo.' };
    expect(recoverLabSession(storage({ [PROJECT_KEY]: JSON.stringify(value) }))).toMatchObject({ draft: { script: value.script }, project: null });
  });
  it('keeps a deliberately created example available for explicit reopening', () => {
    const value = { ...saved(LAB_SAMPLE), createdByUser: true };
    expect(recoverLabSession(storage({ [PROJECT_KEY]: JSON.stringify(value) })).project?.script).toBe(LAB_SAMPLE);
  });
  it('keeps an intentionally cleared draft empty and preserves the last project', () => {
    const value = saved('Ana caminhou.');
    const result = recoverLabSession(storage({ [PROJECT_KEY]: JSON.stringify(value), [DRAFT_KEY]: JSON.stringify({ script: '', aspect: '16:9', engine: '2d' }) }));
    expect(result.draft).toMatchObject({ script: '', aspect: '16:9', engine: '2d' });
    expect(result.project?.script).toBe(value.script);
  });
  it('does not create a fallback video when storage is blocked or corrupt', () => {
    expect(recoverLabSession({ getItem() { throw new Error('blocked'); } }).draft.script).toBe('');
    expect(recoverLabSession(storage({ [PROJECT_KEY]: '{broken', [DRAFT_KEY]: 'null' })).project).toBeNull();
  });
});
