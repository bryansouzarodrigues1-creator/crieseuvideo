/**
 * Shared, browser-safe preflight for AI-authored 3D scenes.
 * Keep exactly the same acceptance rules in the editor and server.
 * No network access and no paid AI calls.
 */
export interface SourceBrief {sourceId:string;text:string;duration:number}

export class AiWorldDirectionError extends Error {
  readonly code='ai_3d_direction_invalid';
}
const reject=(reason:string):never=>{throw new AiWorldDirectionError(reason)};

/** Sentence endings OR separate lines; a natural one-sentence request is valid. */
export function splitSceneSentences(script:string):string[]{
  return script.trim()
    .replace(/\r\n?/g,'\n')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map(s=>s.replace(/\s+/g,' ').trim())
    .filter(Boolean);
}

export function sourceBriefsFromScript(script:string):SourceBrief[]{
  if(typeof script!=='string'||script.length>750)
    reject('Roteiro longo demais para uma sequência. Use até 750 caracteres.');
  const trimmed=script.trim().replace(/\s+/g,' ');
  if(trimmed.length<45)
    reject('Descreva cenário e ação em pelo menos 45 caracteres. Nenhum crédito será usado.');
  const sentences=splitSceneSentences(script);
  if(sentences.length<1||sentences.length>3)
    reject('Esta geração aceita de 1 a 3 frases ou linhas. Separe histórias longas em episódios menores.');
  if(sentences.some(s=>s.length<12||s.length>350))
    reject('Cada frase ou linha precisa ter de 12 a 350 caracteres. Divida os trechos muito longos em até 3 etapas.');
  // One natural sentence is an 8s single-shot scene. With two/three distinct
  // beats, the engine uses one 4s shot per beat, preserving the user's words.
  return sentences.map((text,i)=>({
    sourceId:'s'+(i+1),text,duration:sentences.length===1?8:4
  }));
}

export type SceneScriptCheck =
  | {ok:true;count:number;duration:number;description:string}
  | {ok:false;count:0;duration:0;description:string};

export function checkSceneScript(script:string):SceneScriptCheck{
  try{
    const sources=sourceBriefsFromScript(script);
    return {
      ok:true,count:sources.length,
      duration:sources.reduce((sum,s)=>sum+s.duration,0),
      description:sources.length===1
        ? 'Descrição válida: será uma cena de aproximadamente 8 segundos com uma câmera. Para problema e solução em tomadas diferentes, escreva 2 ou 3 frases ou linhas.'
        : `Roteiro válido: ${sources.length} etapas, aproximadamente ${sources.length*4} segundos. A geração ainda exige conta conectada e autorização de créditos.`
    };
  }catch(error){
    return {ok:false,count:0,duration:0,
      description:error instanceof Error?error.message:'Roteiro inválido. Revise o texto.'};
  }
}
