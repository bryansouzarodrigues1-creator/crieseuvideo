const by=id=>document.getElementById(id);
let worker=null,urls=[];
const setBusy=b=>{by('generate').disabled=b;by('cancel').disabled=!b;by('script').disabled=b;by('speed').disabled=b;};
function clearOutputs(){for(const url of urls)URL.revokeObjectURL(url);urls=[];by('audio').pause();by('audio').removeAttribute('src');for(const id of ['audio','download','timestamps'])by(id).hidden=true;by('metrics').textContent='';}
function reset(){worker?.terminate();worker=null;setBusy(false);}
by('cancel').onclick=()=>{reset();by('status').textContent='Cancelado.';};
by('generate').onclick=()=>{
  const text=by('script').value.trim(),speed=Number(by('speed').value);
  if(!text||text.length>1500||!Number.isFinite(speed)||speed<.75||speed>1.25){by('status').textContent='Verifique o roteiro e a velocidade.';return;}
  clearOutputs();setBusy(true);by('status').textContent='Iniciando…';
  try{
    worker??=new Worker(new URL('./voice.worker.js',import.meta.url),{type:'module'});
    worker.onerror=()=>{reset();by('status').textContent='Falha no motor local. Verifique modelo, WASM e compatibilidade.';};
    worker.onmessage=({data})=>{
      if(data.status){by('status').textContent=data.status;return;}
      if(data.error){reset();by('status').textContent=data.error;return;}
      if(!data.wav){reset();return;}
      const audio=URL.createObjectURL(new Blob([data.wav],{type:'audio/wav'}));urls.push(audio);
      by('audio').src=audio;by('audio').hidden=false;by('download').href=audio;by('download').hidden=false;
      if(data.timing?.length){const t=URL.createObjectURL(new Blob([JSON.stringify({voice:'pm_alex',text,timestamps:data.timing},null,2)],{type:'application/json'}));urls.push(t);by('timestamps').href=t;by('timestamps').hidden=false;}
      by('metrics').textContent='Áudio: '+data.seconds.toFixed(2)+' s | Processamento: '+data.elapsed.toFixed(2)+' s | Tempos: '+(data.timing?.length??0);
      by('status').textContent='Áudio gerado localmente.';setBusy(false);
    };
    worker.postMessage({text,speed});
  }catch(e){reset();by('status').textContent=String(e);}
};
window.addEventListener('pagehide',()=>{reset();clearOutputs();});
