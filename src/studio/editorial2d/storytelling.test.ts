import {describe,it,expect} from 'vitest';
import {storytellingOvos} from './storytellingOvosSpec';
import {storytellingLoja} from './storytellingLojaSpec';
import {sceneAt,validateStory,renderActor2DSvg,iconGridPositions,renderIconGridSvg,formatCurrency} from './storytelling';
describe('Storytelling 2D',()=>{
 it('has a contiguous, safe 42-second script',()=>{
  expect(validateStory(storytellingOvos)).toEqual([]);
  expect(sceneAt(storytellingOvos,0).id).toBe('hook');
  expect(sceneAt(storytellingOvos,18).id).toBe('calculation');
  expect(sceneAt(storytellingOvos,42).id).toBe('outro');
 });
 it('reuses the same components for a different narrative',()=>{
  expect(validateStory(storytellingLoja)).toEqual([]);
  expect(sceneAt(storytellingLoja,16).id).toBe('custos');
  expect(storytellingLoja.scenes.find(s=>s.id==='custos')?.blocks.some(b=>b.type==='equation')).toBe(true);
  expect(storytellingLoja.scenes.find(s=>s.id==='vendas')?.blocks.some(b=>b.type==='cash_register')).toBe(true);
  const eq=storytellingLoja.scenes.find(s=>s.id==='custos')?.blocks.find(b=>b.type==='equation');
  expect(eq?.type==='equation'&&eq.chart==='split_bar').toBe(true);
 });
 it('creates precise icon-grid counts',()=>{
  expect(iconGridPositions(5,5,0,0,20,20)).toHaveLength(5);
  const points=iconGridPositions(702,26,100,300,16,16);
  expect(points).toHaveLength(702);
  expect(new Set(points.map(p=>p.x+':'+p.y)).size).toBe(702);
  const spec=storytellingOvos.scenes[1].blocks[0];
  if(spec.type!=='icon_grid')throw new Error('Fixture changed');
  expect((renderIconGridSvg(spec).match(/data-icon-index=/g)||[]).length).toBe(20);
 });
 it('never mirrors names or shirt numbers even when character faces left',()=>{
  const actor={id:'a',x:540,y:800,scale:1,facing:'left' as const,pose:'pointing' as const,bodyColor:'#112233',skinColor:'#ffe0c1',shirtLabel:'3'};
  const svg=renderActor2DSvg(actor);
  expect(svg).toContain('class="actor-shape" transform="scale(-1 1)"');
  expect(svg.indexOf('</g><text class="actor-label"')).toBeGreaterThan(0);
  expect(svg).toContain('>3</text>');
 });
 it('escapes user-supplied SVG labels',()=>{
  const html=renderActor2DSvg({id:'evil',x:540,y:700,scale:1,facing:'right',pose:'idle',bodyColor:'#112233',skinColor:'#ffe0c1',shirtLabel:'<script>'});
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
 });
 it('formats money consistently',()=>expect(formatCurrency(180)).toContain('180'));
 it('rejects broken scene continuity',()=>{
  const broken={...storytellingOvos,scenes:storytellingOvos.scenes.map((x,i)=>i===2?{...x,start:19}:x)};
  expect(validateStory(broken).some(x=>x.includes('Gap or overlap'))).toBe(true);
 });
});
