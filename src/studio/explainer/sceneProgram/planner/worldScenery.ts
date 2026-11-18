/**
 * Adapter between Claude's UNMODIFIED scenery kit and the existing
 * Gemini worldBlueprints/SceneProgram renderer.
 *
 * The model specifies constrained scenery parameters, not thousands of
 * raw vertices, JS, remote URLs or a hardcoded "island video".
 *
 * v2 emits native procedural shapes. Water is updated by SceneProgram3D on
 * each timeline frame. Physics of waves and terrain-following actor navigation
 * remain separate work. Keep the original Claude source untouched.
 */
import {isKit,kitMesh,terrainHeight,type KitParams,type KitShape} from '../scenery';
import type {ProgramSource,Vec3} from '../score';

export class WorldSceneryError extends Error{
  readonly code='invalid_world_scenery';
}
const fail=(message:string):never=>{throw new WorldSceneryError(message);};
const object=(x:unknown,where:string):Record<string,unknown>=>
  x!==null&&typeof x==='object'&&!Array.isArray(x)
    ? x as Record<string,unknown>:fail(where+' precisa ser objeto JSON.');
const allowed=(r:Record<string,unknown>,keys:readonly string[],where:string)=>{
  const extra=Object.keys(r).find(k=>!keys.includes(k));
  if(extra)fail(where+' contém campo desconhecido: '+extra);
};
const arr=(x:unknown,max:number,where:string):unknown[]=>{
  if(!Array.isArray(x)||x.length>max)return fail(where+' não é lista válida ou excedeu limite.');
  if(Array.from({length:x.length},(_,i)=>i).some(i=>!(i in x)))fail(where+' contém item vazio.');
  return x;
};
const name=(x:unknown,where:string,max=24):string=>
  typeof x==='string'&&x.length<=max&&/^[a-z][a-z0-9_-]*$/.test(x)
    ? x:fail('Identificador inválido para '+where);
const num=(x:unknown,where:string,min:number,max:number,integer=false):number=>
  typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max&&(!integer||Number.isInteger(x))
    ? x:fail('Número fora do limite em '+where);
const vec=(x:unknown,where:string,range=100):Vec3=>{
  if(!Array.isArray(x)||x.length!==3)
    return fail('Vetor 3D inválido em '+where);
  return [num(x[0],where,-range,range),num(x[1],where,-range,range),
    num(x[2],where,-range,range)];
};
const rgb=(x:unknown,where:string):string=>
  typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)?x:fail('Cor hexadecimal inválida em '+where);
const maxSize:Record<KitShape,number>={terrain:3,water:2,tree:1,rock:1,cloud:1};
const staticLabels={terrain:'relevo',water:'água',tree:'árvore',rock:'pedra',cloud:'nuvem'};

interface Region{
  id:string;sourceId:string;shape:KitShape;position:Vec3;
  params:KitParams;scatter?:{ground:string;count:number;seed:number;spread:[number,number];minimumHeight:number};
}
export interface WorldSceneryResult{
  nodes:Record<string,unknown>[];
  audit:{
    environments:Array<{id:string;shape:KitShape;instances:number;vertices:number;sourceId:string}>;
    nodes:number;
    source:'Claude scenery kit (copied unchanged)';
    limitations:string;
  };
}
function parseRegions(input:unknown,sources:ProgramSource[]):Region[]{
  const root=object(input,'worldScenery');
  allowed(root,['version','regions'],'worldScenery');
  if(root.version!==1)fail('Versão do kit de cenários não reconhecida.');
  if(!Array.isArray(sources)||!sources.length)fail('Cenário sem roteiro.');
  const sourceSet=new Set(sources.map(x=>x.sourceId));
  const items=arr(root.regions,16,'regions');
  if(!items.length)fail('Cenário precisa de pelo menos uma região.');
  const ids=new Set<string>();
  return items.map((raw):Region=>{
    const r=object(raw,'region');
    allowed(r,['id','sourceId','shape','size','position','color','peakColor',
      'foliage','seed','roughness','wave','segments','scatter'],'region');
    const id=name(r.id,'region');
    if(ids.has(id))fail('IDs duplicados entre regiões: '+id);
    ids.add(id);
    const sourceId=name(r.sourceId,'sourceId',40);
    if(!sourceSet.has(sourceId))fail('Região cita uma frase inexistente.');
    const requestedShape=r.shape;
    if(typeof requestedShape!=='string'||!isKit(requestedShape))
      return fail('Forma procedural não autorizada.');
    const shape:KitShape=requestedShape;
    const sizeRaw=arr(r.size,maxSize[shape],'region.size');
    if(sizeRaw.length!==maxSize[shape])fail('O número de dimensões não corresponde à geometria.');
    const size=sizeRaw.map((x,i)=>num(x,'region.size['+i+']',.1,
      shape==='terrain'||shape==='water'?80:25));
    if(shape==='terrain'&&size[2]!>25)fail('Altura do terreno excede orçamento.');
    const position=r.position===undefined?[0,0,0] as Vec3:vec(r.position,'region.position');
    const seed=num(r.seed??1,'seed',0,2147483647,true);
    const roughness=num(r.roughness??.5,'roughness',0,1);
    const wave=num(r.wave??0,'wave',0,.8);
    const segments=num(r.segments??20,'segments',8,40,true);
    if(shape!=='water'&&wave!==0)fail('Ondas só podem pertencer à água.');
    if(!['terrain','water'].includes(shape)&&r.segments!==undefined)
      fail('Segmentos customizados só se aplicam a terreno e água.');
    const params:KitParams={shape,size,seed,roughness,wave,segments,
      color:rgb(r.color??'#849D76','color'),
      peakColor:rgb(r.peakColor??'#E6E0CC','peakColor'),
      foliage:rgb(r.foliage??'#468D52','foliage')};
    let scatter:Region['scatter'];
    if(r.scatter!==undefined){
      if(!['tree','rock'].includes(shape))fail('Distribuição no terreno somente para árvores e pedras.');
      const o=object(r.scatter,'scatter');
      allowed(o,['ground','count','seed','spread','minimumHeight'],'scatter');
      const spread=arr(o.spread,2,'scatter.spread');
      if(spread.length!==2)fail('A região de distribuição precisa de largura/profundidade.');
      scatter={ground:name(o.ground,'scatter.ground'),
        count:num(o.count,'scatter.count',1,20,true),
        seed:num(o.seed??seed,'scatter.seed',0,2147483647,true),
        spread:[num(spread[0],'scatter.width',.5,55),
          num(spread[1],'scatter.depth',.5,55)],
        minimumHeight:num(o.minimumHeight??.18,'scatter.minimumHeight',0,15)};
    }
    return {id,sourceId,shape,position,params,...(scatter?{scatter}:{})};
  });
}
function rng(seed:number){
  let value=seed||1;
  return ()=>{
    value=(Math.imul(value,1664525)+1013904223)>>>0;
    return value/4294967296;
  };
}
const geometry=(p:KitParams)=>{
  const m=kitMesh(p,0);
  if(m.positions.length%3||!m.positions.length||m.indices.length%3||!m.indices.length||
    m.positions.length>18000||m.indices.length>24000||
    m.positions.some(x=>!Number.isFinite(x))||
    m.indices.some(i=>!Number.isInteger(i)||i<0||i>=m.positions.length/3)||
    (m.colors&&m.colors.length!==m.positions.length))
    fail('Gerador procedural excedeu o orçamento de malha ou retornou geometria inválida.');
  return {shape:'mesh',vertices:m.positions,indices:m.indices,
    ...(m.colors?{colors:m.colors}:{})};
};

/** Keep the Claude primitives declarative in SceneProgram. The renderer can
 * re-sample water on each timeline frame and render terrain/tree vertex
 * colours without freezing the surface into a t=0 mesh. */
const runtimeGeometry=(p:KitParams):Record<string,unknown>=>({
  shape:p.shape,size:p.size,seed:p.seed,
  ...(p.shape==='terrain'?{roughness:p.roughness,peakColor:p.peakColor,segments:p.segments}:{}),
  ...(p.shape==='water'?{wave:p.wave,segments:p.segments}:{}),
  ...(p.shape==='tree'?{foliage:p.foliage}:{})
});

export function compileWorldScenery(
  raw:unknown,
  sources:ProgramSource[],
  existing:readonly {id:string}[]=[]
):WorldSceneryResult{
  const regions=parseRegions(raw,sources);
  const regionMap=new Map(regions.map(r=>[r.id,r]));
  const used=new Set(existing.map(n=>n.id));
  const nodes:Record<string,unknown>[]=[];
  const audit:WorldSceneryResult['audit']['environments']=[];
  let totalVertices=0,totalIndices=0;
  for(const region of regions){
    if(used.has(region.id))fail('Cenário reutiliza ID de objeto existente: '+region.id);
    used.add(region.id);
    const geo=geometry(region.params);
    let vertices=geo.vertices.length/3;
    let indices=geo.indices.length;
    const scatter=region.scatter;
    if(!scatter){
      nodes.push({id:region.id,kind:'mesh',contextSourceId:region.sourceId,
        color:region.params.color,position:region.position,geometry:runtimeGeometry(region.params)});
    }else{
      const ground=regionMap.get(scatter.ground);
      if(!ground||ground.shape!=='terrain'||ground.scatter)
        return fail('Distribuição exige terreno real não repetido no mesmo planejamento.');
      if(scatter.spread[0]>ground.params.size[0]||scatter.spread[1]>ground.params.size[1])
        fail('A distribuição ultrapassa o terreno que deveria sustentar as peças.');
      // All instances share the same parent. Their world-space placement is
      // a ground-height sample from Claude's exact terrain generator.
      nodes.push({id:region.id,kind:'group',contextSourceId:region.sourceId,
        position:[0,0,0]});
      const random=rng(scatter.seed);
      vertices=0;indices=0;
      for(let i=0;i<scatter.count;i++){
        let x=0,z=0,h=0,found=false;
        for(let tries=0;tries<50;tries++){
          x=(random()-.5)*scatter.spread[0]+region.position[0];
          z=(random()-.5)*scatter.spread[1]+region.position[2];
          const localX=x,localZ=z;
          h=terrainHeight(ground.params,localX,localZ);
          if(h>=scatter.minimumHeight){found=true;break;}
        }
        if(!found)fail('Não foi possível posicionar árvores/pedras acima da costa.');
        const id=region.id+'-'+i;
        if(id.length>40||used.has(id))fail('Instância criou ID inválido.');
        used.add(id);
        nodes.push({id,kind:'mesh',parent:region.id,contextSourceId:region.sourceId,
          color:region.params.color,
          position:[ground.position[0]+x,ground.position[1]+h+region.position[1],
            ground.position[2]+z],geometry:runtimeGeometry(region.params)});
        vertices+=geo.vertices.length/3;
        indices+=geo.indices.length;
      }
    }
    totalVertices+=vertices;totalIndices+=indices;
    if(totalVertices>160000||totalIndices>400000||
       nodes.length+existing.length>160)
      fail('Ambiente ultrapassa orçamento preventivo de geometria.');
    audit.push({id:region.id,shape:region.shape,
      instances:scatter?scatter.count:1,vertices,sourceId:region.sourceId});
  }
  return {nodes,audit:{environments:audit,nodes:nodes.length,
    source:'Claude scenery kit (copied unchanged)',
    limitations:'Formas procedurais preservadas no SceneProgram: a água é animada no renderer; árvores distribuídas usam altura estática amostrada. Não há física de ondas, navegação no relevo, nem garantia de qualidade cinematográfica.'}};
}
