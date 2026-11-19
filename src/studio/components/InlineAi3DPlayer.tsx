import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Box,Download,Pause,Play,RotateCcw} from 'lucide-react';
import type {ComplexWorldClip} from '../explainer/sceneProgram/planner/complexWorldBatch';
import {SceneProgram3D} from '../explainer/sceneProgram/stage3d';

/**
 * The actual AI-authored SceneProgram3D renders IN the original editor.
 * A generated clip is never replaced by the old Toon 3D host, a sample
 * scene, or a 2D plan. Narration/export remain separate until synchronized.
 */
export function InlineAi3DPlayer({
  clip,aspect,provider
}:{
  clip:ComplexWorldClip|null;
  aspect:'9:16'|'16:9';
  provider:'gemini'|'lovable'|null;
}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const stageRef=useRef<SceneProgram3D|null>(null);
  const drawRef=useRef<(seconds:number)=>void>(()=>{});
  const rafRef=useRef(0);
  const clockRef=useRef(0);
  const playingRef=useRef(false);
  const exportRef=useRef(false);
  const exportAbort=useRef<AbortController|null>(null);
  const [time,setTime]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState('');
  const [lite,setLite]=useState(true);
  const [progress,setProgress]=useState<number|null>(null);
  const seconds=clip?.duration??0;

  useEffect(()=>{playingRef.current=playing;},[playing]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const contextLost=(event:Event)=>{
      event.preventDefault();
      playingRef.current=false;setPlaying(false);
      setError('O navegador interrompeu o WebGL. Ative o modo leve e recarregue esta página.');
    };
    canvas.addEventListener('webglcontextlost',contextLost);
    return()=>canvas.removeEventListener('webglcontextlost',contextLost);
  },[]);

  useEffect(()=>{
    if(!clip||!canvasRef.current)return;
    const canvas=canvasRef.current;
    const width=lite?(aspect==='9:16'?270:480):(aspect==='9:16'?480:854);
    const height=lite?(aspect==='9:16'?480:270):(aspect==='9:16'?854:480);
    let active=true;
    let raf=0;
    setError('');setTime(0);clockRef.current=0;
    playingRef.current=false;setPlaying(false);
    try{
      const renderer=rendererRef.current??new THREE.WebGLRenderer({
        canvas,alpha:false,antialias:false,preserveDrawingBuffer:true,
        powerPreference:'low-power'
      });
      rendererRef.current=renderer;
      renderer.setPixelRatio(1);
      renderer.setSize(width,height,false);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=!lite;
      stageRef.current?.dispose();
      const stage=new SceneProgram3D(clip.program,clip.sources);
      stageRef.current=stage;
      drawRef.current=(seconds:number)=>
        stage.render(renderer,Math.max(0,Math.min(clip.duration-.001,seconds)),width,height);
      drawRef.current(0);
      let previous=performance.now(),nextPaint=0,lastLabel=0;
      const frame=(now:number)=>{
        if(!active)return;
        const dt=Math.min(.10,Math.max(0,(now-previous)/1000));previous=now;
        if(playingRef.current&&!exportRef.current&&!document.hidden){
          clockRef.current=Math.min(clip.duration-.001,clockRef.current+dt);
          if(now>=nextPaint){
            nextPaint=now+(lite?68:34);
            try{drawRef.current(clockRef.current);}
            catch(e){
              playingRef.current=false;setPlaying(false);
              setError('Falha ao renderizar cena: '+(e instanceof Error?e.message:String(e)));
            }
            if(now-lastLabel>100){setTime(clockRef.current);lastLabel=now;}
          }
          if(clockRef.current>=clip.duration-.001){playingRef.current=false;setPlaying(false);setTime(clockRef.current);}
        }
        raf=requestAnimationFrame(frame);
      };
      raf=requestAnimationFrame(frame);rafRef.current=raf;
    }catch(e){
      setError('O motor 3D não conseguiu carregar esta cena: '+(e instanceof Error?e.message:String(e)));
    }
    return()=>{
      active=false;cancelAnimationFrame(rafRef.current);cancelAnimationFrame(raf);
      playingRef.current=false;drawRef.current=()=>{};
      stageRef.current?.dispose();stageRef.current=null;
    };
  },[clip,aspect,lite]);

  useEffect(()=>()=>{
    exportAbort.current?.abort();
    stageRef.current?.dispose();
    rendererRef.current?.dispose();
    stageRef.current=null;rendererRef.current=null;
  },[]);

  const seek=(t:number)=>{
    if(!clip||exportRef.current)return;
    playingRef.current=false;setPlaying(false);
    clockRef.current=Math.max(0,Math.min(clip.duration-.001,t));
    setTime(clockRef.current);
    try{drawRef.current(clockRef.current);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };

  const download=async()=>{
    const canvas=canvasRef.current;
    if(!canvas||!clip||exportRef.current||error)return;
    exportRef.current=true;
    playingRef.current=false;setPlaying(false);setProgress(0);
    const abort=new AbortController();exportAbort.current=abort;
    try{
      const {encodeFixedFrame3DClip}=await import('../utils/deterministic3dExport');
      const result=await encodeFixedFrame3DClip({
        canvas,durationSeconds:clip.duration,fps:24,signal:abort.signal,
        renderFrame:t=>drawRef.current(t),onProgress:setProgress
      });
      const url=URL.createObjectURL(result.blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=`crieseuvideo-3d-ia-${Date.now()}.${result.filenameExtension}`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){
      setError('Exportação falhou: '+(e instanceof Error?e.message:String(e)));
    }finally{
      exportAbort.current=null;exportRef.current=false;setProgress(null);
      clockRef.current=0;setTime(0);
      try{drawRef.current(0);}catch{}
    }
  };

  return <section className="explainer-stage inline-ai3d-player" aria-label="Prévia do 3D avançado">
    <div className="native-3d-screen inline-ai3d-stage" style={!clip?{display:'none'}:undefined}>
      <canvas ref={canvasRef} aria-label="Prévia da cena 3D gerada pela IA"
        style={{aspectRatio:aspect==='9:16'?'9 / 16':'16 / 9'}}/>
    </div>
    {!clip ? <div className="explainer-empty-preview" role="status">
      <Box aria-hidden="true"/>
      <h2>Cenário 3D criado pelo Gemini ou Lovable</h2>
      <p>Seu roteiro será transformado em objetos, cenário, movimento e câmeras. Após autorização, a prévia aparecerá aqui, dentro deste editor — sem o personagem antigo.</p>
      <p>Primeira etapa: 8–12 segundos por sequência. Narração e legendas 3D continuam pendentes.</p>
    </div> : <>
      <div className="native-3d-controls">
        <button type="button" disabled={progress!==null||!!error}
          onClick={()=>{if(clockRef.current>=seconds-.01)seek(0);setPlaying(v=>!v);}}>
          {playing?<Pause size={17}/>:<Play size={17}/>}
          {playing?'Pausar':'Reproduzir'}
        </button>
        <input type="range" min={0} max={seconds} step={0.05} value={time}
          aria-label="Linha do tempo do 3D avançado" disabled={progress!==null}
          onChange={e=>seek(Number(e.target.value))}/>
        <span className="native-3d-clock">{time.toFixed(1)} / {seconds.toFixed(1)}s</span>
        <button type="button" title="Reiniciar" onClick={()=>seek(0)}
          disabled={progress!==null}><RotateCcw size={17}/></button>
      </div>
      <div className="native-3d-actions">
        <button type="button" disabled={progress!==null} onClick={()=>setLite(v=>!v)}>
          {lite?'Modo leve ativo':'Modo normal ativo'}
        </button>
        {progress!==null
          ? <button type="button" onClick={()=>exportAbort.current?.abort()}>Cancelar exportação ({progress}%)</button>
          : <button type="button" className="native-3d-download" onClick={()=>void download()}
              disabled={!!error}><Download size={17}/> Baixar cena 3D</button>}
      </div>
      <div className="native-3d-numbers">
        <strong>Direção: {provider==='lovable'?'IA do Lovable':'Gemini'}</strong>
        <span>{clip.audit.objectCount} objetos · {clip.audit.sceneryRegions} regiões de cenário · {clip.program.shots.length} câmeras</span>
      </div>
      <p className="native-3d-small">Arquivo 3D experimental com quadros fixos. Este download ainda não inclui voz nem legendas, mesmo que a preferência de narração esteja ativa no editor.</p>
      {error&&<p className="native-3d-error" role="alert">{error}</p>}
    </>}
  </section>;
}
