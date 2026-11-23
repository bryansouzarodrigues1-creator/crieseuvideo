import {describe,it,expect} from 'vitest';
import {compileSceneSpec,cueTime,resolveSvgBounds,validateSceneSpec} from './sceneSpec';
import {pizzariaSpec} from './pizzariaSpec';
describe('Cinema 2D SceneSpec',()=>{
 it('aceita a simulação declarativa e 750 pontos',()=>{
  expect(validateSceneSpec(pizzariaSpec)).toEqual([]);
  const e=compileSceneSpec(pizzariaSpec);
  const base=e.find(x=>x.id==='base_500')!;
  const extra=e.find(x=>x.id==='extra_250')!;
  expect(Number(base.props.cols)*Number(base.props.rows)).toBe(500);
  expect(Number(extra.props.cols)*Number(extra.props.rows)).toBe(250);
  expect(e.find(x=>x.id==='counter_20k')!.enterTime).toBe(9.5);
 });
 it('resolve entrada na palavra real',()=>expect(cueTime({atWord:1,duration:.2,preset:'fade'},[{word:'a',start:0,end:.2},{word:'clientes',start:1.234,end:1.64}])).toBe(1.234));
 it('rejeita índice de palavra inexistente',()=>expect(()=>cueTime({atWord:4,duration:.2,preset:'fade'},[{word:'a',start:0,end:.2}])).toThrow());
 it('protege as margens 9:16',()=>{
  const area=pizzariaSpec.project.safeArea;
  expect(resolveSvgBounds({x:90,y:300,width:700,height:400},area)).toBe(true);
  expect(resolveSvgBounds({x:900,y:300,width:200,height:400},area)).toBe(false);
 });
});
