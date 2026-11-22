import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { generateAi3DWorld } from '../ai3d.functions';
const InlineAi3DPlayer=lazy(()=>import('../components/InlineAi3DPlayer').then(m=>({default:m.InlineAi3DPlayer})));

import type {ComplexWorldClip} from './sceneProgram/planner/complexWorldBatch';
import { ThumbsUp, ThumbsDown, Box, Clapperboard, Sparkles, Play, Pause, Download, Loader2, Film, Wand2, Mic, MicOff, FolderOpen, Upload, Trash2, Bookmark, X, Plus } from 'lucide-react';
import { listProjects, saveProject, deleteProject, listGallery, addToGallery, removeFromGallery, addToVault, vaultFor, listVault, type SavedProject, type GalleryItem } from './library';
import { Button } from '@/components/ui/button';
import { ExplainerPlan, VISUALS, MOODS, buildFallbackPlan, fitToTrack, totalDuration, sceneAt, sceneStart, SCENE_LEAD, type Visual, type Mood } from './plan';
import { NARRATION_VOICES, getNarration, speechBounds } from './voice';
import { drawExplainerFrame, drawOverlay } from './render';
import { detectCues } from './keywords';
import type { Toon3D } from './toon3d';
import { getBestSupportedVideoMimeType } from '../utils/videoRecorder';
import { audioCues, exportDuration, mixdown, EXPORT_FPS } from './exportTimeline';
import {prepareAi3DHandoff,saveAi3DHandoff} from './ai3dHandoff';
import {checkSceneScript} from './sceneProgram/planner/sceneScript';
import {AI3D_COOLDOWN_MS,parseAi3DCooldown} from '../ai3dCooldown';

export const SAMPLE = `Ele criou um site para a pizzaria do bairro. De graça.
Três meses depois, ninguém tinha visto.
Mandou mensagem no WhatsApp: Oi, tudo bem? Você tem interesse em um site?
Ah, legal... depois eu vejo.
As pessoas compram o que veem.
Então ele mostrou o site pronto, com nome, endereço e botão de WhatsApp.
Vendeu na primeira conversa.
Agora a pergunta é: vai ser você?`;

const AI3D_LOGIN_DRAFT_KEY = 'crieseuvideo.ai3d.login-draft.v1';
const AI3D_EXAMPLE_SCRIPT = 'Um celular aberto em uma bancada não liga porque está sem energia, e a câmera mostra a tela apagada. Uma bateria desliza até o encaixe, conecta-se à placa e faz a corrente circular. A tela acende e a câmera aproxima o circuito para mostrar a solução.';

const VISUAL_LABEL: Record<Visual, string> = { character: 'Personagem', phone_chat: 'Celular (conversa)', profile: 'Perfil / link na bio', laptop: 'Notebook', map_pins: 'Mapa', clock: 'Relógio', scale: 'Balança', eye: 'Olho', chips: 'Etiquetas', city_night: 'Cidade à noite', chart_up: 'Gráfico subindo', money: 'Dinheiro', custom: 'Desenho livre da IA' };
const MOOD_LABEL: Record<Mood, string> = { happy: 'Feliz', neutral: 'Neutro', sad: 'Triste', worried: 'Preocupado', angry: 'Bravo' };

export function ExplainerStudio({ onOpenEditor, onOpenVideo }: { onOpenEditor: () => void; onOpenVideo: () => void }) {
  const [script, setScript] = useState('');
  const [vaultCount, setVaultCount] = useState(0);
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16');
  const [plan, setPlan] = useState<ExplainerPlan>({ title: 'Novo projeto', aspect: '9:16', scenes: [] });
  void buildFallbackPlan;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState<number | null>(null);
  const [voice, setVoice] = useState<string>(NARRATION_VOICES[0].id);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voicing, setVoicing] = useState<number | null>(null);
  const [engine, setEngine] = useState<'2d' | '3d'>('2d');
  const [geminiCreatesScript, setGeminiCreatesScript] = useState(true);
  const [requestedDuration, setRequestedDuration] = useState(40);
  const [engine3dMode,setEngine3dMode] = useState<'advanced'|'classic'>('advanced');
  const [ai3dProvider,setAi3dProvider] = useState<'auto'|'gemini'|'lovable'>('gemini');
  const [ai3dCooldownUntil,setAi3dCooldownUntil] = useState(0);
  const [ai3dCooldownSeconds,setAi3dCooldownSeconds] = useState(0);
  const [ai3dClip,setAi3dClip] = useState<ComplexWorldClip|null>(null);
  const [ai3dUsedProvider,setAi3dUsedProvider] = useState<'gemini'|'lovable'|'demo'|null>(null);
  const [ai3dLoginNeeded,setAi3dLoginNeeded] = useState(false);
  const [ai3dAuthStatus,setAi3dAuthStatus] = useState<'checking'|'authenticated'|'unauthenticated'|'unavailable'>('checking');
  const [ai3dLoginBusy,setAi3dLoginBusy] = useState(false);
  const [ai3dEmailOpen,setAi3dEmailOpen] = useState(false);
  const [ai3dEmail,setAi3dEmail] = useState('');
  const [ai3dEmailBusy,setAi3dEmailBusy] = useState(false);
  const [ai3dEmailSent,setAi3dEmailSent] = useState(false);
  const sendAi3D = useServerFn(generateAi3DWorld);
  const toonRef = useRef<Toon3D | null>(null);
  const [toonReady, setToonReady] = useState(0);
  const [genId, setGenId] = useState<string | null>(null);
  const [rated, setRated] = useState<'yes' | 'no' | 'sent' | null>(null);
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'creative' | 'gallery'>('creative');
  const [provider, setProvider] = useState<'gemini' | 'eleven'>('gemini');
  const [elevenId, setElevenId] = useState('');
  const [projectId, setProjectId] = useState(() => `p${Date.now().toString(36)}`);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [library, setLibrary] = useState(false);
  const [listening, setListening] = useState<'rec' | 'busy' | null>(null);
  const [trackName, setTrackName] = useState('');
  const trackRef = useRef<AudioBuffer | null>(null);
  const micRef = useRef<MediaRecorder | null>(null);
  const voiceKey = provider === 'eleven' ? `eleven:${elevenId.trim()}` : voice;
  const sceneScriptCheck=checkSceneScript(prepareAi3DHandoff(script,aspect,voiceOn,voice).script);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const exportingRef = useRef(false);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const ctx = () => (audioRef.current ??= new AudioContext());
  useEffect(()=>{
    if(!ai3dCooldownUntil)return;
    const update=()=>{
      const remaining=Math.max(0,Math.ceil((ai3dCooldownUntil-Date.now())/1000));
      setAi3dCooldownSeconds(remaining);
      if(remaining===0)setAi3dCooldownUntil(0);
    };
    update();
    const interval=window.setInterval(update,250);
    return ()=>window.clearInterval(interval);
  },[ai3dCooldownUntil]);

  // The OAuth account chooser is not a completed login. React to a *real*
  // Supabase session, including a Google redirect returning to the same page.
  useEffect(()=>{
    if(engine!=='3d'||engine3dMode!=='advanced')return;
    let active=true;
    let subscription:{unsubscribe:()=>void}|undefined;
    const check=async()=>{
      try {
        const {data,error}=await supabase.auth.getSession();
        if(!active)return;
        setAi3dAuthStatus(error?'unavailable':data.session?.access_token?'authenticated':'unauthenticated');
        if(data.session?.access_token)setAi3dLoginNeeded(false);
      }catch{
        if(active)setAi3dAuthStatus('unavailable');
      }
    };
    try{
      const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
        if(!active)return;
        setAi3dAuthStatus(session?.access_token?'authenticated':'unauthenticated');
        if(session?.access_token)setAi3dLoginNeeded(false);
      });
      subscription=data.subscription;
    }catch{
      setAi3dAuthStatus('unavailable');
    }
    void check();
    // Mobile Google sign-in can leave the app and return via a browser tab.
    // Checking on focus/visibility handles that without triggering generation.
    const focus=()=>{void check();};
    const visible=()=>{if(document.visibilityState==='visible')void check();};
    window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',visible);
    return ()=>{
      active=false;subscription?.unsubscribe();
      window.removeEventListener('focus',focus);
      document.removeEventListener('visibilitychange',visible);
    };
  },[engine,engine3dMode]);

  // A full-page OAuth redirect must not erase the user's unsubmitted script.
  // Keep it in tab-scoped storage only until the next app load; never store
  // consent, credentials, provider tokens or charge automatically.
  useEffect(()=>{
    try{
      const raw=sessionStorage.getItem(AI3D_LOGIN_DRAFT_KEY);
      if(!raw)return;
      sessionStorage.removeItem(AI3D_LOGIN_DRAFT_KEY);
      const draft:unknown=JSON.parse(raw);
      if(!draft||typeof draft!=='object')return;
      const parsed=draft as Record<string,unknown>;
      if(typeof parsed.script==='string'&&parsed.script.length<=750&&parsed.script.trim()){
        setScript(current=>current.trim()?current:parsed.script as string);
      }
      if(parsed.aspect==='9:16'||parsed.aspect==='16:9')setAspect(parsed.aspect);
      if(parsed.provider==='auto'||parsed.provider==='gemini'||parsed.provider==='lovable')
        setAi3dProvider(parsed.provider);
    }catch{/* blocked sessionStorage is not a login failure */}
  },[]);

  /** Schedule every narrated scene from timeline time `from`; returns a stop function. */
  const startAudio = (from: number, extra?: AudioNode) => {
    const ac = ctx(); void ac.resume();
    const now = ac.currentTime + 0.05, nodes: AudioBufferSourceNode[] = [];
    if (plan.track && trackRef.current) {
      const src = ac.createBufferSource(); src.buffer = trackRef.current; src.connect(ac.destination); if (extra) src.connect(extra);
      src.start(now, Math.min(from, trackRef.current.duration)); return () => { try { src.stop(); } catch {} };
    }
    plan.scenes.forEach((s, i) => {
      const buf = s.voice && buffers.current.get(`${voiceKey}|${s.text}`); if (!buf) return;
      const at = sceneStart(plan, i) + SCENE_LEAD - from;
      if (at + buf.duration <= 0) return;
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); if (extra) src.connect(extra);
      src.start(now + Math.max(0, at), Math.max(0, -at)); nodes.push(src);
    });
    return () => nodes.forEach((n) => { try { n.stop(); } catch {} });
  };

  const narrate = async (target: ExplainerPlan) => {
    if (provider === 'eleven' && !elevenId.trim()) { setNote('Informe o Voice ID do ElevenLabs.'); return null; }
    const ac = ctx(); const out = { ...target, scenes: [...target.scenes] };
    setVoicing(0);
    try {
      for (let i = 0; i < out.scenes.length; i++) {
        const s = out.scenes[i];
        const buf = await getNarration(ac, s.text, voiceKey);
        buffers.current.set(`${voiceKey}|${s.text}`, buf);
        const b = speechBounds(buf);
        out.scenes[i] = { ...s, voice: { duration: buf.duration, start: b.start, end: b.end } };
        setVoicing(Math.round(((i + 1) / out.scenes.length) * 100));
      }
      setPlan(out); seek(0);
      return out;
    } catch (e: any) {
      setNote(`${e.message} A animação segue sem voz.`);
      return null;
    } finally { setVoicing(null); }
  };
  const timeRef = useRef(0);
  const total = totalDuration(plan);

  useEffect(() => { document.fonts?.load("40px 'Lilita One'").then(() => draw(timeRef.current)); }, []);
  useEffect(() => {
    if (engine !== '3d' || toonRef.current) return;
    let alive = true;
    import('./toon3d').then(({ Toon3D }) => { if (alive) { toonRef.current = new Toon3D(); setToonReady((n) => n + 1); } });
    return () => { alive = false; };
  }, [engine]);
  const draw = (t: number, force = false) => {
    if (exportingRef.current && !force) return;
    const c = canvasRef.current?.getContext('2d'); if (!c) return;
    const toon = toonRef.current;
    if (engine === '3d' && toon && plan.scenes.length) { toon.render(plan, t, c.canvas.width, c.canvas.height); c.drawImage(toon.canvas, 0, 0); drawOverlay(c, plan, t); }
    else drawExplainerFrame(c, plan, t);
  };
  useEffect(() => { draw(timeRef.current); }, [plan, engine, toonReady]);
  const rate = async (rating: 'yes' | 'no', why = '') => {
    if (!genId) return;
    if (rating === 'no' && !why) { setRated('no'); return; }
    setRated('sent');
    await fetch('/api/ai/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rate', id: genId, rating, reason: why || undefined }) }).catch(() => {});
  };

  useEffect(() => {
    if (!playing || exportingRef.current) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      timeRef.current += (now - last) / 1000; last = now;
      if (timeRef.current >= total) { timeRef.current = 0; setPlaying(false); }
      draw(timeRef.current); setTime(timeRef.current); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const stop = startAudio(timeRef.current);
    return () => { cancelAnimationFrame(raf); stop(); };
  }, [playing, plan, total, engine, toonReady]);

  // Library: load on mount, autosave the current project after edits.
  useEffect(() => {
    // Open the latest real project; never seed a sample that would autosave itself back.
    const all = listProjects(); setProjects(all); setGallery(listGallery()); setVaultCount(listVault().length);
    // Do not auto-open old previews on startup. Existing saved projects stay in Meus projetos.
  }, []);
  useEffect(() => {
    if (!script.trim() && !plan.scenes.length) return;
    const id = setTimeout(() => { saveProject({ id: projectId, title: plan.title || script.slice(0, 40), script, plan, updatedAt: Date.now() }); setProjects(listProjects()); }, 800);
    return () => clearTimeout(id);
  }, [plan, script, projectId]);
  const openProject = (p: SavedProject) => { setAi3dClip(null); setEngine3dMode('classic'); setPlaying(false); trackRef.current = null; setTrackName(''); setProjectId(p.id); setScript(p.script); setAspect(p.plan.aspect); setPlan(p.plan); setEngine(p.plan.engine ?? '2d'); seek(0); setLibrary(false); };
  const newProject = () => { setAi3dClip(null); setEngine3dMode('advanced'); setPlaying(false); trackRef.current = null; setTrackName(''); setProjectId(`p${Date.now().toString(36)}`); setScript(''); setPlan({ title: 'Novo projeto', aspect, scenes: [] }); setLibrary(false); };

  const transcribe = async (blob: Blob, name: string) => {
    const fd = new FormData(); fd.append('file', blob, name);
    const r = await fetch('/api/ai/transcribe', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Falha ao transcrever.');
    return String(d.text || '');
  };
  const toggleDictation = async () => {
    if (micRef.current) { micRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); micRef.current = null; setListening('busy');
        try { const type = rec.mimeType || 'audio/webm'; const text = await transcribe(new Blob(chunks, { type }), `fala.${type.includes('mp4') ? 'm4a' : 'webm'}`); setScript((s) => (s.trim() ? `${s.trim()}\n${text}` : text)); setNote('Roteiro ditado adicionado.'); }
        catch (e: any) { setNote(e.message); } finally { setListening(null); }
      };
      rec.start(); micRef.current = rec; setListening('rec');
    } catch { setNote('Não consegui acessar o microfone.'); }
  };
  const useOwnAudio = async (file: File) => {
    unlockAudio(); setNote('Lendo seu áudio…');
    try {
      trackRef.current = await ctx().decodeAudioData(await file.arrayBuffer()); setTrackName(file.name);
      let text = script;
      if (text.trim().length < 4) { setNote('Entendendo o que foi falado…'); text = await transcribe(file, file.name); setScript(text); }
      await generate(text);
    } catch (e: any) { trackRef.current = null; setTrackName(''); setNote(e.message || 'Áudio inválido.'); }
  };
  const removeTrack = () => { trackRef.current = null; setTrackName(''); setPlaying(false); setPlan((p) => ({ ...p, track: undefined, scenes: p.scenes.map(({ voice: _v, ...r }) => r) })); };
  const saveDrawing = (i: number) => {
    const s = plan.scenes[i]; if (!s.drawing) return;
    addToGallery(s.text.slice(0, 50), s.drawing); setGallery(listGallery()); setNote('Desenho salvo na galeria.');
  };

  const seek = (t: number) => { timeRef.current = t; setTime(t); draw(t); };

  /** Mobile browsers only allow sound when unlocked inside a tap. */
  const unlockAudio = () => {
    const ac = ctx(); void ac.resume();
    const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start();
  };
  const openAdvanced3D = (text=script) => {
    // Optional separate editor remains available; never sends a model request.
    try {
      const handoff=prepareAi3DHandoff(text,aspect,voiceOn,voice);
      saveAi3DHandoff(window.sessionStorage,handoff);
      window.location.assign('/motor-3d/ia');
    } catch {
      setNote('Não foi possível transferir o roteiro. Copie o texto antes de abrir o laboratório separado.');
    }
  };

  /** Explicit, offline engineering sample using the same real stage as generated AI 3D. */
  const openSmartphoneDemo = async () => {
    if (busy) return;
    setPlaying(false);
    try {
      const { buildSmartphoneAssemblyDemo } = await import('./sceneProgram/demo/smartphoneAssembly');
      setAi3dClip(buildSmartphoneAssemblyDemo());
      setAi3dUsedProvider('demo');
      setNote('Demonstração local de 12s: problema → solução, com textos explicativos sincronizados na prévia e no MP4. Sem custo; para voz, copie a narração e carregue o MP3 do ElevenLabs na prévia.');
    } catch (error) {
      setNote('Falha ao montar demonstração 3D: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const loginForAi3D = async () => {
    if(ai3dLoginBusy||busy)return;
    setAi3dLoginBusy(true);
    setNote('Escolha sua conta do Google e conclua o login. A geração não começará automaticamente.');
    try {
      // The SDK may redirect the whole browser; preserve only the draft.
      try{
        sessionStorage.setItem(AI3D_LOGIN_DRAFT_KEY,JSON.stringify({
          script,aspect,provider:ai3dProvider
        }));
      }catch{/* login may still work without draft persistence */}
      const result=await lovable.auth.signInWithOAuth('google',{
        redirect_uri:window.location.origin+window.location.pathname
      });
      if(result.error){
        setNote('O login do Google não foi concluído: '+result.error.message);
        return;
      }
      if(result.redirected){
        setNote('Finalize a seleção no Google e volte ao CrieSeuVideo. Sua conta será verificada antes de permitir a geração.');
        return;
      }
      // The Lovable adapter has already stored the OAuth tokens in Supabase.
      const {data,error}=await supabase.auth.getSession();
      if(error||!data.session?.access_token){
        setAi3dAuthStatus('unauthenticated');
        setNote('O Google retornou, mas a sessão ainda não foi confirmada. Reabra a página e verifique se o navegador permitiu o login.');
        return;
      }
      setAi3dAuthStatus('authenticated');
      setAi3dLoginNeeded(false);
      try{sessionStorage.removeItem(AI3D_LOGIN_DRAFT_KEY);}catch{}
      setNote('Conta conectada! Ao clicar em Criar cena 3D pela IA, você solicita uma tentativa que pode consumir créditos.');
    }catch(e){
      setNote('Falha ao entrar: '+(e instanceof Error?e.message:String(e)));
    }finally{
      setAi3dLoginBusy(false);
    }
  };

  const sendEmailLogin = async () => {
    if(busy||ai3dEmailBusy)return;
    const email=ai3dEmail.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      setNote('Informe um e-mail válido para receber seu link de acesso.');
      return;
    }
    setAi3dEmailBusy(true);setAi3dEmailSent(false);
    try{
      // Preserve only the work-in-progress, not any credit consent.
      try{
        sessionStorage.setItem(AI3D_LOGIN_DRAFT_KEY,JSON.stringify({
          script,aspect,provider:ai3dProvider
        }));
      }catch{/* Safari/private mode might restrict sessionStorage */}
      const {error}=await supabase.auth.signInWithOtp({
        email,
        options:{
          shouldCreateUser:true,
          emailRedirectTo:window.location.origin+window.location.pathname
        }
      });
      if(error){
        setNote('Não foi possível enviar o link: '+error.message+
          '. Se o provedor de e-mail estiver desativado no Lovable, será preciso habilitá-lo.');
        return;
      }
      setAi3dEmailSent(true);
      setNote('Enviamos uma solicitação de acesso. Confira a caixa de entrada e o spam do seu e-mail. Abra o link preferencialmente no mesmo navegador. Nenhuma IA foi acionada.');
    }catch(e){
      setNote('Falha ao solicitar o login por e-mail: '+(e instanceof Error?e.message:String(e)));
    }finally{
      setAi3dEmailBusy(false);
    }
  };

  const generate = async (text = script) => {
    if(engine==='3d' && engine3dMode==='advanced'){
      if(ai3dCooldownSeconds>0){
        setNote(`Aguarde ${ai3dCooldownSeconds}s para tentar novamente. A geração NÃO será iniciada automaticamente e nenhuma chamada adicional foi feita.`);
        return;
      }
      const handoff=prepareAi3DHandoff(text,aspect,voiceOn,voice);
      const requested=handoff.script;
      const validation=checkSceneScript(requested);
      if(!validation.ok){
        setNote('A cena 3D não pôde ser criada: '+validation.description+' Nenhum crédito de IA foi usado.');
        document.getElementById('ex-script')?.focus();
        return;
      }
      setNote('');setBusy(true);setPlaying(false);setAi3dLoginNeeded(false);
      try{
        // The existing server function is protected; no anonymous paid calls.
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(sessionError||!session?.access_token){
          setAi3dAuthStatus('unauthenticated');
          setAi3dLoginNeeded(true);
          throw new Error('Para criar cenários 3D, entre na sua conta. Não foi feita nenhuma chamada paga.');
        }
        // A valid authenticated request can reach the paid provider.
        // Lock locally as well, so rapid double taps on mobile cannot result
        // in confusing repeated errors or accidental retries.
        const requestedAt=Date.now();
        setAi3dCooldownUntil(requestedAt+AI3D_COOLDOWN_MS);
        setAi3dCooldownSeconds(Math.ceil(AI3D_COOLDOWN_MS/1000));
        const generated=await sendAi3D({
          data:{script:requested,provider:ai3dProvider,confirmCost:true},
          headers:{Authorization:`Bearer ${session.access_token}`},
        });
        setAi3dClip(generated.clip);
        setAi3dUsedProvider(generated.provider);
        const shortened=handoff.fullScriptLength>requested.length;
        setNote(`Cena 3D validada pelo ${generated.provider==='lovable'?'Lovable':'Gemini'}: ${generated.clip.audit.objectCount} objetos e ${generated.clip.program.shots.length} tomadas.${shortened?' Mostrei só as primeiras frases; o roteiro integral permanece no campo.':''} Para colocar voz no MP4, importe MP3/WAV no player ao lado.`);
      }catch(e){
        const retryIn=parseAi3DCooldown(e);
        if(retryIn!==null){
          setAi3dCooldownUntil(Date.now()+retryIn*1000);
          setAi3dCooldownSeconds(retryIn);
          setNote(`Aguarde ${retryIn}s para uma nova tentativa. O servidor bloqueou este pedido antes de chamar a IA, para evitar gastos repetidos. Nenhuma nova geração começará automaticamente.`);
        }else{
          setNote('A cena 3D não pôde ser gerada: '+(e instanceof Error?e.message:String(e)));
        }
      }finally{setBusy(false);}
      return;
    }
    if(text.trim().length<4){
      setNote('Descreva a animação em pelo menos quatro caracteres antes de criar.');
      document.getElementById('ex-script')?.focus();
      return;
    }
    unlockAudio(); setBusy(true); setNote(''); setPlaying(false);
    try {
      const autoScript = engine === '2d' && geminiCreatesScript && !trackRef.current;
      const res = await fetch('/api/ai/explainer-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        script: text, aspect, mode, generateScript: autoScript,
        durationSeconds: requestedDuration, gallery: [...gallery, ...vaultFor(text)]
      }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar.');
      const track = trackRef.current;
      if (typeof data.script === 'string' && autoScript) setScript(data.script);
      setPlan(track ? fitToTrack(data.plan, track.duration) : data.plan); seek(0);
      for (const sc of data.plan.scenes as ExplainerPlan['scenes']) if (sc.visual === 'custom' && sc.drawing?.length) addToVault(sc.text, sc.drawing);
      setVaultCount(listVault().length);
      setGenId(null); setRated(null); setReason('');
      fetch('/api/ai/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'log', script: data.script || text, plan: data.plan, engine, keywords: detectCues(data.script || text).map((c) => c.tag) }) })
        .then((r) => r.json()).then((d) => d.id && setGenId(d.id)).catch(() => {});
      setNote(`Gemini ${data.model || ''} · High: roteiro e direção de ${data.plan.scenes.length} cenas. A duração final depende da narração.`);
      if (voiceOn && !track) await narrate(data.plan);
      setPlaying(true);
    } catch (e: any) { setNote(e.message); } finally { setBusy(false); }
  };

  const updateScene = (i: number, patch: Partial<ExplainerPlan['scenes'][number]>) =>
    setPlan((p) => ({ ...p, scenes: p.scenes.map((s, k) => (k === i ? { ...s, ...patch, ...(patch.text !== undefined && patch.text !== s.text ? { voice: undefined } : {}) } : s)) }));
  const jumpTo = (i: number) => seek(sceneStart(plan, i) + 0.6);
  const voiced = plan.scenes.length > 0 && (plan.track ? !!trackRef.current : plan.scenes.every((s) => s.voice));

      /**
   * Deterministic export. Timeline = source of truth:
   *  - frame 0 is drawn at t = 0 before recording starts;
   *  - narration/track is mixed offline onto the timeline (sample-exact) and played once, only into the recorder;
   *  - the audio clock (or performance.now when silent) drives t, and each frame is drawn at an exact n / fps;
   *  - the recorder stops only after the whole timeline plus the tail has been rendered AND the audio has ended.
   */
  const exportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') { setNote('Este navegador não grava vídeo.'); return; }
    if (exportingRef.current || !plan.scenes.length) return;
    exportingRef.current = true; setPlaying(false); setRecording(0); setNote('');
    let timer = 0, src: AudioBufferSourceNode | null = null, stream: MediaStream | null = null;
    try {
      unlockAudio();
      await document.fonts?.load("40px 'Lilita One'").catch(() => {});
      const ac = ctx(); await ac.resume();
      const fps = EXPORT_FPS;

      // 1) timeline + audio mixdown
      const cues = voiced ? audioCues({ plan, voiceKey, buffers: buffers.current, track: trackRef.current }) : [];
      const duration = exportDuration(plan, cues);
      const silent = cues.length > 0 && ac.state !== 'running';
      if (silent) setNote('O navegador bloqueou o áudio: exportando sem voz.');
      const mix = cues.length && !silent ? await mixdown(cues, duration, ac.sampleRate) : null;

      // 2) the first frame is t = 0, on screen before the recorder starts
      timeRef.current = 0; setTime(0); draw(0, true);

      // 3) video track: frames are pushed by us (requestFrame) when supported, otherwise sampled at fps
      stream = canvas.captureStream(0);
      const vtrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      const manual = typeof vtrack?.requestFrame === 'function';
      if (!manual) { vtrack?.stop(); stream = canvas.captureStream(fps); }
      const push = () => { if (manual) vtrack.requestFrame(); };
      const dest = mix ? ac.createMediaStreamDestination() : null;
      dest?.stream.getAudioTracks().forEach((tr) => stream!.addTrack(tr));

      const { mimeType } = getBestSupportedVideoMimeType();
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000, ...(mix ? { audioBitsPerSecond: 128_000 } : {}) });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve, reject) => {
        rec.onstop = () => resolve();
        rec.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error('Falha na gravação do vídeo.'));
      });
      rec.start(250);
      push(); // frame 0

      // 4) one clock for picture and sound; the audio starts LEAD seconds after the recorder (t = 0 held meanwhile)
      const LEAD = 0.15, startAt = ac.currentTime + LEAD, perf0 = performance.now() + LEAD * 1000;
      if (mix && dest) { src = ac.createBufferSource(); src.buffer = mix; src.connect(dest); src.start(startAt); }
      const clock = () => (mix ? ac.currentTime - startAt : (performance.now() - perf0) / 1000);

      let frame = 0, pct = -1;
      await new Promise<void>((resolve, reject) => {
        timer = window.setInterval(() => {
          try {
            const now = clock(), t = Math.min(Math.max(0, now), duration), n = Math.floor(t * fps + 1e-6);
            if (n !== frame) { frame = n; draw(n / fps, true); push(); }
            const p = Math.min(99, Math.round((t / duration) * 100)); if (p !== pct) { pct = p; setRecording(p); }
            if (now >= duration) { window.clearInterval(timer); resolve(); }
          } catch (e) { window.clearInterval(timer); reject(e); }
        }, 1000 / (fps * 2));
      });

      // 5) last frame held, audio ended: flush and stop
      draw(Math.floor(duration * fps) / fps, true); push();
      await new Promise((r) => setTimeout(r, 150));
      rec.requestData(); rec.stop(); await stopped;
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      if (!blob.size) throw new Error('A gravação saiu vazia.');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${plan.title.replace(/[^\p{L}\d]+/gu, '-').slice(0, 40) || 'animacao'}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      if (!silent) setNote(`Vídeo exportado: ${duration.toFixed(1)} s${mix ? ', com voz' : ''}.`);
    } catch (e: any) {
      setNote(`Não consegui exportar: ${e?.message || e}`);
    } finally {
      window.clearInterval(timer);
      try { src?.stop(); } catch {}
      stream?.getTracks().forEach((tr) => tr.stop());
      exportingRef.current = false; setRecording(null); seek(0);
    }
  };

  const current = sceneAt(plan, time)?.index ?? 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const dims = aspect === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

  return (
    <div className="production-workspace explainer-workspace">
      <nav className="production-nav">
        <div className="production-brand"><Clapperboard /><strong>CrieSeuVideo <span>Studio</span></strong></div>
        <div className="explainer-nav-links">
          <Button variant="ghost" size="sm" onClick={() => setLibrary(true)}><FolderOpen />Meus projetos</Button>
          <Button variant="ghost" size="sm" onClick={onOpenEditor}>Editor de cenas</Button>
          <Button variant="ghost" size="sm" onClick={onOpenVideo}><Film />Vídeo por IA</Button>
          <a href="/motor-3d" className="native-3d-nav-link" aria-label="Abrir motor 3D experimental">
            <Box size={17}/> Motor 3D <span>novo</span>
          </a>
        </div>
      </nav>
      <main className="explainer-layout">
        <section className="explainer-panel">
          <p className="explainer-kicker">CRIESEUVIDEO — ESTÚDIO DE ANIMAÇÃO 2D/3D</p>
          <h1>Do roteiro à animação.</h1>
          <p className="explainer-sub">Escolha o 3D avançado com Gemini/Lovable, o Toon clássico ou o Motion 2D. Os custos dependem do provedor e da narração; clicar em Criar no modo avançado inicia a tentativa e pode consumir créditos.</p>
          <label className="explainer-label" htmlFor="ex-script">{engine === '2d' && geminiCreatesScript ? 'Tema para o Gemini escrever e animar' : 'Roteiro / narração'}</label>
          <textarea id="ex-script" className="explainer-textarea" value={script} onChange={(e) => {setScript(e.target.value);setAi3dClip(null);}} rows={9} placeholder={engine === '2d' && geminiCreatesScript ? 'Ex.: gastos do governo brasileiro: explique de forma clara em 40 segundos' : 'Escreva, dite pelo microfone ou envie seu áudio.'} />
          <div className="explainer-row">
            <Button size="sm" variant={listening === 'rec' ? 'destructive' : 'secondary'} onClick={toggleDictation} disabled={listening === 'busy'}>{listening === 'busy' ? <Loader2 className="animate-spin" /> : listening === 'rec' ? <MicOff /> : <Mic />}{listening === 'rec' ? 'Parar e transcrever' : listening === 'busy' ? 'Transcrevendo…' : 'Ditar roteiro'}</Button>
            <label className="explainer-file-btn"><Upload />{trackName ? 'Trocar áudio' : 'Usar meu áudio'}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void useOwnAudio(f); }} /></label>
            {trackName && <Button size="sm" variant="ghost" onClick={removeTrack} aria-label="Remover áudio"><X />{trackName.slice(0, 18)}</Button>}
          </div>
          <p className="explainer-label">Estilo de animação</p>
          <div className="explainer-row">
            <Button size="sm" variant={engine === '3d' && engine3dMode==='advanced' ? 'default' : 'secondary'} onClick={() => { setPlaying(false); setEngine('3d'); setEngine3dMode('advanced'); }} aria-pressed={engine === '3d' && engine3dMode==='advanced'}><Box />3D Avançado (IA)</Button>
            <Button size="sm" variant={engine === '3d' && engine3dMode==='classic' ? 'default' : 'secondary'} onClick={() => { setPlaying(false); setEngine('3d'); setEngine3dMode('classic'); }} aria-pressed={engine === '3d' && engine3dMode==='classic'}>3D Toon clássico</Button>
            <Button size="sm" variant={engine === '2d' ? 'default' : 'secondary'} onClick={() => { setPlaying(false); setEngine('2d'); }} aria-pressed={engine === '2d'}>Motion 2D</Button>
          </div>
          {engine==='3d' && engine3dMode==='advanced' ? (
            <div className="explainer-advanced-settings" role="group" aria-label="Gerador 3D avançado">
              <p className="explainer-sub">O Gemini ou a IA do Lovable criam uma cena inédita com cenário, objetos, câmera e movimento no motor SceneProgram3D. A prévia aparece neste editor; não usamos o antigo Toon.</p>
              <label className="explainer-label" htmlFor="ex-ai3d-provider">IA responsável pelo cenário 3D</label>
              <select id="ex-ai3d-provider" className="explainer-voice-select" value={ai3dProvider}
                disabled={busy} onChange={e=>{setAi3dProvider(e.target.value as 'auto'|'gemini'|'lovable');}}>
                <option value="auto">Automático: Lovable, depois Gemini se falhar</option>
                <option value="gemini">Gemini direto</option>
                <option value="lovable">IA do Lovable</option>
              </select>
              <p className="explainer-sub" role="note">
                O clique em <strong>Criar cena 3D pela IA</strong> inicia uma geração que pode consumir créditos mesmo se falhar. No modo Automático, Lovable e Gemini podem ser consultados; selecione um provedor específico para limitar a uma chamada.
              </p>
              {ai3dCooldownSeconds>0&&<p className="explainer-sub" role="status"
                aria-label="Tempo restante para nova tentativa 3D">
                <strong>Aguarde {ai3dCooldownSeconds}s para criar outra cena.</strong>{' '}
                Essa proteção evita chamadas duplicadas. Quando chegar a zero, você poderá clicar em Criar novamente.
              </p>}
              <p className="explainer-sub">Uma descrição de pelo menos 45 caracteres gera uma cena de 8 segundos. Com 2 ou 3 frases ou linhas, são 8–12 segundos e tomadas separadas. Vídeos maiores exigem etapas. Sem chamadas automáticas ou demonstrações como substituto.</p>
              <p className="explainer-sub" role="status" aria-label="Orientação do roteiro 3D">
                {sceneScriptCheck.description}{' '}
                {!sceneScriptCheck.ok&&'Ajuste o roteiro antes de clicar em Criar. Nenhuma chamada paga será feita enquanto o texto estiver inválido.'}
              </p>
              <Button size="sm" variant="outline" onClick={()=>{
                setScript(AI3D_EXAMPLE_SCRIPT);setAi3dClip(null);setNote('Exemplo preenchido. O clique em Criar solicita uma geração que pode consumir créditos.');
                document.getElementById('ex-script')?.focus();
              }}>
                Usar exemplo de problema e solução
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openSmartphoneDemo()}>
                <Box /> Ver explicação do celular (12s, sem IA)
              </Button>
              <p className="explainer-sub">Exemplo narrativo com problema e solução na tela e no MP4, sem cobrar créditos. A voz é opcional via importação de MP3/WAV no player. Esse botão não gera o seu roteiro por IA.</p>
              {ai3dAuthStatus==='authenticated'
                ? <p className="explainer-sub" role="status">Conta conectada ao CrieSeuVideo. O clique em Criar cena 3D pela IA solicita a geração e pode consumir créditos.</p>
                : <>
                  <p className="explainer-sub" role="status">
                    {ai3dAuthStatus==='checking'
                      ? 'Verificando sua sessão do Google…'
                      : ai3dAuthStatus==='unavailable'
                        ? 'Não foi possível verificar o login nesta prévia. Se o problema persistir depois de escolher a conta, tente abrir o site em uma aba normal.'
                        : ai3dLoginNeeded
                          ? 'Você ainda precisa concluir o login com Google para gerar cenas 3D.'
                          : 'Faça login com Google antes de usar Gemini ou Lovable. O teste gratuito não exige login.'}
                  </p>
                  <Button size="sm" variant="secondary" disabled={busy||ai3dLoginBusy||ai3dAuthStatus==='checking'}
                    onClick={()=>void loginForAi3D()}>
                    {ai3dLoginBusy?'Conectando conta…':'Entrar com Google para gerar 3D'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy||ai3dEmailBusy}
                    onClick={()=>setAi3dEmailOpen(v=>!v)}>
                    {ai3dEmailOpen?'Fechar login por e-mail':'Não aparece uma conta? Entrar por e-mail'}
                  </Button>
                  {ai3dEmailOpen&&<div className="explainer-advanced-settings"
                    role="group" aria-label="Login sem Google">
                    <p className="explainer-sub">Você também pode solicitar um link para entrar ou criar sua conta no CrieSeuVideo sem usar o seletor do Google.</p>
                    <label className="explainer-label" htmlFor="ex-ai3d-login-email">Seu e-mail</label>
                    <input id="ex-ai3d-login-email" type="email" autoComplete="email"
                      className="explainer-badge-input" placeholder="voce@exemplo.com"
                      value={ai3dEmail} onChange={e=>{setAi3dEmail(e.target.value);setAi3dEmailSent(false);}}
                      disabled={ai3dEmailBusy} style={{width:'100%',maxWidth:360}}/>
                    <Button size="sm" variant="secondary" disabled={busy||ai3dEmailBusy}
                      onClick={()=>void sendEmailLogin()}>
                      {ai3dEmailBusy?'Solicitando link…':'Enviar link para entrar'}
                    </Button>
                    {ai3dEmailSent&&<p className="explainer-sub" role="status">
                      Confira seu e-mail e abra o link de acesso; o vídeo não será gerado automaticamente.
                    </p>}
                  </div>}
                </>}
            </div>
          ) : (<>
            {engine === '2d' && <div className="explainer-advanced-settings" role="group" aria-label="Direção do Gemini no Motion 2D">
              <p className="explainer-sub"><strong>Gemini direto · raciocínio High.</strong> O Gemini cria o roteiro e planeja cada desenho e movimento, enquanto o motor Motion 2D renderiza os quadros. Sem troca silenciosa para Lovable ou exemplos prontos.</p>
              <label className="explainer-row">
                <input type="checkbox" checked={geminiCreatesScript} onChange={e => setGeminiCreatesScript(e.target.checked)} />
                Gemini cria também o roteiro a partir do tema
              </label>
              {geminiCreatesScript && <label className="explainer-label" htmlFor="ex-2d-duration">Duração aproximada (segundos)</label>}
              {geminiCreatesScript && <input id="ex-2d-duration" className="explainer-badge-input" type="number" min={15} max={180}
                value={requestedDuration} onChange={e => setRequestedDuration(Math.max(15, Math.min(180, Number(e.target.value) || 40)))}
                aria-label="Duração desejada da animação" />}
              <p className="explainer-sub">A API gratuita depende da cota e do modelo liberado no seu projeto. O pensamento High pode demorar mais e consumir mais tokens; falhas são exibidas sem redução automática de qualidade.</p>
            </div>}
            <p className="explainer-label">Modo de criação</p>
            <div className="explainer-row">
              {([['creative', 'Criativo', 'HIGH'], ['gallery', 'Minha galeria', 'HIGH']] as const).map(([m, l, c]) => (
                <Button key={m} size="sm" variant={mode === m ? 'default' : 'secondary'} onClick={() => setMode(m)} aria-pressed={mode === m}>{l} <small>{c}</small></Button>
              ))}
            </div>
            <p className="explainer-sub">{mode === 'creative' ? `A IA cria um visual próprio para cada cena no renderizador clássico, usando sua galeria de ${gallery.length} desenhos e os ${vaultCount} do cofre automático.` : `A IA reaproveita seus ${gallery.length} desenhos e os visuais prontos no renderizador clássico.`}</p>
          </>)}
          <div className="explainer-row">
            {(['9:16', '16:9'] as const).map((a) => (
              <Button key={a} variant={aspect === a ? 'default' : 'secondary'} size="sm" onClick={() => { setAspect(a); setPlan((p) => ({ ...p, aspect: a })); }}>{a === '9:16' ? 'Vertical 9:16' : 'Horizontal 16:9'}</Button>
            ))}
          </div>
          {engine==='3d'&&engine3dMode==='advanced'
          ? <p className="explainer-sub" role="note">No 3D avançado, a voz não é criada automaticamente pela opção do estúdio clássico. Após gerar ou abrir a demonstração, use “Carregar narração do ElevenLabs” no player para incluir áudio na exportação.</p>
          : <div className="explainer-row">
            <Button size="sm" variant={voiceOn ? 'default' : 'secondary'} onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}><Mic />{voiceOn ? 'Com narração' : 'Sem narração'}</Button>
            <select value={voice} onChange={(e) => { setPlaying(false); setVoice(e.target.value); setPlan((p) => ({ ...p, scenes: p.scenes.map(({ voice: _v, ...rest }) => rest) })); }} aria-label="Voz" className="explainer-voice-select" disabled={!voiceOn}>
              {NARRATION_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <select value={provider} onChange={(e) => { setPlaying(false); setProvider(e.target.value as 'gemini' | 'eleven'); }} aria-label="Motor de voz" className="explainer-voice-select" disabled={!voiceOn}>
              <option value="gemini">Voz do estúdio</option><option value="eleven">ElevenLabs (voz clonada)</option>
            </select>
            {provider === 'eleven' && voiceOn && <input className="explainer-badge-input" placeholder="Voice ID do ElevenLabs" value={elevenId} onChange={(e) => setElevenId(e.target.value)} aria-label="Voice ID do ElevenLabs" />}
            {voiceOn && plan.scenes.length > 0 && !voiced && !plan.track && <Button size="sm" variant="secondary" onClick={() => { setPlaying(false); void narrate(plan); }} disabled={voicing !== null}>{voicing !== null ? `Gravando voz ${voicing}%` : 'Gerar voz'}</Button>}
          </div>}
          <Button className="explainer-generate" onClick={() => generate()}
            disabled={busy || voicing !== null ||
              (engine==='3d'&&engine3dMode==='advanced'&&ai3dCooldownSeconds>0)}>
            {busy || voicing !== null ? <Loader2 className="animate-spin" /> : <Sparkles />}{voicing !== null ? `Gravando narração ${voicing}%` : busy ? 'Dirigindo cenas…' : engine==='3d'&&engine3dMode==='advanced' ? ai3dCooldownSeconds>0?`Aguarde ${ai3dCooldownSeconds}s`:'Criar cena 3D pela IA' : 'Criar animação'}
          </Button>
          {note && <p className="explainer-note" role="status">{note}</p>}
          {engine==='3d'&&engine3dMode==='advanced'&&
            <Button variant="ghost" size="sm" onClick={()=>openAdvanced3D()}
              disabled={busy||script.trim().length<45}>Abrir laboratório 3D separado (opcional)</Button>}

          {!(engine==='3d'&&engine3dMode==='advanced') && <div className="explainer-scenes">
            <p className="explainer-label">Cenas ({plan.scenes.length})</p>
            {plan.scenes.map((s, i) => (
              <div key={i} className={`explainer-scene ${i === current ? 'is-active' : ''}`} onClick={() => jumpTo(i)}>
                <span className="explainer-scene-n">{i + 1}</span>
                <div className="explainer-scene-body">
                  <input value={s.text} onChange={(e) => updateScene(i, { text: e.target.value })} aria-label={`Texto da cena ${i + 1}`} />
                  <div className="explainer-row">
                    <select value={s.visual} onChange={(e) => updateScene(i, { visual: e.target.value as Visual })} aria-label="Visual">
                      {VISUALS.map((v) => <option key={v} value={v}>{VISUAL_LABEL[v]}</option>)}
                    </select>
                    <select value={s.mood} onChange={(e) => updateScene(i, { mood: e.target.value as Mood })} aria-label="Expressão">
                      {MOODS.map((m) => <option key={m} value={m}>{MOOD_LABEL[m]}</option>)}
                    </select>
                    <input className="explainer-badge-input" placeholder="Etiqueta" value={s.label || ''} onChange={(e) => updateScene(i, { label: e.target.value || undefined })} aria-label="Etiqueta" />
                    {s.drawing && s.visual === 'custom' && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); saveDrawing(i); }}><Bookmark />Salvar na galeria</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </section>

        {engine==='3d'&&engine3dMode==='advanced' ? (
          <Suspense fallback={<section className="explainer-stage"><p role="status">Carregando motor 3D…</p></section>}>
            <InlineAi3DPlayer clip={ai3dClip} aspect={aspect} provider={ai3dUsedProvider}/>
          </Suspense>
        ) : (
        <section className="explainer-stage">
          <div className={`explainer-canvas-wrap ${aspect === '9:16' ? 'is-portrait' : ''}`}>
            <canvas ref={canvasRef} key={aspect} {...dims} style={!plan.scenes.length ? { display: 'none' } : undefined} onClick={() => { if (exportingRef.current) return; unlockAudio(); setPlaying((p) => !p); }} />
            {!plan.scenes.length && (
              <div className="explainer-empty-preview" role="status" aria-label="Novo projeto sem vídeo gerado">
                <Clapperboard aria-hidden="true" />
                <h2>Seu próximo vídeo começa aqui</h2>
                <p>Escreva o roteiro e escolha 2D ou 3D Toon para gerar uma prévia. Nenhum vídeo antigo será carregado automaticamente.</p>
                <div className="explainer-empty-actions">
                  <Button size="sm" onClick={() => document.getElementById('ex-script')?.focus()}>Escrever roteiro</Button>
                  <a href="/motor-3d" className="native-3d-nav-link" aria-label="Testar motor 3D">Testar motor 3D</a>
                  {projects.length > 0 && <Button size="sm" variant="outline" onClick={() => setLibrary(true)}>Meus projetos ({projects.length})</Button>}
                </div>
              </div>
            )}
          </div>
          <div className="explainer-controls">
            <Button size="icon" variant="secondary" onClick={() => { unlockAudio(); setPlaying((p) => !p); }} aria-label={playing ? 'Pausar' : 'Reproduzir'} disabled={recording !== null || !plan.scenes.length}>{playing ? <Pause /> : <Play />}</Button>
            <input type="range" min={0} max={total} step={0.01} value={time} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} aria-label="Linha do tempo" disabled={recording !== null || !plan.scenes.length} />
            <span className="explainer-time">{fmt(time)} / {fmt(total)}</span>
            <Button onClick={exportVideo} disabled={recording !== null || !plan.scenes.length}>{recording !== null ? <><Loader2 className="animate-spin" />{recording}%</> : <><Download />Baixar vídeo</>}</Button>
          </div>
          {genId && rated !== 'sent' && (
            <div className="explainer-scene" role="group" aria-label="Avaliação">
              <div className="explainer-scene-body">
                <strong>Era o que você queria?</strong>
                <div className="explainer-row">
                  <Button size="sm" variant="secondary" onClick={() => void rate('yes')}><ThumbsUp />Sim</Button>
                  <Button size="sm" variant={rated === 'no' ? 'default' : 'secondary'} onClick={() => void rate('no')}><ThumbsDown />Não</Button>
                </div>
                {rated === 'no' && (<>
                  <textarea className="explainer-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="O que ficou errado? Ex: falei de link na bio e apareceu WhatsApp" aria-label="Motivo" />
                  <Button size="sm" onClick={() => void rate('no', reason.trim() || 'sem motivo')}>Enviar</Button>
                </>)}
              </div>
            </div>
          )}
          {rated === 'sent' && <p className="explainer-note" role="status">Obrigado! A IA vai usar isso nos próximos vídeos.</p>}
          <p className="explainer-hint"><Wand2 /> Toque numa cena para ir até ela e troque o visual, a expressão ou a etiqueta.</p>
        </section>
        )}
      </main>
      {library && (
        <div className="explainer-drawer" role="dialog" aria-label="Meus projetos" onClick={() => setLibrary(false)}>
          <div className="explainer-drawer-body" onClick={(e) => e.stopPropagation()}>
            <div className="explainer-row"><strong>Meus projetos</strong><Button size="sm" onClick={newProject}><Plus />Novo</Button><Button size="icon" variant="ghost" onClick={() => setLibrary(false)} aria-label="Fechar"><X /></Button></div>
            <p className="explainer-sub">Tudo é salvo automaticamente neste aparelho.</p>
            {projects.map((p) => (
              <div key={p.id} className={`explainer-scene ${p.id === projectId ? 'is-active' : ''}`} onClick={() => openProject(p)}>
                <div className="explainer-scene-body"><strong>{p.title || 'Sem título'}</strong><small>{p.plan.scenes.length} cenas · {new Date(p.updatedAt).toLocaleString('pt-BR')}</small></div>
                <Button size="icon" variant="ghost" aria-label="Apagar projeto" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); if (p.id === projectId) { newProject(); setLibrary(true); } setProjects(listProjects()); }}><Trash2 /></Button>
              </div>
            ))}
            <p className="explainer-label">Galeria de desenhos ({gallery.length})</p>
            {gallery.length === 0 && <p className="explainer-sub">Salve desenhos livres das cenas para a IA reaproveitar no modo "Minha galeria".</p>}
            {gallery.map((g) => (
              <div key={g.id} className="explainer-scene"><div className="explainer-scene-body"><span>{g.name}</span></div>
                <Button size="icon" variant="ghost" aria-label="Remover da galeria" onClick={() => { removeFromGallery(g.id); setGallery(listGallery()); }}><Trash2 /></Button></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
