/** Carry the user's script into the actual advanced 3D builder, without
 * placing the script in the URL or sending it to an AI without consent. */
export const AI3D_HANDOFF_KEY = 'crieseuvideo.ai3d.handoff.v1';
export type Ai3DHandoff = {
  script:string;
  fullScriptLength:number;
  aspect:'9:16'|'16:9';
  wantsNarration:boolean;
  voice:string;
};
export function prepareAi3DHandoff(
  script:string,aspect:'9:16'|'16:9',wantsNarration:boolean,voice:string
):Ai3DHandoff {
  const clean=script.trim();
  // AI3D currently accepts two or three sentences and at most 750 characters.
  // Never silently lose the user's full text: its length is shown in the target UI.
  const sentences=(clean.match(/[^.!?…]+[.!?…]?/g)||[]).map(s=>s.trim()).filter(Boolean);
  const chosen=sentences.slice(0,Math.min(sentences.length,3)).join(' ');
  const candidate=chosen.length<=750?chosen:sentences.slice(0,2).join(' ');
  return {
    script:candidate.length<=750?candidate:clean.slice(0,750),
    fullScriptLength:clean.length,
    aspect,
    wantsNarration,
    voice:voice.slice(0,80),
  };
}
export function isAi3DHandoff(raw:unknown):raw is Ai3DHandoff {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const h=raw as Record<string,unknown>;
  return typeof h.script==='string'&&h.script.length<=750&&
    typeof h.fullScriptLength==='number'&&Number.isInteger(h.fullScriptLength)&&
    h.fullScriptLength>=h.script.length&&h.fullScriptLength<=60000&&
    (h.aspect==='9:16'||h.aspect==='16:9')&&
    typeof h.wantsNarration==='boolean'&&
    typeof h.voice==='string'&&h.voice.length<=80;
}
export function saveAi3DHandoff(storage:Pick<Storage,'setItem'>,handoff:Ai3DHandoff){
  storage.setItem(AI3D_HANDOFF_KEY,JSON.stringify(handoff));
}
export function takeAi3DHandoff(storage:Pick<Storage,'getItem'|'removeItem'>):Ai3DHandoff|null{
  const raw=storage.getItem(AI3D_HANDOFF_KEY);
  storage.removeItem(AI3D_HANDOFF_KEY);
  if(!raw)return null;
  try{
    const parsed:unknown=JSON.parse(raw);
    return isAi3DHandoff(parsed)?parsed:null;
  }catch{return null;}
}
