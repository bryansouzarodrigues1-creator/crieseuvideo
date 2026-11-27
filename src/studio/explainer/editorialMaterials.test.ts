import {describe,it,expect} from 'vitest';
import {normalizeMaterial,normalizeContactShadow} from './editorialMaterials';
import {normalizeDrawing} from './drawing';
import {normalizeGroups} from './editorialGroups';
import {normalizePlan} from './plan';
import {applySceneEdits} from './editorialEdits';
const material={kind:'linear',light:'#F4D78A',dark:'#A86A32',angle:90};
const shadow={width:320,height:24,opacity:.35};
describe('editorial materials',()=>{
 it('normalizes safe gradients and rejects arbitrary CSS or invalid angles',()=>{
  expect(normalizeMaterial(material)).toEqual(material);
  expect(normalizeMaterial({...material,light:'url(test)'})).toBeUndefined();
  expect(normalizeMaterial({...material,angle:Infinity})).toBeUndefined();
  expect(normalizeDrawing([{type:'rect',material}])?.[0].material).toEqual(material);
 });
 it('keeps shadows only on supported groups',()=>{
  const group={id:'box',x:0,y:0,motion:[{time:0}],shadow};
  expect(normalizeGroups([group])[0].shadow).toBeUndefined();
  expect(normalizeGroups([{...group,support:{anchorX:0,anchorY:60,surfaceY:60}}])[0].shadow).toEqual(shadow);
  expect(normalizeContactShadow({...shadow,opacity:1})).toBeUndefined();
 });
 it('repairs materials without changing geometry and removes shadow with support',()=>{
  const s=normalizePlan({scenes:[{text:'Uma caixa.',visual:'custom',composition:'authored',drawing:[{type:'rect',group:'box'},{type:'circle',group:'box'}],groups:[{id:'box',x:0,y:0,motion:[{time:0}],support:{anchorX:0,anchorY:60,surfaceY:60}}]}]},'Uma caixa.','9:16').scenes[0];
  const after=applySceneEdits(s,[{target:'shape_0',op:'material',material},{target:'group_box',op:'shadow',shadow}]);
  expect(after.drawing?.[0].material).toEqual(material);
  expect(after.groups?.[0].shadow).toEqual(shadow);
  expect(after.drawing?.[0].x).toBe(s.drawing?.[0].x);
  expect(s.drawing?.[0].material).toBeUndefined();
  expect(applySceneEdits(after,[{target:'group_box',op:'support',support:null}]).groups?.[0].shadow).toBeUndefined();
 });
});