import {cpSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';
const wasm=resolve('node_modules/@mediapipe/tasks-audio/wasm');
if(!existsSync(wasm))throw new Error('Install the pinned SDK first.');
mkdirSync('public/wasm',{recursive:true});
cpSync(wasm,'public/wasm',{recursive:true});
const model=process.env.KOKORO_MODEL_PATH;
if(model){
  if(basename(model)!=='kokoro_int8_fp16.litertlm')throw new Error('Use the original CPU-compatible model filename.');
  mkdirSync('public/models',{recursive:true});
  cpSync(model,'public/models/kokoro_int8_fp16.litertlm');
}
