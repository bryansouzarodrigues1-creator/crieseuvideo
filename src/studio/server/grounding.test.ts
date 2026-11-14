import { expect, it } from 'vitest';
import { groundScenes, sourceBeats } from './grounding';

it('orders by source identity without swapping art between opposite actions', () => {
  const beats = sourceBeats('Ana deu o livro a Bruno. Bruno devolveu o livro a Ana.');
  const result = groundScenes([{ sourceId: 's2', visual: 'return' }, { sourceId: 's1', visual: 'offer' }], beats)!;
  expect(result.map((s) => s.visual)).toEqual(['offer', 'return']);
  expect(result.map((s) => s.text).join(' ')).toBe(beats.map((b) => b.text).join(' '));
});
it('rejects negation changes and reversed legacy lines', () => {
  const beats = sourceBeats('Ela não correu. Ela ficou parada.');
  expect(groundScenes([{ text: 'Ela correu.' }, { text: 'Ela ficou parada.' }], beats)).toBeNull();
  expect(groundScenes([{ text: 'Ela ficou parada.' }, { text: 'Ela não correu.' }], beats)).toBeNull();
});
it('rejects duplicate, missing, mixed and fabricated source IDs', () => {
  const b = sourceBeats('Primeira. Segunda.');
  for (const raw of [[{ sourceId: 's1' }, { sourceId: 's1' }], [{ sourceId: 's1' }],
    [{ sourceId: 's1' }, { text: 'Segunda.' }], [{ sourceId: 's1' }, { sourceId: 's99' }]]) {
    expect(groundScenes(raw, b)).toBeNull();
  }
});
it('rejects a valid ID that contradicts its original phrase', () => {
  expect(groundScenes([{ sourceId: 's1', text: 'Ela correu.' }], sourceBeats('Ela não correu.'))).toBeNull();
});
