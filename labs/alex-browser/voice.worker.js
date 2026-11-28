import {FilesetResolver,TextToSpeech} from '@mediapipe/tasks-audio';
import {encodeWav} from './wav.mjs';
let tts=null,previousSpeed=null,busy=false;
self.onmessage=async({data})=>{
  if(busy)return;busy=true;
  try{
    const text=typeof data.text==='string'?data.text.trim():'',speed=Number(data.speed);
    if(!text||text.length>1500||!Number.isFinite(speed)||speed<.75||speed>1.25)throw Error('Roteiro ou velocidade inválidos.');
    const start=performance.now();
    if(!tts||previousSpeed!==speed){
      tts?.close();tts=null;
      self.postMessage({status:'Carregando modelo local…'});
      const wasm=await FilesetResolver.forAudioTasks(new URL('/wasm/',self.location.origin).href);
      tts=await TextToSpeech.createFromOptions(wasm,{baseOptions:{modelAssetPath:new URL('/models/kokoro_int8_fp16.litertlm',self.location.origin).href,delegate:'CPU'},defaultVoiceId:'pm_alex',defaultLocale:'pt-BR',speakingRate:speed});
      previousSpeed=speed;
    }
    const voices=await tts.listVoices();
    if(!voices.some(v=>v.voiceId==='pm_alex'))throw Error('O modelo não oferece Alex. Nenhuma outra voz será usada.');
    self.postMessage({status:'Sintetizando no dispositivo…'});
    const result=await tts.synthesize(text,{voiceId:'pm_alex',locale:'pt-BR'});
    const wav=encodeWav(result.samples,result.sampleRateHz);
    self.postMessage({wav,seconds:result.samples.length/result.sampleRateHz,elapsed:(performance.now()-start)/1000,timing:result.wordTimestamps??[]},[wav]);
  }catch(e){self.postMessage({error:e instanceof Error?e.message:String(e)});}
  finally{busy=false;}
};
