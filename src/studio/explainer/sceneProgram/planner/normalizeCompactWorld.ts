/**
 * Normalize harmless naming differences in model-authored scene JSON.
 * Never invent an action, create new entities, execute code, or erase
 * unexpected fields. The strict compiler validates the result afterwards.
 */
type JsonObject=Record<string,unknown>;
const obj=(x:unknown):x is JsonObject=>!!x&&typeof x==='object'&&!Array.isArray(x);
const ascii=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const enumMap:Record<string,string>={
  predio:'building',edificio:'building',house:'building',structure:'building',
  construction:'building',warehouse:'building',tower:'building',
  guindaste:'crane',grua:'crane',hoist:'crane',
  maquina:'machine',engine:'machine',motor:'machine',
  carro:'vehicle',car:'vehicle',truck:'vehicle',caminhao:'vehicle',
  moto:'motorcycle',motorbike:'motorcycle',bike:'motorcycle',
  navio:'boat',ship:'boat',vessel:'boat',barco:'boat',
  caixa:'cargo',load:'cargo',container:'cargo',crate:'cargo',
  arvore:'tree',arvores:'tree',
  object:'custom',prop:'custom',
  industrial:'industrial',factory:'industrial',construction_site:'industrial',
  cidade:'city',urban:'city',
  port:'coast',harbor:'coast',mar:'coast',ocean:'coast',porto:'coast',
  floresta:'forest',jungle:'forest',nature:'forest',
  room:'interior',inside:'interior',sala:'interior',
  desert:'desert',deserto:'desert',
  levantar:'lift',subir:'lift',raise:'lift',
  abaixar:'lower',descer:'lower',drop:'lower',
  mover:'move',translate:'move',
  dirigir:'drive',travel:'drive',
  navegar:'sail',swim:'sail',
  girar:'rotate',turn:'rotate',spin:'rotate',
  abrir:'open',
};
const colorNames:Record<string,string>={
  red:'#D7554B',vermelho:'#D7554B',blue:'#558DBC',azul:'#558DBC',
  green:'#55936C',verde:'#55936C',yellow:'#D6B447',amarelo:'#D6B447',
  orange:'#DD9252',laranja:'#DD9252',gray:'#89959C',grey:'#89959C',
  cinza:'#89959C',white:'#F0F1EC',branco:'#F0F1EC',black:'#343A40',preto:'#343A40',
  brown:'#947557',marrom:'#947557',beige:'#CBB69B',
};
function color(x:unknown):unknown{
  if(typeof x!=='string')return x;
  const s=x.trim();
  if(/^#[a-f\d]{3}$/i.test(s))return '#'+[...s.slice(1)].map(ch=>ch+ch).join('').toUpperCase();
  return colorNames[ascii(s)]||s;
}
function ren(o:JsonObject, canonical:string, aliases:string[]){
  if(o[canonical]!==undefined)return;
  for(const alias of aliases){
    if(o[alias]!==undefined){
      o[canonical]=o[alias];delete o[alias];return;
    }
  }
}
const vector=(x:unknown)=>{
  if(obj(x)&&['x','y','z'].every(key=>typeof x[key]==='number'))
    return [x.x,x.y,x.z];
  return x;
};
function name(x:unknown):unknown{
  if(typeof x!=='string')return x;
  const k=ascii(x);
  return enumMap[k]||k;
}
/** Original identifiers are retained when safe; references are renamed together. */
export function normalizeCompactWorldOutput(input:unknown):unknown{
  if(!obj(input))return input;
  // Some providers wrap the required JSON in a single "scene"/"plan" object.
  const selected=(!('entities' in input) && !('objects' in input) &&
    (obj(input.plan)?input.plan:obj(input.scene)?input.scene:obj(input.world)?input.world:undefined))||input;
  if(!obj(selected))return input;
  const out:JsonObject={...selected};
  ren(out,'entities',['objects']);
  ren(out,'background',['skyColor','sky_color','backgroundColor']);
  ren(out,'setting',['environment','sceneType']);
  if(out.version==='1')out.version=1;
  out.setting=name(out.setting);
  out.background=color(out.background);
  const idMap=new Map<string,string>();
  if(Array.isArray(out.entities)){
    out.entities=out.entities.map((raw:unknown)=>{
      if(!obj(raw))return raw;
      const o={...raw};
      ren(o,'id',['objectId','entityId']);
      ren(o,'kind',['type','category']);
      ren(o,'name',['label','title']);
      ren(o,'at',['position','location']);
      ren(o,'size',['dimensions','scale']);
      ren(o,'color',['colour','materialColor']);
      o.kind=name(o.kind);
      o.color=color(o.color);
      o.at=vector(o.at);
      o.size=vector(o.size);
      if(Array.isArray(o.details))o.details=o.details.map((part:unknown)=>{
        if(!obj(part))return part;
        const p={...part};
        ren(p,'at',['position','offset']);
        ren(p,'size',['dimensions']);
        ren(p,'shape',['geometry','type']);
        p.at=vector(p.at);
        p.color=color(p.color);
        return p;
      });
      if(typeof o.id==='string'){
        const cleaned=ascii(o.id).replace(/[^a-z0-9_-]/g,'_').replace(/^[^a-z]+/,'a').slice(0,18);
        if(cleaned){idMap.set(o.id,cleaned);o.id=cleaned;}
      }
      return o;
    });
  }
  ren(out,'action',['animation','motion']);
  if(obj(out.action)){
    const a={...out.action};
    ren(a,'target',['objectId','entityId','object','entity']);
    ren(a,'kind',['type','movement','verb']);
    ren(a,'delta',['displacement','change']);
    a.kind=name(a.kind);
    a.delta=vector(a.delta);
    if(typeof a.target==='string'&&idMap.has(a.target))a.target=idMap.get(a.target);
    out.action=a;
  }
  return out;
}
