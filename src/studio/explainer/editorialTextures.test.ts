import {describe,it,expect} from 'vitest';
import {normalizeTexture,textureRandom,TEXTURES} from './editorialTextures';
import {normalizeDrawing} from './drawing';
import {normalizeBackdrop} from './editorialBackdrop';
import {normalizePlan} from './plan';
import {applySceneEdits} from './editorialEdits';
const texture={kind:'wood',seed:17,scale:1,opacity:.24};
describe('procedural editorial textures',()=>{
 it('validates all supported patterns and rejects invalid parameters',()=>{
  for(const kind of TEXTURES)expect(normalizeTexture({...texture,kind})).toEqual({...texture,kind});
  for(const bad of [{kind:'url(x)'},{seed:1.1},{seed:65536},{scale:Infinity},{opacity:1}])expect(normalizeTexture({...texture,...bad})).toBeUndefined();
 });
 it('produces deterministic, bounded pseudo-random samples',()=>{
  const samples=(seed:number)=>{const rnd=textureRandom(seed);return Array.from({length:100},()=>rnd());};
  expect(samples(17)).toEqual(samples(17));expect(samples(17)).not.toEqual(samples(18));
  expect(samples(17).every(x=>x>=0&&x<1)).toBe(true);
 });
 it('preserves textures in shapes and backdrops and supports reversible edits',()=>{
  const drawing=normalizeDrawing([{type:'rect',texture}])!;
  const backdrop=normalizeBackdrop({top:'#123456',bottom:'#654321',elements:[{type:'rect',color:'#aaaaaa',texture}]})!;
  expect(drawing[0].texture).toEqual(texture);
  expect(backdrop.elements[0].texture).toEqual(texture);
  const scene=normalizePlan({scenes:[{text:'Uma superfície.',visual:'custom',composition:'authored',drawing,backdrop}]},'Uma superfície.','9:16').scenes[0];
  const next=applySceneEdits(scene,[{target:'shape_0',op:'texture',texture:{...texture,kind:'metal'}}]);
  expect(next.drawing?.[0].texture?.kind).toBe('metal');
  expect(scene.drawing?.[0].texture?.kind).toBe('wood');
  expect(next.backdrop).toBe(scene.backdrop);
  expect(applySceneEdits(next,[{target:'shape_0',op:'texture',texture:null}]).drawing?.[0].texture).toBeUndefined();
 });
});