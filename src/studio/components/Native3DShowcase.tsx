import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowLeft, Box, Download, Pause, Play, RefreshCw } from 'lucide-react';
import { buildComplexWorldClipDemo } from '../explainer/sceneProgram/planner/complexWorldBatchDemo';
import { SceneProgram3D } from '../explainer/sceneProgram/stage3d';

const showcase = [
  { title: 'Motocicleta 3D', subtitle: 'Motor, carenagem e rodas em movimento', source: 2 },
  { title: 'Arca e oceano', subtitle: 'Casco, passarela e água dinâmica', source: 0 },
  { title: 'Prisão 3D', subtitle: 'Torres, portão móvel e viatura', source: 1 },
] as const;
const CLIP_SECONDS = 6;
const FRAME_RATE = 24;
/** Distinct from the old StickStory renderer. The same procedural SceneProgram3D
 * that passed the standalone GitHub Chromium tests is used by this site. */
export default function Native3DShowcase() {
  const [choice, setChoice] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<number | null>(null);
  const [lite, setLite] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);
  const [activated, setActivated] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(max-width: 700px)').matches);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ nodes: 0, tracks: 0, objects: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(false);
  const exportingRef = useRef(false);
  const timeRef = useRef(0);
  const drawRef = useRef<(t:number)=>void>(()=>{});
  const animRef = useRef<number>(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const stageRef = useRef<SceneProgram3D | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mode = showcase[choice];

  const seek = useCallback((next:number) => {
    if (exportingRef.current) return;
    const safe=Math.max(0,Math.min(CLIP_SECONDS-.001,next));
    timeRef.current=safe;setTime(safe);
    try { drawRef.current(safe); } catch(e){ setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  useEffect(() => { playingRef.current=playing; },[playing]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lost = (event: Event) => {
      event.preventDefault();
      playingRef.current = false;
      setPlaying(false);
      setError('O Android interrompeu o processamento gráfico. Tente recarregar a página em modo leve.');
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, []);

  // Keep one GPU context between scenes to avoid exhausting mobile WebGL resources.
  useEffect(() => () => {
    abortRef.current?.abort();
    stageRef.current?.dispose();
    rendererRef.current?.dispose();
    stageRef.current = null;
    rendererRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activated) return;
    let live = true;
    setError('');
    setLoading(true);
    setPlaying(false);
    playingRef.current = false;
    timeRef.current = 0;
    setTime(0);
    const timer = window.setTimeout(() => {
      if (!live) return;
      try {
        const clip = buildComplexWorldClipDemo(mode.source);
        const width = lite ? (landscape ? 480 : 270) : (landscape ? 854 : 480);
        const height = lite ? (landscape ? 270 : 480) : (landscape ? 480 : 854);
        let renderer = rendererRef.current;
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({
            canvas, antialias: false, alpha: false,
            preserveDrawingBuffer: true, powerPreference: 'low-power',
          });
          rendererRef.current = renderer;
        }
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = !lite;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        stageRef.current?.dispose();
        const stage = new SceneProgram3D(clip.program, clip.sources);
        stageRef.current = stage;
        setStats({ nodes: clip.program.nodes.length, tracks: clip.program.tracks.length, objects: clip.audit.objectParts });
        drawRef.current = (t: number) => stage.render(renderer, Math.min(CLIP_SECONDS - .001, Math.max(0, t)), width, height);
        drawRef.current(0);
        setLoading(false);
        let last = performance.now(), lastLabel = 0, nextFrame = 0;
        const animate = (now: number) => {
          if (!live) return;
          const dt = Math.min(.12, Math.max(0, (now - last) / 1000));
          last = now;
          if (playingRef.current && !exportingRef.current && !document.hidden && now >= nextFrame) {
            nextFrame = now + (lite ? 68 : 34);
            timeRef.current += dt;
            if (timeRef.current >= CLIP_SECONDS - .001) {
              timeRef.current = CLIP_SECONDS - .001;
              playingRef.current = false;
              setPlaying(false);
            }
            try { drawRef.current(timeRef.current); }
            catch (e) {
              playingRef.current = false;
              setPlaying(false);
              setError(e instanceof Error ? e.message : String(e));
            }
            if (now - lastLabel > 120) { setTime(timeRef.current); lastLabel = now; }
          }
          animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
      } catch (e) {
        setLoading(false);
        setError('A cena não pôde ser carregada. Tente o modo leve: ' + (e instanceof Error ? e.message : String(e)));
      }
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(timer);
      cancelAnimationFrame(animRef.current);
      playingRef.current = false;
      drawRef.current = () => {};
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [choice, landscape, lite, activated, mode.source]);

  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || exportingRef.current || loading || !activated || !!error) return;
    abortRef.current = new AbortController();
    exportingRef.current=true;
    playingRef.current=false;
    setPlaying(false);
    setError('');
    setRecording(0);
    try {
      const {encodeFixedFrame3DClip}=await import('../utils/deterministic3dExport');
      const clip=await encodeFixedFrame3DClip({
        canvas,
        durationSeconds:CLIP_SECONDS,
        fps:FRAME_RATE,
        signal:abortRef.current.signal,
        renderFrame:t=>drawRef.current(t),
        onProgress:p=>setRecording(p),
      });
      const url=URL.createObjectURL(clip.blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`crieseuvideo-${mode.source===2?'moto':mode.source===0?'arca':'prisao'}-3d.${clip.filenameExtension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(e) {
      setError('Não foi possível exportar: '+(e instanceof Error?e.message:String(e)));
    } finally {
      abortRef.current = null;
      exportingRef.current=false;
      setRecording(null);
      timeRef.current=0;
      setTime(0);
      try { drawRef.current(0); } catch {}
    }
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
            <button type="button" key={m.source} disabled={recording!==null || loading}
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
            <canvas ref={canvasRef} style={{aspectRatio:landscape?'16 / 9':'9 / 16',display:activated?'block':'none'}} aria-label={`Cena 3D real: ${mode.title}`}/>
            {!activated && (
              <div className="native-3d-start">
                <Box size={32} aria-hidden="true"/>
                <strong>Motor 3D pronto para carregar</strong>
                <span>No celular, carregamos somente a cena escolhida para evitar travamentos.</span>
                <button type="button" onClick={()=>setActivated(true)}>Carregar motor 3D</button>
              </div>
            )}
            {loading && <div className="native-3d-loading" role="status">Preparando {mode.title} em {lite?'modo leve':'modo normal'}…</div>}
          </div>
          <div className="native-3d-controls">
            <button type="button" disabled={recording!==null || !!error || !activated || loading} onClick={()=>{if(timeRef.current>=CLIP_SECONDS-.01)seek(0);setPlaying(p=>!p);}}>
              {playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Pausar':'Reproduzir'}
            </button>
            <input type="range" aria-label="Linha do tempo 3D" min={0} max={CLIP_SECONDS-.001} step=".05"
              value={time} disabled={recording!==null || !activated || loading} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/>
            <span className="native-3d-clock">{time.toFixed(1)} / 6.0s</span>
            <button type="button" className="native-3d-icon" title="Reiniciar" disabled={recording!==null || !activated || loading} onClick={()=>{setPlaying(false);seek(0);}}>
              <RefreshCw size={17}/>
            </button>
          </div>
          <div className="native-3d-actions">
            <button type="button" disabled={recording!==null || loading} onClick={()=>{setLandscape(v=>!v);setPlaying(false);}}>
              <Box size={17}/> {landscape?'Formato vertical 9:16':'Formato horizontal 16:9'}
            </button>
            <button type="button" disabled={recording!==null || loading} onClick={()=>setLite(v=>!v)}>
              <RefreshCw size={17}/> {lite?'Modo leve: ativado':'Modo leve: desativado'}
            </button>
            {recording!==null && (
              <button type="button" onClick={()=>abortRef.current?.abort()}>Cancelar exportação</button>
            )}
            <button type="button" className="native-3d-download" disabled={recording!==null || !!error || !activated || loading} onClick={()=>void exportVideo()}>
              <Download size={17}/> {recording!==null?`Gravando ${recording}%`:'Baixar clipe 3D'}
            </button>
          </div>
          {error&&<p className="native-3d-error" role="alert">{error}</p>}
          <p className="native-3d-small">Prévia adaptativa: modo leve usa menos memória e reduz os quadros por segundo apenas na visualização. A exportação tenta manter 24 fps, sem áudio; no modo leve a resolução é reduzida.</p>
        </section>
      </div>
    </main>
  );
}
