// CPU geometry preflight; this complements, and never replaces, real WebGL review.
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
let root,camera;
class Renderer {constructor(){this.shadowMap={};}setSize(){}setPixelRatio(){}clear(){}clearDepth(){}dispose(){}render(s,c){if(c.isPerspectiveCamera){root=s;camera=c;}}}
const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:s=>({width:s.length*12})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true;}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
const source=readFileSync('scripts/fixtures/construction-study.js','utf8');
const config=JSON.parse(readFileSync('scripts/fixtures/construction-study.plan.json','utf8'));
let instances=0;
for(let clip=0;clip<10;clip++){
 const create=new Function('const CONSTRUCTION_CLIP_START='+clip*12+';\n'+source+';return createScene;')();
 const scene=create({...THREE,WebGLRenderer:Renderer},{},720,1280);
 const pose=t=>{scene.renderAt(t);root.updateMatrixWorld(true);const parts=[...camera.matrixWorld.elements];root.traverse(o=>{parts.push(o.visible?1:0,...o.matrixWorld.elements);if(o.isInstancedMesh){parts.push(...o.instanceMatrix.array);instances=Math.max(instances,o.count);}});assert.ok(parts.every(Number.isFinite),'Nonfinite transform at '+(clip*12+t));return createHash('sha256').update(JSON.stringify(parts)).digest('hex');};
 for(const t of [0,.1,2,4,6,8,10,11.9]){const a=pose(t);pose(11.9-t);assert.equal(pose(t),a,'Pose replay at '+(clip*12+t));}
 scene.dispose();
}
assert.equal(config.floors,2);console.log('PASS: all 80 scene samples finite and repeatable; largest instance batch='+instances+'. Native browser review still required.');
