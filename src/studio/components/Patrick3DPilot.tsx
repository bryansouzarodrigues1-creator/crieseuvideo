import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { patrickPilotScene } from '../explainer/sceneProgram/patrickPilot';
import { SceneProgram3D } from '../explainer/sceneProgram/stage3d';

const DURATION = 8;
const WIDTH = 360, HEIGHT = 640;

/** Separate, opt-in browser laboratory. Not a template returned to AI users. */
export default function Patrick3DPilot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<SceneProgram3D | null>(null);
  const renderRef = useRef<(seconds: number) => void>(() => {});
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const exportController = useRef<AbortController | null>(null);
  const [activated, setActivated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    if (!activated || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let raf = 0, live = true, last = performance.now();
    let renderer: THREE.WebGLRenderer | undefined;
    let stage: SceneProgram3D | undefined;
    setError('');
    try {
      const demo = patrickPilotScene();
      stage = new SceneProgram3D(demo.program, demo.sources);
      stage.validateContacts();
      stageRef.current = stage;
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: false,
        preserveDrawingBuffer: true, powerPreference: 'low-power',
      });
      renderer.setPixelRatio(1);
      renderer.setSize(WIDTH, HEIGHT, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const target = renderer;
      const scene = stage;
      renderRef.current = (t) => scene.render(target, Math.max(0, Math.min(DURATION - .001, t)), WIDTH, HEIGHT);
      renderRef.current(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    const loop = (now: number) => {
      if (!live) return;
      const delta = Math.min(.08, Math.max(0, (now - last) / 1000));
      last = now;
      if (playingRef.current && !document.hidden) {
        timeRef.current = Math.min(DURATION - .001, timeRef.current + delta);
        try { renderRef.current(timeRef.current); setSeconds(timeRef.current); }
        catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); playingRef.current = false; setPlaying(false); }
        if (timeRef.current >= DURATION - .002) { playingRef.current = false; setPlaying(false); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const lost = (event: Event) => { event.preventDefault(); playingRef.current = false; setPlaying(false); setError('O navegador perdeu o contexto WebGL. Recarregue esta página.'); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', lost);
      renderRef.current = () => {};
      stage?.dispose();
      renderer?.dispose();
      stageRef.current = null;
    };
  }, [activated]);

  useEffect(() => () => exportController.current?.abort(), []);

  const seek = (t: number) => {
    playingRef.current = false;
    setPlaying(false);
    timeRef.current = Math.max(0, Math.min(DURATION - .001, t));
    setSeconds(timeRef.current);
    try { renderRef.current(timeRef.current); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const exportVideo = async () => {
    if (!canvasRef.current || !stageRef.current || progress !== null) return;
    playingRef.current = false; setPlaying(false);
    const controller = new AbortController();
    exportController.current = controller;
    setProgress(0); setError('');
    try {
      const { encodeFixedFrame3DClip } = await import('../utils/deterministic3dExport');
      const video = await encodeFixedFrame3DClip({
        canvas: canvasRef.current,
        durationSeconds: DURATION,
        fps: 24,
        signal: controller.signal,
        renderFrame: (t) => renderRef.current(t),
        onProgress: (p) => setProgress(p),
      });
      const url = URL.createObjectURL(video.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patrick-mentalista-piloto.${video.filenameExtension}`;
      document.body.append(link);
      link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      exportController.current = null;
      setProgress(null);
      seek(0);
    }
  };

  return (
    <main className="min-h-screen bg-[#10151d] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <a href="/motor-3d" className="text-sm text-sky-300 underline">Voltar ao laboratório 3D</a>
        <header className="my-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-purple-300">CrieSeuVídeo · piloto técnico</p>
          <h1 className="text-3xl font-extrabold">Patrick — personagem 3D articulado</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Cena de demonstração escrita e validada manualmente, sem geração por IA: o Patrick observa um livro, move o olhar e encosta a mão na capa usando IK. A mesma animação pode ser reproduzida em qualquer instante e exportada como vídeo. O acabamento visual ainda é procedural, não um GLB esculpido.</p>
        </header>
        <div className="grid gap-7 md:grid-cols-[minmax(0,390px)_1fr]">
          <section>
            <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
              <canvas ref={canvasRef} width={WIDTH} height={HEIGHT}
                aria-label="Cena real Three.js do Patrick investigando um livro"
                className="h-auto w-full max-w-[390px]" style={{display: activated ? 'block' : 'none'}}/>
              {!activated && <button className="rounded-xl bg-purple-600 px-6 py-4 font-bold text-white" type="button"
                onClick={() => setActivated(true)}>Carregar personagem 3D</button>}
            </div>
            {activated && <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <button type="button" disabled={progress !== null || !!error} onClick={() => {
                  if (timeRef.current >= DURATION - .01) seek(0);
                  setPlaying((p) => !p);
                }} className="rounded-lg bg-purple-600 px-5 py-2 font-semibold disabled:opacity-50">
                  {playing ? 'Pausar' : 'Reproduzir'}
                </button>
                <span className="text-sm tabular-nums text-slate-300">{seconds.toFixed(1)} / 8.0s</span>
              </div>
              <input type="range" aria-label="Controlar o tempo da cena 3D" className="w-full" min="0" max="7.999" step=".05"
                value={seconds} disabled={progress !== null || !!error} onChange={(e) => seek(Number(e.target.value))}/>
              <button type="button" onClick={exportVideo} disabled={progress !== null || !!error}
                className="w-full rounded-lg border border-purple-400 px-5 py-3 font-semibold disabled:opacity-50">
                {progress === null ? 'Exportar MP4 de 8 segundos' : `Exportando: ${Math.round(progress * 100)}%`}
              </button>
            </div>}
            {error && <p className="mt-3 rounded-md bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
          </section>
          <aside className="space-y-4 text-sm leading-6 text-slate-300">
            <h2 className="text-lg font-bold text-white">O que este teste comprova</h2>
            <p>Modelo procedural real com cabeça, braços, cotovelos, mãos, quadril, pernas e pés hierárquicos. Os dedos são peças físicas com pivôs próprios; o IK posiciona a mão sobre o livro.</p>
            <p>O visual segue o terno azul, colete grafite, camisa clara, cabelo loiro ondulado e olhos claros da prancha. Roupa e cabelo acompanham os movimentos da cabeça e do tronco.</p>
            <p>Não demonstra ainda captura real de objetos, simulação física completa, animação facial cinematográfica nem geração autônoma pela IA. Este personagem é um preset adicional; o motor continua podendo criar novas geometrias.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
