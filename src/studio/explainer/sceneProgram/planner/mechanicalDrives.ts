/**
 * Topic-independent mechanical motion contract.
 *
 * A visual wheel, winding drum or gear MUST rotate because its associated
 * output travels, not because an LLM invented an unrelated revolution count.
 * This is kinematic coupling, not a force/torque or collision solver.
 */
import type { ProgramNode, ProgramTrack, Vec3 } from '../score';

export type DriveAxis = 'x'|'y'|'z';
export interface MechanicalPart {
  /** A real rotating SceneProgram node, usually parented to a mechanism. */
  node: string;
  axis: DriveAxis;
  /** Positive for forward, negative for counter-rotation; can model gearing. */
  ratio: number;
}
export interface MechanicalDrive {
  /** Semantic prop controlled by the mechanism (platform, vehicle, belt...). */
  output: string;
  /** Effective wheel/drum radius in metres. A larger radius turns less. */
  radius: number;
  /** Unit direction of powered travel: reverse travel reverses shaft rotation. */
  travelDirection: Vec3;
  /** Every coupled rotating mesh/bone pivot, not just a painted prop. */
  parts: MechanicalPart[];
}
export type MechanicalDrives = Record<string, MechanicalDrive>;

export interface PreparedDrive {
  mechanism: string;
  output: string;
  radius: number;
  travelDirection: Vec3;
  parts: MechanicalPart[];
}

export const linearDistance = (a:Vec3,b:Vec3) => Math.hypot(
  b[0]-a[0],b[1]-a[1],b[2]-a[2]);

export function coupledAngle(from:Vec3,to:Vec3,radius:number,ratio:number,travelDirection?:Vec3):number {
  if (!Number.isFinite(radius)||radius<.03||radius>20)
    throw new Error('Raio físico do eixo/roda fora dos limites.');
  if (!Number.isFinite(ratio)||ratio===0||Math.abs(ratio)>12)
    throw new Error('Relação de engrenagens inválida.');
  const travel=linearDistance(from,to);
  if (!Number.isFinite(travel)||travel>180)
    throw new Error('Deslocamento mecânico inválido.');
  let signedDistance=travel;
  if(travelDirection){
    if(!Array.isArray(travelDirection)||travelDirection.length!==3||
       travelDirection.some(x=>!Number.isFinite(x)))
      throw new Error('Direção mecânica inválida.');
    const norm=Math.hypot(...travelDirection);
    if(norm<.99||norm>1.01)
      throw new Error('Direção mecânica precisa ter comprimento unitário.');
    signedDistance=((to[0]-from[0])*travelDirection[0]+
      (to[1]-from[1])*travelDirection[1]+
      (to[2]-from[2])*travelDirection[2])/norm;
    if(travel>1e-5 && Math.abs(signedDistance)<.85*travel)
      throw new Error('A carga saiu do eixo físico controlado pela máquina.');
  }
  // Signed radians = projected travel / wheel radius * gear ratio.
  return signedDistance/radius*ratio;
}

/** Validate before authoring tracks, including prohibition of contradictory shafts. */
export function prepareMechanicalDrives(
  drives: MechanicalDrives|undefined,
  nodes: ProgramNode[],
  tracks: ProgramTrack[],
  entities: Array<{id:string;kind:string;controls?:string[]}>,
  entityNodes: Record<string,string>
):PreparedDrive[] {
  if (!drives) return [];
  if (typeof drives!=='object'||Array.isArray(drives))
    throw new Error('Máquinas declaradas fora do formato de mapa.');
  const nodeMap=new Map(nodes.map(n=>[n.id,n]));
  const entityMap=new Map(entities.map(e=>[e.id,e]));
  const usedParts=new Set<string>();
  const output:PreparedDrive[]=[];
  if(Object.keys(drives).length>24)throw new Error('Mecanismos demais num filme.');
  for(const [mechanism,raw] of Object.entries(drives)){
    const parent=entityMap.get(mechanism);
    if(parent?.kind!=='mechanism')throw new Error('Acionador mecânico não existe na história.');
    const body=entityNodes[mechanism];
    const movingRoot=entityNodes[raw.output];
    if(!body||!nodeMap.has(body)||!movingRoot||!nodeMap.has(movingRoot))
      throw new Error('Acionador ou carga não possui nó 3D válido.');
    if(!entityMap.get(raw.output)||!parent.controls?.includes(raw.output))
      throw new Error('A máquina não controla esta carga.');
    if(!Array.isArray(raw.parts)||!raw.parts.length||raw.parts.length>8)
      throw new Error('Uma máquina precisa de peças rotativas reais.');
    if(!Number.isFinite(raw.radius)||raw.radius<.03||raw.radius>20)
      throw new Error('Raio mecânico fora dos limites.');
    if(!Array.isArray(raw.travelDirection)||raw.travelDirection.length!==3||
       raw.travelDirection.some(x=>!Number.isFinite(x))||
       Math.abs(Math.hypot(...raw.travelDirection)-1)>.01)
      throw new Error('Direção do deslocamento da máquina deve ser unitária.');
    for(const part of raw.parts){
      if(typeof part?.node!=='string'||!['x','y','z'].includes(part.axis)||
         !Number.isFinite(part.ratio)||part.ratio===0||Math.abs(part.ratio)>12)
        throw new Error('Peça de transmissão possui eixo/relação inválidos.');
      const node=nodeMap.get(part.node);
      if(!node||usedParts.has(part.node))
        throw new Error('Engrenagem ausente ou usada em duas transmissões.');
      if(part.node===body||part.node===movingRoot)
        throw new Error('Não gire a máquina inteira nem a carga como se fossem engrenagens.');
      // A rotating part must belong to the machine or to its moving output
      // (e.g., wheels on a vehicle). Orphaned geometry creates the illusion
      // that unconnected objects power a mechanism.
      const belongs=(root:string)=>{
        let current:ProgramNode|undefined=node;
        while(current?.parent){
          if(current.parent===root)return true;
          current=nodeMap.get(current.parent);
        }
        return false;
      };
      if(!belongs(body)&&!belongs(movingRoot))
        throw new Error('Eixo rotativo não está ligado à máquina nem à carga.');
      if(tracks.some(t=>t.node===part.node&&t.channel==='rotation'))
        throw new Error('O eixo mecânico possui rotação contraditória programada à mão.');
      usedParts.add(part.node);
    }
    output.push({
      mechanism,output:raw.output,radius:raw.radius,
      travelDirection:[...raw.travelDirection],
      parts:raw.parts.map(p=>({...p}))
    });
  }
  return output;
}
