import './style.css';
import { buildFallbackPlan, normalizePlan, totalDuration, sceneAt, sceneStart, sceneDuration, fitToTrack, type ExplainerPlan } from '../src/studio/explainer/plan';
import { withTargetDuration, normalizeTargetDuration, durationNotice, DURATION_PRESETS } from '../src/studio/explainer/duration';
import { ACTION_LABELS } from '../src/studio/explainer/staging';
import { drawExplainerFrame, drawOverlay } from '../src/studio/explainer/render';
import { scriptError, spokenText } from '../src/studio/explainer/script';
import type { Toon3D } from '../src/studio/explainer/toon3d';
import { readApiResponse, readDirectionResponse } from '../src/studio/utils/apiResponse';
import { validateNarrationPackage, alignNarratedActing } from '../src/studio/explainer/narrationPackage';
import { audioCues, mixdown, exportDuration } from '../src/studio/explainer/exportTimeline';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const script = $<HTMLTextAreaElement>('script'), canvas = $<HTMLCanvasElement>('canvas');
const timeline = $<HTMLInputElement>('timeline'), context = canvas.getContext('2d')!;
const SAMPLE = 'Ele recebeu uma mensagem no celular. A novidade fez o coração disparar. Ele correu pela rua para contar aos amigos. No escritório, o gráfico subia sem parar. Mas uma pergunta mudou tudo: e agora?';
let engine: '2d' | '3d' = '3d', aspect: '9:16' | '16:9' = '9:16';
let plan: ExplainerPlan, time = 0, playing = false, last = 0, toon: Toon3D | null = null, loading3d: Promise<void> | null = null;
let busy = false, selectedScene = -1, source = 'ENSAIO LOCAL';
let planScript = '';
let targetDuration: number | undefined;
let audioContext: AudioContext | null = null, uploadedTrack: AudioBuffer | null = null, narrationScript = '', audioOrigin: number | null = null;
const voiceBuffers = new Map<string, AudioBuffer>(), voiceMetadata = new Map<string, ExplainerPlan['scenes'][number]['voice']>();
let currentNarration: unknown;
let soundNodes: AudioBufferSourceNode[] = [];
const audio = () => audioContext ??= new AudioContext();
async function decodeNarration(raw: unknown, next: ExplainerPlan) {
  const clips = validateNarrationPackage(raw, next), context = audio();
  const buffers = new Map<string, AudioBuffer>(), metadata = new Map<string, ExplainerPlan['scenes'][number]['voice']>();
  for (const clip of clips) {
    const bytes = Uint8Array.from(atob(clip.wavBase64), (c) => c.charCodeAt(0));
    const buffer = await context.decodeAudioData(bytes.buffer);
    if (Math.abs(buffer.duration - clip.duration) > .05) throw new Error('A duração do áudio não corresponde aos tempos da narração.');
    buffers.set('imported|' + clip.text, buffer); metadata.set(clip.text, { duration: buffer.duration, start: clip.start, end: clip.end, timings: clip.timings });
  }
  return { buffers, metadata, manifest: { version: 1, script: next.scenes.map((s) => s.text).join(' '), clips } };
}
function stopSound() { for (const node of soundNodes) { try { node.stop(); } catch {} } soundNodes = []; audioOrigin = null; }
const cues = () => audioCues({ plan, voiceKey: 'imported', buffers: voiceBuffers, track: uploadedTrack });
async function startSound() {
  stopSound(); const list = cues(); if (!list.length) return;
  const context = audio(); await context.resume();
  if (!playing) return;
  audioOrigin = context.currentTime - time;
  for (const cue of list) {
    const offset = Math.max(0, time - cue.at); if (offset >= cue.buffer.duration) continue;
    const node = context.createBufferSource(); node.buffer = cue.buffer; node.connect(context.destination);
    node.start(context.currentTime + Math.max(0, cue.at - time), offset); soundNodes.push(node);
  }
}
const note = (text: string) => { $('message').textContent = text; };
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function counter() { $('counter').textContent = `${script.value.length.toLocaleString('pt-BR')} / 6.000`; }
function draw() {
  if (!plan) return;
  if (engine === '3d' && toon) {
    try {
      toon.render(plan, time, canvas.width, canvas.height); context.drawImage(toon.canvas, 0, 0, canvas.width, canvas.height); drawOverlay(context, plan, time); canvas.dataset.renderEngine = '3d';
      const acting = toon.narrativeDiagnostics(), production = toon.productionDiagnostics(); canvas.dataset.action = production ? 'production3d' : acting?.action || (sceneAt(plan, time)?.scene.story ? 'story' : 'illustration');
      canvas.dataset.contactError = String(production?.maxContactError ?? acting?.maxContactError ?? 0);
      canvas.dataset.production = production ? JSON.stringify(production) : '';
    }
    catch { engine = '2d'; buttons(); drawExplainerFrame(context, plan, time); canvas.dataset.renderEngine = '2d'; note('O 3D não iniciou neste navegador. A prévia está em Motion 2D.'); }
  } else { drawExplainerFrame(context, plan, time); canvas.dataset.renderEngine = '2d'; }
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
  stopSound();
  playing = false; $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir');
  const text = spokenText(next.scenes.map((s) => s.text).join(' '));
  if (text !== narrationScript) { voiceBuffers.clear(); voiceMetadata.clear(); uploadedTrack = null; narrationScript = ''; currentNarration = undefined; }
  const voiced = { ...next, track: uploadedTrack?.duration, scenes: next.scenes.map(({ voice: _v, ...s }) => ({ ...s, voice: voiceMetadata.get(s.text) })) };
  plan = alignNarratedActing(withTargetDuration({ ...(uploadedTrack ? fitToTrack(voiced, uploadedTrack.duration) : voiced), engine, aspect }, targetDuration)); time = 0; selectedScene = -1; source = label;
  planScript = spokenText(next.scenes.map((s) => s.text).join(' '));
  canvas.style.opacity = planScript === spokenText(script.value) ? '1' : '.45';
  timeline.max = String(totalDuration(plan)); $('source').textContent = source;
  $('scene-count').textContent = String(plan.scenes.length);
  const staged = plan.production ? plan.scenes.length : plan.scenes.filter((s) => s.story || s.staging).length;
  $('staging-info').textContent = engine === '3d'
    ? `${staged} de ${plan.scenes.length} cenas com encenação disponível.${staged < plan.scenes.length ? ' As demais serão ilustradas, sem encenar a ação. Dirigir com Gemini não acrescenta movimentos que ainda não existem no motor.' : ''}`
    : 'As novas ações podem ser encenadas em Toon 3D. Motion 2D usa suas ilustrações e animações atuais.';
  $('duration-info').textContent = durationNotice(plan) || `${totalDuration(plan).toFixed(1)} s no total. A prévia e a exportação usam a mesma linha do tempo.`;
  $('narration-info').textContent = cues().length ? `Narração importada · ${uploadedTrack ? 'cenas ajustadas ao áudio' : voiceMetadata.size + ' trechos'} · o áudio precisa ser importado novamente após recarregar.` : 'Sem narração. Importe um áudio ou uma narração do projeto para ouvir e exportar com voz.';
  const sourceWords = spokenText(script.value), resultWords = spokenText(plan.scenes.map((s) => s.text).join(' '));
  $('fidelity').textContent = sourceWords === resultWords ? '✓ Todas as palavras preservadas' : 'Confira as falas';
  if (sourceWords !== resultWords) $('source').textContent = 'PRÉVIA ANTERIOR';
  const list = $('scenes'); list.replaceChildren();
  plan.scenes.forEach((scene, i) => {
    const button = document.createElement('button'); button.className = 'scene-card';
    button.dataset.start = String(sceneStart(plan, i)); button.dataset.duration = String(sceneDuration(scene));
    const small = document.createElement('small'); small.textContent = `CENA ${String(i + 1).padStart(2, '0')}`;
    const text = document.createElement('p'); text.textContent = scene.text;
    const meta = document.createElement('em'); meta.textContent = `${sceneDuration(scene).toFixed(1)}s · ` + (plan.production ? 'CENA 3D · objetos e estado contínuos' : scene.story ? `AÇÃO ${scene.story.action.toUpperCase()} · ${scene.story.actors.map((a) => a.name).join(' → ')}` : scene.staging ? `${scene.staging.metaphor ? 'METÁFORA · ' : ''}${ACTION_LABELS[scene.staging.action]}` : 'Ilustração');
    button.append(small, text, meta); button.addEventListener('click', () => { time = sceneStart(plan, i) + .7; draw(); }); list.append(button);
  });
  canvas.width = aspect === '9:16' ? 720 : 1280; canvas.height = aspect === '9:16' ? 1280 : 720;
  canvas.classList.toggle('wide', aspect === '16:9'); $('resolution').textContent = `${canvas.width} × ${canvas.height} · ${aspect}`;
  draw(); if (engine === '3d') void prepare3d();
  try { localStorage.setItem('crieseuvideo-lab-v1', JSON.stringify({ script: script.value, plan, engine, aspect, source })); } catch { /* Storage is optional. */ }
}
function local() {
  const error = scriptError(script.value); if (error) return note(error);
  const rehearsal = buildFallbackPlan(script.value, aspect);
  setPlan(rehearsal, 'ENSAIO LOCAL');
  note(rehearsal.scenes.some((s) => s.story?.performance)
    ? 'História de pegar e entregar a lanterna reconhecida. Ensaio de 18 segundos com os nomes do seu roteiro. Nenhuma chamada de IA.'
    : 'Ensaio local pronto. Nenhuma chamada de IA foi feita. Confira os gestos e cada palavra do roteiro.');
}
script.addEventListener('input', () => {
  counter();
  if (planScript && spokenText(script.value) !== planScript) {
    playing = false; $('play').textContent = '▶';
    stopSound();
    $('source').textContent = 'PRÉVIA ANTERIOR'; $('fidelity').textContent = 'Roteiro alterado · gere uma nova prévia'; canvas.style.opacity = '.45';
    note('O roteiro mudou. Ensaie ou dirija novamente para atualizar a animação.');
  } else { $('source').textContent = source; canvas.style.opacity = '1'; }
});
$('sample').addEventListener('click', () => { script.value = SAMPLE; counter(); local(); });
$('local').addEventListener('click', local);
$('story-demo').addEventListener('click', () => {
  // Deterministic original scene: no Gemini or voice request. Tests actors, contact and ownership.
  script.value = 'Lia entra, caminha, agacha-se, pega a lanterna e entrega para Caio, que segura o objeto e sorri.';
  counter(); engine = '3d'; buttons();
  const sample = normalizePlan({ title: 'Lia e Caio · a lanterna', scenes: [{
    text: script.value, visual: 'custom', mood: 'happy', palette: 'teal', setting: 'room',
    story: { action: 'handoff', prop: 'lantern', performance: 'grounded-v1', actors: [
      { name: 'Lia', color: '#FFB447' }, { name: 'Caio', color: '#4AC6BE' },
    ] },
  }] }, script.value, aspect);
  setPlan(sample, 'ATUAÇÃO 3D · 18s');
  note('Ensaio 3D de 18 segundos: caminhar, agachar, pegar, transportar e entregar. Confira pés, mãos e posse ao avançar ou voltar a linha do tempo. Nenhuma chamada de IA.');
});
$('play').addEventListener('click', () => { if (busy) return; playing = !playing; if (time >= totalDuration(plan)) time = 0; $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Pausar' : 'Reproduzir'); last = performance.now(); if (playing) void startSound().catch(() => note('Não foi possível iniciar o áudio neste navegador.')); else stopSound(); });
timeline.addEventListener('input', () => { if (busy) return; time = Number(timeline.value); draw(); if (playing) void startSound().catch(() => {}); });
document.querySelectorAll<HTMLButtonElement>('[data-engine]').forEach((b) => b.addEventListener('click', () => { engine = b.dataset.engine as typeof engine; buttons(); setPlan(plan, source); }));
document.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((b) => b.addEventListener('click', () => { aspect = b.dataset.aspect as typeof aspect; buttons(); setPlan(plan, source); }));
function changeDuration() {
  const select = $<HTMLSelectElement>('duration'), input = $<HTMLInputElement>('duration-custom');
  input.hidden = select.value !== 'custom';
  try {
    if (select.value === 'custom' && !input.value.trim()) throw new Error('Informe a duração em segundos.');
    targetDuration = normalizeTargetDuration(select.value === 'custom' ? input.value : select.value); setPlan(plan, source);
  }
  catch (error) { note((error as Error).message); }
}
$('duration').addEventListener('change', changeDuration);
$('duration-custom').addEventListener('change', changeDuration);
$('download').addEventListener('click', () => {
  if (spokenText(script.value) !== planScript) return note('Atualize a prévia antes de baixar o projeto.');
  const blob = new Blob([JSON.stringify({ script: script.value, plan, source, narration: currentNarration }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'crieseuvideo-projeto.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function setBusy(value: boolean) { busy = value; if (value) { playing = false; stopSound(); $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir'); } for (const id of ['local', 'generate', 'sample', 'story-demo', 'download-video', 'narration-file', 'duration', 'duration-custom', 'open-project', 'project-file']) ($<HTMLInputElement>(id)).disabled = value; document.querySelectorAll<HTMLButtonElement>('[data-engine],[data-aspect]').forEach((b) => b.disabled = value); script.disabled = value; $('generate').textContent = value ? 'Processando…' : '✦ Dirigir com Gemini'; }
$('open-project').addEventListener('click', () => $<HTMLInputElement>('project-file').click());
$('project-file').addEventListener('change', async () => {
  const input = $<HTMLInputElement>('project-file'), file = input.files?.[0]; if (!file || busy) return;
  if (file.size > 40 * 1024 * 1024) return note('O projeto ultrapassa 40 MB.');
  setBusy(true);
  try {
    const raw = JSON.parse(await file.text());
    if (typeof raw.script !== 'string' || scriptError(raw.script) || !raw.plan?.scenes?.length) throw new Error('O arquivo não contém um projeto válido.');
    const nextAspect = raw.plan.aspect === '16:9' ? '16:9' : '9:16';
    const next = normalizePlan(raw.plan, raw.script, nextAspect), duration = normalizeTargetDuration(raw.plan.targetDuration);
    const decoded = raw.narration || raw.clips ? await decodeNarration(raw.narration ?? raw, next) : null;
    try { localStorage.setItem('crieseuvideo-lab-before-import', localStorage.getItem('crieseuvideo-lab-v1') || ''); } catch {}
    voiceBuffers.clear(); voiceMetadata.clear(); uploadedTrack = null;
    if (decoded) { for (const [k, v] of decoded.buffers) voiceBuffers.set(k, v); for (const [k, v] of decoded.metadata) voiceMetadata.set(k, v); currentNarration = decoded.manifest; narrationScript = spokenText(raw.script); }
    else { narrationScript = ''; currentNarration = undefined; }
    script.value = raw.script; aspect = nextAspect; engine = raw.plan.engine === '2d' ? '2d' : '3d'; targetDuration = duration;
    $<HTMLSelectElement>('duration').value = duration ? (DURATION_PRESETS as readonly number[]).includes(duration) ? String(duration) : 'custom' : 'auto';
    $<HTMLInputElement>('duration-custom').hidden = $<HTMLSelectElement>('duration').value !== 'custom';
    if (duration) $<HTMLInputElement>('duration-custom').value = String(duration);
    counter(); buttons(); setPlan(next, 'PROJETO IMPORTADO'); note(decoded ? 'Projeto 3D e narração importados. Confira a prévia e baixe o vídeo.' : 'Projeto importado. Nenhuma geração de IA ou voz foi acionada.');
  } catch (error) { note(error instanceof Error ? error.message : 'Não foi possível abrir o projeto.'); }
  finally { setBusy(false); input.value = ''; }
});
$('narration-file').addEventListener('change', async () => {
  const input = $<HTMLInputElement>('narration-file'), file = input.files?.[0]; if (!file || busy) return;
  if (file.size > 40 * 1024 * 1024) { note('O arquivo de narração ultrapassa 40 MB.'); return; }
  setBusy(true); playing = false; stopSound();
  try {
    const context = audio(); await context.resume();
    const buffers = new Map<string, AudioBuffer>(), metadata = new Map<string, ExplainerPlan['scenes'][number]['voice']>();
    let track: AudioBuffer | null = null;
    if (file.name.toLowerCase().endsWith('.json')) {
      const decoded = await decodeNarration(JSON.parse(await file.text()), plan);
      for (const [k, v] of decoded.buffers) buffers.set(k, v); for (const [k, v] of decoded.metadata) metadata.set(k, v); currentNarration = decoded.manifest;
    } else { track = await context.decodeAudioData(await file.arrayBuffer()); if (track.duration > 600) throw new Error('Importe uma narração de até 10 minutos.'); }
    voiceBuffers.clear(); voiceMetadata.clear(); for (const [k, v] of buffers) voiceBuffers.set(k, v); for (const [k, v] of metadata) voiceMetadata.set(k, v);
    uploadedTrack = track; if (track) currentNarration = undefined; narrationScript = spokenText(plan.scenes.map((s) => s.text).join(' ')); setPlan(plan, source);
    note(track ? 'Áudio importado. As cenas foram distribuídas proporcionalmente; confira a correspondência com as falas.' : 'Narração do projeto importada. Reproduza a prévia ou baixe o vídeo com voz.');
  } catch (error) { note(error instanceof Error ? error.message : 'Não foi possível importar a narração.'); }
  finally { setBusy(false); input.value = ''; }
});
$('download-video').addEventListener('click', async () => {
  if (busy || !plan?.scenes.length) return;
  if (spokenText(script.value) !== planScript) return note('Atualize a prévia para o roteiro atual antes de exportar.');
  setBusy(true); playing = false; stopSound(); $('play').textContent = '▶';
  const previousTime = time;
  try {
    if (engine === '3d') await prepare3d();
    await document.fonts.ready;
    const list = cues(), duration = exportDuration(plan, list);
    const mix = list.length ? await mixdown(list, duration, 48000) : null;
    const { encodeFrames } = await import('../src/studio/explainer/frameEncoder');
    const result = await encodeFrames({ canvas, duration, audio: mix, draw: (at) => { time = at; draw(); }, onProgress: (percent) => { $('download-video').textContent = `Renderizando · ${percent}%`; } });
    if (!result) throw new Error('O navegador não possui um codificador compatível. A prévia e o plano continuam disponíveis.');
    const link = document.createElement('a'); link.href = URL.createObjectURL(result.blob); link.download = `${plan.title.replace(/[^\p{L}\d]+/gu, '-').slice(0, 40) || 'crieseuvideo'}.${result.extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    canvas.dataset.lastExport = JSON.stringify({ duration: result.duration, frames: result.frames, fps: result.fps, codec: result.codec, extension: result.extension, audio: !!mix });
    note(`Vídeo ${result.extension.toUpperCase()} pronto: ${result.duration.toFixed(1)} s, ${result.frames} quadros${mix ? ', com narração' : ', sem narração'}.`);
  } catch (error) { note(error instanceof Error ? error.message : 'Não foi possível exportar o vídeo.'); }
  finally { time = previousTime; draw(); $('download-video').textContent = '↓ Baixar vídeo'; setBusy(false); }
});
$('generate').addEventListener('click', async () => {
  if (busy) return; const error = scriptError(script.value); if (error) return note(error);
  setBusy(true); note('Gemini está dirigindo suas cenas. A narração não será acionada.');
  try {
    const res = await fetch('/api/direct', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ script: script.value, aspect, targetDuration, engine }) });
    const data = await readDirectionResponse(res);
    setPlan(normalizePlan(data.plan, script.value, aspect), 'GEMINI DIRETO'); note(`Gemini dirigiu ${plan.scenes.length} cenas. Todas as palavras foram preservadas. Nenhuma narração foi solicitada.`);
  } catch (error) { $('source').textContent = 'PRÉVIA ANTERIOR'; note('Direção não aplicada. ' + (error instanceof Error ? error.message : 'Falha na direção. Seu roteiro está preservado.')); }
  finally { setBusy(false); }
});
$('connect').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('connect'); button.disabled = true; note('Conferindo se o Google aceita a conexão, sem gerar conteúdo.');
  try {
    const res = await fetch('/api/connect', { method: 'POST', headers: { Accept: 'application/json' } }), data = await readApiResponse(res);
    $('api-label').textContent = 'Conexão com Google verificada'; $('api-dot').className = 'status-dot ready'; note(data.message);
  } catch (error) { $('api-dot').className = 'status-dot error'; note(error instanceof Error ? error.message : 'Não foi possível verificar.'); }
  finally { button.disabled = false; }
});
function loop(now: number) { if (playing && !document.hidden && !busy) { if (audioOrigin !== null && audioContext) time = Math.max(0, audioContext.currentTime - audioOrigin); else time += Math.min((now - last) / 1000, .15); if (time >= totalDuration(plan)) { time = totalDuration(plan); playing = false; stopSound(); $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Reproduzir'); } draw(); } last = now; requestAnimationFrame(loop); }
try {
  const saved = JSON.parse(localStorage.getItem('crieseuvideo-lab-v1') || 'null');
  if (saved?.plan?.scenes?.length && typeof saved.script === 'string') {
    script.value = saved.script; aspect = saved.aspect === '16:9' ? '16:9' : '9:16'; engine = saved.engine === '2d' ? '2d' : '3d';
    targetDuration = normalizeTargetDuration(saved.plan.targetDuration);
    $<HTMLSelectElement>('duration').value = targetDuration ? (DURATION_PRESETS as readonly number[]).includes(targetDuration) ? String(targetDuration) : 'custom' : 'auto';
    $<HTMLInputElement>('duration-custom').hidden = $<HTMLSelectElement>('duration').value !== 'custom';
    if (targetDuration) $<HTMLInputElement>('duration-custom').value = String(targetDuration);
    buttons(); setPlan(normalizePlan(saved.plan, script.value, aspect), saved.source === 'GEMINI DIRETO' ? 'GEMINI DIRETO' : 'ENSAIO LOCAL');
  }
  else { script.value = SAMPLE; local(); }
} catch { script.value = SAMPLE; local(); }
counter(); requestAnimationFrame(loop);
void document.fonts.ready.then(draw);
void fetch('/api/config', { headers: { Accept: 'application/json' } }).then(readApiResponse).then((data) => { $('api-label').textContent = data.configured ? 'Chave configurada no servidor' : 'Conexão Gemini pendente'; $('api-dot').className = `status-dot ${data.configured ? 'ready' : ''}`; }).catch(() => { $('api-label').textContent = 'Prévia local · sem conexão'; });
