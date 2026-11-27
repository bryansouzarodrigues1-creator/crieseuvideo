import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {generateCode3DWithGemini} from '../src/studio/server/code3dGemini';

const dir='tmp/engineering-live';
await mkdir(dir,{recursive:true});
const script="Por que a geladeira esfria por dentro e esquenta atrás? Animação vertical de engenharia, 12 s, sem narração. Cozinha moderna completa: armários, pia, bancada, piso, janela, luz natural e objetos de uso diário. Geladeira realista de duas portas, inox, puxadores, borrachas, prateleiras, alimentos e gavetas. 0–3s: gancho visual, porta abre pela dobradiça e câmera revela alimentos frios. 3–6s: câmera se aproxima e painel lateral se afasta, revelando compressor na base, condensador externo, tubo capilar e evaporador interno interligados em circuito fechado. 6–10s: anime refrigerante em circuito compressor → condensador → capilar → evaporador → compressor. Vermelho/laranja na descarga quente, azul na região fria; setas orientadas; calor sai para a cozinha no condensador e é absorvido no evaporador. 10–12s: restaure painel e feche a porta, resultado. Use E3D, materiais variados, sombras, encaixes, rótulos curtos e câmera suave. Sem valores térmicos inventados, sem apresentar o fluxo como simulação física. Não faça maquete vazia nem vários eletrodomésticos desconectados.";
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
