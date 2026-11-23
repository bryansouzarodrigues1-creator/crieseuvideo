/**
 * Proposed customer-visible prices, NOT a payment integration.
 * A final checkout must bind {sku, priceCents, credits} exclusively on the
 * server and verify the provider webhook before minting video credits.
 */
export type PricingTierId='intro-2d'|'essential-2d'|'creative-2d'|'advanced-2d'|'premium-2d';
export type EffortBand='baixo'|'medio'|'alto'|'muito-alto';
export type Plan={
 id:PricingTierId;name:string;priceCents:number;credits:number;
 maxDurationSec:number;maxScenes:number;maxCharacters:number;
 maxResolution:'720p'|'1080p';effort:EffortBand;
 requiresLibrary:boolean;allowsPremiumAi:boolean;experimental:true;
 description:string;
};
export const PRICING_CATALOG:readonly Plan[]=[
 {id:'intro-2d',name:'Experimente 2D',priceCents:100,credits:3,maxDurationSec:15,maxScenes:2,maxCharacters:0,maxResolution:'720p',effort:'baixo',requiresLibrary:true,allowsPremiumAi:false,experimental:true,
  description:'3 vídeos curtos de motion graphics usando layouts e animações reutilizáveis. Sem TTS premium.'},
 {id:'essential-2d',name:'2D Essencial',priceCents:390,credits:1,maxDurationSec:20,maxScenes:3,maxCharacters:1,maxResolution:'720p',effort:'baixo',requiresLibrary:true,allowsPremiumAi:false,experimental:true,
  description:'Motion graphics com cenas mais personalizadas e narração opcional cobrada à parte.'},
 {id:'creative-2d',name:'2D Criativo',priceCents:990,credits:1,maxDurationSec:30,maxScenes:5,maxCharacters:2,maxResolution:'1080p',effort:'medio',requiresLibrary:true,allowsPremiumAi:false,experimental:true,
  description:'Roteiro, direção de cenas, câmeras e transições mais elaboradas.'},
 {id:'advanced-2d',name:'2D Avançado',priceCents:2490,credits:1,maxDurationSec:45,maxScenes:7,maxCharacters:3,maxResolution:'1080p',effort:'alto',requiresLibrary:false,allowsPremiumAi:true,experimental:true,
  description:'Personagens e objetos articulados, ações físicas e cenas de maior esforço.'},
 {id:'premium-2d',name:'Produção Premium 2D',priceCents:4990,credits:1,maxDurationSec:60,maxScenes:9,maxCharacters:4,maxResolution:'1080p',effort:'muito-alto',requiresLibrary:false,allowsPremiumAi:true,experimental:true,
  description:'Direção e validação mais detalhadas, com múltiplas cenas e revisões controladas.'},
] as const;

export function formatBrl(cents:number):string{
 if(!Number.isInteger(cents)||cents<0)throw new Error('Preço inválido.');
 return 'R$ '+(cents/100).toFixed(2).replace('.',',');
}
export function getPlan(id:PricingTierId):Plan{
 const p=PRICING_CATALOG.find(plan=>plan.id===id);
 if(!p)throw new Error('Plano desconhecido.');
 return p;
}
export type JobEffort={
 durationSeconds:number;scenes:number;characters:number;
 physicalInteractions:boolean;premiumAiRequested:boolean;
};
export function eligiblePlans(effort:JobEffort):PricingTierId[]{
 if(!Number.isInteger(effort.durationSeconds)||effort.durationSeconds<1||
 !Number.isInteger(effort.scenes)||effort.scenes<1||
 !Number.isInteger(effort.characters)||effort.characters<0)return [];
 return PRICING_CATALOG.filter(p=>
  effort.durationSeconds<=p.maxDurationSec&&
  effort.scenes<=p.maxScenes&&
  effort.characters<=p.maxCharacters&&
  (!effort.physicalInteractions||p.effort==='alto'||p.effort==='muito-alto')&&
  (!effort.premiumAiRequested||p.allowsPremiumAi)
 ).map(p=>p.id);
}
/** Invoice pricing belongs to the provider and verified server order, not UI. */
export function planPriceForVerifiedServerOrder(sku:PricingTierId):{amountCents:number;credits:number}{
 const p=getPlan(sku);
 return {amountCents:p.priceCents,credits:p.credits};
}
