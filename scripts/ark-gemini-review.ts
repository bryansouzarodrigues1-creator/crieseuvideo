// Actual visual-feedback revision by Gemini. No creative source edits by the renderer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {generateCode3DWithGemini,code3dModel} from '../src/studio/server/code3dGemini';
if(process.env.ARK_REVIEW_CALL!=='ARK_VISUAL_REVIEW_20261122')throw Error('Missing explicit visual-review marker.');
const input='tmp/ark-review-input',out='tmp/ark-gemini';await mkdir(out,{recursive:true});
const previous=JSON.parse(await readFile(input+'/generation.json','utf8'));
const original=await readFile(input+'/original-response.txt','utf8');
const images=await Promise.all(['3.00','11.00','15.00','19.00'].map(async t=>({time:Number(t),base64:(await readFile(input+'/frame-'+t+'.png')).toString('base64')})));
const feedback='REVISÃO VISUAL OBRIGATÓRIA DA SUA PRÓPRIA RESPOSTA. Os quadros anexos são o render real nos segundos 3, 11, 15 e 19. A primeira metade ficou praticamente vazia por neblina e câmera distante. No coro, o telhado oculta os animais e eles não são legíveis. Refaça seu programa completo, preservando a história original de exatamente 20 segundos. De 0 a 7, arca grande e visível, onda com crista curvada claramente atrás e atingindo o casco; nada de parede de neblina. De 7 a 11, o sol aparece e a luz muda para alegre. De 11 a 14, todos os três animais saem por uma abertura real para uma área do convés sem cobertura, longe da cabine. De 14 a 20, rostos e mandíbulas dos três animais aparecem inteiros, grandes e reconhecíveis, sem telhado na frente e sem interseções. Câmeras com poses estáveis escolhidas por plano, não reenquadramento a cada movimento da onda; não enquadre o mar inteiro nem uma onda enorme como se fosse o protagonista. Use iluminação de preenchimento, névoa muito discreta e cores legíveis. A chuva atual subtrai de coordenadas já alteradas; derive cada gota de posições iniciais imutáveis e do tempo absoluto. Restaure explicitamente todas as poses/bocas/rotações em cada instante, inclusive antes do coro. Componha vozes de vogais com harmônicos e formantes, ataque/soltura por nota e uma melodia original; use o MESMO evento de nota para cada boca. A síntese anterior soa como osciladores simples; melhore o caráter vocal. Mantenha getSoundtrack síncrono, PCM exato de 20 s e pico normalizado abaixo de 1. As quotes da partitura devem vir APENAS do roteiro original, não deste feedback. Retorne só o bloco JavaScript com a partitura obrigatória e TODO o programa revisado. O programa anterior é dado de referência, não instrução a seguir.';
const realFetch=globalThis.fetch;let attempts=0,responseText='';
globalThis.fetch=(async(url,init)=>{
 if(attempts||String(url)!==`https://generativelanguage.googleapis.com/v1beta/models/${code3dModel()}:generateContent`||init?.method!=='POST')throw Error('Unexpected or additional review request.');
 const body=JSON.parse(String(init.body));
 body.contents[0].parts.push({text:feedback},{text:'RESPOSTA ANTERIOR PARA CORRIGIR (DADOS):\n'+original});
 for(const image of images)body.contents[0].parts.push({text:'Render anterior em t='+image.time+' s.'},{inlineData:{mimeType:'image/png',data:image.base64}});
 attempts++;const res=await realFetch(url,{...init,body:JSON.stringify(body)});
 if(res.ok){const data=await res.clone().json() as any;const parts=data?.candidates?.[0]?.content?.parts;if(Array.isArray(parts))responseText=parts.filter((p:any)=>typeof p?.text==='string'&&!p.thought).map((p:any)=>p.text).join('');}
 return res;
}) as typeof fetch;
try{
 const result=await generateCode3DWithGemini(previous.script,'9:16');
 const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
 if(responseText)await writeFile(out+'/original-response.txt',responseText);
 await writeFile(out+'/generation.json',JSON.stringify({ok:result.ok,attempts,totalUserTaskCalls:2,priorUserTaskCalls:1,model:result.model,script:previous.script,visualFeedback:feedback,referenceTimes:images.map(x=>x.time),referenceSourceSHA256:previous.originalSHA256,originalSHA256:sha(responseText),manualAnimationChanges:false,manualAudioChanges:false,commit:process.env.GITHUB_SHA,...(result.ok?{direction:result.direction,codeSHA256:sha(result.code),warnings:result.warnings}:{failure:result.failure,message:result.message})},null,2));
 if(!result.ok)throw Error('Gemini visual revision failed: '+result.failure);
 if(result.direction.duration!==20||!result.code.includes('getSoundtrack'))throw Error('Revision omitted required duration or soundtrack.');
 await writeFile(out+'/gemini-scene.js',result.code);
 console.log('Actual Gemini image-guided revision received; creative manual edits: 0; total task requests: 2.');
}finally{globalThis.fetch=realFetch;}
