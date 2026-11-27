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
