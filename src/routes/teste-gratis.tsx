import {createFileRoute} from '@tanstack/react-router';
import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';

/**
 * Experimental Google OAuth entry point. A login is NOT a trial credit.
 * The backend quota/Turnstile claim must be deployed before enabling generation.
 */
export const Route=createFileRoute('/teste-gratis')({
 ssr:false,
 component:FreeTrialLogin,
});

function FreeTrialLogin(){
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 const [googleLinked,setGoogleLinked]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  let mounted=true;
  supabase.auth.getUser().then(({data,error:authError})=>{
    if(!mounted)return;
    const user=data?.user;
    setSignedIn(Boolean(user));
    const providers=(user?.app_metadata?.providers||[]) as string[];
    setGoogleLinked(Boolean(user&&(user.app_metadata?.provider==='google'||providers.includes('google'))));
    if(authError)setError('Não foi possível consultar a sessão.');
  }).catch(()=>{
    if(mounted)setError('Não foi possível consultar a sessão.');
  }).finally(()=>{if(mounted)setLoading(false);});
  return ()=>{mounted=false};
 },[]);

 const googleSignIn=async()=>{
  setBusy(true);setError('');
  try{
   const {error:authError}=await supabase.auth.signInWithOAuth({
    provider:'google',options:{redirectTo:window.location.origin+'/teste-gratis'}
   });
   if(authError)throw authError;
  }catch{
   setError('Não foi possível iniciar o login Google. Verifique se o provedor foi configurado no Supabase.');
  }finally{setBusy(false);}
 };

 return (
  <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:20,background:'#101827',color:'white'}}>
   <section style={{width:'100%',maxWidth:490,padding:28,border:'1px solid #334155',borderRadius:16}}>
    <h1 style={{fontSize:28,fontWeight:700,marginBottom:12}}>CrieSeuVideo · Teste grátis</h1>
    <p style={{color:'#cbd5e1',lineHeight:1.5,marginBottom:20}}>
     Preparação do acesso a um vídeo experimental de até 20 segundos por conta verificada.
     O crédito gratuito ainda não está ativado e não haverá geração por esta página.
    </p>
    {loading?<p>Verificando sessão…</p>:
      googleLinked?<p>Conta Google conectada. A liberação do teste depende da cota verificada no servidor.</p>:
      <button type="button" onClick={googleSignIn} disabled={busy}
       style={{padding:'12px 20px',borderRadius:8,background:'#f8fafc',color:'#0f172a',fontWeight:700,opacity:busy?0.5:1}}>
       {busy?'Abrindo Google…':signedIn?'Vincular conta Google':'Entrar com Google'}
      </button>}
    {error&&<p role="alert" style={{color:'#fca5a5',marginTop:12}}>{error}</p>}
    <p style={{fontSize:12,color:'#94a3b8',marginTop:22}}>
     Um IP pode ser compartilhado por várias pessoas. Não usamos IP sozinho para bloquear contas;
     sinais antifraude devem ser tratados com transparência e retenção limitada.
    </p>
   </section>
  </main>
 );
}
