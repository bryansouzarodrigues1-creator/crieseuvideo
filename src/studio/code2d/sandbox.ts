import {
  randomHex,maxPixelDiff,replayCheck,SANDBOX_CSP,SANDBOX_ATTRIBUTE,readSandboxMessage,
} from '../code3d/sandbox';
export {randomHex,SANDBOX_ATTRIBUTE,readSandboxMessage};
const safeJSON=(v:unknown)=>JSON.stringify(v).replace(/</g,'\\u003c');

export function buildCode2DSandboxSrcdoc(opts:{
  token:string;nonce:string;parentOrigin:string;duration:number;
}):string{
  if(!/^[0-9a-f]{16,64}$/.test(opts.token)||!/^[0-9a-f]{16,64}$/.test(opts.nonce))
    throw new Error('token/nonce inválido');
  if(!Number.isFinite(opts.duration)||opts.duration<30||opts.duration>60)
    throw new Error('duração inválida');
  const csp=SANDBOX_CSP.replace('{NONCE}',opts.nonce);
  return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+csp+'">'
    +'<meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#161c2a;overflow:hidden}'
    +'canvas{display:block;width:100%;height:100%}</style></head><body><canvas id="stage"></canvas>'
    +'<script type="module" nonce="'+opts.nonce+'">'+[
      'const TOKEN='+safeJSON(opts.token)+';',
      'const PARENT='+safeJSON(opts.parentOrigin)+';',
      'const DURATION='+opts.duration+';',
      'const diff=('+maxPixelDiff.toString()+');',
      'const replay=('+replayCheck.toString()+');',
      'const send=(m,transfer)=>parent.postMessage(Object.assign({token:TOKEN},m),PARENT,transfer||[]);',
      'for(const key of ["fetch","XMLHttpRequest","WebSocket","Worker","SharedWorker","open"]){try{Object.defineProperty(window,key,{value:undefined,configurable:false})}catch(_){}}',
      'try{Object.defineProperty(navigator,"sendBeacon",{value:undefined})}catch(_){}',
      'const canvas=document.getElementById("stage");',
      'let scene=null,initialized=false,failed=false;',
      'const cap=t=>Math.max(0,Math.min(DURATION-0.001,Number(t)||0));',
      'const msg=e=>String((e&&(e.stack||e.message))||e).slice(0,500);',
      'const fail=(stage,e)=>{if(failed)return;failed=true;send({type:"error",stage,message:msg(e)})};',
      'addEventListener("error",e=>fail("runtime",e.error||e.message));',
      'addEventListener("unhandledrejection",e=>fail("runtime",e.reason));',
      'const sample=()=>{const tmp=document.createElement("canvas");tmp.width=24;tmp.height=24;const c=tmp.getContext("2d");c.drawImage(canvas,0,0,24,24);return c.getImageData(0,0,24,24).data};',
      'addEventListener("message",async ev=>{',
      'if(ev.source!==parent||!ev.data||ev.data.token!==TOKEN)return;',
      'const d=ev.data;',
      'if(d.type==="init"){',
      'if(initialized||failed)return; initialized=true;',
      'if(typeof d.code!=="string"||d.code.length>180000)return fail("load","Código inválido");',
      'const w=d.width|0,h=d.height|0;',
      'if(w<64||h<64||w>1920||h>1920)return fail("load","Dimensões inválidas");',
      'canvas.width=w;canvas.height=h;',
      'let make;',
      'try{const u=URL.createObjectURL(new Blob([d.code+"\\n;export default (typeof createScene===\\"function\\"?createScene:null);"],{type:"text/javascript"}));',
      'make=(await import(u)).default;URL.revokeObjectURL(u)}catch(e){return fail("syntax",e)}',
      'if(typeof make!=="function")return fail("contract","createScene ausente");',
      'try{scene=await make(canvas,w,h)}catch(e){return fail("runtime",e)}',
      'if(!scene||typeof scene.renderAt!=="function"||Number(scene.duration)!==DURATION)',
      'return fail("contract","A cena não entregou renderAt e a duração exata");',
      'let check;',
      'try{check=replay(t=>scene.renderAt(cap(t)),sample,diff,DURATION);scene.renderAt(0)}catch(e){return fail("runtime",e)}',
      'send({type:"ready",duration:DURATION,deterministic:check.deterministic,maxDiff:check.maxDiff});return;',
      '}',
      'if(!scene||failed)return;',
      'if(d.type==="render"){try{scene.renderAt(cap(d.t))}catch(e){fail("runtime",e)}return}',
      'if(d.type==="frame"){try{scene.renderAt(cap(d.t));const bitmap=await createImageBitmap(canvas);',
      'send({type:"frame",seq:d.seq|0,bitmap},[bitmap])}catch(e){fail("runtime",e)}}',
      '});send({type:"boot"});'
    ].join('\n')+'</script></body></html>';
}
