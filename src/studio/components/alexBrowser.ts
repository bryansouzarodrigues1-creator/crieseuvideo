export type AlexBrowserOptions={text:string;speed:number;signal:AbortSignal;onStatus?:(status:string)=>void};
export function validateAlexManifest(raw:unknown){
 if(!raw||typeof raw!=='object')throw Error('Pacote Alex indisponível.');
 const m=raw as Record<string,unknown>;
 if(m.version!==1||m.voice!=='pm_alex'||typeof m.worker!=='string'||!/^assets\/voice\.worker-[A-Za-z0-9_-]+\.js$/.test(m.worker)||typeof m.modelBytes!=='number'||!Number.isFinite(m.modelBytes)||m.modelBytes<100000000||m.modelBytes>400000000)throw Error('Pacote Alex inválido.');
 return m.worker;
}
export async function synthesizeAlexInBrowser({text,speed,signal,onStatus}:AlexBrowserOptions):Promise<File>{
 if(!text.trim()||text.length>1500||!Number.isFinite(speed)||speed<.75||speed>1.25)throw Error('Roteiro ou velocidade inválidos.');
 if(typeof Worker==='undefined'||typeof WebAssembly==='undefined')throw Error('Navegador incompatível com voz neural local.');
 onStatus?.('Verificando disponibilidade do modelo Alex…');
 const response=await fetch('/alex-local/manifest.json',{signal,credentials:'same-origin',redirect:'error',cache:'no-store'});
 if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw Error('Alex no navegador ainda não foi disponibilizado neste site.');
 const workerPath=validateAlexManifest(await response.json());
 if(signal.aborted)throw Error('Cancelado.');
 return new Promise((resolve,reject)=>{
  const worker=new Worker('/alex-local/'+workerPath);
  const finish=(error?:Error,file?:File)=>{worker.terminate();signal.removeEventListener('abort',cancel);if(error)reject(error);else if(file)resolve(file);else reject(Error('Resposta inválida.'));};
  const cancel=()=>finish(Error('Narração cancelada.'));
  signal.addEventListener('abort',cancel,{once:true});
  worker.onerror=()=>finish(Error('Falha no motor local ou memória insuficiente.'));
  worker.onmessage=({data})=>{
   if(typeof data?.status==='string'){onStatus?.(data.status);return;}
   if(typeof data?.error==='string'){finish(Error(data.error));return;}
   if(!(data?.wav instanceof ArrayBuffer)||data.wav.byteLength<44||data.wav.byteLength>24000000){finish(Error('Áudio local inválido.'));return;}
   const h=new DataView(data.wav);
   if(h.getUint32(0,false)!==0x52494646||h.getUint32(8,false)!==0x57415645||h.getUint32(24,true)!==24000){finish(Error('Formato de áudio inesperado.'));return;}
   finish(undefined,new File([data.wav],'kokoro-alex.wav',{type:'audio/wav'}));
  };
  if(signal.aborted){cancel();return;}
  worker.postMessage({text:text.trim(),speed,assetRoot:'/alex-local/'});
 });
}
