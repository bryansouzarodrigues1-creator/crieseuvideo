import engineeringSource from './engineeringHelpers.js?raw';
/**
 * Isolation for EXPERIMENTAL model-written Three.js code.
 *
 * Controls (all required, see docs/code3d-experimental.md):
 * - iframe sandbox="allow-scripts" WITHOUT allow-same-origin → opaque origin:
 *   no cookies, localStorage, sessionStorage, IndexedDB or access to the app DOM.
 * - No allow-forms / allow-popups / allow-top-navigation / allow-modals.
 * - Meta CSP as the first <head> element: no network (connect-src 'none'),
 *   no frames, no forms, no workers, no eval; scripts only via nonce or blob:
 *   (blob: modules are created inside the sandbox from the pinned three.js copy).
 * - Messages are accepted only from the exact iframe window + 'null' origin +
 *   per-load token, with type/size checks. The token is an anti-confusion tag,
 *   not a secret. No keys, tokens or account data are ever sent to the iframe.
 * The app NEVER evaluates generated code with eval/new Function/import itself.
 */
export const SANDBOX_ATTRIBUTE = 'allow-scripts';
export const MAX_SANDBOX_ERROR_CHARS = 500;

export const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'nonce-{NONCE}' blob:",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

export function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pure: largest per-channel difference between two RGBA samples. */
export function maxPixelDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 255;
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs((a[i] as number) - (b[i] as number));
    if (d > m) m = d;
  }
  return m;
}

/** Pure: render t1, jump elsewhere, render t1 again, compare. Injected into the sandbox. */
export function replayCheck(
  renderAt: (t: number) => void,
  sample: () => ArrayLike<number>,
  diff: (a: ArrayLike<number>, b: ArrayLike<number>) => number,
  duration: number,
): { deterministic: boolean; maxDiff: number } {
  const t1 = Math.min(duration * 0.62, duration - 0.05);
  renderAt(t1);
  const a = sample();
  renderAt(duration * 0.1);
  renderAt(duration * 0.95);
  renderAt(t1);
  const b = sample();
  const d = diff(a, b);
  return { deterministic: d <= 3, maxDiff: d };
}

const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Builds the srcdoc. Contains no user code, no keys and no account data. */
export function buildSandboxSrcdoc(opts: {
  token: string; nonce: string; parentOrigin: string;
  minDuration: number; maxDuration: number; defaultDuration: number;
}): string {
  if (!/^[a-f0-9]{16,64}$/.test(opts.token) || !/^[a-f0-9]{16,64}$/.test(opts.nonce)) {
    throw new Error('token/nonce inválido');
  }
  const csp = SANDBOX_CSP.replace('{NONCE}', opts.nonce);
  return `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0d1014;overflow:hidden}canvas{display:block;width:100%;height:100%}</style>
</head><body><canvas id="c"></canvas>
<script type="module" nonce="${opts.nonce}">
const TOKEN=${js(opts.token)}, PARENT=${js(opts.parentOrigin)};
const ENGINEERING=${js(engineeringSource)};
const MIN=${js(opts.minDuration)}, MAX=${js(opts.maxDuration)}, DEF=${js(opts.defaultDuration)};
const diff=(${maxPixelDiff.toString()});
const replay=(${replayCheck.toString()});
const post=parent.postMessage.bind(parent);
const send=(m,tr)=>post(Object.assign({},m,{token:TOKEN}),PARENT,tr||[]);
// Defense in depth only; CSP connect-src 'none' is the real network block.
for(const k of ['fetch','XMLHttpRequest','WebSocket','EventSource','RTCPeerConnection','webkitRTCPeerConnection','Worker','SharedWorker','open']){
  try{Object.defineProperty(window,k,{value:undefined,configurable:false,writable:false});}catch(_){}
}
try{Object.defineProperty(navigator,'sendBeacon',{value:undefined});}catch(_){}
const canvas=document.getElementById('c');
let scene=null,failed=false,duration=DEF,THREE=null;
const msg=e=>String((e&&(e.stack||e.message))||e).slice(0,${MAX_SANDBOX_ERROR_CHARS});
const fail=(stage,e)=>{if(failed)return;failed=true;send({type:'error',stage,message:msg(e)});};
addEventListener('error',e=>fail(scene?'runtime':'load',e.error||e.message));
addEventListener('unhandledrejection',e=>fail(scene?'runtime':'load',e.reason));
const url=src=>URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
const clamp=t=>Math.max(0,Math.min(duration-0.001,Number(t)||0));
const sample=()=>{const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.drawImage(canvas,0,0,24,24);return x.getImageData(0,0,24,24).data;};
addEventListener('message',async ev=>{
  if(ev.source!==parent)return;
  const d=ev.data;
  if(!d||typeof d!=='object'||d.token!==TOKEN||typeof d.type!=='string')return;
  if(d.type==='init'){
    if(THREE||failed)return;
    if(typeof d.code!=='string'||typeof d.core!=='string'||typeof d.module!=='string')return fail('load','init inválido');
    const w=d.width|0,h=d.height|0;
    if(w<64||h<64||w>1920||h>1920)return fail('load','tamanho inválido');
    canvas.width=w;canvas.height=h;
    try{
      const core=url(d.core);
      THREE=await import(url(d.module.split("'./three.core.js'").join(js(core)).split('"./three.core.js"').join(js(core))));
    }catch(e){return fail('library',e);}
    let createScene;
    try{createScene=(await import(url(d.code+'\\n;export default (typeof createScene==="function"?createScene:null);'))).default;}
    catch(e){return fail('syntax',e);}
    if(typeof createScene!=='function')return fail('contract','createScene(THREE, canvas, width, height) não foi definida.');
    try{const {createEngineeringHelpers}=await import(url(ENGINEERING));const E3D=Object.freeze(createEngineeringHelpers(THREE));scene=await createScene(THREE,canvas,w,h,E3D);}catch(e){return fail('runtime',e);}
    if(!scene||typeof scene.renderAt!=='function')return fail('contract','createScene não retornou { renderAt(t) }.');
    const dur=scene.duration===undefined?DEF:Number(scene.duration);
    if(!Number.isFinite(dur)||dur<MIN||dur>MAX)return fail('contract','duration deve ficar entre '+MIN+' e '+MAX+' s (recebido '+String(scene.duration).slice(0,20)+').');
    duration=dur;
    let r;
    try{r=replay(t=>scene.renderAt(clamp(t)),sample,diff,duration);scene.renderAt(0);}catch(e){return fail('runtime',e);}
    send({type:'ready',duration,deterministic:!!r.deterministic,maxDiff:Number(r.maxDiff)||0});
    return;
  }
  if(!scene||failed)return;
  if(d.type==='render'){try{scene.renderAt(clamp(d.t));}catch(e){fail('runtime',e);}return;}
  if(d.type==='frame'){
    try{scene.renderAt(clamp(d.t));const bitmap=await createImageBitmap(canvas);send({type:'frame',seq:d.seq|0,bitmap},[bitmap]);}
    catch(e){fail('runtime',e);}
  }
});
send({type:'boot'});
</script></body></html>`;
}

export type SandboxMessage =
  | { type: 'boot' }
  | { type: 'ready'; duration: number; deterministic: boolean; maxDiff: number }
  | { type: 'error'; stage: 'load' | 'library' | 'syntax' | 'contract' | 'runtime'; message: string }
  | { type: 'frame'; seq: number; bitmap: ImageBitmap };

const STAGES = new Set(['load', 'library', 'syntax', 'contract', 'runtime']);

/** Accept a message only from our iframe, the opaque origin and this load's token. */
export function readSandboxMessage(
  ev: { source: unknown; origin: string; data: unknown },
  frameWindow: unknown,
  token: string,
): SandboxMessage | null {
  if (!frameWindow || ev.source !== frameWindow || ev.origin !== 'null') return null;
  const d = ev.data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || d.token !== token || typeof d.type !== 'string') return null;
  switch (d.type) {
    case 'boot': return { type: 'boot' };
    case 'ready': {
      const duration = Number(d.duration);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 30) return null;
      return { type: 'ready', duration, deterministic: d.deterministic === true, maxDiff: Math.min(255, Math.max(0, Number(d.maxDiff) || 0)) };
    }
    case 'error':
      if (typeof d.stage !== 'string' || !STAGES.has(d.stage)) return null;
      return { type: 'error', stage: d.stage as 'runtime', message: String(d.message ?? '').slice(0, MAX_SANDBOX_ERROR_CHARS) };
    case 'frame':
      if (typeof ImageBitmap === 'undefined' || !(d.bitmap instanceof ImageBitmap)) return null;
      return { type: 'frame', seq: Number(d.seq) | 0, bitmap: d.bitmap };
    default: return null;
  }
}
