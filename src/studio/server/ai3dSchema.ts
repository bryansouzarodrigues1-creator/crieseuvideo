/**
 * The tiny model-authored scene recipe that our procedural SceneProgram3D
 * compiler accepts. Gemini gets a responseSchema matching this shape rather
 * than JSON mode alone (which only promises syntactically valid JSON).
 *
 * The schema is a MODEL HINT, never the security boundary. Every returned
 * value is still checked by compileCompactWorld before it can reach Three.js.
 */
export function gemini3DResponseSchema(sourceIds:readonly string[]) {
  if(sourceIds.length<1 || sourceIds.length>3 ||
    sourceIds.some(id=>!/^s[1-3]$/.test(id)) ||
    new Set(sourceIds).size!==sourceIds.length)
    throw new Error('A sequência precisa de 1 a 3 IDs de narração distintos.');

  // Nested array bounds caused a confirmed HTTP 400 (too many schema states).
  // Keep lengths in the prompt and strict compileCompactWorld validation.
  const vec = {type:'ARRAY',items:{type:'NUMBER'}};
  const detail = {
    type:'OBJECT',
    properties:{
      id:{type:'STRING'},shape:{type:'STRING',enum:['box','sphere','cylinder','cone','torus']},
      size:{type:'ARRAY',items:{type:'NUMBER'}},
      at:vec,color:{type:'STRING'},
    },
    required:['id','shape','size','at'],
  };
  return {
    type:'OBJECT',
    properties:{
      version:{type:'INTEGER'},
      setting:{type:'STRING',enum:['city','industrial','coast','forest','interior','desert']},
      background:{type:'STRING'},
      entities:{
        type:'ARRAY',
        items:{
          type:'OBJECT',
          properties:{
            id:{type:'STRING'},name:{type:'STRING'},
            kind:{type:'STRING',enum:['building','crane','machine','vehicle','motorcycle','boat','cargo','gate','tree','custom']},
            at:vec,size:vec,color:{type:'STRING'},
            details:{type:'ARRAY',items:detail},
          },
          required:['id','name','kind','at','size','color'],
        },
      },
      actions:{
        type:'ARRAY',
        items:{
          type:'OBJECT',
          properties:{
            sourceId:{type:'STRING',enum:[...sourceIds]},target:{type:'STRING'},
            kind:{type:'STRING',enum:['move','lift','lower','drive','sail','rotate','open']},
            delta:vec,
          },
          required:['sourceId','target','kind','delta'],
        },
      },
    },
    required:['version','setting','background','entities','actions'],
  };
}

const isObject=(x:unknown):x is Record<string,unknown> =>
  !!x&&typeof x==='object'&&!Array.isArray(x);

/** Only remove a full Markdown code fence; do not attempt unsafe JSON repair. */
export function parseAi3DScene(text:string):Record<string,unknown>|null{
  if(!text || text.length>480_000)return null;
  const trimmed=text.trim();
  const fenced=trimmed.match(/^\x60{3}(?:json)?\s*\n([\s\S]*?)\n?\x60{3}$/i);
  try{
    const obj:unknown=JSON.parse(fenced?fenced[1]:trimmed);
    if(!isObject(obj))return null;
    // Some chat APIs return a single JSON envelope. Unwrap ONLY if it is
    // the sole top-level key; unknown metadata or executable code is rejected
    // downstream by compileCompactWorld's strict allowlist.
    const keys=Object.keys(obj);
    if(keys.length===1&&['scene','plan','world'].includes(keys[0])){
      const inside=obj[keys[0]];
      return isObject(inside)?inside:null;
    }
    return obj;
  }catch{
    return null;
  }
}
