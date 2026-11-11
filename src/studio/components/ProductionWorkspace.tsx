import { useEffect, useState, useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Clapperboard, Sparkles, ArrowUpRight, Loader2, Download, Film, Clock3, RefreshCw, LogOut, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import { createProduction, listProductions, refreshProduction } from '../production.functions';
import { PRODUCTION_STYLES, isActiveProduction, type ProductionInput } from '../utils/production';

type Production = Awaited<ReturnType<typeof listProductions>>[number] & { url?: string | null };

export function ProductionWorkspace({ onOpenEditor }: { onOpenEditor: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ProductionInput['style']>('animation3d');
  const [aspectRatio, setAspectRatio] = useState<ProductionInput['aspectRatio']>('16:9');
  const [duration, setDuration] = useState(6);
  const [resolution, setResolution] = useState<ProductionInput['resolution']>('720p');
  const [productions, setProductions] = useState<Production[]>([]);
  const [selected, setSelected] = useState<Production | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollingPaused, setPollingPaused] = useState(false);
  const create = useServerFn(createProduction);
  const list = useServerFn(listProductions);
  const refresh = useServerFn(refreshProduction);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id || null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id || null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setProductions([]); setSelected(null); return; }
    let live = true;
    list().then((rows) => { if (live) { setProductions(rows); setSelected(rows[0] || null); } }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [userId]);

  useEffect(() => {
    if (!selected || !userId || pollingPaused || selected.status === 'failed' || selected.url) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const row = await refreshRef.current({ data: { id: selected.id } });
        if (!live) return;
        setSelected(row);
        setProductions((rows) => rows.map((item) => item.id === row.id ? row : item));
        if (row.status === 'failed') setError(row.error_message || 'A IA não concluiu esta produção.');
        else if (isActiveProduction(row.status)) timer = setTimeout(poll, 8000);
      } catch (e) { if (live) { setPollingPaused(true); setError(e instanceof Error ? e.message : 'Não foi possível consultar o vídeo.'); } }
    };
    poll();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [selected?.id, userId, pollingPaused]);

  const signIn = async (provider: 'google' | 'lovable') => {
    setError('');
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) setError(result.error.message); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); }
  };

  const generate = async () => {
    if (!userId || busy) return;
    setBusy(true); setError(''); setPollingPaused(false);
    try {
      const result = await create({ data: { prompt, style, aspectRatio, duration, resolution } });
      if (result.error) { setError(result.error); return; }
      const rows = await list(); setProductions(rows); setSelected(rows.find((row) => row.id === result.id) || null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar a produção.'); }
    finally { setBusy(false); }
  };

  const download = async () => {
    if (!selected?.url) return;
    try {
      const response = await fetch(selected.url);
      if (!response.ok) throw new Error('Não foi possível baixar o vídeo.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `stickstory-${selected.id}.mp4`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha no download.'); }
  };
  const active = productions.some((row) => isActiveProduction(row.status));

  return <div className="production-workspace">
    <header className="production-nav">
      <div className="production-brand"><Clapperboard /><strong>StickStory <span>Studio</span></strong><span className="production-edition">PRODUÇÃO</span></div>
      <div className="flex items-center gap-2"><Button variant="outline" onClick={onOpenEditor}><FolderOpen />Editor de cenas<ArrowUpRight /></Button>{userId && <Button variant="ghost" size="icon" title="Sair da conta" aria-label="Sair da conta" onClick={() => supabase.auth.signOut()}><LogOut /></Button>}</div>
    </header>
    <main className="production-layout">
      <section className="production-director">
        <div className="production-section-label"><Sparkles /> CRIAÇÃO LIVRE</div>
        <h1>Sua próxima cena.</h1>
        <form onSubmit={(event) => { event.preventDefault(); generate(); }}>
          <label htmlFor="scene-brief">Direção da cena</label>
          <textarea id="scene-brief" value={prompt} maxLength={4000} onChange={(event) => setPrompt(event.target.value)} placeholder="Uma raposa de papel atravessa uma floresta de cristal. A câmera acompanha o voo; folhas se transformam em estrelas…" rows={6} />
          <div className="production-input-footer"><span>Personagens · ação · ambiente · câmera</span><span>{prompt.length}/4000</span></div>
          <fieldset><legend>Estilo visual</legend><div className="production-styles">{PRODUCTION_STYLES.map((item, index) => <Button key={item.id} variant="outline" type="button" aria-pressed={style === item.id} className={style === item.id ? 'selected' : ''} onClick={() => setStyle(item.id)}><span className="production-style-number">0{index + 1}</span>{item.label}</Button>)}</div></fieldset>
          <div className="production-options">
            <label>Formato<select aria-label="Formato da produção" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as ProductionInput['aspectRatio'])}><option value="16:9">16:9 · Horizontal</option><option value="9:16">9:16 · Vertical</option></select></label>
            <label>Duração<select aria-label="Duração da produção" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[3,4,5,6,7,8,9,10].map((s) => <option key={s} value={s}>{s} segundos</option>)}</select></label>
            <label>Qualidade<select aria-label="Qualidade da produção" value={resolution} onChange={(e) => setResolution(e.target.value as ProductionInput['resolution'])}><option value="720p">HD · 720p</option><option value="1080p">Full HD · 1080p</option></select></label>
          </div>
          {userId ? <Button className="production-generate" size="lg" type="submit" disabled={busy || active || prompt.trim().length < 8}>{busy || active ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? 'Iniciando produção…' : active ? 'Produção em andamento' : 'Gerar cena por IA'}<ArrowUpRight /></Button> : <div className="production-signin"><Button type="button" variant="outline" onClick={() => signIn('google')}><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continuar com Google</Button><Button type="button" className="lovable-auth-button" onClick={() => signIn('lovable')}>Continue with Lovable</Button></div>}
          <p className="production-cost">Geração utiliza créditos de IA do workspace. Vídeos ficam privados na sua conta.</p>
          {error && <div role="alert" className="production-error">{error}{pollingPaused && <Button type="button" variant="outline" size="sm" onClick={() => { setError(''); setPollingPaused(false); }}><RefreshCw />Retomar consulta</Button>}</div>}
        </form>
      </section>
      <section className="production-screen">
        <div className="production-screen-heading"><span><Film />MONITOR DE PRODUÇÃO</span><span>{selected ? `${selected.resolution} / ${selected.aspect_ratio}` : 'SEM PRODUÇÃO'}</span></div>
        <div className={`production-monitor ${selected?.aspect_ratio === '9:16' ? 'portrait' : ''}`}>
          {selected?.url ? <video key={selected.url} src={selected.url} controls playsInline preload="metadata" aria-label="Vídeo da produção" /> : <div className="production-empty">{selected && isActiveProduction(selected.status) ? <><Loader2 className="animate-spin" /><strong>{selected.status === 'creating' ? 'Preparando a cena' : 'Sua cena está sendo gerada'}</strong><span>{selected.progress > 0 ? `${selected.progress}%` : 'Aguardando a IA'}</span></> : <><Clapperboard /><strong>{selected?.status === 'failed' ? 'Produção interrompida' : 'Um novo quadro em branco.'}</strong><span>{selected?.status === 'failed' ? selected.error_message : 'StickStory Studio'}</span></>}</div>}
        </div>
        <div className="production-screen-footer"><span><Clock3 />{selected ? `${selected.duration}s · ${PRODUCTION_STYLES.find((s) => s.id === selected.style)?.label || selected.style}` : '00:00'}</span><Button variant="outline" disabled={!selected?.url} onClick={download}><Download />Baixar MP4</Button></div>
        <div className="production-history-heading"><h2>Suas produções</h2><span>{productions.length.toString().padStart(2, '0')}</span></div>
        <div className="production-history">{productions.length ? productions.map((row, index) => <Button key={row.id} variant="ghost" className={selected?.id === row.id ? 'selected' : ''} onClick={() => { setSelected(row); setPollingPaused(false); setError(''); }}><span className="production-history-number">{(index + 1).toString().padStart(2,'0')}</span><span className="production-history-text"><strong>{row.prompt}</strong><small>{row.duration}s · {row.resolution} · {row.status === 'completed' ? 'Concluída' : row.status === 'failed' ? 'Interrompida' : 'Em andamento'}</small></span><ArrowUpRight /></Button>) : <p>{userId ? 'Nenhuma produção ainda.' : 'Entre para criar e acessar suas produções.'}</p>}</div>
      </section>
    </main>
  </div>;
}