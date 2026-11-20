import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Box,Download,Pause,Play,RotateCcw} from 'lucide-react';
import type {ComplexWorldClip} from '../explainer/sceneProgram/planner/complexWorldBatch';
import {SceneProgram3D} from '../explainer/sceneProgram/stage3d';

/**
 * The actual AI-authored SceneProgram3D renders IN the original editor.
 * A generated clip is never replaced by the old Toon 3D host, a sample
 * scene, or a 2D plan. Optional user-uploaded narration is synchronized locally.
 */
export function InlineAi3DPlayer({
  clip,aspect,provider
}:{
  clip:ComplexWorldClip|null;
  aspect:'9:16'|'16:9';
  provider:'gemini'|'lovable'|'demo'|null;
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
  const audioRef=useRef<HTMLAudioElement>(null);
  const voiceBufferRef=useRef<AudioBuffer|null>(null);
  const voiceUrlRef=useRef<string|null>(null);
  const [voiceName,setVoiceName]=useState('');
  const [voiceUrl,setVoiceUrl]=useState('');
  const [voiceDuration,setVoiceDuration]=useState(0);
  const [voiceNote,setVoiceNote]=useState('');
  const seconds=clip?.duration??0;

  useEffect(()=>{playingRef.current=playing;},[playing]);
  // Never persist the narration as part of a different generated scene.
  useEffect(()=>{
    audioRef.current?.pause();
    voiceBufferRef.current=null;setVoiceName('');setVoiceDuration(0);setVoiceUrl('');
    if(voiceUrlRef.current)URL.revokeObjectURL(voiceUrlRef.current);
    voiceUrlRef.current=null;setVoiceNote('');
  },[clip]);
  useEffect(()=>()=>{if(voiceUrlRef.current)URL.revokeObjectURL(voiceUrlRef.current);},[]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const contextLost=(event:Event)=>{
      event.preventDefault();
      playingRef.current=false;setPlaying(false);audioRef.current?.pause();
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
    playingRef.current=false;setPlaying(false);audioRef.current?.pause();
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
      const stage=new SceneProgram3D(clip.program,clip.sources,new Map(),provider==='demo'?'technical':'toon');
      stageRef.current=stage;
      drawRef.current=(seconds:number)=>
        stage.render(renderer,Math.max(0,Math.min(clip.duration-.001,seconds)),width,height);
      drawRef.current(0);
      let previous=performance.now(),nextPaint=0,lastLabel=0;
      const frame=(now:number)=>{
        if(!active)return;
        const dt=Math.min(.10,Math.max(0,(now-previous)/1000));previous=now;
        if(playingRef.current&&!exportRef.current&&!document.hidden){
          const voice=voiceBufferRef.current,audio=audioRef.current;
          if(voice&&audio){
            if(audio.ended){
              playingRef.current=false;setPlaying(false);
            }else if(!audio.paused){
              // Audio is master clock: no drift when the device drops 3D frames.
              clockRef.current=Math.min(clip.duration-.001,
                Math.max(0,audio.currentTime/voice.duration*clip.duration));
            }
          }else{
            clockRef.current=Math.min(clip.duration-.001,clockRef.current+dt);
          }
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
  },[clip,aspect,lite,provider]);

  useEffect(()=>()=>{
    exportAbort.current?.abort();
    stageRef.current?.dispose();
    rendererRef.current?.dispose();
    stageRef.current=null;rendererRef.current=null;
  },[]);

  const seek=(t:number)=>{
    if(!clip||exportRef.current)return;
    playingRef.current=false;setPlaying(false);audioRef.current?.pause();
    clockRef.current=Math.max(0,Math.min(clip.duration-.001,t));
    if(voiceBufferRef.current&&audioRef.current){
      try{audioRef.current.currentTime=clockRef.current/clip.duration*voiceBufferRef.current.duration;}catch{}
    }
    setTime(clockRef.current);
    try{drawRef.current(clockRef.current);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };

  const loadNarration=async(file:File)=>{
    if(!clip||exportRef.current)return;
    setVoiceNote('Lendo narração…');
    try{
      if(file.size>24_000_000)throw new Error('Áudio muito grande: use até 24 MB.');
      const ac=new AudioContext();
      let buffer:AudioBuffer;
      try{buffer=await ac.decodeAudioData(await file.arrayBuffer());}
      finally{await ac.close();}
      if(buffer.duration<.5||buffer.duration>30)
        throw new Error('Para esta sequência, envie um áudio entre 0,5 e 30 segundos.');
      audioRef.current?.pause();
      if(voiceUrlRef.current)URL.revokeObjectURL(voiceUrlRef.current);
      const url=URL.createObjectURL(file);
      voiceUrlRef.current=url;voiceBufferRef.current=buffer;
      setVoiceUrl(url);setVoiceName(file.name);setVoiceDuration(buffer.duration);
      setVoiceNote('Narração pronta: a animação acompanhará a duração real do arquivo.');
      seek(0);
    }catch(e){
      setVoiceNote('Não consegui ler a narração: '+(e instanceof Error?e.message:String(e)));
    }
  };

  const removeNarration=()=>{
    audioRef.current?.pause();voiceBufferRef.current=null;
    if(voiceUrlRef.current)URL.revokeObjectURL(voiceUrlRef.current);
    voiceUrlRef.current=null;setVoiceUrl('');setVoiceName('');setVoiceDuration(0);
    setVoiceNote('Narração removida.');seek(0);
  };

  const togglePlayback=()=>{
    if(!clip||exportRef.current)return;
    const play=!playingRef.current;
    if(!play)audioRef.current?.pause();
    else{
      if(clockRef.current>=clip.duration-.01)seek(0);
      if(voiceBufferRef.current&&audioRef.current){
        try{
          audioRef.current.currentTime=clockRef.current/clip.duration*voiceBufferRef.current.duration;
          void audioRef.current.play().catch(()=>{
            playingRef.current=false;setPlaying(false);
            setVoiceNote('O navegador bloqueou a reprodução do áudio. Toque para reproduzir novamente.');
          });
        }catch{setVoiceNote('Não foi possível iniciar a narração.');}
      }
    }
    playingRef.current=play;setPlaying(play);
  };

  const download=async()=>{
    const canvas=canvasRef.current,gl=rendererRef.current,stage=stageRef.current;
    if(!canvas||!gl||!stage||!clip||exportRef.current||error)return;
    const previousSize={width:canvas.width,height:canvas.height};
    exportRef.current=true;
    playingRef.current=false;setPlaying(false);audioRef.current?.pause();setProgress(0);
    const abort=new AbortController();exportAbort.current=abort;
    try{
      const {encodeFixedFrame3DClip}=await import('../utils/deterministic3dExport');
      const voice=voiceBufferRef.current;
      const exportSeconds=voice?.duration??clip.duration;
      // Preview can be 270x480: export is always portrait 720p or landscape 720p.
      const outputSize=aspect==='9:16'
        ? {width:720,height:1280}:{width:1280,height:720};
      gl.setSize(outputSize.width,outputSize.height,false);
      const result=await encodeFixedFrame3DClip({
        canvas,durationSeconds:exportSeconds,fps:24,signal:abort.signal,
        ...(voice?{audioBuffer:voice}:{}),
        renderFrame:t=>stage.render(gl,
          Math.max(0,Math.min(clip.duration-.001,t*clip.duration/exportSeconds)),
          outputSize.width,outputSize.height),
        onProgress:setProgress
      });
      const url=URL.createObjectURL(result.blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download=`crieseuvideo-3d-ia-${Date.now()}.${result.filenameExtension}`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){
      setVoiceNote('Exportação falhou: '+(e instanceof Error?e.message:String(e)));
    }finally{
      exportAbort.current=null;exportRef.current=false;setProgress(null);
      clockRef.current=0;setTime(0);
      try{gl.setSize(previousSize.width,previousSize.height,false);drawRef.current(0);}catch{}
    }
  };

  return <section className="explainer-stage inline-ai3d-player" aria-label="Prévia do 3D avançado">
    <audio ref={audioRef} src={voiceUrl||undefined} preload="auto"/>
    <div className="native-3d-screen inline-ai3d-stage" style={!clip?{display:'none'}:undefined}>
      <canvas ref={canvasRef} aria-label={provider==='demo'?'Prévia da montagem 3D de celular':'Prévia da cena 3D gerada pela IA'}
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
          onClick={togglePlayback}>
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
        <button type="button" disabled={progress!==null} onClick={()=>{audioRef.current?.pause();setPlaying(false);setLite(v=>!v);}}>
          {lite?'Modo leve ativo':'Modo normal ativo'}
        </button>
        {progress!==null
          ? <button type="button" onClick={()=>exportAbort.current?.abort()}>Cancelar exportação ({progress}%)</button>
          : <button type="button" className="native-3d-download" onClick={()=>void download()}
              disabled={!!error}><Download size={17}/> Baixar cena 3D</button>}
      </div>
      <div className="native-3d-actions">
        <label className="native-3d-download" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px',cursor:'pointer'}}>
          Carregar narração do ElevenLabs
          <input type="file" hidden accept="audio/*"
            aria-label="Carregar narração no 3D avançado" disabled={progress!==null}
            onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void loadNarration(f);}}/>
        </label>
        {voiceName&&<button type="button" disabled={progress!==null} onClick={removeNarration}>Remover áudio</button>}
      </div>
      {voiceName&&<p className="native-3d-small">Áudio: {voiceName} · {voiceDuration.toFixed(1)}s. A sequência de {seconds.toFixed(1)}s é ajustada à duração da narração.</p>}
      {voiceNote&&<p className="native-3d-small" role="status">{voiceNote}</p>}
      <div className="native-3d-numbers">
        <strong>Direção: {provider==='demo'?'Demonstração offline (sem IA)':provider==='lovable'?'IA do Lovable':provider==='gemini'?'Gemini':'Não informado'}</strong>
        <span>{clip.audit.objectCount} objetos · {clip.audit.sceneryRegions} regiões de cenário · {clip.program.shots.length} câmeras{provider==='demo'?' · materiais físicos PBR':''}</span>
      </div>
      <p className="native-3d-small">Exportação 720×1280 (ou 1280×720), quadros fixos e MP4/WebM: {voiceName?'inclui a narração importada':'sem narração (importe um MP3/WAV se desejar)'}. Legendas 3D ainda não foram integradas.</p>
      {error&&<p className="native-3d-error" role="alert">{error}</p>}
    </>}
  </section>;
}
