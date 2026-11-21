// Sound cues derived from the same travel-based gait as the rendered movie.
import * as THREE from 'three';
import fs from 'node:fs/promises';import vm from 'node:vm';
class Canvas{getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},createLinearGradient:()=>({addColorStop(){}}),measureText:s=>({width:s.length*22}),strokeText(){},fillText(){}};}}
class Renderer{constructor(){this.shadowMap={};}setSize(){}setPixelRatio(){}dispose(){}render(){}}
const source=(await fs.readFile(new URL('fixtures/code3d-end-battle2.js',import.meta.url),'utf8')).replace('return {duration:10,renderAt,dispose(){','return {debug:{tracks,golems},duration:10,renderAt,dispose(){');
const factory=vm.runInNewContext('const BATTLE_SCENE=0;\n'+source+'\ncreateScene',{document:{createElement:()=>new Canvas()},console});
const clip=factory({...THREE,WebGLRenderer:Renderer},{},432,768),events=[];
for(let i=0;i<6;i++)for(let leg=0;leg<2;leg++){
 const tr=clip.debug.tracks[i],offset=clip.debug.golems[i].phase+(leg===0?.5:0);let previous=Math.floor(tr.at(0).d/1.3+offset);
 for(let f=1;f<7200;f++){const t=f/60,p=tr.at(t),current=Math.floor(p.d/1.3+offset);if(current>previous&&p.speed>.25)events.push({time:+t.toFixed(4),actor:i,leg,pan:Math.max(-.6,Math.min(.6,p.p.x/18)),speed:+p.speed.toFixed(3)});previous=current;}
}
events.sort((a,b)=>a.time-b.time);await fs.mkdir(new URL('../tmp/end-battle2-audio/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../tmp/end-battle2-audio/footsteps.json',import.meta.url),JSON.stringify(events,null,2));console.log(events.length+' gait-matched sound cues');clip.dispose();
