import {FilesetResolver,TextToSpeech} from '@mediapipe/tasks-audio';
import {encodeWav} from './wav.mjs';
// The inference worker must not send the script, diagnostics or telemetry off-site.
// CSP on the worker response is a second layer on supported deployments.
const allowed=url=>{const u=new URL(url,self.location.href);return u.origin===self.location.origin||u.protocol==='blob:'||u.protocol==='data:';};
const originalFetch=self.fetch.bind(self);
self.fetch=(input,init)=>{const url=input instanceof Request?input.url:String(input);return allowed(url)?originalFetch(input,{...init,redirect:'error'}):Promise.reject(new TypeError('External network disabled for local speech'));};
const originalOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...args){if(!allowed(String(url)))throw new Error('External network disabled for local speech');return originalOpen.call(this,method,url,...args);};
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
      const assetRoot=new URL(data.assetRoot||'/',self.location.origin);
      if(assetRoot.origin!==self.location.origin||!['/','/alex-local/'].includes(assetRoot.pathname))throw Error('Origem de voz inválida.');
      const wasm=await FilesetResolver.forAudioTasks(new URL('wasm/',assetRoot).href);
      tts=await TextToSpeech.createFromOptions(wasm,{baseOptions:{modelAssetPath:new URL('models/kokoro_int8_fp16.litertlm',assetRoot).href,delegate:'CPU'},defaultVoiceId:'pm_alex',defaultLocale:'pt-BR',speakingRate:speed});
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
