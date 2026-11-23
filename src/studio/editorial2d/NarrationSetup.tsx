import { useState, type ChangeEvent } from 'react';
import {
  cleanElevenPerformanceText, countWords, durationAllowed, estimatedSpeechRange, resolveAudioMode,
  splitIntoActs, type AudioIntent, type ImportedAudioType,
} from './productionFlow';

const field='w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100';
const secondary='rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700';

interface Props {
  duration: number;
  onSetDuration: (seconds: number) => void;
  mode: AudioIntent;
  onModeChange: (next: AudioIntent) => void;
  audioType: ImportedAudioType;
  onAudioTypeChange: (next: ImportedAudioType) => void;
  spokenText: string;
  onSpokenTextChange: (next: string) => void;
  performanceText: string;
  onPerformanceTextChange: (next: string) => void;
  audioName: string;
  audioDuration: number;
  onChooseAudio: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearAudio: () => void;
  onFitAudio: () => void;
}

export function NarrationSetup(p: Props) {
  const [copyMessage, setCopyMessage] = useState('');
  const audioState=resolveAudioMode(p.mode,p.audioType,!!p.audioName,p.spokenText);
  const estimated=estimatedSpeechRange(p.spokenText);
  const needsMatch=!!p.audioDuration && Math.abs(p.audioDuration-p.duration)>0.5;
  const scriptMismatch=!!p.performanceText.trim() &&
    cleanElevenPerformanceText(p.performanceText).replace(/\s+/g,' ') !== p.spokenText.trim().replace(/\s+/g,' ');
  const time=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
  const acts=durationAllowed(p.duration)?splitIntoActs(p.duration).length:0;
  const copy=async()=>{
    const t=p.performanceText.trim()||p.spokenText.trim();
    if(!t){setCopyMessage('Preencha o roteiro primeiro.');return;}
    try{await navigator.clipboard.writeText(t);setCopyMessage('Texto copiado para o ElevenLabs.');}
    catch{setCopyMessage('Selecione e copie o texto manualmente.');}
  };
  const stateText=audioState==='narrated'?'Narração importada':
    audioState==='no_voice'?'Vídeo sem fala':
    audioState==='confirm_audio_type'?'Classifique o MP3 abaixo':
    'Roteiro pede narração; falta importar o MP3';
  return <section className="rounded-2xl border border-slate-700 bg-[#111D2A] p-4 text-sm" aria-label="Configuração de roteiro, narração e duração">
    <h2 className="text-lg font-bold text-amber-300">1. Roteiro, duração e narração</h2>
    <p className="mt-1 text-xs text-slate-300">
      Primeiro aprovamos o roteiro, depois geramos a voz e, por último, ajustamos a duração das cenas ao áudio real.
      O Gemini ainda não cria automaticamente o roteiro nesta tela.
    </p>

    <label htmlFor="cinema2d-audio-mode" className="mt-4 block font-semibold">Este vídeo terá narração?</label>
    <select id="cinema2d-audio-mode" className={'mt-1 '+field} value={p.mode}
      onChange={e=>p.onModeChange(e.target.value as AudioIntent)}>
      <option value="auto">Automático (pela escolha do roteiro e MP3)</option>
      <option value="narrated">Sim, com voz narrada</option>
      <option value="without_voice">Não, só animações e/ou música</option>
    </select>
    <p className="mt-2 text-xs text-slate-300" role="status">
      <strong>Situação:</strong> {stateText}. Um arquivo MP3 pode ser música ou voz; o sistema não adivinha pelo nome do arquivo.
    </p>

    <label htmlFor="cinema2d-video-length" className="mt-4 block font-semibold">Duração pretendida</label>
    <select id="cinema2d-video-length" className={'mt-1 '+field}
      value={[30,60,120,180,300,600].includes(p.duration)?String(p.duration):'custom'}
      onChange={e=>{const n=Number(e.target.value);if(durationAllowed(n))p.onSetDuration(n);}}>
      <option value="custom" disabled>Duração atual: {time(p.duration)}</option>
      <option value="30">30 segundos — vídeo rápido</option>
      <option value="60">1 minuto — dica/curiosidade</option>
      <option value="120">2 minutos — história explicada</option>
      <option value="180">3 minutos — documentário curto</option>
      <option value="300">5 minutos — documentário em atos</option>
      <option value="600">10 minutos — modo longo experimental</option>
    </select>
    <p className="mt-1 text-xs text-slate-400">
      Atual: {time(p.duration)} · cerca de {acts} atos de 20–35s.
      Trocar a duração apenas redistribui as cenas existentes; não escreve uma história nova.
      Limite técnico do editor: 15s–10min, não equivale ao limite de nenhum plano comercial.
    </p>

    <label htmlFor="cinema2d-spoken-script" className="mt-4 block font-semibold">Texto que será falado (roteiro aprovado)</label>
    <textarea id="cinema2d-spoken-script" className={'mt-1 min-h-28 '+field}
      value={p.spokenText} onChange={e=>p.onSpokenTextChange(e.target.value)}
      placeholder="Cole aqui a narração, sem tags. Futuramente o Gemini poderá preencher e revisar este texto."/>
    <p className="mt-1 text-xs text-slate-400">
      {countWords(p.spokenText)} palavras
      {estimated&&' · fala estimada: '+time(estimated.minSeconds)+'–'+time(estimated.maxSeconds)+' (apenas planejamento; o MP3 determinará o tempo real)'}.
    </p>

    <label htmlFor="cinema2d-performance-script" className="mt-4 block font-semibold">Texto para colar no ElevenLabs (com interpretação opcional)</label>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={secondary} onClick={()=>p.onPerformanceTextChange(p.spokenText)}>
        Usar roteiro limpo
      </button>
      <button type="button" className={secondary} onClick={()=>{
        if(!p.spokenText.trim())return;
        p.onPerformanceTextChange('[curious] '+p.spokenText.trim());
      }}>
        Adicionar [curious]
      </button>
    </div>
    <textarea id="cinema2d-performance-script" className={'mt-2 min-h-28 '+field}
      value={p.performanceText} onChange={e=>p.onPerformanceTextChange(e.target.value)}
      placeholder="Cole o roteiro limpo ou use tags de atuação, como [curious], se a voz e o modelo aceitarem."/>
    {scriptMismatch&&<p className="mt-2 text-xs text-amber-300" role="alert">
      O texto de atuação tem palavras diferentes do roteiro limpo. Antes de sincronizar, confira se os dois dizem a mesma coisa.
    </p>}
    <button className={'mt-2 '+secondary} type="button" onClick={()=>{void copy();}}>Copiar texto para ElevenLabs</button>
    {copyMessage&&<p role="status" className="mt-1 text-xs text-amber-200">{copyMessage}</p>}

    <details className="mt-5 rounded-xl border border-slate-600 bg-[#162236] p-3" open>
      <summary className="cursor-pointer font-bold text-amber-200">2. Como criar uma conta e baixar seu MP3 — passo a passo</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-200">
        <li>Abra <a className="text-amber-300 underline" href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer">elevenlabs.io</a> e crie uma conta ou entre na conta existente.</li>
        <li>Abra <a className="text-amber-300 underline" href="https://elevenlabs.io/text-to-speech" target="_blank" rel="noopener noreferrer">Text to Speech</a>, a ferramenta de transformar texto em fala.</li>
        <li>Copie o texto preparado acima, cole no campo de texto e escolha uma voz em português brasileiro. Compare vozes e escute a amostra; o nome de uma voz específica pode não aparecer em todas as contas.</li>
        <li>Escolha o modelo disponível (por exemplo, Eleven v4), ajuste a interpretação e clique em <strong>Gerar fala</strong>. Revise o áudio inteiro antes de gerar novamente, pois a geração pode gastar créditos.</li>
        <li>Use o botão de download após gerar, ou vá ao histórico de Text to Speech e escolha <strong>MP3</strong>. No celular, o histórico pode aparecer em um ícone acima do botão de geração.</li>
        <li>Volte ao CrieSeuVideo, importe o arquivo abaixo e informe se ele contém narração ou somente música.</li>
      </ol>
      <p className="mt-3 text-xs text-amber-200">
        Atenção: a licença gratuita do ElevenLabs é para uso não comercial com atribuição. Para vídeos monetizados, confira os direitos comerciais do seu plano na ElevenLabs.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        O CrieSeuVideo não pede sua senha nem sua chave do ElevenLabs. Voz automática com nossa API é uma opção futura para o Ultra Pro.
      </p>
    </details>

    <div className="mt-4 rounded-xl border border-slate-600 p-3">
      <h3 className="font-bold">3. Importar o MP3 da narração ou da trilha</h3>
      <input className="mt-2 block w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
        type="file" accept=".mp3,audio/mpeg" aria-label="Importar áudio MP3" onChange={p.onChooseAudio}/>
      {p.audioName&&<div className="mt-3 space-y-2">
        <p className="break-all text-xs text-slate-200">{p.audioName}{p.audioDuration>0?' · '+time(p.audioDuration):' · lendo duração…'}</p>
        <label htmlFor="cinema2d-audio-type" className="block text-xs font-semibold">O que há neste MP3?</label>
        <select id="cinema2d-audio-type" className={field} value={p.audioType}
          onChange={e=>p.onAudioTypeChange(e.target.value as ImportedAudioType)}>
          <option value="unclassified">Selecionar tipo de áudio</option>
          <option value="voice">Narração falada</option>
          <option value="music">Só trilha musical ou efeitos</option>
        </select>
        {p.audioDuration>0 && needsMatch &&<div className="rounded-lg border border-amber-600/60 bg-amber-950/30 p-3 text-xs text-amber-100">
          O MP3 tem {time(p.audioDuration)} e as cenas somam {time(p.duration)}.
          Não vamos acelerar nem cortar palavras. Para prévia contínua, ajuste as cenas ao tempo real do áudio.
          <button type="button" className={'mt-2 block '+secondary} onClick={p.onFitAudio}>Ajustar cenas ao MP3</button>
        </div>}
        {p.audioDuration>0&&!needsMatch&&<p className="text-xs text-emerald-300">Duração do MP3 e do vídeo compatíveis para prévia.</p>}
        <button type="button" className={secondary} onClick={p.onClearAudio}>Remover MP3</button>
      </div>}
      <p className="mt-2 text-xs text-slate-400">
        Esta versão consegue acompanhar a duração real do MP3, mas ainda não alinha palavras automaticamente. Sincronização por palavra e exportação MP4 estão em desenvolvimento.
      </p>
    </div>
  </section>;
}
