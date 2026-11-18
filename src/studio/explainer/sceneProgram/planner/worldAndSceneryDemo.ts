/**
 * QA-only integration fixture. Creates 3 different sets of world materials,
 * object assemblies and motors from declarative data.
 *
 * No free-form raw geometry or scene-preset catalog is exposed to Gemini.
 * The demo authored JSON is replaceable by any new validated model output.
 */
import {normalizeSceneProgram,type SceneProgram} from '../score';
import {compileWorldScenery} from './worldScenery';
import {buildWorldBlueprintPreview} from './worldBlueprintDemo';
import type {MechanicalSetting} from './mechanicalScenarios';

function scenicProposal(setting:MechanicalSetting):unknown {
  if(setting==='workshop')return {
    version:1,regions:[
      {id:'garden-tree',sourceId:'s1',shape:'tree',size:[3.3],seed:3,
        color:'#866E51',foliage:'#47864D',position:[3.5,0,-2.8]},
      {id:'garden-rock',sourceId:'s1',shape:'rock',size:[1.2],seed:9,
        color:'#889696',position:[4.5,-.04,-1.8]},
      {id:'factory-cloud',sourceId:'s1',shape:'cloud',size:[2],seed:11,
        color:'#F0F3F0',position:[2.1,6,-8]}
    ]
  };
  if(setting==='city')return {
    version:1,regions:[
      {id:'city-tree-a',sourceId:'s1',shape:'tree',size:[3.2],seed:3,
        color:'#826C52',foliage:'#37794D',position:[-3.5,0,2.1]},
      {id:'city-tree-b',sourceId:'s1',shape:'tree',size:[2.7],seed:10,
        color:'#927657',foliage:'#498E62',position:[5.5,0,2.1]},
      {id:'sky-clouds',sourceId:'s1',shape:'cloud',size:[2.8],seed:6,
        color:'#E8F0F3',position:[2,6,-9]}
    ]
  };
  return {
    version:1,regions:[
      {id:'island',sourceId:'s1',shape:'terrain',size:[17,16,2.8],
        position:[5,-.48,-5],color:'#719E6E',peakColor:'#D0BC89',
        roughness:.7,seed:24,segments:24},
      {id:'sea',sourceId:'s1',shape:'water',size:[80,80],
        position:[0,-.18,0],color:'#357DA0',wave:.12,seed:5,segments:28},
      {id:'coast-trees',sourceId:'s1',shape:'tree',size:[2.7],
        color:'#806748',foliage:'#4B9660',seed:8,
        position:[0,0,0],scatter:{ground:'island',count:11,
          spread:[12,11],seed:17,minimumHeight:.5}},
      {id:'coast-rocks',sourceId:'s1',shape:'rock',size:[.8],
        color:'#8A9695',seed:14,
        position:[0,0,0],scatter:{ground:'island',count:4,
          spread:[14,12],seed:12,minimumHeight:.38}},
      {id:'sea-cloud',sourceId:'s1',shape:'cloud',size:[3.5],
        color:'#F0F3F3',seed:40,position:[1,5.5,-7]}
    ]
  };
}

export function buildWorldAndSceneryPreview(setting:MechanicalSetting) {
  const original=buildWorldBlueprintPreview(setting);
  // The previous harbor scene had a placeholder flat rectangle standing for
  // water. Remove it so real coastal relief/water can be the background.
  const omit=setting==='harbor'?new Set(['surface','distant-shore','shore-rock']):new Set<string>();
  const baseNodes=original.program.nodes.filter(n=>!omit.has(n.id)).map(n=>
    n.id==='surface'&&setting!=='harbor'
      ? {...n,geometry:{...n.geometry,shape:'box' as const,size:[95,.18,95]}}
      : n);
  const oldTracks=original.program.tracks.filter(t=>!omit.has(t.node));
  const scenery=compileWorldScenery(scenicProposal(setting),original.sources,baseNodes);
  const program=normalizeSceneProgram({
    ...original.program,
    nodes:[...baseNodes,...scenery.nodes],
    tracks:oldTracks
  },original.sources);
  return {...original,program,sceneryAudit:scenery.audit};
}
