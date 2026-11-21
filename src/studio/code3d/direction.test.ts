import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import runtime from './sceneToolsRuntime.js?raw';
import { normalizeDirection, narrationTimingSchema } from './direction';
import { prepareDirectedProgram } from '../server/directedProgram';

const script='Monte a caixa. Feche a tampa.';
const plan=()=>({version:1,duration:10,timing:'planned',objects:[{id:'box',description:'caixa de ferramentas',parts:['base','wall','lid']}],shots:[
  {id:'build',start:0,end:5,quote:'Monte a caixa.',subjects:['box'],focus:'box',camera:'detail',action:'as tábuas se encaixam sobre a base',before:'tábuas separadas da base',after:'caixa montada sem tampa'},
  {id:'close',start:5,end:10,quote:'Feche a tampa.',subjects:['box'],focus:'box',camera:'result',action:'a tampa fecha e assenta na caixa',before:'tampa acima da caixa',after:'tampa apoiada sem atravessar as paredes'},
]});
describe('direction data before any generated program execution',()=>{
  it('preserves object identity, script evidence and a complete ordered timeline',()=>{
    const direction=normalizeDirection(plan(),script);
    expect(direction.shots.map(s=>s.start)).toEqual([0,5]);
    expect(direction.shots.every(s=>s.subjects[0]==='box')).toBe(true);
    expect(direction.lessonVersion).toBe('spoken-actions-v1');
  });
  it('rejects a script told backwards even when the numerical shot intervals are ordered',()=>{
    const value=plan();value.shots[0].quote='Feche a tampa.';value.shots[1].quote='Monte a caixa.';
    expect(()=>normalizeDirection(value,script)).toThrow(/inverteram/);
  });
  it.each(['gap','overlap','unknown-subject','unknown-focus','invented-quote','duplicate-object','fake-alignment','reversed'])('rejects %s instead of hiding it in a playable scene',failure=>{
    const value=plan();
    if(failure==='gap')value.shots[1].start=6;
    if(failure==='overlap')value.shots[1].start=4;
    if(failure==='unknown-subject')value.shots[1].subjects=['other'];
    if(failure==='unknown-focus')value.shots[1].focus='other';
    if(failure==='invented-quote')value.shots[0].quote='O dragão explode a aldeia.';
    if(failure==='duplicate-object')value.objects.push(value.objects[0]);
    if(failure==='fake-alignment')value.timing='provided';
    if(failure==='reversed')value.shots.reverse();
    expect(()=>normalizeDirection(value,script)).toThrow();
  });
  it('derives times from actual word indices, including pauses, without pretending estimated times are measured',()=>{
    const timing={duration:10,words:[{text:'Monte',start:.1,end:.5},{text:'a',start:.6,end:.7},{text:'caixa.',start:.8,end:1.4},{text:'Feche',start:6.35,end:6.8},{text:'a',start:6.9,end:7},{text:'tampa.',start:7.1,end:7.5}]};
    const p=plan();p.timing='provided';
    const raw={...p,shots:p.shots.map((shot,i)=>({...shot,start:undefined,end:undefined,firstWord:i?3:0}))};
    expect(normalizeDirection(raw,script,timing).shots.map(s=>[s.start,s.end])).toEqual([[0,6.35],[6.35,10]]);
    expect(()=>normalizeDirection({...raw,shots:[{...raw.shots[0],end:5},raw.shots[1]]},script,timing)).toThrow(/inventou segundos/);
    expect(()=>normalizeDirection({...raw,shots:[raw.shots[0],{...raw.shots[1],firstWord:4}]},script,timing)).toThrow(/fala citada/);
    expect(()=>narrationTimingSchema.parse({...timing,words:[{text:'caixa',start:7,end:6}]})).toThrow();
  });
  it('requires code to consume the score, supplies it as data, and never evaluates the program while validating',()=>{
    const prefix='/*CRIESEUVIDEO_DIRECTION_V1\n'+JSON.stringify(plan())+'\n*/\n';
    const body='function createScene(){throw new Error("must not execute");const shots=DIRECTOR_SCORE.shots;}';
    const prepared=prepareDirectedProgram(prefix+body,script);
    expect(prepared.code).toContain('const DIRECTOR_SCORE = ');
    expect(()=>prepareDirectedProgram(prefix+'function createScene(){}',script)).toThrow(/ignorou/);
    expect(()=>prepareDirectedProgram(prefix+'const DIRECTOR_SCORE={};'+body,script)).toThrow(/substituir/);
  });
});

describe('rigid component assembly by absolute time',()=>{
  const tools=()=>new Function(runtime+';return createSceneTools;')()(THREE);
  it('keeps component dimensions, final fit and a positioned parent intact after out-of-order seeks',()=>{
    const t=tools(),parent=new THREE.Group();parent.position.set(8,2,-4);parent.rotation.y=.7;
    const part=new THREE.Mesh(new THREE.BoxGeometry(2,.2,1),new THREE.MeshBasicMaterial());part.position.set(0,1,0);part.scale.set(1.2,1,.8);parent.add(part);
    const originalParent=parent.position.toArray(),scale=part.scale.toArray();
    const motion=t.createAssemblyPart(part,{start:2,end:4,fromPosition:[-3,3,0],fromRotation:[0,0,.4]});
    motion.apply(1);expect(part.visible).toBe(false);
    motion.apply(3);const mid={p:part.position.toArray(),q:part.quaternion.toArray()};
    motion.apply(9);expect(part.position.toArray()).toEqual([0,1,0]);expect(part.scale.toArray()).toEqual(scale);
    motion.apply(.5);motion.apply(3);expect({p:part.position.toArray(),q:part.quaternion.toArray()}).toEqual(mid);
    expect(part.scale.toArray()).toEqual(scale);expect(parent.position.toArray()).toEqual(originalParent);
    motion.apply(4);expect(part.position.y).toBe(1);expect(part.quaternion.toArray()).toEqual([0,0,0,1]);
  });
  it('rejects impossible intervals and non-finite poses',()=>{
    const t=tools(),part=new THREE.Group();
    expect(()=>t.createAssemblyPart(part,{start:2,end:2})).toThrow();
    expect(()=>t.createAssemblyPart(part,{start:0,end:1,fromPosition:[Infinity,1,0]})).toThrow();
  });
});
