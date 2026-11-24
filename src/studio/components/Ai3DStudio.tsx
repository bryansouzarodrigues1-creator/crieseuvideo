import {useEffect,useRef,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import * as THREE from 'three';
import {ArrowLeft,Play,Pause,Download,Sparkles,Box,Loader2} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {lovable} from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import {generateAi3DWorld} from '../ai3d.functions';
import {checkGeminiModelStatus,probeGeminiInference,type GeminiModelStatus,type GeminiInferenceProbe} from '../geminiDiagnostics.functions';
import type {GeminiModelChoice} from '../server/ai';
import type {ComplexWorldClip} from '../explainer/sceneProgram/planner/complexWorldBatch';
import {SceneProgram3D} from '../explainer/sceneProgram/stage3d';
import type {AiWorldProvider} from '../explainer/sceneProgram/planner/aiWorldDirector';
import {takeAi3DHandoff} from '../explainer/ai3dHandoff';

const SAMPLE='Um guindaste ergue uma carga de sacos de cimento de uma obra com andaimes e prédios ao fundo. O operador aciona o freio e a carga para sobre a plataforma, enquanto a câmera mostra o tambor e os cabos.';
const FPS=24;

export default function Ai3DStudio(){
  const [script,setScript]=useState(SAMPLE);
  const [provider,setProvider]=useState<AiWorldProvider>('gemini');
  const [geminiModel,setGeminiModel]=useState<GeminiModelChoice>('default');
  const [modelStatus,setModelStatus]=useState<GeminiModelStatus|null>(null);
  const [checkingModel,setCheckingModel]=useState(false);
  const [probeStatus,setProbeStatus]=useState<GeminiInferenceProbe|null>(null);
  const [probing,setProbing]=useState(false);
  const [userId,setUserId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [clip,setClip]=useState<ComplexWorldClip|null>(null);
  const [usedProvider,setUsedProvider]=useState('');
  const [error,setError]=useState('');
  const [playing,setPlaying]=useState(false);
  const [time,setTime]=useState(0);
  const [exportProgress,setExportProgress]=useState<number|null>(null);
  const [lite,setLite]=useState(true);
  const [landscape,setLandscape]=useState(false);
  const [handoffNotice,setHandoffNotice]=useState('');
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const stageRef=useRef<SceneProgram3D|null>(null);
  const drawRef=useRef<(t:number)=>void>(()=>{});
  const clockRef=useRef(0);
  const playingRef=useRef(false);
  const busyExportRef=useRef(false);
  const abortRef=useRef<AbortController|null>(null);
  const send=useServerFn(generateAi3DWorld);
  const checkModel=useServerFn(checkGeminiModelStatus);
  const runProbe=useServerFn(probeGeminiInference);
  const duration=clip?.duration??0;

  useEffect(()=>{
    try {
      const handoff=takeAi3DHandoff(window.sessionStorage);
      if(!handoff)return;
      if(handoff.script.trim())setScript(handoff.script);
      setLandscape(handoff.aspect==='16:9');
      const shortened=handoff.fullScriptLength>handoff.script.length;
      setHandoffNotice(shortened
        ? 'Abrimos as primeiras frases do roteiro. O texto completo continua no editor original; o 3D experimental gera somente um trecho de 8–12 segundos.'
        : handoff.wantsNarration
          ? 'Roteiro transferido. A narração foi selecionada no editor original, mas ainda não é incluída no MP4 deste gerador experimental.'
          : 'Roteiro e formato transferidos do estúdio principal.');
    }catch{
      setHandoffNotice('Não foi possível recuperar o roteiro transferido. Você pode digitá-lo aqui.');
    }
  },[]);

  useEffect(()=>{
    let alive=true;
    let unsubscribe=()=>{};
    try{
      supabase.auth.getSession().then(({data})=>{if(alive)setUserId(data.session?.user.id??null);})
        .catch(()=>{if(alive)setUserId(null);});
      const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
        if(alive)setUserId(session?.user.id??null);
      });
      unsubscribe=()=>data.subscription.unsubscribe();
    }catch{setUserId(null);}
    return ()=>{alive=false;unsubscribe();};
  },[]);
  useEffect(()=>{playingRef.current=playing;},[playing]);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const lost=(event:Event)=>{
      event.preventDefault();playingRef.current=false;setPlaying(false);
      setError('O navegador interrompeu o contexto gráfico. Ative o modo leve e recarregue a página.');
    };
    canvas.addEventListener('webglcontextlost',lost);
    return ()=>canvas.removeEventListener('webglcontextlost',lost);
  },[]);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!clip)return;
    let alive=true;
    let raf=0;
    const width=lite?(landscape?480:270):(landscape?854:480);
    const height=lite?(landscape?270:480):(landscape?480:854);
    clockRef.current=0;setTime(0);setPlaying(false);playingRef.current=false;
    try {
      const renderer=rendererRef.current??new THREE.WebGLRenderer({
        canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'
      });
      rendererRef.current=renderer;
      renderer.setPixelRatio(1);renderer.setSize(width,height,false);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=!lite;
      stageRef.current?.dispose();
      const stage=new SceneProgram3D(clip.program,clip.sources);
      stageRef.current=stage;
      drawRef.current=(t:number)=>stage.render(renderer,Math.max(0,Math.min(duration-.001,t)),width,height);
      drawRef.current(0);
      let last=performance.now(),nextFrame=0,lastLabel=0;
      const loop=(now:number)=>{
        if(!alive)return;
        const dt=Math.max(0,Math.min((now-last)/1000,.15));last=now;
        if(playingRef.current&&!busyExportRef.current&&!document.hidden){
          clockRef.current=Math.min(duration-.001,clockRef.current+dt);
          if(now>=nextFrame){
            nextFrame=now+(lite?67:34);
            try{drawRef.current(clockRef.current);}catch(e){
              playingRef.current=false;setPlaying(false);
              setError(e instanceof Error?e.message:String(e));
            }
            if(now-lastLabel>100){setTime(clockRef.current);lastLabel=now;}
            if(clockRef.current>=duration-.001){playingRef.current=false;setPlaying(false);}
          }
        }
        raf=requestAnimationFrame(loop);
      };
      raf=requestAnimationFrame(loop);
    }catch(e){setError('Falha ao criar a cena 3D: '+(e instanceof Error?e.message:String(e)));}
    return ()=>{
      alive=false;cancelAnimationFrame(raf);playingRef.current=false;
      drawRef.current=()=>{};stageRef.current?.dispose();stageRef.current=null;
    };
  },[clip,landscape,lite,duration]);
  useEffect(()=>()=>{
    abortRef.current?.abort();
    stageRef.current?.dispose();rendererRef.current?.dispose();
  },[]);

  const signIn=async(provider:'google'|'lovable')=>{
    setError('');
    try{
      const r=await lovable.auth.signInWithOAuth(provider,{redirect_uri:window.location.href});
      if(r.error)setError(r.error.message);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}
  };
  const diagnoseModel=async()=>{
    if(checkingModel||busy||!userId)return;
    setCheckingModel(true);setModelStatus(null);
    try{
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!session?.access_token)
        throw new Error('Entre com sua conta antes de verificar a conexão.');
      const status=await checkModel({
        data:{geminiModel},
        headers:{Authorization:`Bearer ${session.access_token}`},
      });
      setModelStatus(status);
    }catch{
      setModelStatus({model:'não identificado',status:'network_error',
        note:'O diagnóstico não pôde ser concluído. Confira a sessão e a conexão do site.'});
    }finally{setCheckingModel(false);}
  };
  const testMinimalInference=async()=>{
    if(probing||busy||!userId)return;
    setProbing(true);setProbeStatus(null);
    try{
      const {data:{session},error:authError}=await supabase.auth.getSession();
      if(authError||!session?.access_token)throw Error('Sessão expirada');
      const result=await runProbe({
        data:{geminiModel},
        headers:{Authorization:`Bearer ${session.access_token}`},
      });
      setProbeStatus(result);
    }catch{
      setProbeStatus({model:geminiModel,status:'network_error',
        note:'Não foi possível executar o teste mínimo autenticado. Verifique a sessão.'});
    }finally{setProbing(false);}
  };
  const generate=async()=>{
    if(busy||busyExportRef.current||!userId)return;
    setError('');setPlaying(false);setBusy(true);
    try{
      // The protected server function expects an Authorization Bearer header.
      // A visible login alone did not attach the user's token to the request.
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!session?.access_token)
        throw new Error('Sua sessão expirou. Entre novamente antes de gerar.');
      const result=await send({
        data:{script,provider,confirmCost:true,geminiModel},
        headers:{Authorization:`Bearer ${session.access_token}`},
      });
      setClip(result.clip);setUsedProvider(result.provider);
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      setError(/HTTP 5xx|serviço indisponível|falha temporária do serviço/i.test(message)
        ?'O Gemini não conseguiu atender a chamada (erro HTTP 5xx). A cena não foi entregue ao motor. Você pode verificar a conexão sem gerar vídeo ou escolher outro modelo manualmente. '+message
        :'A IA não conseguiu construir uma cena 3D válida: '+message);
    }finally{setBusy(false);}
  };
  const seek=(t:number)=>{
    if(busyExportRef.current||!clip)return;
    clockRef.current=Math.max(0,Math.min(duration-.001,t));
    setTime(clockRef.current);
    try{drawRef.current(clockRef.current);}catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const exportClip=async()=>{
    const canvas=canvasRef.current;
    if(!canvas||!clip||busyExportRef.current)return;
    const ctrl=new AbortController();abortRef.current=ctrl;
    busyExportRef.current=true;setPlaying(false);playingRef.current=false;
    setError('');setExportProgress(0);
    try{
      const {encodeFixedFrame3DClip}=await import('../utils/deterministic3dExport');
      const video=await encodeFixedFrame3DClip({
        canvas,durationSeconds:duration,fps:FPS,signal:ctrl.signal,
        renderFrame:t=>drawRef.current(t),
        onProgress:setExportProgress,
      });
      const url=URL.createObjectURL(video.blob);
      const link=document.createElement('a');
      link.href=url;link.download=`crieseuvideo-ia-3d-${Date.now()}.${video.filenameExtension}`;
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError(e instanceof Error?e.message:'Exportação falhou.');}
    finally{
      abortRef.current=null;busyExportRef.current=false;setExportProgress(null);
      clockRef.current=0;setTime(0);
      try{drawRef.current(0);}catch{}
    }
  };

  return <main className="native-3d-studio ai3d-studio">
    <nav className="native-3d-bar">
      <a className="native-3d-return" href="/motor-3d"><ArrowLeft size={18}/> Voltar aos testes 3D</a>
      <span className="native-3d-engine"><Sparkles size={18}/> Gemini + IA Lovable</span>
    </nav>
    <header className="native-3d-heading">
      <span className="native-3d-eyebrow">GERAÇÃO 3D POR ROTEIRO • EXPERIMENTAL</span>
      <h1>Crie uma cena 3D inédita com IA</h1>
      <p>Os modelos propõem cenários, objetos, ações e câmeras. O motor Three.js monta e anima a cena validada. Nada é substituído por um vídeo de demonstração.</p>
      {handoffNotice&&<p className="ai3d-handoff-notice" role="status">{handoffNotice}</p>}
    </header>
    <div className="native-3d-layout">
      <section className="native-3d-choices ai3d-panel">
        <label htmlFor="ai3d-script">Roteiro da cena: 1 a 3 frases</label>
        <textarea id="ai3d-script" rows={7} maxLength={750} value={script} disabled={busy}
          onChange={e=>setScript(e.target.value)}/>
        <p className="native-3d-small">Descreva o lugar completo, o objeto que se movimenta e o resultado da ação. {script.length}/750 caracteres. Uma tentativa gera aproximadamente 8–12 segundos, não um filme inteiro.</p>
        <label htmlFor="ai3d-provider">IA responsável pela direção</label>
        <select id="ai3d-provider" value={provider} onChange={e=>setProvider(e.target.value as AiWorldProvider)} disabled={busy}>
          <option value="auto">Automático: Lovable, com Gemini como alternativa</option>
          <option value="gemini">Gemini direto</option>
          <option value="lovable">IA do Lovable</option>
        </select>
        {provider!=='lovable'&&<div style={{margin:'12px 0 16px',padding:'14px',
          border:'1px solid #3e566c',borderRadius:12,background:'#101e2d'}}>
          <label htmlFor="ai3d-gemini-model" style={{display:'block',fontWeight:800,marginBottom:8}}>Modelo Gemini</label>
          <select id="ai3d-gemini-model" value={geminiModel}
            onChange={e=>{setGeminiModel(e.target.value as GeminiModelChoice);setModelStatus(null);setProbeStatus(null);}}
            disabled={busy||checkingModel}>
            <option value="default">Padrão configurado no servidor</option>
            <option value="gemini-3.6-flash">Gemini 3.6 Flash · alternativa manual</option>
            <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
          </select>
          <button type="button" onClick={()=>void diagnoseModel()}
            disabled={busy||checkingModel||!userId}
            style={{marginTop:10,padding:'10px 13px',border:'1px solid #7791a5',
              borderRadius:9,background:'#253c4e',color:'#f3fbff',fontWeight:800}}>
            {checkingModel?'Consultando modelo…':'Verificar conexão (sem gerar vídeo)'}
          </button>
          <button type="button" onClick={()=>void testMinimalInference()}
            disabled={busy||checkingModel||probing||!userId}
            style={{display:'block',marginTop:12,padding:'11px 13px',
              border:'1px solid #ec8491',borderRadius:9,
              background:'#4a222d',color:'#fff',fontWeight:800}}>
            {probing?'Testando geração mínima…':'Testar geração mínima (usa poucos tokens)'}
          </button>
          <p style={{fontSize:12,lineHeight:1.6,color:'#e0bfcb',margin:'7px 0'}}>
            Envia somente a frase “Responda OK” com uma única chamada à API Google.
            Não produz vídeo nem tenta novamente; pode consumir tokens da sua cota.
          </p>
          {probeStatus&&<p role="status" style={{padding:'12px',borderRadius:8,
            background:probeStatus.status==='success'?'#173d2e':'#4b232e',
            color:'#fff',fontSize:13,lineHeight:1.6}}>
            <strong>{probeStatus.status==='success'?'Teste mínimo passou':'Teste mínimo não passou'}</strong>
            {' · '+probeStatus.model}
            {typeof probeStatus.httpStatus==='number'?' · HTTP '+probeStatus.httpStatus:''}
            {typeof probeStatus.durationMs==='number'?' · '+(probeStatus.durationMs/1000).toFixed(1)+'s':''}
            {typeof probeStatus.tokenUsage==='number'?' · '+probeStatus.tokenUsage+' tokens':''}
            <span style={{display:'block',marginTop:4}}>{probeStatus.note}</span>
          </p>}
          {modelStatus&&<p role="status" style={{marginTop:10,fontSize:13,lineHeight:1.6,
            color:modelStatus.status==='available'?'#b0edc7':'#ffc8b5'}}>
            <strong>{modelStatus.model}</strong>: {modelStatus.note}
            {typeof modelStatus.httpStatus==='number'?' · HTTP '+modelStatus.httpStatus:''}
          </p>}
          <p style={{fontSize:12,lineHeight:1.6,color:'#abc1d1',marginTop:10}}>
            O diagnóstico apenas consulta o catálogo Google, sem gastar tokens de geração.
            Erros 500/503 no momento de gerar podem ocorrer mesmo com o modelo acessível.
            Escolher outra versão não dispara uma geração automaticamente.
          </p>
        </div>}
        <p className="native-3d-small" role="note">Ao clicar em Gerar cena 3D, você solicita uma geração que pode consumir créditos mesmo que falhe. No modo Automático, até dois provedores podem ser consultados.</p>
        {userId?
          <button type="button" className="ai3d-generate" disabled={busy||!!exportProgress} onClick={()=>void generate()}>
            {busy?<Loader2 size={18}/>:<Sparkles size={18}/>}
            {busy?'Planejando objetos, cenário e movimento…':'Gerar cena 3D pela IA (pode usar créditos)'}
          </button>:
          <div className="ai3d-signin">
            <p>Faça login para gerar; a API não pode ser chamada anonimamente.</p>
            <button onClick={()=>void signIn('google')}>Entrar com Google</button>
            <button onClick={()=>void signIn('lovable')}>Entrar com Lovable</button>
          </div>}
        {error&&<p className="native-3d-error" role="alert">{error}</p>}
        <p className="native-3d-small">Uma chamada pode consumir créditos mesmo se a resposta for inválida. Sem tentativas automáticas adicionais. Mensagens de erro de API identificam ausência de chave, cota, autenticação ou indisponibilidade sem expor segredos.</p>
      </section>
      <section className="native-3d-player">
        <div className="native-3d-screen ai3d-preview">
          <canvas ref={canvasRef} style={{display:clip?'block':'none',aspectRatio:landscape?'16 / 9':'9 / 16'}} aria-label="Cena 3D criada pela inteligência artificial"/>
          {!clip&&<div className="native-3d-start">
            <Box size={34}/><strong>A cena 3D aparecerá aqui</strong>
            <span>Uma cidade ou ambiente completo, objetos modelados e ações devem vir da IA após a validação.</span>
          </div>}
        </div>
        <div className="native-3d-controls">
          <button disabled={!clip||busy||exportProgress!==null} onClick={()=>{if(clockRef.current>=duration-.01)seek(0);setPlaying(v=>!v);}}>
            {playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Pausar':'Reproduzir'}
          </button>
          <input type="range" aria-label="Linha do tempo 3D" min={0} max={duration||1} step={0.05} value={time}
            disabled={!clip||exportProgress!==null} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/>
          <span className="native-3d-clock">{time.toFixed(1)} / {duration.toFixed(1)}s</span>
        </div>
        {clip&&<div className="native-3d-numbers">
          <strong>Gerado por {usedProvider==='lovable'?'IA do Lovable':'Gemini'}</strong>
          <span>{clip.audit.sceneNodes} nós · {clip.audit.objectCount} objetos · {clip.audit.sceneryRegions} regiões de cenário · {clip.program.shots.length} câmeras</span>
        </div>}
        <div className="native-3d-actions">
          <button disabled={exportProgress!==null} onClick={()=>setLite(v=>!v)}>
            {lite?'Modo leve ativo':'Modo normal ativo'}
          </button>
          <button disabled={exportProgress!==null} onClick={()=>setLandscape(v=>!v)}>
            {landscape?'Vertical 9:16':'Horizontal 16:9'}
          </button>
          {exportProgress!==null?
            <button onClick={()=>abortRef.current?.abort()}>Cancelar exportação ({exportProgress}%)</button>:
            <button className="native-3d-download" disabled={!clip||busy} onClick={()=>void exportClip()}>
              <Download size={17}/> Baixar vídeo 3D
            </button>}
        </div>
        <p className="native-3d-small">O MP4/WebM contém animação 3D, mas ainda não inclui narração nem legendas automáticas. A qualidade depende dos modelos, da gramática de geometria e do planejamento da cena.</p>
      </section>
    </div>
  </main>;
}
