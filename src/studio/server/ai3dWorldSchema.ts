/** Shared compact-world structured response contract for Gemini.
 * Data only: no user script, source IDs, executable code or private keys.
 * The stricter semantic checks still happen inside compileCompactWorld.
 */
const vector={type:'ARRAY',items:{type:'NUMBER'},minItems:3,maxItems:3} as const;
const detail={
  type:'OBJECT',properties:{
    id:{type:'STRING',description:'short lowercase identifier'},
    shape:{type:'STRING',enum:['box','sphere','cylinder','cone','torus']},
    size:{type:'ARRAY',items:{type:'NUMBER'},minItems:1,maxItems:3},
    at:vector,
    color:{type:'STRING',description:'optional #RRGGBB'},
  },required:['id','shape','size','at'],
} as const;
export const GEMINI_COMPACT_WORLD_SCHEMA={
  type:'OBJECT',
  properties:{
    version:{type:'INTEGER',enum:[1]},
    setting:{type:'STRING',enum:['city','industrial','coast','forest','interior','desert']},
    background:{type:'STRING',description:'six-digit hexadecimal sky color, e.g. #C9E2F4'},
    entities:{
      type:'ARRAY',minItems:2,maxItems:7,
      items:{
        type:'OBJECT',
        properties:{
          id:{type:'STRING',description:'unique lowercase ASCII identifier (max 18 chars)'},
          name:{type:'STRING',description:'descriptive object name'},
          kind:{type:'STRING',enum:[
            'building','crane','machine','vehicle','motorcycle','boat','cargo','tree','custom'
          ]},
          at:vector,
          size:vector,
          color:{type:'STRING',description:'six-digit hexadecimal, e.g. #E5A944'},
          details:{type:'ARRAY',items:detail,minItems:3,maxItems:12},
        },
        required:['id','name','kind','at','size','color'],
      },
    },
    action:{
      type:'OBJECT',
      properties:{
        target:{type:'STRING',description:'id of exactly one entity'},
        kind:{type:'STRING',enum:['move','lift','lower','drive','sail','rotate','open']},
        delta:vector,
      },
      required:['target','kind','delta'],
    },
  },
  required:['version','setting','background','entities','action']
} as const;
