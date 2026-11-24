import { createFileRoute, ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const StudioApp = lazy(() => import('@/studio/App'));

export const Route = createFileRoute('/estudio')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Estúdio CrieSeuVideo — Login e acesso' },
      { name: 'description', content: 'Entre com sua conta Google para acessar o estúdio CrieSeuVideo.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: StudioAccess,
});

function StudioAccess() {
  const [status, setStatus] = useState<'loading'|'guest'|'authenticated'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError && !data.user) setStatus('guest');
      else setStatus(data.user ? 'authenticated' : 'guest');
    }).catch(() => {
      if (mounted) setStatus('guest');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setStatus(session?.user ? 'authenticated' : 'guest');
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const login = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/estudio' },
      });
      if (loginError) throw loginError;
    } catch {
      setError('Não foi possível abrir o login Google. Confira as URLs autorizadas no Supabase.');
    } finally { setBusy(false); }
  };

  if (status === 'authenticated') {
    return <ClientOnly fallback={<div className="studio-loading">Carregando…</div>}>
      <Suspense fallback={<div className="studio-loading">Abrindo estúdio…</div>}>
        <StudioApp />
      </Suspense>
    </ClientOnly>;
  }

  return <main style={{
    minHeight:'100dvh', display:'grid', placeItems:'center', padding:20, fontFamily:'system-ui,sans-serif',
    background:'radial-gradient(circle at 80% 5%, #63222f 0, #1b1115 54%, #090909 100%)', color:'#f5f6ff',
  }}>
    <section style={{
      maxWidth:450,width:'100%',background:'#1b1417',border:'1px solid #69404a',
      padding:'32px 25px',borderRadius:24,boxShadow:'0 20px 90px #0008',
    }}>
      <a href="/" style={{fontSize:13,color:'#ff99a8',textDecoration:'none'}}>← Voltar ao lançamento</a>
      <h1 style={{fontSize:30,fontWeight:900,lineHeight:1.12,margin:'22px 0 10px'}}>Seu estúdio começa aqui.</h1>
      <p style={{color:'#d0bfc3',lineHeight:1.6,fontSize:15}}>
        Faça login com o Google para entrar no ambiente experimental do CrieSeuVideo.
      </p>
      {status==='loading'
       ? <p role="status">Verificando sua conta…</p>
       : <button onClick={login} disabled={busy} type="button" style={{
           width:'100%',marginTop:18,padding:16,border:0,borderRadius:13,
           background:'#f4f7ff',fontSize:15,fontWeight:800,color:'#241519',cursor:'pointer'
         }}>{busy?'Abrindo Google…':'Entrar com Google'}</button>}
      {error && <p role="alert" style={{color:'#fecaca',lineHeight:1.5}}>{error}</p>}
      <p style={{fontSize:12,color:'#ae9ca3',lineHeight:1.6,marginTop:22}}>
        O estúdio está em desenvolvimento. Acesso à conta não inclui compra, créditos ou promessa de renda.
      </p>
    </section>
  </main>;
}
