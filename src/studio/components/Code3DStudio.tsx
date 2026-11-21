import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Code2, Download, Loader2, Pause, Play, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { generateCode3D } from '../code3d.functions';
import {
  CODE3D_DEFAULT_DURATION, CODE3D_MAX_CODE_CHARS, CODE3D_MAX_DURATION, CODE3D_MAX_SCRIPT_CHARS,
  CODE3D_MIN_DURATION, CODE3D_MIN_SCRIPT_CHARS, code3dSize, code3dFrameRate, type Code3DAspect, type Code3DModelChoice, type Code3DQuality,
} from '../code3d/contract';
import { SANDBOX_ATTRIBUTE, buildSandboxSrcdoc, randomHex, readSandboxMessage } from '../code3d/sandbox';
import { FrameRequests } from '../code3d/frameRequests';

const SAMPLE = 'Um guindaste amarelo levanta um contêiner na obra, gira a lança e posiciona o contêiner no caminhão. A câmera acompanha cabos, rodas, edifícios e operários no fundo.';
const STAGE_TEXT: Record<string, string> = {
  load: 'falha ao iniciar a caixa isolada', library: 'falha ao carregar o three.js fixo',
  syntax: 'erro de sintaxe/carregamento no código gerado', contract: 'o código não segue o contrato',
  runtime: 'erro durante a execução do código gerado',
};
type Phase = 'idle' | 'generating' | 'importing' | 'loading' | 'ready' | 'error';
type Generated = { code: string; model: string; warnings: string[]; label?: string; source: 'gemini' | 'imported' | 'recipe' };

export default function Code3DStudio() {
  const [script, setScript] = useState(SAMPLE);
  const [aspect, setAspect] = useState<Code3DAspect>('9:16');
  const [quality, setQuality] = useState<Code3DQuality>('preview');
  const [modelChoice, setModelChoice] = useState<Code3DModelChoice>('gemini-3.6-flash');
  const [userId, setUserId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Generated | null>(null);
  const [lastModel, setLastModel] = useState('');
  const [duration, setDuration] = useState(CODE3D_DEFAULT_DURATION);
  const [replay, setReplay] = useState<{ deterministic: boolean; maxDiff: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const send = useServerFn(generateCode3D);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef('');
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const exportingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const size = code3dSize(aspect, quality);

  // New token + nonce for every program load; srcdoc never contains the code or any key.
  const sandbox = useMemo(() => {
    if (!result) return null;
    const token = randomHex(16);
    const nonce = randomHex(16);
    return {
      token,
      srcdoc: buildSandboxSrcdoc({
        token, nonce, parentOrigin: window.location.origin,
        minDuration: CODE3D_MIN_DURATION, maxDuration: CODE3D_MAX_DURATION, defaultDuration: CODE3D_DEFAULT_DURATION,
      }),
    };
  }, [result, aspect, quality]);

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
  const frames = useMemo(() => new FrameRequests(post), [post]);

  useEffect(() => () => {
    abortRef.current?.abort();
    frames.cancel('O player foi fechado.');
  }, [frames]);

  // Message bridge + watchdog for each sandbox load.
  useEffect(() => {
    if (!sandbox || !result) return;
    tokenRef.current = sandbox.token;
    setPhase('loading'); setReplay(null); setPlaying(false); playingRef.current = false;
    timeRef.current = 0; setTime(0);
    let ready = false, active = true, booted = false;
    const frameWindow = frameRef.current?.contentWindow;
    const watchdog = window.setTimeout(() => {
      if (ready) return;
      active = false;
      setPhase('error');
      setError('A cena não respondeu em 25 s (laço infinito ou cena pesada demais). A caixa isolada foi descartada.');
      if (frameRef.current) frameRef.current.srcdoc = '';
      frames.cancel('A cena não respondeu.');
    }, 25_000);
    const onMessage = async (ev: MessageEvent) => {
      const m = readSandboxMessage(ev, frameWindow, sandbox.token);
      if (!m) return;
      if (!active) { if (m.type === 'frame') m.bitmap.close(); return; }
      if (m.type === 'boot') {
        if (booted) return;
        booted = true;
        try {
          const { threeSources } = await import('../code3d/threeSources');
          if (!active) return;
          // Bind init to this exact load; an old async import cannot initialize a new iframe.
          frameWindow?.postMessage({ type: 'init', token: sandbox.token, core: threeSources.core, module: threeSources.module, tools: threeSources.tools, code: result.code, width: size.width, height: size.height }, '*');
        } catch {
          if (!active) return;
          ready = true; window.clearTimeout(watchdog);
          setPhase('error'); setError('Não foi possível carregar a cópia fixa do three.js.');
        }
      } else if (m.type === 'ready') {
        ready = true; window.clearTimeout(watchdog);
        setReplay({ deterministic: m.deterministic, maxDiff: m.maxDiff });
        if (!m.deterministic || m.maxDiff > 3) {
          setPhase('error'); setError('A cena não repetiu os mesmos quadros ao voltar no tempo. Revise o código antes de exportar.');
          return;
        }
        setDuration(m.duration); setPhase('ready');
      } else if (m.type === 'error') {
        ready = true; window.clearTimeout(watchdog);
        setPlaying(false); playingRef.current = false;
        setPhase('error');
        setError(`${STAGE_TEXT[m.stage]}: ${m.message}`);
        frames.cancel('O código da cena falhou.');
      } else if (m.type === 'frame') {
        if (m.bitmap.width !== size.width || m.bitmap.height !== size.height) {
          m.bitmap.close(); frames.cancel('O quadro recebido tem tamanho diferente da cena.');
        } else frames.receive(m.seq, m.bitmap);
      }
    };
    window.addEventListener('message', onMessage);
    // Recover when the iframe's initial boot message preceded the React effect.
    frameWindow?.postMessage({ type: 'hello', token: sandbox.token }, '*');
    return () => {
      active = false;
      window.clearTimeout(watchdog); window.removeEventListener('message', onMessage);
      frameWindow?.postMessage({ type: 'dispose', token: sandbox.token }, '*');
      frames.cancel('A cena foi substituída.');
    };
  }, [sandbox, result, frames, size.width, size.height]);

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
    if (phase === 'generating' || phase === 'importing' || phase === 'loading' || exportingRef.current || !userId) return;
    setError(''); setPlaying(false); setPhase('generating');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
      const r = await send({ data: { script, aspect, model: modelChoice }, headers: { Authorization: `Bearer ${session.access_token}` } });
      if (r.model) setLastModel(r.model);
      if (!r.ok) { setPhase('error'); setError(r.message); return; }
      setResult({ code: r.code, model: r.model, warnings: r.warnings, source: 'gemini' });
    } catch (e) {
      setPhase('error');
      setError('Falha ao pedir o código: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const importCode = async (file: File) => {
    if (phase === 'generating' || phase === 'importing' || phase === 'loading' || exportingRef.current) return;
    setError(''); setPlaying(false); setPhase('importing');
    try {
      if (file.size > CODE3D_MAX_CODE_CHARS * 4) throw new Error('O arquivo é grande demais para uma cena.');
      const text = await file.text();
      if (text.length > CODE3D_MAX_CODE_CHARS) throw new Error('O código excede 80 mil caracteres.');
      const { extractCode } = await import('../code3d/contract');
      const code = extractCode(text);
      if (!code) throw new Error('Use um arquivo JavaScript com a função createScene.');
      const { checkGeneratedCode } = await import('../code3d/validation');
      const checked = checkGeneratedCode(code);
      if (!checked.ok) throw new Error(checked.detail);
      setLastModel('');
      setResult({ code, model: '', warnings: checked.warnings, source: 'imported' });
    } catch (e) {
      setPhase('error'); setError('Não foi possível abrir a cena: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const downloadCode = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.code], { type: 'text/javascript;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'crieseuvideo-cena-3d.js';
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const loadRecipe = async (kind: 'construction' | 'movement' | 'carry') => {
    if (phase === 'generating' || phase === 'importing' || phase === 'loading' || exportingRef.current) return;
    setError(''); setPlaying(false); setPhase('importing');
    try {
      const [{ checkGeneratedCode }, recipe] = await Promise.all([
        import('../code3d/validation'), kind === 'carry' ? import('../code3d/recipes/carryReview') : kind === 'movement' ? import('../code3d/recipes/walkwayReview') : import('../code3d/recipes/construction'),
      ]);
      const code = 'buildCarryReviewCode' in recipe ? recipe.buildCarryReviewCode() : 'buildWalkwayReviewCode' in recipe ? recipe.buildWalkwayReviewCode() : recipe.buildConstructionCode();
      const checked = checkGeneratedCode(code);
      if (!checked.ok) throw new Error(checked.detail);
      setLastModel('');
      setResult({ code, model: '', warnings: checked.warnings, source: 'recipe', label: kind === 'carry' ? 'Entrega na oficina' : kind === 'movement' ? 'Caminhada e encaixes' : 'Modelo de construção' });
    } catch (e) {
      setPhase('error'); setError('Não foi possível abrir a cena: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const exportVideo = async () => {
    if (phase !== 'ready' || !replay?.deterministic || exportingRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ctrl = new AbortController(); abortRef.current = ctrl;
    exportingRef.current = true; setPlaying(false); setExportProgress(0); setError('');
    try {
      const { encodeFixedFrame3DClip } = await import('../utils/deterministic3dExport');
      const video = await encodeFixedFrame3DClip({
        canvas, durationSeconds: duration, fps: code3dFrameRate(quality), signal: ctrl.signal, onProgress: setExportProgress,
        renderFrame: async (t) => {
          const b = await frames.request(t, ctrl.signal);
          try { ctx.drawImage(b, 0, 0, canvas.width, canvas.height); } finally { b.close(); }
        },
      });
      const url = URL.createObjectURL(video.blob);
      const a = document.createElement('a');
      a.href = url; a.download = `crieseuvideo-codigo-3d-experimental-${Date.now()}.${video.filenameExtension}`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError('Exportação falhou: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      abortRef.current = null; exportingRef.current = false; setExportProgress(null);
      if (!ctrl.signal.aborted) seek(0);
    }
  };

  const busy = phase === 'generating' || phase === 'importing' || phase === 'loading' || exportProgress !== null;
  return (
    <main className="native-3d-studio ai3d-studio">
      <nav className="native-3d-bar">
        <a className="native-3d-return" href="/motor-3d"><ArrowLeft size={18} /> Voltar ao laboratório 3D</a>
        <span className="native-3d-engine"><Code2 size={18} /> Gemini — Código 3D</span>
      </nav>
      <header className="native-3d-heading">
        <span className="native-3d-eyebrow">EXPERIMENTAL • PROTÓTIPO INDEPENDENTE DO MODO 3D</span>
        <h1>O Gemini escreve o código da cena 3D</h1>
        <p>Cada clique pede ao Gemini um programa Three.js novo para o seu roteiro. O código roda numa caixa isolada, sem acesso à sua conta, aos seus dados nem à internet. Nenhuma cena de demonstração é usada no lugar.</p>
      </header>
      <div className="native-3d-layout">
        <section className="native-3d-choices ai3d-panel">
          <label htmlFor="code3d-script">Roteiro da cena</label>
          <textarea id="code3d-script" rows={6} maxLength={CODE3D_MAX_SCRIPT_CHARS} value={script} disabled={busy} onChange={(e) => setScript(e.target.value)} />
          <p className="native-3d-small">{script.trim().length}/{CODE3D_MAX_SCRIPT_CHARS} caracteres · gera uma cena de {CODE3D_MIN_DURATION}–{CODE3D_MAX_DURATION} s.</p>
          <button type="button" disabled={busy} onClick={() => setAspect((a) => (a === '9:16' ? '16:9' : '9:16'))}>
            Formato: {aspect === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'}
          </button>
          <label htmlFor="code3d-quality">Qualidade do vídeo</label>
          <select id="code3d-quality" value={quality} disabled={busy} onChange={e => setQuality(e.target.value as Code3DQuality)}>
            <option value="preview">Rápido · {aspect === '9:16' ? '432 × 768' : '768 × 432'} · 24 fps</option>
            <option value="hd">HD · {aspect === '9:16' ? '720 × 1280' : '1280 × 720'} · 30 fps</option>
          </select>
          <label htmlFor="code3d-model">Modelo Gemini</label>
          <select id="code3d-model" value={modelChoice} disabled={busy} onChange={e => setModelChoice(e.target.value as Code3DModelChoice)}>
            <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
            <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
            <option value="configured">Modelo configurado no servidor</option>
          </select>
          <p className="native-3d-small" role="note">Cada clique faz uma única chamada ao Gemini e pode usar sua cota, mesmo se o código falhar. Não há nova tentativa automática nem outra IA no lugar.</p>
          <label className="native-3d-small" htmlFor="code3d-import">Reabrir uma cena salva (.js), sem nova geração</label>
          <input id="code3d-import" type="file" accept=".js,.txt,text/javascript,text/plain" disabled={busy}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importCode(file); }} />
          <button type="button" disabled={busy} onClick={() => void loadRecipe('construction')}>Carregar construção por etapas</button>
          <button type="button" disabled={busy} onClick={() => void loadRecipe('movement')}>Testar caminhada e escada</button>
          <button type="button" disabled={busy} onClick={() => void loadRecipe('carry')}>Testar entrega na oficina</button>
          {userId ? (
            <button type="button" className="ai3d-generate" disabled={busy || script.trim().length < CODE3D_MIN_SCRIPT_CHARS} onClick={() => void generate()}>
              {phase === 'generating' ? <Loader2 size={18} className="animate-spin" /> : <Code2 size={18} />}
              {phase === 'generating' ? 'Gemini escrevendo o código… (até 5 min)' : 'Gerar código 3D com Gemini'}
            </button>
          ) : (
            <div className="ai3d-signin">
              <p>Entre na sua conta para gerar.</p>
              <button onClick={() => void signIn('google')}>Entrar com Google</button>
              <button onClick={() => void signIn('lovable')}>Entrar com Lovable</button>
            </div>
          )}
          {error && <p className="native-3d-error" role="alert">{error}</p>}
          <p className="native-3d-small" aria-live="polite">
            {result?.source === 'imported' ? 'Código importado · nenhuma chamada à IA' : result?.source === 'recipe' ? `${result.label || 'Modelo de construção'} · nenhuma chamada à IA` : `Provedor: Gemini direto${lastModel ? ` · modelo ${lastModel}` : ''}`} · estado: {{
              idle: 'aguardando', generating: 'gerando código', importing: 'abrindo código salvo', loading: 'executando na caixa isolada', ready: 'pronto', error: 'falhou',
            }[phase]}
          </p>
        </section>
        <section className="native-3d-player">
          <div className="native-3d-screen ai3d-preview">
            {sandbox ? (
              <iframe
                key={sandbox.token}
                ref={frameRef}
                title="Cena 3D por código (caixa isolada)"
                sandbox={SANDBOX_ATTRIBUTE}
                referrerPolicy="no-referrer"
                srcDoc={sandbox.srcdoc}
                style={{ width: '100%', aspectRatio: aspect === '9:16' ? '9 / 16' : '16 / 9', border: 0, display: 'block', background: '#0d1014' }}
              />
            ) : (
              <div className="native-3d-start">
                <Code2 size={34} /><strong>A cena gerada aparecerá aqui</strong>
                <span>Clique em “Gerar código 3D com Gemini”.</span>
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
              <strong><ShieldCheck size={15} /> Executado isolado · {result.code.length.toLocaleString('pt-BR')} / {CODE3D_MAX_CODE_CHARS.toLocaleString('pt-BR')} caracteres</strong>
              {replay && <span>Replay por tempo: {replay.deterministic ? 'mesmos quadros nos três instantes testados' : `divergente (diferença ${replay.maxDiff}) — exportação bloqueada`}</span>}
              {result.warnings.map((w) => <span key={w}>Aviso: {w}</span>)}
            </div>
          )}
          <div className="native-3d-actions">
            {exportProgress !== null ? (
              <button onClick={() => abortRef.current?.abort()}>Cancelar exportação ({exportProgress}%)</button>
            ) : (
              <button className="native-3d-download" disabled={phase !== 'ready' || !replay?.deterministic || busy} onClick={() => void exportVideo()}>
                <Download size={17} /> Exportar vídeo (experimental)
              </button>
            )}
            {result && <button disabled={busy} onClick={downloadCode}><Download size={17} /> Salvar código da cena (.js)</button>}
          </div>
          <p className="native-3d-small">A exportação grava as imagens da cena quadro a quadro: MP4 quando o navegador tem codificador H.264, senão WebM. O áudio pode ser adicionado na montagem.</p>
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
