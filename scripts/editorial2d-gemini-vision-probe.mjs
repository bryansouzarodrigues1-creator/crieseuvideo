import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

// One Gemini vision call only. Never log API keys, response bodies or request headers.
const dest=path.resolve('tmp/editorial2d-gemini');
await mkdir(dest,{recursive:true});
const report={test:'cinema2d-gemini-vision',model:process.env.GEMINI_TEST_MODEL||'gemini-3.8-flash',provider:'gemini',status:'starting',calls:0,images:0};
const store=()=>writeFile(path.join(dest,'result.json'),JSON.stringify(report,null,2));
if(process.env.GEMINI_TEST_EXPLICIT_RUN!=='true'){
  report.status='skipped_without_explicit_opt_in';
  await store();
  console.log('GEMINI_VISION: skipped — test was not explicitly dispatched');
  process.exit(0);
}
const key=process.env.GEMINI_TEST_API_KEY?.trim();
if(!key){report.status='skipped_no_key';await store();console.log('GEMINI_VISION: skipped_no_key');process.exit(0);}
if(!/^[a-zA-Z0-9_.-]{1,75}$/.test(report.model))throw Error('Model id invalid');
const names=['ovos_05s.png','loja_10s.png','loja_20s.png'];
const prompt=[
'Você é diretor de arte de animação editorial 2D vertical para TikTok.',
'Receberá três capturas REAIS da nossa ferramenta CrieSeuVideo, nesta ordem.',
'Imagem 1: 5s do Vendedor de Ovos, deve conter dois personagens com etiquetas não espelhadas.',
'Imagem 2: 10s da Loja, deve explicar que pedidos geram faturamento e mostrar uma loja com moedas.',
'Imagem 3: 20s da Loja, deve explicar números de venda R$ 900, custos R$ 650, sobra parcial R$ 250.',
'Analise o que realmente é visível, sem presumir que há objetos apenas porque aparecem no roteiro.',
'Encontre áreas vazias, qualidade de desenho, legibilidade, posições, falta de contexto e números confusos.',
'Um frame isolado não permite avaliar fluidez de movimento; não invente essa avaliação.',
'Retorne APENAS JSON válido com formato:',
'{"overallScore":0,"scenes":[{"image":"ovos_05s.png","visible":"...","coherent":false,"clarityScore":0,"polishScore":0,"issues":[{"kind":"...","severity":"high","evidence":"...","fix":"..."}]}],"verdict":"..."}',
'Inclua exatamente três scenes na ordem, no máximo três issues em cada.'
].join('\n');
const parts=[{text:prompt}];
for(const filename of names){
 const bytes=await readFile(path.resolve('tmp/editorial2d-visual-qa',filename));
 if(bytes.length<1000)throw Error('Invalid frame '+filename);
 parts.push({inline_data:{mime_type:'image/png',data:bytes.toString('base64')}});
 report.images++;
}
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),65000);
try{
 report.calls=1;
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+report.model+':generateContent',{
   method:'POST',signal:controller.signal,
   headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
   body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0.1,maxOutputTokens:6500,thinkingConfig:{thinkingLevel:'minimal'}}})
 });
 report.httpStatus=res.status;
 if(!res.ok){
  report.status='provider_error';
  report.failure=res.status===401?'unauthorized':res.status===403?'forbidden':res.status===404?'model_unavailable':res.status===429?'quota':res.status>=500?'service_unavailable':'invalid_request';
  await store();
  console.log('GEMINI_VISION: HTTP '+res.status+' '+report.failure);
  process.exitCode=1;
 }else{
  const data=await res.json();
  report.usage={input:data.usageMetadata?.promptTokenCount??null,output:data.usageMetadata?.candidatesTokenCount??null,total:data.usageMetadata?.totalTokenCount??null};
  const candidate=data.candidates?.[0];
  const raw=(candidate?.content?.parts||[]).filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');
  let obj=null;try{obj=JSON.parse(raw.trim())}catch{}
  if(!obj||!Array.isArray(obj.scenes)||obj.scenes.length!==3){
   report.status=candidate?.finishReason==='MAX_TOKENS'?'truncated_response':'invalid_json';report.finishReason=candidate?.finishReason??'unknown';process.exitCode=1;
  }else{
   report.status='success';report.score=Number(obj.overallScore)||0;
   report.verdict=String(obj.verdict||'').slice(0,1200);
   report.scenes=obj.scenes.slice(0,3).map((s,i)=>({
     image:names[i],visible:String(s.visible||'').slice(0,700),coherent:!!s.coherent,
     clarityScore:Number(s.clarityScore)||0,polishScore:Number(s.polishScore)||0,
     issues:(Array.isArray(s.issues)?s.issues:[]).slice(0,3).map(x=>({
       kind:String(x.kind||'').slice(0,90),
       severity:['low','medium','high'].includes(x.severity)?x.severity:'medium',
       evidence:String(x.evidence||'').slice(0,450),fix:String(x.fix||'').slice(0,450)
     }))
   }));
  }
  await store();
  console.log('GEMINI_VISION: '+report.status+'; score '+(report.score??'?')+'; scenes '+(report.scenes?.length||0));
 }
}catch(e){
 report.status=e?.name==='AbortError'?'timeout':'network_error';
 await store();process.exitCode=1;
 console.log('GEMINI_VISION: '+report.status);
}finally{clearTimeout(timeout);}
