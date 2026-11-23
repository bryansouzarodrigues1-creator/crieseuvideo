import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { StoryFrame } from './StoryFrame';
import { storytellingOvos } from './storytellingOvosSpec';
import { sceneAt, validateStory, type StorytellingSpec } from './storytelling';

const copy = (p:StorytellingSpec):StorytellingSpec => JSON.parse(JSON.stringify(p)) as StorytellingSpec;
const fmt=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const baseButton='rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50';
const accentButton='rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50';

async function svgPng(svg:SVGSVGElement){
  const serialized=new XMLSerializer().serializeToString(svg);
  const url=URL.createObjectURL(new Blob([serialized],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const img=new Image();
    img.src=url;
    await img.decode();
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const c=canvas.getContext('2d');if(!c)throw new Error('Canvas indisponível');
    c.drawImage(img,0,0,1080,1920);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao salvar PNG')),'image/png'));
    return blob;
  }finally{URL.revokeObjectURL(url);}
}
function saveBlob(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export default function Storytelling2DStudio(){
  const [project,setProject]=useState<StorytellingSpec>(()=>copy(storytellingOvos));
  const [time,setTime]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [selected,setSelected]=useState(0);
  const [jsonOpen,setJsonOpen]=useState(false);
  const [raw,setRaw]=useState(()=>JSON.stringify(storytellingOvos,null,2));
  const [error,setError]=useState('');
  const [audioUrl,setAudioUrl]=useState('');
  const [audioName,setAudioName]=useState('');
  const [audioDuration,setAudioDuration]=useState(0);
  const [isCapturing,setIsCapturing]=useState(false);
  const svgRef=useRef<SVGSVGElement|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const clock=useRef({start:0,offset:0});
  const fileRef=useRef<HTMLInputElement|null>(null);
  const lastUrl=useRef('');
  const playRef=useRef(false);
  useEffect(()=>()=>{if(lastUrl.current)URL.revokeObjectURL(lastUrl.current);},[]);
  useEffect(()=>{playRef.current=playing;},[playing]);

  const seek=useCallback((t:number)=>{
    const target=Math.max(0,Math.min(project.duration,t));
    setTime(target);
    clock.current={start:performance.now(),offset:target};
    const au=audioRef.current;
    if(au&&audioDuration>0)au.currentTime=Math.min(audioDuration,target/project.duration*audioDuration);
  },[audioDuration,project.duration]);

  useEffect(()=>{
    if(!playing)return;
    let raf=0;
    const loop=()=>{
      const a=audioRef.current;
      const now=performance.now();
      const t=a&&!a.paused&&audioDuration>0
        ? Math.min(project.duration,(a.currentTime/audioDuration)*project.duration)
        :Math.min(project.duration,clock.current.offset+(now-clock.current.start)/1000);
      setTime(t);
      if(t>=project.duration-.005){setPlaying(false);return;}
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf);
  },[audioDuration,playing,project.duration]);

  const toggle=async()=>{
    if(playing){audioRef.current?.pause();setPlaying(false);return;}
    const from=time>=project.duration-.03?0:time;
    clock.current={start:performance.now(),offset:from};
    setTime(from);
    const au=audioRef.current;
    if(au&&audioDuration>0){
      au.currentTime=from/project.duration*audioDuration;
      try{await au.play();}catch{setError('O navegador bloqueou a reprodução do MP3; a animação seguirá sem áudio.');}
    }
    setPlaying(true);
  };
  const chooseAudio=(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    if(lastUrl.current)URL.revokeObjectURL(lastUrl.current);
    const url=URL.createObjectURL(file);lastUrl.current=url;
    setAudioUrl(url);setAudioName(file.name);setAudioDuration(0);setPlaying(false);setTime(0);setError('');
  };
  const editScene=(ix:number,field:'headline'|'caption',value:string)=>{
    setProject(p=>({...p,scenes:p.scenes.map((s,i)=>i===ix?{...s,[field]:value}:s)}));
  };
  const editDuration=(ix:number,value:number)=>{
    if(!Number.isFinite(value)||value<2||value>120)return;
    setPlaying(false);
    setProject(p=>{
      const scenes=p.scenes.map(s=>({...s}));let t=0;
      scenes.forEach((s,i)=>{const d=i===ix?value:s.end-s.start;s.start=t;s.end=t+d;t+=d;});
      setTime(prev=>Math.min(prev,t));
      return {...p,duration:t,scenes};
    });
  };
  const applyJson=()=>{
    try{
      const data=JSON.parse(raw) as StorytellingSpec;
      if(!data||!Array.isArray(data.scenes)||!data.scenes.every(s=>s&&Array.isArray(s.blocks)))throw new Error('Esperado um StorytellingSpec com cenas e blocos.');
      const problems=validateStory(data);
      if(problems.length)throw new Error(problems.slice(0,5).join(' • '));
      setProject(copy(data));setTime(0);setSelected(0);setPlaying(false);setError('');setJsonOpen(false);audioRef.current?.pause();
    }catch(e){setError(e instanceof Error?e.message:'JSON inválido');}
  };
  const current=sceneAt(project,time);
  const sceneIndex=Math.max(0,project.scenes.findIndex(s=>s.id===current.id));
  const capture=async()=>{
    if(!svgRef.current)return;
    setIsCapturing(true);
    try{saveBlob(await svgPng(svgRef.current),'crieseuvideo_2d_'+Math.round(time*30)+'.png');setError('');}
    catch(e){setError(e instanceof Error?e.message:'Falha ao exportar o quadro');}
    finally{setIsCapturing(false);}
  };
  const downloadProject=()=>saveBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'crieseuvideo_storytelling2d.json');
  return <main className="min-h-screen bg-[#0A101B] text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 md:px-8">
      <div><a className="text-sm text-amber-300 hover:underline" href="/">← Voltar ao estúdio</a>
        <h1 className="mt-1 text-xl font-extrabold tracking-tight">CrieSeuVideo · Cinema 2D</h1>
        <p className="text-xs text-slate-400">Storytelling vetorial · cenas por dados · sem chamadas de IA</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={baseButton} onClick={()=>{setJsonOpen(v=>!v);setRaw(JSON.stringify(project,null,2));setError('');}}>{jsonOpen?'Fechar JSON':'Abrir SceneSpec'}</button>
        <button type="button" className={baseButton} onClick={downloadProject}>Salvar projeto JSON</button>
        <button type="button" className={accentButton} onClick={capture} disabled={isCapturing}>{isCapturing?'Capturando…':'Salvar quadro PNG'}</button>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_430px] lg:p-6">
      <section className="rounded-2xl border border-slate-700 bg-[#111D2A] p-3 shadow-2xl">
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-xl border border-slate-700 bg-[#0A1628] shadow-xl" style={{aspectRatio:'9 / 16'}}>
          <StoryFrame spec={project} time={time} svgRef={svgRef}/>
        </div>
        <div className="mx-auto mt-4 max-w-lg">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
            <span>{fmt(time)} / {fmt(project.duration)}</span>
            <span>Cena {sceneIndex+1}/{project.scenes.length} · {current.id}</span>
          </div>
          <input aria-label="Posição da animação" type="range" min="0" max={project.duration} step="0.0333333" value={time} onChange={e=>{audioRef.current?.pause();setPlaying(false);seek(Number(e.target.value));}} className="w-full accent-amber-400"/>
          <div className="mt-3 flex items-center justify-center gap-3">
            <button type="button" onClick={()=>{setPlaying(false);audioRef.current?.pause();seek(Math.max(0,time-5));}} className={baseButton}>−5s</button>
            <button type="button" onClick={()=>{void toggle();}} className={accentButton}>{playing?'Pausar':'▶ Reproduzir'}</button>
            <button type="button" onClick={()=>{setPlaying(false);audioRef.current?.pause();seek(Math.min(project.duration,time+5));}} className={baseButton}>+5s</button>
          </div>
          <audio ref={audioRef} src={audioUrl||undefined} onLoadedMetadata={e=>setAudioDuration(e.currentTarget.duration)} preload="metadata"/>
          <div className="mt-4 rounded-xl border border-slate-700 p-3 text-sm">
            <div className="mb-1 font-semibold">Narração MP3 (opcional)</div>
            <input ref={fileRef} type="file" accept="audio/*" onChange={chooseAudio} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-2 file:py-2 file:text-slate-100"/>
            {audioName&&<p className="mt-2 text-xs text-slate-300">{audioName} · {audioDuration?audioDuration.toFixed(1)+'s':'carregando…'}</p>}
            {audioDuration>0&&Math.abs(audioDuration-project.duration)>1&&<p className="mt-2 text-xs text-amber-300">A narração tem duração diferente. A prévia distribui o tempo proporcionalmente; isso ainda não é alinhamento por palavra.</p>}
          </div>
        </div>
      </section>
      <section className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-700 bg-[#111D2A] p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">Título do vídeo</label>
          <input value={project.title} maxLength={100} onChange={e=>setProject(p=>({...p,title:e.target.value}))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-amber-400"/>
          <p className="mt-2 text-sm text-slate-400">Edite cada cena abaixo. Os controles não consomem créditos do Gemini nem do Lovable.</p>
        </div>
        <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
          {project.scenes.map((s,i)=><div key={s.id} className={'rounded-2xl border p-4 '+(i===sceneIndex?'border-amber-400/70 bg-[#253044]':'border-slate-700 bg-[#111D2A]')}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <button type="button" className="font-semibold text-amber-300 hover:underline" onClick={()=>{setSelected(i);setPlaying(false);audioRef.current?.pause();seek(s.start);}}>Cena {i+1} · {s.id}</button>
              <span className="text-xs text-slate-400">{fmt(s.start)}–{fmt(s.end)}</span>
            </div>
            {(selected===i||i===sceneIndex)&&<>
              <label className="block text-xs text-slate-400">Título editorial</label>
              <input value={s.headline} onChange={e=>editScene(i,'headline',e.target.value)} maxLength={85} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"/>
              <label className="mt-2 block text-xs text-slate-400">Legenda curta</label>
              <textarea value={s.caption} onChange={e=>editScene(i,'caption',e.target.value)} rows={2} maxLength={140} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"/>
              <label className="mt-2 block text-xs text-slate-400">Duração da cena (segundos)</label>
              <input type="number" min="2" max="120" step="0.5" value={(s.end-s.start).toFixed(1)} onChange={e=>editDuration(i,Number(e.target.value))} className="mt-1 w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"/>
            </>}
          </div>)}
        </div>
        {jsonOpen&&<div className="rounded-2xl border border-amber-700 bg-[#151A27] p-4">
          <label className="block text-sm font-semibold">Importar ou editar o SceneSpec</label>
          <p className="my-2 text-xs text-slate-400">Cole JSON no contrato StorytellingSpec v1. A entrada será validada antes de renderizar.</p>
          <textarea spellCheck={false} className="h-80 w-full rounded-lg border border-slate-600 bg-black/40 p-3 font-mono text-xs" value={raw} onChange={e=>setRaw(e.target.value)}/>
          <button className={'mt-2 '+accentButton} type="button" onClick={applyJson}>Validar e carregar</button>
        </div>}
        {error&&<div role="alert" className="rounded-xl border border-rose-600/70 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</div>}
        <p className="text-xs text-slate-400">Prévia/edição 2D da branch experimental. Exportação de vídeo, alinhamento fonético e geração automática pelo Gemini ainda não estão conectados a esta tela.</p>
      </section>
    </div>
  </main>;
}
