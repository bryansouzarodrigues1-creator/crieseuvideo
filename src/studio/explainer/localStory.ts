import { normalizeStory, type StoryScene } from './storyAction';

/** Deliberately narrow free rehearsal grammar. It never pretends to be Gemini.
 * A named subject starts the phrase, and the named recipient follows "para".
 * Existing literal validation rejects negations, reversed roles and hypotheticals.
 */
export function localStory(text: string): StoryScene | undefined {
  const giver = text.match(/^\s*([A-ZÀ-Ý][\p{L}'-]{1,23})\b/u)?.[1];
  const recipient = text.match(/\b(?:entreg[\p{L}]*|passou|deu|transfer[\p{L}]*)\b[\s\S]*?\bpara\s+([A-ZÀ-Ý][\p{L}'-]{1,23})\b/u)?.[1];
  if (!giver || !recipient || ['Ele', 'Ela', 'Você', 'Voce', 'Eu', 'Nós', 'Nos', 'Se', 'Depois', 'Quando', 'Hoje', 'Ontem'].includes(giver)) return;
  const story = normalizeStory({ action: 'handoff', prop: 'lantern', performance: 'grounded-v1', actors: [{ name: giver }, { name: recipient }] }, text);
  return story?.performance ? story : undefined;
}
