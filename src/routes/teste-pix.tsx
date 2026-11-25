import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startIntroPixSandbox, getMyPixOrder, getMyVideoCredits, verifyMyPixSandboxPayment, checkAsaasSandboxConnection } from '@/studio/payments/checkout.functions';

export const Route = createFileRoute('/teste-pix')({ ssr: false, component: SandboxPixPage });

function SandboxPixPage() {
 const [signedIn, setSignedIn] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [orderId, setOrderId] = useState<string | null>(null);
 const [pix, setPix] = useState('');
 const [state, setState] = useState('');
 const [balance, setBalance] = useState<number | null>(null);
 const [connectionResult, setConnectionResult] = useState('');
 const start = useServerFn(startIntroPixSandbox);
 const lookup = useServerFn(getMyPixOrder);
 const credits = useServerFn(getMyVideoCredits);
 const reconcile = useServerFn(verifyMyPixSandboxPayment);
 const checkConnection = useServerFn(checkAsaasSandboxConnection);
 const sessionHeaders = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Entre novamente com Google.');
  return { Authorization: 'Bearer ' + data.session.access_token };
 };
 const probe = async () => {
  setBusy(true); setConnectionResult('');
  try {
   const headers = await sessionHeaders();
   const status = await checkConnection({ headers });
   setConnectionResult(status.ok ? (
    status.pixKeys === 'one_active' ? 'API conectada. Uma chave Pix ativa pronta para teste.' :
    status.pixKeys === 'configured' ? 'API conectada. Chave Pix definida no servidor.' :
    status.pixKeys === 'no_active' ? 'API conectada, mas falta cadastrar uma chave Pix ativa na conta Sandbox.' :
    status.pixKeys === 'multiple_active' ? 'API conectada. Há várias chaves Pix; selecione uma no servidor antes do QR.' :
    'API conectada, mas não foi possível consultar as chaves Pix.'
   ) :
    status.reason === 'key_missing' ? 'A chave ASAAS_API_KEY não foi encontrada neste servidor.' :
    status.reason === 'unauthorized' ? 'A API respondeu 401/403. Confira a chave de homologação.' :
    status.reason === 'wrong_environment' ? 'Este servidor não está configurado para o Sandbox.' :
    'Não foi possível confirmar a API agora.');
  } catch { setConnectionResult('Faça login antes de verificar a conexão.'); }
  finally { setBusy(false); }
 };
 const enabled = import.meta.env['VITE_ASAAS_SANDBOX_DEMO'] === 'true';

 useEffect(() => {
  let alive = true;
  supabase.auth.getUser().then(({ data }) => { if (alive) setSignedIn(Boolean(data.user)); })
   .catch(() => {});
  const { data } = supabase.auth.onAuthStateChange((_type, session) => { if (alive) setSignedIn(Boolean(session)); });
  return () => { alive = false; data.subscription.unsubscribe(); };
 }, [enabled]);

 const begin = async () => {
  if (busy) return;
  setBusy(true); setError('');
  try {
   const headers = await sessionHeaders();
   const result = await start({ data: { requestId: crypto.randomUUID() }, headers });
   if (!result.ok || !result.orderId || !result.pix) {
    setError(result.error || 'Não foi possível iniciar a simulação.');
    return;
   }
   setOrderId(result.orderId); setPix(result.pix); setState('pending');
  } catch { setError('Não foi possível criar o Pix de teste.'); }
  finally { setBusy(false); }
 };
 const refresh = async () => {
  if (!orderId || busy) return;
  setBusy(true); setError('');
  try {
   const headers = await sessionHeaders();
   await reconcile({ data: { orderId }, headers });
   const [o, c] = await Promise.all([
    lookup({ data: { orderId }, headers }), credits({ headers }),
   ]);
   setState(o?.state || 'not_found'); setBalance(c.balance);
  } catch { setError('Não foi possível consultar o pedido.'); }
  finally { setBusy(false); }
 };

 return <main style={{ minHeight: '100vh', background: '#071627', color: '#fff', padding: '35px 16px', fontFamily: 'system-ui' }}>
  <section style={{ maxWidth: 550, margin: '0 auto', background: '#14243a', borderRadius: 18, padding: 22 }}>
   <p style={{ color: '#93c5fd', fontWeight: 700 }}>CrieSeuVideo · SANDBOX ASAAS</p>
   <h1>Teste Pix · R$ 1 por 3 créditos</h1>
   {!enabled && <p style={{ color: '#fde68a' }}>Checkout desativado nesta versão. A verificação da API abaixo é somente leitura.</p>}
   {signedIn && <div style={{ marginBottom: 16 }}><button type="button" disabled={busy} onClick={probe} style={{ padding: 12, borderRadius: 9, background: '#334155', color: '#fff' }}>Verificar conexão Asaas Sandbox</button>{connectionResult && <p role="status">{connectionResult}</p>}</div>}
   <p style={{ lineHeight: 1.6, color: '#cbd5e1' }}>
    Ambiente de homologação. Este QR é apenas para simulação no Asaas Sandbox. Não envie dinheiro real.
   </p>
   {!signedIn
    ? <p>Entre com o Google pela <a href="/teste-gratis" style={{ color: '#93c5fd' }}>tela de cadastro</a> antes de iniciar.</p>
    : <button disabled={busy || !enabled} onClick={begin} style={{ padding: 14, background: '#bfdbfe', borderRadius: 10, color: '#0f172a', fontWeight: 700 }}>
       {busy ? 'Processando…' : 'Criar Pix de TESTE'}
      </button>}
   {pix && <div style={{ marginTop: 22 }}>
     <p>Pedido: <code>{orderId}</code></p>
     <p>Pix Copia e Cola (Sandbox, não pague fora dos testes):</p>
     <textarea aria-label="Pix Copia e Cola de teste" readOnly value={pix}
      style={{ width: '100%', minHeight: 110, padding: 10, color: '#111827', borderRadius: 8 }} />
     <button onClick={() => navigator.clipboard.writeText(pix)} style={{ marginTop: 10, padding: 12, background: '#f8fafc', color: '#0f172a', borderRadius: 8 }}>Copiar código de teste</button>
     <p>Status: <strong>{state || 'pendente'}</strong>{balance !== null ? ' · Saldo: ' + balance : ''}</p>
     <button disabled={busy} onClick={refresh} style={{ padding: 12, background: '#1e40af', color: 'white', borderRadius: 8 }}>Confirmar pagamento no Asaas</button>
    </div>}
   {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
  </section>
 </main>;
}
