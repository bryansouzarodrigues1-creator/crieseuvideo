import { expect, it } from 'vitest';
import * as THREE from 'three';
import { inferStaging, normalizeStaging, STAGED_ACTIONS } from './staging';
import { buildFallbackPlan, normalizePlan } from './plan';
import { Narrative3D, narrativeFoot } from './narrative3d';

const sample = 'Ele recebeu uma mensagem no celular. A novidade fez o coração disparar. Ele correu pela rua para contar aos amigos. No escritório, o gráfico subia sem parar. Mas uma pergunta mudou tudo: e agora?';
it('stages every ordinary sample sentence by its verb rather than placing images on a presenter board', () => {
  const p = buildFallbackPlan(sample);
  expect(p.scenes.map((s) => s.staging?.action)).toEqual(['phone', 'heartbeat', 'run', 'growth', 'question']);
  expect(p.scenes[2].staging?.friends).toBe(2);
  expect(p.scenes[2].setting).toBe('city_day');
  expect(p.scenes.map((s) => s.text).join(' ')).toBe(sample);
});
it('the normal AI response path also compiles the screen-recording topic to an object metaphor', () => {
  const text = 'Esse foi o maior esquema de corrupção.';
  const p = normalizePlan({ scenes: [{ text, visual: 'custom', drawing: [{ type: 'stamp', text: 'LAVA JATO' }] }] }, text, '9:16');
  expect(p.scenes[0].staging?.action).toBe('money_flow');
  expect(p.scenes[0].staging?.metaphor).toBe(true);
  expect(p.scenes[0].text).toBe(text);
  const s = new Narrative3D(p.scenes[0], new THREE.Group()); s.update(2, 30);
  expect(s.diagnostics()).toMatchObject({ action: 'money_flow', actors: 0, board: false }); s.dispose();
});
it('preserves a named protagonist across pronoun-led scenes', () => {
  const p = buildFallbackPlan('Nina recebeu uma mensagem no celular. Ela correu pela rua. Ela abriu o computador.');
  expect(p.scenes.map((s) => s.staging?.actor.name)).toEqual(['Nina', 'Nina', 'Nina']);
  expect(new Set(p.scenes.map((s) => s.staging?.actor.color)).size).toBe(1);
});
it('does not enact negated/conditional motion, invent an animal rig or accept unsupported AI actions', () => {
  expect(inferStaging('Ele não correu pela rua.')?.action).toBe('wait');
  expect(inferStaging('Se ele corresse pela rua.')).toBeUndefined();
  expect(inferStaging('O leão correu pela rua.')).toBeUndefined();
  expect(inferStaging('Não houve corrupção.')).toBeUndefined();
  expect(normalizeStaging({ action: 'fly' }, 'Ele correu pela rua.')).toBeUndefined();
  expect(normalizeStaging({ action: 'run' }, 'Ele recebeu uma mensagem.')).toBeUndefined();
});
it('world support points remain planted while the running or walking root travels', () => {
  for (const running of [false, true]) for (const side of [-1, 1] as const) for (let distance = 0; distance < 12; distance += .01) {
    const a = narrativeFoot(distance, side, -3, running), b = narrativeFoot(distance + .001, side, -3, running);
    if (a.planted && b.planted) expect(a.position.distanceTo(b.position)).toBeLessThan(1e-9);
    expect(a.position.y).toBeGreaterThanOrEqual(.064);
  }
});
it('all narrative actions animate actual scene nodes and reproduce after out-of-order seeking', () => {
  const phrases = ['Ele recebeu uma mensagem no celular.', 'O coração disparou.', 'Ele caminhou.', 'Ele correu para os amigos.',
    'Ele digitou no computador.', 'O gráfico cresceu.', 'O esquema de corrupção.', 'Uma pergunta surgiu.', 'Ele ficou parado.', 'Três meses depois.'];
  const actions = new Set();
  for (const text of phrases) {
    const scene = buildFallbackPlan(text).scenes[0]; expect(scene.staging).toBeDefined(); actions.add(scene.staging!.action);
    const world = new THREE.Group(), s = new Narrative3D(scene, world);
    const snapshot = () => { world.updateWorldMatrix(true, true); const out: number[] = []; world.traverse((o) => out.push(...o.matrixWorld.elements)); return out; };
    s.update(2.2, 8); const initial = snapshot();
    expect(s.diagnostics().maxContactError, scene.staging!.action).toBeLessThan(.001);
    s.update(7.2, 8); const after = snapshot(); expect(after.some((x, i) => Math.abs(x - initial[i]) > .00001)).toBe(true);
    s.update(.1, 8); s.update(2.2, 8);
    expect(Math.max(...snapshot().map((x, i) => Math.abs(x - initial[i]))), scene.staging!.action).toBeLessThan(1e-9);
    s.dispose();
  }
  expect(actions.size).toBe(STAGED_ACTIONS.length);
});
it('the phone screen faces the reader while the camera can move over their shoulder', () => {
  const scene = buildFallbackPlan('Ele recebeu uma mensagem no celular.').scenes[0];
  const stage = new Narrative3D(scene, new THREE.Group()); stage.update(3, 10);
  expect(stage.diagnostics().phoneFacingReader).toBe(true);
  expect(stage.camera(9 / 16).pos.z).toBeLessThan(0);
  stage.dispose();
});
it('a graph described as continuously rising keeps growing through the last frames', () => {
  const scene = buildFallbackPlan('No escritório, o gráfico subia sem parar.').scenes[0];
  const stage = new Narrative3D(scene, new THREE.Group()); stage.update(9, 10);
  const before = stage.diagnostics().barHeights;
  stage.update(9.99, 10);
  stage.diagnostics().barHeights.forEach((h, i) => expect(h).toBeGreaterThan(before[i]));
  stage.dispose();
});
