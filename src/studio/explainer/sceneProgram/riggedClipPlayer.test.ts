import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RiggedClipPlayer, RiggedClipError, validateRiggedCues } from './riggedClipPlayer';

function fixture() {
  const root = new THREE.Group();
  const shoulder=new THREE.Bone();shoulder.name='Shoulder';root.add(shoulder);
  const wrist=new THREE.Bone();wrist.name='Wrist.R';shoulder.add(wrist);
  const other=new THREE.Bone();other.name='Wrist.L';shoulder.add(other);
  const make=(name:string,values:number[])=>new THREE.AnimationClip(
    name,1,[new THREE.VectorKeyframeTrack('Wrist.R.position',[0,1],values)]);
  const idle=make('Humanoid|Idle',[0,0,0, 0,0,0]);
  const walk=make('Humanoid|Walk',[0,0,0, 1,0,0]);
  const interact=make('Humanoid|Interact',[0,0,0, 0,1,0]);
  const player=new RiggedClipPlayer(root,[idle,walk,interact],[
    {start:0,clip:'Humanoid|Idle'},
    {start:1.5,clip:'Humanoid|Walk'},
    {start:3.5,clip:'Humanoid|Interact',loop:false},
  ]);
  return {root,wrist,player,idle,walk,interact};
}
describe('real Three.js AnimationMixer clip director',()=>{
  it('never activates 3 incompatible clips simultaneously',()=>{
    const {wrist,player}=fixture();
    player.at(.5); expect(wrist.position.x).toBeCloseTo(0);
    player.at(2);expect(wrist.position.x).toBeGreaterThan(.35);
    expect(wrist.position.y).toBeCloseTo(0);
    player.at(3.95);expect(wrist.position.y).toBeGreaterThan(.25);
    expect(wrist.position.x).toBeCloseTo(0);
  });
  it('is deterministic for arbitrary backwards/forwards absolute time seeks',()=>{
    const {wrist,player}=fixture();
    player.at(2.32);const expected=wrist.position.toArray();
    for(const t of [4.5,0,3.8,0,2.32])player.at(t);
    expect(wrist.position.toArray()).toEqual(expected);
  });
  it('returns the actual wrist bone and rejects wrong sockets',()=>{
    const {wrist,player}=fixture();
    expect(player.socket('rightHand')).toBe(wrist);
    expect(()=>player.socket('head')).toThrow(RiggedClipError);
  });
  it('rejects invented clips, invalid times and speed rather than guessing',()=>{
    const {idle,walk}=fixture();
    expect(()=>validateRiggedCues([idle,walk],[{start:0,clip:'made-up'}])).toThrow(/ausente/);
    expect(()=>validateRiggedCues([idle,walk],[{start:2,clip:'Humanoid|Idle'}])).toThrow(/começar em 0/);
    expect(()=>validateRiggedCues([idle,walk],[{start:0,clip:'Humanoid|Walk',speed:12}])).toThrow(/limite/);
  });
  it('changes to a chosen new sequence without URL access or dynamic code',()=>{
    const {player,wrist}=fixture();
    player.setCues([{start:0,clip:'Humanoid|Walk'}]);
    player.at(.6);
    expect(wrist.position.x).toBeGreaterThan(.5);
  });
});
