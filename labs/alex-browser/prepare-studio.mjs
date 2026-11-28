// Run explicitly after installing the pinned lab SDK and preparing verified model weights.
import {existsSync,readFileSync,readdirSync,cpSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const lab=dirname(fileURLToPath(import.meta.url));
const model=resolve(lab,'public/models/kokoro_int8_fp16.litertlm');
if(!existsSync(model))throw Error('Prepare the approved Kokoro CPU model first.');
execFileSync('npm',['run','build','--','--base=/alex-local/'],{cwd:lab,stdio:'inherit'});
const dist=resolve(lab,'dist'),target=resolve(lab,'../../public/alex-local');
const workers=readdirSync(resolve(dist,'assets')).filter(n=>/^voice\.worker-[A-Za-z0-9_-]+\.js$/.test(n));
if(workers.length!==1)throw Error('Expected one compiled voice worker.');
mkdirSync(target,{recursive:true});
cpSync(dist,target,{recursive:true});
writeFileSync(resolve(target,'manifest.json'),JSON.stringify({version:1,worker:'assets/'+workers[0],voice:'pm_alex',modelBytes:readFileSync(model).length}));
console.log('Alex optional bundle prepared at public/alex-local. Deploy only with worker CSP and asset hosting verified.');
