import './style.css';
import { buildFallbackPlan, normalizePlan, totalDuration, sceneAt, sceneStart, type ExplainerPlan } from '../src/studio/explainer/plan';
import { drawExplainerFrame, drawOverlay } from '../src/studio/explainer/render';
import { scriptError, spokenText } from '../src/studio/explainer/script';
import type { Toon3D } from '../src/studio/explainer/toon3d';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const script = $<HTMLTextAreaElement>('script'), canvas = $<HTMLCanvasElement>('canvas');
const timeline = $<HTMLInputElement>('timeline'), context = canvas.getContext('2d')!;
const SAMPLE = 'Ele recebeu uma mensagem no celular. A novidade fez o coração disparar. Ele correu pela rua para contar aos amigos. No escritório, o gráfico subia sem parar. Mas uma pergunta mudou tudo: e agora?';
let engine: '2d' | '3d' = '3d', aspect: '9:16' | '16:9' = '9:16';
let plan: ExplainerPlan, time = 0, playing = false, last = 0, toon: Toon3D | null = null, loading3d: Promise<void> | null = null;
let busy = false, selectedScene = -1, source = 'ENSAIO LOCAL';
const note = (text: string) => { $('message').textContent = text; };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function counter() { $('counter').textContent = `${script.value.length.toLocaleString('pt-BR')} / 6.000`; }
function draw() {
  if (!plan) return;
  if (engine === '3d' && toon) {
    try { toon.render(plan, time, canvas.width, canvas.height); context.drawImage(toon.canvas, 0, 0, canvas.width, canvas.height); drawOverlay(context, plan, time); }
    catch { engine = '2d'; buttons(); drawExplainerFrame(context, plan, time); note('O 3D não iniciou neste navegador. A prévia está em Motion 2D.'); }
  } else drawExplainerFrame(context, plan, time);
  timeline.value = String(time); $('clock').textContent = `${fmt(time)} / ${fmt(totalDuration(plan))}`;
  const i = sceneAt(plan, time)?.index ?? 0;
  if (i !== selectedScene) { selectedScene = i; document.querySelectorAll('.scene-card').forEach((card, k) => card.classList.toggle('active', k === i)); }
}
function buttons() {
  document.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((b) => b.classList.toggle('selected', b.dataset.engine === engine));
  document.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((b) => b.classList.toggle('selected', b.dataset.aspect === aspect));
}
async function prepare3d() {
  if (toon || loading3d) return loading3d;
  loading3d = import('../src/studio/explainer/toon3d').then(({ Toon3D }) => { toon = new Toon3D(); draw(); }).catch(() => {
    engine = '2d'; buttons(); draw(); note('WebGL não está disponível. O motor 2D está pronto para usar.');
  }).finally(() => { loading3d = null; });
  return loading3d;
}
function setPlan(next: ExplainerPlan, label: string) {
  playing = false; $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir');
  plan = { ...next, engine, aspect }; time = .7; selectedScene = -1; source = label;
  timeline.max = String(totalDuration(plan)); $('source').textContent = source;
  $('scene-count').textContent = String(plan.scenes.length);
  const sourceWords = spokenText(script.value), resultWords = spokenText(plan.scenes.map((s) => s.text).join(' '));
  $('fidelity').textContent = sourceWords === resultWords ? '✓ Todas as palavras preservadas' : 'Confira as falas';
  const list = $('scenes'); list.replaceChildren();
  plan.scenes.forEach((scene, i) => {
    const button = document.createElement('button'); button.className = 'scene-card';
    const small = document.createElement('small'); small.textContent = `CENA ${String(i + 1).padStart(2, '0')}`;
    const text = document.createElement('p'); text.textContent = scene.text;
    const meta = document.createElement('em'); meta.textContent = [scene.setting || 'Estúdio', scene.presenterPose || 'Apresentação'].join(' · ');
    button.append(small, text, meta); button.addEventListener('click', () => { time = sceneStart(plan, i) + .7; draw(); }); list.append(button);
  });
  canvas.width = aspect === '9:16' ? 720 : 1280; canvas.height = aspect === '9:16' ? 1280 : 720;
  canvas.classList.toggle('wide', aspect === '16:9'); $('resolution').textContent = `${canvas.width} × ${canvas.height} · ${aspect}`;
  draw(); if (engine === '3d') void prepare3d();
  try { localStorage.setItem('crieseuvideo-lab-v1', JSON.stringify({ script: script.value, plan, engine, aspect, source })); } catch { /* Storage is optional. */ }
}
function local() {
  const error = scriptError(script.value); if (error) return note(error);
  setPlan(buildFallbackPlan(script.value, aspect), 'ENSAIO LOCAL'); note('Ensaio local pronto. Nenhuma chamada de IA foi feita. Confira os gestos e cada palavra do roteiro.');
}
script.addEventListener('input', counter);
$('sample').addEventListener('click', () => { script.value = SAMPLE; counter(); local(); });
$('local').addEventListener('click', local);
$('play').addEventListener('click', () => { playing = !playing; if (time >= totalDuration(plan)) time = 0; $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir'); last = performance.now(); });
timeline.addEventListener('input', () => { time = Number(timeline.value); draw(); });
document.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((b) => b.addEventListener('click', () => { engine = b.dataset.engine as typeof engine; buttons(); setPlan(plan, source); }));
document.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((b) => b.addEventListener('click', () => { aspect = b.dataset.aspect as typeof aspect; buttons(); setPlan(plan, source); }));
$('download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ script: script.value, plan, source }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'crieseuvideo-plano.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function setBusy(value: boolean) { busy = value; for (const id of ['local', 'generate', 'sample']) $<HTMLButtonElement>(id).disabled = value; script.disabled = value; $('generate').textContent = value ? 'Dirigindo cenas…' : '✦ Dirigir com Gemini'; }
$('generate').addEventListener('click', async () => {
  if (busy) return; const error = scriptError(script.value); if (error) return note(error);
  setBusy(true); note('Gemini está dirigindo suas cenas. A narração não será acionada.');
  try {
    const res = await fetch('/api/direct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: script.value, aspect }) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'A direção não foi concluída.');
    setPlan(normalizePlan(data.plan, script.value, aspect), 'GEMINI DIRETO'); note(`Gemini dirigiu ${plan.scenes.length} cenas. Todas as palavras foram preservadas. Nenhuma narração foi solicitada.`);
  } catch (error) { note(error instanceof Error ? error.message : 'Falha na direção. Seu roteiro está preservado.'); }
  finally { setBusy(false); }
});
$('connect').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('connect'); button.disabled = true; note('Conferindo se o Google aceita a conexão, sem gerar conteúdo.');
  try {
    const res = await fetch('/api/connect', { method: 'POST' }), data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conexão recusada.');
    $('api-label').textContent = 'Conexão com Google verificada'; $('api-dot').className = 'status-dot ready'; note(data.message);
  } catch (error) { $('api-dot').className = 'status-dot error'; note(error instanceof Error ? error.message : 'Não foi possível verificar.'); }
  finally { button.disabled = false; }
});
function loop(now: number) { if (playing && !document.hidden) { time += Math.min((now - last) / 1000, .15); if (time >= totalDuration(plan)) { time = totalDuration(plan); playing = false; $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir'); } draw(); } last = now; requestAnimationFrame(loop); }
try {
  const saved = JSON.parse(localStorage.getItem('crieseuvideo-lab-v1') || 'null');
  if (saved?.plan?.scenes?.length && typeof saved.script === 'string') { script.value = saved.script; aspect = saved.aspect === '16:9' ? '16:9' : '9:16'; engine = saved.engine === '2d' ? '2d' : '3d'; buttons(); setPlan(normalizePlan(saved.plan, script.value, aspect), saved.source === 'GEMINI DIRETO' ? 'GEMINI DIRETO' : 'ENSAIO LOCAL'); }
  else { script.value = SAMPLE; local(); }
} catch { script.value = SAMPLE; local(); }
counter(); requestAnimationFrame(loop);
void document.fonts.ready.then(draw);
void fetch('/api/config').then((r) => r.json()).then((data) => { $('api-label').textContent = data.configured ? 'Chave configurada no servidor' : 'Conexão Gemini pendente'; $('api-dot').className = `status-dot ${data.configured ? 'ready' : ''}`; }).catch(() => { $('api-label').textContent = 'Prévia local · sem conexão'; });
