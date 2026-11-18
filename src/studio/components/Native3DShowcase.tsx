import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowLeft, Box, Clapperboard, Download, Pause, Play, RefreshCw } from 'lucide-react';
import { buildComplexWorldBatchDemo } from '../explainer/sceneProgram/planner/complexWorldBatchDemo';
import { SceneProgram3D } from '../explainer/sceneProgram/stage3d';

const showcase = [
  { title: 'Motocicleta 3D', subtitle: 'Motor, carenagem e rodas em movimento', source: 2 },
  { title: 'Arca e oceano', subtitle: 'Casco, passarela e água dinâmica', source: 0 },
  { title: 'Prisão 3D', subtitle: 'Torres, portão móvel e viatura', source: 1 },
] as const;
const CLIP_SECONDS = 6;
const FRAME_RATE = 24;
const downloadFormats = [
  'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1',
  'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
];

function preferredFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  const mime = downloadFormats.find(m => MediaRecorder.isTypeSupported(m));
  return mime ? { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' } : null;
}

/** Distinct from the old StickStory renderer. The same procedural SceneProgram3D
 * that passed the standalone GitHub Chromium tests is used by this site. */
export default function Native3DShowcase() {
  const [choice, setChoice] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<number | null>(null);
  const [stats, setStats] = useState({ nodes: 0, tracks: 0, objects: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(false);
  const exportingRef = useRef(false);
  const timeRef = useRef(0);
  const drawRef = useRef<(t:number)=>void>(()=>{});
  const animRef = useRef<number>(0);
  const stopExportRef = useRef<(() => void) | null>(null);
  const mode = showcase[choice];

  const seek = useCallback((next:number) => {
    if (exportingRef.current) return;
    const safe=Math.max(0,Math.min(CLIP_SECONDS-.001,next));
    timeRef.current=safe;setTime(safe);
    try { drawRef.current(safe); } catch(e){ setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  useEffect(() => { playingRef.current=playing; },[playing]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas=canvasRef.current;
    const width=landscape ? 854 : 480, height=landscape ? 480 : 854;
    canvas.width=width;canvas.height=height;
    let renderer:THREE.WebGLRenderer | undefined;
    let stage:SceneProgram3D | undefined;
    let live=true;
    setError('');setPlaying(false);playingRef.current=false;timeRef.current=0;setTime(0);
    try {
      // The three samples are authored stress tests; the UI makes no fake AI claims.
      const clip=buildComplexWorldBatchDemo().clips[mode.source];
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
      renderer.setSize(width,height,false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;
      renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      stage=new SceneProgram3D(clip.program,clip.sources);
      setStats({nodes:clip.program.nodes.length,tracks:clip.program.tracks.length,objects:clip.audit.objectParts});
      const liveStage=stage,liveRenderer=renderer;
      drawRef.current=(t:number)=>{
        liveStage.render(liveRenderer,Math.min(CLIP_SECONDS-.001,Math.max(0,t)),width,height);
      };
      drawRef.current(0);
      let last=performance.now(),lastLabel=0;
      const animate=(now:number)=>{
        if(!live)return;
        const dt=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
        if(playingRef.current && !exportingRef.current){
          timeRef.current+=dt;
          if(timeRef.current>=CLIP_SECONDS-.001){
            timeRef.current=CLIP_SECONDS-.001;playingRef.current=false;setPlaying(false);
          }
          try{drawRef.current(timeRef.current);}
          catch(e){playingRef.current=false;setPlaying(false);setError(e instanceof Error?e.message:String(e));}
          if(now-lastLabel>90){setTime(timeRef.current);lastLabel=now;}
        }
        animRef.current=requestAnimationFrame(animate);
      };
      animRef.current=requestAnimationFrame(animate);
    }catch(e){
      setError('O motor 3D não conseguiu abrir a cena: '+(e instanceof Error?e.message:String(e)));
    }
    return ()=>{
      live=false;cancelAnimationFrame(animRef.current);playingRef.current=false;
      stopExportRef.current?.();stopExportRef.current=null;
      drawRef.current=()=>{};
      stage?.dispose();renderer?.dispose();
    };
  },[choice,landscape,mode.source]);

  const exportVideo = async () => {
    const canvas=canvasRef.current, format=preferredFormat();
    if(!canvas || !format || typeof canvas.captureStream!=='function'){
      setError('Este navegador não oferece gravação de vídeo em um formato suportado.');
      return;
    }
    if(exportingRef.current)return;
    exportingRef.current=true;playingRef.current=false;setPlaying(false);setError('');setRecording(0);
    let stream:MediaStream|undefined,rec:MediaRecorder|undefined;
    let tick=0,timeout=0;
    try{
      seekBeforeExport(0);
      stream=canvas.captureStream(FRAME_RATE);
      const tracks=stream.getVideoTracks();
      if(!tracks.length)throw new Error('A captura de quadros não iniciou.');
      rec=new MediaRecorder(stream,{mimeType:format.mime,videoBitsPerSecond:4_500_000});
      const activeRec=rec;
      const chunks:Blob[]=[];
      activeRec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      const done=new Promise<void>((resolve,reject)=>{
        activeRec.onstop=()=>resolve();
        activeRec.onerror=e=>reject((e as unknown as {error?:Error}).error||new Error('Erro ao gravar.'));
      });
      let cancelled=false;
      stopExportRef.current=()=>{cancelled=true;if(activeRec.state!=='inactive')activeRec.stop();};
      activeRec.start(200);
      const start=performance.now();
      await new Promise<void>((resolve,reject)=>{
        const step=(now:number)=>{
          if(cancelled){reject(new Error('Exportação interrompida.'));return;}
          const t=Math.min(CLIP_SECONDS,(now-start)/1000);
          try{drawRef.current(Math.min(CLIP_SECONDS-.001,t));}catch(e){reject(e);return;}
          setRecording(Math.min(99,Math.floor((t/CLIP_SECONDS)*100)));
          if(t>=CLIP_SECONDS){resolve();return;}
          tick=requestAnimationFrame(step);
        };
        tick=requestAnimationFrame(step);
      });
      // Give MediaRecorder a chance to flush its final video samples.
      await new Promise<void>(r=>{timeout=window.setTimeout(r,100);});
      if(activeRec.state!=='inactive'){activeRec.requestData();activeRec.stop();}
      await done;
      const mime=activeRec.mimeType||format.mime;
      const extension=mime.startsWith('video/mp4')?'mp4':'webm';
      const blob=new Blob(chunks,{type:mime.split(';')[0]});
      if(!blob.size)throw new Error('Gravação vazia.');
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`crieseuvideo-${mode.source===2?'moto':mode.source===0?'arca':'prisao'}-3d.${extension}`;
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){
      setError('Não foi possível exportar: '+(e instanceof Error?e.message:String(e)));
      if(rec && rec.state!=='inactive')rec.stop();
    }finally{
      cancelAnimationFrame(tick);window.clearTimeout(timeout);
      stream?.getTracks().forEach(t=>t.stop());
      stopExportRef.current=null;exportingRef.current=false;setRecording(null);
      timeRef.current=0;setTime(0);
      try{drawRef.current(0);}catch{}
    }
  };
  const seekBeforeExport=(t:number)=>{
    timeRef.current=t;setTime(t);drawRef.current(t);
  };

  return (
    <main className="native-3d-studio">
      <div className="native-3d-bar">
        <a href="/" className="native-3d-return"><ArrowLeft size={19}/> Voltar ao CrieSeuVideo</a>
        <span className="native-3d-engine"><Box size={17}/> SceneProgram3D • motor nativo</span>
      </div>
      <header className="native-3d-heading">
        <span className="native-3d-eyebrow">LABORATÓRIO INTEGRADO • VERSÃO EXPERIMENTAL</span>
        <h1>Motor 3D de verdade, no nosso site.</h1>
        <p>Estas três cenas são provas técnicas já compiladas com objetos 3D, câmeras, terrenos e ações. Não são vídeos inventados automaticamente pelo Gemini.</p>
      </header>
      <div className="native-3d-layout">
        <section className="native-3d-choices" aria-label="Cenas de demonstração">
          {showcase.map((m,i)=>(
            <button type="button" key={m.source} disabled={recording!==null}
              aria-pressed={choice===i} onClick={()=>setChoice(i)} className="native-3d-choice">
              <strong>{m.title}</strong><span>{m.subtitle}</span>
            </button>
          ))}
          <div className="native-3d-numbers">
            <strong>{stats.nodes} nós 3D</strong><span>{stats.tracks} trilhas de animação</span>
            <span>{stats.objects} peças modeladas</span>
          </div>
          <p className="native-3d-small">Ações, objetos, câmeras e geometria saem do mesmo planejador de cenas testado no GitHub. Ainda não há movimentos humanos cinematográficos nem geração IA pública nesta tela.</p>
        </section>
        <section className="native-3d-player" aria-label="Prévia interativa SceneProgram3D">
          <div className="native-3d-screen">
            <canvas ref={canvasRef} style={{aspectRatio:landscape?'16 / 9':'9 / 16'}} aria-label={`Cena 3D real: ${mode.title}`}/>
          </div>
          <div className="native-3d-controls">
            <button type="button" disabled={recording!==null || !!error} onClick={()=>{if(timeRef.current>=CLIP_SECONDS-.01)seek(0);setPlaying(p=>!p);}}>
              {playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Pausar':'Reproduzir'}
            </button>
            <input type="range" aria-label="Linha do tempo 3D" min={0} max={CLIP_SECONDS-.001} step=".05"
              value={time} disabled={recording!==null} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/>
            <span className="native-3d-clock">{time.toFixed(1)} / 6.0s</span>
            <button type="button" className="native-3d-icon" title="Reiniciar" disabled={recording!==null} onClick={()=>{setPlaying(false);seek(0);}}>
              <RefreshCw size={17}/>
            </button>
          </div>
          <div className="native-3d-actions">
            <button type="button" disabled={recording!==null} onClick={()=>{setLandscape(v=>!v);setPlaying(false);}}>
              <Box size={17}/> {landscape?'Formato vertical 9:16':'Formato horizontal 16:9'}
            </button>
            <button type="button" className="native-3d-download" disabled={recording!==null || !!error} onClick={()=>void exportVideo()}>
              <Download size={17}/> {recording!==null?`Gravando ${recording}%`:'Baixar clipe 3D'}
            </button>
          </div>
          {error&&<p className="native-3d-error" role="alert">{error}</p>}
          <p className="native-3d-small">O download usa MP4 quando o navegador realmente oferece MP4; caso contrário, baixa WebM corretamente identificado. Exportação sem áudio nesta prova.</p>
        </section>
      </div>
    </main>
  );
}
