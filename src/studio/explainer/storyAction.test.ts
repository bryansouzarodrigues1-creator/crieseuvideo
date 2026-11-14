import { describe, expect, it } from 'vitest';
import { normalizeStory, storyFrame, type StoryScene } from './storyAction';
import { normalizePlan } from './plan';

const phrase = 'Lia pegou uma lanterna e entregou para Caio.';
const raw = {
  action: 'handoff', prop: 'lantern',
  actors: [{ name: 'Lia', color: '#FFB447' }, { name: 'Caio', color: '#4AC6BE' }],
};
const scene = (): StoryScene => {
  const found = normalizeStory(raw, phrase);
  if (!found) throw new Error('The expected story was not normalized.');
  return found;
};

describe('literal story action validation', () => {
  it('accepts the explicitly stated Lia-to-Caio handoff and pickup', () => {
    expect(scene()).toEqual({ ...raw, pickupFirst: true });
  });
  it('rejects a reversed giver or receiver', () => {
    const reversed = { ...raw, actors: [...raw.actors].reverse() };
    expect(normalizeStory(reversed, phrase)).toBeUndefined();
  });
  it('does not animate an action that the story negates', () => {
    expect(normalizeStory(raw, 'Lia não entregou a lanterna para Caio.')).toBeUndefined();
    expect(normalizeStory(raw, 'Lia nunca pegou a lanterna e entregou para Caio.')).toBeUndefined();
  });
  it('refuses incorrect props and invented participant names', () => {
    expect(normalizeStory({ ...raw, prop: 'hat' }, phrase)).toBeUndefined();
    expect(normalizeStory({ ...raw, actors: [{ name: 'Bia' }, { name: 'Caio' }] }, phrase)).toBeUndefined();
  });
  it('ignores unsupported actions without changing the spoken scene', () => {
    const plan = normalizePlan({ scenes: [{ text: phrase, visual: 'custom', story: { ...raw, action: 'teleport' } }] }, phrase, '9:16');
    expect(plan.scenes[0].story).toBeUndefined();
    expect(plan.scenes.map((s) => s.text).join(' ')).toBe(phrase);
  });
  it('routes a story scene to the custom renderer without AI-drawn shapes', () => {
    const plan = normalizePlan({ scenes: [{ text: phrase, visual: 'custom', story: raw }] }, phrase, '16:9');
    expect(plan.scenes).toHaveLength(1);
    expect(plan.scenes[0].visual).toBe('custom');
    expect(plan.scenes[0].story?.action).toBe('handoff');
    expect(plan.scenes[0].drawing).toBeUndefined();
  });
});

describe('deterministic two-person prop choreography', () => {
  it('moves from the floor to Lia, then transfers possession exactly once to Caio', () => {
    const spec = scene(), D = 8;
    const start = storyFrame(spec, 0, D), lifted = storyFrame(spec, D * .3, D);
    const contact = storyFrame(spec, D * .53, D), handed = storyFrame(spec, D * .6, D);
    const finish = storyFrame(spec, D, D);
    expect(start.prop.owner).toBeNull();
    expect(start.prop.y).toBeGreaterThan(100);
    expect(lifted.prop.owner).toBe(0);
    expect(lifted.prop.y).toBeLessThan(0);
    expect(contact.touching).toEqual([true, true]);
    expect(contact.prop.owner).toBe(0);
    expect(handed.prop.owner).toBe(1);
    expect(finish.prop.owner).toBe(1);
    expect(finish.actors[1].x).toBeGreaterThan(contact.actors[1].x);
  });
  it('does not teleport the prop when its owner changes', () => {
    const spec = scene(), D = 8;
    const before = storyFrame(spec, D * .5799, D).prop;
    const after = storyFrame(spec, D * .5801, D).prop;
    expect(before.owner).toBe(0);
    expect(after.owner).toBe(1);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  });
  it('is independent of render order and stable for seeking/replaying', () => {
    const spec = scene();
    const forward = storyFrame(spec, 3.3, 8);
    storyFrame(spec, 8, 8); storyFrame(spec, .1, 8);
    expect(storyFrame(spec, 3.3, 8)).toEqual(forward);
  });
  it('keeps props and actors inside the stage for sampled frames', () => {
    for (const t of Array.from({ length: 161 }, (_, i) => i / 20)) {
      const frame = storyFrame(scene(), t, 8);
      expect(Math.abs(frame.prop.x)).toBeLessThanOrEqual(325);
      expect(frame.prop.y).toBeGreaterThanOrEqual(-250);
      expect(frame.prop.y).toBeLessThanOrEqual(220);
      for (const actor of frame.actors) expect(Math.abs(actor.x)).toBeLessThanOrEqual(295);
    }
  });
  it('also supports a one-person pickup and a separate hat chase', () => {
    const pickup = normalizeStory({ action: 'pickup', prop: 'ball', actors: [{ name: 'Lia' }] }, 'Lia pegou a bola.');
    const chase = normalizeStory({ action: 'chase', prop: 'hat', actors: [{ name: 'Caio' }] }, 'Caio correu atrás do chapéu.');
    expect(pickup).toBeDefined();
    expect(chase).toBeDefined();
    expect(storyFrame(pickup!, 8, 8).prop.owner).toBe(0);
    expect(storyFrame(chase!, 8, 8).prop.owner).toBeNull();
    expect(storyFrame(chase!, 8, 8).actors[0].x).toBeGreaterThan(storyFrame(chase!, 0, 8).actors[0].x);
  });
});
