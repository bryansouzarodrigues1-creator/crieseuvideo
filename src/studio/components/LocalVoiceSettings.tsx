import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';

export function localPortugueseVoices(voices: readonly SpeechSynthesisVoice[]) {
  return voices.filter(v => v.localService === true && /^pt[-_]BR$/i.test(v.lang));
}

/** Device speech is a preview only: Web Speech does not return PCM for MP4.
 * No server, provider, remote speech voice or paid fallback is used here. */
export function LocalVoiceSettings({text,disabled=false,onAudio}:{text:string;disabled?:boolean;onAudio?:(file:File)=>Promise<void>}){
  const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
  const [selected,setSelected]=useState('');
  const [rate,setRate]=useState(1);
  const [pitch,setPitch]=useState(1);
  const [note,setNote]=useState('');
  const [token,setToken]=useState('');
  const [generating,setGenerating]=useState(false);
  const active=useRef<SpeechSynthesisUtterance|null>(null);
  useEffect(()=>{
    if(!('speechSynthesis' in window))return;
    const synth=window.speechSynthesis;
    const refresh=()=>{
      const available=localPortugueseVoices(synth.getVoices());
      setVoices(available);
      setSelected(old=>available.some(v=>v.voiceURI===old)?old:available[0]?.voiceURI??'');
    };
    refresh();synth.addEventListener('voiceschanged',refresh);
    return ()=>{
      synth.removeEventListener('voiceschanged',refresh);
      if(active.current){active.current=null;synth.cancel();}
    };
  },[]);
  const stop=()=>{
    if(active.current){active.current=null;window.speechSynthesis.cancel();}
    setNote('Prévia interrompida.');
  };
  const preview=()=>{
    if(disabled||!('speechSynthesis' in window))return;
    const synth=window.speechSynthesis;
    const voice=localPortugueseVoices(synth.getVoices()).find(v=>v.voiceURI===selected);
    if(!voice){setNote('Nenhuma voz brasileira local disponível. Use a importação de áudio.');return;}
    if(active.current){active.current=null;synth.cancel();}
    const utterance=new SpeechSynthesisUtterance(text.trim().slice(0,500)||
      'Você sabia que uma pequena ideia pode transformar um grande problema em uma oportunidade?');
    utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=rate;utterance.pitch=pitch;
    active.current=utterance;
    utterance.onend=()=>{if(active.current===utterance){active.current=null;setNote('Prévia concluída.');}};
    utterance.onerror=()=>{if(active.current===utterance){active.current=null;setNote('Não foi possível reproduzir esta voz local.');}};
    setNote('Reproduzindo prévia local…');synth.speak(utterance);
  };
  const generateAlex=async()=>{
    if(disabled||generating||!onAudio||!token.trim()||!text.trim()||text.length>1500)return;
    setGenerating(true);setNote('Gerando com Kokoro local (Alex)…');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),180000);
    try{
      const response=await fetch('http://127.0.0.1:8765/v1/speech',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.trim()},
        body:JSON.stringify({text:text.trim(),voice:'pm_alex',speed:rate}),signal:controller.signal,
        credentials:'omit',redirect:'error'
      });
      if(!response.ok||!response.headers.get('Content-Type')?.startsWith('audio/wav'))throw new Error('Resposta local inválida.');
      const blob=await response.blob();
      if(!blob.size||blob.size>24000000)throw new Error('Áudio fora do limite.');
      await onAudio(new File([blob],'kokoro-alex.wav',{type:'audio/wav'}));
      setNote('Áudio Alex recebido pelo estúdio. Confira a reprodução.');
    }catch{
      setNote('Não foi possível conectar ou gerar a voz. Inicie o servidor Kokoro no próprio computador, confira o token e permita acesso local no navegador. Nenhum fallback pago foi acionado.');
    }finally{clearTimeout(timer);setGenerating(false);}
  };
  return <section aria-label="Configurações de voz local" style={{marginTop:12,padding:12,border:'1px solid #555',borderRadius:12}}>
    <p className="explainer-label">Narração · modo sem cobrança de API</p>
    <p className="explainer-sub">Português (Brasil). A prévia usa apenas vozes locais instaladas no aparelho. Para incluir voz no MP4, importe um arquivo de áudio próprio ou licenciado.</p>
    <label>Voz do aparelho <select className="explainer-voice-select" value={selected}
      disabled={disabled||!voices.length} onChange={e=>{stop();setSelected(e.target.value);}}>
      {!voices.length&&<option value="">Nenhuma voz PT-BR local disponível</option>}
      {voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
    </select></label>
    <div style={{display:'grid',gap:8,marginTop:10}}>
      <label>Velocidade: {rate.toFixed(2)}× <input type="range" aria-label="Velocidade da voz" min=".75" max="1.25" step=".05" value={rate} disabled={disabled} onChange={e=>setRate(Number(e.target.value))}/></label>
      <label>Tom: {pitch.toFixed(2)} <input type="range" aria-label="Tom da voz" min=".8" max="1.2" step=".05" value={pitch} disabled={disabled} onChange={e=>setPitch(Number(e.target.value))}/></label>
    </div>
    <div className="explainer-row">
      <Button type="button" size="sm" variant="secondary" onClick={preview} disabled={disabled||!selected}>Ouvir prévia local</Button>
      <Button type="button" size="sm" variant="ghost" onClick={stop} disabled={!selected}>Parar</Button>
    </div>
    {onAudio&&<div style={{display:'grid',gap:8,marginTop:12}}>
      <strong>Kokoro Alex · API local experimental</strong>
      <p className="explainer-sub">Requer o servidor Kokoro no mesmo computador. Não é uma API remota. O controle de tom acima só afeta a prévia do aparelho.</p>
      <label>Token local <input type="password" autoComplete="off" value={token} disabled={generating||disabled} onChange={e=>setToken(e.target.value)} placeholder="Token exibido pelo servidor"/></label>
      <Button type="button" size="sm" disabled={disabled||generating||!token.trim()||!text.trim()||text.length>1500} onClick={()=>void generateAlex()}>{generating?'Gerando áudio…':'Gerar narração Alex para o vídeo'}</Button>
    </div>}
    <p className="explainer-sub">ElevenLabs Pro: bloqueado até validação de licença, saldo e cotas. Nenhuma cobrança automática.</p>
    {note&&<p className="explainer-sub" role="status">{note}</p>}
  </section>;
}
