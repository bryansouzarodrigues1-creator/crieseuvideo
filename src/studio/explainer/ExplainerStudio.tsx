import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Sparkles, Play, Pause, Download, Loader2, Film, Wand2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplainerPlan, VISUALS, MOODS, buildFallbackPlan, totalDuration, sceneAt, sceneStart, SCENE_LEAD, type Visual, type Mood } from './plan';
import { NARRATION_VOICES, getNarration, speechBounds } from './voice';
import { drawExplainerFrame } from './render';
import { getBestSupportedVideoMimeType } from '../utils/videoRecorder';

const SAMPLE = `Ele criou um site para a pizzaria do bairro. De graça.
Três meses depois, ninguém tinha visto.
Mandou mensagem no WhatsApp: Oi, tudo bem? Você tem interesse em um site?
Ah, legal... depois eu vejo.
As pessoas compram o que veem.
Então ele mostrou o site pronto, com nome, endereço e botão de WhatsApp.
Vendeu na primeira conversa.
Agora a pergunta é: vai ser você?`;

const VISUAL_LABEL: Record<Visual, string> = { character: 'Personagem', phone_chat: 'Celular', laptop: 'Notebook', map_pins: 'Mapa', clock: 'Relógio', scale: 'Balança', eye: 'Olho', chips: 'Etiquetas', city_night: 'Cidade à noite', chart_up: 'Gráfico subindo', money: 'Dinheiro' };
const MOOD_LABEL: Record<Mood, string> = { happy: 'Feliz', neutral: 'Neutro', sad: 'Triste', worried: 'Preocupado', angry: 'Bravo' };

export function ExplainerStudio({ onOpenEditor, onOpenVideo }: { onOpenEditor: () => void; onOpenVideo: () => void }) {
  const [script, setScript] = useState(SAMPLE);
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16');
  const [plan, setPlan] = useState<ExplainerPlan>(() => buildFallbackPlan(SAMPLE, '9:16'));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState<number | null>(null);
  const [voice, setVoice] = useState<string>(NARRATION_VOICES[0].id);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voicing, setVoicing] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const ctx = () => (audioRef.current ??= new AudioContext());

  /** Schedule every narrated scene from timeline time `from`; returns a stop function. */
  const startAudio = (from: number, extra?: AudioNode) => {
    const ac = ctx(); void ac.resume();
    const now = ac.currentTime + 0.05, nodes: AudioBufferSourceNode[] = [];
    plan.scenes.forEach((s, i) => {
      const buf = s.voice && buffers.current.get(`${voice}|${s.text}`); if (!buf) return;
      const at = sceneStart(plan, i) + SCENE_LEAD - from;
      if (at + buf.duration <= 0) return;
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); if (extra) src.connect(extra);
      src.start(now + Math.max(0, at), Math.max(0, -at)); nodes.push(src);
    });
    return () => nodes.forEach((n) => { try { n.stop(); } catch {} });
  };

  const narrate = async (target: ExplainerPlan) => {
    const ac = ctx(); const out = { ...target, scenes: [...target.scenes] };
    setVoicing(0);
    try {
      for (let i = 0; i < out.scenes.length; i++) {
        const s = out.scenes[i];
        const buf = await getNarration(ac, s.text, voice);
        buffers.current.set(`${voice}|${s.text}`, buf);
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
  const draw = (t: number) => { const c = canvasRef.current?.getContext('2d'); if (c) drawExplainerFrame(c, plan, t); };
  useEffect(() => { draw(timeRef.current); }, [plan]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      timeRef.current += (now - last) / 1000; last = now;
      if (timeRef.current >= total) { timeRef.current = 0; setPlaying(false); }
      draw(timeRef.current); setTime(timeRef.current); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const stop = startAudio(timeRef.current);
    return () => { cancelAnimationFrame(raf); stop(); };
  }, [playing, plan, total]);

  const seek = (t: number) => { timeRef.current = t; setTime(t); draw(t); };

  /** Mobile browsers only allow sound when unlocked inside a tap. */
  const unlockAudio = () => {
    const ac = ctx(); void ac.resume();
    const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start();
  };
  const generate = async () => {
    unlockAudio(); setBusy(true); setNote(''); setPlaying(false);
    try {
      const res = await fetch('/api/ai/explainer-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script, aspect }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar.');
      setPlan(data.plan); seek(0);
      setNote(data.source === 'ai' ? `A IA dirigiu ${data.plan.scenes.length} cenas.` : 'IA indisponível agora: montei as cenas pelas palavras do roteiro.');
      if (voiceOn) await narrate(data.plan);
      setPlaying(true);
    } catch (e: any) { setNote(e.message); } finally { setBusy(false); }
  };

  const updateScene = (i: number, patch: Partial<ExplainerPlan['scenes'][number]>) =>
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, k) => (k === i ? { ...s, ...patch, ...(patch.text !== undefined && patch.text !== s.text ? { voice: undefined } : {}) } : s)) }));
  const jumpTo = (i: number) => seek(sceneStart(plan, i) + 0.6);
  const voiced = plan.scenes.length > 0 && plan.scenes.every((s) => s.voice);

  const exportVideo = () => {
    const canvas = canvasRef.current; if (!canvas || typeof MediaRecorder === 'undefined') { setNote('Este navegador não grava vídeo.'); return; }
    setPlaying(false);
    const { mimeType } = getBestSupportedVideoMimeType();
    const stream = canvas.captureStream(30);
    const dest = voiced ? ctx().createMediaStreamDestination() : null;
    dest?.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    let stopAudio = () => {};
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${plan.title.replace(/[^\p{L}\d]+/gu, '-').slice(0, 40) || 'animacao'}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`; a.click();
      setRecording(null); seek(0);
    };
    rec.start(250);
    if (dest) stopAudio = startAudio(0, dest);
    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= total) { stopAudio(); rec.stop(); return; }
      draw(t); setRecording(Math.round((t / total) * 100)); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const current = sceneAt(plan, time)?.index ?? 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const dims = aspect === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

  return (
    <div className="production-workspace explainer-workspace">
      <nav className="production-nav">
        <div className="production-brand"><Clapperboard /><strong>StickStory <span>Studio</span></strong></div>
        <div className="explainer-nav-links">
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
          <textarea id="ex-script" className="explainer-textarea" value={script} onChange={(e) => setScript(e.target.value)} rows={9} />
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
            {voiceOn && !voiced && <Button size="sm" variant="secondary" onClick={() => { setPlaying(false); void narrate(plan); }} disabled={voicing !== null}>{voicing !== null ? `Gravando voz ${voicing}%` : 'Gerar voz'}</Button>}
          </div>
          <Button className="explainer-generate" onClick={generate} disabled={busy || voicing !== null || script.trim().length < 4}>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="explainer-stage">
          <div className={`explainer-canvas-wrap ${aspect === '9:16' ? 'is-portrait' : ''}`}>
            <canvas ref={canvasRef} key={aspect} {...dims} onClick={() => { unlockAudio(); setPlaying((p) => !p); }} />
          </div>
          <div className="explainer-controls">
            <Button size="icon" variant="secondary" onClick={() => { unlockAudio(); setPlaying((p) => !p); }} aria-label={playing ? 'Pausar' : 'Reproduzir'} disabled={recording !== null}>{playing ? <Pause /> : <Play />}</Button>
            <input type="range" min={0} max={total} step={0.01} value={time} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} aria-label="Linha do tempo" />
            <span className="explainer-time">{fmt(time)} / {fmt(total)}</span>
            <Button onClick={exportVideo} disabled={recording !== null}>{recording !== null ? <><Loader2 className="animate-spin" />{recording}%</> : <><Download />Baixar vídeo</>}</Button>
          </div>
          <p className="explainer-hint"><Wand2 /> Toque numa cena para ir até ela e troque o visual, a expressão ou a etiqueta.</p>
        </section>
      </main>
    </div>
  );
}
