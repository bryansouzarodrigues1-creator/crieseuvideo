/**
 * Generic generative 3D object grammar. LLMs design PARTS and recognizable
 * features instead of directly writing dozens of disconnected SceneProgram
 * meshes. No topic templates, JS evaluation, remote assets or paid AI calls.
 *
 * The output is intentionally built from supported SceneProgram primitives.
 * The existing normalizeSceneProgram remains the final geometry/budget guard.
 * Scenery-kit support can be integrated separately without forking its branch.
 */
import type { ProgramSource, Vec3 } from '../score';

export type WorldObjectRole = 'prop'|'mechanism'|'environment';
export interface WorldObjectQA {
  id:string; role:WorldObjectRole; sourceId:string;
  features:string[]; parts:number; mirrored:number;
}
export interface CompiledWorldBlueprint {
  nodes:Record<string,unknown>[];
  audit:{objects:WorldObjectQA[]; totalNodes:number; constraints:string};
}

export class WorldBlueprintError extends Error {
  readonly code='invalid_world_blueprint';
}
const bad=(message:string):never=>{throw new WorldBlueprintError(message);};
const record=(v:unknown,where:string):Record<string,unknown>=>
  v!==null && typeof v==='object' && !Array.isArray(v)
    ? v as Record<string,unknown>:bad(where+' precisa ser um objeto.');
const only=(r:Record<string,unknown>,keys:string[],where:string)=>{
  const badKey=Object.keys(r).find(k=>!keys.includes(k));
  if(badKey)bad(where+' contém campo não suportado: '+badKey);
};
const list=(v:unknown,max:number,where:string):unknown[]=>{
  if(!Array.isArray(v)||v.length>max) return bad(where+' ultrapassou o limite ou não é uma lista.');
  for(let i=0;i<v.length;i++)if(!(i in v))bad(where+' possui entrada vazia.');
  return v;
};
const identifier=(v:unknown,where:string,max=18):string=>
  typeof v==='string' && v.length<=max && /^[a-z][a-z0-9_-]*$/.test(v)
    ? v:bad('Identificador inválido em '+where);
const smallText=(v:unknown,where:string,max=90):string=>
  typeof v==='string' && v.trim().length>=3 && v.length<=max
    ? v.trim():bad('Descrição ausente ou extensa em '+where);
const color=(v:unknown):string=>
  typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:bad('Cor precisa ser RGB hexadecimal.');
const vec3=(v:unknown,where:string,min=-180,max=180):Vec3=>{
  if(!Array.isArray(v)||v.length!==3||v.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<min||x>max))
    return bad('Vetor 3D inválido em '+where);
  return [...v] as Vec3;
};
const optional=(x:unknown,def:Vec3,where:string,min=-180,max=180):Vec3=>
  x===undefined?[...def]:vec3(x,where,min,max);
const nonZeroVec=(v:Vec3,where:string)=>{
  if(v.some(n=>n<=0))bad(where+' requer escala positiva.');
};
const permittedShapes=new Set(['box','sphere','capsule','cone','cylinder','plane','torus','tube','lathe']);
const arity:Record<string,number>={box:3,sphere:1,capsule:2,cone:2,cylinder:3,plane:2,torus:2,tube:1};

function geometry(raw:unknown,where:string):Record<string,unknown>{
  const g=record(raw,where);
  only(g,['shape','size','profile','points','segments','bevel','bevelSegments'],where);
  if(!permittedShapes.has(String(g.shape)))return bad('Geometria não parametrizada/permitida em '+where);
  const shape=g.shape as string;
  if(shape==='lathe'){
    if(g.size!==undefined||g.points!==undefined||g.bevel!==undefined||g.bevelSegments!==undefined)
      bad('Lathe recebe somente perfil e segmentos.');
    const profile=list(g.profile,32,where+'.profile').map(v=>{
      if(!Array.isArray(v)||v.length!==2||v.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>40)||v[0]<0)
        return bad('Perfil de revolução inválido.');
      return [...v] as [number,number];
    });
    if(profile.length<2)return bad('O objeto lathe precisa de perfil real, não uma esfera substituta.');
    const segments=g.segments===undefined?24:g.segments;
    if(typeof segments!=='number'||!Number.isInteger(segments)||segments<8||segments>48)
      bad('Segmentos da revolução fora do limite.');
    return {shape:'lathe',profile,segments};
  }
  if(g.profile!==undefined)bad('Perfil de revolução não pertence à geometria '+shape);
  const len=arity[shape];
  const values=list(g.size,len,where+'.size');
  if(values.length!==len||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>80))
    return bad('Dimensões inválidas na geometria.');
  if(values.some(v=>v===0)&&shape!=='cylinder')
    return bad('Malha degenerada (dimensão nula).');
  const result:Record<string,unknown>={shape,size:[...values]};
  if(shape==='tube'){
    const points=list(g.points,32,where+'.points');
    if(points.length<2)bad('Tubulação precisa de caminho 3D.');
    result.points=points.map((v,i)=>vec3(v,where+'.point'+i,-80,80));
  }else if(g.points!==undefined)bad('Pontos personalizados só são permitidos em tubo.');
  if(shape==='box'&&g.bevel!==undefined){
    if(typeof g.bevel!=='number'||!Number.isFinite(g.bevel)||g.bevel<0||g.bevel>4)
      bad('Arredondamento inválido.');
    result.bevel=g.bevel;
    if(g.bevelSegments!==undefined){
      if(typeof g.bevelSegments!=='number'||!Number.isInteger(g.bevelSegments)||
         g.bevelSegments<1||g.bevelSegments>6)bad('Divisões de chanfro inválidas.');
      result.bevelSegments=g.bevelSegments;
    }
  }else if(g.bevel!==undefined||g.bevelSegments!==undefined)
    bad('Apenas caixas podem receber chanfro.');
  if(g.segments!==undefined)bad('Este tipo de geometria não admite segments.');
  return result;
}

function material(raw:unknown):Record<string,unknown>{
  const m=record(raw,'material');
  only(m,['roughness','metalness','opacity','emissive','emissiveIntensity'],'material');
  const r:Record<string,unknown>={};
  for(const k of ['roughness','metalness','opacity','emissiveIntensity']){
    if(m[k]===undefined)continue;
    const v=m[k];
    if(typeof v!=='number'||!Number.isFinite(v)||v<(k==='opacity'?.05:0)||
      v>(k==='emissiveIntensity'?3:1))bad('Componente de material fora dos limites: '+k);
    r[k]=v;
  }
  if(m.emissive!==undefined)r.emissive=color(m.emissive);
  return r;
}
function repeat(raw:unknown):Record<string,unknown>{
  const r=record(raw,'repeat');
  only(r,['count','step','jitter','seed'],'repeat');
  if(typeof r.count!=='number'||!Number.isInteger(r.count)||r.count<1||r.count>80)
    bad('Número de instâncias não pode ultrapassar 80.');
  const seed=r.seed??1;
  if(typeof seed!=='number'||!Number.isInteger(seed)||seed<0||seed>2147483647)
    bad('Semente procedural inválida.');
  return {count:r.count,step:optional(r.step,[0,0,0],'step'),
    jitter:optional(r.jitter,[0,0,0],'jitter',0,40),seed};
}

export function compileWorldBlueprints(
  raw:unknown,
  sources:ProgramSource[],
  existingNodes:readonly {id:string}[]=[]
):CompiledWorldBlueprint {
  const root=record(raw,'worldBlueprints');
  only(root,['version','objects'],'worldBlueprints');
  if(root.version!==1)bad('Versão de composição 3D desconhecida.');
  if(!Array.isArray(sources)||!sources.length)
    bad('O desenho não possui trechos de roteiro.');
  const sourcesSet=new Set(sources.map(s=>s.sourceId));
  const objects=list(root.objects,24,'objects');
  if(!objects.length)bad('Não foram propostos objetos ou cenários.');
  const used=new Set(existingNodes.map(n=>n.id));
  const output:Record<string,unknown>[]=[];
  const audit:WorldObjectQA[]=[];
  for(const rawObject of objects){
    const o=record(rawObject,'worldObject');
    only(o,['id','role','sourceId','name','position','rotation','scale','features','parts'],'worldObject');
    const objId=identifier(o.id,'objectId');
    if(used.has(objId))bad('Objeto duplicado na cena: '+objId);
    const role=o.role;
    if(!['prop','mechanism','environment'].includes(String(role)))
      bad('Função do objeto deve ser prop, mechanism ou environment.');
    const sourceId=identifier(o.sourceId,'sourceId',40);
    if(!sourcesSet.has(sourceId))bad('Objeto cita trecho de roteiro inexistente.');
    smallText(o.name,'object.name');
    const features=list(o.features,12,'features').map(x=>identifier(x,'feature',18));
    if(features.length<(role==='environment'?1:2)||
       new Set(features).size!==features.length)
      bad('O objeto precisa listar características visuais distintas.');
    const parts=list(o.parts,18,'parts');
    if(parts.length<(role==='environment'?1:2))
      bad('Objeto sem partes suficientes para ser reconhecível.');
    const position=optional(o.position,[0,0,0],'object.position');
    const rotation=optional(o.rotation,[0,0,0],'object.rotation',-Math.PI*2,Math.PI*2);
    const scale=optional(o.scale,[1,1,1],'object.scale',.01,50);nonZeroVec(scale,'object.scale');
    const rootNode={id:objId,kind:'group',contextSourceId:sourceId,position,rotation,scale};
    output.push(rootNode);used.add(objId);
    const partIds=new Set<string>(),partMap=new Map<string,Record<string,unknown>>();
    let mirrored=0,visible=0;
    const covered=new Set<string>();
    for(const rawPart of parts){
      const p=record(rawPart,'part');
      only(p,['id','parent','kind','feature','position','rotation','scale','color',
        'geometry','material','repeat','mirror'],'part');
      const partId=identifier(p.id,'part.id',16);
      if(partIds.has(partId))bad('Parte duplicada dentro do objeto '+objId);
      const partKind=p.kind===undefined?'mesh':p.kind;
      if(!['mesh','group'].includes(String(partKind)))bad('Parte não é mesh nem group.');
      const feature=p.feature===undefined?undefined:identifier(p.feature,'part.feature');
      if(partKind==='mesh'&&(!feature||!features.includes(feature)))
        bad('Cada peça visível deve corresponder a uma característica visual declarada.');
      if(feature&&!features.includes(feature))bad('Parte descreve característica inexistente.');
      const parent=p.parent===undefined?undefined:identifier(p.parent,'part.parent',16);
      const localPos=optional(p.position,[0,0,0],'part.position',-100,100);
      const localRot=optional(p.rotation,[0,0,0],'part.rotation',-Math.PI*2,Math.PI*2);
      const localScale=optional(p.scale,[1,1,1],'part.scale',.01,40);nonZeroVec(localScale,'part.scale');
      const partColor=color(p.color??'#C8A579');
      const shape=partKind==='mesh'?geometry(p.geometry,'part.geometry'):undefined;
      if(partKind==='group'&&(p.geometry!==undefined||p.material!==undefined||p.repeat!==undefined||p.mirror!==undefined))
        bad('Apenas peças visíveis admitem geometria, material, repetição e espelhamento.');
      const sym=p.mirror;
      if(sym!==undefined&&!['x','z'].includes(String(sym)))
        bad('Espelhamento deve ser no eixo X ou Z.');
      if(sym&&parent)bad('Espelhamento automático vale apenas para partes filhas do objeto raiz.');
      if(sym&&p.repeat!==undefined)bad('Evite combinar espelhamento e repetição na mesma peça.');
      if(sym&&Math.abs(localPos[sym==='x'?0:2])<.02)
        bad('Peça espelhada precisa estar fora do plano central.');
      const id=objId+'-'+partId;
      if(id.length>40||used.has(id))bad('Identificador de parte muito longo ou duplicado.');
      const part:Record<string,unknown>={
        id,kind:partKind,contextSourceId:sourceId,
        parent:parent?objId+'-'+parent:objId,
        position:localPos,rotation:localRot,scale:localScale,color:partColor,
        ...(shape?{geometry:shape}:{}),
        ...(p.material!==undefined?{material:material(p.material)}:{}),
        ...(p.repeat!==undefined?{repeat:repeat(p.repeat)}:{})
      };
      used.add(id);partIds.add(partId);partMap.set(partId,part);output.push(part);
      if(partKind==='mesh'){visible++;covered.add(feature!);}
      if(sym){
        const mirroredPos:[number,number,number]=[...localPos];
        const mirroredRot:[number,number,number]=[...localRot];
        const index=sym==='x'?0:2;
        mirroredPos[index]*=-1;
        // A reflected orientation is represented by a second positive-scale
        // mesh; negative-scale geometry can corrupt face winding/shadows.
        if(index===0){mirroredRot[1]*=-1;mirroredRot[2]*=-1;}
        else {mirroredRot[0]*=-1;mirroredRot[1]*=-1;}
        const cloneId=id+'-m';
        if(cloneId.length>40||used.has(cloneId))bad('Espelhamento criou identificador duplicado.');
        const twin={...part,id:cloneId,position:mirroredPos,rotation:mirroredRot};
        used.add(cloneId);output.push(twin);mirrored++;
      }
    }
    for(const p of partMap.values()){
      const parent=p.parent as string;
      if(parent!==objId&&!partMap.has(parent.slice(objId.length+1)))
        bad('Peça aponta para grupo pai inexistente.');
      if(parent!==objId && partMap.get(parent.slice(objId.length+1))?.kind!=='group')
        bad('Somente grupo pode ter peças filhas.');
      const ancestors=new Set([p.id]);
      let next=parent;
      while(next!==objId){
        if(ancestors.has(next))bad('Partes formaram hierarquia circular.');
        ancestors.add(next);
        next=partMap.get(next.slice(objId.length+1))?.parent as string;
        if(!next)bad('Hierarquia 3D incompleta.');
      }
    }
    if(visible<(role==='environment'?1:2)||
       features.some(f=>!covered.has(f)))
      bad('Objeto sem as partes reconhecíveis prometidas no projeto visual.');
    audit.push({id:objId,role:role as WorldObjectRole,
      sourceId,features,parts:visible,mirrored});
    if(output.length>150)bad('Cena excede orçamento preventivo de nós 3D.');
  }
  if(output.length+existingNodes.length>160)
    bad('Cena excede o limite total de 160 nós.');
  return {nodes:output,audit:{
    objects:audit,totalNodes:output.length,
    constraints:'Montagem parametrizada, features cobertas e IDs persistentes; não é prova de semântica, física ou qualidade cinematográfica. Requer normalização e revisão visual.'
  }};
}
