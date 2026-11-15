import { expect, it } from 'vitest';
import * as THREE from 'three';
import { inferStaging, normalizeStaging, STAGED_ACTIONS } from './staging';
import { buildFallbackPlan, normalizePlan } from './plan';
import { Narrative3D, narrativeFoot } from './narrative3d';

it('accepts the question action observed in the authorized real Gemini response', () => {
  const text = 'Ele achou que conseguia vencer uma partida de clash royale mas não sabia quem era seu adversário';
  expect(normalizeStaging({ action: 'question' }, text)?.action).toBe('question');
  const plan = normalizePlan({ scenes: [{ sourceId: 's1', text, visual: 'character', staging: { action: 'question' } }] }, text, '9:16');
  expect(plan.scenes[0].text).toBe(text);
  expect(plan.scenes[0].staging?.action).toBe('question');
  const stage = new Narrative3D(plan.scenes[0], new THREE.Group()); stage.update(3, 10);
  expect(stage.diagnostics()).toMatchObject({ action: 'question', board: false }); stage.dispose();
});
it.each(['Eu não sei quem é o oponente.', 'Ela não sabe como sair dessa situação.', 'Eles nunca sabiam onde estava a chave.'])('recognizes uncertainty without inventing an outcome: %s', (text) => {
  expect(inferStaging(text)?.action).toBe('question');
  expect(normalizeStaging({ action: 'run' }, text)).toBeUndefined();
});
it.each(['Ele sabia quem era seu adversário.', 'Ele não sabia perder.', 'Se ele não sabia quem era o adversário, ficaria perdido.'])('does not turn knowledge, another meaning or a hypothesis into a question: %s', (text) => {
  expect(inferStaging(text)).toBeUndefined();
});

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
  const camera = stage.camera(9 / 16);
  expect(camera.pos.z).toBeLessThan(0);
  const head = stage.actors[0].rig.head.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Ray(camera.pos, camera.look.clone().sub(camera.pos).normalize());
  const hit = ray.intersectSphere(new THREE.Sphere(head, .42), new THREE.Vector3());
  expect(!hit || hit.distanceTo(camera.pos) > camera.look.distanceTo(camera.pos)).toBe(true);
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
it('a prop noun alone does not invent reading or computer work, and denied events do not execute', () => {
  for (const text of ['O celular era caro.', 'O computador estava quebrado.', 'O coração não disparou.', 'Ele não recebeu a mensagem.', 'O gráfico nunca subiu.']) {
    expect(inferStaging(text), text).toBeUndefined();
  }
});
it('an abstract topic cannot replace the identity of the human protagonist', () => {
  const scenes = buildFallbackPlan('Nina recebeu uma mensagem. Corrupção era o assunto. Ela correu pela rua.').scenes;
  expect(scenes[2].staging?.actor.name).toBe('Nina');
});
it('keeps the entire question symbol within both aspect ratios in the final close', () => {
  const scene = buildFallbackPlan('Mas uma pergunta mudou tudo: e agora?').scenes[0];
  const stage = new Narrative3D(scene, new THREE.Group());
  for (const aspect of [9 / 16, 16 / 9]) for (const t of [6, 7, 8, 9.99]) {
    stage.update(t, 10); const shot = stage.camera(aspect), bounds = stage.questionBounds()!;
    const camera = new THREE.PerspectiveCamera(42, aspect, .1, 100); camera.setViewOffset(aspect * 1000, 1000, 0, 110, aspect * 1000, 1000);
    camera.position.copy(shot.pos); camera.lookAt(shot.look); camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      expect(Math.abs(p.x)).toBeLessThan(.94); expect(p.y).toBeLessThan(.94); expect(p.y).toBeGreaterThan(-.48);
    }
  }
  stage.dispose();
});
