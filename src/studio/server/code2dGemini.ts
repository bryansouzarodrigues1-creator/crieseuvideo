import {parse} from 'acorn';
import {
  CODE2D_MAX_CODE_CHARS,code2dPrompt,extractCode2D,
  type Code2DAspect,validateCode2DDuration,
} from '../code2d/contract';
import {GEMINI_THINKING_LEVEL} from './ai';

/** Never run the returned program on the server or the app origin. */
export function checkCode2D(code:string):
  {ok:true;warnings:string[]}|{ok:false;error:string}{
  if(!code.trim()||code.length>CODE2D_MAX_CODE_CHARS)return {ok:false,error:'Código vazio ou grande demais.'};
  let ast:any;
  try{ast=parse(code,{ecmaVersion:'latest',sourceType:'module'});}
  catch{return {ok:false,error:'JavaScript inválido.'};}
  let found=false;
  for(const node of ast.body){
    if(node.type==='ImportDeclaration'||node.type.startsWith('Export'))return {ok:false,error:'Import e export não são permitidos.'};
    if(node.type==='FunctionDeclaration'&&node.id?.name==='createScene')found=true;
    if(node.type==='VariableDeclaration')for(const dec of node.declarations){
      if(dec.id?.name==='createScene')found=true;
    }
  }
  if(!found)return {ok:false,error:'Defina createScene(canvas,width,height) no nível superior.'};
  const forbidden=[
    /\b(?:fetch|XMLHttpRequest|WebSocket|Worker|SharedWorker|require)\s*\(/,
    /\b(?:document|window|globalThis|localStorage|sessionStorage|navigator)\b/,
    /\b(?:eval|Function)\s*\(/,
    /\bimport\s*\(/,
  ];
  if(forbidden.some(re=>re.test(code)))return {ok:false,error:'Código tentou usar um recurso externo proibido.'};
  const warnings:string[]=[];
  if(/\b(?:setTimeout|setInterval|requestAnimationFrame|performance\.now|Date\.now|Math\.random)\b/.test(code))
    warnings.push('O código depende de relógio, temporizador ou aleatoriedade. Replay deve ser conferido.');
  return {ok:true,warnings};
}
export type Code2DGeneration=
  |{ok:true;model:string;code:string;thinkingLevel:'HIGH';duration:number;warnings:string[]}
  |{ok:false;model:string;thinkingLevel:'HIGH';failure:string;message:string};

function classify(status:number):string{
  if(status===429)return 'quota';
  if(status===400)return 'invalid_request';
  if(status===401)return 'unauthorized';
  if(status===403)return 'forbidden';
  if(status===404)return 'model_unavailable';
  if(status>=500)return 'service_unavailable';
  return 'provider_error';
}
export async function generateCode2DWithGemini(
  topic:string,aspect:Code2DAspect,duration:number,
):Promise<Code2DGeneration>{
  const model=process.env.GEMINI_CODE2D_MODEL||process.env.GEMINI_AI_MODEL||'gemini-3.8-flash';
  const fail=(failure:string,message:string):Code2DGeneration=>({ok:false,model,thinkingLevel:'HIGH',failure,message});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return fail('not_configured','GEMINI_API_KEY ausente no servidor.');
  if(!/^[a-zA-Z0-9._-]{1,80}$/.test(model))return fail('invalid_model','Modelo configurado é inválido.');
  if(!validateCode2DDuration(duration))return fail('invalid_duration','A duração precisa ser entre 30 e 60 segundos.');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),180_000);
  let answer='';
  try{
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
      method:'POST',signal:abort.signal,
      headers:{'x-goog-api-key':key,'content-type':'application/json'},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:code2dPrompt(topic,aspect,duration)}]}],
        generationConfig:{
          thinkingConfig:{thinkingLevel:GEMINI_THINKING_LEVEL},
          responseMimeType:'text/plain',
          maxOutputTokens:65536,
        },
      }),
    });
    if(!res.ok){
      // Do not record raw provider data, key or user-generated code.
      return fail(classify(res.status),'Gemini devolveu HTTP '+res.status+'; nenhuma animação foi fabricada.');
    }
    const data=await res.json();
    const candidate=data.candidates?.[0];
    if(candidate?.finishReason==='MAX_TOKENS')return fail('truncated','Código excedeu limite de saída.');
    if(candidate?.finishReason==='SAFETY'||candidate?.finishReason==='PROHIBITED_CONTENT')
      return fail('blocked','O Gemini não gerou o programa solicitado.');
    answer=(candidate?.content?.parts||[])
      .filter((p:any)=>typeof p.text==='string'&&!p.thought)
      .map((p:any)=>p.text).join('');
  }catch(e){
    return fail(e instanceof Error&&e.name==='AbortError'?'timeout':'network','A chamada do Gemini falhou; sem substituição manual.');
  }finally{clearTimeout(timer);}
  const code=extractCode2D(answer);
  if(!code)return fail('no_code','Gemini não retornou createScene válido.');
  const checked=checkCode2D(code);
  if(!checked.ok)return fail('invalid_code',checked.error);
  return {ok:true,model,code,thinkingLevel:'HIGH',duration,warnings:checked.warnings};
}
