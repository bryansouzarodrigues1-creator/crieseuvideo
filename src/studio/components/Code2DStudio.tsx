import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Code2, Download, Loader2, Pause, Play, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { generateCode2D } from '../code2d.functions';
import {
  CODE2D_DEFAULT_DURATION, CODE2D_MAX_CODE_CHARS, CODE2D_MAX_DURATION, CODE2D_MAX_SCRIPT_CHARS,
  CODE2D_MIN_DURATION, CODE2D_MIN_SCRIPT_CHARS, code2dSize, type Code2DAspect,
} from '../code2d/contract';
import { SANDBOX_ATTRIBUTE, buildCode2DSandboxSrcdoc, randomHex, readSandboxMessage } from '../code2d/sandbox';
import type { StudioStep, Storyboard } from '../code2d/multiAgentContract';

const SAMPLE = 'Mostre como uma pequena empresa enfrenta o aumento dos custos: o dono compra materiais, calcula as despesas, reorganiza a produção e encontra uma solução, com personagens, loja, estoque e ações reais.';
const STAGE_TEXT: Record<string, string> = {
  load: 'falha ao iniciar a caixa isolada', library: 'falha ao preparar o renderizador 2D',
  syntax: 'erro de sintaxe/carregamento no código gerado', contract: 'o código não segue o contrato',
  runtime: 'erro durante a execução do código gerado',
};
type Phase = 'idle' | 'generating' | 'loading' | 'ready' | 'error';
type Generated = { code: string; model: string; warnings: string[] };

export default function Code2DStudio() {
  const [script, setScript] = useState(SAMPLE);
  const [aspect, setAspect] = useState<Code2DAspect>('9:16');
  const [userId, setUserId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Generated | null>(null);
  const [lastModel, setLastModel] = useState('');
  const [duration, setDuration] = useState(CODE2D_DEFAULT_DURATION);
  const [targetDuration, setTargetDuration] = useState(CODE2D_DEFAULT_DURATION);
  const [aiMode, setAiMode] = useState<'team' | 'solo'>('team');
  const [steps, setSteps] = useState<StudioStep[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [replay, setReplay] = useState<{ deterministic: boolean; maxDiff: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const send = useServerFn(generateCode2D);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef('');
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const exportingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const frameWaiters = useRef(new Map<number, (b: ImageBitmap) => void>());
  const seqRef = useRef(0);
  const size = code2dSize(aspect);

  // New token + nonce for every program load; srcdoc never contains the code or any key.
  const sandbox = useMemo(() => {
    if (!result) return null;
    const token = randomHex(16);
    const nonce = randomHex(16);
    return {
      token,
      srcdoc: buildCode2DSandboxSrcdoc({
        token, nonce, parentOrigin: window.location.origin,
        duration: targetDuration,
      }),
    };
  }, [result, aspect, targetDuration]);

  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    supabase.auth.getSession().then(({ data }) => alive && setUserId(data.session?.user.id ?? null)).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_e, s) => alive && setUserId(s?.user.id ?? null));
    unsub = () => data.subscription.unsubscribe();
    return () => { alive = false; unsub(); };
  }, []);

  const post = useCallback((m: Record<string, unknown>) => {
    // Opaque-origin iframe: '*' is the only valid target. Nothing secret is sent.
    frameRef.current?.contentWindow?.postMessage({ ...m, token: tokenRef.current }, '*');
  }, []);

  // Message bridge + watchdog for each sandbox load.
  useEffect(() => {
    if (!sandbox || !result) return;
    tokenRef.current = sandbox.token;
    setPhase('loading'); setReplay(null); setPlaying(false); playingRef.current = false;
    timeRef.current = 0; setTime(0);
    let ready = false;
    const watchdog = window.setTimeout(() => {
      if (ready) return;
      setPhase('error');
      setError('A cena não respondeu em 25 s (laço infinito ou cena pesada demais). A caixa isolada foi descartada.');
      if (frameRef.current) frameRef.current.srcdoc = '';
    }, 25_000);
    const onMessage = async (ev: MessageEvent) => {
      const m = readSandboxMessage(ev, frameRef.current?.contentWindow, sandbox.token);
      if (!m) return;
      if (m.type === 'boot') {
        try {
          post({ type: 'init', code: result.code, width: size.width, height: size.height });
        } catch {
          setPhase('error'); setError('Falha ao iniciar a execução isolada do Code2D.');
        }
      } else if (m.type === 'ready') {
        ready = true; window.clearTimeout(watchdog);
        setDuration(m.duration); setReplay({ deterministic: m.deterministic, maxDiff: m.maxDiff });
        setPhase('ready');
      } else if (m.type === 'error') {
        ready = true; window.clearTimeout(watchdog);
        setPlaying(false); playingRef.current = false;
        setPhase('error');
        setError(`${STAGE_TEXT[m.stage]}: ${m.message}`);
        frameWaiters.current.clear();
      } else if (m.type === 'frame') {
        const w = frameWaiters.current.get(m.seq);
        if (w) { frameWaiters.current.delete(m.seq); w(m.bitmap); } else m.bitmap.close();
      }
    };
    window.addEventListener('message', onMessage);
    return () => { window.clearTimeout(watchdog); window.removeEventListener('message', onMessage); };
  }, [sandbox, result, post, size.width, size.height]);

  // Playback clock lives in the app; the sandbox only answers renderAt(t).
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => {
    if (phase !== 'ready') return;
    let raf = 0, last = performance.now(), nextSend = 0, nextLabel = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.15, (now - last) / 1000); last = now;
      if (playingRef.current && !exportingRef.current) {
        timeRef.current = Math.min(duration, timeRef.current + dt);
        if (now >= nextSend) { post({ type: 'render', t: timeRef.current }); nextSend = now + 33; }
        if (now >= nextLabel) { setTime(timeRef.current); nextLabel = now + 100; }
        if (timeRef.current >= duration) { playingRef.current = false; setPlaying(false); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, duration, post]);

  const seek = (t: number) => {
    timeRef.current = Math.max(0, Math.min(duration, t)); setTime(timeRef.current);
    post({ type: 'render', t: timeRef.current });
  };

  const signIn = async (provider: 'google' | 'lovable') => {
    setError('');
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.href }).catch((e) => ({ error: e as Error }));
    if (r && 'error' in r && r.error) setError(r.error.message);
  };

  const generate = async () => {
    if (phase === 'generating' || exportingRef.current || !userId) return;
    setError(''); setPlaying(false); setSteps([]); setStoryboard(null); setPhase('generating');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
      const r = await send({ data: { topic: script, aspect, duration: targetDuration, mode: aiMode },
        headers: { Authorization: `Bearer ${session.access_token}` } });
      if (r.model) setLastModel(r.model);
      if ('steps' in r && Array.isArray(r.steps)) setSteps(r.steps);
      if (!r.ok) { setPhase('error'); setError(r.message); return; }
      if ('storyboard' in r && r.storyboard) setStoryboard(r.storyboard);
      setResult({ code: r.code, model: r.model, warnings: r.warnings });
    } catch (e) {
      setPhase('error');
      setError('Falha ao pedir o código: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const requestFrame = (t: number) => new Promise<ImageBitmap>((resolve, reject) => {
    const seq = ++seqRef.current;
    const timer = window.setTimeout(() => { frameWaiters.current.delete(seq); reject(new Error('A cena parou de responder durante a exportação.')); }, 10_000);
    frameWaiters.current.set(seq, (b) => { window.clearTimeout(timer); resolve(b); });
    post({ type: 'frame', t, seq });
  });

  const exportVideo = async () => {
    if (phase !== 'ready' || exportingRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    exportingRef.current = true; setPlaying(false); setExportProgress(0); setError('');
    try {
      const { encodeFixedFrame3DClip } = await import('../utils/deterministic3dExport');
      const video = await encodeFixedFrame3DClip({
        canvas, durationSeconds: duration, fps: 24, signal: ctrl.signal, onProgress: setExportProgress,
        renderFrame: async (t) => { const b = await requestFrame(t); ctx.drawImage(b, 0, 0, canvas.width, canvas.height); b.close(); },
      });
      const url = URL.createObjectURL(video.blob);
      const a = document.createElement('a');
      a.href = url; a.download = `crieseuvideo-codigo-2d-${targetDuration}s-${Date.now()}.${video.filenameExtension}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError('Exportação falhou: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      abortRef.current = null; exportingRef.current = false; setExportProgress(null); seek(0);
    }
  };

  const busy = phase === 'generating' || exportProgress !== null;
  return (
    <main className="native-3d-studio ai3d-studio">
      <nav className="native-3d-bar">
        <a className="native-3d-return" href="/"><ArrowLeft size={18} /> Voltar ao CrieSeuVideo</a>
        <span className="native-3d-engine"><Code2 size={18} /> Code2D — Equipe de IAs</span>
      </nav>
      <header className="native-3d-heading">
        <span className="native-3d-eyebrow">EXPERIMENTAL • CÓDIGO 2D COM MULTIAGENTES GRATUITOS</span>
        <h1>CrieSeuVideo — Estúdio de programação 2D</h1>
        <p>Escolha uma equipe gratuita (Groq roteiriza, Gemini High dirige quando disponível e OpenRouter programa) ou use Gemini sozinho. Cada etapa fica registrada. O código roda isolado no navegador; voz e legendas ainda não estão prontas neste laboratório.</p>
      </header>
      <div className="native-3d-layout">
        <section className="native-3d-choices ai3d-panel">
          <label htmlFor="code2d-mode">Equipe responsável pela criação</label>
          <select id="code2d-mode" disabled={busy} value={aiMode}
            onChange={e => setAiMode(e.target.value as 'team' | 'solo')}>
            <option value="team">Equipe gratuita: Groq + Gemini High + OpenRouter</option>
            <option value="solo">Gemini High sozinho (modo anterior)</option>
          </select>
          <label htmlFor="code2d-script">Tema ou história do vídeo</label>
          <textarea id="code2d-script" rows={6} maxLength={CODE2D_MAX_SCRIPT_CHARS} value={script} disabled={busy} onChange={(e) => setScript(e.target.value)} />
          <p className="native-3d-small">{script.trim().length}/{CODE2D_MAX_SCRIPT_CHARS} caracteres · vídeo integral de {CODE2D_MIN_DURATION}–{CODE2D_MAX_DURATION} s.</p>
          <label htmlFor="code2d-duration">Duração solicitada (30–60 segundos)</label>
          <input id="code2d-duration" type="number" min={30} max={60} value={targetDuration}
            disabled={busy} onChange={e => setTargetDuration(Math.min(60,Math.max(30,Number(e.target.value)||40)))}/>
          <button type="button" disabled={busy} onClick={() => setAspect((a) => (a === '9:16' ? '16:9' : '9:16'))}>
            Formato: {aspect === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'}
          </button>
          <p className="native-3d-small" role="note">{aiMode === 'team'
            ? 'A equipe usa até 3 chamadas (Groq, Gemini High opcional, OpenRouter). Exige chaves próprias no servidor e contas com cotas gratuitas. Não há uso automático de Lovable, nem tentativas repetidas. Um plano pago do provedor pode cobrar normalmente.'
            : 'O modo individual solicita apenas Gemini High, sujeito à cota e à disponibilidade. Nenhuma outra IA entra sem sua escolha.'}</p>
          {userId ? (
            <button type="button" className="ai3d-generate" disabled={busy || script.trim().length < CODE2D_MIN_SCRIPT_CHARS} onClick={() => void generate()}>
              {phase === 'generating' ? <Loader2 size={18} className="animate-spin" /> : <Code2 size={18} />}
              {phase === 'generating' ? 'Equipe de IAs trabalhando…' : aiMode === 'team' ? 'Gerar com equipe gratuita' : 'Gerar com Gemini High'}
            </button>
          ) : (
            <div className="ai3d-signin">
              <p>Entre na sua conta para gerar.</p>
              <button onClick={() => void signIn('google')}>Entrar com Google</button>
              <button onClick={() => void signIn('lovable')}>Entrar com Lovable</button>
            </div>
          )}
          {error && <p className="native-3d-error" role="alert">{error}</p>}
          {steps.length > 0 && (
            <div className="native-3d-small" role="status">
              <strong>Relatório dos agentes</strong>
              {steps.map((step, i) => (
                <p key={step.stage + i}>
                  {step.status === 'ok' ? '✓' : step.status === 'failed' ? '✕' : '○'}{' '}
                  {step.stage}: {step.provider} / {step.model} — {step.detail}
                </p>
              ))}
            </div>
          )}
          {storyboard && (
            <details className="native-3d-small">
              <summary>Roteiro criado pela IA ({storyboard.scenes.length} cenas)</summary>
              <strong>{storyboard.title}</strong>
              {storyboard.scenes.map(scene => (
                <p key={scene.id}>{scene.start}s–{scene.end}s: {scene.narration} — {scene.action}</p>
              ))}
            </details>
          )}}
          <p className="native-3d-small" aria-live="polite">
            Modo: {aiMode === 'team' ? 'Equipe gratuita' : 'Gemini direto'}{lastModel ? ` · último modelo ${lastModel}` : ''} · estado: {{
              idle: 'aguardando', generating: 'gerando código', loading: 'executando na caixa isolada', ready: 'pronto', error: 'falhou',
            }[phase]}
          </p>
        </section>
        <section className="native-3d-player">
          <div className="native-3d-screen ai3d-preview">
            {sandbox ? (
              <iframe
                key={sandbox.token}
                ref={frameRef}
                title="Animação Code2D em caixa isolada; origem registrada no relatório de agentes"
                sandbox={SANDBOX_ATTRIBUTE}
                referrerPolicy="no-referrer"
                srcDoc={sandbox.srcdoc}
                style={{ width: '100%', aspectRatio: aspect === '9:16' ? '9 / 16' : '16 / 9', border: 0, display: 'block', background: '#0d1014' }}
              />
            ) : (
              <div className="native-3d-start">
                <Code2 size={34} /><strong>O vídeo gerado aparecerá aqui</strong>
                <span>Escolha um modo e gere seu programa de animação.</span>
              </div>
            )}
          </div>
          <div className="native-3d-controls">
            <button disabled={phase !== 'ready' || busy} onClick={() => { if (timeRef.current >= duration - 0.01) seek(0); setPlaying((v) => !v); }}>
              {playing ? <Pause size={17} /> : <Play size={17} />} {playing ? 'Pausar' : 'Reproduzir'}
            </button>
            <input type="range" aria-label="Linha do tempo" min={0} max={duration} step={0.05} value={time}
              disabled={phase !== 'ready' || busy} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} />
            <span className="native-3d-clock">{time.toFixed(1)} / {duration.toFixed(1)}s</span>
          </div>
          {result && (
            <div className="native-3d-numbers">
              <strong><ShieldCheck size={15} /> Executado isolado · {result.code.length.toLocaleString('pt-BR')} / {CODE2D_MAX_CODE_CHARS.toLocaleString('pt-BR')} caracteres</strong>
              {replay && <span>Replay por tempo: {replay.deterministic ? 'verificado (mesmo quadro ao voltar no tempo)' : `divergente (diferença ${replay.maxDiff}) — a exportação pode variar`}</span>}
              {result.warnings.map((w) => <span key={w}>Aviso: {w}</span>)}
            </div>
          )}
          <div className="native-3d-actions">
            {exportProgress !== null ? (
              <button onClick={() => abortRef.current?.abort()}>Cancelar exportação ({exportProgress}%)</button>
            ) : (
              <button className="native-3d-download" disabled={phase !== 'ready' || busy} onClick={() => void exportVideo()}>
                <Download size={17} /> Exportar vídeo (experimental)
              </button>
            )}
          </div>
          <p className="native-3d-small">Exportação de vídeo completo quadro a quadro. Esta primeira versão experimental ainda não inclui narração e legendas; não substitui o vídeo final publicável.</p>
          {result && (
            <details className="native-3d-small">
              <summary>Ver código gerado</summary>
              <pre style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 11 }}>{result.code}</pre>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}
