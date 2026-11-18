import {useEffect,useRef,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import * as THREE from 'three';
import {ArrowLeft,Play,Pause,Download,Sparkles,Box,Loader2} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {lovable} from '@/integrations/lovable';
import '@lovable.dev/cloud-auth-js/styles.css';
import {generateAi3DWorld} from '../ai3d.functions';
import type {ComplexWorldClip} from '../explainer/sceneProgram/planner/complexWorldBatch';
import {SceneProgram3D} from '../explainer/sceneProgram/stage3d';
import type {AiWorldProvider} from '../explainer/sceneProgram/planner/aiWorldDirector';

const SAMPLE='Um guindaste ergue uma carga de sacos de cimento de uma obra com andaimes e prédios ao fundo. O operador aciona o freio e a carga para sobre a plataforma, enquanto a câmera mostra o tambor e os cabos.';
const FPS=24;

export default function Ai3DStudio(){
  const [script,setScript]=useState(SAMPLE);
  const [provider,setProvider]=useState<AiWorldProvider>('auto');
  const [consent,setConsent]=useState(false);
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
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const stageRef=useRef<SceneProgram3D|null>(null);
  const drawRef=useRef<(t:number)=>void>(()=>{});
  const clockRef=useRef(0);
  const playingRef=useRef(false);
  const busyExportRef=useRef(false);
  const abortRef=useRef<AbortController|null>(null);
  const send=useServerFn(generateAi3DWorld);
  const duration=clip?.duration??0;

  useEffect(()=>{
    let alive=true;
    supabase.auth.getSession().then(({data})=>{if(alive)setUserId(data.session?.user.id??null);})
      .catch(()=>{if(alive)setUserId(null);});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(alive)setUserId(session?.user.id??null);
    });
    return ()=>{alive=false;data.subscription.unsubscribe();};
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
  const generate=async()=>{
    if(busy||busyExportRef.current||!userId||!consent)return;
    setError('');setPlaying(false);setBusy(true);
    try{
      const result=await send({data:{script,provider,confirmCost:true}});
      setClip(result.clip);setUsedProvider(result.provider);
    }catch(e){
      setError('A IA não conseguiu construir uma cena 3D válida: '+(e instanceof Error?e.message:String(e)));
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
    finally{abortRef.current=null;busyExportRef.current=false;setExportProgress(null);seek(0);}
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
    </header>
    <div className="native-3d-layout">
      <section className="native-3d-choices ai3d-panel">
        <label htmlFor="ai3d-script">Roteiro da cena: 2 ou 3 frases</label>
        <textarea id="ai3d-script" rows={7} maxLength={750} value={script} disabled={busy}
          onChange={e=>setScript(e.target.value)}/>
        <p className="native-3d-small">Descreva o lugar completo, o objeto que se movimenta e o resultado da ação. {script.length}/750 caracteres. Uma tentativa gera 8–12 segundos, não um filme inteiro.</p>
        <label htmlFor="ai3d-provider">IA responsável pela direção</label>
        <select id="ai3d-provider" value={provider} onChange={e=>setProvider(e.target.value as AiWorldProvider)} disabled={busy}>
          <option value="auto">Automático: Lovable, com Gemini como alternativa</option>
          <option value="gemini">Gemini direto</option>
          <option value="lovable">IA do Lovable</option>
        </select>
        <label className="ai3d-consent">
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          Concordo em fazer uma chamada que pode consumir créditos/cotas de IA.
        </label>
        {userId?
          <button type="button" className="ai3d-generate" disabled={busy||!consent||!!exportProgress} onClick={()=>void generate()}>
            {busy?<Loader2 size={18}/>:<Sparkles size={18}/>}
            {busy?'Planejando objetos, cenário e movimento…':'Gerar cena 3D pela IA'}
          </button>:
          <div className="ai3d-signin">
            <p>Faça login para gerar; a API não pode ser chamada anonimamente.</p>
            <button onClick={()=>void signIn('google')}>Entrar com Google</button>
            <button onClick={()=>void signIn('lovable')}>Entrar com Lovable</button>
          </div>}
        {error&&<p className="native-3d-error" role="alert">{error}</p>}
        <p className="native-3d-small">A geração pode ser rejeitada se o modelo falhar na geometria, câmera ou trajetória. Não há cobrança adicional automática para tentar novamente.</p>
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
