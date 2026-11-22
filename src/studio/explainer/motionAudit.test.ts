import {describe,expect,it} from 'vitest';
import {normalizePlan} from './plan';
import {motionAudit} from './motionAudit';
describe('Motion 2D Gemini authored movement audit',()=>{
 it('counts real pose changes but not static repeated keyframes',()=>{
  const input={title:'t',scenes:[
   {text:'A moeda vai até a conta.',visual:'custom',drawing:[
     {type:'coin',x:0,y:0,anim:'none',delay:0,motion:[{time:0,dx:-100},{time:2,dx:100}]},
     {type:'arrow',x:0,y:100,anim:'none',delay:0,motion:[{time:0,dx:0},{time:2,dx:0}]},
   ]},
   {text:'Agora aparece um carimbo.',visual:'custom',drawing:[
     {type:'stamp',x:0,y:0,anim:'pop',delay:0,text:'OK'}
   ]},
  ]};
  const plan=normalizePlan(input,'A moeda vai até a conta. Agora aparece um carimbo.','9:16');
  expect(motionAudit(plan)).toEqual({
   totalScenes:2,directedScenes:1,directedObjects:1,allObjects:3,coverage:.5
  });
 });
 it('reports zero for a legacy scene that only uses canned animation types',()=>{
  const p=normalizePlan({scenes:[{text:'Meu teste.',visual:'custom',drawing:[{type:'coin',x:0,y:0,anim:'bounce',delay:0}]}]},'Meu teste.','9:16');
  expect(motionAudit(p)).toMatchObject({directedScenes:0,directedObjects:0,allObjects:1});
 });
});
