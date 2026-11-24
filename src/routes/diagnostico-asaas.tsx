import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { diagnoseAsaasSandbox, type AsaasConnectionResult } from '@/studio/payments/asaas-diagnostics.functions';

export const Route = createFileRoute('/diagnostico-asaas')({
  ssr: false,
  component: AsaasDiagnosticPage,
});

function connectionMessage(result: AsaasConnectionResult): string {
  switch (result.connection) {
    case 'not_configured': return 'Não encontrei ASAAS_API_KEY neste servidor.';
    case 'unauthorized': return 'O Asaas recusou a credencial Sandbox (401/403).';
    case 'blocked_environment': return 'ASAAS_ENV está configurado para outro ambiente; teste bloqueado.';
    case 'unavailable': return 'Não foi possível consultar o Asaas Sandbox agora.';
    case 'connected': break;
  }
  switch (result.pixKeys) {
    case 'one_active': return 'API conectada. Existe uma chave Pix ativa.';
    case 'no_active': return 'API conectada, mas não há chave Pix ativa na conta Sandbox.';
    case 'multiple_active': return 'API conectada. Há várias chaves Pix: selecione uma no servidor antes do checkout.';
    default: return 'API conectada. A consulta de chaves Pix não pôde ser concluída.';
  }
}

function AsaasDiagnosticPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AsaasConnectionResult | null>(null);
  const diagnose = useServerFn(diagnoseAsaasSandbox);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser()
      .then(({ data }) => { if (active) setSignedIn(Boolean(data.user)); })
      .catch(() => { if (active) setError('Não foi possível verificar a sessão.'); })
      .finally(() => { if (active) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const logIn = async () => {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: window.location.origin + '/diagnostico-asaas' },
    });
    if (signInError) setError('Não foi possível iniciar o login Google.');
  };

  const runDiagnostic = async () => {
    if (running) return;
    setRunning(true); setError(''); setResult(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
      const outcome = await diagnose({ headers: { Authorization: 'Bearer ' + data.session.access_token } });
      setResult(outcome);
    } catch {
      setError('Falha ao executar o teste. Verifique seu login e tente novamente.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <main style={{ background:'#091422', minHeight:'100dvh', color:'#f8fafc', fontFamily:'system-ui, sans-serif', padding:'28px 16px' }}>
      <section style={{ maxWidth:550, margin:'0 auto', padding:'24px 20px', border:'1px solid #334155', background:'#14243a', borderRadius:18 }}>
        <p style={{ fontSize:12, letterSpacing:1, color:'#93c5fd', fontWeight:800 }}>CRIESEUVIDEO · ASAAS SANDBOX</p>
        <h1 style={{ fontSize:27, letterSpacing:'-1px', margin:'10px 0' }}>Verificar conexão</h1>
        <p style={{ color:'#cbd5e1', lineHeight:1.65 }}>
          Este teste consulta sua API Key no servidor e verifica se a conta Sandbox tem chaves Pix ativas.
          Ele não cria cobrança, QR Code nem movimenta dinheiro ou créditos.
        </p>
        {loading ? <p>Verificando login…</p> : signedIn ?
          <button onClick={runDiagnostic} disabled={running} style={{
            width:'100%', border:0, borderRadius:12, padding:15, fontWeight:800,
            color:'#0f172a', background:'#bfdbfe', opacity:running?0.5:1, cursor:'pointer'
          }}>{running ? 'Consultando Asaas…' : 'Verificar API Asaas Sandbox'}</button>
        : <button onClick={logIn} style={{
            width:'100%', border:0, borderRadius:12, padding:15, fontWeight:800,
            color:'#0f172a', background:'#fff', cursor:'pointer'
          }}>Entrar com Google para testar</button>}
        {result && <p role="status" style={{
          padding:16, borderRadius:12, lineHeight:1.55, marginTop:17,
          background:result.connection==='connected'?'#143d37':'#4a2628',
          color:'#f8fafc', border:'1px solid #64748b'
        }}>{connectionMessage(result)}</p>}
        {error && <p role="alert" style={{ color:'#fca5a5', lineHeight:1.5 }}>{error}</p>}
        <p style={{ marginTop:23, fontSize:12, lineHeight:1.6, color:'#94a3b8' }}>
          Somente homologação. Nenhuma chave secreta ou valor de chave Pix é exibido aqui.
          O checkout de R$ 1 por três créditos permanece desativado nesta página.
        </p>
      </section>
    </main>
  );
}
