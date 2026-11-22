// Actual user-requested generation. All creative scene/audio code comes from Gemini.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateCode3DWithGemini,code3dModel} from '../src/studio/server/code3dGemini';
if(process.env.ARK_ONE_CALL!=='ARK_TSUNAMI_20261122')throw Error('Missing authorized request marker.');
const out='tmp/ark-gemini';await mkdir(out,{recursive:true});
const script='Fábula animada 3D: a Arca de Noé enfrenta um tsunami. Duração EXATA de 20 segundos, vertical. De 0 a 7 s, uma enorme onda curva de crista branca se ergue e atinge a arca de madeira: casco e cabine detalhados, chuva, balanço com peso, sem afundar. De 7 a 11 s, a tempestade se dissipa, as nuvens abrem e o sol ilumina o mar que fica calmo. De 11 a 14 s, a porta abre e animais de pelo menos três espécies reconhecíveis caminham da cabine para o convés externo, sem se atravessar. De 14 a 20 s, os animais do lado de fora cantam juntos um coro alegre ORIGINAL de vogais, abrem e fecham mandíbulas nas notas e balançam o corpo. Inclua getSoundtrack com PCM REAL de 20 s: vento/ondas no início e vozes sintetizadas com formantes/harmônicos e melodia no coro; compartilhe os eventos das notas com as bocas, não use apenas apitos. Câmera legível acompanha onda, transição ao sol e coro inteiro, usando fitCameraToObjects, sem cortar animais nem arca. Cores vivas e luz de preenchimento. Não use apresentador nem imagens externas. Placa discreta COMENTE ARCA no último segundo, sem cobrir os animais.';
if(script.length>1200)throw Error('Brief exceeds the actual provider input limit.');
const realFetch=globalThis.fetch;let attempts=0,original='';
globalThis.fetch=(async(url,init)=>{
 if(attempts||String(url)!==`https://generativelanguage.googleapis.com/v1beta/models/${code3dModel()}:generateContent`||init?.method!=='POST')throw Error('Unexpected or additional provider request.');
 attempts++;
 const res=await realFetch(url,init);
 if(res.ok){const data=await res.clone().json() as any;const parts=data?.candidates?.[0]?.content?.parts;if(Array.isArray(parts))original=parts.filter((p:any)=>typeof p?.text==='string'&&!p.thought).map((p:any)=>p.text).join('');}
 return res;
}) as typeof fetch;
try{
 const result=await generateCode3DWithGemini(script,'9:16');
 if(original)await writeFile(out+'/original-response.txt',original);
 const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
 await writeFile(out+'/generation.json',JSON.stringify({ok:result.ok,attempts,model:result.model,script,manualAnimationChanges:false,manualAudioChanges:false,originalSHA256:sha(original),commit:process.env.GITHUB_SHA,...(result.ok?{direction:result.direction,codeSHA256:sha(result.code),warnings:result.warnings}:{failure:result.failure,message:result.message})},null,2));
 if(!result.ok)throw Error(`Gemini generation failed: ${result.failure}; calls=${attempts}`);
 if(result.direction.duration!==20||!result.code.includes('getSoundtrack'))throw Error('The response omitted the requested duration or soundtrack method.');
 await writeFile(out+'/gemini-scene.js',result.code);
 console.log(`Gemini returned the actual ark program: ${result.code.length} characters, ${result.direction.shots.length} shots, calls=${attempts}.`);
}finally{globalThis.fetch=realFetch;}
