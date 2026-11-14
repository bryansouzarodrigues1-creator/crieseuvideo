import { expect, it } from 'vitest';
import { localStory } from './localStory';
import { buildFallbackPlan, sceneDuration } from './plan';

it('rehearses a new named lantern story from the input itself without an AI plan', () => {
  for (const [a, b] of [['Nina', 'Rui'], ['Caio', 'Lia'], ['Álvaro', 'João']]) {
    const text = `${a} caminha, agacha-se, pega a lanterna e entrega para ${b}, que sorri.`;
    const scene = buildFallbackPlan(text).scenes[0];
    expect(scene.text).toBe(text); expect(sceneDuration(scene)).toBe(18);
    expect(scene.story?.actors.map((actor) => actor.name)).toEqual([a, b]);
    expect(scene.story?.performance).toBe('grounded-v1');
  }
});
it('does not fabricate floor pickups from negated, hypothetical or handoff-only stories', () => {
  for (const text of ['Nina não pega a lanterna e entrega para Rui.', 'Se Nina pega a lanterna e entrega para Rui.',
    'Nina entrega a lanterna para Rui.', 'Ele pega a lanterna e entrega para Rui.']) expect(localStory(text)).toBeUndefined();
});
it('leaves unsupported objects and unnamed or ambiguous participants in the existing rehearsal path', () => {
  for (const text of ['Nina pega a bola e entrega para Rui.', 'Nina pega a lanterna e entrega para alguém.',
    'Rui pegou a lanterna e Nina entregou para Rui.']) expect(localStory(text)).toBeUndefined();
});
