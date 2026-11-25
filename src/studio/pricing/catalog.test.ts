import {describe,it,expect} from 'vitest';
import {PRICING_CATALOG,eligiblePlans,formatBrl,getPlan,planPriceForVerifiedServerOrder} from './catalog';

describe('experimental 2D effort pricing',()=>{
 it('gives exactly three videos for R$1, and never enables premium AI on intro',()=>{
  const p=getPlan('intro-2d');
  expect(p.priceCents).toBe(100);
  expect(p.credits).toBe(3);
  expect(p.maxDurationSec).toBe(15);
  expect(p.maxScenes).toBe(2);
  expect(p.requiresLibrary).toBe(true);
  expect(p.allowsPremiumAi).toBe(false);
  expect(formatBrl(p.priceCents)).toBe('R$ 1,00');
 });
 it('increases pricing with typical complexity and duration',()=>{
  expect(PRICING_CATALOG.map(p=>p.priceCents)).toEqual([100,390,990,2490,4990]);
  expect(eligiblePlans({durationSeconds:12,scenes:2,characters:0,physicalInteractions:false,premiumAiRequested:false})).toContain('intro-2d');
  expect(eligiblePlans({durationSeconds:22,scenes:4,characters:2,physicalInteractions:false,premiumAiRequested:false})).toEqual(['creative-2d','advanced-2d','premium-2d']);
 });
 it('does not allow character scenes, physical interactions or premium AI for R$1',()=>{
  expect(eligiblePlans({durationSeconds:12,scenes:2,characters:1,physicalInteractions:false,premiumAiRequested:false})).not.toContain('intro-2d');
  expect(eligiblePlans({durationSeconds:10,scenes:1,characters:0,physicalInteractions:true,premiumAiRequested:false})).not.toContain('intro-2d');
  expect(eligiblePlans({durationSeconds:10,scenes:1,characters:0,physicalInteractions:false,premiumAiRequested:true})).not.toContain('intro-2d');
  expect(eligiblePlans({durationSeconds:62,scenes:12,characters:5,physicalInteractions:true,premiumAiRequested:true})).toEqual([]);
 });
 it('uses immutable server-side SKU values, not prices supplied by a browser',()=>{
  expect(planPriceForVerifiedServerOrder('intro-2d')).toEqual({amountCents:100,credits:3});
  expect(()=>getPlan('unexpected' as never)).toThrow();
  expect(()=>formatBrl(-1)).toThrow();
 });
});