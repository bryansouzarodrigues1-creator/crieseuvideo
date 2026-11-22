// Two real calls, identical input/model/config except low vs high thinking.
// No retries, creative repairs, fallback model, or model code execution here.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateCode3DWithGemini,code3dModel} from '../src/studio/server/code3dGemini';
import {extractCode} from '../src/studio/code3d/contract';
import {normalizeDirection} from '../src/studio/code3d/direction';
import {checkGeneratedCode} from '../src/studio/code3d/validation';
if(process.env.THINKING_AB_CALLS!=='TWO_CONTROLLED_REQUESTS_20261122')throw Error('Missing explicit two-call marker.');
const out='tmp/thinking-ab';await mkdir(out,{recursive:true});
const script='Teste técnico de animação 3D cartoon, vertical, duração EXATA de 8 segundos. Um elefante cinza de corpo INTEIRO sai da cabine de madeira da arca para o convés aberto, em dia claro. De 0 a 0.5 s, ele aparece dentro de uma porta realmente aberta e larga o suficiente. De 0.5 a 3.8 s, caminha três passos até ficar totalmente fora da cabine: quatro patas articuladas com joelhos, alternância de apoio, pés encostando no piso, corpo com peso, orelhas grandes, tromba curva, presas e olhos reconhecíveis. De 3.8 a 5 s, para e olha para a câmera, com todos os pés apoiados e o corpo inteiro visível. De 5 a 8 s, apenas mantenha esse resultado final; a comparação usará os primeiros cinco segundos. Um único plano fixo em três quartos mostra porta, piso e elefante inteiro durante toda a ação, com boa luz de preenchimento e cores legíveis. Sem telhado ou parede na frente do animal, sem atravessar a cabine, sem deslizar pés, sem trocar o animal por outro. O elefante deve ocupar pelo menos metade da altura útil da imagem. Sem áudio, sem texto na cena e sem outros animais. Crie tudo em código próprio; todas as poses são função do tempo absoluto.';
if(script.length>1200)throw Error('Brief exceeds provider input limit.');
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const realFetch=globalThis.fetch;
const arms:any[]=[];let totalRequests=0;
try{
 for(const level of ['low','high'] as const){
  let attempts=0,original='',usage:unknown=null,finishReason:unknown=null,requestHash='',commonHash='';
  const started=Date.now();
  globalThis.fetch=(async(url,init)=>{
   if(attempts||String(url)!==`https://generativelanguage.googleapis.com/v1beta/models/${code3dModel()}:generateContent`||init?.method!=='POST')throw Error('Unexpected/additional A/B request.');
   const body=JSON.parse(String(init.body));body.generationConfig.thinkingConfig={thinkingLevel:level};
   requestHash=sha(JSON.stringify(body));const common=structuredClone(body);delete common.generationConfig.thinkingConfig;commonHash=sha(JSON.stringify(common));
   attempts++;totalRequests++;
   const res=await realFetch(url,{...init,body:JSON.stringify(body)});
   if(res.ok){const data=await res.clone().json() as any;usage=data.usageMetadata??null;finishReason=data?.candidates?.[0]?.finishReason??null;const parts=data?.candidates?.[0]?.content?.parts;if(Array.isArray(parts))original=parts.filter((p:any)=>typeof p?.text==='string'&&!p.thought).map((p:any)=>p.text).join('');}
   return res;
  }) as typeof fetch;
  const result=await generateCode3DWithGemini(script,'9:16');
  const meta:any={level,model:result.model,attempts,elapsedMs:Date.now()-started,usage,finishReason,requestHash,commonRequestHash:commonHash,scriptSHA256:sha(script),originalSHA256:sha(original),providerAccepted:result.ok,manualCreativeEdits:false,codeReady:false,...(!result.ok?{providerFailure:result.failure}:{} )};
  await writeFile(`${out}/${level}.original.txt`,original);
  // Same explicit-import preparation for either arm. Production gate status is
  // recorded separately; a valid self-contained response is not silently repaired.
  try{
   const raw=extractCode(original);if(!raw)throw Error('Missing code.');
   const syntax=checkGeneratedCode(raw);if(!syntax.ok)throw Error(syntax.failure);
   const match=/^\/\*CRIESEUVIDEO_DIRECTION_V1\s*([\s\S]*?)\*\/\s*/.exec(raw);if(!match)throw Error('Missing direction.');
   const direction=normalizeDirection(JSON.parse(match[1]),script);if(direction.duration!==8)throw Error('Duration is not 8 seconds.');
   const body=raw.slice(match[0].length),referencesScore=/\bDIRECTOR_SCORE\b/.test(body);
   const code=referencesScore?match[0]+'const DIRECTOR_SCORE = '+JSON.stringify(direction).replace(/</g,'\\u003c')+';\n'+body:raw;
   const checked=checkGeneratedCode(code);if(!checked.ok)throw Error(checked.failure);
   await writeFile(`${out}/${level}.js`,code);
   Object.assign(meta,{codeReady:true,direction,codeSHA256:sha(code),originalBodySHA256:sha(body),sourceCharacters:code.length,scoreInjectedAsData:referencesScore,warnings:checked.warnings,executionMode:result.ok?'accepted_directed_response':'explicit_import_of_model_response'});
  }catch(error){meta.preparationFailure=String(error);}
  arms.push(meta);await writeFile(`${out}/${level}.generation.json`,JSON.stringify(meta,null,2));
  console.log(`A/B ${level}: calls=${attempts}, codeReady=${meta.codeReady}, providerAccepted=${meta.providerAccepted}, elapsedMs=${meta.elapsedMs}`);
 }
 if(totalRequests!==2||arms.some(a=>a.attempts!==1)||arms[0].commonRequestHash!==arms[1].commonRequestHash||arms[0].model!==arms[1].model)throw Error('A/B request equality failed.');
 await writeFile(out+'/experiment.json',JSON.stringify({model:code3dModel(),script,scriptSHA256:sha(script),totalRequests,controlledDifference:'generationConfig.thinkingConfig.thinkingLevel',commonRequestHash:arms[0].commonRequestHash,maxOutputTokens:32768,requestedDuration:8,comparedDuration:5,format:'9:16, native 720x1280, 30fps',order:['low','high'],samplesPerLevel:1,repairs:0,limitations:['One stochastic sample per level; no seed was set.','Order is fixed and latency is descriptive, not a controlled performance benchmark.','The five-second comparison is cropped equally from native eight-second exports.','Provider acceptance and explicit-import execution are reported separately.'],arms},null,2));
}finally{globalThis.fetch=realFetch;}
