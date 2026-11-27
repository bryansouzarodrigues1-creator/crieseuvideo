import {describe,it,expect} from 'vitest';
import {applySceneEdits,sceneInventory} from './editorialEdits';
import {normalizePlan} from './plan';
const base=()=>normalizePlan({scenes:[{text:'O motor gira.',visual:'custom',composition:'authored',drawing:[
{type:'rect',x:0,y:0,group:'motor'},{type:'poly',x:20,y:0,points:[[10,0],[30,0],[20,10]],group:'motor'}
],groups:[{id:'motor',x:0,y:0,motion:[{time:0},{time:2,rotation:90}]}]}]},'O motor gira.','9:16').scenes[0];
describe('bounded scene repairs',()=>{
 it('addresses stable snapshot IDs and moves group, members, polygon and pivot atomically',()=>{
  const scene=base(),before=JSON.stringify(scene);
  expect(sceneInventory(scene).shapes.map(s=>s.id)).toEqual(['shape_0','shape_1']);
  const after=applySceneEdits(scene,[{target:'group_motor',op:'move',dx:20,dy:30}]);
  expect(after.drawing?.map(s=>[s.x,s.y])).toEqual([[20,30],[40,30]]);
  expect(after.drawing?.[1].points).toEqual([[30,30],[50,30],[40,40]]);
  expect(after.groups?.[0]).toMatchObject({x:20,y:30,motion:scene.groups?.[0].motion});
  expect(after.text).toBe(scene.text);
  expect(JSON.stringify(scene)).toBe(before);
 });
 it('rejects nonexistent targets and disallowed operations without partial mutation',()=>{
  const scene=base(),before=JSON.stringify(scene);
  expect(()=>applySceneEdits(scene,[{target:'shape_0',op:'move',dx:10,dy:10},{target:'shape_99',op:'move',dx:1,dy:2}])).toThrow();
  expect(()=>applySceneEdits(scene,[{target:'shape_0',op:'eval',code:'anything'}])).toThrow();
  expect(()=>applySceneEdits(scene,[{target:'shape_0',op:'move',dx:301,dy:0}])).toThrow();
  expect(JSON.stringify(scene)).toBe(before);
 });
 it('preserves timing and edits camera independently',()=>{
  const scene={...base(),voice:{duration:4,start:0,end:4,continuousTrack:true as const}};
  const after=applySceneEdits(scene,[{target:'camera',op:'camera',shot:'push_in'}]);
  expect(after.voice).toBe(scene.voice);
  expect(after.camera).toBe('push_in');
 });
});

describe('motion and framing repair',()=>{
 it('resizes group preserving trajectory and pivots',()=>{
  const scene=base(),after=applySceneEdits(scene,[{target:'group_motor',op:'resize',factor:1.5}]);
  expect(after.groups?.[0].motion.map(k=>k.scale)).toEqual([1.5,1.5]);
  expect(after.groups?.[0].motion[1].rotation).toBe(90);
  expect(after.drawing).toEqual(scene.drawing);
  expect(scene.groups?.[0].motion[0].scale).toBe(1);
 });
 it('changes motion only on named target and rejects malformed tracks',()=>{
  const scene=base(),after=applySceneEdits(scene,[{target:'shape_0',op:'motion',motion:[{time:0},{time:2,dx:100,ease:'linear'}]}]);
  expect(after.drawing?.[0].motion?.[1].dx).toBe(100);
  expect(after.drawing?.[0].anim).toBe('none');
  expect(after.groups).toEqual(scene.groups);
  for(const motion of [[{time:0},{time:0}],[{time:0,dx:500}],[{time:-1}],[{time:1,scale:Infinity}],[{time:0,ease:'unknown'}]])
   expect(()=>applySceneEdits(scene,[{target:'group_motor',op:'motion',motion}])).toThrow();
 });
 it('retains fixed frame and rejects out-of-bounds values',()=>{
  const scene=base(),framing={x:0,y:80,zoom:1.2};
  const after=applySceneEdits(scene,[{target:'camera',op:'framing',framing}]);
  expect(after.framing).toEqual(framing);
  expect(normalizePlan({scenes:[after]},scene.text,'9:16').scenes[0].framing).toEqual(framing);
  expect(()=>applySceneEdits(scene,[{target:'camera',op:'framing',framing:{x:0,y:900,zoom:1}}])).toThrow();
 });
});

it('allows adding and removing support without mutating the original group',()=>{
 const scene=base(),support={anchorX:0,anchorY:60,surfaceY:200};
 const pinned=applySceneEdits(scene,[{target:'group_motor',op:'support',support}]);
 expect(pinned.groups?.[0].support).toEqual(support);
 expect(scene.groups?.[0].support).toBeUndefined();
 const moved=applySceneEdits(pinned,[{target:'group_motor',op:'move',dx:10,dy:20}]);
 expect(moved.groups?.[0].support).toEqual({anchorX:10,anchorY:80,surfaceY:200});
 expect(applySceneEdits(moved,[{target:'group_motor',op:'support',support:null}]).groups?.[0].support).toBeUndefined();
 expect(()=>applySceneEdits(scene,[{target:'group_motor',op:'support',support:{...support,surfaceY:999}}])).toThrow();
});
