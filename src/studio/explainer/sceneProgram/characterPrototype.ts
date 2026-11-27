/**
 * Original articulated low-poly QA humanoid. Rigid segments, not a skinned
 * production character. Generated as a self-contained GLB with no paid APIs.
 * Axes: Y up, forward +Z, floor at y=0. Metres. Motions are in-place.
 */
export function makeCharacterPrototypeGLB(): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const views: Record<string, unknown>[] = [], accessors: Record<string, unknown>[] = [];
  let offset = 0;
  const add = (data: Float32Array | Uint16Array, type: string, count: number,
    min?: number[], max?: number[]) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4); padded.set(bytes);
    const bufferView = views.length;
    views.push({buffer:0, byteOffset:offset, byteLength:bytes.length});
    chunks.push(padded); offset += padded.length;
    const index = accessors.length;
    accessors.push({bufferView, componentType:data instanceof Float32Array?5126:5123,type,count,
      ...(min?{min}:{}),...(max?{max}:{})});
    return index;
  };
  // Shared cube mesh, per-face normals for crisp flat-shaded faces.
  const positions:number[]=[], normals:number[]=[], indices:number[]=[];
  const faces = [
    [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
    [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
    [[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
    [[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],
    [[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],
    [[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
  ];
  for(const [normal,...corners] of faces){
    const i=positions.length/3;
    for(const corner of corners){positions.push(...corner.map(x=>x*.5));normals.push(...normal);}
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  const pos=add(new Float32Array(positions),'VEC3',24,[-.5,-.5,-.5],[.5,.5,.5]);
  const norm=add(new Float32Array(normals),'VEC3',24);
  const ix=add(new Uint16Array(indices),'SCALAR',36);
  const palette=[[.13,.31,.47,1],[.8,.57,.39,1],[.11,.14,.2,1],[.045,.065,.09,1],[.23,.12,.06,1],[.94,.94,.94,1]];
  const materials=palette.map(baseColorFactor=>({pbrMetallicRoughness:{baseColorFactor,metallicFactor:0,roughnessFactor:.85}}));
  const meshes=palette.map((_,material)=>({primitives:[{attributes:{POSITION:pos,NORMAL:norm},indices:ix,material}]}));
  type Node={name:string;translation?:number[];scale?:number[];mesh?:number;children?:number[]};
  const nodes:Node[]=[];
  const node=(name:string,parent:number|null,translation:number[],scale?:number[],mesh?:number)=>{
    const i=nodes.length;nodes.push({name,translation,...(scale?{scale}:{}),...(mesh!==undefined?{mesh}:{})});
    if(parent!==null)(nodes[parent].children??=[]).push(i);
    return i;
  };
  const part=(name:string,parent:number,at:number[],size:number[],color:number)=>node(name,parent,at,size,color);
  const root=node('CharacterRoot',null,[0,0,0]);
  const hips=node('Hips',root,[0,.91,0]);
  part('Pelvis',hips,[0,0,0],[.32,.2,.23],2);
  const chest=node('Chest',hips,[0,.12,0]);
  part('Shirt',chest,[0,.21,0],[.42,.45,.25],0);
  const head=node('Head',chest,[0,.48,0]);
  part('Neck',head,[0,-.035,0],[.13,.12,.13],1);
  part('Face',head,[0,.18,0],[.32,.35,.29],1);
  part('Hair',head,[0,.355,-.018],[.34,.10,.31],4);
  for(const side of [-1,1]) {
    part('EyeWhite'+side,head,[side*.075,.20,.148],[.065,.043,.014],5);
    part('Pupil'+side,head,[side*.075,.20,.158],[.027,.03,.012],3);
  }
  part('Mouth',head,[0,.10,.151],[.09,.018,.012],4);
  const arms:number[]=[], elbows:number[]=[], legs:number[]=[], knees:number[]=[];
  for(const side of [-1,1]){
    const shoulder=node('Shoulder'+side,chest,[side*.25,.36,0]);arms.push(shoulder);
    part('Sleeve'+side,shoulder,[0,-.13,0],[.14,.27,.15],0);
    const elbow=node('Elbow'+side,shoulder,[0,-.26,0]);elbows.push(elbow);
    part('Forearm'+side,elbow,[0,-.115,0],[.11,.24,.12],1);
    part('Hand'+side,elbow,[0,-.26,0],[.12,.13,.12],1);
    const hip=node('Hip'+side,hips,[side*.095,-.07,0]);legs.push(hip);
    part('Thigh'+side,hip,[0,-.18,0],[.16,.36,.19],2);
    const knee=node('Knee'+side,hip,[0,-.36,0]);knees.push(knee);
    part('Shin'+side,knee,[0,-.16,0],[.13,.34,.15],2);
    part('Shoe'+side,knee,[0,-.42,.07],[.16,.12,.29],3);
  }
  const animations:Record<string,unknown>[]=[];
  const clip=(name:string,duration:number,tracks:{node:number;axis:'x'|'z';angles:number[]}[])=>{
    const samplers:Record<string,unknown>[]=[],channels:Record<string,unknown>[]=[];
    for(const track of tracks){
      const times=track.angles.map((_,i)=>i*duration/(track.angles.length-1));
      const input=add(new Float32Array(times),'SCALAR',times.length,[0],[duration]);
      const q=track.angles.flatMap(a=>track.axis==='x'?[Math.sin(a/2),0,0,Math.cos(a/2)]:[0,0,Math.sin(a/2),Math.cos(a/2)]);
      const output=add(new Float32Array(q),'VEC4',times.length);
      const sampler=samplers.length;samplers.push({input,output,interpolation:'LINEAR'});
      channels.push({sampler,target:{node:track.node,path:'rotation'}});
    }
    animations.push({name,samplers,channels});
  };
  clip('idle',2,[{node:chest,axis:'z',angles:[0,.035,0,-.035,0]}]);
  clip('walk',1.2,[
    ...legs.map((n,i)=>({node:n,axis:'x' as const,angles:[0,.48*(i?1:-1),0,-.48*(i?1:-1),0]})),
    ...knees.map((n,i)=>({node:n,axis:'x' as const,angles:[0,i?.08:.55,0,i?.55:.08,0]})),
    ...arms.map((n,i)=>({node:n,axis:'x' as const,angles:[0,-.38*(i?1:-1),0,.38*(i?1:-1),0]})),
  ]);
  clip('wave',2,[{node:arms[1],axis:'z',angles:[0,1.45,1.45,1.45,0]},
    {node:elbows[1],axis:'z',angles:[0,.5,-.5,.5,0]}]);
  const gltf={asset:{version:'2.0',generator:'CrieSeuVideo original QA'},scene:0,scenes:[{nodes:[root]}],nodes,
    meshes,materials,animations,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
  const json=new TextEncoder().encode(JSON.stringify(gltf));
  const jsonSize=Math.ceil(json.length/4)*4;
  const result=new ArrayBuffer(28+jsonSize+offset),v=new DataView(result),bytes=new Uint8Array(result);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,result.byteLength,true);
  v.setUint32(12,jsonSize,true);v.setUint32(16,0x4e4f534a,true);
  bytes.fill(32,20,20+jsonSize);bytes.set(json,20);
  const bin=20+jsonSize;v.setUint32(bin,offset,true);v.setUint32(bin+4,0x004e4942,true);
  let cursor=bin+8;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
  return result;
}
