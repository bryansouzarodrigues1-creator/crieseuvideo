import {describe,expect,it} from 'vitest';
import {normalizeSceneProgram,type ProgramSource} from './score';
import {SceneProgram3D} from './stage3d';
import {terrainHeight} from './scenery';

const sources:ProgramSource[]=[{
  sourceId:'s1',text:'O explorador atravessa uma ilha com declives.',duration:4
}];
const terrain={
  id:'island',kind:'mesh',contextSourceId:'s1',position:[5,0,-2],
  color:'#59916A',geometry:{
    shape:'terrain',size:[30,30,4],seed:12,roughness:.7,segments:20
  }
};
const person={
  id:'hiker',kind:'actor',contextSourceId:'s1',position:[3,0,-2],
  color:'#D4A568',groundTo:'island'
};
const motion={
  node:'hiker',channel:'position',interpolation:'linear',
  keys:[{sourceId:'s1',phase:0,value:[3,0,-2]},
        {sourceId:'s1',phase:1,value:[9,0,1]}]
};
const raw=(nodes:unknown[]=[terrain,person],tracks:unknown[]=[motion])=>({
  version:1,background:'#AACCEE',nodes,tracks,
  shots:[{sourceId:'s1',subjects:['island','hiker'],
    azimuth:.4,elevation:.2,distance:1.2}],contacts:[]
});
describe('optional actor groundTo: follow actual Claude terrain',()=>{
  it('samples terrain height every frame without overwriting horizontal authored motion',()=>{
    const scene=normalizeSceneProgram(raw(),sources);
    const stage=new SceneProgram3D(scene,sources);
    try {
      let first=0,last=0;
      for(const t of [0,1,2,3,4]){
        stage.update(t);
        const pos=stage.nodes.get('hiker')!.position;
        const expected=terrainHeight({size:[30,30,4],seed:12,roughness:.7},
          pos.x-5,pos.z+2);
        expect(pos.y).toBeCloseTo(expected,5);
        expect(pos.x).toBeCloseTo(3+6*t/4,5);
        if(t===0)first=pos.y;
        if(t===4)last=pos.y;
      }
      expect(first).not.toBeCloseTo(last,3);
    }finally{stage.dispose();}
  });

  it('leaves existing actors unchanged when groundTo is absent',()=>{
    const unbound={...person,groundTo:undefined};
    const stage=new SceneProgram3D(normalizeSceneProgram(raw([terrain,unbound]),sources),sources);
    try{
      stage.update(2);
      expect(stage.nodes.get('hiker')!.position.y).toBe(0);
    }finally{stage.dispose();}
  });

  it('rejects nonexistent, rotated, scaled, moving or parented terrain anchors',()=>{
    expect(()=>normalizeSceneProgram(raw([terrain,{...person,groundTo:'ghost'}]),sources))
      .toThrow(/terreno estático/);
    expect(()=>normalizeSceneProgram(raw([{...terrain,rotation:[0,.2,0]},person]),sources))
      .toThrow(/terreno estático/);
    expect(()=>normalizeSceneProgram(raw([{...terrain,scale:[2,1,1]},person]),sources))
      .toThrow(/terreno estático/);
    expect(()=>normalizeSceneProgram(raw([terrain,person,{
      id:'parent',kind:'group',contextSourceId:'s1'
    }].map(n=>n.id==='island'?{...n,parent:'parent'}:n)),sources))
      .toThrow(/terreno estático/);
    const moving={node:'island',channel:'position',interpolation:'linear',
      keys:[{sourceId:'s1',phase:0,value:[5,0,-2]},
            {sourceId:'s1',phase:1,value:[5,1,-2]}]};
    expect(()=>normalizeSceneProgram(raw(undefined,[motion,moving]),sources))
      .toThrow(/terreno de apoio/);
  });

  it('does not silently leave the island when an actor exits its bounds',()=>{
    const outside={...motion,keys:[
      {sourceId:'s1',phase:0,value:[3,0,-2]},
      {sourceId:'s1',phase:1,value:[100,0,1]}
    ]};
    const stage=new SceneProgram3D(normalizeSceneProgram(raw(undefined,[outside]),sources),sources);
    try{expect(()=>stage.update(4)).toThrow(/saiu do limite/);}
    finally{stage.dispose();}
  });
});
