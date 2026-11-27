import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {generateCode3DWithGemini} from '../src/studio/server/code3dGemini';

const dir='tmp/engineering-live';
await mkdir(dir,{recursive:true});
const script='Uma bomba centrífuga de água sobre uma bancada técnica. Mostre a carcaça fechada, retire a tampa lateral para revelar o rotor, faça o rotor girar e mostre setas ciano atravessando a entrada axial e saindo pela descarga tangencial. Mantenha a mesma bomba, com câmera aproximando e legendas técnicas curtas. Use os helpers E3D de corte, fluxo e câmera. Fluxo apenas ilustrativo.';
let calls=0;
const original=globalThis.fetch;
globalThis.fetch=(...args:Parameters<typeof fetch>)=>{calls++;return original(...args);};
const result=await generateCode3DWithGemini(script,'9:16');
globalThis.fetch=original;
const report={status:result.ok?'provider_accepted':'blocked',model:result.model,calls,reason:result.ok?null:result.failure,bytes:result.ok?result.code.length:0};
await writeFile(dir+'/provider.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(!result.ok){process.exitCode=1;}else{
 await writeFile(dir+'/generated.js',result.code);
 // Build the identical trusted iframe shell from production source, substituting
 // only Vite's raw import so Bun can load it outside the website.
 const helper=await readFile('src/studio/code3d/engineeringHelpers.js','utf8');
 const source=(await readFile('src/studio/code3d/sandbox.ts','utf8')).replace(/^import engineeringSource[^\n]*\n/,'const engineeringSource='+JSON.stringify(helper)+';\n');
 await writeFile(dir+'/trusted-shell.ts',source);
 const {buildSandboxSrcdoc}=await import('../'+dir+'/trusted-shell.ts');
 const token='a'.repeat(32),nonce='b'.repeat(32);
 const shell=buildSandboxSrcdoc({token,nonce,parentOrigin:'http://127.0.0.1:4872',minDuration:8,maxDuration:12,defaultDuration:10});
 await writeFile(dir+'/sandbox.html',shell);
}
