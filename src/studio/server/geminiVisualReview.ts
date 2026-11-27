import {z} from 'zod';
import {compileCompactWorld,compactWorldPrompt} from '../explainer/sceneProgram/planner/compactWorldDirector';
import {sourceBriefsFromScript} from '../explainer/sceneProgram/planner/sceneScript';
import {compileSceneProgram} from '../explainer/sceneProgram/score';
import {readGeminiErrorDiagnostic,formatGeminiCause} from './geminiFailure';

export const visualReviewInput=z.object({
  script:z.string().min(45).max(750),
  plan:z.record(z.unknown()).refine(p=>JSON.stringify(p).length<=40000),
  frames:z.array(z.object({time:z.number().finite().min(0).max(12),
    mimeType:z.enum(['image/jpeg','image/png']),
    data:z.string().min(32).max(250000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }).strict()).min(3).max(7),
  confirmCost:z.literal(true),
}).strict();
export type VisualReviewInput=z.infer<typeof visualReviewInput>;
const output=z.object({issues:z.array(z.string().min(1).max(300)).max(6),correctedPlan:z.record(z.unknown()).nullable()}).strict();
type Entity={id:string;kind:string;at:number[];size:number[]};
type Action={sourceId?:string;target:string;kind:string;onto?:string};
const signature=(p:Record<string,unknown>)=>{
  const entities=p.entities as Entity[];
  const actions=(p.actions??[p.action]) as Action[];
  return JSON.stringify({entities:entities.map(e=>[e.id,e.kind]).sort((a,b)=>a[0].localeCompare(b[0])),actions:actions.map(a=>[a.sourceId??null,a.target,a.kind,a.onto??null])});
};
// Sample actual compiled motion against platform decks, not just endpoint coordinates.
// The platform legs/other objects and full collision detection remain outside this check.
export function countDeckIntersections(plan:Record<string,unknown>,clip:ReturnType<typeof compileCompactWorld>){
  const entities=plan.entities as Entity[];
  const cargo=entities.filter(e=>e.kind==='cargo'),platforms=entities.filter(e=>e.kind==='platform');
  if(!cargo.length||!platforms.length)return 0;
  const animation=compileSceneProgram(clip.program,clip.sources);
  let count=0;
  for(let i=0;i<=Math.ceil(clip.duration*10);i++){
    const state=animation.sample(Math.min(i/10,clip.duration));
    for(const c of cargo)for(const p of platforms){
      const cp=state.get(c.id)?.position??c.at,pp=state.get(p.id)?.position??p.at;
      const top=pp[1]+p.size[1],bottom=top-.20;
      const overlapsXZ=Math.abs(cp[0]-pp[0])<(c.size[0]*.47+p.size[0]*.5-.025)&&Math.abs(cp[2]-pp[2])<(c.size[2]*.47+p.size[2]*.5-.025);
      if(overlapsXZ&&cp[1]+c.size[1]*.99>bottom+.025&&cp[1]+c.size[1]*.05<top-.025)count++;
    }
  }
  return count;
}
export async function reviewVisualScene(input:VisualReviewInput){
  const data=visualReviewInput.parse(input);
  const sources=sourceBriefsFromScript(data.script);
  const original=compileCompactWorld(data.plan,sources);
  if(data.frames.some((f,i)=>f.time>original.duration||i>0&&f.time<=data.frames[i-1].time))throw Error('Quadros fora de ordem ou da duração da cena.');
  const originalHits=countDeckIntersections(data.plan,original);
  const key=process.env.GEMINI_API_KEY;
  if(!key)throw Error('GEMINI_API_KEY não configurada.');
  const instructions=[
    'Você é o revisor visual de uma animação 3D. Examine os quadros cronológicos reais anexados, o roteiro e o plano. Procure objetos atravessando outros, flutuação, enquadramento ruim, movimento incoerente e aparência pouco clara.',
    'Não aceite uma cena só porque o JSON é válido. Corrija coordenadas, dimensões, cores ou detalhes quando necessário. Preserve todos os IDs, tipos de entidades, alvos e ordem/tipos das ações, incluindo onto e sourceId. Não invente objetos ou ações nesta rodada.',
    'Se houver carga atravessando tablado, afaste a posição inicial da carga do tablado e recalcule deslocamentos para pousar no destino sem atravessar. Respeite alcance do braço da grua e altura do gancho.',
    'Retorne JSON exatamente {"issues":["problema visual com tempo e descrição"],"correctedPlan":{...plano completo corrigido...}}. Se nenhuma correção suportada for necessária, correctedPlan:null. No máximo 6 problemas. Não produza código, markdown ou explicações fora do JSON.',
    'Amostras com possível interseção carga/tablado detectadas pelo motor: '+originalHits+'. Reduza a zero se presentes.',
    compactWorldPrompt(sources),'Plano original como dados: '+JSON.stringify(data.plan),
  ].join('\n');
  const parts:Array<{text:string}|{inlineData:{mimeType:string;data:string}}>=[{text:instructions}];
  for(const frame of data.frames)parts.push({text:'Quadro em '+frame.time.toFixed(2)+' segundos:'},{inlineData:{mimeType:frame.mimeType,data:frame.data}});
  let res:Response;
  try{
    res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{
      method:'POST',signal:AbortSignal.timeout(65000),headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'high'},maxOutputTokens:8192}}),
    });
  }catch{throw Error('Falha de rede ou tempo esgotado na revisão visual. Cena original preservada.');}
  if(!res.ok){const d=await readGeminiErrorDiagnostic(res);throw Error('Gemini revisão visual: HTTP '+res.status+'. '+formatGeminiCause(d));}
  const raw=await res.json();
  const c=raw.candidates?.[0];
  if(c?.finishReason!=='STOP')throw Error('Revisão visual incompleta. Cena original preservada.');
  const content=(c.content?.parts??[]).filter((p:any)=>typeof p.text==='string'&&!p.thought).map((p:any)=>p.text).join('');
  let reviewed:z.infer<typeof output>;
  try{if(content.length>60000)throw Error();reviewed=output.parse(JSON.parse(content));}catch{throw Error('Resposta da revisão visual inválida. Cena original preservada.');}
  const report={issues:reviewed.issues,originalHits,correctedHits:originalHits,model:'gemini-3.6-flash',frames:data.frames.length};
  if(!reviewed.correctedPlan)return {...report,status:'unchanged' as const,reason:'A IA não entregou uma alteração; confira os problemas indicados.'};
  try{
    const plan=reviewed.correctedPlan;
    const clip=compileCompactWorld(plan,sources);
    if(signature(data.plan)!==signature(plan))throw Error('A correção alterou a identidade ou sequência da história.');
    const correctedHits=countDeckIntersections(plan,clip);
    if(correctedHits>0)throw Error('Ainda existe interseção entre carga e tablado.');
    if(JSON.stringify(data.plan)===JSON.stringify(plan))return {...report,status:'unchanged' as const,reason:'O plano não mudou.'};
    return {...report,correctedHits,status:'corrected' as const,plan,clip};
  }catch{return {...report,status:'rejected' as const,reason:'A correção não passou nas regras do motor ou alterou a história. Cena original preservada.'};}
}
