import { describe, it, expect } from 'vitest';
import { fallbackDirection, normalizeDirection, mergeDirections, varyShots, ensureDirections, DEFAULT_DIRECTION } from './direction';
import { ACTION_IDS, CAMERA_MOVE_IDS, ENVIRONMENT_IDS, OUTFIT_IDS } from './catalog';
import { EXAMPLE_DIRECTION, EXAMPLE_TEXT, directionPrompt, directionSchema } from './prompt';

describe('fallbackDirection', () => {
  it('directs the reference Everest scene as a snowy summit with flag and yellow jacket', () => {
    const d = fallbackDirection('Ele conseguiu escalar o monte Everest, mas...');
    expect(d.environment).toBe('summit');
    expect(d.outfit).toBe('yellow_jacket');
    expect(d.entrance).toBe('rise_from_below');
    expect(d.props).toContain('flag');
    expect(d.board).toBe(false);
  });
  it('maps meaning to action and expression without AI', () => {
    expect(fallbackDirection('Ele pegou o celular e leu a mensagem').action).toBe('hold_phone');
    expect(fallbackDirection('Ele faturou muito dinheiro').action).toBe('hold_coins');
    expect(fallbackDirection('Ele correu pela estrada').action).toBe('run');
    expect(fallbackDirection('Ficou furioso com tudo').expression).toBe('angry');
  });
  it('is pure: never shares arrays with the default', () => {
    const a = fallbackDirection('Oi');
    a.props.push('tent');
    expect(DEFAULT_DIRECTION.props).toHaveLength(0);
  });
});

describe('normalizeDirection', () => {
  it('keeps valid values and reports nothing to repair', () => {
    const r = normalizeDirection(EXAMPLE_DIRECTION, EXAMPLE_TEXT);
    expect(r.repaired).toEqual([]);
    expect(r.direction.environment).toBe('summit');
  });
  it('replaces invented values with a safe default and says which ones', () => {
    const r = normalizeDirection({ environment: 'moon_base', action: 'fly', cameraMove: 'barrel_roll', props: ['flag', 'dragon'], intensity: 'muito' }, 'Ele foi à praia');
    expect(r.repaired).toEqual(expect.arrayContaining(['environment', 'action', 'cameraMove', 'props', 'intensity']));
    expect(ENVIRONMENT_IDS).toContain(r.direction.environment);
    expect(ACTION_IDS).toContain(r.direction.action);
    expect(CAMERA_MOVE_IDS).toContain(r.direction.cameraMove);
    expect(r.direction.props).toEqual(['flag']);
  });
  it('never throws on garbage input', () => {
    for (const raw of [null, undefined, 5, 'x', [], { props: 3, unsupported: 7 }]) {
      expect(() => normalizeDirection(raw, 'texto')).not.toThrow();
    }
  });
  it('clamps intensity and caps the unsupported list', () => {
    const r = normalizeDirection({ intensity: 9, unsupported: ['a', 'b', 'c', 'd', 'e', 'f', ' ', 3] }, 'x');
    expect(r.direction.intensity).toBe(1);
    expect(r.direction.unsupported).toHaveLength(5);
  });
  it('cannot point at a board that is hidden', () => {
    const r = normalizeDirection({ action: 'point_at_board', board: false }, 'x');
    expect(r.direction.action).toBe('talk');
  });
  it('only ever yields catalog outfits', () => {
    expect(OUTFIT_IDS).toContain(normalizeDirection({ outfit: 'tuxedo' }, 'x').direction.outfit);
  });
});

describe('mergeDirections', () => {
  it('uses AI answers by index and falls back for scenes the AI skipped', () => {
    const texts = ['Ele escalou o monte', 'Depois foi ao escritório'];
    const m = mergeDirections(texts, { directions: [{ index: 1, environment: 'office', action: 'idle', entrance: 'none', expression: 'neutral', cameraMove: 'pull_out', shot: 'wide', intensity: 0.5, board: true }] });
    expect(m.fromAi).toBe(1);
    expect(m.directions[0]!.environment).toBe('summit');
    expect(m.directions[1]!.cameraMove).toBe('pull_out');
  });
  it('ignores out-of-range, duplicate and non-integer indexes', () => {
    const m = mergeDirections(['a'], { directions: [{ index: 5 }, { index: 'x' }, { index: 0, environment: 'beach' }, { index: 0, environment: 'night' }] });
    expect(m.fromAi).toBe(1);
    expect(m.directions[0]!.environment).toBe('beach');
  });
  it('returns pure fallback when the AI gave nothing', () => {
    const m = mergeDirections(['Ele escalou o monte'], null);
    expect(m.fromAi).toBe(0);
    expect(m.directions).toHaveLength(1);
  });
});

describe('shot variety', () => {
  it('never repeats the same move and shot in consecutive scenes', () => {
    const same = { ...DEFAULT_DIRECTION, cameraMove: 'push_in' as const, shot: 'medium' as const };
    const out = varyShots([same, same, same, same]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.cameraMove === out[i - 1]!.cameraMove && out[i]!.shot === out[i - 1]!.shot).toBe(false);
    }
  });
  it('keeps static cameras as asked', () => {
    const s = { ...DEFAULT_DIRECTION, cameraMove: 'static' as const };
    expect(varyShots([s, s]).every((d) => d.cameraMove === 'static')).toBe(true);
  });
  it('ensureDirections fills only the missing ones and keeps scene text', () => {
    const kept = { ...DEFAULT_DIRECTION, environment: 'beach' as const };
    const out = ensureDirections([{ text: 'a', direction: kept }, { text: 'Ele escalou o monte' }]);
    expect(out[0]!.direction).toBe(kept);
    expect(out[1]!.direction!.environment).toBe('summit');
    expect(out.map((s) => s.text)).toEqual(['a', 'Ele escalou o monte']);
  });
});

describe('prompt and schema stay in sync with the catalog', () => {
  it('schema enums list exactly the catalog ids', () => {
    const items = (directionSchema(3).properties.directions as any).items.properties;
    expect(items.environment.enum).toEqual(ENVIRONMENT_IDS);
    expect(items.action.enum).toEqual(ACTION_IDS);
    expect(items.cameraMove.enum).toEqual(CAMERA_MOVE_IDS);
    expect(items.outfit.enum).toEqual(OUTFIT_IDS);
  });
  it('prompt lists every scene by index and forbids rewriting text', () => {
    const p = directionPrompt(['um', 'dois']);
    expect(p).toContain('0: um');
    expect(p).toContain('1: dois');
    expect(p).toMatch(/Não escreva nem altere o texto/);
  });
  it('the few-shot example itself passes validation untouched', () => {
    expect(normalizeDirection(EXAMPLE_DIRECTION, EXAMPLE_TEXT).repaired).toEqual([]);
  });
});
