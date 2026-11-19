import {describe,expect,it} from 'vitest';
import {compileCompactWorld} from './compactWorldDirector';
import {normalizeCompactWorldOutput} from './normalizeCompactWorld';
import {sourceBriefsFromScript} from './aiWorldDirector';
import {parseJson} from '../../../server/ai';

const sources=sourceBriefsFromScript(
  'O guindaste levanta materiais sobre uma obra com prédios completos ao fundo. '+
  'Os cabos movimentam a carga e o gancho sobe até a plataforma final.'
);
const sample={
  scene:{
    version:'1',
    environment:'industrial',
    skyColor:'#a7c',
    objects:[
      {objectId:'Guindaste 1',label:'Guindaste principal',type:'guindaste',
        position:{x:-2,y:0,z:0},dimensions:[7,9,3],colour:'amarelo'},
      {entityId:'Caixa 1',label:'Materiais levantados',type:'caixa',
        position:{x:1,y:1,z:0},dimensions:[2,1.5,1.5],colour:'marrom'},
    ],
    motion:{objectId:'Caixa 1',type:'subir',displacement:{x:0,y:3,z:0}},
  },
};
describe('realistic AI JSON formats from Lovable / Gemini',()=>{
  it('converts a wrapped, alias-heavy Portuguese response into a moving 3D scene',()=>{
    const norm=normalizeCompactWorldOutput(sample) as any;
    expect(norm.version).toBe(1);
    expect(norm.setting).toBe('industrial');
    expect(norm.entities[0].kind).toBe('crane');
    expect(norm.entities[1].kind).toBe('cargo');
    expect(norm.action.target).toBe('caixa_1');
    const scene=compileCompactWorld(sample,sources);
    expect(scene.audit.objectCount).toBeGreaterThanOrEqual(4);
    expect(scene.program.tracks.map(x=>x.node)).toContain('caixa_1');
    expect(scene.program.tracks.map(x=>x.node)).toContain('guindaste_1-hook');
    expect(scene.program.shots).toHaveLength(2);
  });
  it('recovers markdown-wrapped JSON and JSON preceded by a short provider explanation',()=>{
    const json=JSON.stringify(sample);
    expect(parseJson('\x60\x60\x60json\n'+json+'\n\x60\x60\x60')).toEqual(sample);
    expect(parseJson('Minha proposta:\n'+json+'\nFim da proposta.')).toEqual(sample);
  });
  it('does not invent missing objects or silently execute unknown fields',()=>{
    const invalid=structuredClone(sample) as any;
    invalid.scene.javascript='alert(1)';
    expect(()=>compileCompactWorld(invalid,sources)).toThrow(/não suportado/);
    delete invalid.scene.javascript;
    invalid.scene.motion.objectId='missingobject';
    expect(()=>compileCompactWorld(invalid,sources)).toThrow(/objeto/);
  });
  it('will not accept arbitrary prose as a scene',()=>{
    expect(parseJson('A IA achou um caminhão interessante, sem JSON')).toBeNull();
    expect(()=>compileCompactWorld({plan:{story:'estaleiro'}},sources)).toThrow();
  });
});
