import { useEffect, useRef, useState } from 'react';
import { ThumbsUp, ThumbsDown, Box, Clapperboard, Sparkles, Play, Pause, Download, Loader2, Film, Wand2, Mic, MicOff, FolderOpen, Upload, Trash2, Bookmark, X, Plus } from 'lucide-react';
import { listProjects, saveProject, deleteProject, listGallery, addToGallery, removeFromGallery, addToVault, vaultFor, listVault, type SavedProject, type GalleryItem } from './library';
import { Button } from '@/components/ui/button';
import { ExplainerPlan, VISUALS, MOODS, buildFallbackPlan, fitToTrack, totalDuration, sceneAt, sceneStart, SCENE_LEAD, type Visual, type Mood } from './plan';
import { NARRATION_VOICES, getNarration, getCachedNarration, speechBounds } from './voice';
import { drawExplainerFrame, drawOverlay } from './render';
import { detectCues } from './keywords';
import type { Toon3D } from './toon3d';
import { getBestSupportedVideoMimeType } from '../utils/videoRecorder';
import { audioCues, missingNarrationScenes, exportDuration, mixdown, EXPORT_FPS } from './exportTimeline';

export const SAMPLE = `Ele criou um site para a pizzaria do bairro. De graça.
Três meses depois, ninguém tinha visto.
Mandou mensagem no WhatsApp: Oi, tudo bem? Você tem interesse em um site?
Ah, legal... depois eu vejo.
As pessoas compram o que veem.
Então ele mostrou o site pronto, com nome, endereço e botão de WhatsApp.
Vendeu na primeira conversa.
Agora a pergunta é: vai ser você?`;

const VISUAL_LABEL: Record<Visual, string> = { character: 'Personagem', phone_chat: 'Celular (conversa)', profile: 'Perfil / link na bio', laptop: 'Notebook', map_pins: 'Mapa', clock: 'Relógio', scale: 'Balança', eye: 'Olho', chips: 'Etiquetas', city_night: 'Cidade à noite', chart_up: 'Gráfico subindo', money: 'Dinheiro', custom: 'Desenho livre da IA' };
const MOOD_LABEL: Record<Mood, string> = { happy: 'Feliz', neutral: 'Neutro', sad: 'Triste', worried: 'Preocupado', angry: 'Bravo' };

export function ExplainerStudio({ onOpenEditor, onOpenVideo }: { onOpenEditor: () => void; onOpenVideo: () => void }) {
  const [script, setScript] = useState('');
  const [vaultCount, setVaultCount] = useState(0);
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16');
  const [plan, setPlan] = useState<ExplainerPlan>({ title: 'Novo projeto', aspect: '9:16', scenes: [] });
  void buildFallbackPlan;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState<number | null>(null);
  const [voice, setVoice] = useState<string>(NARRATION_VOICES[0].id);
  const [voiceOn, setVoiceOn] = useState(true);
  const [, refreshAudioCache] = useState(0);
  const [voicing, setVoicing] = useState<number | null>(null);
  const [engine, setEngine] = useState<'2d' | '3d'>('3d');
  const toonRef = useRef<Toon3D | null>(null);
  const [toonReady, setToonReady] = useState(0);
  const [genId, setGenId] = useState<string | null>(null);
  const [rated, setRated] = useState<'yes' | 'no' | 'sent' | null>(null);
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'creative' | 'gallery'>('creative');
  const [provider, setProvider] = useState<'gemini' | 'eleven'>('gemini');
  const [elevenId, setElevenId] = useState('');
  const [projectId, setProjectId] = useState(() => `p${Date.now().toString(36)}`);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [library, setLibrary] = useState(false);
  const [listening, setListening] = useState<'rec' | 'busy' | null>(null);
  const [trackName, setTrackName] = useState('');
  const trackRef = useRef<AudioBuffer | null>(null);
  const micRef = useRef<MediaRecorder | null>(null);
  const voiceKey = provider === 'eleven' ? `eleven:${elevenId.trim()}` : voice;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const exportingRef = useRef(false);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const ctx = () => (audioRef.current ??= new AudioContext());

  /** Schedule every narrated scene from timeline time `from`; returns a stop function. */
  const startAudio = (from: number, extra?: AudioNode) => {
    if (!voiceOn) return () => {};
    const ac = ctx(); void ac.resume();
    const now = ac.currentTime + 0.05, nodes: AudioBufferSourceNode[] = [];
    if (plan.track && trackRef.current) {
      const src = ac.createBufferSource(); src.buffer = trackRef.current; src.connect(ac.destination); if (extra) src.connect(extra);
      src.start(now, Math.min(from, trackRef.current.duration)); return () => { try { src.stop(); } catch {} };
    }
    plan.scenes.forEach((s, i) => {
      const buf = s.voice && buffers.current.get(`${voiceKey}|${s.text}`); if (!buf) return;
      const at = sceneStart(plan, i) + SCENE_LEAD - from;
      if (at + buf.duration <= 0) return;
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); if (extra) src.connect(extra);
      src.start(now + Math.max(0, at), Math.max(0, -at)); nodes.push(src);
    });
    return () => nodes.forEach((n) => { try { n.stop(); } catch {} });
  };

  const narrate = async (target: ExplainerPlan) => {
    if (provider === 'eleven' && !elevenId.trim()) { setNote('Informe o Voice ID do ElevenLabs.'); return null; }
    const ac = ctx(); const out = { ...target, scenes: [...target.scenes] };
    setVoicing(0);
    try {
      for (let i = 0; i < out.scenes.length; i++) {
        const s = out.scenes[i];
        const buf = await getNarration(ac, s.text, voiceKey);
        buffers.current.set(`${voiceKey}|${s.text}`, buf);
        const b = speechBounds(buf);
        out.scenes[i] = { ...s, voice: { duration: buf.duration, start: b.start, end: b.end } };
        setVoicing(Math.round(((i + 1) / out.scenes.length) * 100));
      }
      setPlan(out); seek(0);
      return out;
    } catch (e: any) {
      setNote(`${e.message} A animação segue sem voz.`);
      return null;
    } finally { setVoicing(null); }
  };
  const timeRef = useRef(0);
  const total = totalDuration(plan);

  useEffect(() => { document.fonts?.load("40px 'Lilita One'").then(() => draw(timeRef.current)); }, []);
  useEffect(() => {
    if (engine !== '3d' || toonRef.current) return;
    let alive = true;
    import('./toon3d').then(({ Toon3D }) => { if (alive) { toonRef.current = new Toon3D(); setToonReady((n) => n + 1); } });
    return () => { alive = false; };
  }, [engine]);
  const draw = (t: number, force = false) => {
    if (exportingRef.current && !force) return;
    const c = canvasRef.current?.getContext('2d'); if (!c) return;
    const toon = toonRef.current;
    if (engine === '3d' && toon && plan.scenes.length) { toon.render(plan, t, c.canvas.width, c.canvas.height); c.drawImage(toon.canvas, 0, 0); drawOverlay(c, plan, t); }
    else drawExplainerFrame(c, plan, t);
  };
  useEffect(() => { draw(timeRef.current); }, [plan, engine, toonReady]);
  // Reopening a project must restore the existing WAVs, never silently request new TTS.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let restored = 0;
      for (const scene of plan.scenes) {
        if (!scene.voice) continue;
        const key = `${voiceKey}|${scene.text}`;
        if (buffers.current.has(key)) continue;
        const cached = await getCachedNarration(ctx(), scene.text, voiceKey);
        if (cancelled) return;
        if (cached) { buffers.current.set(key, cached); restored++; }
      }
      if (restored && !cancelled) refreshAudioCache((v) => v + 1);
    };
    void restore();
    return () => { cancelled = true; };
  }, [plan, voiceKey]);
  const rate = async (rating: 'yes' | 'no', why = '') => {
    if (!genId) return;
    if (rating === 'no' && !why) { setRated('no'); return; }
    setRated('sent');
    await fetch('/api/ai/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rate', id: genId, rating, reason: why || undefined }) }).catch(() => {});
  };

  useEffect(() => {
    if (!playing || exportingRef.current) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      timeRef.current += (now - last) / 1000; last = now;
      if (timeRef.current >= total) { timeRef.current = 0; setPlaying(false); }
      draw(timeRef.current); setTime(timeRef.current); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const stop = startAudio(timeRef.current);
    return () => { cancelAnimationFrame(raf); stop(); };
  }, [playing, plan, total, engine, toonReady, voiceOn]);

  // Library: load on mount, autosave the current project after edits.
  useEffect(() => {
    // Open the latest real project; never seed a sample that would autosave itself back.
    const all = listProjects(); setProjects(all); setGallery(listGallery()); setVaultCount(listVault().length);
    if (all[0]) openProject(all[0]);
  }, []);
  useEffect(() => {
    if (!script.trim() && !plan.scenes.length) return;
    const id = setTimeout(() => { saveProject({ id: projectId, title: plan.title || script.slice(0, 40), script, plan, updatedAt: Date.now(), voiceKey, voiceOn }); setProjects(listProjects()); }, 800);
    return () => clearTimeout(id);
  }, [plan, script, projectId, voiceKey, voiceOn]);
  const openProject = (p: SavedProject) => {
    setPlaying(false); trackRef.current = null; setTrackName('');
    const savedVoice = p.voiceKey || NARRATION_VOICES[0].id;
    if (savedVoice.startsWith('eleven:')) {
      setProvider('eleven'); setElevenId(savedVoice.slice(7));
    } else {
      setProvider('gemini'); setVoice(savedVoice);
    }
    setVoiceOn(p.voiceOn ?? true);
    setProjectId(p.id); setScript(p.script); setAspect(p.plan.aspect); setPlan(p.plan); setEngine(p.plan.engine ?? '2d');
    seek(0); setLibrary(false);
  };
  const newProject = () => { setPlaying(false); trackRef.current = null; setTrackName(''); setProjectId(`p${Date.now().toString(36)}`); setScript(''); setPlan({ title: 'Novo projeto', aspect, scenes: [] }); setLibrary(false); };

  const transcribe = async (blob: Blob, name: string) => {
    const fd = new FormData(); fd.append('file', blob, name);
    const r = await fetch('/api/ai/transcribe', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Falha ao transcrever.');
    return String(d.text || '');
  };
  const toggleDictation = async () => {
    if (micRef.current) { micRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); micRef.current = null; setListening('busy');
        try { const type = rec.mimeType || 'audio/webm'; const text = await transcribe(new Blob(chunks, { type }), `fala.${type.includes('mp4') ? 'm4a' : 'webm'}`); setScript((s) => (s.trim() ? `${s.trim()}\n${text}` : text)); setNote('Roteiro ditado adicionado.'); }
        catch (e: any) { setNote(e.message); } finally { setListening(null); }
      };
      rec.start(); micRef.current = rec; setListening('rec');
    } catch { setNote('Não consegui acessar o microfone.'); }
  };
  const useOwnAudio = async (file: File) => {
    unlockAudio(); setNote('Lendo seu áudio…');
    try {
      trackRef.current = await ctx().decodeAudioData(await file.arrayBuffer()); setTrackName(file.name);
      let text = script;
      if (text.trim().length < 4) { setNote('Entendendo o que foi falado…'); text = await transcribe(file, file.name); setScript(text); }
      await generate(text);
    } catch (e: any) { trackRef.current = null; setTrackName(''); setNote(e.message || 'Áudio inválido.'); }
  };
  const removeTrack = () => { trackRef.current = null; setTrackName(''); setPlaying(false); setPlan((p) => ({ ...p, track: undefined, scenes: p.scenes.map(({ voice: _v, ...r }) => r) })); };
  const saveDrawing = (i: number) => {
    const s = plan.scenes[i]; if (!s.drawing) return;
    addToGallery(s.text.slice(0, 50), s.drawing); setGallery(listGallery()); setNote('Desenho salvo na galeria.');
  };

  const seek = (t: number) => { timeRef.current = t; setTime(t); draw(t); };

  /** Mobile browsers only allow sound when unlocked inside a tap. */
  const unlockAudio = () => {
    const ac = ctx(); void ac.resume();
    const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start();
  };
  const generate = async (text = script) => {
    unlockAudio(); setBusy(true); setNote(''); setPlaying(false);
    try {
      const res = await fetch('/api/ai/explainer-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: text, aspect, mode, gallery: [...gallery, ...vaultFor(text)] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar.');
      const track = trackRef.current;
      setPlan(track ? fitToTrack(data.plan, track.duration) : data.plan); seek(0);
      for (const sc of data.plan.scenes as ExplainerPlan['scenes']) if (sc.visual === 'custom' && sc.drawing?.length) addToVault(sc.text, sc.drawing);
      setVaultCount(listVault().length);
      setGenId(null); setRated(null); setReason('');
      fetch('/api/ai/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'log', script: text, plan: data.plan, engine, keywords: detectCues(text).map((c) => c.tag) }) })
        .then((r) => r.json()).then((d) => d.id && setGenId(d.id)).catch(() => {});
      setNote(data.source === 'ai' ? `A IA dirigiu ${data.plan.scenes.length} cenas.` : 'IA indisponível agora: montei as cenas pelas palavras do roteiro.');
      if (voiceOn && !track) await narrate(data.plan);
      setPlaying(true);
    } catch (e: any) { setNote(e.message); } finally { setBusy(false); }
  };

  const updateScene = (i: number, patch: Partial<ExplainerPlan['scenes'][number]>) =>
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, k) => (k === i ? { ...s, ...patch, ...(patch.text !== undefined && patch.text !== s.text ? { voice: undefined } : {}) } : s)) }));
  const jumpTo = (i: number) => seek(sceneStart(plan, i) + 0.6);
  const voiced = plan.scenes.length > 0 && (plan.track ? !!trackRef.current : plan.scenes.every((s) => s.voice && buffers.current.has(`${voiceKey}|${s.text}`)));

      /**
   * Deterministic export. Timeline = source of truth:
   *  - frame 0 is drawn at t = 0 before recording starts;
   *  - narration/track is mixed offline onto the timeline (sample-exact) and played once, only into the recorder;
   *  - the audio clock (or performance.now when silent) drives t, and each frame is drawn at an exact n / fps;
   *  - the recorder stops only after the whole timeline plus the tail has been rendered AND the audio has ended.
   */
  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') { setNote('Este navegador não grava vídeo.'); return; }
    if (exportingRef.current || !plan.scenes.length) return;
    exportingRef.current = true; setPlaying(false); setRecording(0); setNote('');
    let timer = 0, src: AudioBufferSourceNode | null = null, stream: MediaStream | null = null;
    try {
      unlockAudio();
      await document.fonts?.load("40px 'Lilita One'").catch(() => {});
      const ac = ctx(); await ac.resume();
      const fps = EXPORT_FPS;

      // 1) timeline + audio mixdown
      if (voiceOn) {
        if (plan.track && !trackRef.current) throw new Error('O áudio enviado não está mais disponível. Envie-o novamente.');
        if (!plan.track) {
          for (const scene of plan.scenes) {
            if (!scene.voice) continue;
            const key = `${voiceKey}|${scene.text}`;
            if (!buffers.current.has(key)) {
              const cached = await getCachedNarration(ac, scene.text, voiceKey);
              if (cached) buffers.current.set(key, cached);
            }
          }
          const missing = missingNarrationScenes({ plan, voiceKey, buffers: buffers.current });
          if (missing.length) throw new Error(`Narração ausente nas cenas ${missing.join(', ')}. Use "Gerar voz" antes de baixar. Nenhum crédito foi gasto.`);
        }
      }
      const cues = voiceOn ? audioCues({ plan, voiceKey, buffers: buffers.current, track: trackRef.current }) : [];
      if (voiceOn && !cues.length) throw new Error('Não encontrei áudio de narração para exportar.');
      const duration = exportDuration(plan, cues);
      if (cues.length && ac.state !== 'running') throw new Error('O navegador bloqueou o áudio. Toque na tela e tente novamente.');
      const mix = cues.length ? await mixdown(cues, duration, ac.sampleRate) : null;

      // 2) the first frame is t = 0, on screen before the recorder starts
      timeRef.current = 0; setTime(0); draw(0, true);

      // 3) video track: frames are pushed by us (requestFrame) when supported, otherwise sampled at fps
      stream = canvas.captureStream(0);
      const vtrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      const manual = typeof vtrack?.requestFrame === 'function';
      if (!manual) { vtrack?.stop(); stream = canvas.captureStream(fps); }
      const push = () => { if (manual) vtrack.requestFrame(); };
      const dest = mix ? ac.createMediaStreamDestination() : null;
      dest?.stream.getAudioTracks().forEach((tr) => stream!.addTrack(tr));

      const { mimeType } = getBestSupportedVideoMimeType();
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000, ...(mix ? { audioBitsPerSecond: 128_000 } : {}) });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve, reject) => {
        rec.onstop = () => resolve();
        rec.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error('Falha na gravação do vídeo.'));
      });
      rec.start(250);
      push(); // frame 0

      // 4) one clock for picture and sound; the audio starts LEAD seconds after the recorder (t = 0 held meanwhile)
      const LEAD = 0.15, startAt = ac.currentTime + LEAD, perf0 = performance.now() + LEAD * 1000;
      if (mix && dest) { src = ac.createBufferSource(); src.buffer = mix; src.connect(dest); src.start(startAt); }
      const clock = () => (mix ? ac.currentTime - startAt : (performance.now() - perf0) / 1000);

      let frame = 0, pct = -1;
      await new Promise<void>((resolve, reject) => {
        timer = window.setInterval(() => {
          try {
            const now = clock(), t = Math.min(Math.max(0, now), duration), n = Math.floor(t * fps + 1e-6);
            if (n !== frame) { frame = n; draw(n / fps, true); push(); }
            const p = Math.min(99, Math.round((t / duration) * 100)); if (p !== pct) { pct = p; setRecording(p); }
            if (now >= duration) { window.clearInterval(timer); resolve(); }
          } catch (e) { window.clearInterval(timer); reject(e); }
        }, 1000 / (fps * 2));
      });

      // 5) last frame held, audio ended: flush and stop
      draw(Math.floor(duration * fps) / fps, true); push();
      await new Promise((r) => setTimeout(r, 150));
      rec.requestData(); rec.stop(); await stopped;
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      if (!blob.size) throw new Error('A gravação saiu vazia.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${plan.title.replace(/[^\p{L}\d]+/gu, '-').slice(0, 40) || 'animacao'}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setNote(`Vídeo exportado: ${duration.toFixed(1)} s${mix ? ', com voz' : ', sem narração'}.`);
    } catch (e: any) {
      setNote(`Não consegui exportar: ${e?.message || e}`);
    } finally {
      window.clearInterval(timer);
      try { src?.stop(); } catch {}
      stream?.getTracks().forEach((tr) => tr.stop());
      exportingRef.current = false; setRecording(null); seek(0);
    }
  };

  const current = sceneAt(plan, time)?.index ?? 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const dims = aspect === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

  return (
    <div className="production-workspace explainer-workspace">
      <nav className="production-nav">
        <div className="production-brand"><Clapperboard /><strong>StickStory <span>Studio</span></strong></div>
        <div className="explainer-nav-links">
          <Button variant="ghost" size="sm" onClick={() => setLibrary(true)}><FolderOpen />Meus projetos</Button>
          <Button variant="ghost" size="sm" onClick={onOpenEditor}>Editor de cenas</Button>
          <Button variant="ghost" size="sm" onClick={onOpenVideo}><Film />Vídeo por IA</Button>
        </div>
      </nav>
      <main className="explainer-layout">
        <section className="explainer-panel">
          <p className="explainer-kicker">ANIMAÇÃO EXPLICATIVA 2D</p>
          <h1>Do roteiro à animação.</h1>
          <p className="explainer-sub">A IA escreve a direção, o código desenha cada quadro. Sem custo de vídeo: ~0,02 crédito pela direção e ~0,1 crédito por minuto de narração.</p>
          <label className="explainer-label" htmlFor="ex-script">Roteiro / narração</label>
          <textarea id="ex-script" className="explainer-textarea" value={script} onChange={(e) => setScript(e.target.value)} rows={9} placeholder="Escreva, dite pelo microfone ou envie seu áudio." />
          <div className="explainer-row">
            <Button size="sm" variant={listening === 'rec' ? 'destructive' : 'secondary'} onClick={toggleDictation} disabled={listening === 'busy'}>{listening === 'busy' ? <Loader2 className="animate-spin" /> : listening === 'rec' ? <MicOff /> : <Mic />}{listening === 'rec' ? 'Parar e transcrever' : listening === 'busy' ? 'Transcrevendo…' : 'Ditar roteiro'}</Button>
            <label className="explainer-file-btn"><Upload />{trackName ? 'Trocar áudio' : 'Usar meu áudio'}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void useOwnAudio(f); }} /></label>
            {trackName && <Button size="sm" variant="ghost" onClick={removeTrack} aria-label="Remover áudio"><X />{trackName.slice(0, 18)}</Button>}
          </div>
          <p className="explainer-label">Estilo de animação</p>
          <div className="explainer-row">
            <Button size="sm" variant={engine === '3d' ? 'default' : 'secondary'} onClick={() => { setEngine('3d'); setPlan((p) => ({ ...p, engine: '3d' })); }} aria-pressed={engine === '3d'}><Box />3D Toon</Button>
            <Button size="sm" variant={engine === '2d' ? 'default' : 'secondary'} onClick={() => { setEngine('2d'); setPlan((p) => ({ ...p, engine: '2d' })); }} aria-pressed={engine === '2d'}>Motion 2D</Button>
          </div>
          <p className="explainer-label">Modo de criação</p>
          <div className="explainer-row">
            {([['creative', 'Criativo', '~0,06'], ['gallery', 'Minha galeria', '~0,01']] as const).map(([m, l, c]) => (
              <Button key={m} size="sm" variant={mode === m ? 'default' : 'secondary'} onClick={() => setMode(m)} aria-pressed={mode === m}>{l} <small>{c}</small></Button>
            ))}
          </div>
          <p className="explainer-sub">{mode === 'creative' ? `A IA programa um cenário único para cada cena e reaproveita seus ${gallery.length} desenhos salvos e os ${vaultCount} do cofre automático quando combinarem. Sem custo de vídeo.` : mode === 'gallery' ? `A IA reaproveita seus ${gallery.length} desenhos salvos e os visuais prontos, o modo mais barato.` : ''}</p>
          <div className="explainer-row">
            {(['9:16', '16:9'] as const).map((a) => (
              <Button key={a} variant={aspect === a ? 'default' : 'secondary'} size="sm" onClick={() => { setAspect(a); setPlan((p) => ({ ...p, aspect: a })); }}>{a === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'}</Button>
            ))}
          </div>
          <div className="explainer-row">
            <Button size="sm" variant={voiceOn ? 'default' : 'secondary'} onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}><Mic />{voiceOn ? 'Com narração' : 'Sem narração'}</Button>
            <select value={voice} onChange={(e) => { setPlaying(false); setVoice(e.target.value); setPlan((p) => ({ ...p, scenes: p.scenes.map(({ voice: _v, ...rest }) => rest) })); }} aria-label="Voz" className="explainer-voice-select" disabled={!voiceOn}>
              {NARRATION_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <select value={provider} onChange={(e) => { setPlaying(false); setProvider(e.target.value as 'gemini' | 'eleven'); setPlan((p) => ({ ...p, scenes: p.scenes.map(({ voice: _v, ...rest }) => rest) })); }} aria-label="Motor de voz" className="explainer-voice-select" disabled={!voiceOn}>
              <option value="gemini">Voz do estúdio</option><option value="eleven">ElevenLabs (voz clonada)</option>
            </select>
            {provider === 'eleven' && voiceOn && <input className="explainer-badge-input" placeholder="Voice ID do ElevenLabs" value={elevenId} onChange={(e) => { setElevenId(e.target.value); setPlan((p) => ({ ...p, scenes: p.scenes.map(({ voice: _v, ...rest }) => rest) })); }} aria-label="Voice ID do ElevenLabs" />}
            {voiceOn && !voiced && !plan.track && <Button size="sm" variant="secondary" onClick={() => { setPlaying(false); void narrate(plan); }} disabled={voicing !== null}>{voicing !== null ? `Gravando voz ${voicing}%` : 'Gerar voz'}</Button>}
          </div>
          <Button className="explainer-generate" onClick={() => generate()} disabled={busy || voicing !== null || script.trim().length < 4}>
            {busy || voicing !== null ? <Loader2 className="animate-spin" /> : <Sparkles />}{voicing !== null ? `Gravando narração ${voicing}%` : busy ? 'Dirigindo cenas…' : 'Criar animação'}
          </Button>
          {note && <p className="explainer-note" role="status">{note}</p>}

          <div className="explainer-scenes">
            <p className="explainer-label">Cenas ({plan.scenes.length})</p>
            {plan.scenes.map((s, i) => (
              <div key={i} className={`explainer-scene ${i === current ? 'is-active' : ''}`} onClick={() => jumpTo(i)}>
                <span className="explainer-scene-n">{i + 1}</span>
                <div className="explainer-scene-body">
                  <input value={s.text} onChange={(e) => updateScene(i, { text: e.target.value })} aria-label={`Texto da cena ${i + 1}`} />
                  <div className="explainer-row">
                    <select value={s.visual} onChange={(e) => updateScene(i, { visual: e.target.value as Visual })} aria-label="Visual">
                      {VISUALS.map((v) => <option key={v} value={v}>{VISUAL_LABEL[v]}</option>)}
                    </select>
                    <select value={s.mood} onChange={(e) => updateScene(i, { mood: e.target.value as Mood })} aria-label="Expressão">
                      {MOODS.map((m) => <option key={m} value={m}>{MOOD_LABEL[m]}</option>)}
                    </select>
                    <input className="explainer-badge-input" placeholder="Etiqueta" value={s.label || ''} onChange={(e) => updateScene(i, { label: e.target.value || undefined })} aria-label="Etiqueta" />
                    {s.drawing && s.visual === 'custom' && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); saveDrawing(i); }}><Bookmark />Salvar na galeria</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="explainer-stage">
          <div className={`explainer-canvas-wrap ${aspect === '9:16' ? 'is-portrait' : ''}`}>
            <canvas ref={canvasRef} key={aspect} {...dims} onClick={() => { if (exportingRef.current) return; unlockAudio(); setPlaying((p) => !p); }} />
          </div>
          <div className="explainer-controls">
            <Button size="icon" variant="secondary" onClick={() => { unlockAudio(); setPlaying((p) => !p); }} aria-label={playing ? 'Pausar' : 'Reproduzir'} disabled={recording !== null}>{playing ? <Pause /> : <Play />}</Button>
            <input type="range" min={0} max={total} step={0.01} value={time} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} aria-label="Linha do tempo" disabled={recording !== null} />
            <span className="explainer-time">{fmt(time)} / {fmt(total)}</span>
            <Button onClick={exportVideo} disabled={recording !== null}>{recording !== null ? <><Loader2 className="animate-spin" />{recording}%</> : <><Download />Baixar vídeo</>}</Button>
          </div>
          {genId && rated !== 'sent' && (
            <div className="explainer-scene" role="group" aria-label="Avaliação">
              <div className="explainer-scene-body">
                <strong>Era o que você queria?</strong>
                <div className="explainer-row">
                  <Button size="sm" variant="secondary" onClick={() => void rate('yes')}><ThumbsUp />Sim</Button>
                  <Button size="sm" variant={rated === 'no' ? 'default' : 'secondary'} onClick={() => void rate('no')}><ThumbsDown />Não</Button>
                </div>
                {rated === 'no' && (<>
                  <textarea className="explainer-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="O que ficou errado? Ex: falei de link na bio e apareceu WhatsApp" aria-label="Motivo" />
                  <Button size="sm" onClick={() => void rate('no', reason.trim() || 'sem motivo')}>Enviar</Button>
                </>)}
              </div>
            </div>
          )}
          {rated === 'sent' && <p className="explainer-note" role="status">Obrigado! A IA vai usar isso nos próximos vídeos.</p>}
          <p className="explainer-hint"><Wand2 /> Toque numa cena para ir até ela e troque o visual, a expressão ou a etiqueta.</p>
        </section>
      </main>
      {library && (
        <div className="explainer-drawer" role="dialog" aria-label="Meus projetos" onClick={() => setLibrary(false)}>
          <div className="explainer-drawer-body" onClick={(e) => e.stopPropagation()}>
            <div className="explainer-row"><strong>Meus projetos</strong><Button size="sm" onClick={newProject}><Plus />Novo</Button><Button size="icon" variant="ghost" onClick={() => setLibrary(false)} aria-label="Fechar"><X /></Button></div>
            <p className="explainer-sub">Tudo é salvo automaticamente neste aparelho.</p>
            {projects.map((p) => (
              <div key={p.id} className={`explainer-scene ${p.id === projectId ? 'is-active' : ''}`} onClick={() => openProject(p)}>
                <div className="explainer-scene-body"><strong>{p.title || 'Sem título'}</strong><small>{p.plan.scenes.length} cenas · {new Date(p.updatedAt).toLocaleString('pt-BR')}</small></div>
                <Button size="icon" variant="ghost" aria-label="Apagar projeto" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); if (p.id === projectId) { newProject(); setLibrary(true); } setProjects(listProjects()); }}><Trash2 /></Button>
              </div>
            ))}
            <p className="explainer-label">Galeria de desenhos ({gallery.length})</p>
            {gallery.length === 0 && <p className="explainer-sub">Salve desenhos livres das cenas para a IA reaproveitar no modo "Minha galeria".</p>}
            {gallery.map((g) => (
              <div key={g.id} className="explainer-scene"><div className="explainer-scene-body"><span>{g.name}</span></div>
                <Button size="icon" variant="ghost" aria-label="Remover da galeria" onClick={() => { removeFromGallery(g.id); setGallery(listGallery()); }}><Trash2 /></Button></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
